import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import BlockCard from './components/BlockCard';
import BlockCreationSheet, { type BlockCreationOptions } from '../../components/BlockCreationSheet';
import ConfettiBurst, { type ConfettiRef } from '../../components/ConfettiParticles';
import KairosIcon from '../../components/KairosIcon';

import type { WorkoutBlock } from '../../types/core';
import type { RootStackParamList } from '../../types/navigation';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme/index';
import { springs } from '../../theme/animations';
import { useWorkoutStore } from '../../store/workoutStore';
import { useGamification } from '../../context/GamificationContext';

type SortMode = 'recent' | 'name' | 'status' | 'favorite';

const SCREEN_W = Dimensions.get('window').width;
const H_PAD = Spacing.screen.horizontal;
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
    const visible = blocks.filter(b => !b.is_archived);
    switch (sortMode) {
      case 'name':
        return [...visible].sort((a, b) => a.name.localeCompare(b.name));
      case 'status':
        const statusOrder: Record<string, number> = { in_progress: 0, partial: 1, draft: 2, completed: 3 };
        return [...visible].sort((a, b) => (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4));
      case 'favorite':
        return [...visible].sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));
      case 'recent':
      default:
        return [...visible].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
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

  // FAB
  const fabScale = useSharedValue(1);
  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

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
    <View style={styles.screen}>
      <ConfettiBurst confettiRef={confettiRef} />

      {/* Header */}
      <Animated.View
        entering={FadeInDown.delay(60).duration(350)}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View>
          <Text style={styles.brand}>Bloques</Text>
          <Text style={styles.subtitle}>
            {sortedBlocks.length === 0
              ? 'Tu espacio de entrenamiento'
              : `${sortedBlocks.length} ${sortedBlocks.length === 1 ? 'bloque' : 'bloques'}`}
          </Text>
        </View>

        {/* Sort button */}
        {sortedBlocks.length > 1 && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const modes: SortMode[] = ['recent', 'name', 'status', 'favorite'];
              const nextIdx = (modes.indexOf(sortMode) + 1) % modes.length;
              setSortMode(modes[nextIdx]);
            }}
            style={styles.sortBtn}
          >
            <Feather name="sliders" size={14} color={Colors.accent.primary} />
            <Text style={styles.sortText}>{sortLabels[sortMode]}</Text>
          </Pressable>
        )}
      </Animated.View>

      {/* Grid or empty state */}
      {sortedBlocks.length > 0 ? (
        <FlatList
          ref={listRef}
          data={sortedBlocks}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={[styles.gridContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      ) : (
        <Animated.View entering={FadeIn.delay(200).duration(500)} style={styles.welcome}>
          <View style={styles.welcomeAvatarRing}>
            <KairosIcon name="assistant" size={38} color={Colors.accent.primary} />
          </View>
          <Text style={styles.welcomeHeadline}>Tu espacio de bloques</Text>
          <Text style={styles.welcomeBody}>
            Crea bloques de entrenamiento personalizados.{'\n'}
            Cada bloque contiene ejercicios con series y repeticiones que puedes rastrear.
          </Text>
          <Pressable
            onPress={handleQuickCreate}
            style={({ pressed }) => [styles.welcomeBtn, pressed && { opacity: 0.82 }]}
          >
            <Feather name="plus" size={18} color={Colors.text.inverse} />
            <Text style={styles.welcomeBtnText}>Crear bloque</Text>
          </Pressable>
          <View style={styles.hintRow}>
            <HintChip icon="grid" label="Organiza tu rutina" />
            <HintChip icon="check-circle" label="Registra cada serie" />
            <HintChip icon="trending-up" label="Analiza tu progreso" />
          </View>
        </Animated.View>
      )}

      {/* FAB — tap: quick-create, long-press: full sheet */}
      {sortedBlocks.length > 0 && (
        <Animated.View style={[styles.fab, fabStyle, { bottom: insets.bottom + 20 }]}>
          <Pressable
            onPressIn={() => { fabScale.value = withSpring(0.88, springs.tap); }}
            onPressOut={() => { fabScale.value = withSpring(1, springs.bouncy); }}
            onPress={handleQuickCreate}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowCreation(true);
            }}
            style={styles.fabInner}
          >
            <Feather name="plus" size={24} color={Colors.text.inverse} />
          </Pressable>
        </Animated.View>
      )}

      {/* Creation sheet */}
      <BlockCreationSheet
        visible={showCreation}
        onClose={() => setShowCreation(false)}
        onCreate={handleCreateBlock}
      />
    </View>
  );
}

function HintChip({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.hintChip}>
      <Feather name={icon as any} size={13} color={Colors.accent.primary} />
      <Text style={styles.hintLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background.void,
  },
  header: {
    paddingHorizontal: H_PAD,
    paddingBottom: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  brand: {
    fontSize: Typography.size.title,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    letterSpacing: Typography.tracking.tight,
  },
  subtitle: {
    fontSize: Typography.size.caption,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: Spacing.xs + 1,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent.dim,
  },
  sortText: {
    fontSize: Typography.size.micro,
    fontWeight: Typography.weight.medium,
    color: Colors.accent.primary,
  },

  gridContent: {
    paddingHorizontal: H_PAD - Spacing.gap.cards / 2,
    paddingTop: Spacing.sm,
  },

  welcome: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: H_PAD + 8,
  },
  welcomeAvatarRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.accent.dim,
    borderWidth: 1.5,
    borderColor: Colors.accent.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.subtle,
  },
  welcomeHeadline: {
    fontSize: Typography.size.heading,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  welcomeBody: {
    fontSize: Typography.size.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: Typography.size.body * 1.65,
    marginBottom: Spacing['2xl'],
  },
  welcomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accent.primary,
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: Radius.full,
    marginBottom: Spacing['2xl'],
    shadowColor: Colors.accent.primary,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 6,
  },
  welcomeBtnText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.inverse,
  },
  hintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  hintChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background.surface,
    borderWidth: 1,
    borderColor: Colors.border.warm,
    borderRadius: Radius.full,
    paddingVertical: 5,
    paddingHorizontal: Spacing.md,
    ...Shadows.subtle,
  },
  hintLabel: {
    fontSize: Typography.size.micro,
    color: Colors.text.secondary,
    fontWeight: Typography.weight.medium,
  },

  fab: {
    position: 'absolute',
    right: 20,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent.primary,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 10,
  },
});
