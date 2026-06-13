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
import KaiOrb from '../onboarding/premium/KaiOrb';
import { journalHeader } from './homeHeader';
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
  /** Injectable clock for tests/previews. */
  now?: Date;
}

export default function KaiHome({
  name,
  proposal,
  blocks,
  onAcceptProposal,
  onDismissProposal,
  onOpenBlock,
  now,
}: KaiHomeProps) {
  const insets = useSafeAreaInsets();
  const { eyebrow, greeting } = journalHeader(now ?? new Date());
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.dateline}>{eyebrow}</Text>
      <Text style={styles.hi}>
        {greeting}
        {name ? `, ${name}` : ''}
        <Text style={styles.dot}>.</Text>
      </Text>
      {proposal ? (
        <>
          <Text style={styles.sub}>Mientras no estabas, Kai pensó esto.</Text>
          <View style={styles.proposalWrap}>
            <KaiProposalCard
              proposal={proposal}
              onAccept={onAcceptProposal}
              onDismiss={onDismissProposal}
            />
          </View>
        </>
      ) : (
        // Silence is a feature: a calm, present Kai instead of a filled screen.
        <View style={styles.quiet}>
          <KaiOrb size={26} />
          <Text style={styles.quietText}>Todo en orden. Hoy mandas tú.</Text>
        </View>
      )}

      <View style={styles.spaceHeader}>
        <Text style={styles.spaceEyebrow}>TU ESPACIO</Text>
        <Text style={styles.spaceCount}>{blocks.length}</Text>
      </View>

      <View style={styles.blocks}>
        {blocks.map((b, i) => (
          <BlockRow key={b.id} block={b} index={i + 1} onPress={() => onOpenBlock(b.id)} />
        ))}
      </View>
    </ScrollView>
  );
}

function BlockRow({
  block,
  index,
  onPress,
}: {
  block: HomeBlock;
  index: number;
  onPress: () => void;
}) {
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
      {/* Editorial catalogue index — "your space" as a curated collection, not a
          generic list with a chevron. */}
      <Text style={styles.blockIndex}>{String(index).padStart(2, '0')}</Text>
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

  dateline: { ...Type.eyebrow, color: Colors.gold.deep, marginBottom: Spacing.sm },
  hi: { fontFamily: Fonts.serifBlack, fontSize: 34, lineHeight: 40, color: Colors.ink.primary },
  dot: { color: Colors.gold.base },
  sub: { ...Type.body, fontSize: 16, color: Colors.ink.tertiary, marginBottom: Spacing.sm },

  proposalWrap: { marginBottom: Spacing.sm },
  quiet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  quietText: { ...Type.body, fontSize: 16, color: Colors.ink.tertiary },

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
  blockIndex: {
    fontFamily: Fonts.serifMedium,
    fontSize: 15,
    color: Colors.ink.muted,
    letterSpacing: 0.5,
    marginLeft: Spacing.sm,
  },
});
