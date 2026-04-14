// KAIROS — Auth Screen
// Email + password sign-up / sign-in.
// Toggles between modes. After auth, navigation is driven by AppNavigator.

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/useAuthStore';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/index';

type Mode = 'signin' | 'signup';

export default function AuthScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, isLoading, error, clearError } = useAuthStore();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);
  const btnScale = useRef(new Animated.Value(1)).current;

  const springDown = () =>
    Animated.spring(btnScale, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 8,
    }).start();
  const springUp = () =>
    Animated.spring(btnScale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
    }).start();

  const validate = (): string | null => {
    if (!email.trim()) return 'Ingresa tu correo electrónico.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return 'Correo electrónico no válido.';
    if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
    return null;
  };

  const handleSubmit = useCallback(async () => {
    clearError();
    setLocalError(null);

    const validationError = validate();
    if (validationError) {
      setLocalError(validationError);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const authError =
      mode === 'signup'
        ? await signUp(email.trim(), password)
        : await signIn(email.trim(), password);

    if (authError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    // Success → AppNavigator reacts to session change automatically.
  }, [email, password, mode, signIn, signUp, clearError]);

  const toggleMode = () => {
    clearError();
    setLocalError(null);
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
  };

  const displayError = localError ?? error;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back arrow */}
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.back}
        >
          <Feather name="arrow-left" size={22} color={Colors.text.primary} />
        </Pressable>

        {/* Branding */}
        <View style={styles.brand}>
          <View style={styles.logoMark}>
            <Text style={styles.logoLetter}>K</Text>
          </View>
          <Text style={styles.title}>
            {mode === 'signin' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'signin'
              ? 'Inicia sesión para continuar entrenando.'
              : 'Empieza a construir tu Training OS personal.'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Correo electrónico</Text>
            <View style={styles.inputRow}>
              <Feather
                name="mail"
                size={16}
                color={Colors.text.tertiary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="tu@correo.com"
                placeholderTextColor={Colors.text.disabled}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.inputRow}>
              <Feather
                name="lock"
                size={16}
                color={Colors.text.tertiary}
                style={styles.inputIcon}
              />
              <TextInput
                ref={passwordRef}
                style={[styles.input, { flex: 1 }]}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={Colors.text.disabled}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              <Pressable
                onPress={() => setShowPassword((s) => !s)}
                hitSlop={8}
                style={styles.eyeBtn}
              >
                <Feather
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={16}
                  color={Colors.text.tertiary}
                />
              </Pressable>
            </View>
          </View>

          {/* Error */}
          {displayError ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color={Colors.semantic.error} />
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          {/* Forgot password (sign-in only) */}
          {mode === 'signin' && (
            <Pressable
              style={styles.forgotBtn}
              onPress={() => {
                /* TODO: implement password reset */
                console.log('[Auth] forgot password tapped');
              }}
            >
              <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
            </Pressable>
          )}

          {/* Primary CTA */}
          <Pressable
            onPressIn={springDown}
            onPressOut={springUp}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            <Animated.View
              style={[
                styles.primaryBtn,
                { transform: [{ scale: btnScale }] },
                isLoading && styles.primaryBtnDisabled,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.text.inverse} size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
                </Text>
              )}
            </Animated.View>
          </Pressable>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social placeholders */}
          <Pressable
            style={styles.socialBtn}
            onPress={() => {
              // TODO: implement Google OAuth
              console.log('[Auth] Google sign-in tapped — not yet implemented');
            }}
          >
            <Feather name="globe" size={18} color={Colors.text.primary} />
            <Text style={styles.socialBtnText}>Continuar con Google</Text>
          </Pressable>

          <Pressable
            style={styles.socialBtn}
            onPress={() => {
              // TODO: implement Apple Sign In
              console.log('[Auth] Apple sign-in tapped — not yet implemented');
            }}
          >
            <Feather name="smartphone" size={18} color={Colors.text.primary} />
            <Text style={styles.socialBtnText}>Continuar con Apple</Text>
          </Pressable>
        </View>

        {/* Toggle mode */}
        <Pressable onPress={toggleMode} style={styles.toggleRow}>
          <Text style={styles.toggleText}>
            {mode === 'signin'
              ? '¿Aún no tienes cuenta? '
              : '¿Ya tienes cuenta? '}
          </Text>
          <Text style={styles.toggleLink}>
            {mode === 'signin' ? 'Regístrate' : 'Inicia sesión'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background.void,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.screen.horizontal,
  },
  back: {
    marginBottom: Spacing['2xl'],
    alignSelf: 'flex-start',
  },
  brand: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'] + 4,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.elevated,
    shadowColor: Colors.accent.primary,
  },
  logoLetter: {
    fontSize: 26,
    fontWeight: Typography.weight.bold,
    color: Colors.text.inverse,
    marginTop: -2,
  },
  title: {
    fontSize: Typography.size.title,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.size.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: Typography.size.body * 1.5,
  },
  form: {
    gap: Spacing.md,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.secondary,
    marginLeft: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: Typography.size.body,
    color: Colors.text.primary,
    height: '100%',
  },
  eyeBtn: {
    padding: 4,
    marginLeft: Spacing.xs,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: `${Colors.semantic.error}18`,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: `${Colors.semantic.error}40`,
  },
  errorText: {
    fontSize: Typography.size.caption,
    color: Colors.semantic.error,
    flex: 1,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 2,
  },
  forgotText: {
    fontSize: Typography.size.caption,
    color: Colors.accent.primary,
    fontWeight: Typography.weight.medium,
  },
  primaryBtn: {
    backgroundColor: Colors.accent.primary,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
    height: 54,
    ...Shadows.card,
    shadowColor: Colors.accent.primary,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.inverse,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xs,
    gap: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border.light,
  },
  dividerText: {
    fontSize: Typography.size.caption,
    color: Colors.text.disabled,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background.surface,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md + 2,
    height: 52,
  },
  socialBtnText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.medium,
    color: Colors.text.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    flexWrap: 'wrap',
  },
  toggleText: {
    fontSize: Typography.size.body,
    color: Colors.text.secondary,
  },
  toggleLink: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    color: Colors.accent.primary,
  },
});
