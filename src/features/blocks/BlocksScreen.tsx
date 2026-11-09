import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, FlatList, StyleSheet, Alert, Platform } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import BlockCard from './components/BlockCard';
import BlockCreationSheet, { type BlockCreationOptions } from '../../components/BlockCreationSheet';
import ConfettiBurst, { type ConfettiRef } from '../../components/ConfettiParticles';
import TemplatePickerSheet from './components/TemplatePickerSheet';

import type { WorkoutBlock } from '../../types/core';
import type { RootStackParamList } from '../../types/navigation';
import { Brut, Spacing } from '../../theme/tokens';
import { BBox, BPress, BScreen, BText } from '../coach/ui/brut';
import { useWorkoutStore } from '../../store/workoutStore';
import { useGamification } from '../../context/GamificationContext';

type SortMode = 'recent' | 'name' | 'status' | 'favorite';

const H_PAD = Spacing.lg;
const NUM_COLUMNS = 2;

export default function BlocksScreen({ route }: any) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const blocks = useWorkoutStore((s) => s.blocks);
  const storeAddBlock = useWorkoutStore((s) => s.addBlock);
  const storeDeleteBlock = useWorkoutStore((s) => s.deleteBlock);
  const pendingHighlight = useWorkoutStore((s) => s.pendingHighlight);
  const clearHighlight = useWorkoutStore((s) => s.setHighlight);
  const { onBlockCreated } = useGamification();

  const confettiRef = useRef<ConfettiRef | null>(null);
  const listRef = useRef<FlatList>(null);

  const [showCreation, setShowCreation] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [showSort, setShowSort] = useState(false);

  const highlightTargetId = route?.params?.highlightBlockId ?? pendingHighlight;

  // Clear highlight after timeout
  useEffect(() => {
    if (!highlightTargetId) return;
    const timer = setTimeout(() => clearHighlight(null), 2500);
    return () => clearTimeout(timer);
  }, [highlightTargetId, clearHighlight]);

  // Sorted blocks
  const sortedBlocks = useMemo(() => {
    const visible = blocks.filter((b) => !b.is_archived);
    switch (sortMode) {
      case 'name':
        return [...visible].sort((a, b) => a.name.localeCompare(b.name));
      case 'status':
        const statusOrder: Record<string, number> = {
          in_progress: 0,
          partial: 1,
          draft: 2,
          completed: 3,
        };
        return [...visible].sort(
          (a, b) => (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4),
        );
      case 'favorite':
        return [...visible].sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));
      case 'recent':
      default:
        return [...visible].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        );
    }
  }, [blocks, sortMode]);

  // Quick-create: blank block → navigate to editor
  const handleQuickCreate = useCallback(() => {
    const id = storeAddBlock('general', { name: 'Nuevo bloque' });
    const next = useWorkoutStore.getState().blocks;
    onBlockCreated(next);
    if (id) clearHighlight(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.navigate('BlockDetail', { blockId: id });
  }, [storeAddBlock, onBlockCreated, clearHighlight, navigation]);

  // Full-create: via sheet with discipline/color/icon
  const handleCreateBlock = useCallback(
    (opts: BlockCreationOptions) => {
      const id = storeAddBlock(opts.discipline, {
        name: opts.name,
        icon: opts.icon,
        color: opts.color,
        cover: opts.cover ?? undefined,
      });
      const next = useWorkoutStore.getState().blocks;
      onBlockCreated(next);
      if (id) clearHighlight(id);
      setTimeout(() => confettiRef.current?.burst(), 120);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [storeAddBlock, onBlockCreated, clearHighlight],
  );

  // Open detail
  const handleOpenBlock = useCallback(
    (block: WorkoutBlock) => {
      navigation.navigate('BlockDetail', { blockId: block.id });
    },
    [navigation],
  );

  // Long-press options
  const handleBlockOptions = useCallback(
    (block: WorkoutBlock) => {
      Alert.alert(block.name, undefined, [
        {
          text: block.is_favorite ? 'Quitar favorito' : 'Marcar favorito',
          onPress: () => {
            useWorkoutStore.getState().updateBlock(block.id, { is_favorite: !block.is_favorite });
          },
        },
        {
          text: 'Duplicar',
          onPress: () => {
            const id = storeAddBlock(block.discipline, {
              name: `${block.name} (copia)`,
              icon: block.icon,
              color: block.color,
            });
            if (id) clearHighlight(id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Eliminar bloque', '¿Seguro?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Eliminar', style: 'destructive', onPress: () => storeDeleteBlock(block.id) },
            ]);
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    },
    [storeAddBlock, storeDeleteBlock, clearHighlight],
  );

  // Render card
  const renderItem = useCallback(
    ({ item, index }: { item: WorkoutBlock; index: number }) => (
      <BlockCard
        block={item}
        index={index}
        onPress={() => handleOpenBlock(item)}
        onLongPress={() => handleBlockOptions(item)}
        isHighlighted={item.id === highlightTargetId}
      />
    ),
    [handleOpenBlock, handleBlockOptions, highlightTargetId],
  );

  const keyExtractor = useCallback((item: WorkoutBlock) => item.id, []);

  const sortLabels: Record<SortMode, string> = {
    recent: 'Recientes',
    name: 'Nombre',
    status: 'Estado',
    favorite: 'Favoritos',
  };

  return (
    <BScreen>
      <ConfettiBurst confettiRef={confettiRef} />

      <Animated.View
        entering={FadeInDown.duration(Brut.motion.reveal)}
        style={[styles.header, { paddingTop: insets.top + Spacing.md }]}
      >
        <View style={styles.topRow}>
          <BText variant="monoBold" size={11} style={{ letterSpacing: 2 }}>
            KAIROS{' '}
            <BText variant="mono" size={11} color={Brut.muted}>
              / BLOQUES
            </BText>
          </BText>
          {/* "+" lives in the header: a floating button would collide with the
              tab bar's start button. Tap = quick block, hold = full sheet. */}
          <BPress
            onPress={handleQuickCreate}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowCreation(true);
            }}
            radius={12}
            contentStyle={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Nuevo bloque"
            accessibilityHint="Mantén pulsado para elegir disciplina, color e icono"
          >
            <Feather name="plus" size={20} color={Brut.ink} />
          </BPress>
        </View>
        <View style={styles.titleRow}>
          <BText variant="display" size={44}>
            BLOQUES
          </BText>
          {sortedBlocks.length > 1 && (
            <BPress
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const modes: SortMode[] = ['recent', 'name', 'status', 'favorite'];
                const nextIdx = (modes.indexOf(sortMode) + 1) % modes.length;
                setSortMode(modes[nextIdx]);
              }}
              shadow={2}
              radius={10}
              contentStyle={styles.sortBtn}
              accessibilityRole="button"
              accessibilityLabel={`Ordenar: ${sortLabels[sortMode]}`}
            >
              <Feather name="sliders" size={13} color={Brut.ink} />
              <BText variant="monoBold" size={10}>
                {sortLabels[sortMode].toUpperCase()}
              </BText>
            </BPress>
          )}
        </View>
        <BText variant="mono" size={11} color={Brut.muted}>
          {sortedBlocks.length === 0
            ? 'TU ESPACIO DE ENTRENAMIENTO'
            : `${sortedBlocks.length} ${sortedBlocks.length === 1 ? 'BLOQUE' : 'BLOQUES'}`}
        </BText>
      </Animated.View>

      {sortedBlocks.length > 0 ? (
        <FlatList
          ref={listRef}
          data={sortedBlocks}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={[styles.gridContent, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      ) : (
        <Animated.View
          entering={FadeIn.delay(150).duration(Brut.motion.reveal)}
          style={styles.welcome}
        >
          <BBox contentStyle={styles.welcomeCard}>
            <BText variant="monoBold" size={10} color={Brut.muted}>
              00 · VACÍO
            </BText>
            <BText variant="display" size={32} style={{ marginTop: 6 }}>
              TU ESPACIO DE BLOQUES
            </BText>
            <BText size={14} color={Brut.muted} style={{ marginTop: 6 }}>
              Crea bloques de entrenamiento a tu medida. Cada bloque guarda ejercicios con las
              series y métricas que tú decidas registrar.
            </BText>
            <BPress
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTemplatePickerOpen(true);
              }}
              bg={Brut.accent}
              radius={Brut.radius.md}
              style={{ marginTop: Spacing.lg }}
              contentStyle={styles.welcomeBtn}
              accessibilityRole="button"
            >
              <Feather name="zap" size={17} color={Brut.ink} />
              <BText variant="bodyBold" size={15}>
                Empezar con plantilla
              </BText>
            </BPress>
            <BPress
              onPress={handleQuickCreate}
              radius={Brut.radius.md}
              shadow={2}
              style={{ marginTop: Spacing.sm }}
              contentStyle={styles.welcomeBtn}
              accessibilityRole="button"
            >
              <BText variant="bodyBold" size={15}>
                Crear bloque en blanco
              </BText>
            </BPress>
          </BBox>
          <View style={styles.hintRow}>
            <HintChip index="01" label="Organiza tu rutina" />
            <HintChip index="02" label="Registra cada serie" />
            <HintChip index="03" label="Analiza tu progreso" />
          </View>
        </Animated.View>
      )}

      <BlockCreationSheet
        visible={showCreation}
        onClose={() => setShowCreation(false)}
        onCreate={handleCreateBlock}
      />

      <TemplatePickerSheet
        visible={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onCreated={(blockId) => {
          setTemplatePickerOpen(false);
          const next = useWorkoutStore.getState().blocks;
          onBlockCreated(next);
          clearHighlight(blockId);
          setTimeout(() => confettiRef.current?.burst(), 120);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />
    </BScreen>
  );
}

function HintChip({ index, label }: { index: string; label: string }) {
  return (
    <View style={styles.hintChip}>
      <BText variant="monoBold" size={10} color={Brut.muted}>
        {index}
      </BText>
      <BText variant="bodySemi" size={12}>
        {label}
      </BText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: H_PAD, paddingBottom: Spacing.md, gap: 4 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: Spacing.sm,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  gridContent: { paddingHorizontal: H_PAD - Spacing.gap.cards / 2, paddingTop: Spacing.sm },
  welcome: { flex: 1, paddingHorizontal: H_PAD, paddingTop: Spacing.lg },
  welcomeCard: { padding: Spacing.lg },
  welcomeBtn: {
    height: 50,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.lg },
  hintChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: Brut.surface,
  },
});
