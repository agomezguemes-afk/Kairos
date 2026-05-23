import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { Colors } from '../theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const VIEWBOX = 100;
const C_LEN = 2 * Math.PI * 42;          // ≈ 263.89
const V_LEN = 56;                          // K spine
const D_LEN = Math.sqrt(30 * 30 + 28 * 28); // ≈ 41.04 — both diagonals

const DRAW_TOTAL = 1500;
const BREATH_HALF = 1500;

export interface AnimatedKairosLogoProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** Plays the draw-on sequence on mount. Defaults true. */
  autoplay?: boolean;
  /** Idle breathing scale loop after the draw completes. Defaults true. */
  breathing?: boolean;
  /** ms before the draw starts. */
  delay?: number;
  /** Fired once the draw sequence has finished. */
  onReady?: () => void;
}

/**
 * Kairos isotype with a draw-in animation followed by a calm breath loop.
 *
 * Choreography (1.5s total):
 *   0     → 700  : outer circle traces clockwise from 12 o'clock
 *   200   → 800  : K spine draws top → bottom
 *   500   → 1000 : upper diagonal draws centre → apex
 *   700   → 1200 : lower diagonal draws centre → bottom-right
 *   1300  → 1500 : apex dot fades in
 *   1600+ : breathing scale 1.0 ↔ 1.02 every 3s, infinite.
 */
export default function AnimatedKairosLogo({
  size = 80,
  color,
  strokeWidth = 2,
  autoplay = true,
  breathing = true,
  delay = 0,
  onReady,
}: AnimatedKairosLogoProps) {
  const stroke = color ?? Colors.gold.base;

  const initial = autoplay ? 0 : 1;
  const ringP = useSharedValue(initial);
  const spineP = useSharedValue(initial);
  const upP = useSharedValue(initial);
  const downP = useSharedValue(initial);
  const dotOp = useSharedValue(initial);
  const breath = useSharedValue(1);

  useEffect(() => {
    if (!autoplay) {
      onReady?.();
      return;
    }
    const ease = Easing.out(Easing.cubic);
    ringP.value = withDelay(delay, withTiming(1, { duration: 700, easing: ease }));
    spineP.value = withDelay(delay + 200, withTiming(1, { duration: 600, easing: ease }));
    upP.value = withDelay(delay + 500, withTiming(1, { duration: 500, easing: ease }));
    downP.value = withDelay(delay + 700, withTiming(1, { duration: 500, easing: ease }));
    dotOp.value = withDelay(
      delay + 1300,
      withTiming(1, { duration: 200, easing: ease }, (finished) => {
        if (finished && onReady) {
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          runReady();
        }
      }),
    );

    function runReady() {
      onReady?.();
    }
  }, [autoplay, delay, onReady, ringP, spineP, upP, downP, dotOp]);

  useEffect(() => {
    if (!breathing) return;
    breath.value = withDelay(
      DRAW_TOTAL + 100,
      withRepeat(
        withSequence(
          withTiming(1.02, { duration: BREATH_HALF, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: BREATH_HALF, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [breathing, breath]);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: C_LEN * (1 - ringP.value),
  }));
  const spineProps = useAnimatedProps(() => ({
    strokeDashoffset: V_LEN * (1 - spineP.value),
  }));
  const upProps = useAnimatedProps(() => ({
    strokeDashoffset: D_LEN * (1 - upP.value),
  }));
  const downProps = useAnimatedProps(() => ({
    strokeDashoffset: D_LEN * (1 - downP.value),
  }));
  const dotProps = useAnimatedProps(() => ({
    opacity: dotOp.value,
  }));

  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value }],
  }));

  return (
    <Animated.View style={wrapperStyle}>
      <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
        <G>
          <AnimatedCircle
            cx={50}
            cy={50}
            r={42}
            stroke={stroke}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${C_LEN} ${C_LEN}`}
            transform="rotate(-90 50 50)"
            animatedProps={ringProps}
          />
          <AnimatedPath
            d="M36 22 L36 78"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${V_LEN} ${V_LEN}`}
            animatedProps={spineProps}
          />
          <AnimatedPath
            d="M36 50 L66 22"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${D_LEN} ${D_LEN}`}
            animatedProps={upProps}
          />
          <AnimatedPath
            d="M36 50 L66 78"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${D_LEN} ${D_LEN}`}
            animatedProps={downProps}
          />
          <AnimatedCircle
            cx={66}
            cy={22}
            r={3.5}
            fill={stroke}
            animatedProps={dotProps}
          />
        </G>
      </Svg>
    </Animated.View>
  );
}
