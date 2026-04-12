// KAIROS — AI Chat Screen
// Conversational interface with Kai the AI assistant.
// Messages are context-aware (mock) and persisted in session.

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
import { useGamification } from '../context/GamificationContext';
import { useMission } from '../context/MissionContext';
import {
  getResponse,
  getInitialGreeting,
  type ChatMessage,
  type AIChatContext,
} from '../services/aiChatService';
import { generateId } from '../types/core';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/index';

// We need blocks from somewhere — import from AsyncStorage directly
// since MissionContext already has the blocks dependency
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkoutBlock } from '../types/core';

const BLOCKS_STORAGE_KEY = 'kairos_blocks_v1';

export default function AIChatScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { streak, badges, prCards } = useGamification();
  const { activeMission } = useMission();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [avatarMood, setAvatarMood] = useState<AvatarMood>('idle');
  const [nodTrigger, setNodTrigger] = useState(0);
  const [blocks, setBlocks] = useState<WorkoutBlock[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load blocks for context
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(BLOCKS_STORAGE_KEY);
        if (raw) setBlocks(JSON.parse(raw));
      } catch {}
      setIsInitialized(true);
    })();
  }, []);

  // Initial greeting
  useEffect(() => {
    if (!isInitialized) return;

    const ctx = buildContext();
    const greeting = getInitialGreeting(ctx);
    setMessages([
      {
        id: generateId(),
        role: 'assistant',
        text: greeting,
        timestamp: new Date().toISOString(),
      },
    ]);
  }, [isInitialized]);

  const buildContext = useCallback((): AIChatContext => ({
    blocks,
    streak,
    badges,
    prCards,
    activeMission,
  }), [blocks, streak, badges, prCards, activeMission]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');

    // Add user message
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setAvatarMood('thinking');

    // Simulate AI "thinking" delay
    setTimeout(() => {
      const ctx = buildContext();
      const response = getResponse(text, ctx);

      const aiMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        text: response,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMsg]);
      setAvatarMood('idle');
      setNodTrigger((n) => n + 1);

      // Scroll to bottom
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, 600 + Math.random() * 800);

    // Scroll to bottom for user message
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
  }, [input, buildContext]);

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
            {avatarMood === 'thinking' ? 'Pensando...' : 'En línea'}
          </Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((msg, i) =>
          msg.role === 'assistant' ? (
            <AssistantBubble key={msg.id} text={msg.text} index={i} />
          ) : (
            <UserBubble key={msg.id} text={msg.text} index={i} />
          ),
        )}

        {avatarMood === 'thinking' && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.typingContainer}>
            <View style={styles.typingDots}>
              <TypingDot delay={0} />
              <TypingDot delay={200} />
              <TypingDot delay={400} />
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={styles.textInput}
          placeholder="Pregúntale a Kai..."
          placeholderTextColor={Colors.text.disabled}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          multiline={false}
        />
        <Pressable
          onPress={handleSend}
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
      </View>
    </KeyboardAvoidingView>
  );
}

// ======================== BUBBLES ========================

function AssistantBubble({ text, index }: { text: string; index: number }) {
  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(index * 50, 200)).duration(350)}
      style={styles.assistantRow}
    >
      <View style={styles.assistantBubble}>
        <Text style={styles.assistantText}>{text}</Text>
      </View>
    </Animated.View>
  );
}

function UserBubble({ text, index }: { text: string; index: number }) {
  return (
    <Animated.View
      entering={FadeInRight.delay(50).duration(300)}
      style={styles.userRow}
    >
      <View style={styles.userBubble}>
        <Text style={styles.userText}>{text}</Text>
      </View>
    </Animated.View>
  );
}

// ======================== TYPING DOTS ========================

function TypingDot({ delay: d }: { delay: number }) {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withDelay(
      d,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0.3, { duration: 300 }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.typingDot, animatedStyle]} />;
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
  headerTextContainer: {},
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
    flexDirection: 'row',
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

  // Typing indicator
  typingContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
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
});
