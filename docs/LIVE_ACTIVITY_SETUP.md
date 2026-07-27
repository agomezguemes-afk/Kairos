# Live Activity / Dynamic Island — manual setup steps

The Live Activity is the PRIMARY in-workout display (docs/INWORKOUT_GLANCE_MODE.md
§5): the phone lies face-up on the bench, locked, and IS the scoreboard. All the
code exists in the repo. The JS side is a guaranteed no-op until the native
target links, so the app keeps building/running exactly as before until you do
the steps below.

**Status check (2026-07-14):** the widget extension target does **not** exist in
`ios/Kairos.xcodeproj` yet (`grep -c WorkoutActivity ios/Kairos.xcodeproj/project.pbxproj`
→ 0) and `NSSupportsLiveActivities` is not in `ios/Kairos/Info.plist`. Until both
land, `isSupported()` returns false and every call is a silent no-op. Nothing has
ever rendered on device.

## What already exists

| Piece | Path | Status |
|---|---|---|
| Pure payload derivation (snapshot → what the lock screen shows) | `src/lib/liveActivity/payload.ts` | Done, unit-tested |
| Widget button → store (HECHO / +30 s / saltar) | `src/lib/liveActivity/widgetActions.ts` | Done, unit-tested |
| Process-lifetime action bridge (survives an unmounted screen) | `src/lib/liveActivity/widgetBridge.ts` | Done |
| Session → activity sync hook | `src/lib/liveActivity/useLiveActivitySync.ts` | Done, mounted in ActiveWorkoutScreen |
| Expo local module (iOS bridge, ActivityKit + pending-tap queue) | `modules/kairos-live-activity/ios/` | Autolinks on next `pod install` |
| Expo local module (Android ongoing notification) | `modules/kairos-live-activity/android/` | Autolinks on next android build |
| Shared `ActivityAttributes` | `modules/kairos-live-activity/ios/WorkoutActivityAttributes.swift` | Needs widget target membership too |
| Widget extension UI (Lock Screen + Island) | `targets/WorkoutActivity/WorkoutLiveActivity.swift` | **Needs the extension target** |
| App Intents (HECHO / +30 s / Saltar) | `targets/WorkoutActivity/WorkoutActivityIntents.swift` | **Needs BOTH target memberships** |

## iOS — steps (~20 min, once)

`ios/` is checked in **and currently dirty with demo artifacts**, so
`npx expo prebuild` (which would regenerate the project) is the wrong tool right
now. Do it in Xcode.

1. **Link the local module** (Expo SDK 54 autolinks `modules/`):
   ```bash
   npx pod-install
   ```

2. **Enable Live Activities in the app's Info.plist** (`ios/Kairos/Info.plist`):
   ```xml
   <key>NSSupportsLiveActivities</key>
   <true/>
   ```
   (Already declared in `app.config.ts` under `ios.infoPlist`, so a future
   `expo prebuild` writes it for you. The checked-in project needs it by hand.)

3. **Create the widget extension target** — Xcode → File → New → Target… →
   *Widget Extension*, name `WorkoutActivity`, **uncheck** "Include Configuration
   App Intent", **check** "Include Live Activity". Deployment target **16.2**.
   - Delete the template Swift files Xcode generated.
   - Add `targets/WorkoutActivity/WorkoutLiveActivity.swift` and
     `targets/WorkoutActivity/WorkoutActivityIntents.swift` to the extension.
   - Replace the extension's Info.plist content with `targets/WorkoutActivity/Info.plist`.

4. **Fix target memberships** (File Inspector → Target Membership) — this is where
   it usually goes wrong:
   - `WorkoutActivityAttributes.swift` lives in the **Pods** project, and target
     membership can't cross projects. Drag it from
     `modules/kairos-live-activity/ios/` into the extension's group in
     `Kairos.xcodeproj` with **"Copy items" OFF**, and tick **only** the
     `WorkoutActivity` target. The same source file is then compiled twice (pod +
     extension) — that is intended: ActivityKit matches the activity to the UI by
     the shape of `ContentState`, not by linkage.
   - `WorkoutActivityIntents.swift` → tick **BOTH** `Kairos` and `WorkoutActivity`.
     `LiveActivityIntent.perform()` runs in the APP process — that is precisely
     what lets a lock-screen tap reach the Zustand store without unlocking, so the
     app target must compile it.

5. **Build to the iPhone 12 Pro.** The 12 Pro has **no Dynamic Island** — the Lock
   Screen banner is the surface you'll see (and it's the one the mandate cares
   about: phone face-up, locked).
   ```bash
   xcodebuild -workspace ios/Kairos.xcworkspace -scheme Kairos \
     -configuration Release -destination 'id=00008101-00051D4C3C51003A' \
     CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=FH6BYZT9F3
   ```
   Xcode will also want a signing identity for the new `WorkoutActivity` target
   (bundle id `com.alvaro.kairos.dev.WorkoutActivity` — it must be a child of the
   app's). Automatic signing handles it; no new entitlement is required (the
   pending-tap queue deliberately uses the app's own `UserDefaults.standard`, not
   an App Group, because the intents run in the app process).

6. **Verify on device**:
   - Start a session → lock the phone → the banner shows exercise, the giant
     target ("60 kg × 6"), SERIE 2/4 and "Siguiente · …".
   - Tap **HECHO** on the lock screen → the set logs, the rest countdown starts
     and ticks **natively** (no app in front, screen still locked).
   - Tap **+30 s** / **Saltar** during rest → the countdown reacts.
   - When the rest expires with the app suspended, the banner flips by itself to
     the next set's target (via `staleDate`) — no JS ran.

## Android — steps (~5 min)

1. `npx expo prebuild -p android` (or just build — the module autolinks).
2. Android 13+: the app must hold `POST_NOTIFICATIONS`. The module's manifest
   declares it; grant it from Profile → notifications, or accept the system prompt.
3. Verify: start workout → ongoing silent notification with the exercise, set
   counter and target; during rest the chronometer counts down and the actions are
   **+30 s** / **Saltar**; while lifting the action is **HECHO**.

## Known limitations (deliberate)

- **No push-token updates**: the activity updates only while the app process is
  alive. Fine for workouts; remote updates need `pushType: .token` later.
- **A tap can outlive the JS runtime.** iOS may relaunch a killed app to run the
  intent, so the tap is queued in `UserDefaults` and flushed to JS the moment a
  listener attaches (`OnStartObserving`) — after the store hydrates. Taps older
  than 2 minutes (`MAX_WIDGET_ACTION_AGE_MS`) are discarded rather than applied,
  because silently logging a set the user pressed long ago would corrupt the log.
- **Android is an app-posted notification, not a foreground Service** — it dies
  with the process. Upgrade path: `startForeground()` +
  `FOREGROUND_SERVICE_TYPE_HEALTH`.
- **Rest-end alert while backgrounded** still depends on expo-notifications
  (`src/lib/notifications/adapter.ts`); the Live Activity countdown covers the
  visual case meanwhile.
