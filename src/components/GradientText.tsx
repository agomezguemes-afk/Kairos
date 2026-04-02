import React, { useEffect, useRef } from 'react';
import { Text, Animated, StyleSheet, TextStyle, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface GradientTextProps {
  children: string;
  colors?: string[];
  style?: TextStyle;
  speed?: number;
}

export default function GradientText({
  children,
  colors = ['#7439ff', '#d7bcfd', '#e4d9ff', '#e6d5ff', '#7439ff'],
  style,
  speed = 4000,
}: GradientTextProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: speed,
        useNativeDriver: true,
      })
    ).start();
  }, [speed]);

  // El gradiente debe ser 3x el ancho de la pantalla
  const gradientWidth = SCREEN_WIDTH * 3;
  
  // Mover exactamente 1/3 del ancho total para loop perfecto
  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -SCREEN_WIDTH],
  });

  // Triplicar colores para transición perfecta
  const gradientColors = [
    ...colors,
    ...colors,
    ...colors,
  ] as [string, string, ...string[]];

  return (
    <View style={styles.wrapper}>
      <MaskedView
        style={styles.maskedView}
        maskElement={
          <View style={styles.centerContainer}>
            <Text style={[styles.text, style]}>{children}</Text>
          </View>
        }
      >
        <Animated.View
          style={{
            width: gradientWidth,
            height: 100,
            transform: [{ translateX }],
          }}
        >
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              width: gradientWidth,
              height: 100,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={[styles.text, style, { opacity: 0 }]}>{children}</Text>
          </LinearGradient>
        </Animated.View>
      </MaskedView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    width: SCREEN_WIDTH,
  },
  maskedView: {
    height: 100,
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 56,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
