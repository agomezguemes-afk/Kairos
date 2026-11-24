# On-device LLM for Kairos: research report (late Nov 2026)

**Scope:** Expo SDK 54 / RN 0.81.5 (New Architecture, Hermes), iOS first. Test device: iPhone 12 Pro (A14, 6 GB, no Apple Intelligence). Spanish-speaking users. Research only; no repo files were changed.

**How to read the evidence.** Each claim is tagged:
- **[M]** measured, from a primary source (official docs, the maintainer's own benchmark tables, or a reproducible GitHub thread).
- **[V]** a vendor's own claim.
- **[A]** a forum or blog anecdote.
- **[E]** my own estimate or inference.

**Network limits during research.** This session could not reach reddit.com, huggingface.co, docs.swmansion.com, swmansion.com, deployedwork.com or drobinin.com. Reddit and Hugging Face content therefore comes only from search-engine summaries. Hugging Face file sizes are marked as estimates where I could not confirm them. GitHub, npm and developer.apple.com (via its documentation JSON) were read directly.

---

## 1. Executive recommendation

**Main point.** Build one provider-agnostic `LLMProvider` layer in TypeScript. Put three on-device back ends behind it, choose between them per task and at runtime, and keep the deterministic engine as the final fallback. The fallback order differs by task, because the iPhone 12 Pro can never use Apple's models.

### Ranked architecture: which back end runs each task

| Rank | Back end | Runs on | Used for |
|---|---|---|---|
| 1 | **Apple Foundation Models** (on-device AFM Core, ~3B, 4K context) via `@react-native-ai/apple` | iPhone 15 Pro and later with Apple Intelligence on, iOS 26+. Spanish is supported. | (a) goal → JSON with guided generation; (c) short coach text in Spanish; (b) tool agent only with a reduced tool subset (≤4–5 tools per turn, because of the 4K window). No download, no RAM cost to the app, free. |
| 2 | **llama.rn** (llama.cpp + Metal) with one downloaded GGUF | Every other iPhone with Apple7+ GPU and ≥6 GB RAM, including the A14 test phone. Optionally also on AI devices, as an A/B option. | All four tasks. Default model: **Qwen3-1.7B-Instruct Q4_K_M (~1.1 GB, Apache-2.0)**, thinking off. Upgrade candidate after on-device evaluation: **Qwen3.5-2B Q4_K_M (~1.26 GB, Apache-2.0)**. For (d), on ≥8 GB devices only: **Qwen3-4B-Instruct-2507 Q4_K_M (~2.5 GB)**. |
| 3 | **Cloud** (today Groq llama-3.3-70b; on iOS 27 optionally Apple **Private Cloud Compute**) | Online, with explicit consent | (d) weekly review and long multi-turn chat. Also the escape hatch when the local model fails validation twice. |
| 4 | **Deterministic rules** (existing) | Always | Safety numbers always come from here. Also the final fallback for (a) and (b). |

**Recommended routing per task.**

| Task | Preferred order | Why |
|---|---|---|
| (a) goal → JSON | AFM (`@Generable`/schema) → llama.rn with `response_format: json_schema` (GBNF-constrained) → rules | Small, closed-schema extraction is exactly what 1–3B models with constrained decoding do well. Validate with valibot (already a dependency). |
| (b) block-editing agent | llama.rn or AFM with **routed tool subsets** → cloud → rules | The tool-schema prompt dominates latency on A14 (see §5.3). Never send all ~36 tool definitions found in `src/lib/ai/tools/*` to a small model. |
| (c) coach explanations, short chat | AFM → llama.rn → cloud → template text | Short grounded paraphrase of deterministic summaries. The risk is low because numbers come from code. |
| (d) weekly narrative | cloud/PCC (when consented) → llama.rn (foreground, user-initiated) → template | This is the most quality-sensitive task. A 1.7B model writes acceptable but generic Spanish [E]. Run it only in the foreground (see the background-GPU pitfall). |

**Why this ranking.**
- **Apple FM is free and costs no app RAM, but only part of the user base can use it.** Apple says Foundation Models needs an Apple Intelligence device, and the iPhone 12 Pro is not one ([Apple FM docs](https://developer.apple.com/documentation/foundationmodels)). The iPhone 12 Pro runs iOS 27, but without Apple Intelligence ([EveryMac](https://everymac.com/systems/by_capability/all-iphone-compatible-with-ios-27.html), [TechRadar](https://www.techradar.com/phones/ios/ios-27-and-siri-ai-compatibility-explained)). **Inference:** in Spain and Latin America, a large share of active iPhones are pre-iPhone-15-Pro [E], so a GGUF path is mandatory, not optional.
- **llama.rn is the most mature option that works with Kairos's stack today.**
  - It is the only mature runtime that installs on **Expo SDK 54 / RN 0.81** and has all three of: an Expo config plugin, JSON-schema-to-GBNF constrained output, and native tool-call parsing ([llama.rn README](https://github.com/mybigday/llama.rn)).
  - react-native-executorch's current line (0.11.x) **requires Expo SDK 55+ / RN 0.83+ and react-native-worklets ≥0.10**. Kairos has worklets 0.5.1 ([RNE README](https://github.com/software-mansion/react-native-executorch)).
  - Core AI (iOS 27) requires an **iOS 27 deployment target** through the Callstack provider ([callstackincubator/ai README](https://github.com/callstackincubator/ai)).
- **Qwen3-1.7B over the alternatives.**
  - Apache-2.0, explicitly multilingual (Spanish included), with native Hermes-style tool calls that llama.cpp's chat parser supports.
  - It fits comfortably inside the 6 GB phone's per-app memory budget.
  - Expected speed on A14 is ≈20–25 tok/s generation [E] (scaled from the measurements in §5.1).
  - Qwen3.5-2B is newer and possibly better, but it is a hybrid (Gated-DeltaNet) architecture with an **open stall bug on iOS 27.2.1** in llama.rn ([#439](https://github.com/mybigday/llama.rn/issues/439)). Evaluate it, don't default to it.
  - Gemma 4 E2B is Apache-2.0 now and strong, but its Q4_K_M GGUF is ~3.1–3.5 GB. That is too heavy for a 6 GB phone next to a React Native app (§4).

---

## 2. Runtime comparison

| Runtime | Maturity / maintenance (Nov 2026) | Expo SDK 54 fit | Structured output | Tool calling | Performance on A14 | Verdict |
|---|---|---|---|---|---|---|
| **llama.rn** (mybigday) | Very active. Last stable **0.12.9 (2026-08-04)**; `latest` npm tag is **0.13.0-rc.12 (2026-11-17)**, with llama.cpp synced to b12445 ([releases](https://github.com/mybigday/llama.rn/releases), npm registry) [M]. Used by PocketPal and by Callstack's `@react-native-ai/llama`. | Yes. Requires New Architecture since v0.10. Expo plugin with `enableEntitlements`, `entitlementsProfile`, `forceCxx20`, `enableOpenCL`; needs `expo-build-properties`. Podspec min iOS 13. Prebuilt xcframework downloaded and SHA-256-verified at postinstall [M]. | GBNF `grammar`, and `response_format: {type:'json_schema'}` converted to GBNF [M] | `tools` + `tool_choice` through Jinja (minja) + llama.cpp `chat.cpp`. Native formats for Qwen, Llama and others; otherwise "generic" JSON fallback [M] | Metal requires an **Apple7 GPU**, which A14 has [M]. ≈39 tok/s for a 1.1B Q4_0 on A14 (§5.1) [M] | **Primary choice.** |
| **@react-native-ai/apple** (Callstack) | 0.13.0, 2026-11-11. Changelog shows heavy iOS 27 work [M] | Peer `react-native >=0.76`, `expo *`; has an Expo plugin. Needs **AI SDK v7** [M] | Yes (`Output.object`, schema refs) [M] | Yes. Streaming tool calls on iOS 26. `required`/named `toolChoice` only on iOS 27 [M] | n/a (not available on A14) | **Use for the AFM path.** Pulls in the Vercel AI SDK. Alternatives: `react-native-apple-llm` 1.0.16 (Jan 2026, less active) or a ~300-line custom Expo module in `modules/`, matching the existing `kairos-watch` pattern. |
| **@react-native-ai/llama** (Callstack) | 0.13.0. Wraps llama.rn; **peer `llama.rn >=0.13.0-rc.8`** [M] | Same as llama.rn, but forces the RC line | Via AI SDK | Via AI SDK | Same as llama.rn | Optional. Attractive if Kairos adopts the AI SDK so one API covers apple, llama and cloud. Adds an abstraction over a pre-release. |
| **react-native-executorch** (Software Mansion) | Very active. 0.11.1 latest, 0.10.7 tagged `legacy`; 0.10.0 (Sep 2026) added Core ML/MLX/Vulkan [A]/[M] | **0.11 needs Expo SDK 55+ / RN 0.83+, worklets ≥0.10, iOS 17+.** The legacy 0.10.x line needs separate verification for SDK 54 [M] | Has "schema validation" helpers. Constrained decoding not confirmed | Hammer2.1 models are tuned for tools. Tool support exists in the LLM hooks [V] | On iPhone SE 3 (A15, 4 GB) with XNNPACK CPU: Qwen3-1.7B quantized 13 tok/s, Qwen3-0.6B quantized 35, LLaMA-3.2-1B SpinQuant 17 ([benchmarks, legacy docs](https://github.com/software-mansion/react-native-executorch/blob/main/docs/versioned_docs/version-0.10.0-legacy/02-benchmarks/inference-time.md)) [M] | Strong second option **after** an Expo SDK upgrade. Fixed `.pte` model catalogue; less flexible than GGUF. Sends anonymous download telemetry unless `setTelemetryEnabled(false)` [M]. |
| **Core AI + FM session** (Apple, iOS 27) | New (WWDC26). `apple/coreai-models` export recipes, BSD-3 [M] | Through `@react-native-ai/core-ai`, which needs **Xcode 27 and an iOS 27 deployment target** [M] | Same FM API (`@Generable`) [M] | Same FM `Tool` API [M] | Unknown on A14 | Strategic future option once the app's minimum is iOS 27. Too early, and it would drop users on iOS 26. |
| **MLC LLM** (`@react-native-ai/mlc` 0.12.0) | Still published (2026-11-11), but **removed from the providers table** in Callstack's current README [M] | Questionable | JSON mode | Limited | Comparable to llama.cpp | Avoid; it looks deprioritised. |
| **LiteRT-LM** (Google) | Swift API is "Early Preview". Gemma 4 E2B reaches 56 tok/s on iPhone 17 Pro GPU [V] ([overview](https://developers.google.com/edge/litert-lm/overview)) | **No React Native binding**; it would need a custom native module [A] | Gemma function calling | Yes (Gemma 4) | Unknown on A14 | Not worth it for an iOS-first RN app now. |
| **Cactus** (`cactus-react-native` 1.13.1, Apr 2026) | YC startup. Last npm publish 7 months ago. Core Apache-2.0, RN package MIT; "Pro" NPU models are a paid tier [M] | Nitro-modules based (Kairos already has Nitro 0.37; the package's peer is ^0.33.9, so check compatibility) | Not documented in the README | Yes, through `tools` [M] | Docs label the benchmarks "CPU-only" [A] | Watch, don't adopt: slower cadence and vendor lock. |
| **ONNX Runtime GenAI** | Microsoft. Strong on Windows; no maintained RN binding found | No | Constrained decoding exists upstream | Limited | n/a | Skip. |

---

## 3. Candidate models

GGUF sizes are Q4_K_M unless noted. "RAM" means model weights plus a 4K-token KV cache plus Metal buffers, *added on top of the app* [E]. Without the increased-memory entitlement, treat roughly **2.5–3 GB as the safe per-app ceiling on a 6 GB iPhone** [E/A]. Apple does not publish jetsam limits; one source measured 2,099 MB on an iPhone 13 (4 GB) ([Lapis](https://lapis.lvrpiz.com/en/blog/how-much-ram-for-local-llm)) [A].

| Model | Params | Q4 size | Added RAM [E] | Spanish | JSON / tool reliability | Licence | Notes |
|---|---|---|---|---|---|---|---|
| **Qwen3-1.7B (instruct, hybrid thinking)** | 1.7B | ~1.0–1.1 GB [E] | ~1.4–1.7 GB | Good for its size. Qwen3 trained on 119 languages [V] | Native Hermes tool format, supported by llama.cpp. Thinking must be disabled (`enable_thinking: false`; **llama.rn defaults it to `true`** [M] in `src/index.ts`) | **Apache-2.0** | **Default.** Dense transformer, a well-trodden llama.cpp path. |
| **Qwen3.5-2B** | 1.88B | **1.26 GB** ([SDAD benchmark](https://blog.sdad.pro/blog/iphone-se-local-llm-benchmark-lfm2-vs-qwen)) [A] | ~1.6–1.9 GB | 201 languages claimed [V] | Tool use claimed [V]. No independent small-model BFCL score found | Apache-2.0 ([release coverage](https://artificialanalysis.ai/articles/qwen3-5-small-models)) [V] | Hybrid linear attention. **Stall on iOS 27.2.1 / A19** ([#439](https://github.com/mybigday/llama.rn/issues/439)). An iPhone SE 2 (3 GB) measured 0.3 tok/s, likely memory thrash [A]. Evaluate before adopting. |
| **Qwen3-4B-Instruct-2507** | 4B | ~2.4–2.5 GB [E/A] | ~3.0 GB | Very good | Best tool-calling reliability in this list [E] | Apache-2.0 | Too heavy for A14 with 6 GB (≈9–12 tok/s, ≈60–80 tok/s prefill [E]). Use only on ≥8 GB devices, for (d). |
| **Llama 3.2 3B Instruct** | 3.2B | ~2.0 GB [E] | ~2.5 GB | Spanish is one of the 8 officially supported languages | Decent tools via the Llama 3.x JSON format. ExecuTorch shows 3B as heavy (7.3 GB unquantised RAM on iPhone 17 Pro; 3.8 GB SpinQuant) [M] | Llama 3.2 Community Licence (700M-MAU cap, "Built with Llama" attribution, AUP) | Older, superseded by Qwen3/3.5 for multilingual use [E]. |
| **Llama 3.2 1B** | 1.2B | ~0.8 GB | ~1.1 GB | Weak | **Poor tools**: BFCL v4 ≈10.8 ([Medium summary](https://medium.com/@minhle_0210/5-tiny-language-models-for-tool-calling-part-3-ebcda32c2518)) [A] | Llama licence | Only for (a) with a grammar. |
| **Gemma 4 E2B-it** | ~2B effective (~5B with per-layer embeddings) | **3.1–3.5 GB** ([unsloth](https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF), [modelfit](https://modelfit.io/quant-compare/gemma4-e2b/)) [A] | ~3.5–4.4 GB | Strong (35+ languages supported, 140 pre-trained) [V] | Native function calling [V] | **Apache-2.0** (licence change with Gemma 4, Apr 2026) ([HF card](https://huggingface.co/google/gemma-4-E2B-it)) | Too big for a 6 GB phone via llama.cpp. llama.rn #398 reproduced jetsam kills with it on an 8 GB iPhone when reloading. Revisit through LiteRT-LM or ExecuTorch, where it runs at 2.58 GB [V]. |
| **Gemma 3n E2B / Gemma 3 1B** | — | ~2.8 GB / ~0.8 GB | — | 3n: good. 3-1B: weak [E] | OK | **Gemma Terms of Use** (prohibited-use flow-down) | Superseded by Gemma 4 (Apache). |
| **LFM2.5-1.2B-Instruct** (Liquid) | 1.2B | **~0.73 GB** [A] | ~1.0 GB | Multilingual including Spanish [V] | Liquid tunes for tool use [V] | **LFM Open Licence v1.0: commercial use not licensed for entities with ≥$10M annual revenue** ([ScanCode](https://scancode-licensedb.aboutcode.org/lfm-open-1.0.yml)) | Very fast hybrid-conv model. ExecuTorch on iPhone SE 3: 24 tok/s [M]. Licence acceptable for Kairos today; note the threshold. |
| **SmolLM3-3B** (HF) | 3B | ~1.8 GB [E] | ~2.3 GB | Spanish is one of 6 supported languages | Tool calling supported [V] | Apache-2.0 | Fully open data. Quality comparable to Qwen3-1.7B–4B [E]. |
| **Phi-4-mini** | 3.8B | ~2.4 GB [E] | ~3 GB | Moderate | Function calling [V] | MIT | ExecuTorch shows 3–7 tok/s even on flagship phones [M]. Too slow on A14. |
| Apple AFM Core (reference) | ~3B, 2-bit QAT | 0 (system) | 0 for the app | Spanish supported; check `supportsLocale()` [M] | Guided generation **guarantees** schema-valid output and valid tool names/arguments [M] | Free; Apple terms | 4K context (Apple says "4–8K" for AFM Core and 8K for "AFM Core Advanced" 20B on newer devices) ([Apple](https://developer.apple.com/documentation/foundationmodels/detecting-available-apple-foundation-models)) [M] |

**Spanish quality evidence.** It is thin. La Leaderboard (ACL 2025) found a strong size-performance correlation in the 1–2B range, and found that quantised larger models beat smaller full-precision ones at equal memory ([arXiv 2507.00999](https://arxiv.org/abs/2507.00999)) [M]. It predates Qwen3.5 and Gemma 4. **Build your own Spanish evaluation set (§4, step 4); there is no reliable public ranking for 1–4B Spanish tool use.**

---

## 4. Implementation steps, in order

1. **Abstraction first (no new native code).**
   - Define `LLMProvider { capabilities; generateObject(schema); streamText(onToken, signal); runTools(tools, onToolCall, signal) }`.
   - Port `src/lib/ai/client.ts` (Groq, XHR-based SSE) into `GroqProvider`.
   - Add a `Router` that picks a provider per task from: availability, consent, battery and thermal state, model downloaded or not, and network.
   - Decide whether to adopt Vercel AI SDK v7 as that abstraction. Callstack's apple and llama providers plug into it.
     - The cost: fetch-streaming polyfills on Hermes (`expo/fetch` streams), and the AI SDK's own churn: v5 → v6 → v7 within a year, per the Callstack compatibility table [M].
     - A thin in-house interface is safer.
2. **Apple FM path.**
   - Add `@react-native-ai/apple` with an availability gate: `getModelInfo({ locale: 'es-ES' })` must report available, `supportsLocale` true, and iOS ≥26.
   - Write instructions in Spanish, starting with Apple's recommended English locale phrase ([Apple languages article](https://developer.apple.com/documentation/foundationmodels/supporting-languages-and-locales-with-foundation-models)).
   - Handle these errors:
     - `exceededContextWindowSize` / `contextSizeExceeded`
     - `RATE_LIMITED`, which happens **only in the background** for quota, and also for concurrent requests on one session ([Callstack PR #262](https://github.com/callstackincubator/ai/pull/262))
     - `unsupportedLanguageOrLocale`
     - guardrail `content-filter` (false positives are common on health topics [A])
   - Use `prepare()` to prewarm when the coach screen mounts.
3. **llama.rn path.**
   - Install `llama.rn` and add its Expo plugin.
   - **Choose a version consciously:**
     - 0.12.9 stable **leaks Metal memory on `releaseContext`**, which causes jetsam on reload ([#398](https://github.com/mybigday/llama.rn/issues/398)). The fix is in 0.13.0-rc.3+.
     - 0.13.0-rc.12 had one report of a ~3 GB spike at init ([#439](https://github.com/mybigday/llama.rn/issues/439)).
     - **Pin an exact version** (no caret), and run a load/unload soak test on the A14 before shipping.
   - Context settings: `n_ctx` 4096, `n_gpu_layers: 99`, `flash_attn_type: 'auto'`, `cache_type_k/v: 'q8_0'` (halves KV memory), `use_mlock: false` on iOS [E].
   - Per call: `enable_thinking: false`, `response_format: {type:'json_schema', json_schema:{schema}}` for (a), and `tools` + `tool_choice:'auto'` for (b).
   - **Entitlements.** The plugin adds `increased-memory-limit` and `extended-virtual-addressing` by default [M].
     - Kairos's config comments say it currently signs with a free Personal Team. These are managed capabilities and will likely require the paid program [E]; verify.
     - Read `os_proc_available_memory()` (exposing it needs a tiny native call) before loading, and refuse to load if less than model size × 1.4 is available [E].
4. **Evaluation harness (before shipping any model).**
   - Write 150–300 Spanish test cases covering:
     - (a) goals, including slang and Latin American variants
     - (b) multi-step block edits, with expected tool-call traces
     - (c, d) summaries, scored with an LLM judge (Groq/Claude) plus rule checks: no invented numbers (every number in the output must appear in the input summary), correct language, and length.
   - Run the cases as Vitest (already present) against the Groq provider in CI. Run the on-device providers with a debug screen that exports JSONL.
   - Apple also ships an Evaluations framework for FM prompts [M].
   - **Track:** schema-valid rate, tool-name and argument validity, task success rate, TTFT, tok/s, peak memory.
5. **Model distribution.**
   - Do **not** bundle the model. The 4 GB uncompressed app limit would technically allow it, but it bloats every install and update ([Apple max build sizes](https://developer.apple.com/help/app-store-connect/reference/app-uploads/maximum-build-file-sizes)) [M].
   - **Options:**
     - **Self-hosted CDN** (Cloudflare R2 or S3, not huggingface.co in production: HF has rate limits and gives you no SLA [E]). Download with `@kesha-antonov/react-native-background-downloader` 5.1.0 (Nov 2026), which uses NSURLSession background transfers and resumes; or with `expo-file-system/legacy` `createDownloadResumable` for foreground-only.
     - **Apple-Hosted Background Assets** (iOS 26+): 200 GB and 200 packs per app, updated without an app release, downloaded by the system even when the app isn't running ([Apple BA docs](https://developer.apple.com/documentation/backgroundassets/downloading-apple-hosted-asset-packs), [size limits](https://developer.apple.com/help/app-store-connect/reference/apple-hosted-asset-pack-size-limits)) [M]. It needs a Background Download extension target and an App Group. `@bacons/apple-targets` is already in the repo, but support for that extension type is unverified. It is the most "Apple-native" option, but it only covers iOS 26+.
   - **Rules regardless of option:**
     - Verify SHA-256 after download.
     - Store under `Library/Application Support/models/` with `NSURLIsExcludedFromBackupKey`, not `Caches`, which iOS purges.
     - Check free disk space against model size × 2 first.
     - Ask before downloading on cellular (≈1.1 GB). Respect Low Data Mode (`NWPath.isConstrained`).
     - Keep a model manifest (id, version, sha256, size, minRAM, licence) served remotely, so models can be swapped without an app release.
6. **Runtime policies.**
   - **Warm-up:** load lazily when the user opens the AI Lab or chat. Keep the model loaded while in the foreground.
   - **Unloading:**
     - On `didReceiveMemoryWarning` or when the app goes to background, release the context.
     - Given #398, prefer the fixed version, or avoid frequent unload/reload cycles.
   - **Cancellation:** wire `AbortSignal` to `context.stopCompletion()`, or `request.stop()` in parallel mode [M].
   - **Never submit GPU work in the background.**
     - iOS rejects Metal command buffers from backgrounded apps.
     - ggml used to abort the process. llama.cpp PR #20306 makes it a recoverable error ([summary](https://github.com/ggml-org/whisper.cpp/issues/3531)) [A/M].
     - Stop generation on the `AppState` `background` event.
     - This means the **overnight `expo-background-task` must not run the LLM**. Have it pre-compute deterministic summaries, and generate the narrative next time the app is in the foreground.
   - **Thermal:** read `ProcessInfo.thermalState` through a small module. At `.serious`, route to cloud or rules. Cap `n_predict`.
7. **Streaming into the RN UI.**
   - llama.rn token callbacks arrive over JSI on the JS thread.
   - Batch tokens (flush every ~50 ms or every N tokens) into Zustand or `useState`, rather than calling `setState` per token.
   - Keep Reanimated animations on the UI thread, which Reanimated 4 does already.
8. **Privacy and consent update** (§7), then a TestFlight soak across an A14 6 GB, an A15 4 GB (worst case) and an iPhone 15 Pro (AFM).
9. Later: an optional Qwen3-4B tier for ≥8 GB devices; PCC on iOS 27; Core AI or ExecuTorch once the Expo SDK and minimum iOS move up.

### Known pitfalls (consolidated)

- llama.rn `enable_thinking` defaults to **true**. Qwen3 will then spend hundreds of tokens in `<think>` unless you disable it [M].
- Grammar-constrained decoding guarantees *syntax*, not *semantics*. Still validate with valibot, then repair-retry once, then fall back. Deeply nested or large `anyOf` schemas slow sampling noticeably in llama.cpp [A/E]. Keep schemas flat.
- **Tool-schema prompt bloat.** Kairos defines roughly 36 tool entries across `blockTools`, `contentTools` and `exerciseTools`. Even 10 tools can cost 1.5–2.5K tokens. Route the intent first (rules or a tiny classification prompt), then expose 3–6 tools.
- **AFM 4K window** includes instructions, tool schemas, the transcript and output ([Apple](https://developer.apple.com/documentation/foundationmodels/managing-the-context-window)) [M]. Use one session per task, not one long chat.
- **AFM model drift.** Apple ships three model versions (26.0–26.3, 26.4, 27.0) and you cannot choose which one runs ([SystemLanguageModel docs](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel)) [M]. Rerun the evaluation suite on every iOS release.
- Metal does not run in the iOS Simulator [M], so all LLM testing is on device. Web preview gets the cloud or rules provider only.
- An Android build would need `arm64-v8a` (OpenCL only on Adreno) [M]. Out of scope for iOS-first.
- `@react-native-ai/llama` forces llama.rn RC versions [M].
- react-native-executorch 0.11 is incompatible with SDK 54 and worklets 0.5.1 [M].

---

## 5. Measured numbers, with sources

### 5.1 llama.cpp on iPhones

TinyLlama 1.1B, llama.swiftui, Metal ([ggml-org/llama.cpp #4508](https://github.com/ggml-org/llama.cpp/discussions/4508)) [M]. Most runs used the Dec-2023 commit `0e18b2e`; newer builds are generally faster.

| Chip (device) | Q4_0 prefill pp512 (tok/s) | Q4_0 generation tg128 (tok/s) | Q8_0 generation (tok/s) |
|---|---|---|---|
| **A14 (iPhone 12 mini)** | **242** | **39.2** | 24.1 |
| A14 (iPhone 12) | 227 | 37.9 | 23.2 |
| A15 (iPhone 13 Pro) | 496 | 39.1 | 23.8 |
| A16 (iPhone 14 Pro) | 506 | 54.2 | — |
| A17 Pro (iPhone 15 Pro) | 646 | 56.9 | 35.6 |
| A18 Pro (iPhone 16 Pro) | 648 | 69.8 | — |
| A19 Pro (iPhone Air, Nov 2025 build) | 1811 | 87.3 | — |

- On A17 Pro, phi-2 2.7B Q4_0 runs at 24.7 tok/s, and Mistral 7B Q4_0 at 9.0 tok/s [M].
- **Extrapolation to A14 [E]**, which is memory-bandwidth-bound and scales roughly with model size:
  - ~1.7B Q4_K_M: ≈20–25 tok/s generation, ≈130–160 tok/s prefill.
  - ~3–4B: ≈9–13 tok/s generation, ≈60–80 tok/s prefill.

### 5.2 ExecuTorch (XNNPACK CPU)

Source: [SWM benchmark table](https://github.com/software-mansion/react-native-executorch/blob/main/docs/versioned_docs/version-0.10.0-legacy/02-benchmarks/inference-time.md) [M].

| Device | Model | tok/s |
|---|---|---|
| iPhone 17 Pro | Qwen3-1.7B quantised | 14 |
| iPhone 17 Pro | Qwen3-4B quantised | 7 |
| iPhone 17 Pro | LFM2.5-1.2B quantised | 26 |
| iPhone SE 3 (A15, 4 GB) | Qwen3-1.7B quantised | 13 |
| iPhone SE 3 (A15, 4 GB) | Qwen3-4B | N/A (RAM) |

- Memory on iPhone 17 Pro: LLaMA-3.2-1B SpinQuant 2.4 GB; 3B SpinQuant 3.8 GB [M].
- These CPU numbers are well below the llama.cpp Metal numbers for similar sizes [E]. The 0.10 release added Core ML and MLX back ends, which may close the gap; I could not find newer numbers.

### 5.3 What this means for Kairos latency on A14 [E]

- **Tool-agent turn with ~10 tools** (~2,000-token prompt) on Qwen3-1.7B: ~13–15 s prefill before the first token, plus ~3 s for a 60-token tool call.
- **Mitigations:**
  - Reuse the KV prefix: keep the static system prompt and tools identical so llama.cpp's prompt cache reuses them, or use `saveSession`/`loadSession` [M].
  - Use routed tool subsets of ~500–700 tokens.
- **Goal → JSON** (~300-token prompt, ~60 output tokens): ~2 s prefill + ~3 s generation. Acceptable with a progress affordance.

### 5.4 Apple FM

- AFM Core is ~3B parameters at 2-bit [V]; 4,096-token window per session ([Apple](https://developer.apple.com/documentation/foundationmodels/managing-the-context-window)) [M].
- On iPhone 15 Pro: ~0.6 ms per prompt token to first token and ~30 tok/s, before speculative decoding (2024 model; [Apple ML research](https://machinelearning.apple.com/research/introducing-apple-foundation-models)) [V].
- **PCC (iOS 27):** 32K context, reasoning levels, a daily per-user quota (more with iCloud+), a managed entitlement with eligibility rules, and Apple Intelligence devices only ([Apple PCC article](https://developer.apple.com/documentation/foundationmodels/adding-server-side-intelligence-with-private-cloud-compute)) [M]. Apple's WWDC26 guide says PCC is free for apps in the Small Business Program with fewer than 2M first-time downloads ([WWDC26 iOS guide](https://developer.apple.com/wwdc26/guides/ios/)) [V].

### 5.5 Thermal

On an iPhone 16 Pro, a small 4-bit LLM lost ≈41.5% of its throughput under sustained load, settling at ≈23.7 tok/s when hot ([arXiv 2603.23640](https://arxiv.org/html/2603.23640v2)) [M]. A blog reports ~10% battery for 20 iterations [A]. **Inference for Kairos:** short bursts are fine; avoid long sustained generation sessions.

### 5.6 Memory limits

- Apple says the increased-memory-limit entitlement is "only available on some device models"; query `os_proc_available_memory()` ([Apple](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.kernel.increased-memory-limit)) [M].
- One report found that on an iPhone 17 Pro Max (iOS 27.2) the entitlements changed nothing: footprint + available stayed at 8,192 MiB ([nxnative PR](https://github.com/seedds/nxnative/pull/1103)) [A].
- On an iPhone Air (12 GB), Metal's `recommendedMaxWorkingSetSize` reported 8,192 MB ([Apple forums](https://developer.apple.com/forums/thread/805161)) [A].
- **No source gives a 6 GB iPhone figure. Measure it on the 12 Pro.**

### 5.7 Store limits

- App: 4 GB uncompressed; executable `__TEXT` 500 MB [M].
- Apple-hosted asset packs: 200 GB total, 200 packs [M].
- The cellular App Store download cap became a user setting in iOS 13 ([MacRumors](https://www.macrumors.com/how-to/download-large-apps-over-cellular-iphone-ipad/)) [A]. That applies to the App Store; in-app downloads are your own policy.

---

## 6. Open risks

1. **A14 has no reliable public numbers for 1.7–2B GGUFs on current llama.cpp.** All A14 speed figures above are extrapolated. *Action:* run the llama.rn `bench()` on the 12 Pro before committing.
2. **Memory headroom on 6 GB is unpublished.** The entitlements may not help. Worst case is jetsam during model load while HealthKit, video and blur are also resident.
3. **llama.rn versioning:** a stable release with a known Metal leak versus a release candidate with a fix. Also an open iOS 27.2.1 stall affecting Qwen3.5 and MiniCPM5 ([#439](https://github.com/mybigday/llama.rn/issues/439), no maintainer response yet).
4. **Small-model Spanish tool use is unproven.** Expect a 70–90% task success rate on multi-step block edits for 1.7–2B models [E], versus about 95%+ for 70B cloud models [E]. Plan for confirm/undo UI and fallback.
5. **AFM availability is fragile.**
   - Disabled when the device language is set to an unsupported language: one report says Catalan disabled it, and switching to Spanish needed a reboot ([Apple forum](https://www.developer.apple.com/forums/thread/802022)) [A].
   - Background rate limits.
   - Guardrail false positives on body and health topics [A].
   - Silent model updates with each iOS release.
6. **Expo SDK 54 lock-in.** By Nov 2026 Expo has moved several SDKs ahead (SDK 55 removed the legacy architecture; changelogs exist up to SDK 58). ExecuTorch, Core AI and newer Callstack features increasingly assume newer SDKs and iOS.
7. **Licences:**
   - LFM's $10M revenue threshold.
   - Llama attribution and the 700M-MAU clause.
   - Gemma 3 terms; Gemma 4 is Apache.
   - Ship each model's licence text, and add attribution in Settings → Acknowledgements.
8. **Download UX:** a 1.1 GB first-run download. Some users will never download it, so the deterministic and cloud paths stay first-class.

---

## 7. Privacy and legal

- **App Store privacy label.** Apple defines "collect" as "transmitting data off the device in a way that allows you and/or your third-party partners to access it for a period longer than what is necessary to service the transmitted request in real time" ([Apple app privacy details](https://developer.apple.com/app-store/app-privacy-details/)) [M]. Data processed only by AFM or llama.rn on the device is **not collected**.
- **Groq calls send fitness, and possibly HealthKit-derived, data to a third party.**
  - They fall under the **Nov-2025 Guideline 5.1.2(i)**: clear disclosure plus *explicit permission before sharing personal data with third-party AI*. Rejections in practice ask for an in-app consent screen ([TechCrunch](https://techcrunch.com/2025/11/13/apples-new-app-review-guidelines-clamp-down-on-apps-sharing-personal-data-with-third-party-ai), [Apple forum](https://developer.apple.com/forums/thread/816140)) [A/M].
  - Kairos reads HealthKit data (sleep, HRV, resting HR), so Guideline 5.1.3's health-data rules also apply [E: verify the current wording].
- **Positioning:**
  - "Your training and health data are analysed on your iPhone" (local by default).
  - Cloud is opt-in per feature, behind a one-time explicit consent with a toggle in Settings.
  - Send only the deterministic summaries, never raw HealthKit samples.
  - Under GDPR (Spanish users), health data is special-category data (Art. 9), so on-device processing materially reduces DPIA scope and the need for processor agreements [E: get legal review]. Groq would need a DPA and a disclosure that the transfer goes to the US.
- **PCC (iOS 27)** is Apple-operated and stateless. Whether App Review treats it as "third-party AI" is untested [E]. It is still the most privacy-preserving cloud tier for AFM devices.
- **Disable ExecuTorch telemetry** if you adopt it [M].
