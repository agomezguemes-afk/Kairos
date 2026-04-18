import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function HomeTab() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Buenos días</Text>
      <Text style={styles.title}>Dashboard</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Racha: 0 días</Text>
        <Text style={styles.cardSubtitle}>Comienza tu primera sesión</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Entrenamiento de hoy</Text>
        <Text style={styles.cardSubtitle}>Aún no configurado</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0d',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  greeting: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#1a1a1d',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#aaa',
  },
});
