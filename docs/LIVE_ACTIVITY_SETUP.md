# Live Activity / Dynamic Island — manual setup steps

Everything that could be written without a device build is in the repo and
wired into the app. The JS side is a guaranteed no-op until the native module
links, so the app keeps building/running exactly as before until you do this.

## What already exists

| Piece | Path | Status |
|---|---|---|
| Expo local module (iOS bridge, ActivityKit) | `modules/kairos-live-activity/ios/` | Autolinks on next `pod install` |
| Expo local module (Android ongoing notification) | `modules/kairos-live-activity/android/` | Autolinks on next android build |
| Shared `ActivityAttributes` | `modules/kairos-live-activity/ios/WorkoutActivityAttributes.swift` | Needs widget target membership too |
| Widget extension UI (Island + Lock Screen) | `targets/WorkoutActivity/WorkoutLiveActivity.swift` | Needs the extension target |
| App Intents (Complete set / +30 s) | `targets/WorkoutActivity/WorkoutActivityIntents.swift` | Needs BOTH target memberships |
| JS API + workout sync hook | `modules/kairos-live-activity/index.ts`, `src/lib/liveActivity/useLiveActivitySync.ts` | Done, mounted in ActiveWorkoutScreen |

## iOS — steps (~20 min)

1. **Link the local module** (no config needed — Expo SDK 54 autolinks `modules/`):
   ```bash
   npx pod-install   # or: npx expo prebuild -p ios (if you regenerate ios/)
   ```

2. **Enable Live Activities in the app's Info.plist** (`ios/Kairos/Info.plist`):
   ```xml
   <key>NSSupportsLiveActivities</key>
   <true/>
   ```
   (With prebuild/CNG instead: add `"infoPlist": { "NSSupportsLiveActivities": true }` under `ios` in app.json.)

3. **Create the widget extension target** — two options:

   **Option A (recommended): @bacons/apple-targets**
   ```bash
   npm i -D @bacons/apple-targets
   # app.json → "plugins": [ ..., "@bacons/apple-targets" ]
   npx expo prebuild -p ios
   ```
   The plugin reads `targets/WorkoutActivity/expo-target.config.js` and
   generates the target with the Swift sources in that folder.

   **Option B: manual Xcode**
   - Xcode → File → New → Target… → *Widget Extension*, name `WorkoutActivity`,
     UNCHECK "Include Configuration App Intent". Deployment target **16.2**.
   - Delete the template Swift files Xcode generated.
   - Add `targets/WorkoutActivity/WorkoutLiveActivity.swift` and
     `targets/WorkoutActivity/WorkoutActivityIntents.swift` to the extension.
   - Replace the extension's Info.plist content with `targets/WorkoutActivity/Info.plist`.

4. **Fix target memberships** (File Inspector → Target Membership):
   - `WorkoutActivityAttributes.swift` (lives in the pod) → ALSO add to `WorkoutActivity`.
     Simplest: drag the file from `modules/kairos-live-activity/ios/` into the
     extension group with "Copy items" OFF and tick the extension target.
   - `WorkoutActivityIntents.swift` → tick BOTH `Kairos` and `WorkoutActivity`.
     (LiveActivityIntent runs in the app process — the app target must compile it.)

5. **Build to the iPhone 12 Pro** (Dynamic Island requires 14 Pro+, but the
   Lock Screen Live Activity works on the 12 Pro):
   ```bash
   xcodebuild -workspace ios/Kairos.xcworkspace -scheme Kairos \
     -configuration Release -destination 'id=00008101-00051D4C3C51003A' \
     CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=FH6BYZT9F3
   ```

6. **Verify**: start a workout → lock the phone → Live Activity shows the
   exercise + set; complete a set in-app → rest countdown ticks without the
   app; tap "Completar serie" on the activity (iOS 17+) → the set logs.

## Android — steps (~5 min)

1. `npx expo prebuild -p android` (or just build — module autolinks).
2. Android 13+: the app must hold `POST_NOTIFICATIONS` runtime permission.
   The module's manifest declares it; request it from Profile → notifications
   toggle (already wired to `setNotificationsEnabled`) or accept the system
   prompt when the first notification posts.
3. Verify: start workout → ongoing silent notification with set counter;
   complete set → chronometer counts the rest down; the two action buttons
   work with the app in background.

## Known limitations (deliberate tonight)

- **No push-token updates**: the activity updates only while the app process
  is alive. Fine for workouts; remote updates need `pushType: .token` later.
- **Android is an app-posted notification, not a foreground Service** — it
  dies with the process. Upgrade path: move `postNotification` into a
  `Service` with `startForeground()` + `FOREGROUND_SERVICE_TYPE_HEALTH`
  (manifest: `android:foregroundServiceType="health"`).
- **Rest-end alert while backgrounded** still depends on expo-notifications
  (adapter is stubbed in `src/lib/notifications/adapter.ts`); the Live
  Activity countdown covers the visual case meanwhile.
