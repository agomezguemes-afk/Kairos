// LiveSession — the in-workout surface. Designed for a 2-second glance:
// one huge number (heart rate), one current movement, one obvious action.
// Sets are prefilled from the last time this session was done, so logging
// is a tap per set unless something changed.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  LinearTransition,
  ZoomIn,
} from 'react-native-reanimated';

import type { RootStackParamList } from '../../types/navigation';
import {
  getMovement,
  hrZone,
  type DraftSession,
  type MovementLog,
  type SessionLog,
  type SetLog,
} from '../../lib/adaptive';
import {
  SensorHub,
  SimulatedSource,
  defaultSources,
  type SensorAvailability,
  type SensorSource,
} from '../../lib/sensors';
import { useCoachStore } from '../../store/coachStore';
import { Brut, Coach, Colors, Spacing } from '../../theme/tokens';
import { bt } from './ui/brut';
import { feedback } from './feedback';
import { describeTarget, fmtClock, fmtSec, formatValue, stepFor } from './format';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Phase = { kind: 'idle' | 'work' | 'rest'; left: number };

// No age in the profile yet; 190 is a neutral default until we read it from HealthKit.
const DEFAULT_HR_MAX = 190;

const RPE_LABEL = [
  'Reposo',
  'Muy fácil',
  'Fácil',
  'Cómodo',
  'Algo exigente',
  'Exigente',
  'Duro',
  'Muy duro',
  'Durísimo',
  'Casi máximo',
  'Máximo',
];

