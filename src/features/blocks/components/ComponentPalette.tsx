import React, { useEffect, useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors, Typography, Spacing, Radius, Shadows } from '../../../theme/index';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_MAX = SCREEN_H * 0.65;
const TIMING = { duration: 280, easing: Easing.out(Easing.cubic) };

interface PaletteItem {
  type: string;
  label: string;
  desc: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
}

interface PaletteSection {
  title: string;
  items: PaletteItem[];
}

const SECTIONS: PaletteSection[] = [
  {
    title: 'Escritura',
    items: [
      { type: 'text', label: 'Texto', desc: 'Parrafo, heading, lista', icon: 'type', color: Colors.text.secondary },
      { type: 'text_h1', label: 'Titulo', desc: 'Heading grande', icon: 'bold', color: Colors.text.primary },
      { type: 'text_bullet', label: 'Lista', desc: 'Viñetas o numerada', icon: 'list', color: '#3B82F6' },
      { type: 'text_checklist', label: 'Checklist', desc: 'Lista con casillas', icon: 'check-square', color: '#10B981' },
    ],
  },
  {
    title: 'Entrenamiento',
    items: [
      { type: 'exercise', label: 'Ejercicio', desc: 'Widget con series y campos', icon: 'activity', color: '#E84545' },
      { type: 'subBlock', label: 'Sub-bloque', desc: 'Bloque anidado', icon: 'layers', color: '#8B5CF6' },
      { type: 'timer', label: 'Cuenta regresiva', desc: 'Temporizador con preset', icon: 'clock', color: '#06B6D4' },
      { type: 'timer_stopwatch', label: 'Cronómetro', desc: 'Tiempo libre', icon: 'watch', color: '#06B6D4' },
      { type: 'rest', label: 'Descanso', desc: 'Temporizador de pausa', icon: 'pause-circle', color: '#64748B' },
      { type: 'superset', label: 'Superserie', desc: 'Ejercicios sin descanso', icon: 'repeat', color: '#EC4899' },
    ],
  },
  {
    title: 'Dashboards',
    items: [
      { type: 'dashboard', label: 'Widget de datos', desc: 'Volumen, series, etc.', icon: 'bar-chart-2', color: Colors.accent.primary },
      { type: 'dashboard_progress', label: 'Barra de progreso', desc: 'Avance del bloque', icon: 'pie-chart', color: '#10B981' },
      { type: 'dashboard_list', label: 'Lista de ejercicios', desc: 'Estado por ejercicio', icon: 'list', color: '#3B82F6' },
    ],
  },
  {
    title: 'Estructura',
    items: [
      { type: '2col', label: '2 columnas', desc: 'Sección dividida en 2', icon: 'columns', color: Colors.accent.primary },
      { type: '3col', label: '3 columnas', desc: 'Sección dividida en 3', icon: 'columns', color: Colors.accent.primary },
      { type: 'divider', label: 'Separador', desc: 'Línea horizontal', icon: 'minus', color: Colors.text.tertiary },
      { type: 'spacer', label: 'Espaciador', desc: 'Espacio vacío', icon: 'maximize', color: Colors.text.disabled },
    ],
  },
  {
    title: 'Media',
    items: [
      { type: 'image', label: 'Imagen', desc: 'Foto o cámara', icon: 'image', color: '#06B6D4' },
      { type: 'customField', label: 'Campo libre', desc: 'Métrica personalizada', icon: 'sliders', color: Colors.accent.primary },
    ],
  },
];

interface ComponentPaletteProps {
  visible: boolean;
  onSelect: (type: string) => void;
  onClose: () => void;
  insideSection?: boolean;
}

export default function ComponentPalette({ visible, onSelect, onClose, insideSection }: ComponentPaletteProps) {
  const translateY = useSharedValue(SHEET_MAX);
  const backdropOpacity = useSharedValue(0);

  const animateIn = useCallback(() => {
    backdropOpacity.value = withTiming(1, TIMING);
    translateY.value = withTiming(0, TIMING);
  }, [backdropOpacity, translateY]);

  const animateOut = useCallback(
    (cb?: () => void) => {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(SHEET_MAX, { duration: 220, easing: Easing.in(Easing.cubic) }, () => {
        if (cb) runOnJS(cb)();
      });
    },
    [backdropOpacity, translateY],
  );

  useEffect(() => {
    if (visible) animateIn();
  }, [visible, animateIn]);

  const handleClose = useCallback(() => {
    animateOut(onClose);
  }, [animateOut, onClose]);

  const handleSelect = useCallback(
    (type: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(type);
      animateOut(onClose);
    },
    [onSelect, animateOut, onClose],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const visibleSections = useMemo(() => {
    if (!insideSection) return SECTIONS;
    return SECTIONS.map(section => ({
      ...section,
      items: section.items.filter(i => i.type !== '2col' && i.type !== '3col'),
    })).filter(s => s.items.length > 0);
  }, [insideSection]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.root}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        {/* Sheet */}
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={styles.handle} />

          <Text style={styles.title}>Insertar componente</Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            bounces={false}
          >
            {visibleSections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.items.map((item) => (
                  <Pressable
                    key={item.type}
                    onPress={() => handleSelect(item.type)}
                    style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                  >
                    <View style={[styles.iconDot, { backgroundColor: item.color + '14' }]}>
                      <Feather name={item.icon} size={18} color={item.color} />
                    </View>
                    <View style={styles.itemText}>
                      <Text style={styles.itemLabel}>{item.label}</Text>
                      <Text style={styles.itemDesc}>{item.desc}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
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
    maxHeight: SHEET_MAX,
    paddingTop: Spacing.md,
    ...Shadows.modal,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.medium,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
  },
  section: {
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.disabled,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    gap: Spacing.md,
  },
  itemPressed: {
    backgroundColor: Colors.background.elevated,
  },
  iconDot: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
  },
  itemLabel: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.medium,
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  itemDesc: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
});
