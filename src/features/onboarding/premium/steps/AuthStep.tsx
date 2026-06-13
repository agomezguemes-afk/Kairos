// KAIROS — AuthStep: the sign-in moment.
//
// First screen after the brand welcome. Premium, low-friction account creation:
// Apple / Google one-taps up top, email as the quiet third option. Presentational
// — it calls onAuth(provider); the real Supabase/OAuth wiring lives in the app's
// auth store and is connected when this flow is mounted for real.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing, Type } from '../../../../theme/tokens';
import { text } from '../textStyles';
import PressableScale from '../motion/PressableScale';
import { AppleGlyph, GoogleGlyph, MailGlyph } from './BrandGlyphs';

export type AuthProvider = 'apple' | 'google' | 'email';

interface AuthStepProps {
  onAuth: (provider: AuthProvider) => void;
}

export default function AuthStep({ onAuth }: AuthStepProps) {
  return (
    <View style={styles.root}>
      <Text style={text.wordmark}>
        Kairos<Text style={text.wordmarkDot}>.</Text>
      </Text>

      <View style={styles.hero}>
        <Text style={text.eyebrow}>CREA TU CUENTA</Text>
        <Text style={text.title}>
          Tu progreso,{'\n'}en cualquier <Text style={text.titleAccent}>sitio</Text>.
        </Text>
        <Text style={text.subtitle}>
          Crea tu cuenta para guardar tu espacio y sincronizar todos tus dispositivos.
        </Text>
      </View>

      <View style={styles.providers}>
        <AuthButton
          variant="dark"
          label="Continuar con Apple"
          icon={<AppleGlyph size={18} color="#FFFFFF" />}
          onPress={() => onAuth('apple')}
        />
        <AuthButton
          variant="light"
          label="Continuar con Google"
          icon={<GoogleGlyph size={18} />}
          onPress={() => onAuth('google')}
        />
        <AuthButton
          variant="light"
          label="Continuar con correo"
          icon={<MailGlyph size={18} color={Colors.ink.secondary} />}
          onPress={() => onAuth('email')}
        />

        <Text style={styles.fine}>
          Al continuar aceptas los <Text style={styles.fineStrong}>Términos</Text> y la{' '}
          <Text style={styles.fineStrong}>Privacidad</Text>.
        </Text>
      </View>
    </View>
  );
}

function AuthButton({
  label,
  icon,
  variant,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  variant: 'dark' | 'light';
  onPress: () => void;
}) {
  const dark = variant === 'dark';
  return (
    <PressableScale
      haptic="medium"
      pressScale={0.97}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.btn, dark ? styles.btnDark : styles.btnLight]}
    >
      <View style={styles.btnIcon}>{icon}</View>
      <Text style={[styles.btnLabel, dark ? styles.btnLabelDark : styles.btnLabelLight]}>
        {label}
      </Text>
      {/* spacer keeps the label optically centred against the leading icon */}
      <View style={styles.btnIcon} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: Spacing.sm, paddingBottom: Spacing.lg },
  hero: { flex: 1, justifyContent: 'center', gap: Spacing.lg },
  providers: { gap: Spacing.md },

  // Flat sign-in buttons — pro apps don't float these. Solid dark / crisp white
  // with a hairline; a whisper-tight contact shadow only on the dark one so it
  // doesn't look pasted onto the warm ground.
  btn: {
    height: 56,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  btnDark: {
    backgroundColor: Colors.ink.primary,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  btnLight: {
    backgroundColor: Colors.bg.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.strong,
  },
  btnIcon: { width: 24, alignItems: 'center' },
  btnLabel: { ...Type.subheading, flex: 1, textAlign: 'center' },
  btnLabelDark: { color: Colors.ink.inverse },
  btnLabelLight: { color: Colors.ink.primary },

  fine: {
    ...Type.caption,
    color: Colors.ink.muted,
    textAlign: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  fineStrong: { color: Colors.ink.tertiary, fontFamily: Type.bodyEmph.fontFamily },
});
