// Off iOS (web preview, tests, Android for now) there is no on-device
// model: the provider reports unavailable and the router skips it.
// runtime.ios.ts is picked instead on iPhone builds.

import type { LocalRuntime } from './runtimeTypes';

export const localRuntime: LocalRuntime | null = null;
