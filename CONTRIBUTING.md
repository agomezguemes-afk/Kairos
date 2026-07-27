# Contributing to Kairos

Working agreements for keeping the codebase shippable and the history
bisectable. Read once; revisit when something below feels wrong.

## Branching

Three long-lived branches, one per environment:

```
Production  ← Producción        (App Store / TestFlight External — lo que usan
                                 los usuarios finales)
              ↑ PR + aprobación
Testing     ← QA pre-release    (TestFlight Internal, smoke test manual)
              ↑ PR + CI en verde
Development ← Integración       (rama de trabajo por defecto: TODO cambio
                                 manual se hace aquí primero)
              ↑ PR (o push directo para hotfixes < 10 LOC)
feature/*   ← Trabajo de feature (sale de Development, PR de vuelta a Development)
hotfix/*    ← Bug urgente en prod (sale de Production, PR a Production +
                                 back-merge a Testing y Development)
```

El día a día:

1. `git switch Development && git pull`
2. `git switch -c feature/<tema>`
3. Trabaja, commit, push, abre PR contra **`Development`**.
4. Mergea cuando el CI esté verde.

Promoción a Testing:

1. Cuando `Development` tenga un conjunto coherente de cambios listos para QA:
   `git switch Testing && git merge --no-ff Development` → push.
2. El CI corre las mismas puertas; smoke-test de la build de Testing en dispositivo.

Promoción a Production (release):

1. Cuando Testing esté validado:
   `git switch Production && git merge --no-ff Testing` → push.
2. Etiqueta el commit: `git tag -a v0.X.0 -m "..."` → push del tag.
3. El CI construye la variante de producción (Fase 3 lo automatizará).

Hotfixes:

1. Sale de `Production`: `git switch -c hotfix/<tema> Production`.
2. PR a `Production`. Tras el merge, **back-merge a Testing y Development** para
   que el fix no se rompa de nuevo en la siguiente promoción.

Feature branches are short-lived. If a feature has not landed within
~2 weeks it either ships behind a flag or gets descoped.

## Local setup

```bash
npm install            # also wires the husky hooks via `prepare`
npm start              # Expo dev server
```

After `npm install` the pre-commit hook is active. Test it:

```bash
git commit --allow-empty -m "smoke"   # should run lint-staged silently
```

## Definition of done

Before opening a PR:

- [ ] `npm run typecheck` is green
- [ ] `npm run lint` reports zero errors (warnings are tracked separately)
- [ ] `npm test` is green
- [ ] `npm run format:check` is green
- [ ] On-device smoke test if the change is visual / animation / gestural
- [ ] PR description states the user-visible impact and any deferred follow-ups

CI runs the same gates on every push. PRs targeting `Production` cannot merge
with red CI.

## Commit conventions

Loosely follow Conventional Commits. Type prefixes used here:

- `feat:` user-visible feature
- `fix:` user-visible bug fix
- `refactor:` internal restructure, no behavior change
- `perf:` measurable performance improvement
- `style:` purely formatting (rare — usually done via tooling)
- `test:` new or changed tests
- `docs:` documentation only
- `chore:` build / tooling / dependency updates
- `ci:` CI/pipeline changes

Keep each commit a single logical change. Each commit should compile,
typecheck, lint, and pass tests. Long-running branches squash on merge
when the granularity stops being useful.

Commit messages explain **why**, not just **what**. If the change has a
non-obvious motivation, write it out.

## Code style

- TypeScript strict. Prefer explicit return types on exports.
- No inline emoji / decorative comments. Comments explain non-obvious
  invariants, not what the next line does.
- Components: `PascalCase.tsx`. Utilities & hooks: `camelCase.ts`.
- React Native styles go through `src/theme/tokens.ts` — no raw hex,
  no raw px outside the theme.
- Pure logic lives in `lib/` and `*/lib/` subfolders with a paired
  `*.dev.ts` smoke suite (or a proper `*.test.ts` — preferred for new
  code).

## Testing

Two tiers today:

1. **Vitest** (`npm test`) — formal runner. New tests should be written
   as `src/**/<name>.test.ts` using `describe / it / expect`.
2. **Legacy `.dev.ts` smokes** — self-contained tsx scripts run by
   `src/__tests__/dev-suites.test.ts`. Acceptable for new logic but
   slow (subprocess per file). Migrate to Vitest when convenient.

React Native component testing is deferred until a proper RN test setup
is in place. Don't gate features on UI tests yet — relies on device QA.

## Releases

1. Land everything into Production via PR (Development → Testing → Production).
2. Update `CHANGELOG.md` under `## [Unreleased]`.
3. Bump `package.json` and `app.json` versions.
4. `git tag -a vX.Y.Z -m "..."` + push tag.
5. Build via the device pipeline (TestFlight / xcodebuild).
6. Smoke test on iPhone 12 Pro before promoting.

Future automation (Fase 3): tag push triggers EAS build + TestFlight
submission.

## Reporting issues

Open a GitHub issue with:

- Steps to reproduce
- Expected vs actual
- iOS version + device model
- Screenshot or screen recording if visual

For security issues, email **agomezguemes@gmail.com** directly — do not
open a public issue.
