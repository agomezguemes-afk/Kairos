// Models Kairos can download and run on the phone (llama.rn / GGUF).
//
// Sizes and SHA-256 are the Hugging Face LFS records of each file (read
// 2026-11-24). Which one becomes the default is decided by measuring on
// real phones in the AI lab; until then all three are candidates.

import type { AiTask } from '../providers/types';

export interface LocalModel {
  id: string;
  name: string;
  /** Parameters, for display. */
  params: string;
  file: string;
  url: string;
  sizeBytes: number;
  sha256: string;
  licence: string;
  /** One line on why it is a candidate. */
  note: string;
  /**
   * Tasks it is trusted with. None take the block agent yet: its prompt
   * (profile, block, catalogue, ~22 tool schemas) runs to several thousand
   * tokens, beyond a 2K on-device context; a compact, intent-routed agent
   * comes first. Revised with the lab's measurements and the eval set.
   */
  tasks: readonly AiTask[];
}

const hf = (repo: string, file: string) => `https://huggingface.co/${repo}/resolve/main/${file}`;

export const LOCAL_MODELS: readonly LocalModel[] = [
  {
    id: 'qwen3-0.6b-q4km',
    name: 'Qwen3 0.6B',
    params: '0,6 B',
    file: 'Qwen3-0.6B-Q4_K_M.gguf',
    url: hf('unsloth/Qwen3-0.6B-GGUF', 'Qwen3-0.6B-Q4_K_M.gguf'),
    sizeBytes: 396_705_472,
    sha256: 'ac2d97712095a558e31573f62f466a3f9d93990898b0ec79d7c974c1780d524a',
    licence: 'Apache-2.0',
    note: 'El más ligero: cabe en cualquier iPhone; para entender objetivos.',
    tasks: ['goal'],
  },
  {
    id: 'lfm2.5-1.2b-q4km',
    name: 'LFM2.5 1.2B',
    params: '1,2 B',
    file: 'LFM2.5-1.2B-Instruct-Q4_K_M.gguf',
    url: hf('LiquidAI/LFM2.5-1.2B-Instruct-GGUF', 'LFM2.5-1.2B-Instruct-Q4_K_M.gguf'),
    sizeBytes: 730_895_168,
    sha256: 'b1b3de114215d9507409a662a501a631095a479a419584e8a2ded6304b19b4f5',
    licence: 'LFM Open 1.0 (gratis por debajo de 10 M$ de ingresos/año)',
    note: 'Muy rápido; objetivos y textos cortos del coach. El término medio para 4 GB.',
    tasks: ['goal', 'coach'],
  },
  {
    id: 'qwen3-1.7b-q4km',
    name: 'Qwen3 1.7B',
    params: '1,7 B',
    file: 'Qwen3-1.7B-Q4_K_M.gguf',
    url: hf('unsloth/Qwen3-1.7B-GGUF', 'Qwen3-1.7B-Q4_K_M.gguf'),
    sizeBytes: 1_107_409_472,
    sha256: 'b139949c5bd74937ad8ed8c8cf3d9ffb1e99c866c823204dc42c0d91fa181897',
    licence: 'Apache-2.0',
    note: 'El mejor español de los tres; también la revisión semanal. Pensado para 6 GB o más.',
    tasks: ['goal', 'coach', 'review'],
  },
];

export function findModel(id: string | null | undefined): LocalModel | undefined {
  return LOCAL_MODELS.find((m) => m.id === id);
}

/** Context the lab and the provider load models with: enough for the goal and coach prompts. */
export const LOCAL_CONTEXT_TOKENS = 2048;

const GB = 1024 ** 3;

export type FitVerdict = 'ok' | 'tight' | 'too-big' | 'unknown';

/**
 * A first guess, before anything is measured on the device. iOS does not
 * publish per-app limits; without the increased-memory entitlement an app
 * is killed around half the RAM (one report: 2.1 GB on a 4 GB iPhone 13).
 * Kairos itself takes ~0.45 GB; the model needs its weights, a q8 KV cache
 * for LOCAL_CONTEXT_TOKENS and Metal buffers, ~1.3× the file.
 */
export function fitOnDevice(model: LocalModel, totalMemoryBytes: number | null): FitVerdict {
  if (!totalMemoryBytes) return 'unknown';
  const budget = totalMemoryBytes * 0.5 - 0.45 * GB;
  const need = model.sizeBytes * 1.3 + 0.15 * GB;
  if (need <= budget * 0.8) return 'ok';
  if (need <= budget) return 'tight';
  return 'too-big';
}

/** Decimal units, as iOS shows storage in Settings: 397 MB, not 378 MiB. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1).replace('.', ',')} GB`;
  return `${Math.round(bytes / 1e6)} MB`;
}
