// SectionHeaderTile — thin marker for the start of a column section.
//
// Quiet column-count chip + width preset selector + delete X. No eyebrow
// label — the columns glyph names the type. Width presets read as
// editorial controls, not gold-tinted decoration.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Type, Spacing, Radius } from '../../../../theme/tokens';
import type { ColumnSectionContentNode } from '../../../../types/content';

const WIDTH_PRESETS_2 = [
  { label: '50 / 50', widths: undefined as number[] | undefined },
  { label: '30 / 70', widths: [0.3, 0.7] },
  { label: '70 / 30', widths: [0.7, 0.3] },
];
const WIDTH_PRESETS_3 = [
  { label: '1/3 cada', widths: undefined as number[] | undefined },
  { label: '50/25/25', widths: [0.5, 0.25, 0.25] },
  { label: '25/50/25', widths: [0.25, 0.5, 0.25] },
];

interface Props {
  sectionNode: ColumnSectionContentNode;
  onChangeWidth: (sectionId: string, widths?: number[]) => void;
  onDelete: (sectionId: string) => void;
}

function SectionHeaderTileImpl({ sectionNode, onChangeWidth, onDelete }: Props) {
  const cols = sectionNode.data.columns;
  const widths = sectionNode.data.widths;
  const presets = cols === 2 ? WIDTH_PRESETS_2 : WIDTH_PRESETS_3;

  return (
    <View style={styles.row}>
      <View style={styles.colChip}>
        <Feather name="columns" size={11} color={Colors.ink.secondary} />
        <Text style={styles.colChipText}>{cols} col</Text>
      </View>
      <View style={styles.presets}>
        {presets.map((preset, i) => {
          const isActive = preset.widths
            ? JSON.stringify(widths) === JSON.stringify(preset.widths)
            : !widths;
          return (
            <Pressable
              key={i}
              onPress={() => onChangeWidth(sectionNode.id, preset.widths)}
              style={[styles.presetBtn, isActive && styles.presetBtnActive]}
              accessibilityLabel={`Anchos ${preset.label}`}
            >
              <Text style={[styles.presetText, isActive && styles.presetTextActive]}>
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={() => onDelete(sectionNode.id)}
        hitSlop={10}
        accessibilityLabel="Eliminar sección"
      >
        <Feather name="x" size={14} color={Colors.ink.tertiary} />
      </Pressable>
    </View>
  );
}

const SectionHeaderTile = React.memo(SectionHeaderTileImpl);
export default SectionHeaderTile;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.sm,
  },
  colChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.pill,
  },
  colChipText: {
    ...Type.micro,
    color: Colors.ink.secondary,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  presets: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
  },
  presetBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  presetBtnActive: {
    backgroundColor: Colors.bg.surface,
  },
  presetText: {
    fontSize: 9,
    fontWeight: '500',
    color: Colors.ink.muted,
  },
  presetTextActive: {
    color: Colors.ink.primary,
    fontWeight: '700',
  },
});
