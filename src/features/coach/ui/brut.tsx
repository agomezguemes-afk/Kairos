// Brut primitives — the building blocks of direction "D · Bloque".
// Hard shadows are a separate layer (not iOS shadow / Android elevation)
// so they render identically on every platform and can be "pressed" away.

import React, { useCallback } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { Brut } from '../../../theme/tokens';

// ── Text ───────────────────────────────────────────────────────────────

type Variant = 'display' | 'body' | 'bodySemi' | 'bodyBold' | 'mono' | 'monoBold';

const FAMILY: Record<Variant, string> = {
  display: Brut.font.display,
  body: Brut.font.body,
  bodySemi: Brut.font.bodySemi,
  bodyBold: Brut.font.bodyBold,
  mono: Brut.font.mono,
  monoBold: Brut.font.monoBold,
};

// Space Mono has a real italic; the others are slanted. Web synthesises
// oblique per glyph; native can't for custom fonts, so it gets a skew.
const SLANT: TextStyle =
  Platform.OS === 'web'
    ? { fontStyle: 'italic' }
    : { transform: [{ skewX: `${Brut.slantDeg}deg` }] };

/** StyleSheet-friendly type styles for screens that keep plain <Text>. */
export const bt = {
  display: (fontSize: number): TextStyle => ({
    fontFamily: Brut.font.display,
    fontSize,
    lineHeight: Math.round(fontSize * 1.08),
    letterSpacing: 0.2,
    ...SLANT,
  }),
  body: (fontSize = 15, weight: 'body' | 'bodySemi' | 'bodyBold' = 'body'): TextStyle => ({
    fontFamily: FAMILY[weight],
    fontSize,
    lineHeight: Math.round(fontSize * 1.38),
    ...SLANT,
  }),
  mono: (fontSize = 11, bold = false): TextStyle => ({
    fontFamily: bold ? Brut.font.monoBold : Brut.font.mono,
    fontSize,
    letterSpacing: 0.6,
  }),
};

interface BTextProps extends TextProps {
  variant?: Variant;
  size?: number;
  color?: string;
  /** Opt out of the slant (long paragraphs, tabular data). */
  upright?: boolean;
  style?: StyleProp<TextStyle>;
}

export function BText({
  variant = 'body',
  size,
  color = Brut.ink,
  upright,
  style,
  ...rest
}: BTextProps) {
  const isMono = variant === 'mono' || variant === 'monoBold';
  const isDisplay = variant === 'display';
  const fontSize = size ?? (isDisplay ? 40 : isMono ? 11 : 15);
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: FAMILY[variant],
          fontSize,
          color,
          // Anton is tall and tight; give it room so accents don't clip.
          lineHeight: isDisplay ? Math.round(fontSize * 1.08) : Math.round(fontSize * 1.38),
          letterSpacing: isMono ? 0.6 : isDisplay ? 0.2 : -0.1,
        },
        !upright && !isMono && SLANT,
        style,
      ]}
    />
  );
}

// ── Box ────────────────────────────────────────────────────────────────

interface BoxProps {
  children?: React.ReactNode;
  bg?: string;
  ink?: string;
  shadow?: number;
  shadowColor?: string;
  radius?: number;
  dashed?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Outlined box with a hard offset shadow drawn as its own layer. */
export function BBox({
  children,
  bg = Brut.surface,
  ink = Brut.ink,
  shadow = Brut.shadow.md,
  shadowColor,
  radius = Brut.radius.lg,
  dashed,
  style,
  contentStyle,
}: BoxProps) {
  return (
    <View style={[{ marginRight: shadow, marginBottom: shadow }, style]}>
      {shadow > 0 && !dashed && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              top: shadow,
              left: shadow,
              right: -shadow,
              bottom: -shadow,
              borderRadius: radius,
              backgroundColor: shadowColor ?? ink,
            },
          ]}
        />
      )}
      <View
        style={[
          {
            backgroundColor: bg,
            borderWidth: Brut.border,
            borderColor: ink,
            borderRadius: radius,
            borderStyle: dashed ? 'dashed' : 'solid',
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

// ── Pressable box ──────────────────────────────────────────────────────

interface PressBoxProps extends Omit<PressableProps, 'style' | 'children'>, BoxProps {}

/** A BBox that sinks into its shadow while pressed. */
export function BPress({
  children,
  bg = Brut.surface,
  ink = Brut.ink,
  shadow = Brut.shadow.sm,
  shadowColor,
  radius = Brut.radius.md,
  style,
  contentStyle,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: PressBoxProps) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  const sink = Math.max(0, shadow - 1);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * sink }, { translateY: p.value * sink }],
  }));

  const handleIn = useCallback<NonNullable<PressableProps['onPressIn']>>(
    (e) => {
      p.value = reduce ? 1 : withTiming(1, { duration: Brut.motion.press });
      onPressIn?.(e);
    },
    [onPressIn, p, reduce],
  );
  const handleOut = useCallback<NonNullable<PressableProps['onPressOut']>>(
    (e) => {
      p.value = reduce ? 0 : withTiming(0, { duration: Brut.motion.press });
      onPressOut?.(e);
    },
    [onPressOut, p, reduce],
  );

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={handleIn}
      onPressOut={handleOut}
      style={[{ marginRight: shadow, marginBottom: shadow, opacity: disabled ? 0.35 : 1 }, style]}
    >
      {shadow > 0 && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              top: shadow,
              left: shadow,
              right: -shadow,
              bottom: -shadow,
              borderRadius: radius,
              backgroundColor: shadowColor ?? ink,
            },
          ]}
        />
      )}
      <Animated.View
        style={[
          {
            backgroundColor: bg,
            borderWidth: Brut.border,
            borderColor: ink,
            borderRadius: radius,
          },
          contentStyle,
          animated,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ── Small pieces ───────────────────────────────────────────────────────

/** Mono tag in a bordered pill, e.g. "IA · 0,85". */
export function BTag({
  children,
  bg = 'transparent',
  ink = Brut.ink,
  color,
}: {
  children: React.ReactNode;
  bg?: string;
  ink?: string;
  color?: string;
}) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderWidth: Brut.border,
        borderColor: ink,
        borderRadius: 8,
        paddingHorizontal: 7,
        paddingVertical: 2,
        backgroundColor: bg,
      }}
    >
      <BText variant="monoBold" size={10} color={color ?? ink}>
        {children}
      </BText>
    </View>
  );
}

/** The faint dot grid behind every Brut screen. */
export const DotGrid = React.memo(function DotGrid({ color = Brut.dot }: { color?: string }) {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id="brut-dots" width={14} height={14} patternUnits="userSpaceOnUse">
          <Circle cx={1} cy={1} r={1} fill={color} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#brut-dots)" />
    </Svg>
  );
});

/** Screen ground: background colour + dot grid. */
export function BScreen({
  children,
  night,
  style,
}: {
  children: React.ReactNode;
  night?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flex: 1, backgroundColor: night ? Brut.night.bg : Brut.bg }, style]}>
      <DotGrid color={night ? Brut.night.dot : Brut.dot} />
      {children}
    </View>
  );
}
