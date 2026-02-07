import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Stack</Text>
        <Text style={styles.subtitle}>
          All in One Coach
        </Text>
        <Text style={styles.description}>
          Seguimiento inteligente que evoluciona contigo.{'\n'}
          Análisis de rendimiento y rutinas adaptadas.
        </Text>
        
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Comenzar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.linkButton}>
          <Text style={styles.linkText}>Ya tengo cuenta</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.footer}>v1.0.0 - Beta</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0d',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 20,
    color: '#a0a0a0',
    marginBottom: 30,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 50,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 60,
    borderRadius: 12,
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  linkButton: {
    padding: 10,
  },
  linkText: {
    color: '#3b82f6',
    fontSize: 16,
  },
  footer: {
    textAlign: 'center',
    color: '#333',
    paddingBottom: 30,
    fontSize: 12,
  },
});