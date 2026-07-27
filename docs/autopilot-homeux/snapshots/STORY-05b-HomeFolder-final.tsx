// src/features/planner/components/HomeFolder.tsx
// The "carpeta" for everything that isn't today: calendar, readiness, weekly
// stats, Kai's signal. Collapsed by default so HomeHero + DayCard own the
// fold (STORY-01). Closed it reads as a quiet handle, not a CTA — gold stays
// reserved for Kai.
//
// children are ALWAYS mounted (collapsed just clips them to height 0) so
// VoiceOver can discover them once expanded and so the natural height can be
// measured without a mount/unmount round-trip.
//
// Memory (STORY-03): the open/closed state is remembered via uiStore and, on a
// user that never touched the folder, seeded by a smart default that depends on
// today's DayCard variant. The cold-start restore JUMPS to the resolved state
// (no animation); only user toggles animate.

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors, Radius, Spacing, Type } from '../../../theme/tokens';
import { useAccordion } from '../../../hooks/useAccordion';
import { useUIStore } from '../../../store/uiStore';
import { useDayCardState } from '../hooks/useDayCardState';
import { todayISO } from '../lib/dates';
import { resolveFolderOpen } from '../lib/folderState';

interface HomeFolderProps {
  /** foldSummary().eyebrow — e.g. "Esta semana" */
  eyebrow: string;
  /** foldSummary().summary — e.g. "4 sesiones" */
  summary: string;
  children: React.ReactNode;
}

export default function HomeFolder({ eyebrow, summary, children }: HomeFolderProps) {
  const { homeFolderOpen, _hasHydrated, setHomeFolderOpen } = useUIStore();
  const todayVariant = useDayCardState(todayISO()).variant;
  const resolved = resolveFolderOpen(homeFolderOpen, todayVariant);

  // Starts collapsed + progress 0 — the safe state before persist has told us
  // what the user last chose. The cold-start restore below jumps straight to
  // `resolved` without animating.
  const [open, setOpen] = useState(false);

  // Shared accordion mechanics (STORY-05b): height-collapse + rise + chevron,
  // re-measuring on every layout. `progress` comes from the hook — the SAME
  // SharedValue the hydration restore below jumps, so no-flash still works.
  const { progress, onContentLayout, containerStyle, contentStyle, chevronStyle } =
    useAccordion(open);

  // Cold-start restore (STORY-03 §4.3) — the critical no-flash wiring.
  // Fires once, when persist finishes rehydrating. We JUMP `progress` to the
  // resolved state instantly (no withTiming) so the folder appears already in
  // place, then align `open`. Setting progress before the state change means
  // the hook's [open] effect lands its withTiming on a value that's already the
  // target → no visible motion. Only genuine user toggles animate.
  useEffect(() => {
    if (!_hasHydrated) return;
    if (open !== resolved) {
      progress.value = resolved ? 1 : 0;
      setOpen(resolved);
    }
    // Intentionally keyed on hydration only: `resolved`/`open` are read fresh
    // in the commit where `_hasHydrated` flips true (persist sets homeFolderOpen
    // before this callback), and re-running on every toggle would re-trigger the
    // instant jump and defeat the toggle animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated]);

  const handleToggle = useCallback(() => {
    // Guard against the narrow window before persist finishes rehydrating:
    // its default `merge` lets the disk-read value win over live state, so a
    // tap landing before `_hasHydrated` could get silently reverted once
    // hydration completes. The window is normally sub-frame, but AsyncStorage
    // queue congestion (shared with workoutStore's larger v4-migrated payload)
    // can stretch it — ignoring taps until hydrated costs nothing perceptible.
    if (!_hasHydrated) return;
    Haptics.selectionAsync().catch(() => {});
    const next = !open;
    setOpen(next);
    // Persist the explicit choice — from now on it wins over the smart default.
    setHomeFolderOpen(next);
  }, [open, _hasHydrated, setHomeFolderOpen]);

  // The 4 children arrive as sibling elements; wrap each as a "section" with a
  // uniform gutter and a hairline between them. The first filete (i > 0 lives
  // inside the map, and the map inside the collapsible) never hangs under the
  // closed handle — closed = height 0 = no border showing (brief §3.2).
  const sections = React.Children.toArray(children);

  return (
    <View style={styles.box}>
      <Pressable
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${eyebrow}. ${summary}`}
        accessibilityHint={open ? 'Toca para ocultar' : 'Toca para mostrar más'}
        style={({ pressed }) => [styles.handle, pressed && styles.handlePressed]}
      >
        <View style={styles.textCol}>
          {/* Compact handle: cap Dynamic Type growth so the row can breathe
              (paddingVertical, no fixed height) without the summary shoving the
              chevron out of alignment. Caps match the app's hero band (1.4-1.6);
              the label carries the meaning, so the eyebrow is tighter (1.4) and
              the summary a touch looser (1.5). */}
          <Text style={styles.eyebrow} numberOfLines={1} maxFontSizeMultiplier={1.4}>
            {eyebrow}
          </Text>
          <Text style={styles.summary} numberOfLines={1} maxFontSizeMultiplier={1.5}>
            {summary}
          </Text>
        </View>
        <Animated.View style={chevronStyle}>
          <Feather name="chevron-down" size={18} color={Colors.ink.tertiary} />
        </Animated.View>
      </Pressable>

      <Animated.View
        style={[styles.collapsible, containerStyle]}
        // Collapsed, the children are still mounted (clipped to height 0), which
        // does NOT remove them from the a11y tree — VoiceOver/TalkBack would keep
        // navigating into the hidden calendar/state/week/signal. Gate the whole
        // subtree on `open` so the handle is the only focusable element when
        // closed, and the content returns to the focus order when expanded.
        accessibilityElementsHidden={!open} // iOS
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'} // Android
      >
        <Animated.View style={contentStyle} onLayout={onContentLayout}>
          {sections.map((child, i) => (
            <View key={i} style={styles.section}>
              {i > 0 ? <View style={styles.divider} pointerEvents="none" /> : null}
              {child}
            </View>
          ))}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The warm container. Its continuous surface + rounded corners + inner
  // hairlines are what read as "a box", not a material change — closed state
  // stays identical to STORY-01. overflow:hidden clips the growing body's
  // corners; the box hugs its content (no fixed height) so it grows with it.
  box: {
    marginHorizontal: Spacing.screen.horizontal,
    marginTop: Spacing.gap.editorial,
    backgroundColor: Colors.paper.warm,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  handle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  handlePressed: {
    opacity: 0.7,
  },
  // The single gutter every child aligns to — children lose their own.
  section: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  // A row separator that crosses the full box width (Settings/Wallet style),
  // hence the negative margin cancelling the section's horizontal padding.
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.hair.subtle,
    marginHorizontal: -Spacing.lg,
    marginBottom: Spacing.lg,
  },
  textCol: {
    flex: 1,
  },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.ink.muted,
  },
  summary: {
    ...Type.caption,
    color: Colors.ink.secondary,
    marginTop: 2,
  },
  collapsible: {
    overflow: 'hidden',
  },
});
