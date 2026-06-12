import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import TextBlockNode from './components/TextBlockNode';
import ExerciseRow from './components/ExerciseRow';
import SubBlockNode from './components/SubBlockNode';
import DashboardNode from './components/DashboardNode';
import TimerNode from './components/TimerNode';
import ImageNode from './components/ImageNode';
import AddExerciseSheet from './components/AddExerciseSheet';
import ExerciseLibrarySheet from './components/ExerciseLibrarySheet';
import ComponentPalette from './components/ComponentPalette';
import BlockActionSheet from './components/BlockActionSheet';
import BlockAISheet from './components/BlockAISheet';
import Spine from './components/Spine';
import AddStation, { type InsertableType } from './components/AddStation';
import CompoundTile from './components/tiles/CompoundTile';
import AccessoryTile from './components/tiles/AccessoryTile';
import SectionHeaderTile from './components/tiles/SectionHeaderTile';
import NoteTile from './components/tiles/NoteTile';
import InlineDashboardTile from './components/tiles/InlineDashboardTile';
import SupersetTile from './components/tiles/SupersetTile';
import EmptyState from '../../components/EmptyState';
import CompletionCelebration from '../../components/CompletionCelebration';
import ConfettiBurst, { type ConfettiRef } from '../../components/ConfettiParticles';

import { useWorkoutStore } from '../../store/workoutStore';
import type { WorkoutBlock, Discipline } from '../../types/core';
import { calculateBlockStats } from '../../types/core';
import type { ContentNode, TextFormat, ColumnSectionContentNode } from '../../types/content';
import {
  createTextNode,
  createSubBlockNode,
  createDividerNode,
  createImageNode,
  createDashboardNode,
  createTimerNode,
  createSpacerNode,
  createColumnSectionNode,
  createSupersetNode,
  getNextOrder,
} from '../../types/content';
import { buildSpineRows, type SpineRow as SpineRowData } from './lib/spineLayout';
import type { RootStackParamList } from '../../types/navigation';
import { Colors, Typography, Spacing, Shadows } from '../../theme/index';

import { useBlockEditor } from './hooks/useBlockEditor';

// ======================== MAIN COMPONENT ========================

