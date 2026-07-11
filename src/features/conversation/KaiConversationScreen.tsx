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
  FadeInRight,
  FadeInUp,
  useAnimatedStyle,
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
import { Colors, Radius, Shadows, Spacing, Type } from '../../theme/tokens';
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
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [state.messages.length, state.phase, scrollToEnd]);

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

  const busyThinking = state.phase === 'thinking';
  const showStreaming = busyThinking && (state.streamingText?.length ?? 0) > 0;
  const showTyping = busyThinking && !showStreaming;
  const showSuggestions = state.messages.length === 0 && state.canSend;

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
          hitSlop={12}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={22} color={Colors.ink.primary} />
        </Pressable>
        <KaiOrb size={26} thinking={state.phase === 'thinking' || state.phase === 'building'} />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Kai</Text>
          <Text style={styles.headerSub}>{subtitleFor(state.phase)}</Text>
        </View>
      </View>

      {/* Conversation */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <KaiBubble text={GREETING} />

        {state.messages.map((m) =>
          m.role === 'kai' ? (
            <KaiBubble key={m.id} text={m.text} />
          ) : (
            <UserBubble key={m.id} text={m.text} />
          ),
        )}

        {showStreaming ? <KaiBubble text={state.streamingText ?? ''} /> : null}
        {showTyping ? <TypingDots /> : null}
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
            onPress={retry}
            style={({ pressed }) => [styles.retryPill, pressed && { opacity: 0.7 }]}
          >
            <Feather name="rotate-ccw" size={13} color={Colors.ink.secondary} />
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
            onPress={() => handleSend()}
            disabled={!state.canSend || input.trim().length === 0}
            style={({ pressed }) => [
              styles.sendBtn,
              (!state.canSend || input.trim().length === 0) && styles.sendBtnDisabled,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Feather
              name="arrow-up"
              size={18}
              color={
                state.canSend && input.trim().length > 0 ? Colors.ink.primary : Colors.ink.muted
              }
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

const KaiBubble = React.memo(function KaiBubble({ text }: { text: string }) {
  return (
    <Animated.View entering={FadeInUp.duration(220)} style={styles.kaiRow}>
      <View style={styles.kaiBubble}>
        <Text style={styles.kaiText}>{text}</Text>
      </View>
    </Animated.View>
  );
});

const UserBubble = React.memo(function UserBubble({ text }: { text: string }) {
  return (
    <Animated.View entering={FadeInRight.duration(220)} style={styles.userRow}>
      <View style={styles.userBubble}>
        <Text style={styles.userText}>{text}</Text>
      </View>
    </Animated.View>
  );
});

// ======================== INDICATORS ========================

function BuildingRow() {
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.buildingRow}>
      <KaiOrb size={18} thinking />
      <Text style={styles.buildingText}>Montando tu bloque…</Text>
    </Animated.View>
  );
}

function TypingDots() {
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.typingRow}>
      <View style={styles.typingBubble}>
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </View>
    </Animated.View>
  );
}

function Dot({ delay }: { delay: number }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(-4, { duration: 250 }), withTiming(0, { duration: 250 })),
        -1,
        false,
      ),
    );
  }, [delay, translateY]);

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
    gap: Spacing.md,
    paddingHorizontal: Spacing.screen.horizontal,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hair.subtle,
  },
  backBtn: {
    marginRight: Spacing.xs,
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
    paddingRight: 48,
  },
  kaiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.bg.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
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
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Spacing.md,
    paddingLeft: 48,
  },
  userBubble: {
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.lg,
    borderTopRightRadius: Radius.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  userText: {
    ...Type.body,
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
    gap: 5,
    backgroundColor: Colors.bg.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    ...Shadows.subtle,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.ink.muted,
  },

  retryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    backgroundColor: Colors.bg.elevated,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gold.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.bg.elevated,
  },
});
