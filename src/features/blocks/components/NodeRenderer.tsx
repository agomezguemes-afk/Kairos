import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';

import TextBlockNode from './TextBlockNode';
import ExerciseRow from './ExerciseRow';
import SubBlockNode from './SubBlockNode';
import DashboardNode from './DashboardNode';
import TimerNode from './TimerNode';
import ImageNode from './ImageNode';

import type { ContentNode, TextFormat } from '../../../types/content';
import { useWorkoutStore } from '../../../store/workoutStore';
import { useBlockEditor } from '../hooks/useBlockEditor';
import { Colors } from '../../../theme/index';

interface NodeRendererProps {
  blockId: string;
  nodeId: string;
  compact?: boolean;
  onSubBlockNavigate?: (subBlockId: string) => void;
}

export default function NodeRenderer({ blockId, nodeId, compact = false, onSubBlockNavigate }: NodeRendererProps) {
  const node = useWorkoutStore(
    useCallback(
      (s) => s.blocks.find((b) => b.id === blockId)?.content.find((n) => n.id === nodeId) ?? null,
      [blockId, nodeId],
    ),
  );
  const block = useWorkoutStore(
    useCallback((s) => s.blocks.find((b) => b.id === blockId) ?? null, [blockId]),
  );

  const updateContentNode = useWorkoutStore((s) => s.updateContentNode);
  const deleteContentNode = useWorkoutStore((s) => s.deleteContentNode);

  const {
    handleUpdateExerciseName,
    handleDeleteExercise,
    handleUpdateSetValue,
    handleToggleSetComplete,
    handleAddSet,
    handleRemoveSet,
  } = useBlockEditor(blockId);

  const handleTextUpdate = useCallback(
    (id: string, content: string) => {
      const n = block?.content.find((x) => x.id === id);
      const format = n?.type === 'text' ? n.data.format : 'paragraph';
      updateContentNode(blockId, id, { data: { content, format } } as any);
    },
    [block, blockId, updateContentNode],
  );

  const handleTextFormatChange = useCallback(
    (id: string, format: TextFormat) => {
      const n = block?.content.find((x) => x.id === id);
      if (!n || n.type !== 'text') return;
      updateContentNode(blockId, id, { data: { ...n.data, format } } as any);
    },
    [block, blockId, updateContentNode],
  );

  const handleCheckToggle = useCallback(
    (id: string) => {
      const n = block?.content.find((x) => x.id === id);
      if (!n || n.type !== 'text') return;
      updateContentNode(blockId, id, { data: { ...n.data, checked: !n.data.checked } } as any);
    },
    [block, blockId, updateContentNode],
  );

  const handleDeleteNode = useCallback(
    (id: string) => deleteContentNode(blockId, id),
    [blockId, deleteContentNode],
  );

  const handleNodeDataUpdate = useCallback(
    (id: string, data: any) => {
      updateContentNode(blockId, id, { data } as any);
    },
    [blockId, updateContentNode],
  );

  const noopInsert = useCallback((_id: string) => {}, []);

  if (!node) return null;

  switch (node.type) {
    case 'text':
      return (
        <TextBlockNode
          node={node}
          onUpdate={handleTextUpdate}
          onChangeFormat={handleTextFormatChange}
          onToggleCheck={handleCheckToggle}
          onDelete={handleDeleteNode}
          onInsertAfter={noopInsert}
          compact={compact}
        />
      );
    case 'exercise':
      return (
        <ExerciseRow
          exercise={node.data.exercise}
          blockId={blockId}
          index={node.order}
          onUpdateName={handleUpdateExerciseName}
          onUpdateSetValue={handleUpdateSetValue}
          onToggleSetComplete={handleToggleSetComplete}
          onAddSet={handleAddSet}
          onRemoveSet={handleRemoveSet}
          onDeleteExercise={handleDeleteExercise}
          compact={compact}
        />
      );
    case 'subBlock':
      return (
        <SubBlockNode
          node={node}
          onNavigate={onSubBlockNavigate ?? (() => {})}
          onDelete={handleDeleteNode}
        />
      );
    case 'divider':
      return <View style={styles.divider} />;
    case 'image':
      return (
        <ImageNode node={node} onUpdate={handleNodeDataUpdate} onDelete={handleDeleteNode} compact={compact} />
      );
    case 'timer':
      return (
        <TimerNode node={node} onUpdate={handleNodeDataUpdate} onDelete={handleDeleteNode} compact={compact} />
      );
    case 'spacer':
      return <View style={{ height: compact ? Math.max(node.data.height * 0.6, 12) : node.data.height }} />;
    case 'dashboard':
      if (!block) return null;
      return (
        <DashboardNode
          node={node}
          block={block}
          onUpdate={handleNodeDataUpdate}
          onDelete={handleDeleteNode}
          compact={compact}
        />
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border.light,
    marginVertical: 8,
  },
});
