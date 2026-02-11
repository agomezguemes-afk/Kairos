import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

export default function ProfileTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Perfil</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚙️ Configuración</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔗 Integraciones</Text>
      </View>

      <Pressable style={styles.logoutButton}>
        <Text style={styles.logoutText}>🚪 Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0d',
    paddingHorizontal: 24,
    paddingTop: 60,
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
  },
  logoutButton: {
    backgroundColor: '#1a1a1d',
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  logoutText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ef4444',
    textAlign: 'center',
  },
});
