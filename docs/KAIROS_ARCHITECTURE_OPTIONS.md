# KAIROS — Architecture Options (the deep veins)

_Working doc for **Álvaro to react to**, not a plan to execute. Written
2026-06-15 in the security worktree, LOCAL-ONLY. The strategy ("what / why") lives
in [KAIROS_VISION.md](./KAIROS_VISION.md); this is the engineering companion
("how"), laid out as **forks with honest tradeoffs**. The deep veins are
architecture — they get decided **with** Álvaro, not implemented blind. Nothing
here has been built; the only Kai code that exists in this worktree is the
pure-logic brain in `src/features/kai/` (memory, proposal, metricTrend, brain,
reflection — all unit-tested) and the `KaiFace` character explorations._

Three veins, in dependency order. Each: **the real problem → 2–3 concrete options
→ honest tradeoffs → my recommendation → what it costs.** Where I have a view I
say so plainly; the decision is yours.

---

## Vein 1 — Kai's free agency & interactivity

**The real problem.** VISION §3 promises a *two-loop* agent: Loop A (active,
tool-calling, on demand — exists in `lib/ai/agent.ts`) and Loop B (passive, "Kai
thinks while you're away" → proposals). Loop B is the new core and the whole moat.
The architecture question isn't *whether* — it's **where Loop B runs, what wakes
it, and how much it's trusted to do**. Get this wrong and Kai is either inert
(never thinks) or creepy (acts behind your back). The autonomy guardrail —
*proposes, you dispose* — has to be structural, not a convention.

Three sub-decisions:

### 1a. What triggers Loop B
| Option | What it is | Pro | Con |
| --- | --- | --- | --- |
| **A — On app-open only** | Kai reasons when you open the app, before Home renders | Dead simple, no background entitlements, no battery/privacy surface, deterministic | Kai "wakes" only when you show up — no "I already moved leg day" surprise before you open it |
| **B — On-open + light local schedule** | A + a `BackgroundTask`/`expo-task-manager` tick (e.g. once/day) that pre-computes proposals | Feels alive ("Kai thought overnight"); proposals are ready instantly | iOS background execution is unreliable & throttled; adds an entitlement; easy to over-promise |
| **C — Server-side cron** | A backend job reasons per user on a schedule, pushes proposals | True "always thinking"; heavy LLM work off-device | Breaks local-first (VISION §9 "no cloud lock-in"); needs infra + auth + cost; biggest privacy surface |

**Recommendation: A now, design the proposal pipeline so B is a drop-in later.**
On-open covers ~95% of the felt value ("I open it and Kai already thought") with
zero entitlement/privacy cost. The trap is letting on-open reasoning block the
first paint — so compute it **after** first render, off the critical path, and
hydrate the Kai card when ready. Don't build C until there's a real user asking
for genuinely-overnight adaptation; it trades the local-first identity for a
feature most users won't perceive.

### 1b. Where the reasoning runs (deterministic vs LLM)
The pure brain already in `src/features/kai/` (`brain.think()`, `proposal.ts`,
`metricTrend.ts`) is **deterministic** — it emits real proposals (deload,
plateau, imbalance) with no network, instantly, offline, free, and *testable*.

- **Option A — Deterministic-only.** Ship Loop B as strong heuristics. Pro: free,
  offline, private, unit-tested, zero latency, no humo. Con: can't phrase novel
  insight, capped at the rules you write.
- **Option B — Deterministic core + LLM narration.** Heuristics decide *what* to
  propose; an LLM only *phrases* it in Kai's voice. Pro: keeps decisions
  auditable & cheap, adds warmth/specificity. Con: needs a network path + a
  cost/latency budget + a graceful offline fallback (the deterministic copy).
- **Option C — LLM-reasons.** The model both decides and phrases. Pro: most
  flexible. Con: hardest to trust/test, most expensive, the classic "AI slop"
  risk Álvaro is explicitly fighting; hallucinated training advice is a real harm.

**Recommendation: A → B, never skip to C.** Decisions stay in tested code you can
reason about (this is what makes adaptation *not* humo, VISION §3); the LLM earns
its place only as a voice layer with a deterministic fallback. This also means
Loop B delivers value *before* any API key exists — exactly VISION's P3 sequencing.

### 1c. How proposals are trusted (the autonomy spine)
This is the non-negotiable. Make it structural:
- Proposals are **first-class persisted objects** with explicit state
  (`pending` → `accepted`/`rejected`/`expired`), never silent mutations.
- A proposal **describes** a change; applying it is a **separate, user-initiated**
  step. Rejecting is one tap and is *remembered* (feeds `memory.ts`
  `observeProposalDecision`, so Kai stops re-proposing what you keep killing).
- **At most one** proactive surface at a time (VISION §9, "silence > noise").

No fork here — this is the architecture that protects the user. The only choice is
storage (see Vein 3).

---

## Vein 2 — Blocks with real depth (beyond predefined templates)

**The real problem.** Álvaro: block-building must "have meaning beyond a series of
predefined blocks." Today blocks lean on templates; the risk is a glorified picker.
"Depth" can mean three different things — worth separating, because they cost very
differently:

| Reading of "depth" | What it means concretely | Cost | Payoff |
| --- | --- | --- | --- |
| **A — Compositional** | Blocks are composed from primitives (text, exercise, timer, chart, custom field, columns) the user freely nests/arranges — Notion-style, not a fixed list | Medium — much of the node/column system already exists per CLAUDE.md | High: every user's block is genuinely theirs; templates become *starting points*, not cages |
| **B — Generative** | Kai builds/edits blocks from intent ("a 12-wk marathon base") via the tool-calling agent — the block is a living thing Kai co-authors and keeps adapting | Medium-High — agent tools exist; needs the block schema to be agent-writable + validated | Highest: ties Vein 2 to Vein 1 — blocks evolve as your goals drift |
| **C — Semantic** | Blocks *understand* themselves: a block knows it's a "strength mesocycle wk3/12", so Kai can reason about it (progression, deload timing) — i.e. typed intent, not just visual content | High — needs a metadata/intent layer above the visual nodes | Deep: enables cross-block reasoning (Vein 3) and real plan evolution |

These stack: A is the canvas, B makes Kai a co-author on it, C lets Kai *reason*
about what's on it.

**Recommendation: A is table-stakes (largely built) — invest the new effort in
C's seed, then B.** The thing that makes blocks "mean something" is **C: a thin
intent/metadata layer** — each block (and ideally each exercise) carries typed
intent (domain, phase, target, progression model) separate from its visual
content. That's what turns "a series of predefined blocks" into a system Kai can
reason over, and it's the bridge to Vein 3. It's also *additive*: the visual node
system doesn't change; you annotate it. B (generative editing) then rides on top
because the agent has typed targets to write to. Concretely, the smallest real
step is to define that intent schema (a `BlockIntent`/`ExerciseIntent` type) and
let Kai read it — no UI rewrite required.

**Honest caution.** Don't over-build the intent taxonomy up front. Start with the
2–3 fields the deterministic brain actually consumes today (domain, a progression
hint, a target metric) and grow it only when a real proposal needs more. A
sprawling ontology nobody fills is the failure mode here.

---

## Vein 3 — The millimetric data model + analysis engine

**The real problem.** The structural moat (VISION §3) is that Kairos tracks
**user-defined fields** — so Kai can analyze *your* definition of progress (RPE,
mood, bar speed, sleep, anything) over time, which a fixed-schema competitor
*structurally cannot*. "Millimetric" means: store arbitrary metrics losslessly,
query them as time-series fast, and reason over them honestly. Two sub-decisions:

### 3a. Storage shape for custom fields + their history
| Option | Shape | Pro | Con |
| --- | --- | --- | --- |
| **A — JSON blobs in the existing store** | Custom fields live as `jsonb`-style objects on sets/exercises (today's Zustand+AsyncStorage) | No new dependency; matches current model; fine at personal scale | No indexed time-series queries; analyzing "RPE over 6 months" means loading & scanning everything in JS |
| **B — Local SQLite (`expo-sqlite`)** | Normalized `metric_observations(exercise_id, field, value, ts)` table beside the doc store | Real indexed queries, time-series at scale, the analysis engine gets cheap reads, offline-first | A second persistence layer to keep in sync with the doc store; migration story |
| **C — Local-first DB (WatermelonDB / Realm)** | Reactive local DB as the system of record | Built for exactly this; observable queries | Big architectural commitment; rewrites the store; heavy for a solo project right now |

**Recommendation: A is fine until analysis hurts; pre-decide B as the upgrade.**
At personal scale (one user, months of data) JSON-scan is genuinely OK and the
existing `metricTrend.ts` already analyzes *any* metric series in pure JS. The
moment Loop B reasons over many metrics × long history on every app-open and it's
sluggish, the surgical fix is **B: an append-only `metric_observations` table** as
a read-optimized *projection* of the doc store (doc store stays the system of
record; SQLite is the queryable index). That's a contained addition, not a
rewrite — unlike C. I'd avoid C unless reactivity across the whole app becomes the
bottleneck, which it isn't today.

### 3b. The analysis engine
Already seeded in this worktree, pure & tested: `metricTrend.analyzeMetric`
(works over *any* metric, respects `lowerIsBetter`), `brain.think` (composes
trends + memory + rules), `reflection.reflect` (makes competence visible). The
architecture decision is **keep analysis pure and deterministic** — it's what
makes the moat *trustworthy* (testable, offline, honest, no hallucinated trends).
The LLM, if/when added, sits *above* this as narration (Vein 1b), never as the
source of the numbers.

- Recommended invariant: **numbers come from tested pure functions; the LLM only
  phrases them.** A trend Kai shows you should always be reproducible from your
  data by code you can read. This is the difference between "adapts to you for
  real" and humo.

---

## How the veins connect (the one-paragraph synthesis)

Vein 2C (typed block intent) gives Vein 3 something meaningful to analyze; Vein 3
(pure analysis over your custom metrics) gives Vein 1 (Loop B) real things to
propose; Vein 1's proposal spine writes accepted changes back onto Vein 2's
blocks. The through-line that keeps all three from becoming AI slop: **decisions
live in tested, deterministic, local code; the LLM is a voice, not an oracle; Kai
proposes, you dispose.** That's the same guardrail in three places.

## Suggested smallest real steps (only if/when Álvaro greenlights)
1. **Vein 1c + 3b** are already largely seeded (`proposal.ts`, `memory.ts`,
   `metricTrend.ts`, `brain.ts`) — the next honest step is wiring a **proposal
   inbox UI shell** fed by the deterministic brain (VISION P1), on-open, off the
   first-paint path. No LLM, fully verifiable on the sim.
2. **Vein 2C**: define a minimal `BlockIntent` type (domain + progression hint +
   target metric) the brain already wants — additive, no UI rewrite.
3. **Vein 3a → B** only when JSON-scan analysis measurably hurts.

None of this is started; it waits on your call on the forks above.
