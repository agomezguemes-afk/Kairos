// KAIROS — AI Chat Screen
// Conversational interface with Kai the AI assistant.
// Dispatches AI actions to the workout store and renders rich responses.

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import Animated, {
  FadeInUp,
  FadeInRight,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSequence,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import AIAvatar from '../components/AIAvatar';
import type { AvatarMood } from '../components/AIAvatar';
import KairosIcon from '../components/KairosIcon';
import { useGamification } from '../context/GamificationContext';
import { useMission } from '../context/MissionContext';
import { getInitialGreeting, type AIChatContext } from '../lib/ai/chat/greeting';
import { processGlobalChat, AIUnavailableError } from '../lib/ai/chat/globalChat';
import { getGlobalSuggestions } from '../lib/ai/chat/globalSuggestions';
import type { AgentProgressEvent } from '../lib/ai/agent';
import { QuotaExceededError } from '../lib/ai/client';
import { useAiQuota } from '../lib/ai/useAiQuota';
import QuotaExceededSheet from '../components/QuotaExceededSheet';
import type { RawUserContext } from '../utils/userContext';
import { generateId, getBlockExercises } from '../types/core';
import type { AIMessage } from '../types/ai';
import { useWorkoutStore } from '../store/workoutStore';
import { useUserProfile } from '../context/UserProfileContext';
import { useAuthStore } from '../store/useAuthStore';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/index';

export default function AIChatScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { streak, badges, prCards } = useGamification();
  const { activeMission } = useMission();
  const { profile: localProfile } = useUserProfile();
  const supabaseProfile = useAuthStore((s) => s.profile);
  // Prefer the Supabase profile (richer, synced) with local context as fallback
  const profile = supabaseProfile ?? localProfile;
  const scrollRef = useRef<ScrollView>(null);

  const setHighlight = useWorkoutStore((s) => s.setHighlight);

  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [avatarMood, setAvatarMood] = useState<AvatarMood>('idle');
  const [nodTrigger, setNodTrigger] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [runningTool, setRunningTool] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<QuotaExceededError | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingIdRef = useRef<string | null>(null);
  const quota = useAiQuota();

  // Build context for AI service — plain function, NOT a hook.
  // Reads blocks from the store's latest state to avoid stale captures.
  function buildCtx(): AIChatContext {
    const state = useWorkoutStore.getState();
    return {
      blocks: state.blocks,
      streak,
      badges,
      prCards,
      activeMission,
    };
  }

  // Raw context for the Groq service — includes profile for the RAG snapshot.
  function buildRawCtx(): RawUserContext {
    const state = useWorkoutStore.getState();
    return {
      profile,
      blocks: state.blocks,
      streak,
      prCards,
      badges,
      activeMission,
    };
  }

  // (Legacy session-reset removed: the new lib/ai chat is stateless — every
  // request is built from the live store snapshot + the local message list.)

  // Initial greeting
  useEffect(() => {
    if (isInitialized) return;
    setIsInitialized(true);

    const ctx = buildCtx();
    const greeting = getInitialGreeting(ctx);
    setMessages([
      {
        id: generateId(),
        role: 'assistant',
        content: greeting,
        timestamp: Date.now(),
      },
    ]);
  }, [isInitialized]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // ======================== SEND HANDLER ========================

  const handleSend = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || isLoading) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // 1. Optimistic user message
      const userMsg: AIMessage = {
        id: generateId(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      Keyboard.dismiss();
      setIsLoading(true);
      setAvatarMood('thinking');
      scrollToBottom();

      // 2. Build conversation history (last 6 turns max — handled inside the chat module)
      const history = messages
        .filter(
          (m): m is AIMessage & { role: 'user' | 'assistant' } =>
            m.role === 'user' || m.role === 'assistant',
        )
        .map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content });

      // Reserve an in-flight assistant bubble that streamed tokens write into.
      const streamingId = generateId();
      streamingIdRef.current = streamingId;
      setMessages((prev) => [
        ...prev,
        {
          id: streamingId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
        },
      ]);

      const appendDelta = (delta: string) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === streamingId ? { ...m, content: m.content + delta } : m)),
        );
      };

      const onProgress = (e: AgentProgressEvent) => {
        if (e.type === 'text_delta') appendDelta(e.delta);
        if (e.type === 'tool_running') setRunningTool(e.call.name);
        if (e.type === 'tool_result' || e.type === 'final_text') setRunningTool(null);
      };

      // 3. Call Groq. Failures surface as a visible system message — no fake fallbacks.
      // Tool calls commit to the store live via the agent loop.
      const controller = new AbortController();
      abortRef.current = controller;

      let aiResponse: AIMessage;
      let quotaHit: QuotaExceededError | null = null;
      try {
        aiResponse = await processGlobalChat(content, buildRawCtx(), history, {
          onProgress,
          signal: controller.signal,
        });
      } catch (e) {
        if (e instanceof QuotaExceededError) {
          // Surface the paywall sheet and roll back the streaming
          // bubble — we never even reached the model. The user's
          // optimistic message stays so they can resend after upgrade
          // or reset.
          quotaHit = e;
          aiResponse = {
            id: generateId(),
            role: 'assistant',
            content: '', // replaced by sheet — message itself is hidden below
            timestamp: Date.now(),
          };
        } else {
          const isUnavailable = e instanceof AIUnavailableError;
          const detail = e instanceof Error ? e.message : String(e);
          const isAborted = detail.toLowerCase().includes('aborted');
          aiResponse = {
            id: generateId(),
            role: 'assistant',
            content: isAborted
              ? 'Generación cancelada.'
              : isUnavailable
                ? `Kai no está disponible ahora mismo: ${detail}`
                : `Algo falló procesando tu mensaje (${detail}). Inténtalo de nuevo.`,
            timestamp: Date.now(),
          };
        }
      } finally {
        abortRef.current = null;
      }

      if (quotaHit) {
        // Open paywall + drop the empty streaming bubble so the chat
        // doesn't leave a placeholder behind.
        setMessages((prev) => prev.filter((m) => m.id !== streamingId));
        streamingIdRef.current = null;
        setIsLoading(false);
        setRunningTool(null);
        setAvatarMood('idle');
        setQuotaError(quotaHit);
        void quota.refresh();
        return;
      }

      if (aiResponse.affectedBlockId) {
        setHighlight(aiResponse.affectedBlockId);
      }

      // 4. Replace the streaming placeholder with the final assistant message.
      // We carry over toolResults / affectedBlockId from the resolved response,
      // and prefer the streamed content if the server returned an empty string
      // (defensive — happens when the model only made tool calls).
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === streamingId);
        if (idx === -1) return [...prev, aiResponse];
        const streamed = prev[idx];
        const merged: AIMessage = {
          ...aiResponse,
          id: streamed.id,
          content: aiResponse.content || streamed.content,
        };
        const next = prev.slice();
        next[idx] = merged;
        return next;
      });
      streamingIdRef.current = null;
      setIsLoading(false);
      setRunningTool(null);
      setAvatarMood('idle');
      setNodTrigger((n) => n + 1);
      scrollToBottom();
      // Pull the new count so the quota pill decrements in real time.
      // Fire-and-forget — failures here don't matter, the next message
      // will re-fetch anyway.
      void quota.refresh();
    },
    [input, isLoading, messages, setHighlight, scrollToBottom, profile, quota],
  );

  const handleStop = useCallback(() => {
    if (!abortRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    abortRef.current.abort();
    abortRef.current = null;
  }, []);

  // ======================== VIEW BLOCK HANDLER ========================

  const handleViewBlock = useCallback(
    (blockId: string) => {
      setHighlight(blockId);
      navigation.navigate('Dashboard', {
        screen: 'WorkoutTab',
        params: { highlightBlockId: blockId },
      });
    },
    [navigation, setHighlight],
  );

  // ======================== RENDER ========================

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.text.primary} />
        </Pressable>
        <AIAvatar size={32} mood={avatarMood} nodTrigger={nodTrigger} />
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Kai</Text>
          <Text style={styles.headerSub}>
            {runningTool ? `Ejecutando: ${runningTool}` : isLoading ? 'Pensando...' : 'En línea'}
          </Text>
        </View>
        {/* Quota pill — hidden while loading the first count, hidden for
            pro users who effectively have no visible cap. */}
        {!quota.isLoading && !quota.error && quota.tier === 'free' && (
          <Pressable
            onPress={() => {
              if (quota.remaining > 0) return;
              // Already at cap and they tapped the pill: open the
              // paywall sheet manually with synthesized payload so they
              // get the upgrade CTA without having to send a message.
              setQuotaError(
                new QuotaExceededError(
                  'free',
                  quota.dailyCap,
                  quota.usedToday,
                  new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
                  true,
                ),
              );
            }}
            style={styles.quotaPill}
          >
            <Feather name="zap" size={11} color={Colors.gold.deep} />
            <Text style={styles.quotaPillText}>
              {quota.remaining}/{quota.dailyCap}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && !isLoading && <SuggestedPrompts onSelect={handleSend} />}

        {messages.map((msg, i) =>
          msg.role === 'assistant' ? (
            <AssistantBubble key={msg.id} message={msg} index={i} onViewBlock={handleViewBlock} />
          ) : (
            <UserBubble key={msg.id} message={msg} index={i} />
          ),
        )}

        {/* Show typing dots ONLY while we wait for the first delta. Once
         *  tokens are flowing, the assistant bubble shows live progress. */}
        {isLoading &&
          (() => {
            const streamingId = streamingIdRef.current;
            if (!streamingId) return <TypingIndicator />;
            const m = messages.find((x) => x.id === streamingId);
            return m && m.content.length === 0 ? <TypingIndicator /> : null;
          })()}
      </ScrollView>

      {/* Suggested prompts when chat is empty and has greeting */}
      {messages.length === 1 && messages[0].role === 'assistant' && (
        <SuggestedPrompts onSelect={handleSend} />
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={styles.textInput}
          placeholder="Pregúntale a Kai..."
          placeholderTextColor={Colors.text.disabled}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => handleSend()}
          returnKeyType="send"
          multiline={false}
          editable={!isLoading}
        />
        {isLoading ? (
          <Pressable
            onPress={handleStop}
            style={({ pressed }) => [styles.sendBtn, styles.stopBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Detener generación"
          >
            <Feather name="square" size={16} color={Colors.text.inverse} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => handleSend()}
            disabled={!input.trim()}
            style={({ pressed }) => [
              styles.sendBtn,
              !input.trim() && styles.sendBtnDisabled,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Feather
              name="send"
              size={18}
              color={input.trim() ? Colors.text.inverse : Colors.text.disabled}
            />
          </Pressable>
        )}
      </View>

      {/* Paywall: rendered last so it sits above the input bar + keyboard */}
      <QuotaExceededSheet
        visible={quotaError !== null}
        payload={quotaError}
        onClose={() => setQuotaError(null)}
        onUpgrade={() => {
          // RevenueCat / StoreKit not wired yet — surface the intent so
          // the user knows where this goes. The button itself is a real
          // affordance so when the IAP ships the gesture stays the same.
          // TODO(Sprint 7 · Commit 4): present RevenueCat paywall.
          setQuotaError(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}

// ======================== INLINE MARKDOWN ========================

function InlineMarkdown({ text }: { text: string }) {
  // Split on **bold**, *italic*, and [icon_marker] patterns
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[a-z_]+\])/g);

  return (
    <View style={styles.inlineMarkdownRow}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={i} style={[styles.assistantText, { fontWeight: '700' }]}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return (
            <Text key={i} style={[styles.assistantText, { fontStyle: 'italic' }]}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        if (/^\[[a-z_]+\]$/.test(part)) {
          const iconName = part.slice(1, -1);
          return (
            <KairosIcon
              key={i}
              name={iconName}
              size={16}
              color={Colors.accent.primary}
              style={{ marginHorizontal: 2 }}
            />
          );
        }
        return (
          <Text key={i} style={styles.assistantText}>
            {part}
          </Text>
        );
      })}
    </View>
  );
}

// ======================== ACTION CARD ========================

function ActionCard({
  message,
  onViewBlock,
}: {
  message: AIMessage;
  onViewBlock: (id: string) => void;
}) {
  const tools = message.toolResults ?? [];
  const blockId = message.affectedBlockId;
  // Hooks must run unconditionally — read block first, gate the render below.
  const block = useWorkoutStore((s) => (blockId ? s.blocks.find((b) => b.id === blockId) : null));
  if (tools.length === 0 || !blockId) return null;

  const isCreate = tools.some((r) => r.ok && r.name === 'create_block');
  const iconName = isCreate ? 'sparkle' : 'arrow_forward';
  const title = isCreate ? 'Bloque creado' : 'Bloque actualizado';
  const subtitle = block
    ? `${block.name} · ${getBlockExercises(block).length} ejercicio${getBlockExercises(block).length !== 1 ? 's' : ''}`
    : 'Bloque procesado';

  return (
    <View style={styles.actionCard}>
      <View style={styles.actionCardHeader}>
        <KairosIcon name={iconName} size={20} color={Colors.accent.primary} />
        <View style={styles.actionCardText}>
          <Text style={styles.actionCardTitle}>{title}</Text>
          <Text style={styles.actionCardSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Pressable
        onPress={() => onViewBlock(blockId)}
        style={({ pressed }) => [styles.actionCardBtn, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.actionCardBtnText}>Ver bloque</Text>
        <Feather name="arrow-right" size={14} color={Colors.text.inverse} />
      </Pressable>
    </View>
  );
}

// ======================== BUBBLES ========================

function AssistantBubble({
  message,
  index,
  onViewBlock,
}: {
  message: AIMessage;
  index: number;
  onViewBlock: (id: string) => void;
}) {
  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(index * 50, 200)).duration(220)}
      style={styles.assistantRow}
    >
      <View style={styles.assistantBubble}>
        <InlineMarkdown text={message.content} />
      </View>
      <ActionCard message={message} onViewBlock={onViewBlock} />
    </Animated.View>
  );
}

function UserBubble({ message, index }: { message: AIMessage; index: number }) {
  return (
    <Animated.View entering={FadeInRight.delay(50).duration(220)} style={styles.userRow}>
      <View style={styles.userBubble}>
        <Text style={styles.userText}>{message.content}</Text>
      </View>
    </Animated.View>
  );
}

// ======================== TYPING INDICATOR ========================

function TypingIndicator() {
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.typingContainer}>
      <View style={styles.typingDots}>
        <BouncingDot delay={0} />
        <BouncingDot delay={150} />
        <BouncingDot delay={300} />
      </View>
    </Animated.View>
  );
}

