// KAIROS — ProgressTree
// Parametric SVG tree that grows with the user's progress.
// 5 visual levels per tree type. Level 0 = seed/pot only.

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Ellipse, Rect, G, Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import type { TreeType } from '../types/tree';
import { Colors, Animation } from '../theme/index';

interface ProgressTreeProps {
  type: TreeType;
  level: number; // 0-5
  size?: number;
}

const GOLD = Colors.accent.primary;
const GOLD_LIGHT = Colors.accent.light;

export default function ProgressTree({ type, level, size = 260 }: ProgressTreeProps) {
  // Animate scale on level change
  const treeScale = useSharedValue(0.9);
  useEffect(() => {
    treeScale.value = withSpring(1, Animation.spring.gentle);
  }, [level]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: treeScale.value }],
  }));

  return (
    <Animated.View style={[styles.container, { width: size, height: size }, animStyle]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        {/* Pot / ground */}
        <Ellipse cx="100" cy="185" rx="40" ry="8" fill={Colors.background.elevated} />
        <Rect x="75" y="170" width="50" height="18" rx="4" fill={GOLD_LIGHT} />
        <Rect x="80" y="168" width="40" height="4" rx="2" fill={GOLD} />

        {type === 'oak' && <OakTree level={level} />}
        {type === 'palm' && <PalmTree level={level} />}
        {type === 'bamboo' && <BambooTree level={level} />}
        {type === 'cactus' && <CactusTree level={level} />}
      </Svg>
    </Animated.View>
  );
}

// ======================== OAK ========================

function OakTree({ level }: { level: number }) {
  if (level === 0) {
    // Seed
    return (
      <G>
        <Ellipse cx="100" cy="165" rx="6" ry="4" fill="#8B6914" />
        <Path d="M100 165 Q102 158 98 155" stroke="#6B8E23" strokeWidth="1.5" fill="none" />
      </G>
    );
  }

  const trunkH = 30 + level * 16; // grows taller
  const trunkW = 4 + level * 2;   // grows thicker
  const trunkTop = 170 - trunkH;

  return (
    <G>
      {/* Trunk */}
      <Rect
        x={100 - trunkW / 2}
        y={trunkTop}
        width={trunkW}
        height={trunkH}
        rx={trunkW / 3}
        fill="#8B6914"
      />

      {/* Branches (level 2+) */}
      {level >= 2 && (
        <G>
          <Line x1="100" y1={trunkTop + 20} x2="72" y2={trunkTop + 5} stroke="#8B6914" strokeWidth="3" strokeLinecap="round" />
          <Line x1="100" y1={trunkTop + 20} x2="128" y2={trunkTop + 8} stroke="#8B6914" strokeWidth="3" strokeLinecap="round" />
        </G>
      )}

      {/* Canopy: circles that grow with level */}
      {level >= 1 && (
        <Circle cx="100" cy={trunkTop - 5} r={14 + level * 4} fill="#4CAF50" opacity={0.85} />
      )}
      {level >= 2 && (
        <G>
          <Circle cx="82" cy={trunkTop + 2} r={10 + level * 2} fill="#66BB6A" opacity={0.8} />
          <Circle cx="118" cy={trunkTop + 4} r={10 + level * 2} fill="#66BB6A" opacity={0.8} />
        </G>
      )}
      {level >= 3 && (
        <G>
          <Circle cx="90" cy={trunkTop - 15} r={8 + level} fill="#81C784" opacity={0.7} />
          <Circle cx="112" cy={trunkTop - 12} r={7 + level} fill="#81C784" opacity={0.7} />
        </G>
      )}

      {/* Flowers (level 4+) */}
      {level >= 4 && (
        <G>
          <Circle cx="88" cy={trunkTop - 8} r="3" fill="#FFD54F" />
          <Circle cx="115" cy={trunkTop - 2} r="3" fill="#FFD54F" />
          <Circle cx="100" cy={trunkTop - 20} r="3" fill="#FFD54F" />
        </G>
      )}

      {/* Fruits (level 5) */}
      {level >= 5 && (
        <G>
          <Circle cx="82" cy={trunkTop + 8} r="4" fill="#E53935" />
          <Circle cx="118" cy={trunkTop + 10} r="4" fill="#E53935" />
          <Circle cx="96" cy={trunkTop - 6} r="4" fill="#E53935" />
          <Circle cx="108" cy={trunkTop - 14} r="4" fill="#E53935" />
          {/* Crown */}
          <Circle cx="100" cy={trunkTop - 28} r="6" fill={GOLD} opacity={0.9} />
        </G>
      )}
    </G>
  );
}

// ======================== PALM ========================

