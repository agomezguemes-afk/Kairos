// KAIROS — "Hoy" conversational surface: Kai builds today's block from a
// sentence.
//
// The M1 loop end-to-end: free text in → adaptive dialogue (the engine asks
// only what's missing, max 2 questions) → block committed to the store → the
// user lands on it ready to start. All conversation logic lives in
// useConversationSession; this screen renders bubbles, streaming, the
// building moment, and the block-ready card.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import KaiOrb from '../onboarding/premium/KaiOrb';
import type { ConversationPhase } from '../../lib/ai/conversation';
import { useWorkoutStore } from '../../store/workoutStore';
import { Animation, Colors, Radius, Shadows, Spacing, Type } from '../../theme/tokens';
import type { RootStackParamList } from '../../types/navigation';
import { todayISO } from '../planner/lib/dates';
import BlockReadyCard from './BlockReadyCard';
import { useConversationSession } from './useConversationSession';

// Kai's opener (voice: docs/KAI_VOICE.md — plain, warm, zero assistant-speak).
const GREETING = 'Cuéntame qué te apetece hoy. Con una frase me vale.';

// Concrete, sendable examples. The third one exercises the hybrid fast-path.
const SUGGESTIONS = ['Piernas en casa, 40 min', 'Algo suave, media hora', 'Una carrera híbrida'];

function subtitleFor(phase: ConversationPhase): string {
  switch (phase) {
    case 'thinking':
      return 'Pensando…';
    case 'building':
      return 'Montando tu bloque…';
    case 'done':
      return 'Bloque listo';
    default:
      return 'Hoy';
  }
}

