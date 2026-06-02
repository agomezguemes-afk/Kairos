# Supabase — Kairos backend

Migrations + Edge Functions for Kairos. Everything in this folder is
checked into git so the backend is reproducible across machines and
environments (dev / staging / prod Supabase projects).

## Layout

```
supabase/
├── config.toml                  ← project_id + local-dev ports
├── migrations/
│   └── 20260602125950_ai_quota.sql
└── functions/
    ├── _shared/
    │   ├── cors.ts
    │   └── tiers.ts
    └── ai-chat/
        └── index.ts             ← AI proxy with per-user quota
```

## Deploying changes

The Supabase CLI is a peer dep (run via `npx supabase`). First time on a
machine you need to link to the remote project:

```bash
npx supabase login              # one-time auth
npx supabase link --project-ref <PROJECT_REF>
```

Then push migrations + functions:

```bash
# Apply pending migrations to the linked project
npx supabase db push

# Deploy the AI proxy function
npx supabase functions deploy ai-chat
```

## Edge Function secrets

The `ai-chat` function reads these from the Supabase secret store
(NOT from the bundle). Set them per env with:

```bash
# Required — always
npx supabase secrets set GROQ_API_KEY=<key>     # free tier, sign up at console.groq.com

# Required when Pro tier ships (RevenueCat phase)
npx supabase secrets set ANTHROPIC_API_KEY=<key>
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
injected automatically by the platform — do NOT set them manually.

## Per-environment

The same migrations and function code deploy to dev / staging / prod
Supabase projects. Switch the active link with:

```bash
npx supabase link --project-ref <DEV_REF>      # for dev
npx supabase link --project-ref <PROD_REF>     # for prod
```

Then re-run `db push` and `functions deploy`. Secrets are per-project so
prod and dev have independent `GROQ_API_KEY` slots — useful for keeping
prod usage out of your dev rate-limit window.

## Quota model

See `migrations/20260602125950_ai_quota.sql` for the schema and the
`ai_quota_count_24h` RPC. Tier caps live in code at
`functions/_shared/tiers.ts` so we can tweak them without a migration.

Current defaults:

| Tier | Cap / 24h | Provider  | Model                    |
| ---- | --------- | --------- | ------------------------ |
| free | 30        | Groq      | llama-3.3-70b-versatile  |
| pro  | 500       | Anthropic | claude-sonnet-4-6        |

Bump these in `tiers.ts` and redeploy the function — no DB change needed.

## Pruning

A `pg_cron` job (defined in the migration) deletes ledger rows older
than 7 days at 03:17 UTC daily. The quota math only ever looks at the
trailing 24h so older rows are pure analytics overhead.
