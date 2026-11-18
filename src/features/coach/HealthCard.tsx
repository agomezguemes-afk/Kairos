// Apple Watch & Health link on the profile: connect once, then Kairos
// reads watch workouts, sleep, HRV and resting HR on its own. The card only
// shows what it last read, so the person can tell it is working.

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useCoachStore } from '../../store/coachStore';
import { Brut, Spacing } from '../../theme/tokens';
import { BBox, BPress, BText } from './ui/brut';
import {
  connectHealth,
  disconnectHealth,
  healthAvailable,
  syncHealth,
  type SyncOutcome,
} from './healthSync';

function ago(iso: string, now: number): string {
  const min = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

function outcomeLine(r: SyncOutcome): string | null {
  if (r.status === 'synced')
    return r.added || r.enriched
      ? `${r.added} entrenos nuevos${r.enriched ? `, ${r.enriched} con pulso añadido` : ''}.`
      : 'Todo al día.';
  if (r.status === 'skipped' && r.reason === 'locked')
    return 'Desbloquea el iPhone para leer Salud.';
  if (r.status === 'failed') return 'No se pudo leer Salud. Prueba otra vez.';
  return null;
}

export const HealthCard = React.memo(function HealthCard() {
  const health = useCoachStore((s) => s.health);
  const biometrics = useCoachStore((s) => s.biometrics);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const available = useMemo(() => healthAvailable(), []);
  // Refreshed each time the profile mounts; precise enough for "hace 2 h".
  const [openedAt] = useState(() => Date.now());

  const latest = useMemo(() => {
    const days = [...(biometrics?.days ?? [])].reverse();
    return {
      sleep: days.find((d) => d.sleepHours !== undefined)?.sleepHours,
      hrv: days.find((d) => d.hrv !== undefined)?.hrv,
      rhr: days.find((d) => d.rhr !== undefined)?.rhr,
    };
  }, [biometrics]);

  const run = async (fn: () => Promise<SyncOutcome>) => {
    setBusy(true);
    setLine(null);
    try {
      setLine(outcomeLine(await fn()));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BBox style={{ marginTop: Spacing.md }} contentStyle={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Feather name="watch" size={18} color={Brut.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <BText variant="bodyBold" size={15}>
            Apple Watch y Salud
          </BText>
          <BText size={13} color={Brut.muted}>
            {!available
              ? 'Disponible en el iPhone: lee lo que mide tu Apple Watch.'
              : health.connected
                ? health.lastSyncAt
                  ? `Conectado · leído ${ago(health.lastSyncAt, openedAt)} · ${health.imported} entrenos del reloj`
                  : 'Conectado. Leyendo Salud…'
                : 'Tus entrenos del reloj, sueño, VFC y pulso en reposo ajustan cada sesión.'}
          </BText>
        </View>
      </View>

      {available && health.connected && (latest.sleep || latest.hrv || latest.rhr) ? (
        <View style={styles.metrics}>
          <Metric
            label="SUEÑO"
            value={latest.sleep ? latest.sleep.toFixed(1).replace('.', ',') : '—'}
            unit="h"
          />
          <Metric label="VFC" value={latest.hrv ? String(Math.round(latest.hrv)) : '—'} unit="ms" />
          <Metric
            label="REPOSO"
            value={latest.rhr ? String(Math.round(latest.rhr)) : '—'}
            unit="lpm"
          />
        </View>
      ) : null}

      {line || health.lastError ? (
        <BText size={13} color={Brut.muted} style={{ marginTop: Spacing.sm }}>
          {line ?? 'La última lectura falló. Kairos lo reintentará al abrir la app.'}
        </BText>
      ) : null}

      {available && (
        <View style={styles.actions}>
          {busy ? (
            <ActivityIndicator color={Brut.ink} />
          ) : health.connected ? (
            <>
              <BPress
                onPress={() => run(() => syncHealth())}
                radius={12}
                style={{ flex: 1 }}
                contentStyle={styles.action}
                accessibilityRole="button"
              >
                <BText variant="bodyBold" size={14}>
                  Leer ahora
                </BText>
              </BPress>
              <BPress
                onPress={() => {
                  disconnectHealth();
                  setLine('Kairos ya no lee Salud. El permiso se quita en Ajustes › Salud.');
                }}
                radius={12}
                shadow={2}
                contentStyle={[styles.action, { paddingHorizontal: 14 }]}
                accessibilityRole="button"
              >
                <BText variant="bodySemi" size={14} color={Brut.muted}>
                  Desconectar
                </BText>
              </BPress>
            </>
          ) : (
            <BPress
              onPress={() => run(connectHealth)}
              bg={Brut.accent}
              radius={12}
              style={{ flex: 1 }}
              contentStyle={styles.action}
              accessibilityRole="button"
            >
              <BText variant="bodyBold" size={15}>
                Conectar Apple Watch
              </BText>
            </BPress>
          )}
        </View>
      )}
    </BBox>
  );
});

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.metric}>
      <BText variant="monoBold" size={9} color={Brut.muted}>
        {label}
      </BText>
      <BText variant="display" size={24}>
        {value}
        <BText variant="mono" size={11} color={Brut.muted}>
          {' '}
          {unit}
        </BText>
      </BText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
    backgroundColor: Brut.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metrics: { flexDirection: 'row', gap: 6, marginTop: Spacing.md },
  metric: {
    flex: 1,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md, alignItems: 'center' },
  action: { height: 46, alignItems: 'center', justifyContent: 'center' },
});