export default function KaiConversationScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);

  const { state, send, retry, reset } = useConversationSession();
  const reduceMotion = useReducedMotion();
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const scrollToEnd = useCallback(() => {
    // Defer past the layout pass so the freshly-mounted bubble is measured.
    setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: !reduceMotion }),
      Animation.duration.instant,
    );
  }, [reduceMotion]);

  useEffect(() => {
    scrollToEnd();
  }, [state.messages.length, state.phase, scrollToEnd]);

  // Keep the tail in view when the keyboard opens mid-conversation (iOS
  // Messages behaviour) — otherwise the last bubble hides behind the input.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', scrollToEnd);
    return () => sub.remove();
  }, [scrollToEnd]);

  // Async state is otherwise silent for VoiceOver: announce each transition and
  // fire the terminal error haptic. The block-ready announcement lives below so
  // it can name the block.
  const prevPhaseRef = useRef<ConversationPhase | null>(null);
  useEffect(() => {
    const phase = state.phase;
    if (prevPhaseRef.current === phase) return;
    prevPhaseRef.current = phase;
    if (phase === 'thinking') {
      AccessibilityInfo.announceForAccessibility('Kai está pensando.');
    } else if (phase === 'building') {
      AccessibilityInfo.announceForAccessibility('Montando tu bloque.');
    } else if (phase === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      AccessibilityInfo.announceForAccessibility('Algo se ha torcido. Puedes reintentar.');
    }
  }, [state.phase]);

  useEffect(() => {
    if (state.result) {
      const memory = state.result.enrichedFromHistory ? ' Con tus números de la última vez.' : '';
      AccessibilityInfo.announceForAccessibility(
        `Bloque listo: ${state.result.blockName}.${memory}`,
      );
    }
  }, [state.result]);

  const handleSend = useCallback(
    (text?: string) => {
      const content = (text ?? input).trim();
      if (content.length === 0 || !state.canSend) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setInput('');
      Keyboard.dismiss();
      send(content);
    },
    [input, state.canSend, send],
  );

  const handleStart = useCallback(() => {
    const result = state.result;
    if (!result) return;
    const block = useWorkoutStore.getState().blocks.find((b) => b.id === result.blockId);
    if (!block) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const ctx = { scheduledDate: todayISO(), source: 'today' as const };
    startWorkout(result.blockId, ctx);
    // Replace: back from the workout should land on Home, not a stale chat.
    nav.replace('ActiveWorkout', { blockId: result.blockId, ...ctx });
  }, [state.result, startWorkout, nav]);

  const handleView = useCallback(() => {
    const result = state.result;
    if (!result) return;
    nav.navigate('BlockDetail', { blockId: result.blockId });
  }, [state.result, nav]);

  const handleAskAgain = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    reset();
  }, [reset]);

  const handleRetry = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    retry();
  }, [retry]);

  const busyThinking = state.phase === 'thinking';
  const showStreaming = busyThinking && (state.streamingText?.length ?? 0) > 0;
  const showTyping = busyThinking && !showStreaming;
  const showSuggestions = state.messages.length === 0 && state.canSend;
  const canSend = state.canSend && input.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => nav.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 16, right: 12 }}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={22} color={Colors.ink.primary} />
        </Pressable>
        {/* Decorative orb: its halo is 1.5× the glyph and sits next to the back
            button — pointerEvents="none" so it can never intercept a back tap
            (bug: the back button "resisted" taps because the halo overlapped it). */}
        <View
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          pointerEvents="none"
          style={styles.headerOrb}
        >
          <KaiOrb size={26} thinking={state.phase === 'thinking' || state.phase === 'building'} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Kai</Text>
          <Text style={styles.headerSub} accessibilityLiveRegion="polite">
            {subtitleFor(state.phase)}
          </Text>
        </View>
      </View>

      {/* Conversation */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <KaiBubble text={GREETING} />

        {state.messages.map((m) =>
          m.role === 'kai' ? (
            <KaiBubble key={m.id} text={m.text} />
          ) : (
            <UserStatement key={m.id} text={m.text} />
          ),
        )}

        {showStreaming ? <KaiBubble text={state.streamingText ?? ''} /> : null}
        {showTyping ? <TypingDots reduce={reduceMotion} /> : null}
        {state.phase === 'building' ? <BuildingRow /> : null}

        {state.result ? (
          <BlockReadyCard
            session={state.result}
            onStart={handleStart}
            onView={handleView}
            onAskAgain={handleAskAgain}
          />
        ) : null}

        {state.phase === 'error' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reintentar"
            accessibilityHint="Vuelve a enviar tu último mensaje a Kai"
            onPress={handleRetry}
            style={({ pressed }) => [styles.retryPill, pressed && { opacity: 0.7 }]}
          >
            <Feather name="rotate-ccw" size={14} color={Colors.ink.secondary} />
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* Suggestions — only before the first message. */}
      {showSuggestions ? (
        <View style={styles.suggestions}>
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityLabel={s}
              accessibilityHint="Envía esta idea a Kai"
              onPress={() => handleSend(s)}
              style={({ pressed }) => [styles.suggestionChip, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.suggestionText}>{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Input bar — retired once the block is ready (the card owns the CTAs). */}
      {state.result === null ? (
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
          <TextInput
            style={styles.textInput}
            placeholder="Dile a Kai qué te apetece…"
            placeholderTextColor={Colors.ink.muted}
            accessibilityLabel="Mensaje para Kai"
            accessibilityHint="Describe en una frase qué te apetece entrenar hoy"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
            editable={state.canSend}
            autoFocus
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            accessibilityState={{ disabled: !canSend }}
            onPress={() => handleSend()}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.sendBtn,
              !canSend && styles.sendBtnDisabled,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Feather
              name="arrow-up"
              size={18}
              color={canSend ? Colors.ink.inverse : Colors.ink.muted}
            />
          </Pressable>
        </View>
      ) : (
        <View style={{ paddingBottom: Math.max(insets.bottom, Spacing.md) }} />
      )}
    </KeyboardAvoidingView>
  );
}

// ======================== BUBBLES ========================

// Kai bubbles crossfade (opacity only) so a streamed reply settling into its
// committed twin never jumps vertically — the text stays legible mid-read.
const KaiBubble = React.memo(function KaiBubble({ text }: { text: string }) {
  return (
    <Animated.View entering={FadeIn.duration(Animation.duration.fast)} style={styles.kaiRow}>
      <View style={styles.kaiBubble}>
        <Text style={styles.kaiText}>{text}</Text>
      </View>
    </Animated.View>
  );
});

// The user's words are the content — so they render as a large editorial
// statement (Fraunces, ink), not a chat bubble. Kai answers quietly below; the
// person's intent is what the screen is about. Rises in from just below (it was
// "sent" from the input at the bottom). Reanimated defaults to
// ReduceMotion.System, so this softens to a crossfade under Reduce Motion.
const UserStatement = React.memo(function UserStatement({ text }: { text: string }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(Animation.duration.normal)}
      style={styles.userStatementRow}
    >
      <Text style={styles.userStatement} maxFontSizeMultiplier={1.4}>
        {text}
      </Text>
    </Animated.View>
  );
});

