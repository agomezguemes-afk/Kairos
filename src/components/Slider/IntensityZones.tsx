import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const INTENSITY_ZONES = [
  { label: 'Recuperación', emoji: '🌱', color: '#10b981', min: 0, max: 30 },
  { label: 'Estándar', emoji: '💪', color: '#3b82f6', min: 30, max: 60 },
  { label: 'Intenso', emoji: '🔥', color: '#f59e0b', min: 60, max: 90 },
  { label: 'Extremo', emoji: '🚀', color: '#ef4444', min: 90, max: 120 },
  { label: 'Maratón', emoji: '🏃‍♂️', color: '#8b5cf6', min: 120, max: 180 },
];

interface ZoneItemProps {
  zone: typeof INTENSITY_ZONES[number];
  isActive: boolean;
  isPast: boolean;
}

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedText = Animated.createAnimatedComponent(Text);

const ZoneItem = React.memo(({ zone, isActive, isPast }: ZoneItemProps) => {
  const zoneStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(isActive ? 1.05 : 1, { damping: 15 }) },
    ],
    backgroundColor: isActive ? `${zone.color}20` : 'transparent',
  }));

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(isActive ? 1.2 : 1, { damping: 12 }) },
    ],
    opacity: withSpring(isPast ? 1 : 0.5, { damping: 15 }),
  }));

  const textStyle = useAnimatedStyle(() => ({
    color: isActive ? zone.color : '#9ca3af',
    fontWeight: isActive ? '700' : '500',
    opacity: withSpring(isPast ? 1 : 0.6, { damping: 15 }),
  }));

  return (
    <AnimatedView style={[styles.zone, zoneStyle]}>
      <AnimatedText style={[styles.emoji, emojiStyle]}>
        {zone.emoji}
      </AnimatedText>
      <AnimatedText style={[styles.label, textStyle]}>
        {zone.label}
      </AnimatedText>
    </AnimatedView>
  );
});

interface SegmentProps {
  zone: typeof INTENSITY_ZONES[number];
  isActive: boolean;
  isPast: boolean;
}

const Segment = React.memo(({ zone, isActive, isPast }: SegmentProps) => {
  const segmentStyle = useAnimatedStyle(() => ({
    backgroundColor: withSpring(
      isPast ? zone.color : '#374151',
      { damping: 20 }
    ),
    flex: withSpring(isActive ? 1.2 : 1, { damping: 15 }),
  }));

  return <AnimatedView style={[styles.progressSegment, segmentStyle]} />;
});

interface IntensityZonesProps {
  currentMinutes: number;
}

export default function IntensityZones({ currentMinutes }: IntensityZonesProps) {
  const activeZoneIndex = INTENSITY_ZONES.findIndex(
    zone => currentMinutes >= zone.min && currentMinutes < zone.max
  );

  return (
    <View style={styles.container}>
      <View style={styles.zonesContainer}>
        {INTENSITY_ZONES.map((zone, index) => (
          <ZoneItem
            key={zone.label}
            zone={zone}
            isActive={index === activeZoneIndex}
            isPast={currentMinutes >= zone.min}
          />
        ))}
      </View>

      <View style={styles.progressLine}>
        {INTENSITY_ZONES.map((zone, index) => (
          <React.Fragment key={`segment-${index}`}>
            <Segment
              zone={zone}
              isActive={index === activeZoneIndex}
              isPast={index <= activeZoneIndex}
            />
            {index < INTENSITY_ZONES.length - 1 && (
              <View style={styles.segmentDivider} />
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 20,
  },
  zonesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  zone: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    minWidth: 70,
  },
  emoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  progressLine: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressSegment: {
    height: '100%',
    borderRadius: 2,
  },
  segmentDivider: {
    width: 1,
    backgroundColor: '#1f2937',
  },
});
