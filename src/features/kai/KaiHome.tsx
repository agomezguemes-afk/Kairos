// KAIROS — KaiHome: the reframed home. "Your space, kept alive by Kai."
//
// Not a metrics dashboard. A calm space that shows: who you are (greeting), the
// ONE thing Kai thought while you were away (a proposal, or silence), and a
// glimpse of your living ecosystem (your blocks). Presentational — the real Home
// wires data + navigation; this composes the experience so the direction is
// reviewable now. Editorial identity, physical motion, no slide.

import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Shadows, Spacing, Type } from '../../theme/tokens';
import { Fonts } from '../../theme/fonts';
import { useTactile } from '../onboarding/premium/motion/useTactile';
import KaiProposalCard from './KaiProposalCard';
import type { Proposal } from './proposal';

export interface HomeBlock {
  id: string;
  name: string;
  discipline: keyof typeof Colors.discipline;
  /** e.g. "4 ejercicios · ayer". */
  meta?: string;
}

interface KaiHomeProps {
  name: string | null;
  /** The single proposal Kai surfaces today (or null = Kai is silent). */
  proposal: Proposal | null;
  blocks: HomeBlock[];
  onAcceptProposal: (p: Proposal) => void;
  onDismissProposal: (p: Proposal) => void;
  onOpenBlock: (id: string) => void;
}

export default function KaiHome({
  name,
  proposal,
  blocks,
  onAcceptProposal,
  onDismissProposal,
  onOpenBlock,
}: KaiHomeProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.hi}>
        Hola{name ? `, ${name}` : ''}
        <Text style={styles.dot}>.</Text>
      </Text>
      <Text style={styles.sub}>
        {proposal
          ? 'Mientras no estabas, Kai pensó esto.'
          : 'Tu espacio está en orden. Hoy decides tú.'}
      </Text>

      {proposal ? (
        <View style={styles.proposalWrap}>
          <KaiProposalCard
            proposal={proposal}
            onAccept={onAcceptProposal}
            onDismiss={onDismissProposal}
          />
        </View>
      ) : null}

      <View style={styles.spaceHeader}>
        <Text style={styles.spaceEyebrow}>TU ESPACIO</Text>
        <Text style={styles.spaceCount}>{blocks.length}</Text>
      </View>

      <View style={styles.blocks}>
        {blocks.map((b) => (
          <BlockRow key={b.id} block={b} onPress={() => onOpenBlock(b.id)} />
        ))}
      </View>
    </ScrollView>
  );
}

function BlockRow({ block, onPress }: { block: HomeBlock; onPress: () => void }) {
  const { animatedStyle, onPressIn, onPressOut } = useTactile({ pressTo: 0.985 });
  const accent = Colors.discipline[block.discipline] ?? Colors.gold.base;
  return (
    <AnimatedRow
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.block, animatedStyle]}
    >
      <View style={[styles.blockTag, { backgroundColor: accent }]} />
      <View style={styles.blockText}>
        <Text style={styles.blockName} numberOfLines={1}>
          {block.name}
        </Text>
        {block.meta ? <Text style={styles.blockMeta}>{block.meta}</Text> : null}
      </View>
      <Text style={styles.chev}>›</Text>
    </AnimatedRow>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
function AnimatedRow({
  children,
  onPress,
  onPressIn,
  onPressOut,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  style: React.ComponentProps<typeof AnimatedPressable>['style'];
}) {
  const handle = useCallback(() => onPress(), [onPress]);
  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPress={handle}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={style}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.void },
  content: { paddingHorizontal: Spacing.screen.horizontal, paddingBottom: 96, gap: Spacing.md },

  hi: { fontFamily: Fonts.serifBlack, fontSize: 34, lineHeight: 38, color: Colors.ink.primary },
  dot: { color: Colors.gold.base },
  sub: { ...Type.body, fontSize: 16, color: Colors.ink.tertiary, marginBottom: Spacing.sm },

  proposalWrap: { marginBottom: Spacing.sm },

  spaceHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  spaceEyebrow: { ...Type.eyebrow, color: Colors.ink.muted },
  spaceCount: { ...Type.numSmall, color: Colors.ink.muted },

  blocks: { gap: Spacing.sm },
  block: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    ...Shadows.subtle,
  },
  blockTag: { width: 4, height: 32, borderRadius: 2 },
  blockText: { flex: 1, gap: 2 },
  blockName: { ...Type.subheading, color: Colors.ink.primary },
  blockMeta: { ...Type.caption, color: Colors.ink.muted },
  chev: { fontSize: 22, color: Colors.ink.muted, marginLeft: Spacing.xs },
});