export default function BlockEditorScreen({ route, navigation: nav }: any) {
  const { blockId } = route.params as { blockId: string };
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const confettiRef = useRef<ConfettiRef | null>(null);

  const {
    block,
    handleUpdateName,
    handleToggleFavorite,
    handleDelete,
    handleAddExercise,
    handleUpdateExerciseName,
    handleDeleteExercise,
    handleUpdateSetValue,
    handleToggleSetComplete,
    handleAddSet,
    handleRemoveSet,
  } = useBlockEditor(blockId);

  const addContentNode = useWorkoutStore((s) => s.addContentNode);
  const updateContentNode = useWorkoutStore((s) => s.updateContentNode);
  const deleteContentNode = useWorkoutStore((s) => s.deleteContentNode);
  const duplicateContentNode = useWorkoutStore((s) => s.duplicateContentNode);
  const moveContentNode = useWorkoutStore((s) => s.moveContentNode);
  const reorderContentNodes = useWorkoutStore((s) => s.reorderContentNodes);
  const updateBlock = useWorkoutStore((s) => s.updateBlock);
  const addBlock = useWorkoutStore((s) => s.addBlock);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [showPalette, setShowPalette] = useState(false);
  const [insertAfterNodeId, setInsertAfterNodeId] = useState<string | null>(null);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [celebrationBlock, setCelebrationBlock] = useState<WorkoutBlock | null>(null);
  const [addExerciseSection, setAddExerciseSection] = useState<string | null>(null);
  const [addExerciseColumn, setAddExerciseColumn] = useState(0);
  const [paletteSection, setPaletteSection] = useState<string | null>(null);
  const [paletteColumn, setPaletteColumn] = useState(0);

  // Block action sheet state
  const [actionNode, setActionNode] = useState<ContentNode | null>(null);
  const [showActions, setShowActions] = useState(false);

  // Floating AI assistant
  const [showAI, setShowAI] = useState(false);

  const stats = useMemo(() => (block ? calculateBlockStats(block) : null), [block]);

  const spineRows = useMemo(() => (block ? buildSpineRows(block.content) : []), [block]);

  // ── Sticky header — header chrome rises with a blur backdrop when the
  // user scrolls past the block title. Empty-state-friendly: the block
  // name appears centered in the header so the user always knows where
  // they are. Apple Notes / Mail pattern.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const headerBackdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [40, 90], [0, 1], Extrapolation.CLAMP),
  }));
  const headerTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [60, 110], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(scrollY.value, [60, 110], [6, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  // ======================== NAME EDITING ========================

  const handleNameEdit = useCallback(() => {
    if (!block) return;
    setNameDraft(block.name);
    setEditingName(true);
  }, [block]);

  const handleNameSubmit = useCallback(() => {
    setEditingName(false);
    if (nameDraft.trim()) handleUpdateName(nameDraft.trim());
  }, [nameDraft, handleUpdateName]);

  // ======================== HELPERS ========================

  const normalizeOrders = useCallback(() => {
    const fresh = useWorkoutStore.getState().blocks.find((b) => b.id === blockId);
    if (!fresh) return;
    const sorted = [...fresh.content].sort((a, b) => a.order - b.order);
    const renumbered = sorted.map((n, i) => ({ ...n, order: i }));
    updateBlock(blockId, { content: renumbered as ContentNode[] });
  }, [blockId, updateBlock]);

  // ======================== NODE INSERTION ========================

  const insertNode = useCallback(
    (type: string, sectionId: string | null, colIdx: number, afterNodeId?: string) => {
      if (!block) return;

      let order: number;
      if (afterNodeId) {
        const afterNode = block.content.find((n) => n.id === afterNodeId);
        order = afterNode ? afterNode.order + 0.5 : getNextOrder(block.content);
      } else {
        const relevant = sectionId
          ? block.content.filter((n) => n.section === sectionId && (n.column ?? 0) === colIdx)
          : block.content.filter((n) => !n.section);
        order = getNextOrder(relevant.length > 0 ? relevant : block.content);
      }

      const base = { column: colIdx, section: sectionId ?? undefined };

      const createAndAdd = (node: ContentNode) => {
        addContentNode(blockId, { ...node, ...base } as ContentNode);
        setTimeout(normalizeOrders, 50);
      };

      switch (type) {
        case 'text':
          createAndAdd(createTextNode(order));
          break;
        case 'text_h1':
          createAndAdd(createTextNode(order, 'h1'));
          break;
        case 'text_h2':
          createAndAdd(createTextNode(order, 'h2'));
          break;
        case 'text_h3':
          createAndAdd(createTextNode(order, 'h3'));
          break;
        case 'text_bullet':
          createAndAdd(createTextNode(order, 'bullet'));
          break;
        case 'text_numbered':
          createAndAdd(createTextNode(order, 'numbered'));
          break;
        case 'text_checklist':
          createAndAdd(createTextNode(order, 'checklist'));
          break;
        case 'callout':
          createAndAdd(createTextNode(order, 'paragraph', ''));
          break;
        case 'exercise': {
          setAddExerciseSection(sectionId);
          setAddExerciseColumn(colIdx);
          setShowAddExercise(true);
          return;
        }
        case 'subBlock': {
          const subId = addBlock(block.discipline, { name: 'Nuevo sub-bloque' });
          createAndAdd(createSubBlockNode(order, subId));
          break;
        }
        case 'timer':
          createAndAdd(createTimerNode(order));
          break;
        case 'timer_stopwatch':
          createAndAdd(createTimerNode(order, 'stopwatch'));
          break;
        case 'rest':
          createAndAdd(createTimerNode(order, 'countdown', 60, 'Descanso'));
          break;
        case 'spacer':
          createAndAdd(createSpacerNode(order));
          break;
        case 'superset':
          createAndAdd(createSupersetNode(order));
          break;
        case 'divider':
          createAndAdd(createDividerNode(order));
          break;
        case 'image':
          createAndAdd(createImageNode(order));
          break;
        case 'link':
          createAndAdd(createTextNode(order, 'paragraph', ''));
          break;
        case 'customField':
          createAndAdd(createTextNode(order, 'paragraph', ''));
          break;
        case 'dashboard':
          createAndAdd(
            createDashboardNode(
              order,
              'total_volume',
              'counter',
              undefined,
              block.color || Colors.accent.primary,
            ),
          );
          break;
        case 'dashboard_progress':
          createAndAdd(
            createDashboardNode(
              order,
              'completion_pct',
              'progress',
              undefined,
              block.color || Colors.accent.primary,
            ),
          );
          break;
        case 'dashboard_list':
          createAndAdd(
            createDashboardNode(
              order,
              'total_exercises',
              'list',
              undefined,
              block.color || Colors.accent.primary,
            ),
          );
          break;
        case '2col': {
          const secNode = createColumnSectionNode(order, 2);
          addContentNode(blockId, secNode);
          setTimeout(normalizeOrders, 50);
          break;
        }
        case '3col': {
          const secNode = createColumnSectionNode(order, 3);
          addContentNode(blockId, secNode);
          setTimeout(normalizeOrders, 50);
          break;
        }
      }
    },
    [block, blockId, addContentNode, addBlock, normalizeOrders],
  );

  // ======================== NODE HANDLERS ========================

  const handleTextUpdate = useCallback(
    (nodeId: string, content: string) => {
      if (!block) return;
      const node = block.content.find((n) => n.id === nodeId);
      const format = node?.type === 'text' ? node.data.format : 'paragraph';
      updateContentNode(blockId, nodeId, { data: { content, format } } as any);
    },
    [block, blockId, updateContentNode],
  );

  const handleTextFormatChange = useCallback(
    (nodeId: string, format: TextFormat) => {
      if (!block) return;
      const node = block.content.find((n) => n.id === nodeId);
      if (!node || node.type !== 'text') return;
      updateContentNode(blockId, nodeId, { data: { ...node.data, format } } as any);
    },
    [block, blockId, updateContentNode],
  );

  const handleCheckToggle = useCallback(
    (nodeId: string) => {
      if (!block) return;
      const node = block.content.find((n) => n.id === nodeId);
      if (!node || node.type !== 'text') return;
      updateContentNode(blockId, nodeId, {
        data: { ...node.data, checked: !node.data.checked },
      } as any);
    },
    [block, blockId, updateContentNode],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (!block) return;
      const node = block.content.find((n) => n.id === nodeId);
      if (node?.type === 'columnSection') {
        const fresh = useWorkoutStore.getState().blocks.find((b) => b.id === blockId);
        if (fresh) {
          const children = fresh.content.filter((n) => n.section === nodeId);
          for (const child of children) {
            updateContentNode(blockId, child.id, { section: undefined, column: 0 } as any);
          }
        }
      }
      deleteContentNode(blockId, nodeId);
      setTimeout(normalizeOrders, 50);
    },
    [block, blockId, deleteContentNode, updateContentNode, normalizeOrders],
  );

  const handleDashboardUpdate = useCallback(
    (nodeId: string, data: any) => {
      updateContentNode(blockId, nodeId, { data } as any);
    },
    [blockId, updateContentNode],
  );

  const handleTimerUpdate = useCallback(
    (nodeId: string, data: any) => {
      updateContentNode(blockId, nodeId, { data } as any);
    },
    [blockId, updateContentNode],
  );

  const handleImageUpdate = useCallback(
    (nodeId: string, data: any) => {
      updateContentNode(blockId, nodeId, { data } as any);
    },
    [blockId, updateContentNode],
  );

  const handleInsertAfter = useCallback(
    (nodeId: string) => {
      if (!block) return;
      const node = block.content.find((n) => n.id === nodeId);
      setInsertAfterNodeId(nodeId);
      setPaletteSection(node?.section ?? null);
      setPaletteColumn(node?.column ?? 0);
      setShowPalette(true);
    },
    [block],
  );

  // ======================== COMPONENT PALETTE ========================

  const handleOpenPalette = useCallback((sectionId?: string | null, colIdx?: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInsertAfterNodeId(null);
    setPaletteSection(sectionId ?? null);
    setPaletteColumn(colIdx ?? 0);
    setShowPalette(true);
  }, []);

  const handlePaletteSelect = useCallback(
    (type: string) => {
      if (!block) return;
      if (insertAfterNodeId) {
        const afterNode = block.content.find((n) => n.id === insertAfterNodeId);
        insertNode(type, afterNode?.section ?? null, afterNode?.column ?? 0, insertAfterNodeId);
      } else {
        insertNode(type, paletteSection, paletteColumn);
      }
      setInsertAfterNodeId(null);
      setPaletteSection(null);
      setPaletteColumn(0);
    },
    [block, insertAfterNodeId, insertNode, paletteSection, paletteColumn],
  );

  // ======================== BLOCK ACTIONS ========================

  const handleOpenActions = useCallback((node: ContentNode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActionNode(node);
    setShowActions(true);
  }, []);

  const handleDuplicate = useCallback(
    (nodeId: string) => {
      duplicateContentNode(blockId, nodeId);
    },
    [blockId, duplicateContentNode],
  );

  const handleMoveUp = useCallback(
    (nodeId: string) => {
      moveContentNode(blockId, nodeId, 'up');
    },
    [blockId, moveContentNode],
  );

  const handleMoveDown = useCallback(
    (nodeId: string) => {
      moveContentNode(blockId, nodeId, 'down');
    },
    [blockId, moveContentNode],
  );

  const handleTurnInto = useCallback(
    (nodeId: string, format: TextFormat) => {
      const fresh = useWorkoutStore.getState().blocks.find((b) => b.id === blockId);
      if (!fresh) return;
      const node = fresh.content.find((n) => n.id === nodeId);
      if (!node || node.type !== 'text') return;
      updateContentNode(blockId, nodeId, { data: { ...node.data, format } } as any);
    },
    [blockId, updateContentNode],
  );

  // NOTE: drag reorder via DraggableNode was removed in Batch M2. M4 will
  // re-introduce reordering on the spine using react-native-draggable-flatlist.
  // The handlers above (reorderContentNodes, moveContentNode) are kept for
  // that work plus for BlockActionSheet's Move Up / Move Down options.

  // ======================== EXERCISE ========================

  const handleExerciseAdd = useCallback(
    (opts: {
      name: string;
      discipline: Discipline;
      fields?: import('../../types/core').FieldDefinition[];
    }) => {
      if (!block) return;
      handleAddExercise({
        ...opts,
        section: addExerciseSection ?? undefined,
        column: addExerciseColumn,
      });
      setAddExerciseSection(null);
      setAddExerciseColumn(0);
      setTimeout(normalizeOrders, 50);
    },
    [block, handleAddExercise, addExerciseSection, addExerciseColumn, normalizeOrders],
  );

  const handleDeleteExerciseConfirm = useCallback(
    (exerciseId: string) => {
      Alert.alert('Eliminar ejercicio', '¿Eliminar este ejercicio y sus series?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => handleDeleteExercise(exerciseId) },
      ]);
    },
    [handleDeleteExercise],
  );

  const handleSetComplete = useCallback(
    (exerciseId: string, setId: string) => {
      const completedBlock = handleToggleSetComplete(exerciseId, setId);
      if (completedBlock) {
        setTimeout(() => {
          setCelebrationBlock(completedBlock);
          confettiRef.current?.burst();
        }, 600);
      }
    },
    [handleToggleSetComplete],
  );

  // ======================== SUB-BLOCK ========================

  const handleNavigateSubBlock = useCallback(
    (subBlockId: string) => {
      navigation.push('BlockDetail', { blockId: subBlockId });
    },
    [navigation],
  );

  // ======================== SECTION CONFIG ========================

  const handleSectionWidthChange = useCallback(
    (sectionId: string, widths?: number[]) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const fresh = useWorkoutStore.getState().blocks.find((b) => b.id === blockId);
      if (!fresh) return;
      const node = fresh.content.find((n) => n.id === sectionId);
      if (!node || node.type !== 'columnSection') return;
      updateContentNode(blockId, sectionId, {
        data: { ...(node as ColumnSectionContentNode).data, widths },
      } as any);
    },
    [blockId, updateContentNode],
  );

  // ======================== DELETE BLOCK ========================

  const handleDeleteBlock = useCallback(() => {
    Alert.alert('Eliminar bloque', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          handleDelete();
          nav.goBack();
        },
      },
    ]);
  }, [handleDelete, nav]);

  // ======================== HOOKS BEFORE EARLY RETURN ========================
  // React Hooks must run in the same order every render. We compute
  // everything block-derived first so the conditional `if (!block) return`
  // below doesn't change the hook call sequence.

  // First exercise on the spine renders as CompoundTile (hero); subsequent
  // exercises render as AccessoryTile (compact).
  const firstExerciseRowId = useMemo(() => {
    const r = spineRows.find((row) => row.kind === 'exercise');
    return r?.id ?? null;
  }, [spineRows]);

  // Spine renderer — every node renders as one full-width tile attached to
  // the spine. The closure captures `block`, which may be null on first
  // mount; the renderer is only invoked once Spine itself has rows, which
  // requires a non-null block.
  const renderRowTile = useCallback(
    (row: SpineRowData): React.ReactNode => {
      const node = row.tiles[0]?.node;
      if (!node) return null;
      if (row.kind === 'divider') return null;
      if (row.kind === 'section' && node.type === 'columnSection') {
        return (
          <SectionHeaderTile
            sectionNode={node}
            onChangeWidth={handleSectionWidthChange}
            onDelete={handleDeleteNode}
          />
        );
      }
      if (row.kind === 'exercise' && node.type === 'exercise') {
        const Tile = row.id === firstExerciseRowId ? CompoundTile : AccessoryTile;
        return (
          <Tile
            exercise={node.data.exercise}
            blockId={blockId}
            index={node.order}
            onLongPress={() => handleOpenActions(node)}
            onUpdateName={handleUpdateExerciseName}
            onUpdateSetValue={handleUpdateSetValue}
            onToggleSetComplete={handleSetComplete}
            onAddSet={handleAddSet}
            onRemoveSet={handleRemoveSet}
            onDeleteExercise={handleDeleteExerciseConfirm}
          />
        );
      }
      if (row.kind === 'note' && node.type === 'text') {
        return (
          <NoteTile
            node={node}
            onUpdate={handleTextUpdate}
            onChangeFormat={handleTextFormatChange}
            onToggleCheck={handleCheckToggle}
            onDelete={handleDeleteNode}
            onInsertAfter={handleInsertAfter}
          />
        );
      }
      if (node.type === 'dashboard' && block) {
        return (
          <InlineDashboardTile
            node={node}
            block={block}
            onLongPress={() => handleOpenActions(node)}
            onUpdate={handleDashboardUpdate}
            onDelete={handleDeleteNode}
          />
        );
      }
      if (node.type === 'superset') {
        return (
          <SupersetTile
            node={node}
            onLongPress={() => handleOpenActions(node)}
            onUpdate={(nodeId, partial) => {
              const fresh = useWorkoutStore.getState().blocks.find((b) => b.id === blockId);
              const n = fresh?.content.find((c) => c.id === nodeId);
              if (n?.type === 'superset') {
                updateContentNode(blockId, nodeId, { data: { ...n.data, ...partial } } as any);
              }
            }}
          />
        );
      }
      return renderNodeDeferred(node, false);
    },
    [block, blockId, firstExerciseRowId],
  );

  const handleRowTap = useCallback(
    (row: SpineRowData) => {
      const node = row.tiles[0]?.node;
      if (node) handleOpenActions(node);
    },
    [handleOpenActions],
  );

  const handleReorder = useCallback(
    (orderedIds: string[]) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reorderContentNodes(blockId, orderedIds);
    },
    [blockId, reorderContentNodes],
  );

  const handleAddInsert = useCallback(
    (type: InsertableType) => {
      insertNode(type, null, 0);
    },
    [insertNode],
  );

  // ======================== RENDER HELPERS ========================

  if (!block) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.emptyText}>Bloque no encontrado</Text>
        <Pressable onPress={() => nav.goBack()}>
          <Text style={styles.emptyLink}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const disciplineColor = block.color || Colors.accent.primary;
  const pct = stats?.completion_percentage ?? 0;

  // Plain helper (not a hook). Defined inline because it closes over `block`
  // and the many handlers; cheap to recreate on each render.
  function renderNodeDeferred(n: ContentNode, c: boolean): React.ReactNode {
    return renderNode(n, c);
  }

  const renderNode = (node: ContentNode, compact: boolean = false) => {
    switch (node.type) {
      case 'text':
        return (
          <TextBlockNode
            key={node.id}
            node={node}
            onUpdate={handleTextUpdate}
            onChangeFormat={handleTextFormatChange}
            onToggleCheck={handleCheckToggle}
            onDelete={handleDeleteNode}
            onInsertAfter={handleInsertAfter}
            compact={compact}
          />
        );
      case 'exercise':
        return (
          <ExerciseRow
            key={node.id}
            exercise={node.data.exercise}
            blockId={blockId}
            index={node.order}
            onUpdateName={handleUpdateExerciseName}
            onUpdateSetValue={handleUpdateSetValue}
            onToggleSetComplete={handleSetComplete}
            onAddSet={handleAddSet}
            onRemoveSet={handleRemoveSet}
            onDeleteExercise={handleDeleteExerciseConfirm}
            compact={compact}
          />
        );
      case 'subBlock':
        return (
          <SubBlockNode
            key={node.id}
            node={node}
            onNavigate={handleNavigateSubBlock}
            onDelete={handleDeleteNode}
          />
        );
      case 'divider':
        return <View key={node.id} style={styles.divider} />;
      case 'image':
        return (
          <ImageNode
            key={node.id}
            node={node}
            onUpdate={handleImageUpdate}
            onDelete={handleDeleteNode}
            compact={compact}
          />
        );
      case 'timer':
        return (
          <TimerNode
            key={node.id}
            node={node}
            onUpdate={handleTimerUpdate}
            onDelete={handleDeleteNode}
            compact={compact}
          />
        );
      case 'spacer':
        return (
          <Pressable
            key={node.id}
            onLongPress={() => handleOpenActions(node)}
            style={{ height: compact ? Math.max(node.data.height * 0.6, 12) : node.data.height }}
          />
        );
      case 'dashboard':
        return (
          <DashboardNode
            key={node.id}
            node={node}
            block={block}
            onUpdate={handleDashboardUpdate}
            onDelete={handleDeleteNode}
            compact={compact}
          />
        );
      default:
        return null;
    }
  };

  const renderContent = () => {
    if (block && block.content.length === 0) {
      return <EmptyState type="blocks" />;
    }
    return (
      <Spine
        rows={spineRows}
        renderRow={renderRowTile}
        onRowTap={handleRowTap}
        onReorder={handleReorder}
      />
    );
  };

  return (
    <View style={styles.screen}>
      <ConfettiBurst confettiRef={confettiRef} />

      {/* Sticky header — gains a blur backdrop and shows the block name
          centered as the user scrolls past the title. Apple Notes pattern. */}
      <View style={[styles.stickyHeader, { paddingTop: insets.top }]} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, headerBackdropStyle]} pointerEvents="none">
          <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.stickyHeaderOverlay} />
          {/* Discipline accent strip — 2pt color band at the bottom edge
              of the sticky header, tying the chrome to the block identity
              once the user has scrolled past the inline strip below. */}
          <View
            style={[styles.stickyHeaderDisciplineStrip, { backgroundColor: disciplineColor }]}
          />
          <View style={styles.stickyHeaderHairline} />
        </Animated.View>

        <View style={styles.stickyHeaderRow}>
          <Pressable
            onPress={() => nav.goBack()}
            hitSlop={12}
            style={styles.backButton}
            accessibilityLabel="Volver"
          >
            <Feather name="chevron-left" size={22} color={Colors.ink.primary} />
            <Text style={styles.backLabel}>Atrás</Text>
          </Pressable>

          <Animated.Text
            style={[styles.stickyTitle, headerTitleStyle]}
            numberOfLines={1}
            pointerEvents="none"
          >
            {block.name}
          </Animated.Text>

          <View style={styles.stickyActions}>
            <Pressable onPress={handleToggleFavorite} hitSlop={8}>
              <Feather
                name="star"
                size={18}
                color={block.is_favorite ? Colors.gold.base : Colors.ink.tertiary}
              />
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowLibrary(true);
              }}
              hitSlop={8}
              accessibilityLabel="Añadir desde librería"
            >
              <Feather name="book-open" size={18} color={Colors.ink.secondary} />
            </Pressable>
            <Pressable onPress={() => handleOpenPalette(null, 0)} hitSlop={8}>
              <View style={styles.topBarPlus}>
                <Feather name="plus" size={16} color={Colors.gold.base} />
              </View>
            </Pressable>
            <Pressable onPress={handleDeleteBlock} hitSlop={8}>
              <Feather name="trash-2" size={18} color={Colors.ink.tertiary} />
            </Pressable>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <NestableScrollContainer
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 56 + Spacing.md,
              paddingBottom: insets.bottom + 100,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {/* Discipline color strip */}
          <View style={[styles.colorStrip, { backgroundColor: disciplineColor }]} />

          {/* Block name */}
          {editingName ? (
            <TextInput
              style={styles.nameInput}
              value={nameDraft}
              onChangeText={setNameDraft}
              onBlur={handleNameSubmit}
              onSubmitEditing={handleNameSubmit}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
            />
          ) : (
            <Pressable onPress={handleNameEdit}>
              <Text style={styles.blockName}>{block.name}</Text>
            </Pressable>
          )}

          {/* Progress bar */}
          {stats && stats.total_sets > 0 && (
            <View style={styles.progressBar}>
              <View style={styles.progressInfo}>
                <Text style={styles.progressPct}>{pct}%</Text>
                <Text style={styles.progressLabel}>
                  {stats.completed_sets}/{stats.total_sets} series
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${pct}%` as `${number}%`,
                      backgroundColor: pct === 100 ? Colors.semantic.success : disciplineColor,
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Spine renderer with reorderable rows */}
          {renderContent()}

          {/* Trailing add-station with inline menu */}
          {block && <AddStation onInsert={handleAddInsert} />}
        </NestableScrollContainer>
      </KeyboardAvoidingView>

      {/* Component palette */}
      <ComponentPalette
        visible={showPalette}
        onSelect={handlePaletteSelect}
        onClose={() => {
          setShowPalette(false);
          setPaletteSection(null);
          setPaletteColumn(0);
        }}
        insideSection={paletteSection != null}
      />

      {/* Add exercise sheet */}
      <AddExerciseSheet
        visible={showAddExercise}
        blockDiscipline={block.discipline}
        onAdd={handleExerciseAdd}
        onClose={() => setShowAddExercise(false)}
      />

      {/* Exercise library picker */}
      <ExerciseLibrarySheet
        visible={showLibrary}
        blockId={blockId}
        onClose={() => setShowLibrary(false)}
      />

      {/* Block action sheet */}
      <BlockActionSheet
        visible={showActions}
        node={actionNode}
        isFirst={false}
        isLast={false}
        onTurnInto={handleTurnInto}
        onDuplicate={handleDuplicate}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onDelete={handleDeleteNode}
        onClose={() => setShowActions(false)}
      />

      {/* Celebration */}
      <CompletionCelebration block={celebrationBlock} onDismiss={() => setCelebrationBlock(null)} />

      {/* Floating AI button */}
      {!showAI && (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowAI(true);
          }}
          style={[styles.aiFab, { bottom: insets.bottom + 20 }]}
        >
          <Feather name="zap" size={20} color={Colors.text.inverse} />
        </Pressable>
      )}

      {/* AI assistant sheet */}
      <BlockAISheet visible={showAI} block={block} onClose={() => setShowAI(false)} />
    </View>
  );
}

// ======================== STYLES ========================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background.void,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: Typography.size.body,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  emptyLink: {
    fontSize: Typography.size.body,
    color: Colors.accent.primary,
    fontWeight: Typography.weight.semibold,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screen.horizontal,
  },

  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  stickyHeaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(247,247,245,0.78)',
  },
  stickyHeaderHairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.hair.base,
  },
  stickyHeaderDisciplineStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    opacity: 0.75,
  },
  stickyHeaderRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen.horizontal,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: -6,
  },
  backLabel: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.regular,
    color: Colors.ink.primary,
  },
  stickyTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.semibold,
    color: Colors.ink.primary,
    letterSpacing: Typography.tracking.tight,
    paddingHorizontal: 88,
  },
  stickyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  topBarPlus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.gold.base,
    alignItems: 'center',
    justifyContent: 'center',
  },

  colorStrip: {
    height: 3,
    borderRadius: 1.5,
    marginBottom: Spacing.xl,
    opacity: 0.8,
  },

  nameInput: {
    fontSize: Typography.size.title,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent.primary,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.lg,
    letterSpacing: Typography.tracking.tight,
  },
  blockName: {
    fontSize: Typography.size.title,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
    letterSpacing: Typography.tracking.tight,
  },

  progressBar: {
    marginBottom: Spacing.xl,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  progressPct: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
  },
  progressLabel: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.background.elevated,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border.medium,
    marginVertical: Spacing.xl,
    marginHorizontal: Spacing.lg,
  },

  aiFab: {
    position: 'absolute',
    right: Spacing.xl,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.elevated,
  },
});