function PalmTree({ level }: { level: number }) {
  if (level === 0) {
    return (
      <G>
        <Ellipse cx="100" cy="165" rx="5" ry="3" fill="#D2B48C" />
        <Path d="M100 165 Q103 159 97 156" stroke="#6B8E23" strokeWidth="1.5" fill="none" />
      </G>
    );
  }

  const trunkH = 40 + level * 18;
  const trunkTop = 170 - trunkH;

  return (
    <G>
      {/* Curved trunk */}
      <Path
        d={`M100 170 Q95 ${170 - trunkH / 2} ${98 + level} ${trunkTop}`}
        stroke="#D2B48C"
        strokeWidth={3 + level}
        fill="none"
        strokeLinecap="round"
      />
      {/* Trunk rings */}
      {Array.from({ length: Math.min(level * 2, 8) }, (_, i) => (
        <Line
          key={`ring-${i}`}
          x1={97 - level / 2}
          y1={170 - (i + 1) * (trunkH / (level * 2 + 2))}
          x2={103 + level / 2}
          y2={170 - (i + 1) * (trunkH / (level * 2 + 2))}
          stroke="#C4A06A"
          strokeWidth="1"
          opacity={0.5}
        />
      ))}

      {/* Fronds */}
      {level >= 1 && (
        <G>
          <Path d={`M${98 + level} ${trunkTop} Q80 ${trunkTop - 15} 60 ${trunkTop + 5}`} stroke="#4CAF50" strokeWidth="2.5" fill="none" />
          <Path d={`M${98 + level} ${trunkTop} Q120 ${trunkTop - 15} 140 ${trunkTop + 5}`} stroke="#4CAF50" strokeWidth="2.5" fill="none" />
        </G>
      )}
      {level >= 2 && (
        <G>
          <Path d={`M${98 + level} ${trunkTop} Q75 ${trunkTop - 25} 55 ${trunkTop - 10}`} stroke="#66BB6A" strokeWidth="2" fill="none" />
          <Path d={`M${98 + level} ${trunkTop} Q125 ${trunkTop - 25} 145 ${trunkTop - 10}`} stroke="#66BB6A" strokeWidth="2" fill="none" />
        </G>
      )}
      {level >= 3 && (
        <G>
          <Path d={`M${98 + level} ${trunkTop} Q90 ${trunkTop - 35} 70 ${trunkTop - 25}`} stroke="#81C784" strokeWidth="2" fill="none" />
          <Path d={`M${98 + level} ${trunkTop} Q110 ${trunkTop - 35} 130 ${trunkTop - 25}`} stroke="#81C784" strokeWidth="2" fill="none" />
          <Path d={`M${98 + level} ${trunkTop} Q100 ${trunkTop - 40} 100 ${trunkTop - 30}`} stroke="#66BB6A" strokeWidth="2" fill="none" />
        </G>
      )}

      {/* Coconuts (level 4+) */}
      {level >= 4 && (
        <G>
          <Circle cx={96 + level} cy={trunkTop + 3} r="4" fill="#8D6E63" />
          <Circle cx={101 + level} cy={trunkTop + 5} r="4" fill="#A1887F" />
        </G>
      )}
      {level >= 5 && (
        <G>
          <Circle cx={93 + level} cy={trunkTop + 6} r="4" fill="#8D6E63" />
          <Circle cx={98 + level} cy={trunkTop - 2} r="5" fill={GOLD} opacity={0.9} />
        </G>
      )}
    </G>
  );
}

// ======================== BAMBOO ========================

