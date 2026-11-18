// Two faces of the expert panel. The person sees only TodayVerdict: what
// to do today, in one line. ExpertPanelCard (the four perspectives, their
// evidence and track record) lives in the internal inspector: it is how
// the engine decides, not something the person needs to read.

import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import type { Lens, Panel, PanelVerdict, ReadinessV2, Stance } from '../../../lib/engine';
import { Brut, Spacing } from '../../../theme/tokens';
import { feedback } from '../feedback';
import { BBox, BTag, BText } from '../ui/brut';
import { ReadinessDetails } from './Loop';

const BAND = {
  go: { label: 'LISTO PARA ENTRENAR', bg: Brut.accent, ink: Brut.onAccent },
  easy: { label: 'HOY, SUAVE', bg: Brut.accentSoft, ink: Brut.ink },
  rest: { label: 'HOY TOCA DESCANSAR', bg: Brut.surface, ink: Brut.ink },
} as const;

const STANCE: Record<Stance, string> = {
  push: 'ADELANTE',
  steady: 'SIN SUBIR',
  ease: 'SUAVE',
  rest: 'PARA',
};

const pct = (p: number) => `${Math.round(p * 100)}%`;

/** What the person sees: the day's call, and a reason only when it changes the plan. */
export const TodayVerdict = React.memo(function TodayVerdict({
  verdict,
}: {
  verdict: PanelVerdict;
}) {
  const b = BAND[verdict.band];
  return (
    <BBox bg={b.bg} shadow={2} radius={12} contentStyle={styles.verdict}>
      <View style={{ flex: 1 }}>
        <BText variant="monoBold" size={10} color={b.ink}>
          {b.label}
        </BText>
        {verdict.note && (
          <BText size={13} color={b.ink} style={{ marginTop: 2 }}>
            {verdict.note}
          </BText>
        )}
      </View>
    </BBox>
  );
});

function LensRow({ lens, r, lead }: { lens: Lens; r: ReadinessV2; lead: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Animated.View layout={LinearTransition.duration(180)} style={styles.lens}>
      <Pressable
        onPress={() => {
          feedback.light();
          setOpen((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${lens.title}: ${lens.reason}${open ? '' : ' Ver en qué se basa.'}`}
        style={styles.lensHead}
      >
        <View style={{ flex: 1 }}>
          <BText variant="monoBold" size={10}>
            {lens.title.toUpperCase()}
            {lead ? ' · DECIDE' : ''}
          </BText>
          <BText size={13} style={{ marginTop: 2 }}>
            {lens.reason}
          </BText>
        </View>
        <BTag
          bg={lens.stance === 'push' ? 'transparent' : Brut.ink}
          color={lens.stance === 'push' ? Brut.ink : Brut.surface}
        >
          {STANCE[lens.stance]}
        </BTag>
      </Pressable>
      {open && (
        <Animated.View entering={FadeIn.duration(180)} style={styles.detail}>
          {lens.forecast && (
            <BText variant="mono" size={10}>
              {`${lens.forecast.label.toUpperCase()}: ${pct(lens.forecast.p)}${
                Math.abs(lens.forecast.p - lens.forecast.raw) >= 0.02
                  ? ` (SIN CORREGIR ${pct(lens.forecast.raw)})`
                  : ''
              }`}
            </BText>
          )}
          {lens.findings.map((f) => (
            <View key={f.text} style={styles.finding}>
              <BText size={12}>{f.text}</BText>
              <BText variant="mono" size={9} color={Brut.muted}>
                {f.source}
              </BText>
            </View>
          ))}
          <BText variant="monoBold" size={10} style={{ marginTop: 4 }}>
            {lens.track
              ? `FIABILIDAD · ${lens.track.headline.toUpperCase()}`
              : 'FIABILIDAD · AÚN SIN PREVISIONES QUE COMPROBAR'}
          </BText>
          {lens.id === 'physiology' && <ReadinessDetails r={r} />}
        </Animated.View>
      )}
    </Animated.View>
  );
}

export const ExpertPanelCard = React.memo(function ExpertPanelCard({
  panel,
  r,
}: {
  panel: Panel;
  r: ReadinessV2;
}) {
  const v = panel.verdict;
  const b = BAND[v.band];
  const physiology = panel.lenses.find((l) => l.id === 'physiology');
  const p = physiology?.forecast?.p ?? r.probability;
  return (
    <View>
      <BBox bg={b.bg} shadow={2} radius={12} contentStyle={styles.verdict}>
        <View style={{ flex: 1 }}>
          <BText variant="monoBold" size={10} color={b.ink}>
            {b.label}
            {r.informed ? '' : ' · SEGÚN ESTUDIOS'}
          </BText>
          <BText size={13} color={b.ink} style={{ marginTop: 2 }}>
            {v.note ?? 'Las cuatro miradas coinciden: entrena según el plan.'}
          </BText>
          {v.dissent && (
            <BText size={12} color={b.ink} style={{ marginTop: 4, opacity: 0.75 }}>
              {v.dissent.text}
            </BText>
          )}
        </View>
        <BText variant="display" size={28} color={b.ink}>
          {pct(p)}
        </BText>
      </BBox>
      <BBox shadow={2} radius={12} style={{ marginTop: Spacing.sm }} contentStyle={styles.lenses}>
        <BText variant="monoBold" size={10} color={Brut.muted} style={styles.lensesTitle}>
          CUATRO MIRADAS SOBRE HOY
        </BText>
        {panel.lenses.map((l, i) => (
          <View key={l.id} style={i > 0 ? styles.divider : undefined}>
            <LensRow lens={l} r={r} lead={l.id === v.lead && v.stance !== 'push'} />
          </View>
        ))}
      </BBox>
    </View>
  );
});

const styles = StyleSheet.create({
  verdict: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  lenses: { paddingVertical: 4 },
  lensesTitle: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2 },
  lens: { paddingHorizontal: 12, paddingVertical: 8 },
  lensHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  detail: { marginTop: 8, gap: 6 },
  finding: { gap: 1 },
  divider: { borderTopWidth: 1, borderTopColor: Brut.ink },
});
