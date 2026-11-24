// On-device models through llama.rn (llama.cpp + Metal).
//
// Files live in Library/Caches/models: iOS storage guidelines put
// re-downloadable data there (Documents is backed up to iCloud, and 1 GB
// in everyone's backup gets apps rejected). iOS may purge Caches under
// storage pressure, so presence is always checked and a missing file just
// means "download again".

import * as Device from 'expo-device';
import * as FS from 'expo-file-system/legacy';
import { initLlama, releaseAllLlama, type LlamaContext } from 'llama.rn';

import { LOCAL_CONTEXT_TOKENS, type LocalModel } from './catalog';
import type { LlamaCompletionParams, LlamaCompletionResult } from './mapping';
import type { LocalRuntime } from './runtimeTypes';

const DIR = `${FS.cacheDirectory ?? ''}models/`;
/** "GGUF" in base64: the first four bytes of every model file. */
const GGUF_MAGIC_B64 = 'R0dVRg==';
/** Room left free on the phone after a download, beyond the file itself. */
const DISK_MARGIN_BYTES = 500 * 1024 ** 2;

const pathOf = (m: LocalModel) => `${DIR}${m.file}`;
/** llama.cpp opens plain paths. */
const plainPath = (uri: string) => decodeURI(uri.replace(/^file:\/\//, ''));

let ctx: LlamaContext | null = null;
let ctxModelId: string | null = null;
const downloads = new Map<string, FS.DownloadResumable>();

async function ensureDir() {
  const info = await FS.getInfoAsync(DIR);
  if (!info.exists) await FS.makeDirectoryAsync(DIR, { intermediates: true });
}

async function checkFile(uri: string, model: LocalModel): Promise<void> {
  const info = await FS.getInfoAsync(uri);
  if (!info.exists || info.size !== model.sizeBytes)
    throw new Error(
      `El archivo descargado no tiene el tamaño esperado (${info.exists ? info.size : 0} de ${model.sizeBytes} bytes).`,
    );
  const head = await FS.readAsStringAsync(uri, {
    encoding: FS.EncodingType.Base64,
    position: 0,
    length: 4,
  });
  if (head !== GGUF_MAGIC_B64) throw new Error('El archivo descargado no es un modelo GGUF.');
}

async function release(): Promise<void> {
  ctx = null;
  ctxModelId = null;
  await releaseAllLlama();
}

export const localRuntime: LocalRuntime = {
  device: () => ({ modelName: Device.modelName, totalMemoryBytes: Device.totalMemory }),

  async isDownloaded(model) {
    const info = await FS.getInfoAsync(pathOf(model));
    return info.exists && info.size === model.sizeBytes;
  },

  async download(model, onProgress) {
    await ensureDir();
    const free = await FS.getFreeDiskStorageAsync();
    if (free < model.sizeBytes + DISK_MARGIN_BYTES)
      throw new Error('No hay espacio suficiente en el iPhone para este modelo.');
    const partial = `${pathOf(model)}.part`;
    const task = FS.createDownloadResumable(model.url, partial, {}, (p) => {
      const total = p.totalBytesExpectedToWrite > 0 ? p.totalBytesExpectedToWrite : model.sizeBytes;
      onProgress(Math.min(1, p.totalBytesWritten / total));
    });
    downloads.set(model.id, task);
    try {
      const result = await task.downloadAsync();
      if (!result) throw new Error('Descarga cancelada.');
      if (result.status !== 200) throw new Error(`El servidor respondió ${result.status}.`);
      await checkFile(partial, model);
      await FS.moveAsync({ from: partial, to: pathOf(model) });
    } catch (e) {
      await FS.deleteAsync(partial, { idempotent: true });
      throw e;
    } finally {
      downloads.delete(model.id);
    }
  },

  async cancelDownload(model) {
    const task = downloads.get(model.id);
    if (task) await task.cancelAsync();
  },

  async remove(model) {
    if (ctxModelId === model.id) await release();
    await FS.deleteAsync(pathOf(model), { idempotent: true });
  },

  async load(model, onProgress) {
    if (ctx && ctxModelId === model.id) return 0;
    if (ctx) await release();
    const started = Date.now();
    ctx = await initLlama(
      {
        model: plainPath(pathOf(model)),
        n_ctx: LOCAL_CONTEXT_TOKENS,
        n_gpu_layers: 99,
        flash_attn_type: 'auto',
        // q8 halves the KV cache next to f16 at no visible quality cost.
        cache_type_k: 'q8_0',
        cache_type_v: 'q8_0',
        use_mlock: false,
      },
      onProgress ? (p) => onProgress(p / 100) : undefined,
    );
    ctxModelId = model.id;
    return Date.now() - started;
  },

  loadedModelId: () => ctxModelId,

  async complete(params: LlamaCompletionParams, onToken) {
    if (!ctx) throw new Error('No hay ningún modelo local cargado.');
    const res = await ctx.completion(params, onToken ? (d) => onToken(d.token) : undefined);
    return res as unknown as LlamaCompletionResult;
  },

  async stop() {
    if (ctx) await ctx.stopCompletion();
  },

  async bench() {
    if (!ctx) throw new Error('No hay ningún modelo local cargado.');
    // 256 prompt tokens and 64 generated: a goal prompt and a short answer.
    const r = await ctx.bench(256, 64, 1, 2);
    return { promptPerSecond: r.speedPp, generatePerSecond: r.speedTg };
  },

  release,
};
