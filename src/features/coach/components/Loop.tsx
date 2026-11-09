// The adaptive loop's small surfaces on the Coach hub: readiness, the
// pre-session and weekly check-ins, and experiments (running + review).
// Each is a 10–20 second interaction; nothing here blocks training.

import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';

import {
  getMovement,
  type CheckIn,
  type Experiment,
  type ExperimentAnswers,
  type Feel,
  type Readiness,
  type Verdict,
  type WeekFeel,
} from '../../../lib/adaptive';
import { Brut, Spacing } from '../../../theme/tokens';
import { feedback } from '../feedback';
import { formatValue } from '../format';
import { BBox, BPress, BTag, BText } from '../ui/brut';

// ── Choice row ──────────────────────────────────────────────────────

function Choices<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => {
              feedback.tick();
              onChange(o.value);
            }}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${o.label}`}
            accessibilityState={{ checked: on }}
            aria-checked={on}
            style={[styles.choice, on && styles.choiceOn]}
          >
            <BText variant="bodyBold" size={13} upright={typeof o.value === 'number'}>
              {o.label}
            </BText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Readiness ───────────────────────────────────────────────────────

const BAND = {
  go: { label: 'LISTO PARA ENTRENAR', bg: Brut.accent },
  easy: { label: 'HOY, SUAVE', bg: Brut.accentSoft },
  rest: { label: 'HOY TOCA DESCANSAR', bg: Brut.surface },
} as const;

export function ReadinessBar({ r }: { r: Readiness }) {
  const b = BAND[r.band];
  return (
    <BBox bg={b.bg} shadow={2} radius={12} contentStyle={styles.readiness}>
      <View style={{ flex: 1 }}>
        <BText variant="monoBold" size={10}>
          {b.label}
          {r.informed ? '' : ' · ESTIMADO'}
        </BText>
        {r.reasons.length > 0 && (
          <BText size={13} style={{ marginTop: 2 }}>
            Porque {r.reasons.join(' y ')}.
          </BText>
        )}
      </View>
      <BText variant="display" size={28}>
        {r.score}
      </BText>
    </BBox>
  );
}

// ── Pre-session check-in ────────────────────────────────────────────

const SCALE = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }));

export function PreCheckInCard({ onSubmit }: { onSubmit: (c: CheckIn) => void }) {
  const [sleep, setSleep] = useState<number>();
  const [soreness, setSoreness] = useState<number>();
  const ready = sleep !== undefined && soreness !== undefined;
  return (
    <BBox contentStyle={styles.card}>
      <View style={styles.head}>
        <BText variant="monoBold" size={10}>
          ¿CÓMO LLEGAS HOY?
        </BText>
        <BTag>10 S</BTag>
      </View>
      <BText variant="bodySemi" size={14} style={styles.q}>
        Sueño{' '}
        <BText size={12} color={Brut.muted}>
          (1 fatal · 5 genial)
        </BText>
      </BText>
      <Choices label="Sueño" options={SCALE} value={sleep} onChange={setSleep} />
      <BText variant="bodySemi" size={14} style={styles.q}>
        Agujetas{' '}
        <BText size={12} color={Brut.muted}>
          (1 nada · 5 muchas)
        </BText>
      </BText>
      <Choices label="Agujetas" options={SCALE} value={soreness} onChange={setSoreness} />
      <BPress
        disabled={!ready}
        bg={Brut.accent}
        radius={12}
        style={{ marginTop: Spacing.md }}
        contentStyle={styles.submit}
        onPress={() => {
          feedback.success();
          onSubmit({
            id: `pre-${Date.now()}`,
            at: new Date().toISOString(),
            kind: 'pre',
            sleep,
            soreness,
          });
        }}
        accessibilityRole="button"
      >
        <BText variant="bodyBold" size={15}>
          Guardar
        </BText>
      </BPress>
    </BBox>
  );
}

// ── Weekly check-in ─────────────────────────────────────────────────

const FEEL: { value: WeekFeel; label: string }[] = [
  { value: 'easy', label: 'Fácil' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Dura' },
];
const OFF = [0, 1, 2, 3, 4].map((n) => ({ value: n, label: n === 4 ? '4+' : String(n) }));
const YESNO = [
  { value: 'no' as const, label: 'No' },
  { value: 'yes' as const, label: 'Sí' },
];

export function WeeklyCheckInCard({ onSubmit }: { onSubmit: (c: CheckIn) => void }) {
  const [off, setOff] = useState<number>();
  const [feel, setFeel] = useState<WeekFeel>();
  const [pain, setPain] = useState<'yes' | 'no'>();
  const ready = off !== undefined && feel !== undefined && pain !== undefined;
  return (
    <BBox shadowColor={Brut.accent} contentStyle={styles.card}>
      <View style={styles.head}>
        <BText variant="monoBold" size={10}>
          REVISIÓN SEMANAL
        </BText>
        <BTag bg={Brut.accent}>20 S</BTag>
      </View>
      <BText size={13} color={Brut.muted} style={{ marginTop: 4 }}>
        Aunque no hayas registrado nada, con esto ajusto tu semana.
      </BText>
      <BText variant="bodySemi" size={14} style={styles.q}>
        ¿Entrenaste fuera de la app?
      </BText>
      <Choices label="Sesiones fuera de la app" options={OFF} value={off} onChange={setOff} />
      <BText variant="bodySemi" size={14} style={styles.q}>
        ¿Cómo fue la semana?
      </BText>
      <Choices label="Cómo fue la semana" options={FEEL} value={feel} onChange={setFeel} />
      <BText variant="bodySemi" size={14} style={styles.q}>
        ¿Algún dolor?
      </BText>
      <Choices label="Dolor" options={YESNO} value={pain} onChange={setPain} />
      <BPress
        disabled={!ready}
        bg={Brut.accent}
        radius={12}
        style={{ marginTop: Spacing.md }}
        contentStyle={styles.submit}
        onPress={() => {
          feedback.success();
          onSubmit({
            id: `weekly-${Date.now()}`,
            at: new Date().toISOString(),
            kind: 'weekly',
            offAppSessions: off,
            weekFeel: feel,
            pain: pain === 'yes',
          });
        }}
        accessibilityRole="button"
      >
        <BText variant="bodyBold" size={15}>
          Enviar revisión
        </BText>
      </BPress>
    </BBox>
  );
}

// ── Experiments ─────────────────────────────────────────────────────

function describe(e: Experiment): string {
  const m = getMovement(e.movementId);
  const target = e.target ? formatValue(e.target.value, e.target.unit) : '';
  switch (e.kind) {
    case 'hold':
      return 'Semana de recuperación';
    case 'reduce_days':
      return 'Una sesión menos por semana';
    case 'new_movement':
      return `Nuevo: ${m?.name ?? 'ejercicio'}`;
    default:
      return `${m?.name ?? 'Ejercicio'}${target ? ` → ${target}` : ''}`;
  }
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }).toUpperCase();

export function ExperimentRow({ e, exposures }: { e: Experiment; exposures: number }) {
  return (
    <Animated.View layout={LinearTransition} style={styles.expRow}>
      <View style={styles.expDot} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <BText variant="bodySemi" size={14} numberOfLines={1}>
          {describe(e)}
        </BText>
        <BText variant="mono" size={10} color={Brut.muted}>
          {Math.min(exposures, e.minExposures)}/{e.minExposures} SESIONES · REVISIÓN{' '}
          {shortDate(e.reviewAfter)}
        </BText>
      </View>
    </Animated.View>
  );
}

const DID: { value: Verdict; label: string }[] = [
  { value: 'yes', label: 'Sí' },
  { value: 'partly', label: 'A medias' },
  { value: 'no', label: 'No' },
];
const FEELS: { value: Feel; label: string }[] = [
  { value: 'easy', label: 'Fácil' },
  { value: 'ok', label: 'Justo' },
  { value: 'hard', label: 'Duro' },
  { value: 'pain', label: 'Dolor' },
];

export function ExperimentReviewCard({
  e,
  onSubmit,
}: {
  e: Experiment;
  onSubmit: (a: ExperimentAnswers) => void;
}) {
  const [did, setDid] = useState<Verdict>();
  const [achieved, setAchieved] = useState<Verdict>();
  const [feel, setFeel] = useState<Feel>();
  const ready = did && achieved && feel;
  return (
    <Animated.View entering={FadeInDown.duration(Brut.motion.reveal)}>
      <BBox shadowColor={Brut.accent} contentStyle={styles.card}>
        <View style={styles.head}>
          <BText variant="monoBold" size={10}>
            ■ EXPERIMENTO · A REVISIÓN
          </BText>
          <BTag>{shortDate(e.startedAt)}</BTag>
        </View>
        <BText variant="display" size={22} style={{ marginTop: Spacing.sm }}>
          {describe(e).toUpperCase()}
        </BText>
        <BText variant="bodySemi" size={14} style={styles.q}>
          ¿Lo hiciste como se propuso?
        </BText>
        <Choices label="Lo hiciste" options={DID} value={did} onChange={setDid} />
        <BText variant="bodySemi" size={14} style={styles.q}>
          ¿Llegaste al objetivo?
        </BText>
        <Choices label="Objetivo" options={DID} value={achieved} onChange={setAchieved} />
        <BText variant="bodySemi" size={14} style={styles.q}>
          ¿Cómo lo sentiste?
        </BText>
        <Choices label="Sensación" options={FEELS} value={feel} onChange={setFeel} />
        <BPress
          disabled={!ready}
          bg={Brut.accent}
          radius={12}
          style={{ marginTop: Spacing.md }}
          contentStyle={styles.submit}
          onPress={() => {
            if (!did || !achieved || !feel) return;
            feedback.success();
            onSubmit({ did, achieved, feel });
          }}
          accessibilityRole="button"
        >
          <BText variant="bodyBold" size={15}>
            Cerrar experimento
          </BText>
        </BPress>
      </BBox>
    </Animated.View>
  );
}

export function ExperimentResult({ e }: { e: Experiment }) {
  const kept = e.status === 'kept';
  return (
    <Animated.View entering={FadeIn.duration(Brut.motion.reveal)}>
      <BBox
        bg={kept ? Brut.accent : Brut.surface}
        shadow={2}
        radius={12}
        contentStyle={styles.readiness}
      >
        <View style={{ flex: 1 }}>
          <BText variant="monoBold" size={10}>
            {kept ? 'SE QUEDA' : 'VUELVE A COMO ESTABA'}
          </BText>
          <BText size={13} style={{ marginTop: 2 }}>
            {describe(e)}.{' '}
            {kept
              ? 'Apuntado: este tipo de cambio te funciona.'
              : 'Apuntado: la próxima vez probaré otra vía.'}
          </BText>
          {e.objective?.evidence[0] && (
            <BText variant="mono" size={10} style={{ marginTop: 2 }}>
              {e.objective.evidence[0].toUpperCase()}
            </BText>
          )}
        </View>
      </BBox>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  q: { marginTop: Spacing.md, marginBottom: 6 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: {
    minWidth: 44,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brut.surface,
  },
  choiceOn: { backgroundColor: Brut.accent },
  submit: { height: 46, alignItems: 'center', justifyContent: 'center' },
  readiness: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  expRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  expDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
    backgroundColor: Brut.accent,
  },
});
