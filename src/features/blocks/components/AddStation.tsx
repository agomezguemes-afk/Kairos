// AddStation — trailing "+" station that lives at the end of the spine.
//
// Visual rhyme with regular station nodes: same 14pt circle, gold deep
// border, but with a centered "+" glyph. Tapping it expands a vertical
// inline menu of insertable node types (no modal). Each menu row calls
// onInsert(type) and re-collapses.

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Type, Spacing, Radius, Shadows } from '../../../theme/tokens';
import { SPINE_RAIL_WIDTH } from './SpineRow';

const STATION_SIZE = 14;

export type InsertableType =
  | 'exercise'
  | 'superset'
  | 'text'
  | 'divider'
  | '2col'
  | 'dashboard';

interface MenuItem {
  type: InsertableType;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  hint: string;
}

const MENU: MenuItem[] = [
  { type: 'exercise',  label: 'Ejercicio',  icon: 'activity',  hint: 'Nuevo ejercicio con series' },
  { type: 'superset',  label: 'Superserie', icon: 'shuffle',   hint: '2-3 ejercicios encadenados' },
  { type: 'text',      label: 'Nota',       icon: 'edit-3',    hint: 'Texto, lista o checklist' },
  { type: 'divider',   label: 'Divisor',    icon: 'minus',     hint: 'Separador entre secciones' },
  { type: '2col',      label: 'Sección',    icon: 'columns',   hint: 'Agrupa contenidos' },
  { type: 'dashboard', label: 'Dashboard',  icon: 'bar-chart-2', hint: 'Métrica del bloque' },
];

interface Props {
  onInsert: (type: InsertableType) => void;
}

function AddStationImpl({ onInsert }: Props) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const toggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpen(o => !o);
  }, []);

  const handleSelect = useCallback(
    (type: InsertableType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setOpen(false);
      onInsert(type);
    },
    [onInsert],
  );

  return (
    <Animated.View
      layout={
        reduceMotion
          ? undefined
          : LinearTransition.duration(220).easing(Easing.out(Easing.cubic))
      }
      style={styles.wrap}
    >
      <View style={styles.row}>
        <Pressable
          onPress={toggle}
          hitSlop={20}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Cerrar menú añadir' : 'Añadir elemento'}
          style={styles.rail}
        >
          <View style={[styles.node, open && styles.nodeOpen]}>
            <Feather
              name={open ? 'x' : 'plus'}
              size={9}
              color={open ? Colors.ink.inverse : Colors.gold.deep}
            />
          </View>
        </Pressable>
        {!open && (
          <Pressable onPress={toggle} style={styles.label}>
            <Text style={styles.labelText}>Añadir elemento</Text>
          </Pressable>
        )}
      </View>

      {open && (
        <Animated.View
          entering={reduceMotion ? FadeIn.duration(100) : FadeIn.duration(180)}
          exiting={reduceMotion ? FadeOut.duration(80) : FadeOut.duration(140)}
          style={styles.menu}
        >
          {MENU.map((item, i) => (
            <Pressable
              key={item.type}
              onPress={() => handleSelect(item.type)}
              style={({ pressed }) => [
                styles.menuRow,
                pressed && styles.menuRowPressed,
                i === MENU.length - 1 && styles.menuRowLast,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Añadir ${item.label}`}
              accessibilityHint={item.hint}
            >
              <View style={styles.menuIcon}>
                <Feather name={item.icon} size={14} color={Colors.gold.deep} />
              </View>
              <View style={styles.menuTextBlock}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuHint}>{item.hint}</Text>
              </View>
            </Pressable>
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const AddStation = React.memo(AddStationImpl);
export default AddStation;

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
  },
  rail: {
    width: SPINE_RAIL_WIDTH,
    paddingTop: 8,
    alignItems: 'center',
  },
  node: {
    width: STATION_SIZE,
    height: STATION_SIZE,
    borderRadius: STATION_SIZE / 2,
    backgroundColor: Colors.bg.void,
    borderWidth: 2,
    borderColor: Colors.gold.deep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeOpen: {
    backgroundColor: Colors.gold.deep,
    borderColor: Colors.gold.deep,
  },
  label: {
    flex: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  labelText: {
    ...Type.caption,
    color: Colors.gold.deep,
    fontWeight: '600',
  },
  menu: {
    marginLeft: SPINE_RAIL_WIDTH,
    marginTop: Spacing.xs,
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hair.base,
    overflow: 'hidden',
    ...Shadows.card,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hair.subtle,
  },
  menuRowLast: {
    borderBottomWidth: 0,
  },
  menuRowPressed: {
    backgroundColor: Colors.bg.elevated,
  },
  menuIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.gold.glow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextBlock: {
    flex: 1,
  },
  menuLabel: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
  },
  menuHint: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    marginTop: 2,
  },
});
