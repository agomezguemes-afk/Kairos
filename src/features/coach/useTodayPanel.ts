// The expert panel on live data: the same decision the background pass
// makes, for the session the person would start next. Home reads only the
// verdict; the full panel is for the internal inspector.

import { useMemo } from 'react';

import {
  expertPanel,
  nextDraftSession,
  readinessV2,
  type Panel,
  type PanelVerdict,
  type ReadinessV2,
} from '../../lib/engine';
import { useCoachStore } from '../../store/coachStore';

const PAIN_NOW_MS = 3 * 86_400_000;

export function useTodayPanel(now: number): { panel: Panel; readiness: ReadinessV2 } {
  const plan = useCoachStore((s) => s.plan);
  const sessions = useCoachStore((s) => s.sessions);
  const checkins = useCoachStore((s) => s.checkins);
  const biometrics = useCoachStore((s) => s.biometrics);
  const signals = useCoachStore((s) => s.signals);
  const calibration = useCoachStore((s) => s.calibration);
  const memory = useCoachStore((s) => s.memory);

  // The kept session done fewest times (same choice as the start button).
  const nextMovements = useMemo(() => {
    const kept = plan?.sessions.filter((s) => s.status === 'accepted') ?? [];
    const done = (id: string) => sessions.filter((s) => s.draftSessionId === id).length;
    const next = [...kept].sort((a, b) => done(a.id) - done(b.id) || a.slot - b.slot)[0];
    return next?.movements.map((m) => m.movementId) ?? [];
  }, [plan, sessions]);

  const readiness = useMemo(
    () => readinessV2(sessions, checkins, new Date(now), { nextMovements, biometrics }),
    [biometrics, checkins, nextMovements, now, sessions],
  );

  const panel = useMemo(
    () =>
      expertPanel({
        readiness,
        sessions,
        nextMovements,
        adherence: signals?.adherence ?? null,
        pain: signals?.pain ?? null,
        painNow:
          !!signals?.pain?.active ||
          checkins.some((c) => c.pain && now - new Date(c.at).getTime() <= PAIN_NOW_MS),
        calibration,
        memory,
        checkins,
        now: new Date(now),
      }),
    [calibration, checkins, memory, nextMovements, now, readiness, sessions, signals],
  );

  return { panel, readiness };
}

/** A background plan is reused within this distance of the moment it was made for. */
const PLAN_VALID_MS = 6 * 3_600_000;

/**
 * Today's call for Home. The engine already decided it in its last pass
 * (dayPlan); recomputing on every render would redo that work on the UI
 * thread. Only when that plan is for another moment (e.g. made last night
 * for tomorrow) is it recomputed here.
 */
export function useTodayVerdict(now: number): Pick<PanelVerdict, 'band' | 'note'> | null {
  const dayPlan = useCoachStore((s) => s.dayPlan);
  const plan = useCoachStore((s) => s.plan);
  const sessions = useCoachStore((s) => s.sessions);
  const checkins = useCoachStore((s) => s.checkins);
  const biometrics = useCoachStore((s) => s.biometrics);
  const signals = useCoachStore((s) => s.signals);
  const calibration = useCoachStore((s) => s.calibration);
  const memory = useCoachStore((s) => s.memory);

  return useMemo(() => {
    const draft = nextDraftSession(plan, sessions);
    if (!draft) return null;
    if (
      dayPlan &&
      dayPlan.draftSessionId === draft.id &&
      Math.abs(now - new Date(dayPlan.forDate).getTime()) <= PLAN_VALID_MS
    )
      return { band: dayPlan.band, note: dayPlan.note };
    const nextMovements = draft.movements.map((m) => m.movementId);
    const readiness = readinessV2(sessions, checkins, new Date(now), {
      nextMovements,
      biometrics,
    });
    return expertPanel({
      readiness,
      sessions,
      nextMovements,
      adherence: signals?.adherence ?? null,
      pain: signals?.pain ?? null,
      painNow:
        !!signals?.pain?.active ||
        checkins.some((c) => c.pain && now - new Date(c.at).getTime() <= PAIN_NOW_MS),
      calibration,
      memory,
      checkins,
      now: new Date(now),
    }).verdict;
  }, [biometrics, calibration, checkins, dayPlan, memory, now, plan, sessions, signals]);
}
