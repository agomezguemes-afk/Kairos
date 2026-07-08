// KAIROS — KaiProposalCard: the face of assisted autonomy.
//
// This is where "Kai thinks for you, you decide" becomes visible. A calm card —
// the resident companion (orb) surfaces ONE proposal it reasoned out while you
// were away, and you accept or dismiss. Never a pushy notification; at most one
// of these shows at a time (silence > noise). Premium editorial identity, physical
// motion, no slide.

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Shadows, Spacing, Type } from '../../theme/tokens';
import KaiOrb from '../onboarding/premium/KaiOrb';
import { useTactile } from '../onboarding/premium/motion/useTactile';
import type { Proposal, ProposalTone } from './proposal';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const TONE_EYEBROW: Record<ProposalTone, string> = {
  focus: 'KAI · IDEA',
  progress: 'KAI · PROGRESO',
  recover: 'KAI · RECUPERACIÓN',
  celebrate: 'KAI · LOGRO',
};

interface KaiProposalCardProps {
  proposal: Proposal;
  onAccept: (p: Proposal) => void;
  onDismiss: (p: Proposal) => void;
}

function KaiProposalCard({ proposal, onAccept, onDismiss }: KaiProposalCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <KaiOrb size={30} />
        <Text style={styles.eyebrow}>{TONE_EYEBROW[proposal.tone]}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Descartar"
          hitSlop={10}
          onPress={() => onDismiss(proposal)}
          style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}
        >
          <Text style={styles.dismissX}>✕</Text>
        </Pressable>
      </View>

      <Text style={styles.headline}>{proposal.headline}</Text>
      <Text style={styles.detail}>{proposal.detail}</Text>

      <View style={styles.actions}>
        <AcceptButton label={proposal.acceptLabel} onPress={() => onAccept(proposal)} />
        <Pressable
          accessibilityRole="button"
          onPress={() => onDismiss(proposal)}
          style={({ pressed }) => [styles.later, pressed && styles.laterPressed]}
        >
          <Text style={styles.laterText}>Ahora no</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AcceptButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { animatedStyle, onPressIn, onPressOut } = useTactile({ pressTo: 0.95 });
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  }, [onPress]);
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.accept, animatedStyle]}
    >
      <Text style={styles.acceptText}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg.warm,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.gold.light,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  eyebrow: { ...Type.eyebrow, color: Colors.gold.deep, flex: 1 },
  dismiss: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  dismissPressed: { opacity: 0.5 },
  dismissX: { fontSize: 14, color: Colors.ink.muted },

  headline: { ...Type.titleSmall, color: Colors.ink.primary, marginBottom: Spacing.xs },
  detail: { ...Type.body, color: Colors.ink.tertiary, marginBottom: Spacing.lg },

  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  accept: {
    height: 44,
    paddingHorizontal: Spacing.xl,
    borderRadius: 14,
    backgroundColor: '#AC8941',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: { ...Type.bodyEmph, color: Colors.ink.inverse, letterSpacing: 0.2 },
  later: {
    height: 44,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterPressed: { opacity: 0.5 },
  laterText: { ...Type.bodyEmph, color: Colors.ink.muted },
});

export default React.memo(KaiProposalCard);
