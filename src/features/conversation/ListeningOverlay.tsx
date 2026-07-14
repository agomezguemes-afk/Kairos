// KAIROS — Listening state (Design v2, pattern 3 "estado de escucha a pantalla
// completa"). This IS the visual language of M3 push-to-talk, built now so the
// layout ships before the voice pipeline: a near-empty canvas, the live
// transcript in giant Fraunces as it arrives, a small orb + "Escuchando…" at
// the foot, and a cancel affordance. Voice isn't wired yet — the component is
// driven purely by a `transcript` string, so M3 only has to feed it.
//
// See __ListeningPreview.tsx for a storybook-style dev harness and
// listeningDisplay.ts (unit-tested) for the empty→content logic.

import React, { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import KaiOrb from '../onboarding/premium/KaiOrb';
import { Animation, Colors, Radius, Spacing, Type } from '../../theme/tokens';
import { listeningDisplay } from './listeningDisplay';

interface Props {
  visible: boolean;
  /** Live transcript from the STT layer (M3). Empty → the calm invitation. */
  transcript: string;
  onCancel: () => void;
}

function ListeningOverlay({ visible, transcript, onCancel }: Props) {
  // Announce the mode once when it opens; the transcript itself is a live region.
  useEffect(() => {
    if (!visible) return;
    AccessibilityInfo.announceForAccessibility('Escuchando.');
  }, [visible]);

  if (!visible) return null;

  const { text, isPlaceholder } = listeningDisplay(transcript);

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onCancel();
  };

  return (
    <Animated.View
      entering={FadeIn.duration(Animation.duration.normal)}
      exiting={FadeOut.duration(Animation.duration.fast)}
      style={styles.fill}
      pointerEvents="auto"
    >
      <InnerCanvas text={text} isPlaceholder={isPlaceholder} onCancel={handleCancel} />
    </Animated.View>
  );
}

function InnerCanvas({
  text,
  isPlaceholder,
  onCancel,
}: {
  text: string;
  isPlaceholder: boolean;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <>
      {/* Cancel — top trailing, out of the way of the words. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancelar"
        accessibilityHint="Cierra la escucha sin enviar nada"
        onPress={onCancel}
        hitSlop={12}
        style={[styles.cancel, { top: insets.top + Spacing.sm }]}
      >
        <Feather name="x" size={22} color={Colors.ink.tertiary} />
      </Pressable>

      {/* Live transcript — the giant editorial block. */}
      <View style={[styles.transcriptWrap, { paddingTop: insets.top + Spacing['3xl'] * 2 }]}>
        <Text
          style={[styles.transcript, isPlaceholder && styles.transcriptPlaceholder]}
          accessibilityLiveRegion="polite"
          accessibilityLabel={isPlaceholder ? 'Escuchando' : text}
          maxFontSizeMultiplier={1.3}
        >
          {text}
        </Text>
      </View>

      {/* Foot — small orb + status, centred. */}
      <View style={[styles.foot, { paddingBottom: insets.bottom + Spacing['2xl'] }]}>
        <View style={styles.orb} pointerEvents="none">
          <KaiOrb size={22} thinking />
        </View>
        <Text style={styles.status}>Escuchando…</Text>
      </View>
    </>
  );
}

export default React.memo(ListeningOverlay);

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bg.void,
    zIndex: 100,
  },
  cancel: {
    position: 'absolute',
    right: Spacing.screen.horizontal - Spacing.sm,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  transcriptWrap: {
    flex: 1,
    paddingHorizontal: Spacing.screen.horizontal,
  },
  transcript: {
    ...Type.title,
    fontSize: 34,
    lineHeight: 40,
    color: Colors.ink.primary,
  },
  transcriptPlaceholder: {
    color: Colors.ink.muted,
  },
  foot: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  orb: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    ...Type.caption,
    color: Colors.ink.tertiary,
  },
});