function BambooTree({ level }: { level: number }) {
  if (level === 0) {
    return (
      <G>
        <Rect x="98" y="158" width="4" height="12" rx="2" fill="#7CB342" />
      </G>
    );
  }

  const segmentCount = level + 1;
  const segH = 16;
  const baseY = 170;

  return (
    <G>
      {/* Main stalk */}
      {Array.from({ length: segmentCount }, (_, i) => {
        const y = baseY - (i + 1) * segH;
        return (
          <G key={`seg-${i}`}>
            <Rect x="97" y={y} width="6" height={segH - 2} rx="3" fill="#7CB342" />
            <Line x1="95" y1={y + segH - 2} x2="105" y2={y + segH - 2} stroke="#558B2F" strokeWidth="1.5" />
          </G>
        );
      })}

      {/* Side shoots (level 2+) */}
      {level >= 2 && (
        <G>
          <Line x1="97" y1={baseY - 2 * segH} x2="80" y2={baseY - 2.5 * segH} stroke="#8BC34A" strokeWidth="2" />
          <Ellipse cx="76" cy={baseY - 2.6 * segH} rx="8" ry="4" fill="#8BC34A" opacity={0.7} />
        </G>
      )}
      {level >= 3 && (
        <G>
          <Line x1="103" y1={baseY - 3 * segH} x2="120" y2={baseY - 3.5 * segH} stroke="#8BC34A" strokeWidth="2" />
          <Ellipse cx="124" cy={baseY - 3.6 * segH} rx="8" ry="4" fill="#8BC34A" opacity={0.7} />
          <Line x1="97" y1={baseY - 4 * segH} x2="78" y2={baseY - 4.5 * segH} stroke="#9CCC65" strokeWidth="1.5" />
          <Ellipse cx="74" cy={baseY - 4.6 * segH} rx="7" ry="3" fill="#9CCC65" opacity={0.6} />
        </G>
      )}

      {/* Second stalk (level 3+) */}
      {level >= 3 && (
        <G>
          {Array.from({ length: segmentCount - 1 }, (_, i) => {
            const y = baseY - (i + 1) * segH + 4;
            return (
              <G key={`seg2-${i}`}>
                <Rect x="109" y={y} width="5" height={segH - 2} rx="2.5" fill="#9CCC65" opacity={0.8} />
              </G>
            );
          })}
        </G>
      )}

      {/* Flowers (level 4+) */}
      {level >= 4 && (
        <G>
          <Circle cx="100" cy={baseY - (segmentCount + 0.5) * segH} r="4" fill="#E8D5B7" />
          <Circle cx="76" cy={baseY - 2.9 * segH} r="3" fill="#FFD54F" />
        </G>
      )}

      {/* Golden crown (level 5) */}
      {level >= 5 && (
        <G>
          <Circle cx="100" cy={baseY - (segmentCount + 1) * segH} r="6" fill={GOLD} opacity={0.9} />
          <Circle cx="113" cy={baseY - segmentCount * segH + 4} r="3" fill="#FFD54F" />
        </G>
      )}
    </G>
  );
}

// ======================== CACTUS ========================

function CactusTree({ level }: { level: number }) {
  if (level === 0) {
    return (
      <G>
        <Ellipse cx="100" cy="163" rx="5" ry="7" fill="#4CAF50" />
      </G>
    );
  }

  const bodyH = 30 + level * 14;
  const bodyW = 12 + level * 3;
  const bodyTop = 170 - bodyH;

  return (
    <G>
      {/* Main body */}
      <Rect
        x={100 - bodyW / 2}
        y={bodyTop}
        width={bodyW}
        height={bodyH}
        rx={bodyW / 2}
        fill="#4CAF50"
      />
      {/* Ridge lines */}
      <Line x1="100" y1={bodyTop + 5} x2="100" y2={bodyTop + bodyH - 5} stroke="#388E3C" strokeWidth="1" opacity={0.4} />
      <Line x1={100 - bodyW / 4} y1={bodyTop + 5} x2={100 - bodyW / 4} y2={bodyTop + bodyH - 5} stroke="#388E3C" strokeWidth="0.5" opacity={0.3} />
      <Line x1={100 + bodyW / 4} y1={bodyTop + 5} x2={100 + bodyW / 4} y2={bodyTop + bodyH - 5} stroke="#388E3C" strokeWidth="0.5" opacity={0.3} />

      {/* Arms (level 2+) */}
      {level >= 2 && (
        <G>
          {/* Left arm */}
          <Path d={`M${100 - bodyW / 2} ${bodyTop + bodyH * 0.4} H${100 - bodyW / 2 - 15} V${bodyTop + bodyH * 0.15}`}
            stroke="#4CAF50" strokeWidth={bodyW * 0.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      )}
      {level >= 3 && (
        <G>
          {/* Right arm */}
          <Path d={`M${100 + bodyW / 2} ${bodyTop + bodyH * 0.5} H${100 + bodyW / 2 + 15} V${bodyTop + bodyH * 0.25}`}
            stroke="#66BB6A" strokeWidth={bodyW * 0.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      )}

      {/* Flowers (level 4+) */}
      {level >= 4 && (
        <G>
          <Circle cx="100" cy={bodyTop - 2} r="5" fill="#FF7043" />
          <Circle cx="100" cy={bodyTop - 2} r="2" fill="#FFD54F" />
        </G>
      )}
      {level >= 4 && level < 5 && (
        <Circle cx={100 - bodyW / 2 - 15} cy={bodyTop + bodyH * 0.12} r="4" fill="#FF8A65" />
      )}

      {/* Full bloom + gold (level 5) */}
      {level >= 5 && (
        <G>
          <Circle cx={100 - bodyW / 2 - 15} cy={bodyTop + bodyH * 0.12} r="5" fill="#FF7043" />
          <Circle cx={100 + bodyW / 2 + 15} cy={bodyTop + bodyH * 0.22} r="4" fill="#FF8A65" />
          <Circle cx="100" cy={bodyTop - 5} r="7" fill={GOLD} opacity={0.9} />
        </G>
      )}
    </G>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
