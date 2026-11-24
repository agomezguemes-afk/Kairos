import type { LocalModel } from './catalog';
import type { LlamaCompletionParams, LlamaCompletionResult } from './mapping';

export interface DeviceInfo {
  modelName: string | null;
  totalMemoryBytes: number | null;
}

export interface BenchNumbers {
  /** Prompt reading, tokens/s. */
  promptPerSecond: number;
  /** Generation, tokens/s. */
  generatePerSecond: number;
}

/** What the phone can do with downloaded models. Absent off iOS. */
export interface LocalRuntime {
  device(): DeviceInfo;
  isDownloaded(model: LocalModel): Promise<boolean>;
  /** Resolves once the file is complete and checked; rejects on failure or cancel. */
  download(model: LocalModel, onProgress: (fraction: number) => void): Promise<void>;
  cancelDownload(model: LocalModel): Promise<void>;
  remove(model: LocalModel): Promise<void>;
  /** Loads `model`, releasing any other one first. Resolves with the load time (ms). */
  load(model: LocalModel, onProgress?: (fraction: number) => void): Promise<number>;
  loadedModelId(): string | null;
  complete(
    params: LlamaCompletionParams,
    onToken?: (text: string) => void,
  ): Promise<LlamaCompletionResult>;
  stop(): Promise<void>;
  bench(): Promise<BenchNumbers>;
  release(): Promise<void>;
}
