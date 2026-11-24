// AI lab (development and staging builds only): download candidate
// on-device models, measure them on this phone and pick the one the coach
// uses. The numbers decide the default model; nothing leaves the phone.

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import {
  fitOnDevice,
  formatBytes,
  LOCAL_MODELS,
  type FitVerdict,
  type LocalModel,
} from '../../lib/ai/local/catalog';
import { formatLabReport, runLab } from '../../lib/ai/local/lab';
import { localRuntime } from '../../lib/ai/local/runtime';
import { useLocalAiStore } from '../../lib/ai/local/store';
import { Brut, Spacing } from '../../theme/tokens';
import { feedback } from './feedback';
import { BBox, BPress, BScreen, BTag, BText } from './ui/brut';

type Phase =
  | { kind: 'idle' }
  | { kind: 'confirm-download' }
  | { kind: 'downloading'; fraction: number }
  | { kind: 'testing'; step: string }
  | { kind: 'confirm-delete' };

const FIT_LABEL: Record<FitVerdict, { tag: string; bg: string; hint?: string }> = {
  ok: { tag: 'CABE', bg: Brut.accentSoft },
  tight: {
    tag: 'AL LÍMITE',
    bg: Brut.accent,
    hint: 'Puede funcionar justo. Si la app se cierra al cargarlo, apúntalo: también es un resultado.',
  },
  'too-big': {
    tag: 'DEMASIADO GRANDE',
    bg: Brut.surface,
    hint: 'Lo más probable es que iOS cierre la app al cargarlo. Pruébalo solo para confirmarlo.',
  },
  unknown: { tag: 'RAM DESCONOCIDA', bg: Brut.surface },
};

export default function AiLabScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const device = localRuntime?.device() ?? { modelName: null, totalMemoryBytes: null };

  return (
    <BScreen>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 40 },
        ]}
      >
        <View style={styles.topRow}>
          <BPress
            onPress={() => navigation.goBack()}
            radius={12}
            contentStyle={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <BText variant="bodyBold" size={18} upright>
              ←
            </BText>
          </BPress>
          <BText variant="monoBold" size={11} style={{ letterSpacing: 2 }}>
            KAIROS{' '}
            <BText variant="mono" size={11} color={Brut.muted}>
              / LABORATORIO IA
            </BText>
          </BText>
        </View>

        <BText variant="display" size={44} style={{ marginTop: Spacing.md }}>
          LABORATORIO IA
        </BText>
        <BText variant="body" size={14} color={Brut.muted}>
          Prueba modelos que corren en tu iPhone, sin internet. Mide cuánto tardan y si entienden
          objetivos en español; con esos números elegimos el modelo del coach.
        </BText>

        <BBox style={{ marginTop: Spacing.lg }} contentStyle={styles.card}>
          <BText variant="monoBold" size={10}>
            ESTE IPHONE
          </BText>
          <BText variant="bodyBold" size={17}>
            {device.modelName ?? 'Desconocido'}
            {device.totalMemoryBytes
              ? ` · ${formatBytes(device.totalMemoryBytes)} de RAM visible`
              : ''}
          </BText>
          {!localRuntime && (
            <BText variant="body" size={13} color={Brut.muted}>
              Los modelos locales solo funcionan en la app de iPhone. Aquí puedes ver la lista, pero
              no probarlos.
            </BText>
          )}
        </BBox>

        {LOCAL_MODELS.map((m) => (
          <ModelCard key={m.id} model={m} fit={fitOnDevice(m, device.totalMemoryBytes)} />
        ))}

        <BText variant="mono" size={10} color={Brut.muted} style={{ marginTop: Spacing.lg }}>
          LOS RESULTADOS NO SALEN DEL IPHONE. MANTÉN PULSADO EL INFORME PARA COPIARLO, O HAZ UNA
          CAPTURA, Y PÉGALO EN EL CHAT.
        </BText>
      </ScrollView>
    </BScreen>
  );
}

