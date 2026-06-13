# KAIROS — Vision & Strategy

_Working doc. Written 2026-06-13 from market research + an audit of the real
codebase. Goal: stop being "a basic fitness app" and become a unique, defensible
product worth admiring. Niche on purpose, not mass-market._

---

## 0. The thesis in one line

**Kairos is assisted autonomy: a training system you truly own and shape, kept
alive by a resident agent that does the thinking for you.**

You stay the author of your training world. Kai (the agent) carries the
cognitive load that normally kills self-built systems — maintenance, adaptation,
and "what should I do next" — without ever hijacking your control.

---

## 1. The problem (grounded, not vibes)

- **71% of fitness-app users quit by month 3.** The failure is not technical. It
  is psychological: apps don't satisfy the deep needs that sustain a behavior —
  **autonomy, competence, relatedness** (Self-Determination Theory). Habits only
  last when they get **internalized into identity**, and that only happens in
  environments that make you feel like the author (autonomy) and visibly better
  (competence). [SDT] [solsten]
- **AI differentiation in 2026 is adaptation quality, not library size.** The
  market has shifted from static plans to adaptive ones. But almost every
  "adaptive" product is **locked to a wearable** (HRV from WHOOP/Oura) — narrow,
  hardware-gated, and it only adapts *intensity*, not your whole system. [sensai]
  [8ration]
- **Build-your-own (Notion/Obsidian) is loved for ownership + infinite
  customization** — but its fatal flaw is documented: _"you spend more time
  maintaining the system than using it."_ Power users also increasingly want
  **data ownership**, not cloud lock-in. [remio] [affine]
- **The self-coached / hybrid athlete is an underserved niche.** They stitch
  together 3 apps (run splits here, 1RM there, macros elsewhere) → fragmented
  data. They want flexibility *and* integration; generic all-in-ones are clunky
  for custom/complex training. They will self-manage to get flexibility. [onlygains]

### The gap nobody fills

| Product | Ownership / your-own-system | Real adaptive brain | No wearable required | Maintains itself |
| --- | --- | --- | --- | --- |
| WHOOP / Oura | ✗ (fixed app) | ~ (HRV only) | ✗ | ✗ |
| Fitbod / Freeletics | ✗ (generic plan) | ~ (plan gen) | ✓ | ✗ |
| Future (human coach) | ✗ | ✓ (human) | ✓ | ✓ but $200/mo, not yours |
| Notion / Obsidian for fitness | ✓✓ | ✗ (no brain) | ✓ | ✗ (you maintain it) |
| **Kairos** | **✓✓** | **✓✓** | **✓** | **✓ (the agent does)** |

That last column — _a system you own that maintains and improves itself_ — is the
white space. It resolves the core tension: **autonomy vs. done-for-you**.

---

## 2. Who it's for (niche, on purpose)

The **self-directed trainer who wants a world, not an app**: hybrid athletes,
serious enthusiasts, people who train across domains (strength + running +
mobility + recovery + mindset) and resent being boxed into one app's opinion.
They value control and identity. They are exactly the people SDT says will
internalize the habit — if we protect their autonomy and grow their competence.

We are not chasing the casual "30-day-abs" mass market. We are building the tool
the 5% of obsessives evangelize — and that scales _down_ gracefully to "I train
sometimes" without ever feeling basic.

---

## 3. The unique idea: a two-loop agent over a system you own

Kairos already has the two halves nobody else combines:

1. **A malleable canvas** — dynamic blocks/apps/exercises with **user-defined
   fields** (track *any* metric, not just sets/reps). This is the Notion/Craft
   ownership layer. It exists today (`workoutStore`, `features/blocks`).
2. **A tool-calling agent** that mutates that canvas via natural language. It
   exists today (`lib/ai/agent.ts`).

What's missing is what makes it _alive_ and _adaptive-for-real_: the agent only
thinks when you talk to it, it has no memory of you, and the "proactive" layer
(`features/planner/lib/kaiSignal.ts`) is a shallow **rule-based** first-match
generator. That is the basic-ness the project still suffers from.

The innovation is to make Kai a **two-loop resident agent with memory**:

