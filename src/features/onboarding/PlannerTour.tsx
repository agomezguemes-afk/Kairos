// src/features/onboarding/PlannerTour.tsx
// First-launch overlay that teaches the planning model in 3 quick screens.
// Sober, illustrative, no pep. Mounted by HomeTab when tourCompletedAt is
// null. Uses a horizontal FlatList with paging — simpler than juggling
// shared values and gesture handlers, and the platform handles momentum.

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Colors, Radius, Shadows, Spacing, Type } from '../../theme/tokens';
import BlockPreviewMock from './tour/BlockPreviewMock';
import MonthGridMock from './tour/MonthGridMock';
import SparklineMock from './tour/SparklineMock';
import { useWorkoutStore } from '../../store/workoutStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface Page {
  key: 'blocks' | 'schedule' | 'progress';
  title: string;
  body: string;
  Visual: React.ComponentType;
}

const PAGES: Page[] = [
  {
    key: 'blocks',
    title: 'Bloques',
    body: 'Un bloque agrupa los ejercicios de una sesión. Crea uno desde plantilla o desde cero.',
    Visual: BlockPreviewMock,
  },
  {
    key: 'schedule',
    title: 'Programa',
    body: 'Asigna bloques a días sueltos o con recurrencia. Cada lunes, primer lunes del mes, lo que necesites.',
    Visual: MonthGridMock,
  },
  {
    key: 'progress',
    title: 'Progreso',
    body: 'Cada sesión registrada alimenta el dashboard. Sin esfuerzo extra.',
    Visual: SparklineMock,
  },
];

const SCREEN_W = Dimensions.get('window').width;

export default function PlannerTour({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Page>>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const finish = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    useWorkoutStore.getState().markTourCompleted();
    onClose();
  }, [onClose]);

  const skip = useCallback(() => {
    useWorkoutStore.getState().markTourCompleted();
    onClose();
  }, [onClose]);

  const advance = useCallback(() => {
    if (pageIndex >= PAGES.length - 1) {
      finish();
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    const next = pageIndex + 1;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setPageIndex(next);
  }, [pageIndex, finish]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
      if (next !== pageIndex) {
        Haptics.selectionAsync().catch(() => {});
        setPageIndex(next);
      }
    },
    [pageIndex],
  );

  const renderItem = useCallback(
    ({ item }: { item: Page }) => <PageView page={item} />,
    [],
  );

  const isLast = pageIndex === PAGES.length - 1;
  const ctaLabel = isLast ? 'Empezar' : 'Siguiente';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={skip}
      statusBarTranslucent
    >
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {/* Top bar — skip link only on first two pages. Always reserve height
            so the page content doesn't reflow when it disappears. */}
        <View style={styles.topBar}>
          {!isLast && (
            <Pressable
              onPress={skip}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Saltar tour"
              style={({ pressed }) => pressed && { opacity: 0.6 }}
            >
              <Text style={styles.skip}>Saltar</Text>
            </Pressable>
          )}
        </View>

        <FlatList
          ref={listRef}
          data={PAGES}
          keyExtractor={(p) => p.key}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          getItemLayout={(_, index) => ({
            length: SCREEN_W,
            offset: SCREEN_W * index,
            index,
          })}
          style={styles.list}
        />

        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}>
          <PageDots count={PAGES.length} activeIndex={pageIndex} />
          <Pressable
            onPress={advance}
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.88 }]}
          >
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

function PageView({ page }: { page: Page }) {
  const { Visual, title, body } = page;
  return (
    <View style={styles.page}>
      <View style={styles.visualWrap}>
        <Visual />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

// ── Dots ──────────────────────────────────────────────────────────────────

function PageDots({ count, activeIndex }: { count: number; activeIndex: number }) {
  const items = useMemo(() => Array.from({ length: count }), [count]);
  return (
    <View style={styles.dotsRow}>
      {items.map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
        />
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg.void,
  },
  topBar: {
    height: 44,
    paddingHorizontal: Spacing.xl,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skip: {
    ...Type.micro,
    color: Colors.ink.tertiary,
  },
  list: {
    flex: 1,
  },
  page: {
    width: SCREEN_W,
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  visualWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },
  textWrap: {
    paddingBottom: Spacing['3xl'],
    alignItems: 'center',
  },
  title: {
    ...Type.title,
    fontSize: 32,
    lineHeight: 36,
    color: Colors.ink.primary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  body: {
    ...Type.body,
    color: Colors.ink.secondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  bottom: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: Colors.gold.base,
  },
  dotInactive: {
    backgroundColor: Colors.hair.strong,
  },
  cta: {
    backgroundColor: Colors.gold.base,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    ...Shadows.subtle,
  },
  ctaText: {
    ...Type.bodyEmph,
    color: Colors.ink.inverse,
  },
});
