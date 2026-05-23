# HealthKit Integration

**Status:** Abstraction layer shipped. Native module activation pending — single user-driven step.

## What's already done

- `src/lib/health/healthkit.ts` — safe runtime wrapper, lazy-loads `react-native-health` when present, no-ops otherwise.
- `src/lib/health/met.ts` — MET-based kcal estimator per discipline.
- `src/lib/health/types.ts` — discipline → HKWorkoutActivityType mapping.
- `src/store/workoutStore.ts` — `healthkitEnabled` flag, `bodyWeightKg` field, persisted. `finishWorkout` fires `writeWorkout` when enabled and module is loadable.

## What you (Álvaro) need to do once

```bash
# 1. Install the native package
npx expo install react-native-health

# 2. Add the Expo config plugin to app.json plugins array:
#    "plugins": [
#      ...
#      ["react-native-health", {
#        "healthSharePermission": "Kairos lee tu peso corporal para calorías más precisas.",
#        "healthUpdatePermission": "Kairos guarda tus sesiones para que cuenten en Apple Fitness."
#      }]
#    ]

# 3. Prebuild + rebuild
npx expo prebuild --clean
npx expo run:ios
```

After step 3, `isHealthKitAvailable()` returns true on device. The user must enable it via the Profile screen toggle (or programmatically: `useWorkoutStore.getState().setHealthkitEnabled(true)`).

## How permissions are requested

First time `requestHealthKitPermissions()` is called, iOS shows the system sheet. Call it from Profile's HealthKit toggle handler — never silently at app startup (Apple guideline).

## What gets written

For every completed session:
- `HKWorkout` with discipline-mapped `HKWorkoutActivityType`
- `startDate`, `endDate` from session timestamps
- `totalEnergyBurned` (kcal) computed via MET formula (only when bodyWeight is set)

These appear in Apple Fitness, contribute to Move rings, and show up in the Workouts tab.

## Read-back

`readBodyWeight()` returns the latest weight sample in kg (or null). Useful for bodyweight exercises and accurate kcal estimates.

## Failure modes

All HealthKit calls are wrapped in try/catch. The module is lazy-required so a missing install doesn't crash the bundle. The `healthkitEnabled` flag defaults to false — no writes occur until the user opts in.
