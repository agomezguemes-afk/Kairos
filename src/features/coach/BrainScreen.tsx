// "Tu cerebro" — what Kairos believes about you, how sure it is and where
// each belief comes from. The graph is the at-a-glance map; the cards are
// the receipts. Everything here comes from src/lib/engine/brain.ts.

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { brainSnapshot, type BrainGroup, type BrainNode, type BrainOrigin } from '../../lib/engine';
import { useCoachStore } from '../../store/coachStore';
import { Brut, Spacing } from '../../theme/tokens';
import { feedback } from './feedback';
import { ExpertPanelCard } from './components/ExpertPanel';
import { useTodayPanel } from './useTodayPanel';
import { BBox, BPress, BScreen, BTag, BText } from './ui/brut';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const GROUPS: { id: BrainGroup; label: string; short: string }[] = [
  { id: 'now', label: 'Ahora', short: 'AHORA' },
  { id: 'response', label: 'Cómo respondes', short: 'RESPUESTA' },
  { id: 'works', label: 'Qué te funciona', short: 'FUNCIONA' },
  { id: 'trends', label: 'Tendencias', short: 'TENDENCIAS' },
  { id: 'recovery', label: 'Recuperación', short: 'RECUPERACIÓN' },
];

const ORIGIN: Record<BrainOrigin, { tag: string; bg: string }> = {
  literature: { tag: 'SEGÚN ESTUDIOS', bg: 'transparent' },
  data: { tag: 'APRENDIDO DE TI', bg: Brut.accentSoft },
  experiment: { tag: 'PROBADO EN TI', bg: Brut.accent },
};

const dec = (v: number, d = 1) => v.toFixed(d).replace('.', ',');
/** Integers stay integers ("50 días", "13 – 87 %"); the rest get commas. */
const num = (v: number, d = 1) => (Number.isInteger(v) ? `${v}` : dec(v, d));
const showValue = (n: BrainNode) => num(n.value, n.unit === '×' ? 2 : 1);

// ── Graph ───────────────────────────────────────────────────────────

function BrainGraph({
  nodes,
  active,
  onPick,
  width,
}: {
  nodes: BrainNode[];
  active: BrainGroup | null;
  onPick: (g: BrainGroup | null) => void;
  width: number;
}) {
  const reduce = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!reduce) pulse.value = withRepeat(withTiming(1, { duration: 1600 }), -1, true);
  }, [pulse, reduce]);
  const coreProps = useAnimatedProps(() => ({ r: 22 + pulse.value * 3 }));

  const H = 270;
  const cx = width / 2;
  const cy = H / 2;
  const R = Math.min(width, H) * 0.34;
  const hubs = GROUPS.map((g, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / GROUPS.length;
    return { ...g, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), a };
  });

  return (
    <Svg width={width} height={H} accessibilityLabel="Mapa de lo que Kairos sabe de ti">
      {hubs.map((h) => {
        const members = nodes.filter((n) => n.group === h.id);
        const dim = active && active !== h.id;
        return (
          <React.Fragment key={h.id}>
            <Line
              x1={cx}
              y1={cy}
              x2={h.x}
              y2={h.y}
              stroke={Brut.ink}
              strokeWidth={2}
              opacity={dim ? 0.15 : 1}
            />
            {members.map((n, j) => {
              const spread = Math.min(1.6, 0.35 * members.length);
              const a = h.a + (members.length > 1 ? (j / (members.length - 1) - 0.5) * spread : 0);
              const x = h.x + 34 * Math.cos(a);
              const y = h.y + 34 * Math.sin(a);
              const color = n.origin === 'experiment' ? Brut.accent : Brut.ink;
              return (
                <React.Fragment key={n.id}>
                  <Line
                    x1={h.x}
                    y1={h.y}
                    x2={x}
                    y2={y}
                    stroke={color}
                    strokeWidth={0.8 + 2.6 * n.certainty}
                    strokeDasharray={n.origin === 'literature' ? '3 3' : undefined}
                    opacity={dim ? 0.15 : 1}
                  />
                  <Circle
                    cx={x}
                    cy={y}
                    r={3.5 + 3 * n.certainty}
                    fill={n.origin === 'literature' ? Brut.surface : color}
                    stroke={Brut.ink}
                    strokeWidth={1.2}
                    opacity={dim ? 0.2 : 1}
                  />
                </React.Fragment>
              );
            })}
            <Circle
              cx={h.x}
              cy={h.y}
              r={13}
              fill={active === h.id ? Brut.accent : Brut.surface}
              stroke={Brut.ink}
              strokeWidth={1.5}
              onPress={() => onPick(active === h.id ? null : h.id)}
            />
            <SvgText
              // Mono labels are ~5.5 px per character at 9 px: keep them inside.
              x={Math.min(
                width - h.short.length * 2.8 - 2,
                Math.max(h.short.length * 2.8 + 2, h.x),
              )}
              y={h.y + (h.y > cy ? 28 : -20)}
              fontSize={9}
              fontFamily={Brut.font.monoBold}
              fill={Brut.ink}
              textAnchor="middle"
              opacity={dim ? 0.3 : 1}
            >
              {h.short}
            </SvgText>
            <SvgText
              x={h.x}
              y={h.y + 3.5}
              fontSize={10}
              fontFamily={Brut.font.monoBold}
              fill={Brut.ink}
              textAnchor="middle"
            >
              {members.length}
            </SvgText>
          </React.Fragment>
        );
      })}
      <AnimatedCircle
        cx={cx}
        cy={cy}
        animatedProps={coreProps}
        fill={Brut.accent}
        stroke={Brut.ink}
        strokeWidth={2}
        onPress={() => onPick(null)}
      />
      <SvgText
        x={cx}
        y={cy + 5}
        fontSize={15}
        fontFamily={Brut.font.display}
        fill={Brut.ink}
        textAnchor="middle"
      >
        TÚ
      </SvgText>
    </Svg>
  );
}

