import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function WorkoutTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Entrenar</Text>
      <Text style={styles.subtitle}>Próximamente: rutinas personalizadas</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0d',
    paddingHorizontal: 24,
    paddingTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
  },
});