function BouncingDot({ delay: d }: { delay: number }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      d,
      withRepeat(
        withSequence(withTiming(-4, { duration: 250 }), withTiming(0, { duration: 250 })),
        -1,
        false,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[styles.typingDot, style]} />;
}

// ======================== SUGGESTED PROMPTS ========================

function SuggestedPrompts({ onSelect }: { onSelect: (text: string) => void }) {
  const blocks = useWorkoutStore((s) => s.blocks);
  const suggestions = getGlobalSuggestions(blocks);
  return (
    <View style={styles.suggestedContainer}>
      {suggestions.map((s) => (
        <Pressable
          key={s.label}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSelect(s.prompt);
          }}
          style={({ pressed }) => [
            styles.suggestedChip,
            pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={styles.suggestedText}>{s.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ======================== STYLES ========================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background.void,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screen.horizontal,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.subtle,
    gap: Spacing.md,
  },
  backBtn: {
    marginRight: Spacing.xs,
  },
  headerTextContainer: { flex: 1 },
  quotaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.gold.glow,
  },
  quotaPillText: {
    fontSize: Typography.size.micro,
    fontWeight: Typography.weight.semibold,
    color: Colors.gold.deep,
    letterSpacing: 0.2,
  },
  headerTitle: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
  },
  headerSub: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
  },

  // Messages
  messages: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: Spacing.screen.horizontal,
    paddingVertical: Spacing.lg,
  },

  // Assistant bubble
  assistantRow: {
    marginBottom: Spacing.lg,
    paddingRight: 48,
  },
  assistantBubble: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    borderTopLeftRadius: Radius.xs,
    padding: Spacing.lg,
    ...Shadows.subtle,
  },
  inlineMarkdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  assistantText: {
    fontSize: Typography.size.body,
    color: Colors.text.primary,
    lineHeight: Typography.size.body * Typography.lineHeight.relaxed,
  },

  // User bubble
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Spacing.lg,
    paddingLeft: 48,
  },
  userBubble: {
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.lg,
    borderTopRightRadius: Radius.xs,
    padding: Spacing.lg,
  },
  userText: {
    fontSize: Typography.size.body,
    color: Colors.text.inverse,
    lineHeight: Typography.size.body * Typography.lineHeight.relaxed,
  },

  // Action card
  actionCard: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.subtle,
  },
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  actionCardIcon: {
    fontSize: 20,
    color: Colors.accent.primary,
  },
  actionCardText: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
  },
  actionCardSubtitle: {
    fontSize: Typography.size.micro,
    color: Colors.text.secondary,
    marginTop: 1,
  },
  actionCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accent.primary,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.sm,
  },
  actionCardBtnText: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.inverse,
  },

  // Typing indicator
  typingContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 5,
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    ...Shadows.subtle,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.text.tertiary,
  },

  // Suggested prompts
  suggestedContainer: {
    paddingHorizontal: Spacing.screen.horizontal,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  suggestedChip: {
    backgroundColor: Colors.background.surface,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: Radius.full,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  suggestedText: {
    fontSize: Typography.size.caption,
    color: Colors.text.secondary,
    textAlign: 'center',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screen.horizontal,
    paddingTop: Spacing.md,
    backgroundColor: Colors.background.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border.subtle,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.background.elevated,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: Typography.size.body,
    color: Colors.text.primary,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.background.elevated,
  },
  stopBtn: {
    backgroundColor: Colors.text.primary,
  },
});
