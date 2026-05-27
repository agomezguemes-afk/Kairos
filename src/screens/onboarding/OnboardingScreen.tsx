import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Dimensions,
  FlatList,
  ScrollView,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  interpolate,
  Extrapolate,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { CommonActions, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import KIcon, { type KIconName } from '../../components/icons/KIcon';
import AnimatedLogoPulse from '../../components/AnimatedLogoPulse';
import { useTheme } from '../../theme/ThemeContext';
import { Colors, Typography } from '../../theme/tokens';
import { useWorkoutStore } from '../../store/workoutStore';
import { useUserProfile } from '../../context/UserProfileContext';
import { generateStarterRoutine } from '../../lib/routines/generateStarterRoutine';
import type { EquipmentTag } from '../../types/profile';

const { width: SCREEN_W } = Dimensions.get('window');
const PAGE_COUNT = 4;
const ENTER_MS = 600;
const PAGE_FADE_MS = 400;

type Goal = 'strength' | 'endurance' | 'flexibility' | 'health';
const GOAL_OPTIONS: { id: Goal; label: string; icon: KIconName }[] = [
  { id: 'strength', label: 'Fuerza', icon: 'barbell' },
  { id: 'endurance', label: 'Resistencia', icon: 'running' },
  { id: 'flexibility', label: 'Flexibilidad', icon: 'mat' },
  { id: 'health', label: 'Salud general', icon: 'zap' },
];

// Equipment chips — KIcon's set is limited, so we map each option to the
// closest icon available. Labels stay in Spanish to match the rest of the flow.
const EQUIPMENT_CHOICES: { id: EquipmentTag; label: string; icon: KIconName }[] = [
  { id: 'bodyweight', label: 'Solo peso corporal', icon: 'mat' },
  { id: 'dumbbells', label: 'Mancuernas', icon: 'barbell' },
  { id: 'barbell_plates', label: 'Barra + discos', icon: 'barbell' },
  { id: 'kettlebell', label: 'Kettlebell', icon: 'barbell' },
  { id: 'resistance_bands', label: 'Bandas elásticas', icon: 'zap' },
  { id: 'pull_up_bar', label: 'Barra de dominadas', icon: 'barbell' },
  { id: 'machines_full_gym', label: 'Gimnasio / máquinas', icon: 'grid' },
  { id: 'cardio_equipment', label: 'Cardio (cinta, bici)', icon: 'running' },
  { id: 'yoga_mat', label: 'Esterilla / yoga', icon: 'mat' },
  { id: 'jump_rope', label: 'Cuerda de saltar', icon: 'zap' },
];

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as unknown as typeof FlatList;

interface PageInfo {
  index: number;
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const nav = useNavigation<any>();
  const setUserName = useWorkoutStore((s) => s.setUserName);
  const setUserGoal = useWorkoutStore((s) => s.setUserGoal);
  const { updateProfile } = useUserProfile();

  const listRef = useRef<FlatList<PageInfo>>(null);
  const [page, setPage] = useState(0);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState<Goal | null>(null);
  const [equipment, setEquipment] = useState<EquipmentTag[]>([]);
  const [equipmentNotes, setEquipmentNotes] = useState('');
  const [closing, setClosing] = useState(false);

  const scrollX = useSharedValue(0);
  const closeAnim = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const handleMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setPage(idx);
  }, []);

  const goToPage = useCallback((idx: number) => {
    listRef.current?.scrollToOffset({ offset: idx * SCREEN_W, animated: true });
  }, []);

  const isNameReady = name.trim().length > 0;
  const isGoalReady = goal !== null;

  const ctaEnabled = useMemo(() => {
    if (page === 0) return true;
    if (page === 1) return isNameReady;
    if (page === 2) return isGoalReady;
    return true; // equipment step is skippable
  }, [page, isNameReady, isGoalReady]);

  const toggleEquipment = useCallback((id: EquipmentTag) => {
    Haptics.selectionAsync().catch(() => {});
    setEquipment((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const handleNext = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (page === 0) {
      goToPage(1);
      return;
    }
    if (page === 1) {
      if (!isNameReady) return;
      setUserName(name);
      Keyboard.dismiss();
      goToPage(2);
      return;
    }
    if (page === 2) {
      if (!isGoalReady || !goal) return;
      setUserGoal(goal);
      goToPage(3);
      return;
    }
    // page === 3 (equipment) → finalise.
    if (!goal) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Keyboard.dismiss();
    const trimmedNotes = equipmentNotes.trim();
    updateProfile({
      equipment,
      equipmentNotes: trimmedNotes.length > 0 ? trimmedNotes : null,
    }).catch(() => {});
    generateStarterRoutine(goal);
    setClosing(true);
  }, [
    page,
    name,
    goal,
    equipment,
    equipmentNotes,
    isNameReady,
    isGoalReady,
    setUserName,
    setUserGoal,
    updateProfile,
    goToPage,
  ]);

  useEffect(() => {
    if (!closing) return;
    closeAnim.value = withSequence(
      withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }),
      withDelay(
        80,
        withTiming(2, { duration: 400, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) {
            runOnJS(nav.dispatch)(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Dashboard' }],
              }),
            );
          }
        }),
      ),
    );
  }, [closing, closeAnim, nav]);

  const closeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(closeAnim.value, [0, 1, 2], [1, 1, 0]),
    transform: [{ scale: interpolate(closeAnim.value, [0, 1, 2], [1, 1, 0.98]) }],
  }));

  const data: PageInfo[] = useMemo(
    () => Array.from({ length: PAGE_COUNT }, (_, i) => ({ index: i })),
    [],
  );

  const renderItem: ListRenderItem<PageInfo> = ({ item }) => {
    if (item.index === 0) return <PageWelcome scrollX={scrollX} />;
    if (item.index === 1) return <PageName scrollX={scrollX} value={name} onChange={setName} />;
    if (item.index === 2) {
      return (
        <PageGoal
          scrollX={scrollX}
          value={goal}
          onChange={(g) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setGoal(g);
          }}
        />
      );
    }
    return (
      <PageEquipment
        scrollX={scrollX}
        selected={equipment}
        notes={equipmentNotes}
        onToggle={toggleEquipment}
        onNotesChange={setEquipmentNotes}
      />
    );
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.surface, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <Backdrop tintColor={colors.gold[500]} />

      <Animated.View style={[styles.content, closeStyle]} pointerEvents={closing ? 'none' : 'auto'}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <AnimatedFlatList
            ref={listRef as any}
            data={data}
            keyExtractor={(it: PageInfo) => String(it.index)}
            renderItem={renderItem as any}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            onScroll={onScroll}
            onMomentumScrollEnd={handleMomentumEnd}
            scrollEventThrottle={16}
            getItemLayout={(_d, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          />

          <View style={styles.footer}>
            <Dots active={page} count={PAGE_COUNT} tint={colors.gold[500]} />

            <Pressable
              onPress={handleNext}
              disabled={!ctaEnabled}
              style={({ pressed }) => [
                styles.cta,
                {
                  backgroundColor: colors.gold[500],
                  opacity: ctaEnabled ? (pressed ? 0.92 : 1) : 0.4,
                },
              ]}
            >
              <Text style={styles.ctaText}>
                {page === PAGE_COUNT - 1 ? 'Comenzar' : 'Siguiente'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>

      {closing && (
        <View pointerEvents="none" style={styles.closeOverlay}>
          <ClosingLogo anim={closeAnim} />
        </View>
      )}
    </View>
  );
}

// ============================================================
// Backdrop · subtle gold grid (opacity 0.03) on white
// ============================================================
function Backdrop({ tintColor }: { tintColor: string }) {
  const lines = useMemo(() => {
    const out: { x?: number; y?: number; key: string }[] = [];
    const step = 40;
    for (let x = step; x < SCREEN_W; x += step) out.push({ x, key: `vx${x}` });
    const screenH = 1400;
    for (let y = 0; y < screenH; y += step) out.push({ y, key: `hy${y}` });
    return out;
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={StyleSheet.absoluteFill}>
        {lines.map((l) =>
          l.x !== undefined ? (
            <View key={l.key} style={[styles.gridV, { left: l.x, backgroundColor: tintColor }]} />
          ) : (
            <View key={l.key} style={[styles.gridH, { top: l.y, backgroundColor: tintColor }]} />
          ),
        )}
      </View>
      <BlurView intensity={5} tint="light" style={StyleSheet.absoluteFill} />
    </View>
  );
}

// ============================================================
// Dots progress
// ============================================================
function Dots({ active, count, tint }: { active: number; count: number; tint: string }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: count }).map((_, i) => {
        const isActive = i === active;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              isActive
                ? { backgroundColor: tint, borderColor: tint }
                : { backgroundColor: 'transparent', borderColor: tint, opacity: 0.4 },
            ]}
          />
        );
      })}
    </View>
  );
}