// ── Node card ───────────────────────────────────────────────────────

const NodeCard = React.memo(function NodeCard({ n, index }: { n: BrainNode; index: number }) {
  const o = ORIGIN[n.origin];
  const segments = 5;
  const lit = Math.round(n.certainty * segments);
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(Brut.motion.reveal)}
      layout={LinearTransition.duration(Brut.motion.tab)}
    >
      <BBox
        shadowColor={n.origin === 'experiment' ? Brut.accent : undefined}
        radius={Brut.radius.md}
        contentStyle={styles.card}
      >
        <View style={styles.cardHead}>
          <BText variant="bodyBold" size={15} style={{ flex: 1 }} numberOfLines={2}>
            {n.label}
          </BText>
          <BTag bg={o.bg}>{o.tag}</BTag>
        </View>
        <View style={styles.valueRow}>
          <BText variant="display" size={34}>
            {showValue(n)}
          </BText>
          <BText variant="monoBold" size={11}>
            {n.unit.toUpperCase()}
          </BText>
          {n.interval && (
            <BText variant="mono" size={10} color={Brut.muted} style={{ marginLeft: 'auto' }}>
              {`90 %: ${num(n.interval[0], n.unit === '×' ? 2 : 1)} – ${num(n.interval[1], n.unit === '×' ? 2 : 1)}`}
            </BText>
          )}
        </View>
        <BText size={13} style={{ marginTop: 4 }}>
          {n.meaning}
        </BText>
        <View style={styles.certRow}>
          <BText variant="monoBold" size={9} color={Brut.muted}>
            SEGURIDAD
          </BText>
          <View style={styles.segments}>
            {Array.from({ length: segments }, (_, i) => (
              <View key={i} style={[styles.segment, i < lit && styles.segmentOn]} />
            ))}
          </View>
          <BText variant="mono" size={9} color={Brut.muted}>
            {`${n.evidence} ${n.evidence === 1 ? 'DATO' : 'DATOS'}`}
          </BText>
        </View>
        <BText variant="mono" size={9} color={Brut.muted} style={{ marginTop: 4 }}>
          {n.source}
        </BText>
      </BBox>
    </Animated.View>
  );
});

// ── Screen ──────────────────────────────────────────────────────────

