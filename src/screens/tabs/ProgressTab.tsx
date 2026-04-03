import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ProgressTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Progreso</Text>
      <Text style={styles.subtitle}>Próximamente: gráficos y estadísticas</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
    paddingHorizontal: 24,
    paddingTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9E9E9E',
  },
});