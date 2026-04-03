// KAIROS — BlockCreationSheet
// Animated bottom sheet: Step 1 = choose discipline, Step 2 = customize (name/emoji/color/cover).

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Colors, Typography, Spacing, Radius } from '../theme/index';
import type { Discipline, BlockCover } from '../types/core';
import { DISCIPLINE_CONFIGS } from '../types/core';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_H * 0.88;

// ======================== CONSTANTS ========================

const EMOJI_OPTIONS: Record<Discipline, string[]> = {
  strength:    ['🏋️','💪','🦾','⚡','🔥','🥊','🤜','🏆','⚖️','🎯','💥','🛡️'],
  running:     ['🏃','👟','⏱️','🏁','🌬️','🦶','🗺️','🌅','💨','🏔️','🌍','🎽'],
  calisthenics:['🤸','🧗','💫','🌀','⭕','🤲','🔄','🎭','🤼','🌊','🎪','🔱'],
  mobility:    ['🧘','🌸','🍃','☯️','🌊','🌙','✨','🦋','🌺','💫','🕊️','🌿'],
  team_sport:  ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🥅','🏟️','🤝','🏆','🥋'],
  cycling:     ['🚴','🚵','🛣️','⚙️','🔧','🏔️','💨','⚡','🎯','🔄','🌄','🏁'],
  swimming:    ['🏊','🌊','💧','🐋','🏖️','🔵','💙','🌀','🫧','⛵','🐬','🦈'],
  general:     ['💪','🎯','🏅','⭐','🌟','✨','🎖️','🏆','💎','🔮','⚡','🎨'],
};

const BLOCK_COLORS = [
  '#E84545', '#F0A030', '#C9A96E', '#1DB88E',
  '#5B8DEF', '#8B5CF6', '#06B6D4', '#EC4899',
];

// ======================== PROPS ========================

export interface BlockCreationOptions {
  discipline: Discipline;
  name: string;
  icon: string;
  color: string;
  cover: BlockCover | null;
}

interface BlockCreationSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (opts: BlockCreationOptions) => void;
}

// ======================== DISCIPLINE TILE ========================

const DisciplineTile: React.FC<{
  discipline: Discipline;
  onSelect: (d: Discipline) => void;
}> = React.memo(({ discipline, onSelect }) => {
  const cfg = DISCIPLINE_CONFIGS[discipline];
  return (
    <Pressable
      onPress={() => onSelect(discipline)}
      style={({ pressed }) => [
        styles.disciplineTile,
        { backgroundColor: `${cfg.color}14`, borderColor: `${cfg.color}35` },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={styles.disciplineEmoji}>{cfg.icon}</Text>
      <Text style={styles.disciplineName}>{cfg.name}</Text>
    </Pressable>
  );
});
DisciplineTile.displayName = 'DisciplineTile';

// ======================== EMOJI BUTTON ========================

const EmojiBtn: React.FC<{
  emoji: string;
  selected: boolean;
  color: string;
  onPress: () => void;
}> = React.memo(({ emoji, selected, color, onPress }) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.emojiBtn,
      selected && { backgroundColor: `${color}25`, borderColor: `${color}60` },
    ]}
  >
    <Text style={styles.emojiBtnText}>{emoji}</Text>
  </Pressable>
));
EmojiBtn.displayName = 'EmojiBtn';

// ======================== COLOR SWATCH ========================

const ColorSwatch: React.FC<{
  color: string;
  selected: boolean;
  onPress: () => void;
}> = React.memo(({ color, selected, onPress }) => (
  <Pressable onPress={onPress} style={styles.swatchWrap}>
    <View style={[styles.swatch, { backgroundColor: color }]}>
      {selected && <View style={styles.swatchCheck} />}
    </View>
  </Pressable>
));
ColorSwatch.displayName = 'ColorSwatch';

// ======================== COVER OPTION ========================

const CoverOption: React.FC<{
  label: string;
  selected: boolean;
  color: string;
  preview: React.ReactNode;
  onPress: () => void;
}> = React.memo(({ label, selected, color, preview, onPress }) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.coverOption,
      selected && { borderColor: color, backgroundColor: `${color}12` },
    ]}
  >
    <View style={styles.coverPreview}>{preview}</View>
    <Text style={[styles.coverLabel, selected && { color }]}>{label}</Text>
  </Pressable>
));
CoverOption.displayName = 'CoverOption';

// ======================== MAIN SHEET ========================

