import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function WelcomeScreen() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      {/* Header centrado verticalmente */}
      <View style={styles.headerContainer}>
        <Text style={styles.title}>GymBud</Text>
        <Text style={styles.subtitle}>Tu entrenador inteligente</Text>
      </View>

      {/* Footer + botones en la parte inferior */}
      <View style={styles.footerContainer}>
        <Pressable
          style={styles.button}
          onPress={() => navigation.navigate('Setup')}
        >
          <Text style={styles.buttonText}>Empezar</Text>
        </Pressable>

        <Pressable onPress={() => console.log('Iniciar sesión')}>
          <Text style={styles.loginText}>Iniciar sesión</Text>
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
    justifyContent: 'space-between', // Mantiene header y footer separados
    paddingHorizontal: 30,
  },
  headerContainer: {
    flex: 1, // Ocupa todo el espacio disponible
    justifyContent: 'center', // Centra verticalmente GymBud + subtitulo
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
