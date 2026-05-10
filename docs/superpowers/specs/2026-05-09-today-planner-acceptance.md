# Today Planner — Acceptance Run 2026-05-09

**Status:** Code-green, device-pending.
**Branch:** `feat/canvas`
**Plan:** [2026-05-09-today-planner.md](../plans/2026-05-09-today-planner.md)
**Spec:** [2026-05-09-today-planner-design.md](2026-05-09-today-planner-design.md)

---

## Automated gates (passing)

Run via:

```bash
npx tsx src/features/planner/lib/dates.dev.ts \
  && npx tsx src/features/planner/lib/rrule.dev.ts \
  && npx tsx src/features/planner/lib/kaiSignal.dev.ts \
  && npx tsx src/store/scheduleStore.dev.ts \
  && npx tsc --noEmit \
  && echo "BATCH 6 GREEN"
```

- [x] `dates.dev.ts` — 13/13 checks pass.
- [x] `rrule.dev.ts` — 9/9 checks pass.
- [x] `kaiSignal.dev.ts` — 11/11 checks pass.
- [x] `scheduleStore.dev.ts` — 12/12 checks pass.
- [x] `tsc --noEmit` — exit 0, zero warnings.

---

## Manual checklist (spec §17)

These require an iPhone simulator or device run. Marked PENDING until Álvaro
runs them on simulator. Use `npm start` then `i` for iOS sim, or the
xcodebuild deploy chain documented in `CLAUDE.md` §Physical iPhone Deployment.

- [ ] **PENDING — requires device run.** HomeTab shows "Hoy" + date + momentum
  + streak pill, week view default, day card, KaiSignal.
- [ ] **PENDING — requires device run.** Toggle Semana ↔ Mes animates
  without layout jumps.
- [ ] **PENDING — requires device run.** Assign one-time block via sheet →
  dot in calendar, DayCard becomes Assigned, persists across reload.
- [ ] **PENDING — requires device run.** Assign recurring weekly L/X/V →
  dots on every L/X/V in current month, navigation between months preserves
  them.
- [ ] **PENDING — requires device run.** Tap Empezar → ActiveWorkoutScreen
  opens with the right block.
- [ ] **PENDING — requires device run.** Finalize workout → return to
  HomeTab → DayCard now Completed.
- [ ] **PENDING — requires device run.** Move a recurring occurrence: only
  that date moves, the rest stay.
- [ ] **PENDING — requires device run.** Skip a recurring occurrence:
  tomorrow shows PastSkipped (after a date change), rest of series intact.
- [ ] **PENDING — requires device run.** Edit series via chip: truncates old
  rule, new rule applies from today onward, history visible in past.
- [ ] **PENDING — requires device run.** No blocks at all: variant NoBlocks
  shows; tap Crear bloque → goes to WorkoutTab.
- [ ] **PENDING — requires device run.** No TS warnings or runtime errors in
  the Metro log.

---

## Issues

None observed at the type-check / dev-test layer.

## Notes

- The orchestrator owns header, calendar, day card, Kai signal, and four
  modal sheets (`AssignBlockSheet`, `RecurrenceEditorSheet`, `MovePicker`,
  `ChangeBlockPicker`). All wiring lives in `TodayPlanner.tsx`.
- `HomeTab.tsx` is now a 9-line wrapper; the previous "command centre"
  content (greeting, suggested block, mission progress, stats) is fully
  superseded by the planner.
- `ActiveWorkoutScreen.tsx` now calls `useScheduleStore.completeOccurrence`
  at both finish call sites (manual `Finalizar` button + auto-finish
  `useEffect` when all sets are done). Helper `markScheduleComplete`
  captures `aw.blockId` BEFORE `finishWorkout()` clears `activeWorkout`.

---

**End of acceptance log.**