export default function BlockCreationSheet({
  visible,
  onClose,
  onCreate,
}: BlockCreationSheetProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [discipline, setDiscipline] = useState<Discipline>('strength');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(DISCIPLINE_CONFIGS.strength.icon);
  const [color, setColor] = useState(DISCIPLINE_CONFIGS.strength.color);
  const [cover, setCover] = useState<BlockCover | null>(null);

  // Animate sheet in/out
  const translateY = useSharedValue(SHEET_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  const animateIn = useCallback(() => {
    backdropOpacity.value = withTiming(1, { duration: 220 });
    translateY.value = withSpring(0, { damping: 18, stiffness: 180, mass: 1 });
  }, [backdropOpacity, translateY]);

  const animateOut = useCallback(
    (cb?: () => void) => {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(SHEET_HEIGHT, { duration: 280 }, () => {
        if (cb) runOnJS(cb)();
      });
    },
    [backdropOpacity, translateY]
  );

  useEffect(() => {
    if (visible) {
      animateIn();
    }
  }, [visible, animateIn]);

  const handleClose = useCallback(() => {
    animateOut(() => {
      setStep(1);
      setName('');
      onClose();
    });
  }, [animateOut, onClose]);

  const handleSelectDiscipline = useCallback((d: Discipline) => {
    const cfg = DISCIPLINE_CONFIGS[d];
    setDiscipline(d);
    setIcon(cfg.icon);
    setColor(cfg.color);
    setName('');
    setCover(null);
    setStep(2);
  }, []);

  const handleCreate = useCallback(() => {
    const cfg = DISCIPLINE_CONFIGS[discipline];
    animateOut(() => {
      onCreate({
        discipline,
        name: name.trim() || cfg.name,
        icon,
        color,
        cover,
      });
      setStep(1);
      setName('');
      onClose();
    });
  }, [animateOut, discipline, name, icon, color, cover, onCreate, onClose]);

  // Swipe-down gesture to close
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        backdropOpacity.value = 1 - e.translationY / SHEET_HEIGHT;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 600) {
        runOnJS(handleClose)();
      } else {
        translateY.value = withSpring(0, { damping: 18, stiffness: 180 });
        backdropOpacity.value = withTiming(1, { duration: 150 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible) return null;

  const cfg = DISCIPLINE_CONFIGS[discipline];

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />
      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

      {/* Sheet */}
      <Animated.View style={[styles.sheet, sheetStyle]}>
        <GestureDetector gesture={panGesture}>
          <View style={styles.handleArea}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {step === 1 ? (
            <>
              <Text style={styles.sheetTitle}>¿Qué tipo de bloque?</Text>
              <ScrollView
                contentContainerStyle={styles.disciplineGrid}
                showsVerticalScrollIndicator={false}
              >
                {(Object.keys(DISCIPLINE_CONFIGS) as Discipline[]).map((d) => (
                  <DisciplineTile key={d} discipline={d} onSelect={handleSelectDiscipline} />
                ))}
              </ScrollView>
            </>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.step2Content}
            >
              {/* Back */}
              <View style={styles.step2Nav}>
                <Pressable
                  onPress={() => setStep(1)}
                  style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.backBtnText}>‹ Atrás</Text>
                </Pressable>
                <Text style={styles.sheetTitleSmall}>Personalizar bloque</Text>
                <View style={{ width: 60 }} />
              </View>

              {/* Preview card */}
              <View
                style={[
                  styles.previewCard,
                  {
                    backgroundColor:
                      cover?.type === 'color'
                        ? `${cover.value}30`
                        : `${color}12`,
                    borderColor: `${color}35`,
                  },
                ]}
              >
                <View style={[styles.previewStripe, { backgroundColor: color }]} />
                <View style={styles.previewBody}>
                  <View style={[styles.previewIcon, { backgroundColor: `${color}25` }]}>
                    <Text style={{ fontSize: 26 }}>{icon}</Text>
                  </View>
                  <Text style={[styles.previewName, { color }]} numberOfLines={1}>
                    {name.trim() || cfg.name}
                  </Text>
                </View>
              </View>

              {/* Name */}
              <Text style={styles.fieldLabel}>Nombre</Text>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder={cfg.name}
                placeholderTextColor={Colors.text.disabled}
                returnKeyType="done"
                maxLength={40}
                autoFocus
              />

              {/* Emoji */}
              <Text style={styles.fieldLabel}>Icono</Text>
              <View style={styles.emojiGrid}>
                {EMOJI_OPTIONS[discipline].map((e) => (
                  <EmojiBtn
                    key={e}
                    emoji={e}
                    selected={icon === e}
                    color={color}
                    onPress={() => setIcon(e)}
                  />
                ))}
              </View>

              {/* Color */}
              <Text style={styles.fieldLabel}>Color</Text>
              <View style={styles.colorRow}>
                {BLOCK_COLORS.map((c) => (
                  <ColorSwatch
                    key={c}
                    color={c}
                    selected={color === c}
                    onPress={() => {
                      setColor(c);
                      if (cover?.type === 'color') setCover({ type: 'color', value: c });
                    }}
                  />
                ))}
              </View>

              {/* Cover */}
              <Text style={styles.fieldLabel}>Portada</Text>
              <View style={styles.coverRow}>
                <CoverOption
                  label="Sin portada"
                  selected={cover === null}
                  color={color}
                  onPress={() => setCover(null)}
                  preview={
                    <View style={[styles.coverPreviewBox, { backgroundColor: Colors.background.elevated }]}>
                      <View style={[styles.coverPreviewStripe, { backgroundColor: color }]} />
                    </View>
                  }
                />
                <CoverOption
                  label="Color sólido"
                  selected={cover?.type === 'color'}
                  color={color}
                  onPress={() => setCover({ type: 'color', value: color })}
                  preview={
                    <View style={[styles.coverPreviewBox, { backgroundColor: color }]} />
                  }
                />
                <CoverOption
                  label="Gradiente"
                  selected={cover?.type === 'gradient'}
                  color={color}
                  onPress={() => setCover({ type: 'gradient', from: color, to: Colors.background.void })}
                  preview={
                    <View style={[styles.coverPreviewBox, styles.coverGradientPreview, { borderColor: `${color}40` }]}>
                      <View style={[styles.coverHalf, { backgroundColor: color }]} />
                      <View style={[styles.coverHalf, { backgroundColor: Colors.background.void }]} />
                    </View>
                  }
                />
              </View>

              {/* Create button */}
              <Pressable
                onPress={handleCreate}
                style={({ pressed }) => [
                  styles.createBtn,
                  { backgroundColor: color, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.createBtnText}>Crear bloque</Text>
              </Pressable>

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

// ======================== STYLES ========================

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: Colors.background.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 0.5,
    borderColor: Colors.border.light,
    overflow: 'hidden',
  },
  handleArea: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border.medium },

  sheetTitle: {
    fontSize: Typography.size.heading,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  sheetTitleSmall: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
  },

  // Discipline grid
  disciplineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: 40,
  },
  disciplineTile: {
    width: '47%',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  disciplineEmoji: { fontSize: 30 },
  disciplineName: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.medium,
    color: Colors.text.primary,
  },

  // Step 2
  step2Content: { paddingHorizontal: Spacing['2xl'], paddingBottom: 20 },
  step2Nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  backBtn: { width: 60 },
  backBtnText: {
    fontSize: Typography.size.body,
    color: Colors.accent.primary,
    fontWeight: Typography.weight.medium,
  },

  // Preview card
  previewCard: {
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
  },
  previewStripe: { height: 3, width: '100%' },
  previewBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  previewIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewName: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.bold,
    flex: 1,
  },

  // Fields
  fieldLabel: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  nameInput: {
    backgroundColor: Colors.background.elevated,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border.medium,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: Typography.size.body,
    color: Colors.text.primary,
  },

  // Emoji grid
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  emojiBtn: {
    width: 46,
    height: 46,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.elevated,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  emojiBtnText: { fontSize: 22 },

  // Color row
  colorRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  swatchWrap: { padding: 3 },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchCheck: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },

  // Cover options
  coverRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  coverOption: {
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    flex: 1,
    minWidth: 80,
  },
  coverPreview: {},
  coverLabel: {
    fontSize: 11,
    fontWeight: Typography.weight.medium,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  coverPreviewBox: {
    width: 60,
    height: 36,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  coverPreviewStripe: { height: 4, width: '100%' },
  coverGradientPreview: {
    flexDirection: 'row',
    borderWidth: 0.5,
  },
  coverHalf: { flex: 1, height: '100%' },

  // Create button
  createBtn: {
    marginTop: Spacing.xl + 4,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  createBtnText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
});
