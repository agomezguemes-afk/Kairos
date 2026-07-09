// KAIROS — AuthStep: the "keep it" moment. Now AFTER the reveal.
//
// The whole flow (manuscript → theatre → reveal) runs guest-first: by the time
// the user reaches this screen, Kai has already built their week. So the ask is
// reframed as saving something that already exists ("guarda lo que Kai acaba de
// crearte") rather than a cold wall before value. A persistent "continuar sin
// cuenta" keeps the guest path always open. Presentational — it calls
// onAuth(provider) / onSkip; the real Supabase/OAuth wiring lives elsewhere.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing, Type } from '../../../../theme/tokens';
import { text } from '../textStyles';
import PressableScale from '../motion/PressableScale';
import { AppleGlyph, GoogleGlyph, MailGlyph } from './BrandGlyphs';

export type AuthProvider = 'apple' | 'google' | 'email';

interface AuthStepProps {
  onAuth: (provider: AuthProvider) => void;
  /** Always-visible guest path — enter without an account. */
  onSkip: () => void;
  /** True while the host finishes wiring up the space after a choice. */
  busy?: boolean;
}

export default function AuthStep({ onAuth, onSkip, busy = false }: AuthStepProps) {
  return (
    <View style={styles.root}>
      <Text style={text.wordmark}>
        Kairos<Text style={text.wordmarkDot}>.</Text>
      </Text>

      <View style={styles.hero}>
        <Text style={text.eyebrow}>GUARDA TU PLAN</Text>
        <Text style={text.title}>
          Guarda lo que Kai{'\n'}acaba de <Text style={text.titleAccent}>crearte</Text>.
        </Text>
        <Text style={text.subtitle}>
          Tu semana ya está montada. Crea tu cuenta para que no se pierda y te siga en todos tus
          dispositivos.
        </Text>
      </View>

      <View style={styles.providers}>
        <AuthButton
          variant="dark"
          label="Continuar con Apple"
          icon={<AppleGlyph size={18} color="#FFFFFF" />}
          onPress={() => onAuth('apple')}
          disabled={busy}
        />
        <AuthButton
          variant="light"
          label="Continuar con Google"
          icon={<GoogleGlyph size={18} />}
          onPress={() => onAuth('google')}
          disabled={busy}
        />
        <AuthButton
          variant="light"
          label="Continuar con correo"
          icon={<MailGlyph size={18} color={Colors.ink.secondary} />}
          onPress={() => onAuth('email')}
          disabled={busy}
        />

        {/* The guest path is never hidden — value first, account optional. */}
        <PressableScale
          haptic="light"
          pressScale={0.98}
          accessibilityRole="button"
          accessibilityLabel="Entrar sin cuenta"
          accessibilityHint="Empiezas ahora; puedes crear la cuenta más tarde"
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          onPress={onSkip}
          style={styles.skip}
        >
          <Text style={styles.skipText}>{busy ? 'Entrando…' : 'Entrar sin cuenta →'}</Text>
        </PressableScale>

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
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  variant: 'dark' | 'light';
  onPress: () => void;
  disabled?: boolean;
}) {
  const dark = variant === 'dark';
  return (
    <PressableScale
      haptic="medium"
      pressScale={0.97}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.btn, dark ? styles.btnDark : styles.btnLight, disabled && styles.btnDisabled]}
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
    borderRadius: 18, // matches the primary CTA — one shape language for actions
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
  btnDisabled: { opacity: 0.55 },
  btnIcon: { width: 24, alignItems: 'center' },
  btnLabel: { ...Type.subheading, flex: 1, textAlign: 'center' },
  btnLabelDark: { color: Colors.ink.inverse },
  btnLabelLight: { color: Colors.ink.primary },

  skip: { alignSelf: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  skipText: { ...Type.bodyEmph, color: Colors.ink.tertiary },

  fine: {
    ...Type.caption,
    color: Colors.ink.muted,
    textAlign: 'center',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.lg,
  },
  fineStrong: { color: Colors.ink.tertiary, fontFamily: Type.bodyEmph.fontFamily },
});
