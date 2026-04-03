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
    backgroundColor: '#F7F7F5',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  logoutButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#D94040',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  logoutText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#D94040',
    textAlign: 'center',
  },
});
