// NoteTile — Spine-Bento variant for text nodes. Adds a slim gold accent
// on the left edge and italicizes paragraph text to read as a margin note.
// Delegates inline editing to TextBlockNode.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../../../../theme/tokens';
import TextBlockNode from '../TextBlockNode';
import type { TextContentNode, TextFormat } from '../../../../types/content';

interface Props {
  node: TextContentNode;
  onUpdate: (nodeId: string, content: string) => void;
  onChangeFormat: (nodeId: string, format: TextFormat) => void;
  onToggleCheck: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onInsertAfter: (nodeId: string) => void;
}

function NoteTileImpl(props: Props) {
  const isParagraph = props.node.data.format === 'paragraph';
  return (
    <View style={[styles.frame, isParagraph && styles.frameNote]}>
      {isParagraph && <View style={styles.accent} />}
      <View style={[styles.body, isParagraph && styles.bodyNote]}>
        <TextBlockNode
          node={props.node}
          onUpdate={props.onUpdate}
          onChangeFormat={props.onChangeFormat}
          onToggleCheck={props.onToggleCheck}
          onDelete={props.onDelete}
          onInsertAfter={props.onInsertAfter}
          compact={false}
        />
      </View>
    </View>
  );
}

const NoteTile = React.memo(NoteTileImpl);
export default NoteTile;

const styles = StyleSheet.create({
  frame: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  frameNote: {
    backgroundColor: Colors.bg.warm,
    borderRadius: 8,
  },
  accent: {
    width: 2,
    marginVertical: 4,
    backgroundColor: Colors.hair.strong,
    borderRadius: 1,
  },
  body: {
    flex: 1,
  },
  bodyNote: {
    paddingLeft: Spacing.sm,
  },
});
