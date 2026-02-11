import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';

export default function SignInWithAppleButton({ onSuccess }: { onSuccess: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onSuccess}>
      <Text style={styles.text}>Iniciar sesión con Apple</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#000',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginVertical: 10,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontWeight: '600',
  },
});