// ======================== INDICATORS ========================

const DOT_RISE = 4; // px a typing dot lifts at the peak of its bob

function BuildingRow() {
  return (
    <Animated.View
      entering={FadeIn.duration(Animation.duration.fast)}
      style={styles.buildingRow}
      accessibilityLabel="Montando tu bloque"
    >
      <KaiOrb size={18} thinking />
      <Text style={styles.buildingText}>Montando tu bloque…</Text>
    </Animated.View>
  );
}

function TypingDots({ reduce }: { reduce: boolean }) {
  return (
    <Animated.View
      entering={FadeIn.duration(Animation.duration.fast)}
      style={styles.typingRow}
      accessibilityLabel="Kai está escribiendo"
    >
      <View style={styles.typingBubble}>
        <Dot delay={0} reduce={reduce} />
        <Dot delay={Animation.duration.fast} reduce={reduce} />
        <Dot delay={Animation.duration.fast * 2} reduce={reduce} />
      </View>
    </Animated.View>
  );
}

function Dot({ delay, reduce }: { delay: number; reduce: boolean }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    // Reduce Motion: hold three steady dots instead of a bouncing loop.
    if (reduce) return;
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-DOT_RISE, { duration: Animation.duration.normal }),
          withTiming(0, { duration: Animation.duration.normal }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, reduce, translateY]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  return <Animated.View style={[styles.typingDot, style]} />;
}

// ======================== STYLES ========================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg.void,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.screen.horizontal,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hair.subtle,
    zIndex: 10, // keep the header (and its back button) above the scroll content
  },
  // Full 44pt target, pulled left so the glyph still hugs the screen edge.
  backBtn: {
    width: 44,
    height: 44,
    marginLeft: -Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Boxed so the oversized orb halo is clipped and can't bleed onto the back button.
  headerOrb: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    ...Type.subheading,
    color: Colors.ink.primary,
  },
  headerSub: {
    ...Type.micro,
    color: Colors.ink.tertiary,
  },

  messages: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: Spacing.screen.horizontal,
    paddingVertical: Spacing.lg,
  },

  kaiRow: {
    marginBottom: Spacing.md,
    // Opposite-side gutter so a bubble never spans full width (sender stays clear).
    paddingRight: Spacing['2xl'] * 2,
  },
  // No border: white on warm paper (v3 §3a). Kai's voice is a card that lifts.
  kaiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.paper.raised,
    borderRadius: Radius.lg,
    borderTopLeftRadius: Radius.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    ...Shadows.subtle,
  },
  kaiText: {
    ...Type.body,
    color: Colors.ink.primary,
  },
  // The user's utterance as a headline: full-bleed editorial statement, extra
  // air above so it reads as a new "chapter", not a reply.
  userStatementRow: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  userStatement: {
    ...Type.title,
    color: Colors.ink.primary,
  },

  buildingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  buildingText: {
    ...Type.caption,
    color: Colors.ink.tertiary,
  },
  typingRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.paper.raised,
    borderRadius: Radius.lg,
    borderTopLeftRadius: Radius.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    ...Shadows.subtle,
  },
  typingDot: {
    width: 7, // decorative dot glyph — sized in px, not a spacing rhythm
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.ink.muted,
  },

  retryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.sm,
    minHeight: 44, // HIG minimum tappable target
    backgroundColor: Colors.bg.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    borderRadius: Radius.full,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
  },
  retryText: {
    ...Type.caption,
    color: Colors.ink.secondary,
  },

  suggestions: {
    paddingHorizontal: Spacing.screen.horizontal,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  suggestionChip: {
    minHeight: 44, // HIG minimum tappable target
    justifyContent: 'center',
    backgroundColor: Colors.bg.surface,
    borderWidth: 1,
    borderColor: Colors.hair.base,
    borderRadius: Radius.full,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  suggestionText: {
    ...Type.caption,
    color: Colors.ink.secondary,
    textAlign: 'center',
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.screen.horizontal,
    paddingTop: Spacing.md,
    backgroundColor: Colors.bg.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.hair.subtle,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Type.body,
    color: Colors.ink.primary,
  },
  sendBtn: {
    width: 44, // HIG minimum tappable target
    height: 44,
    borderRadius: 22,
    // Ink, not gold: the single gold on this screen is the Kai orb in the header.
    backgroundColor: Colors.ink.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.bg.elevated,
  },
});
