# Apple Design Language & Platform UX Surfaces (iPhone + Apple Watch), state as of Nov 2026

Research date: 2026-11-08. Shipped status: iOS 27 / watchOS 27 public since Sept 2026 (watchOS 27 on Sept 14, 2026); iOS 27.2 shipped Oct 26, 2026; iOS 27.3 in public beta since Nov 5, 2026. Most sources are secondary press (MacRumors, AppleInsider, Cult of Mac) plus Apple Newsroom and WWDC25 session pages. I could not load Apple's HIG pages or WWDC26 session pages directly, so exact iOS 27 API names should be checked against developer.apple.com.

## 1. Current iOS/watchOS design language (Liquid Glass, iOS 26 to iOS 27)

### Takeaway
Liquid Glass (WWDC25, shipped with iOS/watchOS 26 in Sept 2025) is still Apple's design language. It is a translucent, refractive "functional layer" for controls and navigation that floats above opaque content. iOS 27 (WWDC26, shipped Sept 2026) refines it rather than replacing it: more legible defaults, a user-facing transparency slider, a uniform scroll-edge toolbar, layered icons with refraction, and no developer opt-out on 27-SDK builds.

### Cited Findings
**Liquid Glass basics (iOS 26 / watchOS 26, shipped)**
- Apple calls Liquid Glass a translucent material that "reflects and refracts its surroundings". It uses real-time rendering with specular highlights that react to movement, takes its color from nearby content, and adapts between light and dark. Controls morph with context, for example when a control expands into more options — [Apple Newsroom, Jun 2025](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)
- It covers buttons, switches, sliders, media controls, tab bars, sidebars and toolbars. Controls "form a separate functional layer above apps and give way to content". Toolbars are redesigned to sit concentric with hardware and window corners — [Apple Newsroom](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)
- In iOS 26, tab bars shrink as the user scrolls down to put focus on content, and expand again on scroll up — [Apple Newsroom](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)
- App icons and widgets are built from several Liquid Glass layers and render in light, dark, tinted or clear looks. Icon Composer is the authoring tool — [Apple Newsroom](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)
- Two-layer model: glass is for navigation, toolbars and floating controls, and content stays on standard opaque materials. A custom opaque background on a nav or tab bar blocks Liquid Glass entirely — [secondary guide, rvsmedia](https://www.rvsmedia.co.uk/?p=11229); [STRV](https://www.strv.com/blog/how-to-apply-liquid-glass-to-your-app)
- iOS 26 tab bar details:
  - It is a floating, pill-shaped capsule.
  - The glass itself cannot be tinted. Icon and label colors can be set, but the active-tab background cannot.
  - SwiftUI `.tabBarMinimizeBehavior(.onScrollDown)` collapses it on scroll.
  - A dedicated search tab role exists.
  - Tab bar "accessories" (for example a mini player) sit above the bar and also use glass.
  - Source: [Medium UIKit guide](https://medium.com/@ios-interview/liquid-glass-in-ios-26-a-uikit-developers-guide-9aa1c91bf139); [Ryan Ashcraft critique](https://hn.jakechampion.name/reader/https://ryanashcraft.com/ios-26-tab-bar-beef)
- Accessibility pushback: iOS 26 Liquid Glass was widely criticized for readability, which led to the iOS 27 slider — [TweakTown](https://www.tweaktown.com/news/112090/apple-is-adding-a-liquid-glass-slider-in-ios-27-after-a-year-of-user-complaints-about-readability/index.html); [let's dev on usability vs accessibility](https://letsdev.de/en/blog/ios-26-in-detail-liquid-glass-ui-between-usability-and-accessibility)

**iOS 27 refinements (announced at WWDC26 on June 8, 2026; shipped Sept 2026)**
- Glass now diffuses complex content behind it more effectively, so it is more legible by default. Elements get a darkened edge for depth and separation, plus brighter specular highlights — [MacRumors, "How Liquid Glass is changing in iOS 27"](https://macrumors.com/2026/06/10/how-liquid-glass-is-changing-in-ios-27)
- A new Settings slider runs from "ultra clear to fully tinted". It is more granular than an on/off toggle. Glass still respects Reduce Transparency and Increase Contrast — [MacRumors](https://macrumors.com/2026/06/10/how-liquid-glass-is-changing-in-ios-27); Apple's change list includes "Customize Liquid Glass" and "Updated Liquid Glass" — [MacRumors 250 changes](https://www.macrumors.com/2026/06/10/apple-lists-250-changes-ios-27-and-more/)
- When content scrolls under floating bars, a uniform toolbar now appears across the top to keep text legible. Standard toolbars get this automatically, and it can be tuned with the existing scroll-edge-effect APIs — [MacRumors](https://macrumors.com/2026/06/10/how-liquid-glass-is-changing-in-ios-27)
- Icons render sharper. Icon Composer supports multiple glass layers, refraction annotations, and a preview of how the icon looks on older OS versions. App icons were redone to be more recognizable — [MacRumors](https://macrumors.com/2026/06/10/how-liquid-glass-is-changing-in-ios-27); [Cult of Mac State of the Union](https://www.cultofmac.com/news/wwdc26-platforms-state-of-the-union)
- Apps already using Liquid Glass pick up many of these improvements on iOS 27 without recompiling — [MacRumors](https://macrumors.com/2026/06/10/how-liquid-glass-is-changing-in-ios-27)
- "Apps can no longer opt out of Liquid Glass on the 27 releases", meaning the iOS 26 `UIDesignRequiresCompatibility`-style deferral goes away when building with Xcode 27 — [Cult of Mac State of the Union](https://www.cultofmac.com/news/wwdc26-platforms-state-of-the-union). A widely shared "April 2027 enforcement deadline" is not in Apple's docs and is unconfirmed — [dev.to](https://dev.to/mr_manushukla/ios-27-liquid-glass-in-xcode-27-the-migration-apple-actually-requires-2026-2bg5)
- SwiftUI in the 27 releases:
  - A new list reordering API with swipe-action support.
  - Toolbar APIs for icon priority and overflow.
  - Improved text selection.
  - Source: [Cult of Mac](https://www.cultofmac.com/news/wwdc26-platforms-state-of-the-union)
- Tab bars in iOS 27: Expo docs mention a "prominent tab" and "sidebar placement" that need iOS 27 and Xcode 27 — [Expo NativeTabs docs](https://docs.expo.dev/router/advanced/native-tabs/). A third-party guide says the search button returns to the tab bar in some system apps (unverified) — [noqta](https://noqta.tn/en/blog/apple-liquid-glass-ios-27-developer-adoption-guide-2026)
- Xcode 27:
  - Device Hub replaces Simulator. It has a sidebar for appearance, text size and gestures, which helps Dynamic Type and dark mode QA.
  - Agent support (Gemini, ACP), with Figma and GitHub plugins.
  - Source: [Cult of Mac](https://www.cultofmac.com/news/wwdc26-platforms-state-of-the-union)

### Inferences
- In 2026, "state of the art" means content-first, opaque content with chrome made of floating glass controls that collapse on scroll, concentric corners, and morphing transitions. Kairos's planned white canvas with gold accent fits this: glass carries the chrome, and the gold should go on content and primary actions, not on tinted glass bars (bar glass can't be tinted anyway).
- Since users can now set glass anywhere from clear to fully tinted, Kairos must look good across the whole range. Never rely on glass transparency to convey information.
- The uniform scroll-edge toolbar and tab-bar minimize behavior come free only with native bars. Custom JS bars will look dated next to them.

### Gaps
- I could not fetch the HIG pages (Materials, Tab bars, Toolbars, Sheets, Motion, Typography) or the WWDC26 design session pages directly. Exact iOS 27 HIG wording, sheet behavior changes, and typography changes are unverified. Background knowledge, not verified this session: iOS 26 sheets are inset glass panels that grow to full height when expanded, and SF Pro / SF Compact remain the system fonts.
- Where exactly the iOS 27 slider sits in Settings, and whether apps can read its value, is not documented in the sources found.
- I found no source describing Liquid Glass changes specific to watchOS 27.

## 2. System surfaces for a training app (widgets, Live Activities, Controls, App Intents/Siri, Spotlight, Action button, notifications, Focus)

### Takeaway
In 2026, App Intents is the backbone of every surface. It drives Siri AI's new agentic actions, Shortcuts, Spotlight, Visual Intelligence, Controls, interactive widgets and snippets. A training app should model workouts, sessions and metrics as App Entities and actions as App Intents first, then project them onto widgets, Live Activities, Controls and the Action button.

### Cited Findings
- **App Intents and Siri AI (iOS 27):** App Intents now power Siri AI's agentic actions in third-party apps. Apple asks developers to adopt entity schemas, intent schemas and view annotations so Siri can discover and operate app features — [Cult of Mac State of the Union](https://www.cultofmac.com/news/wwdc26-platforms-state-of-the-union)
- **Siri AI status:** The new Siri AI is built on Google Gemini models, with private cloud processing. It has a new Siri app on iOS 27 and started via a waitlist. It is not available in the EU "later this year". iOS 27.2 (Oct 26, 2026) added more languages. The strongest on-device AI needs an iPhone 17 Pro or iPhone Air — [MacRumors WWDC26 recap](https://www.macrumors.com/2026/06/08/wwdc-2026-recap/). Kairos's Spain/EU users may not get Siri AI agentic features yet.
- **Foundation Models (iOS 27):**
  - On-device models now accept image input.
  - "Dynamic Profiles" swap models, tools and instructions mid-session, and an Evaluations framework is included.
  - Next-gen Apple models run via Private Cloud Compute, free for developers below 2M cumulative downloads.
  - A new Core AI framework handles custom on-device models.
  - This matters for Kairos's on-device "performance advisor".
  - Source: [Cult of Mac](https://www.cultofmac.com/news/wwdc26-platforms-state-of-the-union)
- **Shortcuts (iOS 27):** natural-language shortcut creation, a redesigned editor, "Store data in Shortcuts", and screenshot and notification automations — [MacRumors 250 changes](https://www.macrumors.com/2026/06/10/apple-lists-250-changes-ios-27-and-more/); [MacRumors recap](https://www.macrumors.com/2026/06/08/wwdc-2026-recap/)
- **Interactive snippets (iOS 26):** App Intents can return interactive snippet views that confirm an action or show a result. They appear in Spotlight, Siri and Shortcuts, and stay on screen until confirmed, cancelled or dismissed. App Intents reach Shortcuts, Spotlight and Visual Intelligence — [WWDC25 "Explore new advances in App Intents" (275)](https://developer.apple.com/videos/play/wwdc2025/275); [WWDC25 "Design interactive snippets" (281)](https://developer.apple.com/videos/play/wwdc2025/281)
- **Widgets (iOS 27):**
  - iOS adds "Extra-large widgets".
  - "Real-time updates for widgets when app is open", useful for a live session.
  - Source: [MacRumors 250 changes](https://www.macrumors.com/2026/06/10/apple-lists-250-changes-ios-27-and-more/)
  - Widgets are built from Liquid Glass layers and support tinted and clear renderings since iOS 26 — [Apple Newsroom](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)
- **Live Activities / Dynamic Island (iOS 27):** "Live Activities in Dynamic Island in landscape" was added. That matters for workouts done with the phone in landscape, such as on a treadmill or bike mount — [MacRumors 250 changes](https://www.macrumors.com/2026/06/10/apple-lists-250-changes-ios-27-and-more/)
- **Controls (Control Center / Action button / Lock Screen):**
  - The Control Widget API (iOS 18, extended to watchOS 26) builds custom controls for Control Center, the Smart Stack and the Action button — [fonearena watchOS 26](https://www.fonearena.com/blog/455824/watchos-26-features.html)
  - Controls are configurable via `AppIntentControlConfiguration` — [WWDC25 "What's new in watchOS 26" (334)](https://developer.apple.com/fr/videos/play/wwdc2025/334/)
  - iOS 27 brings only minor Control Center changes (smoother scrolling) — [MacRumors 250 changes](https://www.macrumors.com/2026/06/10/apple-lists-250-changes-ios-27-and-more/)
- **Smart Stack relevance:** the watchOS 26 Smart Stack relevance API surfaces third-party widgets in context, for example a ski app near a resort. Configurable widgets use a `relevance()` function to tie configuration intents to contexts — [fonearena](https://www.fonearena.com/blog/455824/watchos-26-features.html); [WWDC25 session 334](https://developer.apple.com/fr/videos/play/wwdc2025/334/)
- **GymKit:** iOS 27 brings "GymKit on iPhone and AirPods Pro 3", so gym equipment pairing is no longer watch-only. It also adds "Faster workout start in the Workout app" — [MacRumors 250 changes](https://www.macrumors.com/2026/06/10/apple-lists-250-changes-ios-27-and-more/)
- **Spotlight:** a rebuilt search infrastructure across platforms — [MacRumors recap](https://www.macrumors.com/2026/06/08/wwdc-2026-recap/). The listed "faster shortcuts and actions indexing" is attributed to macOS 27 — [MacRumors 250 changes](https://www.macrumors.com/2026/06/10/apple-lists-250-changes-ios-27-and-more/)

### Inferences
Recommended surface map for Kairos:
1. **App Intents first.** Make these App Entities: "Training session", "Block", "Exercise", "Metric". Make these intents: "Start session", "Log set", "What's my next session?", "How did my squat progress?". This one layer then feeds Siri AI, Shortcuts, Spotlight and snippets.
2. **Live Activity + Dynamic Island** for an in-progress session, with a rest timer, current exercise, and a "log set" button via an interactive App Intent. Support the landscape Dynamic Island.
3. **Widgets:**
   - Small, medium and the new extra-large sizes, for streak/progress and "today's suggested session".
   - Lock Screen accessory widgets.
   - Use real-time updates while the app is open.
4. **Control** for "Start/resume session", which also enables the Action button binding.
5. **Watch Smart Stack widget** with relevance tied to the user's usual training times or places. This fits Kairos's adaptive, no-fixed-routine thesis well: the system surfaces the app when context suggests training.
6. **Notifications:** keep them rare and actionable, in line with "AI is helpful, not intrusive".

### Gaps
- I found no 2026 source on Focus filters, notification design changes, or Action-button API changes for iOS 27. Background knowledge, not verified this session: Focus Filters via App Intents (iOS 16+) still exist.
- Whether watchOS 27 adds new third-party Live Activity or Workout APIs was not found. AppleInsider's watchOS 27 article returned 403.
- I didn't find the exact iOS 27 API names for "entity schemas / intent schemas / view annotations". Check the WWDC26 App Intents session.

## 3. watchOS design specifics (watchOS 26 to 27)

### Takeaway
The watch is about glanceability and one-hand or no-hand interaction. watchOS 26 brought Liquid Glass controls, the wrist-flick gesture, a Workout app redesign with four corner buttons, and Workout Buddy (AI voice coaching). watchOS 27 (shipped Sept 14, 2026) adds a single-tap pinch gesture for Smart Stack, a "dynamic app grid", more proactive Smart Stack suggestions, and Workout Buddy history insights that work without an iPhone.

### Cited Findings
- **watchOS 26:**
  - Navigation buttons, in-app controls and notifications use Liquid Glass. One reviewer found the glass use "a bit sparse" on most faces — [fonearena](https://www.fonearena.com/blog/455824/watchos-26-features.html); [MacStories watchOS 26 preview](https://www.macstories.net/stories/watchos-26-the-macstories-public-beta-preview/)
  - The Workout app got its biggest redesign: four corner buttons give quick access to Race Route, Pacer and Custom Workouts. It also auto-plays music matched to the workout — [fonearena](https://www.fonearena.com/blog/455824/watchos-26-features.html); [DC Rainmaker](https://dcrainmaker.com/2025/06/apple-watchos-26-announced-workout-buddy-and-more-explained.html)
  - watchOS 26 introduced a wrist-flick gesture. Developer adoptability was not detailed in the sources found — [OWC/macsales blog](https://eshop.macsales.com/blog/97471-watchos-26-unveiled-apple-watch-gets-liquid-glass-redesign-new-wrist-flick-gesture-ai-workout-buddy/)
  - Developer additions: SwiftUI Liquid Glass APIs, the Control Widget API, the Smart Stack relevance API, and migrating ClockKit complications to WidgetKit — [fonearena](https://www.fonearena.com/blog/455824/watchos-26-features.html); [WWDC25 session 334](https://developer.apple.com/fr/videos/play/wwdc2025/334/)
- **watchOS 27 (shipped):**
  - Apple's description: "Tap your index finger and thumb together once to select a widget in the Smart Stack". This extends the 2023 Double Tap — [Appleosophy](https://appleosophy.com/2026/06/08/top-5-new-watchos-27-features-announced-today/)
  - "Dynamic app grid", "New Smart Stack suggestions", "Faster app extension launch" — [MacRumors 250 changes](https://www.macrumors.com/2026/06/10/apple-lists-250-changes-ios-27-and-more/)
  - Smart Stack: "More widgets appear in your Smart Stack when they're relevant" — [Appleosophy](https://appleosophy.com/2026/06/08/top-5-new-watchos-27-features-announced-today/)
  - Workout Buddy gives insights based on workout history, adds Spanish, and works without a paired iPhone. "Offline" claims are looser and unconfirmed — [BGR](https://www.bgr.com/2191261/watchos-27-adds-new-features-skips-old-models/); [Appleosophy](https://appleosophy.com/2026/06/08/top-5-new-watchos-27-features-announced-today/)
  - Siri AI can "brainstorm workouts" on the watch — [Wccftech](https://wccftech.com/apples-watchos-27-lets-siri-ai-brainstorm-workouts-and-read-your-mail-mid-call-while-a-new-pinch-gesture-makes-widget-selection-a-breeze/)
  - Siri AI on the watch needs a paired iPhone that supports it — [Engadget](https://www.engadget.com/2189698/everything-announced-at-apples-wwdc-2026-keynote/)
  - Fitness accuracy: more accurate step tracking, better treadmill distance, more accurate post-workout route maps, better sleep tracking — [MacRumors 250 changes](https://www.macrumors.com/2026/06/10/apple-lists-250-changes-ios-27-and-more/)
  - Compatibility: watchOS 27 drops Series 8, Ultra 1, SE 2 and older — [BGR](https://www.bgr.com/2191261/watchos-27-adds-new-features-skips-old-models/); [MacRumors recap](https://www.macrumors.com/2026/06/08/wwdc-2026-recap/)
  - Release date: Sept 14, 2026 — [iClarified](https://www.iclarified.com/102213/apple-officially-releases-watchos-27-download)

### Inferences
- **Workout screens:** follow the Workout app conventions.
  - Large monospaced metrics, one primary metric per page.
  - Digital Crown to scroll between metric pages.
  - Corner buttons for secondary actions.
  - Double Tap / single Tap mapped to the main action, such as "log set" or "next interval".
  - Haptics on set, interval and rest transitions.
- **Smart Stack is the main entry point.** A relevance-driven widget that answers "what should I train now?" fits Kairos's adaptive concept better than a fixed complication alone.
- **Competitive pressure:** Apple's own Workout Buddy now covers AI voice coaching based on history. Kairos's AI has to set itself apart through sport-agnostic, user-defined metrics and intermittent adaptation, not generic encouragement.

### Gaps
- No primary source on watchOS 27 HIG changes, such as layout changes for the dynamic app grid or whether third-party apps can claim the new tap gesture.
- Haptic pattern guidance (WKHapticType) and the current always-on/luminance rules were not re-verified for 2026.

## 4. Accessibility, Dynamic Type, dark/light mode

### Takeaway
Liquid Glass must degrade gracefully under Reduce Transparency, Increase Contrast and now the iOS 27 user transparency slider. Supporting Dynamic Type and both light and dark mode remains a baseline expectation, and Apple's 2026 tooling makes testing them easier.

### Cited Findings
- Liquid Glass adapts to Reduce Transparency and Increase Contrast, and the iOS 27 slider goes from ultra clear to fully tinted — [MacRumors](https://macrumors.com/2026/06/10/how-liquid-glass-is-changing-in-ios-27)
- Readability complaints about iOS 26 glass drove the iOS 27 changes — [TweakTown](https://www.tweaktown.com/news/112090/apple-is-adding-a-liquid-glass-slider-in-ios-27-after-a-year-of-user-complaints-about-readability/index.html); [let's dev](https://letsdev.de/en/blog/ios-26-in-detail-liquid-glass-ui-between-usability-and-accessibility)
- Liquid Glass adjusts between light and dark environments, and icons and widgets have light, dark, tinted and clear variants — [Apple Newsroom](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)
- Xcode 27 Device Hub has a sidebar for appearance and text size, for quick dark mode and Dynamic Type testing — [Cult of Mac](https://www.cultofmac.com/news/wwdc26-platforms-state-of-the-union)
- In RN, `isLiquidGlassAvailable()` can return true even when the user limited the effect in accessibility settings. Use `AccessibilityInfo.isReduceTransparencyEnabled()` — [Expo glass-effect docs](https://docs.expo.dev/versions/latest/sdk/glass-effect/)
- The 2026 ADA Inclusivity winners were Guitar Wiz and Pine Hearts, with Hearing Buddy and Structured as finalists, which shows Apple rewarding inclusive design — [Apple Newsroom ADA 2026](https://www.apple.com/au/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/)

### Inferences
- Kairos needs a real dark theme. Its current white-only identity has to become token-driven light and dark palettes, because the system chrome adapts and widgets get tinted/clear renderings regardless. Gold #C9A96E needs a contrast check on both backgrounds, and likely a darker variant for text on white.
- Use Dynamic Type scaling everywhere, `allowFontScaling` in RN. The metric-heavy watch and Live Activity layouts need to be tested at the largest sizes.

### Gaps
- I didn't fetch the HIG Accessibility page. No 2026-specific statistics on Dynamic Type adoption were found.

## 5. Apple Design Award / featured health and fitness examples (2025-2026)

### Takeaway
The 2026 ADA winners (announced June 2, 2026) include no pure fitness app. The closest are The Outsiders: Athlete Tracker (Interaction finalist), Harvee: Watch Stress Monitor (Social Impact finalist), and data-visualization winners Tide Guide and Moonlitt, which are useful references for Kairos's progress charts.

### Cited Findings
- 12 winners came from 36 finalists across six categories — [9to5Mac](https://9to5mac.com/2026/06/02/apple-reveals-apple-design-awards-app-and-game-winners-for-2026/); [Apple Newsroom](https://www.apple.com/au/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/)
- App winners:
  - Delight and Fun: grug
  - Inclusivity: Guitar Wiz
  - Innovation: NBA: Live Games & Scores (Vision Pro multi-game, floating leaderboards, 3D court)
  - Interaction: Moonlitt: Moon Phase Tracker
  - Social Impact: Primary: News in Depth
  - Visuals and Graphics: Tide Guide: Charts & Tables
  - Source: [Apple Newsroom](https://www.apple.com/au/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/)
- Fitness- and wellness-adjacent finalists: "The Outsiders: Athlete Tracker" by Gentler Stories (Interaction) and "Harvee" by Peak Labs (Social Impact). Apple's text gives no design commentary on either — [Apple Newsroom](https://www.apple.com/au/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/)
- Tide Guide was both the Visuals and Graphics winner and an Interaction finalist, so it is a strong example of chart-centric glanceable data UI — [Apple Newsroom](https://www.apple.com/au/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/)

### Inferences
- Gentler Stories (maker of Gentler Streak) is again recognized. Its approach of activity guidance based on readiness and rest, rather than fixed goals, is the closest philosophical analogue to Kairos's adaptive, no-fixed-routine thesis. Studying The Outsiders is recommended.
- The pattern Apple rewards: one strong data visualization, playful but purposeful interaction, and deep platform integration. Tide Guide and Moonlitt both lean on widgets and charts.

### Gaps
- I did not retrieve ADA 2025 winners/finalists, App Store Awards 2025, or App Store editorial "featured" health/fitness apps for 2026. Background knowledge, not verified this session: Gentler Streak was an ADA 2024 Social Impact winner.
- No detailed UX teardown of The Outsiders or Harvee was found.

## 6. What React Native/Expo can and cannot achieve for Liquid Glass and native feel (late 2026)

### Takeaway
As of late 2026, Expo can deliver native Liquid Glass on iPhone. It provides native system tab bars (NativeTabs, stable in SDK 58), the stable `@expo/ui` SwiftUI components (SDK 56), `expo-glass-effect` GlassView, and stable `expo-widgets` for widgets and Live Activities in React (SDK 56). The Apple Watch app cannot be React Native. It must be SwiftUI (via `expo-apple-targets`) or an experimental third-party renderer.

### Cited Findings
- **NativeTabs (Expo Router):**
  - Uses the real system tab bar with Liquid Glass on iOS 26+.
  - Import from `expo-router/native-tabs` in SDK 58+ and `expo-router/unstable-native-tabs` in SDK 54-57.
  - Supports SF Symbols, badges, `minimizeBehavior="onScrollDown"`, a search tab (`role="search"`), a bottom accessory (SDK 55+), and "prominent tab" plus sidebar placement (SDK 58+, iOS 27, Xcode 27).
  - Source: [Expo NativeTabs docs](https://docs.expo.dev/router/advanced/native-tabs/)
- **NativeTabs limits:**
  - No nested native tabs.
  - Tabs can't be added or removed dynamically.
  - Tab bar height can't be measured.
  - FlatList: no scroll-to-top or minimize-on-scroll.
  - All tabs mount eagerly.
  - iOS 26 white or dark flicker, fixed with ThemeProvider.
  - `backgroundColor`/`blurEffect` props only affect iOS 18 and earlier.
  - Source: [Expo NativeTabs docs](https://docs.expo.dev/router/advanced/native-tabs/)
- **SDK 56 (May 21, 2026):**
  - `@expo/ui` SwiftUI and Jetpack Compose APIs are stable, with universal components (Host, Row, Text, Button, BottomSheet). It ships in the default template and in Expo Go.
  - Expo Widgets (iOS widgets and Live Activities written in React) moved from alpha to stable.
  - RN 0.85 / React 19.2, Xcode 26.4 minimum, iOS 16.4 minimum.
  - Source: [Expo SDK 56 changelog](https://expo.dev/changelog/sdk-56); [Expo blog: Expo UI stable](https://expo.dev/blog/expo-ui-stable-sdk-56)
- `@expo/ui/swift-ui` components must be wrapped in `Host`. Liquid Glass modifiers are available on SwiftUI views — [Expo docs SwiftUI](https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/); [Expo blog: Liquid Glass app with Expo UI and SwiftUI](https://expo.dev/blog/liquid-glass-app-with-expo-ui-and-swiftui)
- **`expo-glass-effect`:**
  - `GlassView` and `GlassContainer` need iOS 26+ and fall back to a plain View elsewhere.
  - Props: `glassEffectStyle` (`clear`/`regular`/`none`, with native animate/duration), `tintColor`, `isInteractive`, `colorScheme`.
  - `GlassContainer` `spacing` controls the merge/morph distance.
  - Opacity below 1 on GlassView or its parents is not recommended, and the glass doesn't render at low opacity. The workaround is to animate a wrapper while toggling `none`.
  - Guard with `isGlassEffectAPIAvailable()`.
  - Source: [Expo glass-effect docs](https://docs.expo.dev/versions/latest/sdk/glass-effect/)
- A community guide says `expo-glass-effect` and `@expo/ui` are not reliable in Expo Go on iOS, so use a dev build. This conflicts with Expo's SDK 56 note that Expo UI is in Expo Go — [community skill](https://skillselion.com/skills/devanshudesai/agent-skills/expo-liquid-glass) vs [Expo SDK 56](https://expo.dev/changelog/sdk-56)
- **Apple Watch:**
  - `expo-apple-targets` scaffolds a SwiftUI watch target (`npx create-target watch`). React Native does not run on watchOS, and the watch app requires a paired iOS app in this setup.
  - Data sharing goes through App Groups and WatchConnectivity. Community modules such as `expo-watch-connectivity` exist, and `WCSession.isReachable` needs the RN app running.
  - Source: [expo-apple-targets watch guide (mirror)](https://www.mintlify.com/EvanBacon/expo-apple-targets/guides/watch-apps); [expo-watch-connectivity](https://github.com/ixacik/expo-watch-connectivity)
  - The experimental `@appsent-co/react-native-watchos` claims React-on-watch via a SwiftUI renderer and is pre-release — [react-native-watchos docs](https://appsent-co.github.io/react-native-watchos/)

### Inferences
**Achievable in RN/Expo:**
- Native tab bar with glass and minimize-on-scroll.
- Native sheets and toolbars, via `@expo/ui` BottomSheet or react-native-screens formSheet.
- Glass buttons and floating controls (GlassView/GlassContainer).
- SF Symbols.
- Widgets and Live Activities in React (`expo-widgets`).
- Native context menus and pickers via `@expo/ui`.

**Hard or not achievable in RN/Expo:**
- Pixel-exact morphing glass transitions between arbitrary RN views. The SwiftUI `glassEffectID`-style matched morphing is only partial via GlassContainer.
- Glass over a JS-driven custom navigator, which gives up the free iOS 27 scroll-edge behavior.
- The entire watchOS app, complications and Smart Stack widgets. These must be Swift/SwiftUI with WidgetKit.
- App Intents. These need Swift code in the app target or an extension, for example via expo-apple-targets or a local Expo module. I found no first-party Expo App Intents package.
- HealthKit workout sessions on the watch (HKWorkoutSession), which are native-only.

**Recommended architecture:** an RN/Expo iPhone app built on native primitives (NativeTabs, `@expo/ui`, expo-glass-effect, expo-widgets), plus a native Swift layer for App Intents, the watchOS SwiftUI app and its widgets/controls, all sharing data via App Group plus WatchConnectivity. Target the Expo SDK that supports Xcode 27 (SDK 58 is current per the docs), so iOS 27 tab features are available.

### Gaps
- I didn't confirm which Expo SDK first officially supports building with Xcode 27 / the iOS 27 SDK, or SDK 57/58 release dates. The docs reference v57 and v58 but I didn't fetch their changelogs.
- I found no first-party Expo solution for App Intents or Controls. Whether `expo-widgets` supports Control widgets or interactive App Intent buttons in Live Activities was not verified.
- The SDK 57 claim that "react-native-reanimated dropped as dependency" comes from one Japanese third-party article ([issoh](https://www.issoh.co.jp/md/tech/8060)) and is unverified.
