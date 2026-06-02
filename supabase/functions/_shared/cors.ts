// CORS preflight + headers for KAIROS Edge Functions.
// We allow * on the React Native client because it's a mobile app, not a
// browser — origin isn't enforced. Web preview builds (Expo web) get the
// same headers so dev tooling works without a separate config.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
} as const;

export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}
