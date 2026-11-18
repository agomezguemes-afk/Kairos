// Sets prefilled from the last time this session was done, so logging is a
// tap per set unless something changed. Shared by the phone's live session
// and the plan sent to the Apple Watch: both must start from the same numbers.

import { getMovement } from './catalog';
import type { DraftSession, MovementLog, SessionLog, SetLog } from './types';

export function initialLogs(draft: DraftSession, previous?: SessionLog): MovementLog[] {
  return draft.movements.map((pm) => {
    const m = getMovement(pm.movementId);
    const t = pm.target;
    const prev = previous?.movements.find((x) => x.movementId === pm.movementId);
    let sets: SetLog[];
    switch (m?.kind) {
      case 'strength': {
        const n = t.sets ?? 3;
        sets = Array.from({ length: n }, (_, i) => {
          const p = prev?.sets[i];
          return {
            reps: p?.reps ?? t.repsMax ?? 8,
            loadKg: t.loadKg ?? p?.loadKg ?? (m.defaults.loadKg === 0 ? 0 : 20),
            rir: t.rir,
            completed: false,
          };
        });
        break;
      }
      case 'interval': {
        const iv = t.intervals ?? { reps: 6, workSec: 30, restSec: 30 };
        sets = Array.from({ length: iv.reps * (t.sets ?? 1) }, () => ({
          durationSec: iv.workSec,
          completed: false,
        }));
        break;
      }
      default:
        sets = [
          { durationSec: (t.durationMin ?? 20) * 60, distanceKm: t.distanceKm, completed: false },
        ];
    }
    return { movementId: pm.movementId, target: { ...t }, sets };
  });
}

/** The most recent log of this planned session, if any. */
export function previousLog(history: SessionLog[], draftSessionId: string): SessionLog | undefined {
  return [...history].reverse().find((h) => h.draftSessionId === draftSessionId);
}
