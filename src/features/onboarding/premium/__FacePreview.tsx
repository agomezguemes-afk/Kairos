// TEMP — preview Kai's face across emotions. Delete after review.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing, Type } from '../../../theme/tokens';
import KaiFace, { type KaiEmotion } from './KaiFace';

const ROW: { e: KaiEmotion; label: string }[] = [
  { e: 'idle', label: 'idle' },
  { e: 'happy', label: 'happy' },
  { e: 'thinking', label: 'thinking' },
  { e: 'proud', label: 'proud' },
];

export default function FacePreview() {
  return (
    <View style={styles.root}>
      <KaiFace size={150} emotion="idle" />
      <View style={styles.row}>
        {ROW.map(({ e, label }) => (
          <View key={e} style={styles.cell}>
            <KaiFace size={66} emotion={e} />
            <Text style={styles.tag}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg.void,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 48,
  },
  row: { flexDirection: 'row', gap: Spacing.lg, flexWrap: 'wrap', justifyContent: 'center' },
  cell: { alignItems: 'center', gap: 8 },
  tag: { ...Type.micro, color: Colors.ink.muted },
});
