// The providers this build has, and the context requests are routed in.
//
// Only the cloud provider exists today. The on-device ones (Apple
// Foundation Models, a downloaded model through llama.rn) join this list
// when their native modules land; callers do not change.

import { groqProvider } from './groq';
import type { LlmProvider, RouteContext } from './types';

export function availableProviders(): LlmProvider[] {
  return [groqProvider];
}

/**
 * The context requests run in until the app reports the real one
 * (network, consent screen, AppState, thermal state). Cloud consent is on
 * by default because that is how the app has behaved so far; the consent
 * screen required by App Review guideline 5.1.2(i) will own this value.
 */
export function currentRouteContext(): RouteContext {
  return { online: true, cloudConsent: true, foreground: true, thermal: 'nominal' };
}

export { planRoute, routeChat, TASK_ORDER } from './router';
export type { Attempt, RoutePlan, Routed, SkipReason } from './router';
export type * from './types';
