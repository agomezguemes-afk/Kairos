# Contributing to Kairos

Working agreements for keeping the codebase shippable and the history
bisectable. Read once; revisit when something below feels wrong.

## Branching

Three long-lived branches, one per environment:

```
main      ← Production         (App Store / TestFlight External)
            ↑ PR + approval
staging   ← Pre-release QA      (TestFlight Internal, manual smoke test)
            ↑ PR + green CI
dev       ← Integration         (default working branch, every commit ships
                                 to the development-env build)
            ↑ PR (or direct push for hotfixes < 10 LOC)
feature/* ← Feature work        (branch off dev, PR back to dev)
hotfix/*  ← Urgent prod bug     (branch off main, PR to main + back-merge to staging + dev)
```

Day-to-day:

1. `git switch dev && git pull`
2. `git switch -c feature/<topic>`
3. Work, commit, push, open PR targeting **`dev`**.
4. Merge once CI is green.

Promotion to staging:

1. When `dev` has a coherent set of changes ready for QA:
   `git switch staging && git merge --no-ff dev` → push.
2. CI runs the same gates; smoke-test the staging build on device.

Promotion to main (release):

1. When staging has been validated:
   `git switch main && git merge --no-ff staging` → push.
2. Tag the commit: `git tag -a v0.X.0 -m "..."` → push tag.
3. CI builds the production variant (Fase 3 will automate this).

Hotfixes:

1. Branch from `main`: `git switch -c hotfix/<topic> main`.
2. PR to `main`. After merge, **back-merge to staging and dev** so the
   fix doesn't get re-broken by the next promotion.

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

CI runs the same gates on every push. PRs targeting `main` cannot merge
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

1. Land everything into main via PR.
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
