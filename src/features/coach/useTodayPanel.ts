// The expert panel on live data: the same decision the background pass
// makes, for the session the person would start next. Home reads only the
// verdict; the full panel is for the internal inspector.

import { useMemo } from 'react';

import { expertPanel, readinessV2, type Panel, type ReadinessV2 } from '../../lib/engine';
import { useCoachStore } from '../../store/coachStore';

const PAIN_NOW_MS = 3 * 86_400_000;

export function useTodayPanel(now: number): { panel: Panel; readiness: ReadinessV2 } {
  const plan = useCoachStore((s) => s.plan);
  const sessions = useCoachStore((s) => s.sessions);
  const checkins = useCoachStore((s) => s.checkins);
  const biometrics = useCoachStore((s) => s.biometrics);
  const signals = useCoachStore((s) => s.signals);
  const calibration = useCoachStore((s) => s.calibration);

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
        now: new Date(now),
      }),
    [calibration, checkins, nextMovements, now, readiness, sessions, signals],
  );

  return { panel, readiness };
}
