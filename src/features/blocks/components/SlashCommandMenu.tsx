import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors, Typography, Spacing, Radius, Shadows } from '../../../theme/index';

interface SlashItem {
  type: string;
  label: string;
  desc: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  keywords: string[];
}

const SLASH_ITEMS: SlashItem[] = [
  { type: 'text', label: 'Texto', desc: 'Párrafo', icon: 'type', color: Colors.text.secondary, keywords: ['text', 'texto', 'paragraph', 'parrafo'] },
  { type: 'text_h1', label: 'Título 1', desc: 'Heading grande', icon: 'bold', color: Colors.text.primary, keywords: ['h1', 'heading', 'titulo', 'title'] },
  { type: 'text_h2', label: 'Título 2', desc: 'Heading mediano', icon: 'bold', color: Colors.text.primary, keywords: ['h2', 'heading2', 'subtitle'] },
  { type: 'text_h3', label: 'Título 3', desc: 'Heading pequeño', icon: 'bold', color: Colors.text.secondary, keywords: ['h3', 'heading3'] },
  { type: 'text_bullet', label: 'Lista', desc: 'Viñetas', icon: 'list', color: '#3B82F6', keywords: ['list', 'lista', 'bullet'] },
  { type: 'text_numbered', label: 'Numerada', desc: 'Lista ordenada', icon: 'list', color: '#3B82F6', keywords: ['numbered', 'numerada', 'ordered'] },
  { type: 'text_checklist', label: 'Checklist', desc: 'Lista con casillas', icon: 'check-square', color: '#10B981', keywords: ['checklist', 'todo', 'check', 'tarea'] },
  { type: 'divider', label: 'Separador', desc: 'Línea horizontal', icon: 'minus', color: Colors.text.tertiary, keywords: ['divider', 'separador', 'line', 'hr'] },
  { type: 'exercise', label: 'Ejercicio', desc: 'Series y campos', icon: 'activity', color: '#E84545', keywords: ['exercise', 'ejercicio', 'workout'] },
  { type: 'subBlock', label: 'Sub-bloque', desc: 'Bloque anidado', icon: 'layers', color: '#8B5CF6', keywords: ['subblock', 'sub', 'page', 'pagina'] },
  { type: 'dashboard', label: 'Dashboard', desc: 'Volumen, series...', icon: 'bar-chart-2', color: Colors.accent.primary, keywords: ['dashboard', 'widget', 'chart'] },
  { type: 'dashboard_progress', label: 'Progreso', desc: 'Barra de progreso', icon: 'pie-chart', color: '#10B981', keywords: ['progress', 'progreso'] },
  { type: 'dashboard_list', label: 'Lista de datos', desc: 'Estado por ejercicio', icon: 'list', color: '#3B82F6', keywords: ['data', 'datos', 'estado'] },
  { type: 'image', label: 'Imagen', desc: 'Foto o cámara', icon: 'image', color: '#06B6D4', keywords: ['image', 'imagen', 'foto'] },
  { type: 'timer', label: 'Cuenta regresiva', desc: 'Temporizador', icon: 'clock', color: '#06B6D4', keywords: ['timer', 'temporizador', 'countdown'] },
  { type: 'timer_stopwatch', label: 'Cronómetro', desc: 'Tiempo libre', icon: 'watch', color: '#06B6D4', keywords: ['stopwatch', 'cronometro', 'crono'] },
  { type: 'rest', label: 'Descanso', desc: 'Temporizador de pausa', icon: 'pause-circle', color: '#64748B', keywords: ['rest', 'descanso', 'pausa'] },
  { type: 'spacer', label: 'Espaciador', desc: 'Espacio vacío', icon: 'maximize', color: Colors.text.disabled, keywords: ['spacer', 'espacio', 'separar'] },
  { type: 'superset', label: 'Superserie', desc: 'Ejercicios encadenados', icon: 'repeat', color: '#EC4899', keywords: ['superset', 'superserie'] },
  { type: '2col', label: '2 columnas', desc: 'Sección de 2 columnas', icon: 'columns', color: Colors.accent.primary, keywords: ['2col', 'columna', 'columns', 'dos', 'split'] },
  { type: '3col', label: '3 columnas', desc: 'Sección de 3 columnas', icon: 'columns', color: Colors.accent.primary, keywords: ['3col', 'columna', 'columns', 'tres', 'triple'] },
];

interface SlashCommandMenuProps {
  query: string;
  onSelect: (type: string) => void;
  insideSection?: boolean;
}

function SlashCommandMenu({ query, onSelect, insideSection }: SlashCommandMenuProps) {
  const filtered = useMemo(() => {
    let items = SLASH_ITEMS;
    if (insideSection) {
      items = items.filter(i => i.type !== '2col' && i.type !== '3col');
    }
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter(
      item =>
        item.label.toLowerCase().includes(q) ||
        item.keywords.some(k => k.includes(q)),
    );
  }, [query, insideSection]);

  if (filtered.length === 0) return null;

  return (
    <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(80)} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Bloques</Text>
        <Text style={styles.headerHint}>{filtered.length} resultados</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {filtered.map(item => (
          <Pressable
            key={item.type}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(item.type);
            }}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          >
            <View style={[styles.iconDot, { backgroundColor: item.color + '14' }]}>
              <Feather name={item.icon} size={16} color={item.color} />
            </View>
            <View style={styles.itemText}>
              <Text style={styles.itemLabel}>{item.label}</Text>
              <Text style={styles.itemDesc} numberOfLines={1}>{item.desc}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

export default React.memo(SlashCommandMenu);

export { SLASH_ITEMS };

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border.light,
    maxHeight: 280,
    ...Shadows.card,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.subtle,
  },
  headerText: {
    fontSize: Typography.size.micro,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  headerHint: {
    fontSize: Typography.size.micro,
    color: Colors.text.disabled,
  },
  scroll: {
    maxHeight: 240,
  },
  scrollContent: {
    paddingVertical: Spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  itemPressed: {
    backgroundColor: Colors.background.elevated,
  },
  iconDot: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
  },
  itemLabel: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.medium,
    color: Colors.text.primary,
  },
  itemDesc: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
});
