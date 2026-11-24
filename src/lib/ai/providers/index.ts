// The providers this build has, and the context requests are routed in.
//
// The cloud provider is always registered. On-device ones register
// themselves at app start (local/install.ts), so this module, and every
// caller that imports it, stays free of native imports and testable.

import { groqProvider } from './groq';
import type { LlmProvider, RouteContext } from './types';

const registry: LlmProvider[] = [groqProvider];

export function registerProvider(provider: LlmProvider): void {
  if (!registry.some((p) => p.id === provider.id)) registry.push(provider);
}

export function unregisterProvider(id: string): void {
  const i = registry.findIndex((p) => p.id === id);
  if (i >= 0) registry.splice(i, 1);
}

export function availableProviders(): LlmProvider[] {
  return [...registry];
}

let live: RouteContext = { online: true, cloudConsent: true, foreground: true, thermal: 'nominal' };

/**
 * The context requests run in. App-level code reports changes (AppState in
 * local/install.ts; network, thermal state and the consent screen later).
 * Cloud consent starts on because that is how the app has behaved so far;
 * the consent screen required by App Review guideline 5.1.2(i) will own it.
 */
export function currentRouteContext(): RouteContext {
  return live;
}

export function updateRouteContext(patch: Partial<RouteContext>): void {
  live = { ...live, ...patch };
}

export { planRoute, routeChat, TASK_ORDER } from './router';
export type { Attempt, RoutePlan, Routed, SkipReason } from './router';
export type * from './types';
