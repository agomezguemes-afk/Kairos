# Adaptive Training Science: Models, Metrics and Heuristics for a Sport-Agnostic Adaptation Engine

Scope: evidence base for a Kairos engine (iPhone + watchOS) that watches how the user trains, across any sport, and suggests adjustments now and then without imposing fixed routines. Research done 2026-11-08. Items marked "(unverified)" come from the researcher's background knowledge and were not confirmed against a source during this session; the report writer should treat them as hypotheses, not citations.

## 1. Universal training load models (sRPE, TRIMP, Banister/CTL-ATL-TSB, ACWR, monotony/strain): which are robust for consumer use with sparse data?

### Takeaway
Session-RPE (CR-10 rating x minutes) is the only load metric that is validated, needs no sensor and works for every modality, so it should be Kairos's universal "load currency". HR-based TRIMP and power/pace-based scores can refine it when watch data exists. Fitness-fatigue (Banister) curves and ACWR are useful as descriptive trend views, but they should not be used to predict performance or injury for an individual. ACWR in particular has been heavily criticised as a statistical artifact.

### Cited Findings
- **sRPE validity:** a review of 36 studies using the modified CR-10 found support for validity and good reliability across sports, ages and expertise levels. The authors suggest sRPE can be used as a "standing alone" load-monitoring method, though some recommend pairing it with HR. — [Haddad et al. 2017, Front Neurosci (PMC5673663)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5673663/)
- **sRPE vs HR:** a PROSPERO-registered meta-analysis of 16 studies in adolescent athletes found an overall r = 0.74 between sRPE and HR-based load (CR-10 r = 0.69; CR-100 r = 0.80). It covers adolescents only; I found no all-population pooled estimate. — [Liu et al. 2023, BMC Sports Sci Med Rehabil](https://link.springer.com/10.1186/s13102-023-00712-5)
- **Monotony and strain (Foster 1998):** monotony = mean daily load / SD of daily load, and strain = weekly load x monotony. A high share of illnesses was explained when athletes exceeded individually identifiable thresholds, mostly related to strain. The study looked at illness and overtraining rather than injury. — [Foster 1998, MSSE (as summarised in search results; record via IOC/consensus search)](https://pubmed.ncbi.nlm.nih.gov/27535989/) *(note: the PubMed link is the IOC statement; Foster 1998 is MSSE 30(7):1164-8, and its primary URL was not retrieved)*
- **IOC consensus (2016):** "How much is too much? Part 1" (Soligard et al., BJSM 50:1030-41) covers rapid load changes, congested competition calendars, psychological load and travel. It gives guidelines for prescribing load and for monitoring training load, competition load, psychological load, well-being and injury. Its framing is the balance of load against tissue capacity, with recovery as part of that balance. — [PubMed 27535989](https://pubmed.ncbi.nlm.nih.gov/27535989/); [BJSM full text](https://bjsm.bmj.com/content/50/17/1030)
- **ACWR criticism (Impellizzeri et al. 2020-21):** replacing chronic load with fixed or random values produced similar injury-risk "effects". This suggests the ratio itself manufactures the association. ACWR rescales the numerator, which inflates effect estimates without adding predictive value; the reported c-statistic was about 0.57, close to chance. The ratio also derives from an oversimplified Banister model with arbitrary time constants. The authors call for dropping the ACWR framework from injury guidance. — [PMC7534938](https://pmc.ncbi.nlm.nih.gov/articles/PMC7534938/); [PMC8138569](https://pmc.ncbi.nlm.nih.gov/articles/PMC8138569/); [Frontiers editorial on the debate](https://dx.doi.org/10.3389/fphys.2021.669687)
- **Banister fitness-fatigue model limits:** the standard model assumes linearity, independence and determinism, so it does not match the complexity of real responses. State-space / Kalman-filter variants have been proposed to handle uncertainty. — [RGU repository review](https://rgu-repository.worktribe.com/OutputFile/1871154)
- In 9 elite swimmers, model fits were good (R² = 0.79 ± 0.13), but some parameters were so highly correlated that interpreting them was "worthless". — [Hellard et al. 2006 (INSERM HAL)](https://www.hal.inserm.fr/inserm-00149782)
- Fitted parameters depend on the starting values, the fitting technique and the load metric used, and population-level "general constants" should be avoided. — [Vermeire et al. 2022, "The Fitness-Fatigue Model: What's in the Numbers?"](https://www.pubmed.gov/35320776/)
- In an in-silico study, a quasi-Newton fit recovered the true parameters about 70% of the time for the standard model, but only about 18% for the fitness-delay variant (local optima). — [Stephens Hemingway, Swinton & Ogorek 2021 (Scite author record)](https://scite.ai/authors/ben-ogorek-e5Aww0)
- A 2024 preprint, not confirmed as peer-reviewed, reports that the model is ill-conditioned and that the fitness/fatigue parameters are poorly identifiable under Bayesian MCMC. — [OUCI record](https://ouci.dntb.gov.ua/works/4EBvEq2l)
- **Garmin (Firstbeat) acute load:** Garmin's manuals describe acute load as a weighted sum of EPOC over the last several days, rated low/optimal/high/very high against a personal optimal range. — [Garmin Forerunner 955 manual, Training Status](https://www8.garmin.com/manuals-apac/webhelp/forerunner955/EN-SG/GUID-30B699EB-48E7-411C-ADC5-90A94CA8E4AE-1590.html)

### Inferences
- **Recommended stack for Kairos:**
  1. sRPE per session for every activity, asked with a single post-workout tap on watch or phone (CR-10, 0-10). Use the HealthKit workout duration when one exists.
  2. Where HR exists, also compute an HR-based TRIMP (e.g., Banister or Edwards zone-TRIMP, unverified) and use it to cross-check sRPE. A large divergence is itself a signal (e.g., high RPE at low HR may indicate fatigue or illness).
  3. Sport-specific external load where available: tonnage / hard sets for strength, distance x intensity for running, kJ or TSS-like scores for cycling with a power meter.
- **Exponentially weighted moving averages of daily load** (TrainingPeaks-style CTL about 42-day and ATL about 7-day time constants, TSB = CTL - ATL; unverified constants) are a clean, explainable *descriptive* visual ("your recent load vs your usual load"). Present them as trends, not as predictions of form or injury risk.
- **ACWR:** do not show "injury risk" percentages or red zones derived from ACWR. A safer framing is "this week is X% above your 4-week average", with a soft heuristic flag for large week-over-week spikes. Even the IOC frames rapid load changes as a risk factor without endorsing a specific ratio threshold.
- **Monotony/strain** are cheap to compute and well suited to detecting "every day is the same hard day". They need daily logs including rest days (load = 0), so the app must record rest days as zero load rather than as missing data.
- **Sparse-data robustness:** sRPE degrades gracefully: one data point per session, no sensor. EWMA models assume complete logging, so missing sessions (trained without logging) bias the curves downward. Kairos should import all HealthKit workouts automatically, including those from other apps, to reduce this.

### Gaps
- No primary-source URL was retrieved for Foster 1998 (MSSE) or Foster 2001 (sRPE method), for Banister's TRIMP formulas, or for TrainingPeaks' official PMC documentation (CTL/ATL constants). The report writer should cite those as standard references, or verify them first.
- Wang et al. (2020) on ACWR was not retrieved.
- No validation of sRPE specifically for mobility/yoga or for very low-intensity sessions was found.

## 2. Autoregulation in strength training: RPE/RIR, VBT, e1RM, double progression, auto-adjusting volume

### Takeaway
Autoregulation (RPE/RIR or velocity-based) gives strength gains *at least equal to* fixed percentage programming, and possibly slightly better. That makes it a safe default for an app that cannot prescribe from a tested 1RM. RIR estimates are biased (people under-predict their remaining reps by about 1) and become more accurate near failure and at low rep counts. e1RM equations are fine for trending but lose accuracy above about 10 reps.

### Cited Findings
- **Larger meta-analysis (15 studies):** autoregulated and standardized load prescription produced similar strength gains, and RPE-based and velocity-based methods performed about the same. Velocity-loss thresholds of 25% or less beat thresholds above 25% for strength only when extra exercises were added. — [Sports Medicine - Open 2021, doi 10.1186/s40798-021-00404-9](https://link.springer.com/content/pdf/10.1186/s40798-021-00404-9.pdf)
- **Smaller meta-analysis (8 studies, 166 athletes):** autoregulation beat fixed loading for maximal strength (ES 0.64), with APRE showing the largest effect (0.78). The sample is small and the estimates imprecise. — [Zhang et al. 2021, Front Physiol](https://www.frontiersin.org/articles/10.3389/fphys.2021.651112/full)
- **RIR accuracy:** across 12 studies (414 participants), lifters under-predicted reps to failure by about 0.95 reps (95% CI 0.17-1.73), with I² of about 98%. Accuracy improved closer to failure, with heavier loads (fewer than 12 reps) and in later sets. The authors say the accuracy needed for RIR to work has not been established. — [Halperin et al. 2021 preprint (SportRxiv)](https://sportrxiv.org/index.php/server/preprint/view/67); [Stronger By Science on RIR](https://www.strongerbyscience.com/reps-in-reserve)
- More reps per set predicted RIR inaccuracy at called RPEs 5 and 7; training age did not. — [Zourdos et al. 2021, JSCR (PubMed 30747900)](https://pubmed.ncbi.nlm.nih.gov/30747900/)
- Accuracy improved near failure, but lifters were still inaccurate even at 1 RIR. — [Front Psychol 2020](https://frontiersin.org/articles/10.3389/fpsyg.2020.565416/full)
- **e1RM equations:** classical equations (Epley, Brzycki, Lander, etc.) correlate at r > 0.90 with measured 1RM, which hides meaningful absolute errors. Accuracy degrades above about 10 reps and is worse for deadlift and lower-body lifts than for bench press. Epley's equation came from a poundage chart rather than a peer-reviewed study. — [arXiv 2603.17495 literature review (2026)](https://arxiv.org/pdf/2603.17495v1.pdf)
- The best-performing equation varied by exercise, and all equations overestimated leg-press 1RM. — [RBAFS study](https://rbafs.org.br/RBAFS/article/download/2400/pdf47/3542)

### Inferences
- **Default strength logic for Kairos (deterministic):**
  - Per exercise, per user, track e1RM from the best set with reps ≤ 10 (Epley or Brzycki; when RPE/RIR is logged, an RPE-adjusted e1RM that adds RIR to the reps). Smooth it (e.g., rolling max or EWMA) and use it only as a *trend*, never as a prescription anchor for high-rep or machine work.
  - **Double progression** works with no 1RM and no RPE: keep the weight until all sets reach the top of the rep range, then add the smallest increment. Its inputs are just weight and reps, which makes it ideal for cold start (unverified as an "evidence-based" method, but standard practitioner practice).
  - **RIR-based load adjustment:** if the logged RIR is below target, keep or reduce the load next session; if it is above target by 2 or more, increase. Because users under-predict their RIR, slightly discount stated RIR on high-rep sets.
  - **Volume autoregulation:** count weekly hard sets (RIR ≤ 3) per muscle group or movement as the volume metric. Suggest changes of ±1-2 sets, not big jumps.
- VBT needs bar-velocity hardware or camera tracking. Apple Watch wrist acceleration is not established as valid for bar velocity (no source found), so treat VBT as an optional integration rather than a core feature.
- Since autoregulated ≈ fixed for outcomes, the selling point of autoregulation in Kairos is user freedom and fit with irregular schedules, not superior gains. The marketing copy should avoid overclaiming.

### Gaps
- No source retrieved on Apple Watch / IMU validity for bar velocity or rep counting.
- No meta-analysis retrieved specifically on double progression or on auto-adjusted volume (e.g., Stronger By Science / Helms set-volume autoregulation).
- Helms et al.'s RIR-based RPE scale (2016) was not retrieved as a primary source.

## 3. Endurance adaptation: HR zones, pace/power progression, polarized vs threshold, how commercial apps adapt plans

### Takeaway
Intensity distribution matters less than total consistency and volume. Polarized training shows a modest edge for VO2peak but no clear superiority on other performance measures in the 2024 meta-analysis. Commercial apps (Garmin, TrainingPeaks) adapt through EWMA load, readiness composites and daily suggestions; none of these is validated as an outcome-improving system in peer-reviewed trials.

### Cited Findings
- **Rosenblat et al. 2019 (JSCR):** 3 studies in the meta-analysis showed a moderate effect favouring polarized over threshold training for time-trial performance (ES -0.66; 95% CI -1.17 to -0.15). The evidence base was small. — [PubMed 29863593](https://pubmed.ncbi.nlm.nih.gov/29863593/)
- **Oliveira, Boppre & Fonseca 2024 (Sports Med):** polarized training was superior to other intensity distributions for VO2peak, with no evidence of superiority for the other endurance-performance surrogates. — [Sports Med 2024, doi 10.1007/s40279-024-02034-z](https://link.springer.com/content/pdf/10.1007/s40279-024-02034-z.pdf)
- **Garmin Daily Suggested Workouts:** according to a third-party guide, these are generated each morning from Training Readiness, Training Status and load distribution. This is not confirmed in official Garmin documentation found here. — [the5krunner Garmin training features](https://the5krunner.com/garmin-features/training/)
- Garmin Training Readiness (0-100) reportedly combines sleep, HRV status, recovery time, acute load, stress history and Body Battery (third-party description). — [the5krunner Training Readiness](https://the5krunner.com/garmin-features/training/training-readiness)
- Garmin acute load is EPOC-weighted, with a personal optimal range. — [Garmin manual](https://www8.garmin.com/manuals-apac/webhelp/forerunner955/EN-SG/GUID-30B699EB-48E7-411C-ADC5-90A94CA8E4AE-1590.html)

### Inferences
- **Kairos endurance logic:**
  - **Personal HR zones:** derive them from observed data (max HR seen in workouts; resting HR from HealthKit; heart rate reserve / Karvonen method) rather than from age formulas. Refine thresholds when hard efforts reveal higher HR.
  - **Track intensity distribution** (time in zone 1-2 vs 3 vs 4-5) per week and nudge toward "mostly easy" (roughly 75-80% easy, the typical polarized/pyramidal pattern; unverified exact figures) only if the user's goal is endurance performance. Present this as an option, not a rule.
  - **Progression heuristics:** increase weekly volume gradually and bias toward consistency. The often-quoted "10% rule" lacks strong evidence (unverified, not sourced here); present it as a conservative heuristic, not a law.
  - **Pace/power trend at fixed HR** (aerobic decoupling or "efficiency factor" = speed / HR) works as a sport-agnostic fitness signal for running and cycling. It can be computed deterministically from HealthKit workout samples.
- Runna, TrainingPeaks and Garmin adapt *plans*. Kairos's differentiator is adapting *suggestions* around free-form training, so it should borrow their load and readiness mechanics without a rigid plan calendar.

### Gaps
- No primary source retrieved on how Runna adapts plans (its algorithm is proprietary; marketing pages were not fetched).
- TrainingPeaks' official PMC/TSS definitions were not fetched; see Gaps in section 1.
- No peer-reviewed evidence found that Garmin or other commercial adaptive plans improve outcomes compared with static plans.

## 4. Readiness/recovery signals from Apple Watch (HRV SDNN, resting HR, sleep, respiratory rate, VO2max, cardio recovery): validity and responsible use

### Takeaway
Apple Watch signals are useful for *within-person trends* but weak as absolute values. VO2max estimates under-read by about 6 mL/kg/min with about 13% MAPE and wide limits of agreement. HealthKit's historical HRV type is SDNN, not the research-standard lnRMSSD. HRV-guided training is at least as good as predefined training, with small, mostly non-significant performance benefits and possibly fewer non-responders. Use 7-day rolling baselines and individual "smallest worthwhile change" bands, never single-day verdicts.

### Cited Findings
- **Apple Watch VO2max (PLOS ONE 2025, n = 30):** the watch underestimated VO2max by a mean 6.07 mL/kg/min (95% CI 3.77-8.38), with MAPE 13.31% and MAE 6.92 mL/kg/min. Limits of agreement were wide (about -6 to +18). The authors say it needs refinement before clinical use but has practical value. — [Lambe et al. 2025, PMC12080799](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12080799/)
- A Series 7 validation (JMIR 2024, n = 19) noted a lack of out-of-lab validation; its numeric results were not retrieved. — [PMC11325102](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11325102/)
- **HealthKit HRV type:** Apple Watch records HRV in the background as SDNN (ms), stored as `heartRateVariabilitySDNN`. This comes from a third-party developer doc; no Apple primary source was retrieved. — [Training Today help doc](https://trainingtodayapp.helpscoutdocs.com/article/22-does-apple-watch-use-sdnn-or-rmssd-for-hrv)
- Blog posts dated September 2026 claim iOS 27 adds `heartRateVariabilityRMSSD` to HealthKit, alongside SDNN, which has existed since iOS 11 (2017). This is UNCONFIRMED against Apple developer docs; one source notes Apple did not mention RMSSD in its announcement. — [themomentum.ai](https://www.themomentum.ai/blog/apple-watch-series-12-ios-27-rmssd-healthkit); [blakecrosley.com](https://blakecrosley.com/ko/blog/five-second-heart-rate-healthkit)
- **HRV-guided training meta-analysis (Manresa-Rocamora 2021):** endurance performance showed SMD 0.20 (95% CI -0.09 to 0.48), small and non-significant. Vagal HRV indices improved significantly (SMD 0.50), but resting HR did not. Any superiority is "only by a small margin". — [PMC8507742](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8507742/)
- **VO2max (Granero-Gallegos 2020):** small positive effect (ES 0.402), larger in amateurs and in females. — [PMC7663087](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7663087/)
- **JSAMS 2021 (8 studies, 198 participants):** submaximal physiology improved (g = 0.296, significant), while performance (g = 0.079) and VO2peak (g = 0.171) did not. There were fewer non-responders with HRV guidance. — [PubMed 34489178](https://pubmed.ncbi.nlm.nih.gov/34489178/)
- **HRV monitoring method:** use a 7-day rolling average of lnRMSSD compared against the individual's smallest worthwhile change (SWC). Weekly averages reflected maladaptation better than single days. — [Plews thesis, AUT repository](https://openrepository.aut.ac.nz/items/d7b41d29-e92e-4acf-90ea-ed68d84d6c73/full)
- The AIS best-practice guide recommends lnRMSSD, 7-day rolling averages against the SWC, and measurement on waking. — [AIS HRV Best Practice Guide (PDF)](https://www.ais.gov.au/__data/assets/pdf_file/0013/1130260/HRV-BPG_FINAL.pdf)
- At least 3 valid HRV readings per week gave results equivalent to a full 7-day average. — [Plews et al. 2014 abstract record](https://lida.sport-iat.de/ta/Record/4033163)

### Inferences
- **Responsible readiness design:**
  - Build per-user baselines (e.g., a 30-60 day mean ± SD) for HRV (SDNN, log-transformed), resting HR, respiratory rate and sleep duration. Flag a metric only when its 7-day rolling mean leaves the user's normal band (e.g., ±0.5-1 SD, a heuristic, unverified) *and* at least 3 readings exist that week.
  - Apple's SDNN samples are taken opportunistically through the day, often during sleep, rather than as a standardised morning reading. They are noisier and not directly comparable to research lnRMSSD protocols, so rely on long-window trends only. Note: this is inferred from the third-party description, not from Apple documentation.
  - **Combine signals:** a readiness flag should require converging evidence (e.g., HRV down + resting HR up + short sleep + high recent sRPE load) before any suggestion to ease off. A single metric should never drive a recommendation.
  - **VO2max:** show it as a trend line with an error caveat (±13%). Do not compare it to population norms in alarming ways, and do not use it for zone prescription.
  - **Framing:** use suggestions ("Your recovery markers are below your usual range; consider an easier session"), never prohibitions, and make no medical claims. Illness signals (resting HR plus respiratory rate up) should prompt "consider rest", not diagnosis.
  - **Cardio recovery** (HR recovery after exercise, available in HealthKit as a metric on recent watchOS; unverified API detail) can serve as another within-person trend.

### Gaps
- No Apple primary documentation was retrieved for the HealthKit definitions of SDNN, resting HR, respiratory rate, sleep stages, VO2max or cardio recovery. Verify on developer.apple.com.
- No independent validation of Apple Watch overnight HRV (SDNN) versus ECG, or of sleep staging, was retrieved in this session.
- The iOS 27 RMSSD claim needs verification.

## 5. Detecting plateaus, overreaching and inconsistency; minimum data; cold start

### Takeaway
There is no validated consumer algorithm for detecting plateaus or overreaching. The defensible approach is individual-baseline statistics: rolling trends with a smallest-worthwhile-change or noise band, combined with converging load and recovery signals. Gate every suggestion on minimum data, and cold-start with simple rule-based progressions (double progression, sRPE trends) plus population priors that personal data then replaces.

### Cited Findings
- Individual SWC-band analysis of 7-day rolling HRV can flag a move toward maladaptation or non-functional overreaching. — [Plews thesis](https://openrepository.aut.ac.nz/items/d7b41d29-e92e-4acf-90ea-ed68d84d6c73)
- At least 3 HRV data points per week is a practical minimum for valid weekly assessment. — [Plews et al. 2014](https://lida.sport-iat.de/ta/Record/4033163)
- Strain (load x monotony) thresholds that are individually identifiable preceded illness in Foster's work. — (Foster 1998 MSSE; primary URL not retrieved; see IOC context at [BJSM](https://bjsm.bmj.com/content/50/17/1030))
- Banister-type models fitted on one athlete's short series give poorly identified parameters that depend on the fitting choices. Avoid individual forecasting with them early on. — [Vermeire et al. 2022](https://www.pubmed.gov/35320776/); [Hellard et al. 2006](https://www.hal.inserm.fr/inserm-00149782)
- State-space / Kalman-filter formulations have been proposed to update fitness-fatigue estimates under uncertainty. — [RGU repository](https://rgu-repository.worktribe.com/OutputFile/1871154)
- HRV-guided training produced fewer non-responders. — [PubMed 34489178](https://pubmed.ncbi.nlm.nih.gov/34489178/)

### Inferences
- **Plateau detector (any numeric metric):** for each user-defined metric (e1RM, pace at HR, max reps, distance, time), fit a robust trend (Theil-Sen slope or linear regression on the last N sessions, or N weeks). Call it a "plateau" when the slope's confidence interval includes 0 *and* the observed change is smaller than the user's own session-to-session noise (e.g., 0.2-0.5 x within-subject SD, borrowing the SWC concept) over at least 4-6 weeks with at least 6 data points (heuristic thresholds, unverified). This generalises across sports because it treats every metric as a time series.
- **Overreaching suspicion:** combine (a) performance trend down or RPE rising at constant output (e.g., same weight x reps but higher RPE, or same pace but higher HR), (b) load above the user's chronic baseline, (c) recovery markers below baseline. Require at least 2 of 3 over at least 1-2 weeks. Communicate it as "you may benefit from a lighter week".
- **Inconsistency detection:** weekly session count and gaps, compared with the user's own stated or implicit frequency. Treat it as an adherence problem (section 7), not a performance problem; suggest smaller and easier sessions instead of "catching up".
- **Minimum data tiers:**
  - 0-2 weeks: descriptive only (logs, totals), plus rule-based progressions.
  - 3-6 weeks: baselines and simple trend flags.
  - 6-12 weeks and beyond: plateau detection, readiness bands, personalised zones.
  - 3+ months: optional personalised fitness-fatigue / Kalman models with uncertainty shown.
- **Cold start:** (1) ask 2-3 onboarding questions (main activities, goal, typical weekly frequency) but let the user skip them. (2) Import HealthKit workout history (often months of past runs and rides), which can remove much of the cold start for endurance. (3) Use population priors (e.g., default progression increments, typical RIR targets of 1-3) that are shrunk toward personal estimates as data accrues, i.e., hierarchical/Bayesian shrinkage.
- **Sport-agnostic principle:** the engine only needs (timestamp, metric id, value, unit, direction-of-better, optional effort/RPE). Every heuristic above runs on that tuple, which satisfies Kairos's "analyse any numeric field over time" requirement.

### Gaps
- No peer-reviewed validation was found of any automated plateau-detection algorithm in consumer apps.
- The overtraining consensus (Meeusen et al. 2013 ECSS/ACSM, unverified) was not retrieved. It states there is no single diagnostic marker for overtraining, which supports the multi-signal approach.

## 6. Role of LLMs vs deterministic models; evidence on AI coaching efficacy and safety

### Takeaway
Compute everything numeric deterministically (load, trends, e1RM, zones, flags, suggested deltas) and use the LLM to explain, personalise tone, answer questions and turn the user's free-text goals into structured parameters. Current evidence shows LLM coaching raises engagement but has not shown better activity outcomes than non-LLM controls in short trials. There is no robust long-term efficacy or safety data.

### Cited Findings
- **Bloom, 4-week field trial (n = 54):** both the LLM-coaching and no-LLM conditions increased physical activity, doubling the share of participants meeting guidelines. There was no descriptive short-term activity advantage for the LLM condition, but app usage was about 5x higher. The authors suggest LLMs may matter more for mindset shifts. — [arXiv 2510.05449](https://arxiv.org/html/2510.05449v2)
- **GPTCoach (CHI 2025)** is a motivational-interviewing-based LLM coach designed with 12 health professionals and 10 potential users. It was a design study, not an efficacy trial. — [arXiv 2405.06061](https://arxiv.org/pdf/2405.06061); [Stanford HCI](https://hci.stanford.edu/publications/paper.php?id=519)
- **6-month study (n = 280)** compared human peers vs LLM "simulated exercising peers" vs control. Human and AI peers supported activity through distinct motivational pathways. Primary numbers were not verified. — [arXiv 2602.01918](https://arxiv.org/html/2602.01918v1)
- Trials registered but without results: LiveBetterSA (LLM-enhanced vs telephone coaching, non-inferiority RCT) — [ANZCTR ACTRN12625000412437p](https://anzctr.org.au/ACTRN12625000412437p.aspx); My Heart Counts personalized LLM prompts vs generic (crossover pilot, primary completion about July 2026) — [NCT06880315](https://www.syfrah.com/trial/NCT06880315)

### Inferences
- **Division of labour:**
  - *Deterministic:* data ingestion and normalisation, load calculations, baselines, trend and plateau statistics, readiness flags, progression rules, safety limits (e.g., capping suggested weekly volume or load increases), and whether a suggestion fires at all.
  - *LLM:* turning natural-language goals ("run a sub-25 5k by spring", "get stronger without the gym") into structured goal objects; explaining *why* a suggestion fired, with numbers drawn from the deterministic layer; adapting tone to user preferences; generating optional session ideas *within* constraints set by the deterministic layer; answering questions about the user's own history (retrieval over their data).
- **Safety guardrails:** the LLM never outputs numbers that the engine did not compute or validate. Responses that mention pain, chest symptoms or injury are routed to a fixed "consult a professional" response. Suggestions are always optional and dismissible, and dismissals feed back as preference data.
- **Evaluation:** given the weak efficacy evidence, Kairos should instrument its own outcomes: suggestion acceptance rate, adherence after a suggestion, and metric trends. Improving engagement alone is not the goal.
- This split also makes the system testable and auditable, and lets the mock AI (Sprint 7 plan) be replaced incrementally.

### Gaps
- No RCT evidence was found on LLM-generated *training prescriptions* (as opposed to PA motivation) or on injury/safety outcomes of AI coaching.
- No source was retrieved on LLM hallucination rates in fitness advice specifically.

## 7. Behaviour-change science for long-term adherence

### Takeaway
Long-term adherence is best predicted by autonomous and intrinsic motivation (self-determination theory: autonomy, competence, relatedness) and by context-stable, repeated behaviour that builds automaticity. Habits take about 2 months on median but vary enormously (18-254 days), and a single missed day doesn't derail them. This strongly supports Kairos's "train however you want" stance and favours non-punitive streak and consistency mechanics.

### Cited Findings
- **Teixeira et al. 2012 (66 studies):** consistent support for a positive relation between autonomous motivation and exercise. Identified regulation better predicts short-term adoption; intrinsic motivation better predicts long-term adherence. Some SDT construct relations are mixed. — [IJBNPA 9:78](https://ijbnpa.biomedcentral.com/track/pdf/10.1186/1479-5868-9-78)
- Motivation is a fundamental indicator of long-term exercise adherence. SDT-based interventions appear fundamental for maintenance, but more longitudinal research is needed. — [Rodrigues et al. 2018, Front Psychol](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2018.02141/pdf)
- **Lally et al. 2010 (n = 96):** median 66 days to automaticity among the 39 participants with good curve fits, with a range of 18-254 days. Missing one opportunity did not significantly affect habit formation, but very inconsistent performers did not form habits. Exercise behaviours were harder to make automatic. — [The Behavioral Scientist analysis](https://www.thebehavioralscientist.com/articles/how-long-to-form-a-habit)
- **2024 systematic review/meta-analysis on health-behaviour habit formation:** SMD 0.69 in habit scores pre- to post-intervention, from few studies, with exercise underrepresented. The secondary-reported timing figures (median 59-66 days, range 4-335) are unverified. — [PMC11641623](https://pmc.ncbi.nlm.nih.gov/articles/PMC11641623/)
- In the Bloom trial, LLM coaching increased engagement more than measured activity. — [arXiv 2510.05449](https://arxiv.org/html/2510.05449v2)

### Inferences
- **Autonomy:** suggestions are always optional, with an explanation and an easy dismiss or "not now". Users can set or override goals, and the AI asks before it changes anything. This matches SDT and Kairos's "User Sovereignty" principle.
- **Competence:** surface progress the user can't easily see (trend lines, PR cards, "pace at the same HR improved 4%"). Base gamification on *real* improvement detected by the engine (so it "feels earned"), not on arbitrary points.
- **Relatedness:** this points to the Sprint 8 social features; AI peers may help, but evidence is preliminary.
- **Habit design:** encourage a consistent time/context cue, and use "forgiving" streaks (e.g., weekly consistency targets or streak freezes) since a single miss doesn't break habit formation. Avoid loss-framing that punishes misses (heuristic, unverified as a direct finding).
- **Goal setting:** let users set process goals (sessions/week) alongside outcome goals (5k time, e1RM). Goal-setting theory's specific + challenging goals (Locke & Latham; unverified, not retrieved) should be tempered by the autonomy findings.
- **Intermittent suggestions:** batch insights weekly (e.g., a Sunday summary card) plus rare high-value real-time nudges. This respects "AI helpful, not intrusive" and avoids notification fatigue (no direct source retrieved on optimal frequency).

### Gaps
- No retrieved source on optimal frequency of just-in-time adaptive interventions (JITAI) or notification fatigue in fitness apps.
- No retrieved meta-analysis on gamification and long-term exercise adherence.
- Locke & Latham goal-setting theory and implementation-intentions meta-analyses (Gollwitzer & Sheeran) were not retrieved in this session.