export default function BrainScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const sessions = useCoachStore((s) => s.sessions);
  const checkins = useCoachStore((s) => s.checkins);
  const experiments = useCoachStore((s) => s.experiments);
  const [now] = useState(() => new Date());
  const [active, setActive] = useState<BrainGroup | null>(null);
  const today = useTodayPanel(now.getTime());

  const brain = useMemo(
    () => brainSnapshot(sessions, checkins, experiments, now),
    [checkins, experiments, now, sessions],
  );
  const shown = active ? brain.nodes.filter((n) => n.group === active) : brain.nodes;
  const graphW = Math.min(width, 520) - Spacing.lg * 2 - 30;

  const pick = (g: BrainGroup | null) => {
    feedback.tick();
    setActive(g);
  };

  return (
    <BScreen>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 40 },
        ]}
      >
        <View style={styles.topRow}>
          <BPress
            onPress={() => navigation.goBack()}
            radius={12}
            contentStyle={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <BText variant="bodyBold" size={18} upright>
              ←
            </BText>
          </BPress>
          <BText variant="monoBold" size={11} style={{ letterSpacing: 2 }}>
            KAIROS{' '}
            <BText variant="mono" size={11} color={Brut.muted}>
              / TU CEREBRO
            </BText>
          </BText>
        </View>

        <Animated.View entering={FadeInDown.duration(Brut.motion.reveal)}>
          <BText variant="display" size={48} style={{ marginTop: Spacing.md }}>
            TU CEREBRO
          </BText>
          <BText variant="mono" size={10} color={Brut.muted}>
            {`${brain.totals.sessions} SESIONES · ${brain.totals.checkins} CHECK-INS · ${brain.totals.experiments} EXPERIMENTOS`}
          </BText>
        </Animated.View>

        {/* How the engine decided today: four perspectives with their track record. */}
        <View style={{ marginTop: Spacing.lg }}>
          <ExpertPanelCard panel={today.panel} r={today.readiness} />
        </View>

        <Animated.View entering={FadeIn.delay(120).duration(Brut.motion.reveal)}>
          <BBox style={{ marginTop: Spacing.lg }} contentStyle={styles.graphBox}>
            <BrainGraph nodes={brain.nodes} active={active} onPick={pick} width={graphW} />
            <View style={styles.legend}>
              <Legend dash={false} color={Brut.ink} label="Aprendido de ti" />
              <Legend dash color={Brut.ink} label="Según estudios" />
              <Legend dash={false} color={Brut.accent} label="Probado en ti" />
            </View>
            <BText variant="mono" size={9} color={Brut.muted} style={{ marginTop: 4 }}>
              GROSOR = SEGURIDAD · TOCA UN NODO PARA FILTRAR
            </BText>
          </BBox>
        </Animated.View>

        <View style={styles.stats}>
          <BBox
            bg={Brut.accent}
            radius={Brut.radius.md}
            style={{ flex: 1 }}
            contentStyle={styles.stat}
          >
            <BText variant="monoBold" size={10}>
              CREENCIAS
            </BText>
            <BText variant="display" size={28}>
              {brain.totals.beliefs}
            </BText>
          </BBox>
          <BBox radius={Brut.radius.md} style={{ flex: 1 }} contentStyle={styles.stat}>
            <BText variant="monoBold" size={10} color={Brut.muted}>
              HIPÓTESIS
            </BText>
            <BText variant="display" size={28}>
              {brain.totals.hypotheses}
            </BText>
          </BBox>
        </View>
        <BText size={13} color={Brut.muted} style={{ marginTop: Spacing.sm }}>
          Empiezo sabiendo lo que dicen los estudios. Cada sesión, check-in y experimento convierte
          hipótesis en creencias sobre ti.
        </BText>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          style={{ marginTop: Spacing.lg }}
        >
          <Filter label="TODO" on={active === null} onPress={() => pick(null)} />
          {GROUPS.map((g) => (
            <Filter
              key={g.id}
              label={g.short}
              on={active === g.id}
              onPress={() => pick(active === g.id ? null : g.id)}
            />
          ))}
        </ScrollView>

        <View style={styles.cards}>
          {shown.length === 0 ? (
            <BBox dashed shadow={0} contentStyle={styles.card}>
              <BText size={14}>
                Aún no hay nada aquí. Entrena y responde los check-ins: esta parte se llena sola.
              </BText>
            </BBox>
          ) : (
            shown.map((n, i) => <NodeCard key={n.id} n={n} index={i} />)
          )}
        </View>
      </ScrollView>
    </BScreen>
  );
}

function Legend({ dash, color, label }: { dash: boolean; color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <Svg width={22} height={8}>
        <Line
          x1={0}
          y1={4}
          x2={22}
          y2={4}
          stroke={color}
          strokeWidth={2.5}
          strokeDasharray={dash ? '3 3' : undefined}
        />
      </Svg>
      <BText variant="mono" size={9}>
        {label.toUpperCase()}
      </BText>
    </View>
  );
}

function Filter({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.filter, on && styles.filterOn]}
    >
      <BText variant="monoBold" size={10} color={on ? Brut.bg : Brut.ink}>
        {label}
      </BText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  graphBox: { padding: 12, alignItems: 'center' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
    justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stats: { flexDirection: 'row', gap: 6, marginTop: Spacing.md },
  stat: { padding: 10, gap: 6 },
  filters: { gap: 6 },
  filter: {
    paddingHorizontal: 10,
    height: 34,
    borderRadius: 10,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
    justifyContent: 'center',
    backgroundColor: Brut.surface,
  },
  filterOn: { backgroundColor: Brut.ink },
  cards: { gap: Spacing.sm, marginTop: Spacing.md },
  card: { padding: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 },
  certRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  segments: { flexDirection: 'row', gap: 3 },
  segment: {
    width: 14,
    height: 8,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: Brut.ink,
  },
  segmentOn: { backgroundColor: Brut.ink },
});