function initialLogs(draft: DraftSession, previous?: SessionLog): MovementLog[] {
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

export default function LiveSessionScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'LiveSession'>>();
  const plan = useCoachStore((s) => s.plan);
  const history = useCoachStore((s) => s.sessions);
  const recordSession = useCoachStore((s) => s.recordSession);
  const draft = plan?.sessions.find((s) => s.id === params.draftSessionId);

  const previous = useMemo(
    () => [...history].reverse().find((h) => h.draftSessionId === params.draftSessionId),
    // Snapshot at mount: the session being logged must not chase store updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [logs, setLogs] = useState<MovementLog[]>(() =>
    draft ? initialLogs(draft, previous) : [],
  );
  const [index, setIndex] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle', left: 0 });
  const [finishing, setFinishing] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);

  // ── Sensors ──────────────────────────────────────────────────────
  const cycling = draft?.sport === 'cycling' || !!draft?.movements.some((m) => m.target.cadenceRpm);
  const [hub] = useState(() => new SensorHub(DEFAULT_HR_MAX));
  const sources = useMemo(() => defaultSources({ cycling }), [cycling]);
  const simulator = useMemo(
    () => sources.find((s): s is SimulatedSource => s instanceof SimulatedSource),
    [sources],
  );
  const [avail, setAvail] = useState<Record<string, SensorAvailability>>({});
  const [connected, setConnected] = useState<string[]>([]);
  const [sensorError, setSensorError] = useState<string | null>(null);
  const [live, setLive] = useState<{ hr?: number; cadence?: number; power?: number }>({});

  const connect = useCallback(
    async (src: SensorSource) => {
      setSensorError(null);
      try {
        await hub.attach(src);
        setConnected(hub.attached);
        feedback.success();
      } catch (e) {
        setSensorError(e instanceof Error ? e.message : 'No se pudo conectar');
        feedback.warning();
      }
    },
    [hub],
  );

  useEffect(() => {
    let alive = true;
    Promise.all(sources.map(async (s) => [s.id, await s.availability()] as const))
      .then((entries) => {
        if (!alive) return;
        setAvail(Object.fromEntries(entries));
        // On web there's no real sensor; start the simulator so the screen is alive.
        if (Platform.OS === 'web' && simulator) void connect(simulator);
      })
      .catch((e: unknown) => console.warn('[live] availability check failed', e));
    const unsub = hub.subscribe((l) =>
      setLive({ hr: l.heart_rate?.value, cadence: l.cadence?.value, power: l.power?.value }),
    );
    return () => {
      alive = false;
      unsub();
      hub.stopAll();
    };
  }, [connect, hub, simulator, sources]);

  // ── Clock & interval runner ──────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const current = logs[index];
  const movement = current ? getMovement(current.movementId) : undefined;

  useEffect(() => {
    if (!simulator || !movement) return;
    const base = { strength: 0.5, steady: 0.55, interval: 0.4, mobility: 0.15, skill: 0.35 }[
      movement.kind
    ];
    simulator.setIntensity(phase.kind === 'work' ? 0.92 : phase.kind === 'rest' ? 0.35 : base);
  }, [movement, phase.kind, simulator]);

  const markSet = useCallback((movementIdx: number, setIdx: number, patch: Partial<SetLog>) => {
    setLogs((prev) =>
      prev.map((l, i) =>
        i !== movementIdx
          ? l
          : { ...l, sets: l.sets.map((s, j) => (j === setIdx ? { ...s, ...patch } : s)) },
      ),
    );
  }, []);

  useEffect(() => {
    if (phase.kind === 'idle' || !current?.target.intervals) return;
    const iv = current.target.intervals;
    if (phase.left <= 0) {
      if (phase.kind === 'work') {
        const next = current.sets.findIndex((s) => !s.completed);
        if (next >= 0) markSet(index, next, { completed: true });
        const remaining = current.sets.filter((s) => !s.completed).length - 1;
        feedback.heavy();
        setPhase(remaining > 0 ? { kind: 'rest', left: iv.restSec } : { kind: 'idle', left: 0 });
      } else {
        feedback.tick();
        setPhase({ kind: 'work', left: iv.workSec });
      }
      return;
    }
    const t = setTimeout(() => setPhase((p) => ({ ...p, left: p.left - 1 })), 1000);
    return () => clearTimeout(t);
  }, [current, index, markSet, phase]);

  const goTo = (i: number) => {
    feedback.tick();
    setPhase({ kind: 'idle', left: 0 });
    setIndex(i);
  };

  const save = () => {
    if (!draft || rpe === null) return;
    const end = Date.now();
    const log: SessionLog = {
      id: `log-${end.toString(36)}`,
      draftSessionId: draft.id,
      title: draft.title,
      sport: draft.sport,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(end).toISOString(),
      durationMin: Math.max(1, Math.round((end - startedAt) / 60000)),
      rpe,
      movements: logs,
      sensors: connected.length ? hub.summary() : undefined,
    };
    hub.stopAll();
    recordSession(log);
    feedback.success();
    navigation.replace('SuggestionReveal', { sessionId: log.id });
  };

  if (!draft || !current || !movement) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.muted}>Esta sesión ya no está en tu plan.</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.secondaryBtn}>
          <Text style={styles.secondaryText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const zone = live.hr ? hrZone(live.hr, DEFAULT_HR_MAX) : null;
  const doneSets = current.sets.filter((s) => s.completed).length;
  const isLast = index === logs.length - 1;

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.sm }]}>
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <Pressable onPress={() => setFinishing(true)} hitSlop={12} accessibilityRole="button">
          <Text style={styles.endText}>Terminar</Text>
        </Pressable>
        <Text style={styles.clock}>{fmtClock(elapsed)}</Text>
        <Text style={styles.topMeta} numberOfLines={1}>
          {draft.title}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Vitals */}
        <View style={styles.vitals}>
          <View style={styles.hrRow}>
            <Text style={[styles.hr, zone && { color: Coach.zone[zone - 1] }]}>
              {live.hr ?? '—'}
            </Text>
            <View style={styles.hrSide}>
              <Text style={styles.hrUnit}>ppm</Text>
              {zone && (
                <Animated.View
                  key={zone}
                  entering={ZoomIn.springify()}
                  style={[styles.zonePill, { backgroundColor: Coach.zone[zone - 1] }]}
                >
                  <Text style={styles.zoneText}>Z{zone}</Text>
                </Animated.View>
              )}
            </View>
            {(live.cadence !== undefined || live.power !== undefined) && (
              <View style={styles.extra}>
                {live.cadence !== undefined && (
                  <Text style={styles.extraValue}>
                    {live.cadence}
                    <Text style={styles.extraUnit}> rpm</Text>
                  </Text>
                )}
                {live.power !== undefined && (
                  <Text style={styles.extraValue}>
                    {live.power}
                    <Text style={styles.extraUnit}> W</Text>
                  </Text>
                )}
              </View>
            )}
          </View>
          <View style={styles.zoneBar}>
            {Coach.zone.map((c, i) => (
              <View
                key={c}
                style={[styles.zoneSeg, { backgroundColor: c, opacity: zone === i + 1 ? 1 : 0.18 }]}
              />
            ))}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sources}
          >
            {sources.map((s) => {
              const a = avail[s.id];
              const on = connected.includes(s.id);
              return (
                <Pressable
                  key={s.id}
                  disabled={!a?.available || on}
                  onPress={() => void connect(s)}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.label}${a?.reason ? `, ${a.reason}` : ''}`}
                  style={[styles.source, on && styles.sourceOn, !a?.available && { opacity: 0.45 }]}
                >
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: on
                          ? Colors.gold.base
                          : a?.available
                            ? Coach.stageInk
                            : Coach.stageFaint,
                      },
                    ]}
                  />
                  <View>
                    <Text style={styles.sourceLabel}>{s.label}</Text>
                    {!on && a?.reason && <Text style={styles.sourceReason}>{a.reason}</Text>}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          {sensorError && <Text style={styles.error}>{sensorError}</Text>}
        </View>

        {/* Current movement */}
        <Animated.View
          key={current.movementId}
          entering={FadeInDown.springify().damping(18)}
          style={styles.movementCard}
        >
          <Text style={styles.counter}>
            {index + 1} / {logs.length}
          </Text>
          <Text style={styles.movementName}>{movement.name}</Text>
          <Text style={styles.target}>{describeTarget(movement, current.target)}</Text>
          <Text style={styles.cue}>{movement.cue}</Text>

          {movement.kind === 'strength' && (
            <View style={styles.sets}>
              {current.sets.map((s, j) => (
                <SetRow
                  key={j}
                  n={j + 1}
                  set={s}
                  onChange={(patch) => markSet(index, j, patch)}
                  onToggle={() => {
                    if (!s.completed) feedback.heavy();
                    markSet(index, j, { completed: !s.completed });
                  }}
                />
              ))}
            </View>
          )}

          {movement.kind === 'interval' && current.target.intervals && (
            <View style={styles.intervalBox}>
              <View style={styles.repDots}>
                {current.sets.map((s, j) => (
                  <View key={j} style={[styles.repDot, s.completed && styles.repDotDone]} />
                ))}
              </View>
              {phase.kind === 'idle' ? (
                <Pressable
                  disabled={doneSets === current.sets.length}
                  onPress={() => {
                    feedback.heavy();
                    setPhase({ kind: 'work', left: current.target.intervals!.workSec });
                  }}
                  style={[styles.primaryBtn, doneSets === current.sets.length && { opacity: 0.3 }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryText}>
                    {doneSets === current.sets.length
                      ? 'Intervalos completados'
                      : doneSets
                        ? 'Continuar'
                        : 'Empezar intervalos'}
                  </Text>
                </Pressable>
              ) : (
                <Animated.View entering={FadeIn} style={styles.phaseBox}>
                  <Text
                    style={[
                      styles.phaseLabel,
                      phase.kind === 'work' && { color: Colors.gold.base },
                    ]}
                  >
                    {phase.kind === 'work' ? 'TRABAJO' : 'DESCANSO'}
                  </Text>
                  <Text style={styles.phaseClock}>{fmtSec(phase.left)}</Text>
                  <Pressable onPress={() => setPhase({ kind: 'idle', left: 0 })} hitSlop={8}>
                    <Text style={styles.muted}>Pausar</Text>
                  </Pressable>
                </Animated.View>
              )}
            </View>
          )}

          {(movement.kind === 'steady' ||
            movement.kind === 'mobility' ||
            movement.kind === 'skill') && (
            <Pressable
              onPress={() => {
                feedback.heavy();
                markSet(index, 0, { completed: !current.sets[0].completed });
              }}
              style={[styles.primaryBtn, current.sets[0].completed && styles.primaryDone]}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>
                {current.sets[0].completed ? '✓ Hecho' : 'Marcar como hecho'}
              </Text>
            </Pressable>
          )}
        </Animated.View>
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Pressable
          disabled={index === 0}
          onPress={() => goTo(index - 1)}
          style={[styles.navBtn, index === 0 && { opacity: 0.25 }]}
        >
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <View style={styles.dots}>
          {logs.map((l, i) => (
            <View
              key={l.movementId}
              style={[
                styles.navDot,
                i === index && styles.navDotOn,
                l.sets.every((s) => s.completed) && styles.navDotDone,
              ]}
            />
          ))}
        </View>
        {isLast ? (
          <Pressable
            onPress={() => setFinishing(true)}
            style={styles.finishBtn}
            accessibilityRole="button"
          >
            <Text style={styles.finishText}>Finalizar</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => goTo(index + 1)}
            style={styles.navBtn}
            accessibilityRole="button"
            accessibilityLabel="Siguiente"
          >
            <Text style={styles.navText}>›</Text>
          </Pressable>
        )}
      </View>

      {finishing && (
        <Animated.View
          entering={FadeIn.duration(180)}
          style={[StyleSheet.absoluteFill, styles.sheetScrim]}
        >
          <Animated.View
            entering={FadeInUp.springify().damping(20)}
            style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.xl }]}
          >
            <Text style={styles.sheetTitle}>¿Cuánto te ha costado?</Text>
            <Text style={styles.muted}>Esfuerzo de toda la sesión, del 1 al 10.</Text>
            <View style={styles.rpeGrid}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => {
                    feedback.tick();
                    setRpe(v);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: rpe === v }}
                  style={[styles.rpe, rpe === v && styles.rpeOn]}
                >
                  <Text style={[styles.rpeText, rpe === v && styles.rpeTextOn]}>{v}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.rpeLabel}>{rpe !== null ? RPE_LABEL[rpe] : ' '}</Text>
            <Pressable
              disabled={rpe === null}
              onPress={save}
              style={[styles.saveBtn, rpe === null && { opacity: 0.3 }]}
              accessibilityRole="button"
            >
              <Text style={styles.saveText}>Guardar entreno</Text>
            </Pressable>
            <Pressable
              onPress={() => setFinishing(false)}
              hitSlop={8}
              style={{ alignSelf: 'center' }}
            >
              <Text style={styles.muted}>Seguir entrenando</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const SetRow = React.memo(function SetRow({
  n,
  set,
  onChange,
  onToggle,
}: {
  n: number;
  set: SetLog;
  onChange: (patch: Partial<SetLog>) => void;
  onToggle: () => void;
}) {
  const load = set.loadKg ?? 0;
  const step = stepFor('kg', load);
  return (
    <Animated.View
      layout={LinearTransition}
      style={[styles.setRow, set.completed && styles.setRowDone]}
    >
      <Text style={styles.setN}>{n}</Text>
      <MiniStepper
        value={set.reps ?? 0}
        label="reps"
        onChange={(v) => onChange({ reps: Math.max(0, v) })}
        step={1}
      />
      <MiniStepper
        value={load}
        label="kg"
        onChange={(v) => onChange({ loadKg: Math.max(0, v) })}
        step={step}
      />
      <Pressable
        onPress={() => onChange({ rir: ((set.rir ?? 2) + 1) % 5 })}
        accessibilityLabel={`Repeticiones en reserva ${set.rir ?? 2}`}
        style={styles.rirChip}
      >
        <Text style={styles.rirText}>RIR {set.rir ?? 2}</Text>
      </Pressable>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: set.completed }}
        style={[styles.check, set.completed && styles.checkOn]}
      >
        <Text style={[styles.checkGlyph, set.completed && { color: Coach.stage }]}>✓</Text>
      </Pressable>
    </Animated.View>
  );
});

const MiniStepper = React.memo(function MiniStepper({
  value,
  label,
  step,
  onChange,
}: {
  value: number;
  label: string;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.mini}>
      <Pressable
        onPress={() => onChange(+(value - step).toFixed(2))}
        hitSlop={6}
        style={styles.miniBtn}
        accessibilityLabel={`Menos ${label}`}
      >
        <Text style={styles.miniGlyph}>−</Text>
      </Pressable>
      <View style={styles.miniValueBox}>
        <Text style={styles.miniValue}>{formatValue(value, '')}</Text>
        <Text style={styles.miniLabel}>{label}</Text>
      </View>
      <Pressable
        onPress={() => onChange(+(value + step).toFixed(2))}
        hitSlop={6}
        style={styles.miniBtn}
        accessibilityLabel={`Más ${label}`}
      >
        <Text style={styles.miniGlyph}>+</Text>
      </Pressable>
    </View>
  );
});

// Night variant of direction D: same boxes and type, inverted ground, so
// the numbers read at a glance mid-set.
const N = Brut.night;
const LINE = Brut.border;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: N.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  muted: { ...bt.body(14), color: N.muted },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  endText: { ...bt.mono(12, true), color: Colors.semantic.error },
  clock: { ...bt.display(24), color: N.ink, fontVariant: ['tabular-nums'] },
  topMeta: { ...bt.mono(10, true), color: N.muted, flex: 1, textAlign: 'right' },
  vitals: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  hrRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md },
  hr: { ...bt.display(108), color: N.ink, fontVariant: ['tabular-nums'] },
  hrSide: { paddingBottom: 18, gap: 6 },
  hrUnit: { ...bt.mono(12, true), color: N.muted },
  zonePill: {
    borderRadius: 8,
    borderWidth: LINE,
    borderColor: N.ink,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  zoneText: { ...bt.mono(10, true), color: Brut.ink },
  extra: { marginLeft: 'auto', paddingBottom: 18, alignItems: 'flex-end', gap: 2 },
  extraValue: { ...bt.display(30), color: N.ink, fontVariant: ['tabular-nums'] },
  extraUnit: { ...bt.mono(11), color: N.muted },
  zoneBar: { flexDirection: 'row', gap: 4, marginTop: Spacing.md },
  zoneSeg: { flex: 1, height: 10, borderRadius: 2, borderWidth: 1.5, borderColor: N.ink },
  sources: { gap: Spacing.sm, paddingVertical: Spacing.lg },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: LINE,
    borderColor: 'rgba(242,240,234,0.28)',
  },
  sourceOn: { borderColor: Brut.accent },
  dot: { width: 8, height: 8, borderRadius: 1 },
  sourceLabel: { ...bt.body(13, 'bodyBold'), color: N.ink },
  sourceReason: { ...bt.mono(9), color: N.muted },
  error: { ...bt.mono(11), color: Colors.semantic.error },
  movementCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: N.surface,
    borderRadius: Brut.radius.xl,
    padding: Spacing.lg,
    borderWidth: LINE,
    borderColor: N.ink,
  },
  counter: { ...bt.mono(10, true), color: Brut.accent, letterSpacing: 1.6 },
  movementName: { ...bt.display(34), color: N.ink, marginTop: Spacing.sm },
  target: { ...bt.mono(12, true), color: N.ink, marginTop: Spacing.xs },
  cue: { ...bt.body(14), color: N.muted, marginTop: Spacing.sm },
  sets: { gap: Spacing.sm, marginTop: Spacing.lg },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: 6,
    borderRadius: 12,
    borderWidth: LINE,
    borderColor: 'rgba(242,240,234,0.22)',
  },
  setRowDone: { borderColor: Brut.accent, backgroundColor: 'rgba(201,169,110,0.12)' },
  setN: { width: 20, ...bt.mono(12, true), color: N.muted, textAlign: 'center' },
  mini: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  miniBtn: { width: 30, height: 40, alignItems: 'center', justifyContent: 'center' },
  miniGlyph: { ...bt.body(20, 'bodyBold'), color: N.muted, transform: [] },
  miniValueBox: { flex: 1, alignItems: 'center' },
  miniValue: { ...bt.display(22), color: N.ink, fontVariant: ['tabular-nums'] },
  miniLabel: { ...bt.mono(9), color: N.muted, marginTop: -2 },
  rirChip: { paddingHorizontal: 6, paddingVertical: 4 },
  rirText: { ...bt.mono(10, true), color: N.muted },
  check: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: LINE,
    borderColor: N.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: Brut.accent, borderColor: Brut.accent },
  checkGlyph: { ...bt.body(18, 'bodyBold'), color: N.muted, transform: [] },
  intervalBox: { marginTop: Spacing.lg, gap: Spacing.lg },
  repDots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  repDot: { width: 18, height: 18, borderRadius: 4, borderWidth: LINE, borderColor: N.ink },
  repDotDone: { backgroundColor: Brut.accent, borderColor: Brut.accent },
  phaseBox: { alignItems: 'center', gap: Spacing.xs },
  phaseLabel: { ...bt.mono(12, true), letterSpacing: 2.4, color: N.muted },
  phaseClock: { ...bt.display(88), color: N.ink, fontVariant: ['tabular-nums'] },
  primaryBtn: {
    marginTop: Spacing.lg,
    backgroundColor: N.ink,
    borderRadius: 14,
    borderWidth: LINE,
    borderColor: N.ink,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDone: { backgroundColor: Brut.accent, borderColor: Brut.accent },
  primaryText: { ...bt.body(16, 'bodyBold'), color: Brut.ink },
  secondaryBtn: {
    paddingHorizontal: 18,
    height: 46,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: LINE,
    borderColor: N.ink,
  },
  secondaryText: { ...bt.body(15, 'bodyBold'), color: N.ink },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: N.bg,
    borderTopWidth: LINE,
    borderTopColor: N.ink,
    gap: Spacing.md,
  },
  navBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: LINE,
    borderColor: N.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: { ...bt.body(26, 'bodyBold'), color: N.ink, marginTop: -3, transform: [] },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  navDot: { width: 8, height: 8, borderRadius: 2, backgroundColor: 'rgba(242,240,234,0.28)' },
  navDotOn: { width: 20, backgroundColor: N.ink },
  navDotDone: { backgroundColor: Brut.accent },
  finishBtn: {
    paddingHorizontal: 20,
    height: 52,
    borderRadius: 14,
    borderWidth: LINE,
    borderColor: N.ink,
    backgroundColor: Brut.accent,
    justifyContent: 'center',
  },
  finishText: { ...bt.body(16, 'bodyBold'), color: Brut.ink },
  sheetScrim: { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: N.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: LINE,
    borderBottomWidth: 0,
    borderColor: N.ink,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sheetTitle: { ...bt.display(36), color: N.ink },
  rpeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.sm },
  rpe: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: LINE,
    borderColor: N.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpeOn: { backgroundColor: Brut.accent, borderColor: Brut.accent },
  rpeText: { ...bt.display(22), color: N.ink },
  rpeTextOn: { color: Brut.ink },
  rpeLabel: { ...bt.mono(12, true), color: Brut.accent },
  saveBtn: {
    backgroundColor: Brut.accent,
    borderRadius: 16,
    borderWidth: LINE,
    borderColor: N.ink,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  saveText: { ...bt.body(17, 'bodyBold'), color: Brut.ink },
});