### Loop A — Active ("Kai builds with you") — *exists, keep*
In-app, on demand: co-create blocks, ask questions, in-session coaching. The
tool-calling loop already does this.

### Loop B — Passive ("Kai thinks while you're away") — *the new core*
Between sessions (on app open / idle / a light schedule), the agent reasons over
your **full history + your custom fields + context** and produces a small number
of **proposals**, never noise:
- adjusts upcoming sessions (deload, progress, swap an exercise that's stalling),
- reshapes or suggests **blocks** as your goals drift,
- surfaces **one** calm insight ("your press has stalled 3 weeks — here's why"),
- flags plateaus / overreach before you feel them.

Crucially, proposals are **accept/reject**, written into your space as Kai cards.
This is the design that **protects autonomy** (you stay the author) while
**removing the maintenance burden** that kills self-built systems. No competitor
does this: WHOOP has no canvas, Notion has no brain, Future isn't yours.

### The connective tissue — **Kai Memory** ("Kai knows you")
A persistent, evolving model of *you*: preferences, patterns, goals, what worked,
your idiosyncratic metrics, even your language and tone. It grounds both loops so
adaptation is **to you specifically** — the antidote to generic plans, and the
thing that makes "an agent that adapts to you for real" not be humo.

**Structural advantage:** because Kairos tracks *user-defined* fields, the agent
can analyze **your** definition of progress over time — RPE, mood, sleep you
typed in, bar speed, anything — not a fixed schema. Adaptation over arbitrary
metrics is something a fixed-schema competitor structurally cannot match.

---

## 4. The innovative component, by layer (the explicit ask)

- **Architecture:** a **personal data store** (your blocks/sessions/fields, local
  first) + **Kai Memory** (durable user model) + **two agent loops** (reactive
  tool-calling, already built; proactive "thinking" pass, new) that read memory +
  store and write *proposals* back. Proposals are first-class, reviewable objects
  — not silent mutations. (Privacy/ownership: keep the data local-first; the LLM
  sees a curated, minimized context, not your whole life. This is also the
  data-ownership trend power users now demand.)
- **Functionality:** the app **maintains itself**. You open it and Kai has
  already thought: "I moved leg day, you looked beat. Here's a lighter session.
  Accept?" Plateau detection, cross-domain balancing (the hybrid-athlete unifier),
  proposal-based plan evolution, adaptation over your custom metrics.
- **Message / positioning:** _"You design your training world. Kai keeps it
  alive."_ Not another tracker, not a generic plan, not a $200 coach. A living
  system you own. (Drop "fitness app" entirely from the language.)
- **Technology:** the agentic loop + valibot-validated tools exist. Add: (1) a
  **memory store** with retrieval into prompts, (2) a **proactive trigger** +
  reasoning pass that emits proposals, (3) a **proposal inbox** UI. On-device /
  context-minimization as the privacy spine. This is buildable on what's here.

---

## 5. The ecosystem ladder (basic → ecosystem, mapped to SDT)

The "many possibilities" path. Every rung delivers value alone; the agent makes
climbing effortless. Each rung deepens autonomy and competence.

- **L0 — Log.** One workout, instant value. (competence: it counts)
- **L1 — Your first block, built by Kai.** (onboarding — shipped)
- **L2 — Arrange your space.** Apps/blocks on a canvas, your way. (autonomy)
- **L3 — Kai starts thinking.** Proactive proposals appear; you accept/reject.
  The system begins to feel alive and *yours*. (autonomy + competence)
- **L4 — Your ecosystem.** Custom metrics, multiple domains (strength, running,
  mobility, nutrition, recovery, mindset) unified; Kai orchestrates across all of
  it. The hybrid-athlete dream: one world instead of five apps. (identity)

The same product is a casual logger at L0 and a life-OS at L4. Nobody is forced
up the ladder; the agent just makes the next rung obvious.

---

## 6. What to change in the current app (concrete, even if big)

Grounded in the real files:

1. **Promote the proactive layer from rules → intelligence.** `kaiSignal.ts` is a
   pure rule matcher. Keep it as the instant, offline fallback, but add a real
   **proactive agent pass** (`lib/ai/proactive.ts`) that runs Loop B and emits
   **proposals**. This is the single highest-leverage change.
2. **Add Kai Memory** (`lib/ai/memory.ts` + store slice): a durable user model
   updated after sessions and accepted proposals; injected into every prompt.
3. **Add a Proposal model + inbox.** Proposals (adjust/add/swap/insight) are
   stored, surfaced as calm Kai cards on Home, and **accepted/rejected**. This is
   the autonomy-preserving spine.
4. **Reframe Home from "dashboard" to "your space + Kai's notes."** Home is where
   the living system shows itself: today's intent + at most one Kai proposal +
   your blocks. Calm, not a metrics wall. (AI helpful, never intrusive.)
5. **Unify domains.** Lean into the dynamic field model to be the hybrid-athlete
   unifier — one space for strength + cardio + mobility + recovery, the agent
   reasoning across them. This is the wedge against fragmentation.
6. **Language overhaul.** Remove "fitness app" framing everywhere; adopt the
   "your world / your system / your agent" voice. Identity, not tracking.

Non-negotiable guardrails (so it stays autonomy-first):
- The agent **proposes, you dispose.** Never silent destructive mutation.
- **Silence > noise.** At most one proactive surface at a time.
- **Local-first / minimized context** to the LLM. Own your data.

---

## 7. Design direction

The onboarding already moved the brand from "mild" to a real editorial identity
(Fraunces + Plus Jakarta Sans, deep gold, warm ground, physical motion). Extend
it app-wide:
- **Calm ambient agent presence.** The Kai orb persists as a quiet companion, not
  a chatbot bubble. It surfaces a proposal, breathes, gets out of the way.
- **Craftsman's canvas.** Blocks should feel like a maker's tool (Craft/Notion
  polish) but warmer and editorial — not a spreadsheet.
- **Editorial data.** Numbers and progress are the hero (competence made
  visible): big Fraunces numerals, one gold accent, generous air.
- **Motion that's alive, not "AI-made":** physical springs, no slide-in cascades
  (the language we just built in onboarding).

---

## 8. Phased plan (highest leverage first, all verifiable on the sim)

- **P1 — Proposal model + inbox (UI shell) + Kai card on Home.** Make the
  autonomy-preserving spine real with mock proposals first. Verifiable, no LLM.
- **P2 — Kai Memory store** + inject into existing prompts. Adaptation gets real.
- **P3 — Proactive pass (Loop B).** Start with strong deterministic proposals
  (plateau, deload, imbalance) → then LLM-backed reasoning. Ship value before AI.
- **P4 — Home reframe + language overhaul.**
- **P5 — Cross-domain unification.**

Ship each behind the existing local-only / no-deploy guardrails. Prove with the
simulator. Sequence so every phase is useful even if the next never ships.

---

## 9. What we deliberately do NOT do (no humo)

- No "AI that does everything" — Loop B emits **few, high-confidence** proposals.
- No wearable dependency for the core loop (works with what you log).
- No mass-market chase / no streak-spam gamification. Identity, not dark patterns.
- No silent auto-changes to your space. Ever.
- No cloud lock-in of your data as a default.

---

## Sources

- [SDT] Self-Determination Theory — autonomy, competence, relatedness:
  https://selfdeterminationtheory.org/theory/ ,
  https://www.simplypsychology.org/self-determination-theory.html
- [solsten] Why fitness apps fail (223,863 users; 71% churn by month 3):
  https://solsten.io/blog/why-fitness-apps-fail-psychology-analysis
- [sensai] Best AI workout apps ranked by real AI depth; adaptation > library:
  https://www.sensai.fit/blog/best-ai-workout-app
- [8ration] Why the best fitness apps are moving to agentic AI in 2026:
  https://www.8ration.com/blogs/agentic-ai-fitness-apps/
- [remio] Notion vs Obsidian — ownership shift:
  https://www.remio.ai/post/notion-ai-faces-obsidian-as-second-brain-tools-shift-toward-ownership
- [affine] Second brain apps; the maintenance-burden problem:
  https://affine.pro/blog/best-second-brain-apps
- [onlygains] Hybrid-athlete fragmentation (multiple apps, clunky strength):
  https://www.onlygains.ai/blog/detailed-comparison-of-fitness-apps/
