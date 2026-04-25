import React, { useState, useCallback, useRef } from 'react';
import { TextInput, Text, Pressable, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import type { TextContentNode, TextFormat } from '../../../types/content';
import { Colors, Typography, Spacing, Radius } from '../../../theme/index';

interface TextBlockNodeProps {
  node: TextContentNode;
  onUpdate: (nodeId: string, content: string) => void;
  onChangeFormat: (nodeId: string, format: TextFormat) => void;
  onToggleCheck: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onInsertAfter: (nodeId: string) => void;
  compact?: boolean;
}

const FORMAT_STYLES: Record<TextFormat, any> = {
  paragraph: {
    fontSize: Typography.size.body,
    color: Colors.text.primary,
    lineHeight: Typography.size.body * Typography.lineHeight.relaxed,
  },
  h1: {
    fontSize: Typography.size.title,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    letterSpacing: Typography.tracking.tight,
    lineHeight: Typography.size.title * 1.3,
  },
  h2: {
    fontSize: Typography.size.heading,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    lineHeight: Typography.size.heading * 1.3,
  },
  h3: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.secondary,
    lineHeight: Typography.size.subheading * Typography.lineHeight.normal,
  },
  bullet: {
    fontSize: Typography.size.body,
    color: Colors.text.primary,
    lineHeight: Typography.size.body * Typography.lineHeight.relaxed,
  },
  numbered: {
    fontSize: Typography.size.body,
    color: Colors.text.primary,
    lineHeight: Typography.size.body * Typography.lineHeight.relaxed,
  },
  checklist: {
    fontSize: Typography.size.body,
    color: Colors.text.primary,
    lineHeight: Typography.size.body * Typography.lineHeight.relaxed,
  },
};

const PLACEHOLDER: Record<TextFormat, string> = {
  paragraph: 'Escribe aquí...',
  h1: 'Título 1',
  h2: 'Título 2',
  h3: 'Título 3',
  bullet: 'Elemento de lista',
  numbered: 'Elemento numerado',
  checklist: 'Tarea',
};

function TextBlockNodeInner({
  node,
  onUpdate,
  onChangeFormat,
  onToggleCheck,
  onDelete,
  onInsertAfter,
}: TextBlockNodeProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.data.content);
  const inputRef = useRef<TextInput>(null);

  const handleStartEdit = useCallback(() => {
    setDraft(node.data.content);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [node.data.content]);

  const handleEndEdit = useCallback(() => {
    setEditing(false);
    if (draft !== node.data.content) {
      onUpdate(node.id, draft);
    }
    if (draft.trim() === '' && node.data.format === 'paragraph') {
      onDelete(node.id);
    }
  }, [draft, node.id, node.data.content, node.data.format, onUpdate, onDelete]);

  const handleSubmit = useCallback(() => {
    handleEndEdit();
    onInsertAfter(node.id);
  }, [handleEndEdit, onInsertAfter, node.id]);

  const isHeading = node.data.format === 'h1' || node.data.format === 'h2' || node.data.format === 'h3';
  const placeholder = PLACEHOLDER[node.data.format];

  return (
    <View style={[styles.container, isHeading && styles.headingContainer]}>
      {node.data.format === 'checklist' && (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggleCheck(node.id);
          }}
          style={styles.checkArea}
          hitSlop={4}
        >
          <View style={[styles.checkbox, node.data.checked && styles.checkboxChecked]}>
            {node.data.checked && <Feather name="check" size={11} color={Colors.text.inverse} />}
          </View>
        </Pressable>
      )}

      {node.data.format === 'bullet' && (
        <View style={styles.bulletArea}>
          <View style={styles.bulletDot} />
        </View>
      )}

      {node.data.format === 'numbered' && (
        <View style={styles.bulletArea}>
          <Text style={styles.numberedLabel}>#</Text>
        </View>
      )}

      {editing ? (
        <TextInput
          ref={inputRef}
          style={[FORMAT_STYLES[node.data.format], styles.input, node.data.checked && styles.checkedText]}
          value={draft}
          onChangeText={setDraft}
          onBlur={handleEndEdit}
          onSubmitEditing={handleSubmit}
          multiline={node.data.format === 'paragraph'}
          blurOnSubmit={node.data.format !== 'paragraph'}
          placeholder={placeholder}
          placeholderTextColor={Colors.text.disabled}
          autoFocus
        />
      ) : (
        <Pressable onPress={handleStartEdit} style={styles.textPressable}>
          {node.data.content ? (
            <Text style={[FORMAT_STYLES[node.data.format], node.data.checked && styles.checkedText]}>
              {node.data.content}
            </Text>
          ) : (
            <Text style={[FORMAT_STYLES[node.data.format], styles.placeholder]}>
              {placeholder}
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

export default React.memo(TextBlockNodeInner);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 28,
    paddingVertical: 3,
  },
  headingContainer: {
    paddingTop: Spacing.md,
    paddingBottom: 2,
  },
  input: {
    flex: 1,
    padding: 0,
    margin: 0,
  },
  textPressable: {
    flex: 1,
    minHeight: 24,
  },
  placeholder: {
    color: Colors.text.disabled,
    fontStyle: 'italic',
  },
  checkArea: {
    width: 24,
    paddingTop: 4,
    alignItems: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.accent.primary,
    borderColor: Colors.accent.primary,
  },
  checkedText: {
    textDecorationLine: 'line-through',
    color: Colors.text.tertiary,
  },
  bulletArea: {
    width: 24,
    paddingTop: 8,
    alignItems: 'center',
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.text.tertiary,
  },
  numberedLabel: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.tertiary,
  },
});
