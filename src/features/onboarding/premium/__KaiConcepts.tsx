// TEMP — a static gallery of Kai mark concepts for Álvaro to pick from.
// Gold marks on warm tiles, icon-scale, so recognizability reads as it would in
// the product. Numbered so we can talk about "el 7". Delete after we choose one.

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { Colors, Type } from '../../../theme/tokens';

const GOLD_A = '#E7C57C';
const GOLD_B = '#C9A96E';
const GOLD_C = '#A9802F';
const SW = 7.5; // shared stroke weight for the line marks

function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M${x + r} ${y} h${w - 2 * r} a${r} ${r} 0 0 1 ${r} ${r} v${h - 2 * r} ` +
    `a${r} ${r} 0 0 1 ${-r} ${r} h${-(w - 2 * r)} a${r} ${r} 0 0 1 ${-r} ${-r} ` +
    `v${-(h - 2 * r)} a${r} ${r} 0 0 1 ${r} ${-r} Z`
  );
}

interface Concept {
  label: string;
  note: string;
  /** g = the gold gradient url for this tile. */
  render: (g: string) => React.ReactNode;
}

const stroke = (g: string, extra?: object) => ({
  stroke: g,
  strokeWidth: SW,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
  ...extra,
});

const CONCEPTS: Concept[] = [
  {
    label: 'Trazo',
    note: 'la firma viva (actual)',
    render: (g) => (
      <>
        <Path d="M26 56 C 40 49, 60 49, 74 44" {...stroke(g)} />
        <Circle cx={74} cy={44} r={4.6} fill={g} />
      </>
    ),
  },
  {
    label: 'Chispa',
    note: 'inteligencia / destello',
    render: (g) => (
      <Path
        d="M50 15 C 53.5 41, 59 46.5, 85 50 C 59 53.5, 53.5 59, 50 85 C 46.5 59, 41 53.5, 15 50 C 41 46.5, 46.5 41, 50 15 Z"
        fill={g}
      />
    ),
  },
  {
    label: 'Sello',
    note: 'la marca + núcleo',
    render: (g) => (
      <>
        <Path d={roundedRect(23, 23, 54, 54, 17)} {...stroke(g, { strokeWidth: 7 })} />
        <Circle cx={50} cy={50} r={7.5} fill={g} />
      </>
    ),
  },
  {
    label: 'Creciente',
    note: 'observa / ciclo',
    render: (g) => (
      <>
        <Circle cx={47} cy={50} r={30} fill={g} />
        <Circle cx={59} cy={45} r={27} fill={Colors.bg.surface} />
      </>
    ),
  },
  {
    label: 'Órbita',
    note: 'el agente que ronda',
    render: (g) => (
      <>
        <Ellipse
          cx={50}
          cy={50}
          rx={31}
          ry={20}
          {...stroke(g, { strokeWidth: 5.5 })}
          transform="rotate(-22 50 50)"
        />
        <Circle cx={73} cy={37} r={6.8} fill={g} />
      </>
    ),
  },
  {
    label: 'Cometa',
    note: 'movimiento / impulso',
    render: (g) => (
      <>
        <Circle cx={62} cy={39} r={11} fill={g} />
        <Path d="M53 47 C 44 57, 36 64, 26 73" {...stroke(g, { strokeWidth: 6.5 })} />
      </>
    ),
  },
  {
    label: 'Cúspide',
    note: 'ascenso / progreso',
    render: (g) => (
      <>
        <Path d="M28 55 L 50 35 L 72 55" {...stroke(g, { strokeWidth: 8 })} />
        <Path d="M28 71 L 50 51 L 72 71" {...stroke(g, { strokeWidth: 8 })} />
      </>
    ),
  },
  {
    label: 'Prisma',
    note: 'decisión / kairós',
    render: (g) => (
      <Path
        d="M50 25 L 76 71 L 24 71 Z"
        fill={g}
        stroke={g}
        strokeWidth={7}
        strokeLinejoin="round"
      />
    ),
  },
  {
    label: 'Pulso',
    note: 'vitalidad / datos',
    render: (g) => (
      <Path
        d="M20 52 H 38 L 44 37 L 53 67 L 60 46 L 65 52 H 80"
        {...stroke(g, { strokeWidth: 6.5 })}
      />
    ),
  },
  {
    label: 'Semilla',
    note: 'crecimiento',
    render: (g) => (
      <>
        <Path d="M32 68 A 39 39 0 0 1 68 32 A 39 39 0 0 1 32 68 Z" fill={g} />
        <Path
          d="M41 59 Q 50 50 59 41"
          stroke={Colors.bg.surface}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          opacity={0.55}
        />
      </>
    ),
  },
  {
    label: 'Nudo',
    note: 'continuidad / lazo',
    render: (g) => (
      <Path
        d="M34 50 C 34 39, 47 39, 50 50 C 53 61, 66 61, 66 50 C 66 39, 53 39, 50 50 C 47 61, 34 61, 34 50 Z"
        {...stroke(g, { strokeWidth: 6.5 })}
      />
    ),
  },
  {
    label: 'Monograma K',
    note: 'inicial de Kai',
    render: (g) => (
      <>
        <Path d="M35 26 V 74" {...stroke(g, { strokeWidth: 8 })} />
        <Path d="M64 28 L 39 50 L 64 72" {...stroke(g, { strokeWidth: 8 })} />
        <Circle cx={66} cy={26} r={4} fill={g} />
      </>
    ),
  },
  {
    label: 'Diana',
    note: 'foco / precisión',
    render: (g) => (
      <>
        <Circle cx={50} cy={50} r={28} {...stroke(g, { strokeWidth: 5 })} />
        <Circle cx={50} cy={50} r={15} {...stroke(g, { strokeWidth: 5 })} />
        <Circle cx={50} cy={50} r={5.5} fill={g} />
      </>
    ),
  },
  {
    label: 'Vela',
    note: 'timing / viento',
    render: (g) => <Path d="M50 23 C 67 40 71 58 68 73 L 33 73 C 41 56 45 39 50 23 Z" fill={g} />,
  },
];

function Tile({ index, concept }: { index: number; concept: Concept }) {
  const gid = `kaiGold${index}`;
  return (
    <View style={styles.cell}>
      <View style={styles.tile}>
        <Svg width={78} height={78} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={GOLD_A} />
              <Stop offset="0.55" stopColor={GOLD_B} />
              <Stop offset="1" stopColor={GOLD_C} />
            </LinearGradient>
          </Defs>
          {concept.render(`url(#${gid})`)}
        </Svg>
      </View>
      <Text style={styles.label}>
        {index + 1}. {concept.label}
      </Text>
    </View>
  );
}

export default function KaiConcepts() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Kai — conceptos</Text>
      <Text style={styles.sub}>marcas estáticas de referencia · dime el número</Text>
      <View style={styles.grid}>
        {CONCEPTS.map((c, i) => (
          <Tile key={c.label} index={i} concept={c} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.void },
  content: { paddingTop: 40, paddingBottom: 32, paddingHorizontal: 14, alignItems: 'center' },
  h1: { ...Type.heading, color: Colors.ink.primary },
  sub: { ...Type.caption, color: Colors.ink.muted, marginTop: 4, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  cell: { width: 86, alignItems: 'center', marginBottom: 10 },
  tile: {
    width: 86,
    height: 86,
    borderRadius: 22,
    backgroundColor: Colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.22)',
    // Tight contact shadow — present, not floaty.
    shadowColor: '#7A5E22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    ...Type.micro,
    color: Colors.ink.primary,
    marginTop: 6,
    fontWeight: '600',
    textAlign: 'center',
  },
});
