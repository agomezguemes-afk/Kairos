// KAIROS — Type identity (vendored, offline, OFL-licensed)
//
// Signature face: **Fraunces** — an editorial "old-style" serif with a soft,
// slightly wonky character. It is Kairos' creative voice: hero greetings, the
// wordmark, big stat numerals, and emphasized editorial words (its italic is
// gorgeous). Pairs with **Plus Jakarta Sans**, a warm geometric workhorse with
// excellent tabular numerals for everything UI.
//
// Why vendored (assets/fonts) instead of an npm font package: the type identity
// is part of the product, not a dependency. Bundling the TTFs keeps it
// self-contained, offline-safe, and immune to registry/version drift. OFL texts
// ship alongside the files (assets/fonts/*-OFL.txt).
//
// RN custom-font rule that drives this file's shape: with custom families,
// `fontWeight` does NOT pick a weight — each weight must be a separately
// registered family and referenced by name. So tokens map every text style to
// an explicit family below.

import { useFonts } from 'expo-font';

/** Registered family names. Reference these from tokens, never raw strings. */
export const Fonts = {
  // Fraunces — signature editorial serif
  serifRegular: 'Fraunces-Regular',
  serifMedium: 'Fraunces-Medium',
  serifSemiBold: 'Fraunces-SemiBold',
  serifBold: 'Fraunces-Bold',
  serifBlack: 'Fraunces-Black',
  serifItalic: 'Fraunces-Italic',
  serifSemiBoldItalic: 'Fraunces-SemiBoldItalic',
  // Plus Jakarta Sans — workhorse + tabular numerals
  sansRegular: 'Jakarta-Regular',
  sansMedium: 'Jakarta-Medium',
  sansSemiBold: 'Jakarta-SemiBold',
  sansBold: 'Jakarta-Bold',
  sansExtraBold: 'Jakarta-ExtraBold',
} as const;

export type FontName = (typeof Fonts)[keyof typeof Fonts];

/**
 * family-name → asset map handed to expo-font. Static `require()`s so Metro
 * bundles the TTFs. Keep in lockstep with assets/fonts.
 */
export const fontAssets = {
  [Fonts.serifRegular]: require('../../assets/fonts/Fraunces_400Regular.ttf'),
  [Fonts.serifMedium]: require('../../assets/fonts/Fraunces_500Medium.ttf'),
  [Fonts.serifSemiBold]: require('../../assets/fonts/Fraunces_600SemiBold.ttf'),
  [Fonts.serifBold]: require('../../assets/fonts/Fraunces_700Bold.ttf'),
  [Fonts.serifBlack]: require('../../assets/fonts/Fraunces_900Black.ttf'),
  [Fonts.serifItalic]: require('../../assets/fonts/Fraunces_400Regular_Italic.ttf'),
  [Fonts.serifSemiBoldItalic]: require('../../assets/fonts/Fraunces_600SemiBold_Italic.ttf'),
  [Fonts.sansRegular]: require('../../assets/fonts/PlusJakartaSans_400Regular.ttf'),
  [Fonts.sansMedium]: require('../../assets/fonts/PlusJakartaSans_500Medium.ttf'),
  [Fonts.sansSemiBold]: require('../../assets/fonts/PlusJakartaSans_600SemiBold.ttf'),
  [Fonts.sansBold]: require('../../assets/fonts/PlusJakartaSans_700Bold.ttf'),
  [Fonts.sansExtraBold]: require('../../assets/fonts/PlusJakartaSans_800ExtraBold.ttf'),
} as const;

export interface FontLoadState {
  /** True once it's safe to render text in the brand faces, OR on load error
   *  (we fall back to system rather than block the app forever). */
  fontsReady: boolean;
  fontError: Error | null;
}

/**
 * Loads the Kairos type identity. Call once near the app root and gate the
 * first paint on `fontsReady` (see FontGate). On error we still return ready so
 * a font CDN/asset hiccup degrades to system fonts instead of a blank screen.
 */
export function useKairosFonts(): FontLoadState {
  const [loaded, error] = useFonts(fontAssets);
  return { fontsReady: loaded || !!error, fontError: error ?? null };
}
