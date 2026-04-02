import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function WelcomeScreen() {
  const navigation = useNavigation<any>();
  
  // Animaciones para el botón principal
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      friction: 6,
      tension: 50,
    }).start();
    
    Animated.timing(opacityAnim, {
      toValue: 0.9,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 4,
      tension: 50,
    }).start();
    
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  // Animación para el texto de login
  const loginScaleAnim = useRef(new Animated.Value(1)).current;

  const handleLoginPressIn = () => {
    Animated.spring(loginScaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  };

  const handleLoginPressOut = () => {
    Animated.spring(loginScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 40,
    }).start();
  };

  return (
    <View style={styles.container}>
      {/* Header centrado verticalmente */}
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Kairos</Text>
        <Text style={styles.subtitle}>The Training OS</Text>
      </View>

      {/* Footer + botones en la parte inferior */}
      <View style={styles.footerContainer}>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => navigation.navigate('Setup')}
          style={{ width: '100%' }}
        >
          <Animated.View
            style={[
              styles.button,
              {
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}
          >
            <Text style={styles.buttonText}>Empezar</Text>
          </Animated.View>
        </Pressable>

        <Pressable
          onPressIn={handleLoginPressIn}
          onPressOut={handleLoginPressOut}
          onPress={() => console.log('Iniciar sesión')}
        >
          <Animated.View style={{ transform: [{ scale: loginScaleAnim }] }}>
            <Text style={styles.loginText}>Iniciar sesión</Text>
          </Animated.View>
        </Pressable>

        <Text style={styles.footer}>v1.0.0 · Beta</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0d',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
  },
  headerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerContainer: {
    alignItems: 'center',
    paddingBottom: 30,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    color: '#a0a0a0',
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 60,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    textDecorationLine: 'underline',
    marginBottom: 24,
  },
  footer: {
    color: '#666',
    fontSize: 12,
  },
});