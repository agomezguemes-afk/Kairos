import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Dimensions,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { WorkoutBlock } from '../../../types/core';
import type { AIMessage, AIAction } from '../../../types/ai';
import { generateId } from '../../../types/core';
import { useWorkoutStore } from '../../../store/workoutStore';
import { useGamification } from '../../../context/GamificationContext';
import { useUserProfile } from '../../../context/UserProfileContext';
import { processBlockMessage, getBlockSuggestions } from '../../../services/blockAIService';
import { generateWorkoutPlan } from '../../../lib/ai/coach';
import type { RawUserContext } from '../../../utils/userContext';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../../theme/index';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = SCREEN_H * 0.65;
const TIMING_IN = { duration: 300, easing: Easing.out(Easing.cubic) };
const TIMING_OUT = { duration: 220, easing: Easing.in(Easing.cubic) };

interface BlockAISheetProps {
  visible: boolean;
  block: WorkoutBlock;
  onClose: () => void;
}

export default function BlockAISheet({ visible, block, onClose }: BlockAISheetProps) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [planForm, setPlanForm] = useState<{ open: boolean; objetivo: string; dias: string; duracion: string; lesiones: string }>({
    open: false, objetivo: '', dias: '3', duracion: '45', lesiones: '',
  });
  const [generating, setGenerating] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const dispatchAIActions = useWorkoutStore(s => s.dispatchAIActions);
  const blocks = useWorkoutStore(s => s.blocks);
  const { profile } = useUserProfile();
  const { streak, badges, prCards } = useGamification();

  const translateY = useSharedValue(SHEET_H);
  const backdropOp = useSharedValue(0);

  const suggestions = useMemo(() => getBlockSuggestions(block), [block]);

  const conversationHistory = useMemo(() =>
    messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
    [messages],
  );

  const buildContext = useCallback((): RawUserContext => ({
    profile,
    blocks,
    streak,
    prCards,
    badges,
    activeMission: null,
  }), [profile, blocks, streak, prCards, badges]);

  useEffect(() => {
    if (visible) {
      backdropOp.value = withTiming(1, TIMING_IN);
      translateY.value = withTiming(0, TIMING_IN);
    }
  }, [visible, backdropOp, translateY]);

  const animateOut = useCallback((cb?: () => void) => {
    backdropOp.value = withTiming(0, TIMING_OUT);
    translateY.value = withTiming(SHEET_H, TIMING_OUT, () => {
      if (cb) runOnJS(cb)();
    });
  }, [backdropOp, translateY]);

  const handleClose = useCallback(() => {
    animateOut(onClose);
  }, [animateOut, onClose]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || thinking) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');

    const userMsg: AIMessage = {
      id: generateId(),
      role: 'user',
      content: msg,
      actions: [],
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setThinking(true);
    scrollToBottom();

    try {
      const freshBlock = useWorkoutStore.getState().blocks.find(b => b.id === block.id) ?? block;
      const ctx = buildContext();
      const response = await processBlockMessage(msg, freshBlock, ctx, conversationHistory);

      if (response.actions.length > 0) {
        dispatchAIActions(response.actions);
      }

      setMessages(prev => [...prev, response]);
    } catch (e) {
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: 'Hubo un error procesando tu mensaje. Intenta de nuevo.',
        actions: [],
        timestamp: Date.now(),
      }]);
    } finally {
      setThinking(false);
      scrollToBottom();
    }
  }, [input, thinking, block.id, buildContext, conversationHistory, dispatchAIActions, scrollToBottom]);

  const handleSuggestion = useCallback((prompt: string) => {
    handleSend(prompt);
  }, [handleSend]);

  const handleGeneratePlan = useCallback(async () => {
    if (!planForm.objetivo.trim() || generating) return;
    setGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const plan = await generateWorkoutPlan({
        objetivo: planForm.objetivo.trim(),
        días: parseInt(planForm.dias, 10) || 3,
        duración: parseInt(planForm.duracion, 10) || 45,
        lesiones: planForm.lesiones.trim()
          ? planForm.lesiones.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
      });
      const note: AIMessage = {
        id: generateId(),
        role: 'assistant',
        content: plan
          ? `He creado el bloque "${plan.name}" con ${plan.content.filter((n) => n.type === 'exercise').length} ejercicios.`
          : 'No pude generar el plan. Inténtalo de nuevo con otro objetivo.',
        actions: [],
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, note]);
      setPlanForm((p) => ({ ...p, open: false }));
    } catch (e) {
      setMessages((prev) => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: 'Error generando la rutina. Revisa la conexión o la API key.',
        actions: [],
        timestamp: Date.now(),
      }]);
    } finally {
      setGenerating(false);
    }
  }, [planForm, generating]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOp.value,
  }));

  if (!visible) return null;

  const actionSummary = (actions: AIAction[]) => {
    const counts: Record<string, number> = {};
    actions.forEach(a => { counts[a.type] = (counts[a.type] ?? 0) + 1; });
    const parts: string[] = [];
    if (counts.add_exercise) parts.push(`+${counts.add_exercise} ejercicio${counts.add_exercise > 1 ? 's' : ''}`);
    if (counts.update_exercise) parts.push(`${counts.update_exercise} actualizado${counts.update_exercise > 1 ? 's' : ''}`);
    if (counts.delete_exercise) parts.push(`${counts.delete_exercise} eliminado${counts.delete_exercise > 1 ? 's' : ''}`);
    if (counts.update_block_meta) parts.push('bloque actualizado');
    if (counts.create_block) parts.push('bloque creado');
    return parts.join(' · ');
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.root}>
          <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

          <Animated.View style={[styles.sheet, sheetStyle, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.kaiDot}>
                  <Feather name="zap" size={14} color={Colors.text.inverse} />
                </View>
                <View>
                  <Text style={styles.headerTitle}>Kai</Text>
                  <Text style={styles.headerSub} numberOfLines={1}>{block.name}</Text>
                </View>
              </View>
              <Pressable onPress={handleClose} hitSlop={12}>
                <Feather name="x" size={20} color={Colors.text.tertiary} />
              </Pressable>
            </View>

            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {messages.length === 0 && (
                <View style={styles.emptyState}>
                  <Feather name="cpu" size={28} color={Colors.accent.primary} />
                  <Text style={styles.emptyTitle}>Asistente de bloque</Text>
                  <Text style={styles.emptyDesc}>
                    Puedo generar rutinas, añadir ejercicios, analizar tu bloque o ajustar el volumen.
                  </Text>
                </View>
              )}

              {messages.map(msg => (
                <View key={msg.id} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                  <Text style={[styles.bubbleText, msg.role === 'user' && styles.userBubbleText]}>
                    {msg.content}
                  </Text>
                  {msg.actions.length > 0 && (
                    <View style={styles.actionBadge}>
                      <Feather name="check-circle" size={11} color={Colors.semantic.success} />
                      <Text style={styles.actionBadgeText}>{actionSummary(msg.actions)}</Text>
                    </View>
                  )}
                </View>
              ))}

              {thinking && (
                <View style={[styles.bubble, styles.aiBubble]}>
                  <View style={styles.thinkingRow}>
                    <View style={styles.thinkingDot} />
                    <View style={[styles.thinkingDot, styles.thinkingDot2]} />
                    <View style={[styles.thinkingDot, styles.thinkingDot3]} />
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Plan generator */}
            <View style={styles.planRow}>
              <Pressable
                onPress={() => setPlanForm((p) => ({ ...p, open: !p.open }))}
                style={styles.planToggle}
              >
                <Feather name="zap" size={13} color={Colors.accent.primary} />
                <Text style={styles.planToggleText}>
                  {planForm.open ? 'Cerrar generador' : 'Generar rutina'}
                </Text>
              </Pressable>
            </View>
            {planForm.open && (
              <View style={styles.planForm}>
                <TextInput
                  style={styles.planInput}
                  value={planForm.objetivo}
                  onChangeText={(t) => setPlanForm((p) => ({ ...p, objetivo: t }))}
                  placeholder="Objetivo (ej. hipertrofia tren superior)"
                  placeholderTextColor={Colors.text.disabled}
                />
                <View style={styles.planRowInputs}>
                  <TextInput
                    style={[styles.planInput, styles.planInputSmall]}
                    value={planForm.dias}
                    onChangeText={(t) => setPlanForm((p) => ({ ...p, dias: t.replace(/[^0-9]/g, '') }))}
                    placeholder="Días"
                    placeholderTextColor={Colors.text.disabled}
                    keyboardType="number-pad"
                  />
                  <TextInput
                    style={[styles.planInput, styles.planInputSmall]}
                    value={planForm.duracion}
                    onChangeText={(t) => setPlanForm((p) => ({ ...p, duracion: t.replace(/[^0-9]/g, '') }))}
                    placeholder="Min/sesión"
                    placeholderTextColor={Colors.text.disabled}
                    keyboardType="number-pad"
                  />
                </View>
                <TextInput
                  style={styles.planInput}
                  value={planForm.lesiones}
                  onChangeText={(t) => setPlanForm((p) => ({ ...p, lesiones: t }))}
                  placeholder="Lesiones (separadas por coma)"
                  placeholderTextColor={Colors.text.disabled}
                />
                <Pressable
                  onPress={handleGeneratePlan}
                  disabled={generating || !planForm.objetivo.trim()}
                  style={[styles.planBtn, (generating || !planForm.objetivo.trim()) && styles.planBtnDisabled]}
                >
                  <Text style={styles.planBtnText}>
                    {generating ? 'Generando…' : 'Crear bloque'}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Suggestions */}
            {messages.length === 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionsRow}
                style={styles.suggestionsScroll}
              >
                {suggestions.map((s, i) => (
                  <Pressable
                    key={i}
                    onPress={() => handleSuggestion(s.prompt)}
                    style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                  >
                    <Text style={styles.chipText}>{s.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* Input */}
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                value={input}
                onChangeText={setInput}
                placeholder="Pide algo a Kai..."
                placeholderTextColor={Colors.text.disabled}
                multiline
                maxLength={500}
                returnKeyType="send"
                blurOnSubmit
                onSubmitEditing={() => handleSend()}
                editable={!thinking}
              />
              <Pressable
                onPress={() => handleSend()}
                disabled={!input.trim() || thinking}
                style={[styles.sendBtn, (!input.trim() || thinking) && styles.sendBtnDisabled]}
              >
                <Feather name="arrow-up" size={18} color={Colors.text.inverse} />
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: Colors.background.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: SHEET_H,
    height: SHEET_H,
    paddingTop: Spacing.md,
    ...Shadows.modal,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.medium,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.subtle,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  kaiDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
  },
  headerSub: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
    maxWidth: 200,
  },

  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
    marginTop: Spacing.sm,
  },
  emptyDesc: {
    fontSize: Typography.size.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: Typography.size.caption * Typography.lineHeight.relaxed,
    maxWidth: 280,
  },

  bubble: {
    maxWidth: '85%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.lg,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.accent.primary,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.background.elevated,
  },
  bubbleText: {
    fontSize: Typography.size.caption,
    color: Colors.text.primary,
    lineHeight: Typography.size.caption * Typography.lineHeight.relaxed,
  },
  userBubbleText: {
    color: Colors.text.inverse,
  },

  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border.light,
  },
  actionBadgeText: {
    fontSize: Typography.size.micro,
    color: Colors.semantic.success,
    fontWeight: Typography.weight.medium,
  },

  thinkingRow: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  thinkingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.text.disabled,
    opacity: 0.6,
  },
  thinkingDot2: {
    opacity: 0.4,
  },
  thinkingDot3: {
    opacity: 0.2,
  },

  suggestionsScroll: {
    flexGrow: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border.subtle,
  },
  suggestionsRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.accent.light,
    backgroundColor: Colors.accent.dim,
  },
  chipPressed: {
    backgroundColor: Colors.accent.muted,
  },
  chipText: {
    fontSize: Typography.size.micro,
    color: Colors.accent.primary,
    fontWeight: Typography.weight.semibold,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border.subtle,
  },
  textInput: {
    flex: 1,
    fontSize: Typography.size.body,
    color: Colors.text.primary,
    maxHeight: 80,
    paddingVertical: Platform.OS === 'ios' ? Spacing.sm + 2 : Spacing.sm,
    lineHeight: Typography.size.body * Typography.lineHeight.normal,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 2 : 0,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.border.medium,
  },
  planRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border.subtle,
    flexDirection: 'row',
  },
  planToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent.dim,
  },
  planToggleText: {
    fontSize: Typography.size.micro,
    fontWeight: Typography.weight.semibold,
    color: Colors.accent.primary,
  },
  planForm: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  planInput: {
    fontSize: Typography.size.caption,
    color: Colors.text.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background.elevated,
  },
  planInputSmall: {
    flex: 1,
  },
  planRowInputs: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  planBtn: {
    marginTop: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
  },
  planBtnDisabled: {
    opacity: 0.5,
  },
  planBtnText: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.bold,
    color: Colors.text.inverse,
  },
});
