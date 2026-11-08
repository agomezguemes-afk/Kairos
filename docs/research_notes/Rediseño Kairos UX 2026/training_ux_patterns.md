# Training-App and AI-Coaching UX Patterns (2024-2026) for the Kairos Redesign

Scope: iPhone + Apple Watch-first, multi-sport, adaptive (not prescriptive) training, non-intrusive AI, no decorative gamification.
Method note: Searches ran 2026-11-08. Many vendor pages and review sites were secondary sources. Each claim below is marked with its source. Older classics are flagged **[pre-2024]**.

---

## 1. Onboarding and cold start (fast time-to-value, minimal questions, Apple Health import, goal capture)

### Takeaway
The evidence supports dropping users into the product quickly. Tutorials do not improve task success, and long quizzes work only when the payoff is a high-value artifact the user is paying for (for example, Runna's plan). For a multi-sport, no-fixed-plan app, the best cold start likely comes from importing existing history and asking questions progressively, not from a long upfront quiz.

### Cited Findings
- NN/g quantitative study (70 users, 4 apps with deck-of-cards tutorials): people who read the tutorials did no better on success rate or completion time than people who skipped them, and they *perceived tasks as harder*. Mean task time was 93.49 s with the tutorial vs 85.17 s without. Tutorials can make apps seem overly complicated. **[pre-2024 classic]** — [NN/g, Mobile tutorials](https://www.nngroup.com/articles/mobile-tutorials/)
- Runna's onboarding has about 30 screens before the user sees the plan on the home page. The quiz asks about weekly availability and even how hilly local routes are. After onboarding, it shows estimated race times with and without the app (a value-reveal moment). — [UX Collective case study of Runna](https://uxdesign.cc/how-to-nail-onboarding-a-case-study-of-runna-7780ba89c202); [ScreensDesign Runna showcase](https://screensdesign.com/showcase/runna-running-training-plans)
- The same Runna case study advises: if a product action correlates with retention, A/B test it in onboarding to check whether the link is causal. — [UX Collective](https://uxdesign.cc/how-to-nail-onboarding-a-case-study-of-runna-7780ba89c202)
- Runna's origin story: the first plans were built from user details, emailed as PDFs after a *deliberate five-minute wait* so they seemed more complex, and sold for about £80. They sold more than 1K plans. This shows that the perceived effort behind personalization carries value. — [Welltodo interview with Runna co-founders](https://www.welltodoglobal.com/post/ben-parker-and-dom-maskell-co-founders-of-runna/)
- A Runna growth job listing says the goal is to get users to their "aha moment" faster and to turn onboarding into training-plan activation. — [Runna Director of Growth Product listing](https://simplify.jobs/p/515d6569-035c-430f-8df1-4faf9868764b/Director-of-Growth-Product)
- Apple Training Load needs **28 days of workout data** before it sets a baseline. Even Apple has a cold-start gap for adaptive metrics. — [Apple Newsroom, watchOS 11](https://www.apple.com/newsroom/2024/06/watchos-11-brings-powerful-health-and-fitness-insights/) (via search results; regional mirror [UK](https://www.apple.com/uk/newsroom/2024/06/watchos-11-brings-powerful-health-and-fitness-insights/))
- GPTCoach (CHI 2025) did its onboarding as a motivational-interviewing-style conversation, and users rated "feeling supported" 4.8/5. Some users still found it "rapid fire" when several questions came at once. The authors recommend **one focused question per turn**. — [GPTCoach, Jörke et al., CHI 2025](https://arxiv.org/html/2405.06061v2)
- A practitioner rule of thumb (not research): if a new user can't complete a meaningful action within 60 seconds, simplify further. — [Design Studio UIUX blog](https://www.designstudiouiux.com/blog/mobile-app-onboarding-best-practices/)

### Inferences
- **Recommended Kairos pattern: "Import first, ask later."** (1) Request HealthKit read permission with a clear value statement. (2) Show an immediate "here is what you already do" summary built from the imported workouts: sports mix, weekly frequency, recent load. That is the aha moment. (3) Ask at most 2-3 questions: what you want (free text or goal chips), how many days are realistic, and any limits or injuries. (4) Defer everything else to in-context questions asked one at a time, GPTCoach-style.
- Kairos has no fixed plan, so Runna's long quiz isn't the right model. That quiz makes sense because it produces an artifact the user is paying for. Without HealthKit history, a "first week of logging is the calibration" framing is more honest than a fake plan. Tell the user what will improve as data accumulates, as Apple does with its 28-day Training Load baseline.
- Runna's deliberate delay suggests that showing the *work* behind personalization ("analysed 143 workouts from Apple Health") builds perceived value. Do it honestly, without artificial waits.

### Gaps
- I found no published benchmark for how many onboarding questions are optimal in fitness apps, and no retention data comparing HealthKit-import onboarding with quiz onboarding.
- I found no first-party details on how Gentler Streak, WHOOP, or Apple Fitness handle cold start for multi-sport users.

---

## 2. Logging UX (strength, cardio, team sport, free-form; prefill, steppers, voice, watch-first, auto-detection; taps-per-set)

### Takeaway
The proven strength pattern is a live-workout table with a "previous" column you can tap to copy last time's values, plus a single checkmark to complete each set. On the watch, users expect previous weights shown and haptic rest timers. Cardio should come from HealthKit or auto-detection rather than manual entry. For strength and other sports with no automatic estimate, the best low-friction universal input is a 1-10 effort rating after the session, as Apple does.

### Cited Findings
- Hevy shows a **PREVIOUS column** in a live workout (for example "45kg x 9"). Tapping a previous value copies it into the current set "instead of writing the load and reps." Users can choose whether "previous" means the last time in any workout or the last time in the same routine. — [Hevy help center](https://help.hevyapp.com/hc/en-us/articles/36011896355479-How-to-Use-Previous-Workout-Values-to-Improve-Performance-in-Hevy)
- Hevy uses checkmark buttons to mark which sets were actually done. It also has a "keep screen awake" option during workouts so users don't have to unlock the phone for every set. — [Hevy workout settings](https://www.hevyapp.com/features/workout-settings/); [Hevy track workouts](https://www.hevyapp.com/features/track-workouts/)
- Hevy's Apple Watch app syncs routines, logs sets with previous weights shown, has a rest timer with haptics, and syncs live with the phone so users can switch devices mid-workout. One reviewer rated its watch strength tracking 3.5/5. Several reviews call Strong the stronger choice for wrist-based logging. These are review and affiliate sites of mixed rigor. — [Hevy App Store listing](https://apps.apple.com/is/app/id1458862350?l=en-gb); [FindYourEdge 2026 roundup](https://www.findyouredge.app/news/best-strength-training-apps-apple-watch-2026); [Setgraph Hevy vs Strong 2026](https://setgraph.app/ai-blog/hevy-vs-strong-app-comparison-2026)
- Apple watchOS 11 added a **1-10 effort rating** after each workout. Cardio workouts get an automatic estimate. For workouts without one, such as strength, users enter it themselves, and they can edit it later. Effort feeds Training Load. — [Apple Newsroom watchOS 11](https://www.apple.com/uk/newsroom/2024/06/watchos-11-brings-powerful-health-and-fitness-insights/); [Running Magazine](https://runningmagazine.ca/?p=117368)
- Apple Watch auto-detects workout starts (running, walking, swimming, elliptical, rower) and ends (all types except "Other"). When a workout is detected late, it **retroactively credits** the activity already done. **[pre-2024, watchOS 5 era; supported-type list may have changed]** — [MacRumors](https://www.macrumors.com/how-to/use-automatic-workout-detection-watchos-5/); [AppleToolbox](https://appletoolbox.com/auto-workout-detection-apple-watch/)
- WHOOP Strength Trainer added "automatic recognition of key lifts" and smarter load tracking in 2025. A later AI update builds workouts from recent lifting history, volume trends, and the current Recovery score. — [Wareable](https://www.wareable.com/wearable-tech/whoop-summer-features-rollout-update-healthspan-advanced-labs); [Wareable, AI workout building](https://www.wareable.com/fitness-trackers/whoop-coach-ai-strength-trainer-workout-builder-update)
- WHOOP Memory (beta) lets users add personal context by **text or voice**: goals, routines, injuries, time and energy limits. — [Gadgets & Wearables](https://gadgetsandwearables.com/?p=17593849)
- Community repackagings of the Apple HIG for watchOS state a ~2-second glance target and "one key piece of information per screen." They list missing haptics for key workout events and missing auto-pause outdoors as anti-patterns. This is secondhand, so check it against developer.apple.com. — [watchOS design guidelines skill (third-party HIG summary)](https://skills.cat/skills/ehmo/platform-design-skills/watchos-design-guidelines)

### Inferences
- **Taps-per-set target (inferred, not benchmarked):** with prefill-from-last plus a checkmark, a set that repeats last time takes **1 tap**, and a set with one changed value takes about 2-3 (tap the field, step, check). Kairos should test against this target on both the watch (Digital Crown for weight and reps) and the phone.
- **Per-sport capture strategy:**
  - Strength: table + PREVIOUS + check, with Crown steppers on the watch.
  - Cardio: HealthKit or auto-detect, then a one-tap effort confirmation.
  - Team sport (football, padel): HealthKit workout + duration + effort + an optional single "how did it feel / minutes played" field.
  - Free-form: a voice or text note that the AI structures into fields, which the user confirms.
- Effort (1-10) is the universal currency. It lets Kairos compute load across *any* sport without forcing sport-specific metrics, which fits the "user decides what to track" principle.
- Apple's retroactive credit sets a precedent: Kairos should let users log *after* the fact without penalty, for example "Did you play football yesterday? HealthKit saw 74 min."

### Gaps
- I found no published, measured taps-per-set benchmarks for Hevy, Strong, or others. The figure above is a design target, not a finding.
- I found no reliable source on voice set-logging accuracy or adoption in strength apps.
- I found no documentation on how HealthKit exposes Apple's auto-detected workout events to third-party apps. One developer forum thread only pointed to the general background-delivery API: [Apple Developer Forums](https://developer.apple.com/forums/thread/657111).

---

## 3. Presenting adaptive suggestions without being prescriptive (cards, "why this?", override, confidence, cadence)

### Takeaway
Recent HCI evidence (2025-2026) shows that users resist AI that hands them a finished interpretation of their own effort. They value AI that narrates observations, keeps interpretation open, and preserves their agency. Some users still want concrete next steps when they ask for them. So the pattern is: observation, then an optional suggestion, then a user decision. Make "why" explicit and the default prompt opt-in.

### Cited Findings
- "Who Gets to Interpret the Workout?" (Shalawadi, Wester, Cox, van Berkel; arXiv 2604.23830, April 2026; listed alongside DIS) analysed 297 r/Strava threads and 5,692 comments on Strava Athlete Intelligence. It found **four tensions**: numerical evaluation vs contextual understanding; isolated session summaries vs ongoing training narratives; a fixed AI tone vs varied emotional states; a single AI voice vs different athletic types. Users pushed back when the AI "constrained interpretations of their own lived experiences." The authors call for designs that "preserve interpretive openness and user agency." — [arXiv 2604.23830](https://arxiv.org/abs/2604.23830); [KU research profile](https://researchprofiles.ku.dk/da/publications/who-gets-to-interpret-the-workout-user-tensions-with-ai-generated/)
- A secondary summary of the same paper: AI feedback should "narrate observations to support user reflection rather than present finished interpretations." — [Moonlight review](https://www.themoonlight.io/review/who-gets-to-interpret-the-workout-user-tensions-with-ai-generated-fitness-feedback)
- GPTCoach participants valued that it was "not commanding" and "met me where I was at" before prescribing. Others wanted *more* concrete plans at the end, and some wanted firmer guidance when struggling. The authors conclude: facilitate, but close with clear next steps, and offer accountability when the user asks for it. — [GPTCoach, CHI 2025](https://arxiv.org/html/2405.06061v2)
- GPTCoach scored only 3.9/5 on data use. The authors recommend bringing in wearable data proactively and explaining what it does and doesn't show, especially when progress is low, because the formative study found poor progress data can hurt motivation. — [GPTCoach](https://arxiv.org/html/2405.06061v2)
- Apple Training Load uses **qualitative bands** ("well below, below, steady, above, well above"), comparing 7 days with 28 days, rather than prescriptions. — [Apple Newsroom watchOS 11](https://www.apple.com/uk/newsroom/2024/06/watchos-11-brings-powerful-health-and-fitness-insights/)
- Gentler Streak's Activity Path (based on a TSB model, 10-day window) frames recommendations as a range to stay within, and it *encourages rest days* when needed. — [9to5Mac](https://9to5mac.com/2022/02/17/gentler-streak-apple-watch-app/) **[pre-2024]**; [Neura Gentler Streak review](https://neura.health/insight/gentler-streak-app-hands-on-review)
- WHOOP Proactive Check-Ins trigger at specific moments, such as upcoming travel or a deteriorating recovery score, rather than on a fixed schedule. — [Pulse/HealthTech](https://www.pulse.bot/healthtech/news/whoop-expands-health-platform-with-on-demand-clinician-access-and-new-ai-features-327de1b5-7dab-4c60-bc77-e371dc3feea4/) (secondary)

### Inferences
- **Suggestion card anatomy for Kairos:** (1) An observation in neutral language ("Your running volume is 40% above your 4-week average"). (2) An optional suggestion phrased as an option ("Consider an easy session or rest tomorrow"). (3) A "Why?" disclosure listing the inputs (which workouts, which metric, which window). (4) A confidence or data-sufficiency cue ("based on 3 weeks of data"). (5) Actions: Accept / Adjust / Not now / "Don't suggest this." Every dismissal is signal for the AI.
- Trigger suggestions on events (a load spike, a missed pattern, a new PR, a plateau), not on a timer. Batch the rest into a weekly review. This mirrors WHOOP's event-triggered check-ins and avoids nagging.
- Let users pick the coaching *tone and directness* (gentle or direct), and let them annotate context ("I was sick," "played on turf"). This addresses the fixed-tone and single-voice tensions directly.
- Avoid single-session verdicts ("great job!"). Frame insights within the ongoing narrative (trend over weeks). This addresses the isolated-summary tension.

### Gaps
- I found no published study quantifying the best frequency of adaptive suggestions or the effect of confidence indicators specifically in fitness apps.
- I found no first-party documentation of WHOOP's "why" UI for recommendations.

---

## 4. AI coach UX in 2026 (chat vs embedded, proactive vs on-demand, trust, generic advice, voice in-workout)

### Takeaway
The 2024-2026 launches show that generic, templated AI output destroys trust quickly (Strava and Garmin both drew public ridicule). Users value AI where it (a) uses longitudinal personal context (memory, injuries, goals), (b) spots trends that are hard to see, and (c) stays opt-out-able. Voice in-workout coaching (Apple Workout Buddy) works as motivation and recap, not as programming.

### Cited Findings
- **Strava Athlete Intelligence** (launched beta Oct 2024): viral screenshots of odd, generic comments circulated. — [Fortune](https://fortune.com/2024/10/11/strava-app-artificial-intelligence-fitness-athletic-memes). Reviewers said it mostly restated stats. — [the5krunner](https://the5krunner.com/2024/11/06/strava-ai-opinion/); [Cycling Weekly, "pointless"](https://cyclingweekly.com/news/strava-says-its-new-ai-feature-is-not-a-novelty-but-i-think-its-pointless). Users sought ways to turn it off. — [CycleChat](https://www.cyclechat.net/threads/turn-off-strava-active-intelligence.300169/latest); [Singletrack](https://singletrackworld.com/forum/topic/strava-athlete-intelligence)
- Strava took it out of beta in Feb 2025, citing that 80%+ of polled subscribers found it "very helpful" (company-reported). It promised "more accurate insights with fewer mistakes." — [Android Central](https://www.androidcentral.com/wearables/strava-announces-stable-athlete-intelligence-anti-cheating-and-flyover-sharing). This conflicts with the critical press and Reddit sentiment above.
- Strava executives acknowledged that inaccurate GPS and race-distance data affect AI comparisons. Bad data in, bad insight out. — [Android Central interview](https://www.androidcentral.com/apps-software/strava-interview-athlete-intelligence-inaccurate-gps-race-leaderboards-and-more)
- **Garmin Connect+ Active Intelligence** (paid, about $6.99/mo or $69.99/yr): TechRadar compiled complaints about basic maths errors, generic platitudes, incorrect info, and apparently canned responses. — [TechRadar](https://www.techradar.com/health-fitness/smartwatches/garmins-new-subscription-ai-feature-is-hilariously-bad-so-far). The5krunner's April 2026 review: "Still Not Worth It After a Year." — [the5krunner](https://the5krunner.com/2026/04/20/garmin-connect-plus-review/). Digital Citizen found the most value when it "spots some trends that aren't easy to identify," and more value for beginners than experienced users. Reviewers rated the Performance Dashboard higher than the AI. — [Digital Citizen](https://www.digitalcitizen.life/garmin-connect-plus-review/)
- **Apple Workout Buddy** (watchOS 26, 2025): spoken, on-device, Apple Intelligence-powered motivation during workouts. It starts automatically with the workout, needs Bluetooth headphones and a nearby Apple Intelligence-capable iPhone (sources point to iPhone 15 Pro or later, though they conflict), and launched in English only. A reviewer noted it "isn't a full-blown fitness coach that can guide your training plan." — [Heise](https://heise.de/-10475361); [DC Rainmaker](https://dcrainmaker.com/2025/06/apple-watchos-26-announced-workout-buddy-and-more-explained.html); [Tom's Guide](https://www.tomsguide.com/wellness/fitness-trackers/apple-watch-just-got-an-ai-fitness-coach-how-to-enable-workout-buddy-in-watchos-26); [Engadget](https://www.engadget.com/wearables/how-to-use-workout-buddy-with-apple-watch-and-ios-26-130000922.html)
- **WHOOP Coach** launched in 2023 on GPT-4 as on-demand chat. The CEO said then that it would "evolve to be proactive, rather than reactive." **[2023]** — [Wareable](https://www.wareable.com/wearable-tech/whoop-launches-gpt-4-ai-coach). 2025-2026 additions: **Memory** (user-editable personal context by text or voice; the coach references longer-term patterns such as average strain, VO2max, RHR, sleep consistency, and strength activity) and **Proactive Check-Ins**. — [Gadgets & Wearables](https://gadgetsandwearables.com/?p=17593849); [Pulse](https://www.pulse.bot/healthtech/news/whoop-expands-health-platform-with-on-demand-clinician-access-and-new-ai-features-327de1b5-7dab-4c60-bc77-e371dc3feea4/); [WHOOP 2025 year in review](https://www.whoop.com/thelocker/everything-whoop-launched-in-2025) (secondary sources; no primary design docs found)
- GPTCoach (CHI 2025): an LLM coach using motivational interviewing and tool calls to query and visualise wearable data. 93% of its behaviour codes were MI-consistent or neutral, and it beat vanilla GPT-4 on MI consistency. Users valued that it captured context sensors miss (emotions, injuries, daily life). Privacy concerns came up, and trust depended on transparency about what data the system can access. — [GPTCoach](https://arxiv.org/html/2405.06061v2)
- HealthGuru (CHI 2025): a multi-agent LLM combining wearable data, context, and a multi-armed bandit for sleep recommendations, evaluated in an 8-week in-the-wild deployment. A precedent for an LLM + bandit hybrid that adapts which suggestions to show. — [arXiv 2502.13920](https://arxiv.org/abs/2502.13920v2)

### Inferences
- **Embedded first, chat second.** The failures (Strava, Garmin) were auto-generated text on every activity. The successes users describe are trend-spotting and context memory. Kairos should embed short, data-cited observations in context (on the session, on the trend chart) and make chat an on-demand place to ask "why" or "plan my week."
- A **user-editable memory** (injuries, goals, constraints, preferred tone) is now table stakes (WHOOP). It is also the main defence against generic advice.
- **Grounding guard:** never let the LLM do arithmetic. Compute the numbers deterministically and have the LLM only narrate them. This addresses the Garmin maths errors directly.
- Make every AI surface opt-out-able. Strava users actively sought an off switch.
- Voice coaching mid-workout should be optional, brief, and triggered by events (set done, interval, PR). Workout Buddy covers ambient motivation, so Kairos would add more value with *contextual* audio cues, such as next set and target, than by competing on hype voice.

### Gaps
- I found no independent quantitative data on AI coach retention impact (WHOOP, Strava, Garmin).
- Workout Buddy's iPhone requirement is inconsistent across sources, and I couldn't confirm it against Apple's documentation.

---

## 5. Data visualization for progress, readiness, and load that non-experts understand

### Takeaway
Leading consumer apps translate load science (ACWR or TSB) into **qualitative bands relative to the user's own baseline** rather than raw numbers. Readiness or recovery is shown next to sleep vitals, and effort is the shared input.

### Cited Findings
- Apple Training Load compares 7-day load with a 28-day baseline and shows it as five plain-language bands (well below to well above). It is also shown in the Vitals app next to overnight HR, respiratory rate, wrist temperature, sleep, and SpO2. — [Apple Newsroom](https://www.apple.com/uk/newsroom/2024/06/watchos-11-brings-powerful-health-and-fitness-insights/)
- Gentler Streak's Activity Path uses a TSB-based 10-day window, visualised as a path or zone the user should stay within, and it uses HRV to suggest recovery or activity. — [9to5Mac](https://9to5mac.com/2022/02/17/gentler-streak-apple-watch-app/) **[pre-2024]**; [Neura review](https://neura.health/insight/gentler-streak-app-hands-on-review); [BGR, Activity Path update](https://www.bgr.com/tech/gentler-streak-improves-activity-path-tracking-offers-50-off-in-black-friday-deal)
- Garmin Connect+ Performance Dashboard (customisable charts of history) was rated by reviewers as more valuable than its AI layer. — [Digital Citizen](https://www.digitalcitizen.life/garmin-connect-plus-review/); [Pulse, Performance Dashboard](https://www.pulse.bot/fitness/news/what-is-the-garmin-connect-performance-dashboard-41f19efd-d645-47a6-a192-2b48c18765e2/)
- GPTCoach's formative work: data "lacks context" and showing poor progress can hurt motivation, so explain what the data does and doesn't show. — [GPTCoach](https://arxiv.org/html/2405.06061v2)

### Inferences
- Default views: "you vs your own baseline" bands; a sparkline trend per user-chosen metric (any numeric custom field, which fits Kairos's dynamic model); weekly load by sport as stacked bars. Hide raw ACWR or TSB numbers behind a "details" disclosure.
- Pair any negative trend with context or a reason ("fewer sessions, travel week?") to avoid demotivation.

### Gaps
- I found no 2024-2026 usability study comparing readiness-score formats (single 0-100 score vs bands vs colour). WHOOP and Oura design rationale wasn't found in primary sources.

---

## 6. Gamification evidence (what helps adherence vs feels arbitrary; streak anxiety; earned motivation)

### Takeaway
Gamification has a **small-to-medium short-term effect that decays to very small long-term**. Streaks raise engagement while intact, but **breaking a streak triggers abandonment**, and the effect depends on how the log *represents* behaviour, not on the behaviour itself. Apple and Gentler Streak have moved toward rest-aware, pausable streaks. This supports removing decorative badges and trees and keeping only feedback that reflects real effort.

### Cited Findings
- Mazeas et al. 2022 meta-analysis (JMIR; 16 RCTs, n=2,407): gamification interventions for physical activity, g = 0.42 (95% CI 0.14-0.69); +1,610 steps/day. **Long-term effect (mean 14-week follow-up) g = 0.15**, "very small to small," and "volatile over time." **[2022]** — [JMIR 2022;24(1):e26779](https://www.jmir.org/2022/1/E26779/). A published comment and critique exists: [JMIR 2022 e38212](https://jmir.org/2022/5/e38212/PDF)
- Silverman & Barasch 2023, *Journal of Consumer Research*, "On or Off Track: How (Broken) Streaks Affect Consumer Decisions" (7 studies): highlighted intact streaks increase later engagement compared with broken streaks. The effect depends on how the log *represents* past behaviour, not actual behaviour. People adopt the streak itself as a goal. The effect is stronger when people blame themselves for the break and weaker when the streak can be **repaired**. After a break, people often switch to something new rather than restart. — [UD Space, paper](https://udspace.udel.edu/items/42ce576b-8e1f-429a-8541-e29e48dbcfbb); [CU Boulder research summary](https://www.colorado.edu/business/faculty-research/2023/04/19/or-track-how-broken-streaks-affect-consumer-decisions); [CU Boulder news](https://www.colorado.edu/business/news/2023/04/20/research-streaks-marketing-tech-barasch)
- Apple watchOS 11 lets users **pause Activity Rings** for a day, week, month or more without affecting award streaks, and set ring goals per day of the week. — [Apple Newsroom](https://www.apple.com/uk/newsroom/2024/06/watchos-11-brings-powerful-health-and-fitness-insights/)
- Gentler Streak counts a true rest day as keeping the streak intact, and the app actively encourages rest when needed. Its stated position is that users don't need to close rings to meet fitness goals. — [9to5Mac](https://9to5mac.com/2022/06/30/go-gentler-streak-apple-watch-update/) **[pre-2024]**; [Gentler Streak App Store](https://apps.apple.com/us/app/id1576857102?l=en-us)
- Caution: many web pages claiming "settled science" for gamified fitness are vendor marketing (for example FitCraft) and cite unverifiable effect figures. — [FitCraft comparison page (vendor)](https://getfitcraft.com/compare/gamified-vs-non-gamified-apps)

### Inferences
- Remove: decorative badges, progress trees, and arbitrary points. Their long-term effect is minimal, and they conflict with the "earned" principle.
- Keep or replace with **earned, informational feedback**: PRs detected from real data; consistency measured at a weekly or flexible level (for example "trained 3 of your intended 3 days") with rest counted as valid; a monthly or yearly retrospective that narrates real progress.
- If any streak exists: make it weekly, rest-aware, pausable, and repairable, and never show a loss message. This follows Silverman & Barasch on repairability and Apple's pause design.

### Gaps
- I found no 2024-2026 RCT isolating streak anxiety in fitness apps specifically. The JCR evidence covers general consumer behaviour, including language learning.

---

## 7. Information architecture of leading fitness apps (tabs, today view, history, insights)

### Takeaway
The leading apps put the activity record and the user's own stats in a dedicated tab ("You"), keep record or start as a central action, and add insights or dashboards as a layer on top of history. Few verifiable 2025-2026 IA changes were found.

### Cited Findings
- Strava's 2021 redesign replaced Feed / Explore / Record / Profile / Training with **Home / Maps / Record / Groups / You**. "You" puts all activities and stats in one place. **[2021, pre-2024]** — [BikeRadar](https://bikeradar.com/news/strava-beta-test-layout); [Cycling Weekly](https://cyclingweekly.com/news/product-news/a-new-look-for-strava-app-with-updates-to-the-navigation-bar-498270)
- July 2025: Strava updated only the phone live-recording screen, not the tabs. — [the5krunner](https://the5krunner.com/2025/07/16/strava-app-redesign/)
- Apple places Training Load in both the Activity app and Vitals, so the same metric appears in more than one place depending on context. — [Apple Newsroom](https://www.apple.com/uk/newsroom/2024/06/watchos-11-brings-powerful-health-and-fitness-insights/)
- watchOS guidance (secondhand HIG summary): a maximum of about five tabs, one key piece of information per screen, and brief, actionable notifications. — [third-party HIG summary](https://skills.cat/skills/ehmo/platform-design-skills/watchos-design-guidelines)

### Inferences
- Proposed Kairos IA (3-4 tabs): **Today** (start or log CTA, today's optional suggestion card, recent HealthKit-detected sessions to confirm), **History** (timeline across all sports with filter by app or sport), **Progress** (baseline bands and trends per user-chosen metric, with AI observations embedded), **You** (goals, memory or context, settings). AI chat is reachable from anywhere (for example a long-press or a button), not a tab, so it stays non-intrusive.
- On the watch: Start (recent and suggested activities) → live session → effort rating. Nothing else is needed for an MVP.

### Gaps
- I found no verified 2025-2026 tab structures for WHOOP, Runna, Hevy, or Apple Fitness from primary sources. Mobbin and Page Flows were not accessible through search.

---

## 8. Accessibility, one-handed use mid-workout, sweaty hands, glanceability

### Takeaway
Workout-time UI must work with glances of about 2 seconds, physical controls (Digital Crown, Action Button), haptics, and audio. Water lock and auto-pause are expected on the watch. The phone must stay awake and logging must be possible without unlocking.

### Cited Findings
- watchOS: design for a ~2 s glance, one primary datum per screen; missing haptics for key workout events and missing auto-pause outdoors are anti-patterns; water lock disables the touchscreen and the Digital Crown ejects water and unlocks; the app goes inactive on wrist-down. Secondhand HIG summaries; verify with Apple. — [third-party HIG summary](https://skills.cat/skills/ehmo/platform-design-skills/watchos-design-guidelines)
- Hevy's "keep screen awake" option exists so users don't need to unlock the phone for every set. — [Hevy workout settings](https://www.hevyapp.com/features/workout-settings/)
- Hevy's watch rest timer uses haptic feedback. — [FindYourEdge](https://www.findyouredge.app/news/best-strength-training-apps-apple-watch-2026)
- Workout Buddy delivers coaching by audio through headphones, an eyes-free channel during exertion. — [Engadget](https://www.engadget.com/wearables/how-to-use-workout-buddy-with-apple-watch-and-ios-26-130000922.html)

### Inferences
- Phone workout mode: large targets in the bottom (thumb) zone; complete a set with a large check; steppers instead of keyboards; Dynamic Type support; high-contrast numerals; a Live Activity on the Lock Screen for the current set and rest timer, so logging works without opening the app.
- Watch: the Crown adjusts weight and reps; one-tap set complete; a haptic when rest ends; auto-advance to the next set.

### Gaps
- I found no published research on touch accuracy with sweaty hands or under exertion, and no figures on Live Activity usage in fitness apps. These are design inferences, not findings.
