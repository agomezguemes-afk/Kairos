# DECISIONS — night run 2026-06-11

One line per decision: what / why / alternative rejected.

1. **Kept v3 token architecture, changed values only.** Brief's design block assumed a dark-theme repo; `src/theme/tokens.ts` was already a refined light system. Swapped canonical values (#D4AF37 gold, #FFFFFF bg, #1A1A2E ink) into the existing structure instead of replacing it. Rejected: flattening to the brief's 4-color minimum — would lose discipline colors, semantic colors, tabular numerals, warm zones.
2. **Deleted `src/types/tokens.ts` (dark theme) instead of migrating it.** Zero importers — it was the dead file the brief mistook for the live tokens. Rejected: migrating it to light (dead code).
3. **Retuned gold derivatives** (deep #8B6F1D, light #EBDCAD, glow rgba(212,175,55,.18)) to match the new #D4AF37 hue instead of keeping #C9A96E-era derivatives. Rejected: keeping old derivatives (visible hue mismatch).
4. **Data-default colors updated as literals** (types/core.ts, types/content.ts) rather than importing theme into the types layer. Persisted user data stores color snapshots anyway; keeps types/ dependency-free. Rejected: theme import into types (layering violation).
5. **bg.elevated kept at #F2F0EC** (not pure white) so pressed states stay visible on the new white canvas. Brief listed only two backgrounds; pressed-state contrast wins.
6. **Quality gate = typecheck + lint (0 errors) + vitest**, not audit:design — the design audit fails on ~50 files of pre-existing deprecated-shim usage; burning that down is the polish loop's job, not a commit blocker.
