import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import type { TimerContentNode } from '../../../types/content';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../../theme/index';

interface TimerNodeProps {
  node: TimerContentNode;
  onUpdate: (nodeId: string, data: TimerContentNode['data']) => void;
  onDelete: (nodeId: string) => void;
  compact?: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function TimerNodeInner({ node, onUpdate, onDelete, compact }: TimerNodeProps) {
  const { mode, duration, label } = node.data;
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(label);
  const [editingDuration, setEditingDuration] = useState(false);
  const [durationDraft, setDurationDraft] = useState(String(duration));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const progress = useSharedValue(0);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as `${number}%`,
  }));

  useEffect(() => {
    if (mode === 'countdown' && duration > 0) {
      progress.value = withTiming(elapsed / duration, { duration: 300, easing: Easing.out(Easing.cubic) });
    } else if (mode === 'stopwatch') {
      progress.value = withTiming(Math.min(elapsed / 300, 1), { duration: 300 });
    }
  }, [elapsed, duration, mode, progress]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const toggleTimer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setRunning(false);
    } else {
      setRunning(true);
      intervalRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1;
          if (mode === 'countdown' && next >= duration) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            setRunning(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return duration;
          }
          return next;
        });
      }, 1000);
    }
  }, [running, mode, duration]);

  const resetTimer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
    setElapsed(0);
  }, []);

  const toggleMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetTimer();
    onUpdate(node.id, { ...node.data, mode: mode === 'countdown' ? 'stopwatch' : 'countdown' });
  }, [node, mode, onUpdate, resetTimer]);

  const handleLabelSubmit = useCallback(() => {
    setEditingLabel(false);
    onUpdate(node.id, { ...node.data, label: labelDraft.trim() });
  }, [node, labelDraft, onUpdate]);

  const handleDurationSubmit = useCallback(() => {
    setEditingDuration(false);
    const secs = parseInt(durationDraft, 10);
    if (!isNaN(secs) && secs > 0) {
      onUpdate(node.id, { ...node.data, duration: secs });
      setElapsed(0);
    } else {
      setDurationDraft(String(duration));
    }
  }, [node, durationDraft, duration, onUpdate]);

  const displayTime = mode === 'countdown'
    ? formatTime(Math.max(0, duration - elapsed))
    : formatTime(elapsed);

  const isFinished = mode === 'countdown' && elapsed >= duration;
  const accentColor = isFinished ? Colors.semantic.success : '#06B6D4';

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
      <View style={[styles.topStrip, { backgroundColor: accentColor }]} />

      <View style={[styles.header, compact && styles.headerCompact]}>
        <Feather name="clock" size={compact ? 13 : 16} color={accentColor} />
        {editingLabel ? (
          <TextInput
            style={[styles.labelInput, compact && styles.labelInputCompact]}
            value={labelDraft}
            onChangeText={setLabelDraft}
            onBlur={handleLabelSubmit}
            onSubmitEditing={handleLabelSubmit}
            autoFocus
            placeholder="Timer label"
            placeholderTextColor={Colors.text.disabled}
            returnKeyType="done"
          />
        ) : (
          <Pressable onPress={() => { setLabelDraft(label); setEditingLabel(true); }} style={{ flex: 1 }}>
            <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={1}>
              {label || (mode === 'countdown' ? 'Countdown' : 'Stopwatch')}
            </Text>
          </Pressable>
        )}
        {!compact && (
          <Pressable onPress={toggleMode} hitSlop={8} style={styles.modeBtn}>
            <Text style={styles.modeText}>{mode === 'countdown' ? 'COUNT' : 'STOP'}</Text>
          </Pressable>
        )}
        <Pressable onPress={() => onDelete(node.id)} hitSlop={8}>
          <Feather name="x" size={compact ? 13 : 16} color={Colors.text.disabled} />
        </Pressable>
      </View>

      <View style={[styles.body, compact && styles.bodyCompact]}>
        {editingDuration && mode === 'countdown' ? (
          <TextInput
            style={[styles.durationInput, compact && styles.durationInputCompact]}
            value={durationDraft}
            onChangeText={setDurationDraft}
            onBlur={handleDurationSubmit}
            onSubmitEditing={handleDurationSubmit}
            keyboardType="number-pad"
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
          />
        ) : (
          <Pressable
            onPress={mode === 'countdown' && !running ? () => {
              setDurationDraft(String(duration));
              setEditingDuration(true);
            } : undefined}
          >
            <Text style={[styles.time, compact && styles.timeCompact, isFinished && { color: Colors.semantic.success }]}>
              {displayTime}
            </Text>
          </Pressable>
        )}

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { backgroundColor: accentColor }, progressStyle]} />
        </View>

        <View style={[styles.controls, compact && styles.controlsCompact]}>
          <Pressable onPress={resetTimer} style={styles.controlBtn}>
            <Feather name="rotate-ccw" size={compact ? 13 : 16} color={Colors.text.tertiary} />
          </Pressable>
          <Pressable onPress={toggleTimer} style={[styles.playBtn, compact && styles.playBtnCompact, { backgroundColor: accentColor }]}>
            <Feather name={running ? 'pause' : 'play'} size={compact ? 14 : 18} color={Colors.text.inverse} />
          </Pressable>
          {mode === 'countdown' && !compact && (
            <View style={styles.presets}>
              {[30, 60, 90, 120].map(s => (
                <Pressable
                  key={s}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onUpdate(node.id, { ...node.data, duration: s });
                    setElapsed(0);
                  }}
                  style={[styles.presetBtn, duration === s && styles.presetBtnActive]}
                >
                  <Text style={[styles.presetText, duration === s && styles.presetTextActive]}>
                    {s < 60 ? `${s}s` : `${s / 60}m`}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

export default React.memo(TimerNodeInner);

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border.warm,
    overflow: 'hidden',
    ...Shadows.subtle,
  },
  topStrip: {
    height: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  label: {
    flex: 1,
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
  },
  labelInput: {
    flex: 1,
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent.primary,
    paddingVertical: 2,
  },
  modeBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.background.elevated,
  },
  modeText: {
    fontSize: 9,
    fontWeight: Typography.weight.bold,
    color: Colors.text.tertiary,
    letterSpacing: 0.8,
  },
  body: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    alignItems: 'center',
  },
  time: {
    fontSize: 36,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    marginVertical: Spacing.sm,
  },
  durationInput: {
    fontSize: 36,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent.primary,
    marginVertical: Spacing.sm,
    minWidth: 100,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: Colors.background.elevated,
    borderRadius: 1.5,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presets: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  presetBtn: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.background.elevated,
  },
  presetBtnActive: {
    backgroundColor: Colors.accent.dim,
  },
  presetText: {
    fontSize: Typography.size.micro,
    fontWeight: Typography.weight.medium,
    color: Colors.text.tertiary,
  },
  presetTextActive: {
    color: Colors.accent.primary,
    fontWeight: Typography.weight.semibold,
  },
  headerCompact: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  labelCompact: {
    fontSize: Typography.size.micro,
  },
  labelInputCompact: {
    fontSize: Typography.size.micro,
  },
  bodyCompact: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  timeCompact: {
    fontSize: 22,
    marginVertical: Spacing.xs,
  },
  durationInputCompact: {
    fontSize: 22,
    marginVertical: Spacing.xs,
    minWidth: 60,
  },
  controlsCompact: {
    gap: Spacing.sm,
  },
  playBtnCompact: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
});