// ============================================================
// Closing logo (shrink to zero)
// ============================================================
function ClosingLogo({ anim }: { anim: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(anim.value, [0, 1, 2], [0, 1, 0], Extrapolate.CLAMP),
    transform: [{ scale: interpolate(anim.value, [0, 1, 2], [1.05, 1, 0], Extrapolate.CLAMP) }],
  }));
  return (
    <Animated.View style={[styles.closeLogoWrap, style]}>
      <AnimatedLogoPulse size={120} breathing={false} initialFade={false} />
    </Animated.View>
  );
}

// ============================================================
// Page 1 · Welcome
// ============================================================
function PageWelcome({ scrollX }: { scrollX: SharedValue<number> }) {
  const { colors } = useTheme();
  const idx = 0;
  const fade = useSharedValue(0);
  const ty = useSharedValue(30);
  const fade2 = useSharedValue(0);
  const ty2 = useSharedValue(30);

  useEffect(() => {
    fade.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    ty.value = withTiming(0, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    fade2.value = withDelay(
      120,
      withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) }),
    );
    ty2.value = withDelay(
      120,
      withTiming(0, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) }),
    );
  }, [fade, ty, fade2, ty2]);

  const pageStyle = useParallaxStyle(scrollX, idx);
  const t1 = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: ty.value }],
  }));
  const t2 = useAnimatedStyle(() => ({
    opacity: fade2.value,
    transform: [{ translateY: ty2.value }],
  }));

  return (
    <Animated.View style={[styles.page, pageStyle]}>
      <View style={styles.pageInner}>
        <View style={styles.illustration}>
          <AnimatedLogoPulse size={120} breathing initialFade />
        </View>
        <Animated.Text style={[styles.heading, { color: colors.gold[500] }, t1]}>
          Bienvenido a tu espacio de entrenamiento
        </Animated.Text>
        <Animated.Text style={[styles.body, { color: colors.text.secondary }, t2]}>
          El primer lienzo que se adapta a ti, no al revés.
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

// ============================================================
// Page 2 · Name
// ============================================================
function PageName({
  scrollX,
  value,
  onChange,
}: {
  scrollX: SharedValue<number>;
  value: string;
  onChange: (s: string) => void;
}) {
  const { colors } = useTheme();
  const idx = 1;
  const fade = useSharedValue(0);
  const ty = useSharedValue(30);

  useEffect(() => {
    fade.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    ty.value = withTiming(0, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
  }, [fade, ty]);

  const pageStyle = useParallaxStyle(scrollX, idx);
  const animStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: ty.value }],
  }));

  return (
    <Animated.View style={[styles.page, pageStyle]}>
      <View style={styles.pageInner}>
        <Animated.Text style={[styles.heading, { color: colors.text.primary }, animStyle]}>
          ¿Cómo te llamas?
        </Animated.Text>

        <Animated.View
          style={[
            styles.glassCard,
            {
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderColor: colors.gold[500],
            },
            animStyle,
          ]}
        >
          <BlurView intensity={5} tint="light" style={StyleSheet.absoluteFill} />
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Tu nombre"
            placeholderTextColor={colors.text.muted}
            cursorColor={colors.gold[500]}
            selectionColor={colors.gold[500]}
            style={[styles.glassInput, { color: colors.text.primary }]}
            autoCapitalize="words"
            maxLength={32}
            returnKeyType="next"
          />
        </Animated.View>

        <Animated.Text style={[styles.helper, { color: colors.text.muted }, animStyle]}>
          Lo usaremos para personalizar tu experiencia.
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

// ============================================================
// Page 3 · Goal
// ============================================================
function PageGoal({
  scrollX,
  value,
  onChange,
}: {
  scrollX: SharedValue<number>;
  value: Goal | null;
  onChange: (g: Goal) => void;
}) {
  const { colors } = useTheme();
  const idx = 2;
  const fade = useSharedValue(0);
  const ty = useSharedValue(30);

  useEffect(() => {
    fade.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    ty.value = withTiming(0, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
  }, [fade, ty]);

  const pageStyle = useParallaxStyle(scrollX, idx);
  const animStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: ty.value }],
  }));

  return (
    <Animated.View style={[styles.page, pageStyle]}>
      <View style={styles.pageInner}>
        <Animated.Text style={[styles.heading, { color: colors.text.primary }, animStyle]}>
          ¿Cuál es tu objetivo?
        </Animated.Text>

        <Animated.View style={[styles.cardGrid, animStyle]}>
          {GOAL_OPTIONS.map((opt) => {
            const selected = value === opt.id;
            const cardBg = selected ? colors.gold[500] : colors.surface;
            const fg = selected ? '#FFFFFF' : colors.text.primary;
            return (
              <Pressable
                key={opt.id}
                onPress={() => onChange(opt.id)}
                style={({ pressed }) => [
                  styles.goalCard,
                  {
                    backgroundColor: cardBg,
                    borderColor: colors.gold[500],
                    opacity: pressed ? 0.94 : 1,
                  },
                  !selected && styles.goalCardShadow,
                ]}
              >
                <KIcon name={opt.icon} size={28} color={fg} strokeWidth={1.5} />
                <Text
                  style={[
                    styles.goalLabel,
                    {
                      color: fg,
                      fontSize: Typography.caption.fontSize,
                      fontWeight: Typography.caption.fontWeight,
                    },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ============================================================
// Page 4 · Equipment (multi-select + freeform note)
// ============================================================
function PageEquipment({
  scrollX,
  selected,
  notes,
  onToggle,
  onNotesChange,
}: {
  scrollX: SharedValue<number>;
  selected: EquipmentTag[];
  notes: string;
  onToggle: (id: EquipmentTag) => void;
  onNotesChange: (s: string) => void;
}) {
  const { colors } = useTheme();
  const idx = 3;
  const fade = useSharedValue(0);
  const ty = useSharedValue(30);

  useEffect(() => {
    fade.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    ty.value = withTiming(0, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
  }, [fade, ty]);

  const pageStyle = useParallaxStyle(scrollX, idx);
  const headerStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: ty.value }],
  }));

  return (
    <Animated.View style={[styles.page, pageStyle]}>
      <Animated.View style={[styles.equipHeader, headerStyle]}>
        <Text style={[styles.heading, { color: colors.text.primary }]}>
          ¿Qué material tienes a mano?
        </Text>
        <Text style={[styles.helper, { color: colors.text.muted }]}>
          Selecciona todo lo que uses. Si no marcas nada, asumimos peso corporal.
        </Text>
      </Animated.View>

      <ScrollView
        style={styles.equipScroll}
        contentContainerStyle={styles.equipScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.equipGrid}>
          {EQUIPMENT_CHOICES.map((opt, i) => {
            const isSelected = selected.includes(opt.id);
            return (
              <EquipmentChip
                key={opt.id}
                label={opt.label}
                icon={opt.icon}
                selected={isSelected}
                onPress={() => onToggle(opt.id)}
                delayMs={60 + i * 28}
                accent={colors.gold[500]}
                surface={colors.surface}
                textColor={colors.text.primary}
              />
            );
          })}
        </View>

        <Animated.View
          style={[
            styles.equipNotesCard,
            { borderColor: colors.gold[500], backgroundColor: 'rgba(255,255,255,0.85)' },
            headerStyle,
          ]}
        >
          <Text style={[styles.equipNotesLabel, { color: colors.text.muted }]}>
            Otro equipamiento (opcional)
          </Text>
          <TextInput
            value={notes}
            onChangeText={onNotesChange}
            placeholder="Trineo, anillas, TRX, banco inclinado…"
            placeholderTextColor={colors.text.muted}
            cursorColor={colors.gold[500]}
            selectionColor={colors.gold[500]}
            style={[styles.equipNotesInput, { color: colors.text.primary }]}
            maxLength={140}
            returnKeyType="done"
            blurOnSubmit
          />
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

const EquipmentChip = React.memo(function EquipmentChip({
  label,
  icon,
  selected,
  onPress,
  delayMs,
  accent,
  surface,
  textColor,
}: {
  label: string;
  icon: KIconName;
  selected: boolean;
  onPress: () => void;
  delayMs: number;
  accent: string;
  surface: string;
  textColor: string;
}) {
  const fade = useSharedValue(0);
  const ty = useSharedValue(20);

  useEffect(() => {
    fade.value = withDelay(
      delayMs,
      withTiming(1, { duration: PAGE_FADE_MS, easing: Easing.out(Easing.cubic) }),
    );
    ty.value = withDelay(
      delayMs,
      withTiming(0, { duration: PAGE_FADE_MS, easing: Easing.out(Easing.cubic) }),
    );
  }, [fade, ty, delayMs]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: ty.value }],
  }));

  const bg = selected ? accent : surface;
  const fg = selected ? '#FFFFFF' : textColor;

  return (
    <Animated.View style={[styles.equipChipWrap, animStyle]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.equipChip,
          {
            backgroundColor: bg,
            borderColor: accent,
            opacity: pressed ? 0.92 : 1,
          },
          !selected && styles.equipChipShadow,
        ]}
      >
        <KIcon name={icon} size={22} color={fg} strokeWidth={1.5} />
        <Text
          numberOfLines={2}
          style={[
            styles.equipChipLabel,
            {
              color: fg,
              fontSize: Typography.caption.fontSize,
              fontWeight: Typography.caption.fontWeight,
            },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
});

// ============================================================
// Parallax + scale per-page based on scroll offset
// ============================================================
function useParallaxStyle(scrollX: SharedValue<number>, idx: number) {
  return useAnimatedStyle(() => {
    const offset = scrollX.value - idx * SCREEN_W;
    const distance = Math.abs(offset) / SCREEN_W;
    const scale = interpolate(distance, [0, 1], [1, 0.96], Extrapolate.CLAMP);
    const opacity = interpolate(distance, [0, 1], [1, 0.5], Extrapolate.CLAMP);
    return {
      opacity,
      transform: [{ scale }, { translateX: -offset * 0.12 }],
    };
  });
}

// ============================================================
const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  page: {
    width: SCREEN_W,
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  pageInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 32,
    paddingBottom: 200,
    gap: 18,
  },
  illustration: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heading: {
    fontSize: Typography.heading.fontSize,
    fontWeight: Typography.heading.fontWeight,
    lineHeight: Typography.heading.lineHeight,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  body: {
    fontSize: Typography.body.fontSize,
    fontWeight: Typography.body.fontWeight,
    lineHeight: Typography.body.lineHeight,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  helper: {
    fontSize: Typography.caption.fontSize,
    fontWeight: Typography.caption.fontWeight,
    lineHeight: Typography.caption.lineHeight,
    marginTop: 12,
    textAlign: 'center',
  },
  glassCard: {
    width: '100%',
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  glassInput: {
    fontSize: Typography.body.fontSize,
    fontWeight: '500',
  },
  cardGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'center',
    marginTop: 12,
  },
  goalCard: {
    width: 140,
    height: 140,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  goalCardShadow: {
    shadowColor: Colors.ink.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  goalLabel: {
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  cta: {
    width: '85%',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  gridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    opacity: 0.03,
  },
  gridH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    opacity: 0.03,
  },
  closeOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLogoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipHeader: {
    alignItems: 'center',
    paddingTop: 32,
    paddingHorizontal: 8,
    gap: 10,
  },
  equipScroll: {
    flex: 1,
    width: '100%',
  },
  equipScrollContent: {
    paddingTop: 18,
    paddingBottom: 220,
    alignItems: 'center',
  },
  equipGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  equipChipWrap: {
    width: '48%',
  },
  equipChip: {
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  equipChipShadow: {
    shadowColor: Colors.ink.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  equipChipLabel: {
    flexShrink: 1,
  },
  equipNotesCard: {
    marginTop: 18,
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  equipNotesLabel: {
    fontSize: Typography.size.micro,
    fontWeight: Typography.weight.medium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  equipNotesInput: {
    fontSize: Typography.body.fontSize,
    fontWeight: '500',
    paddingVertical: 4,
  },
});
