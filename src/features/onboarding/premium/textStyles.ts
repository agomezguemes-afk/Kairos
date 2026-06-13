// KAIROS — shared editorial text styles for onboarding steps.
//
// One source of truth for the recurring voice (eyebrow, serif title, the italic
// gold accent word, subtitle, helper, wordmark) so every step — old and new —
// speaks identically. Token-driven; never hard-code these per screen.

import { StyleSheet } from 'react-native';
import { Colors, Spacing, Type } from '../../../theme/tokens';
import { Fonts } from '../../../theme/fonts';

export const text = StyleSheet.create({
  eyebrow: { ...Type.eyebrow, color: Colors.gold.deep, marginBottom: Spacing.sm },
  eyebrowCenter: {
    ...Type.eyebrow,
    color: Colors.gold.deep,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  title: { ...Type.title, color: Colors.ink.primary },
  titleCenter: { ...Type.title, color: Colors.ink.primary, textAlign: 'center' },
  // Italic accent word inside a serif title (inherits the title's size).
  titleAccent: { fontFamily: Fonts.serifSemiBoldItalic, color: Colors.gold.base },
  subtitle: { ...Type.body, fontSize: 16, lineHeight: 24, color: Colors.ink.tertiary },
  subtitleCenter: {
    ...Type.body,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.ink.tertiary,
    textAlign: 'center',
  },
  helper: { ...Type.caption, color: Colors.ink.muted },
  wordmark: { ...Type.titleSmall, color: Colors.ink.primary, letterSpacing: -0.4 },
  wordmarkDot: { color: Colors.gold.base },
});