function ModelCard({ model, fit }: { model: LocalModel; fit: FitVerdict }) {
  const downloaded = useLocalAiStore((s) => !!s.downloaded[model.id]);
  const active = useLocalAiStore((s) => s.activeModelId === model.id);
  const { setDownloaded, setActive } = useLocalAiStore.getState();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fitInfo = FIT_LABEL[fit];
  const size = formatBytes(model.sizeBytes);

  useEffect(() => {
    if (!localRuntime) return;
    let alive = true;
    localRuntime
      .isDownloaded(model)
      .then((onDisk) => alive && setDownloaded(model.id, onDisk))
      .catch((e) => console.warn('[ai-lab] could not check the model file', e));
    return () => {
      alive = false;
    };
  }, [model, setDownloaded]);

  const download = useCallback(async () => {
    if (!localRuntime) return;
    setError(null);
    setPhase({ kind: 'downloading', fraction: 0 });
    try {
      await localRuntime.download(model, (fraction) => setPhase({ kind: 'downloading', fraction }));
      setDownloaded(model.id, true);
      feedback.success();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descargar.');
      feedback.warning();
    } finally {
      setPhase({ kind: 'idle' });
    }
  }, [model, setDownloaded]);

  const test = useCallback(async () => {
    if (!localRuntime) return;
    setError(null);
    setReport(null);
    const result = await runLab(localRuntime, model, (step) => setPhase({ kind: 'testing', step }));
    setReport(formatLabReport(result, model));
    setPhase({ kind: 'idle' });
    if (result.error) feedback.warning();
    else feedback.success();
  }, [model]);

  const remove = useCallback(async () => {
    if (!localRuntime) return;
    try {
      await localRuntime.remove(model);
      setDownloaded(model.id, false);
      setReport(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar.');
    } finally {
      setPhase({ kind: 'idle' });
    }
  }, [model, setDownloaded]);

  const busy = phase.kind === 'downloading' || phase.kind === 'testing';

  return (
    <BBox style={{ marginTop: Spacing.md }} contentStyle={styles.card}>
      <View style={styles.titleRow}>
        <BText variant="bodyBold" size={18} style={{ flexShrink: 1 }}>
          {model.name}
        </BText>
        <BTag bg={fitInfo.bg}>{fitInfo.tag}</BTag>
      </View>
      <BText variant="mono" size={10} color={Brut.muted}>
        {`${model.params} PARÁMETROS · ${size} · ${model.licence.toUpperCase()}`}
      </BText>
      <BText variant="body" size={13}>
        {model.note}
      </BText>
      {fitInfo.hint && (
        <BText variant="body" size={12} color={Brut.muted}>
          {fitInfo.hint}
        </BText>
      )}

      {localRuntime && !downloaded && phase.kind === 'idle' && (
        <Action
          label={`Descargar ${size}`}
          onPress={() => setPhase({ kind: 'confirm-download' })}
        />
      )}
      {phase.kind === 'confirm-download' && (
        <View style={styles.confirm}>
          <BText variant="body" size={13}>
            {`Son ${size}. Mejor con wifi: por datos móviles gasta ${size} de tu tarifa.`}
          </BText>
          <View style={styles.actions}>
            <Action label="Descargar" primary onPress={download} />
            <Action label="Cancelar" onPress={() => setPhase({ kind: 'idle' })} />
          </View>
        </View>
      )}
      {phase.kind === 'downloading' && (
        <View style={styles.confirm}>
          <View style={styles.track} accessibilityRole="progressbar">
            <View style={[styles.fill, { width: `${Math.round(phase.fraction * 100)}%` }]} />
          </View>
          <BText variant="mono" size={10}>
            {`DESCARGANDO · ${Math.round(phase.fraction * 100)} %`}
          </BText>
          <Action
            label="Cancelar descarga"
            onPress={() => {
              localRuntime
                ?.cancelDownload(model)
                .catch((e) => console.warn('[ai-lab] cancel failed', e));
            }}
          />
        </View>
      )}
      {phase.kind === 'testing' && (
        <BText variant="monoBold" size={11} style={{ marginTop: 6 }}>
          {phase.step.toUpperCase()}
        </BText>
      )}

      {downloaded && !busy && phase.kind !== 'confirm-delete' && (
        <View style={styles.actions}>
          <Action label="Probar" primary onPress={test} />
          <Action
            label={active ? 'En uso en el coach' : 'Usar en el coach'}
            onPress={() => setActive(active ? null : model.id)}
          />
          <Action label="Borrar" onPress={() => setPhase({ kind: 'confirm-delete' })} />
        </View>
      )}
      {phase.kind === 'confirm-delete' && (
        <View style={styles.confirm}>
          <BText variant="body" size={13}>
            {`Se borran ${size} del iPhone. Podrás volver a descargarlo.`}
          </BText>
          <View style={styles.actions}>
            <Action label="Borrar" primary onPress={remove} />
            <Action label="Cancelar" onPress={() => setPhase({ kind: 'idle' })} />
          </View>
        </View>
      )}

      {error && (
        <BText variant="body" size={13} style={{ marginTop: 6 }}>
          {error}
        </BText>
      )}
      {report && (
        <View style={styles.report}>
          <BText variant="mono" size={11} selectable upright>
            {report}
          </BText>
        </View>
      )}
    </BBox>
  );
}

function Action({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <BPress
      onPress={onPress}
      bg={primary ? Brut.accent : Brut.surface}
      radius={12}
      contentStyle={styles.action}
      accessibilityRole="button"
    >
      <BText variant="bodyBold" size={14}>
        {label}
      </BText>
    </BPress>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { padding: Spacing.md, gap: 6 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  action: { paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  confirm: { gap: 8, marginTop: 8 },
  track: {
    height: 10,
    borderRadius: 5,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
    overflow: 'hidden',
    backgroundColor: Brut.surface,
  },
  fill: { height: '100%', backgroundColor: Brut.accent },
  report: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
    backgroundColor: Brut.bg,
  },
});
