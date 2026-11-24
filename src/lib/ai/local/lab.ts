// The AI lab's measurement run: what a model costs and how well it does
// Kairos's first task on this phone. Pure over the runtime, so it is
// tested off-device; AiLabScreen only displays it.

import type { Sport } from '../../adaptive/types';
import { goalChatRequest, mergeAiGoal } from '../goalInterpreter';
import { parseGoal } from '../../adaptive/goalParser';
import type { LocalModel } from './catalog';
import { fromCompletionResult, toCompletionParams } from './mapping';
import type { DeviceInfo, LocalRuntime } from './runtimeTypes';

/** Real goals in the words people use, Latin American phrasing included. */
export const LAB_GOALS: { text: string; sport: Sport }[] = [
  { text: 'Quiero aguantar más en pádel, juego martes y jueves', sport: 'padel' },
  { text: 'ganar fuerza para escalar en 3 meses', sport: 'climbing' },
  { text: 'me ahogo en el tercer set y no llego a las bolas en el tenis', sport: 'tennis' },
  { text: 'quiero bajar de peso y empezar a correr, puedo 3 veces por semana', sport: 'running' },
];

export interface GoalCheck {
  text: string;
  ms: number;
  /** The answer parsed as JSON and named the expected sport first. */
  ok: boolean;
  validJson: boolean;
  sports: string[];
  error?: string;
}

export interface LabResult {
  modelId: string;
  device: DeviceInfo;
  loadMs: number;
  promptPerSecond: number;
  generatePerSecond: number;
  goals: GoalCheck[];
  /** Set when the run stopped early; earlier fields hold what was measured. */
  error?: string;
}

export async function runLab(
  runtime: LocalRuntime,
  model: LocalModel,
  onStep: (label: string) => void = () => {},
): Promise<LabResult> {
  const result: LabResult = {
    modelId: model.id,
    device: runtime.device(),
    loadMs: 0,
    promptPerSecond: 0,
    generatePerSecond: 0,
    goals: [],
  };
  try {
    onStep('Cargando el modelo…');
    result.loadMs = await runtime.load(model);
    onStep('Midiendo velocidad…');
    const bench = await runtime.bench();
    result.promptPerSecond = bench.promptPerSecond;
    result.generatePerSecond = bench.generatePerSecond;
    for (const [i, goal] of LAB_GOALS.entries()) {
      onStep(`Objetivo ${i + 1} de ${LAB_GOALS.length}…`);
      result.goals.push(await checkGoal(runtime, goal));
    }
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }
  return result;
}

async function checkGoal(
  runtime: LocalRuntime,
  goal: (typeof LAB_GOALS)[number],
): Promise<GoalCheck> {
  const started = Date.now();
  try {
    const answer = fromCompletionResult(
      await runtime.complete(toCompletionParams(goalChatRequest(goal.text))),
    );
    const ms = Date.now() - started;
    let raw: unknown;
    try {
      raw = JSON.parse(answer.content ?? '');
    } catch {
      return { text: goal.text, ms, ok: false, validJson: false, sports: [] };
    }
    const merged = mergeAiGoal({ ...parseGoal(goal.text), source: 'rules' }, raw);
    return {
      text: goal.text,
      ms,
      ok: merged.source === 'ai' && merged.sports[0] === goal.sport,
      validJson: true,
      sports: merged.sports,
    };
  } catch (e) {
    return {
      text: goal.text,
      ms: Date.now() - started,
      ok: false,
      validJson: false,
      sports: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

const n1 = (x: number) => x.toFixed(1).replace('.', ',');

/** Plain text to copy or screenshot and paste back into the chat. */
export function formatLabReport(r: LabResult, model: LocalModel): string {
  const mem = r.device.totalMemoryBytes
    ? `${n1(r.device.totalMemoryBytes / 1024 ** 3)} GB`
    : 'RAM desconocida';
  const okCount = r.goals.filter((g) => g.ok).length;
  const avgMs = r.goals.length ? r.goals.reduce((a, g) => a + g.ms, 0) / r.goals.length : 0;
  const lines = [
    `Kairos · Laboratorio IA`,
    `${model.name} (${model.file}) en ${r.device.modelName ?? 'iPhone'} · ${mem}`,
    `Carga: ${n1(r.loadMs / 1000)} s`,
    `Lectura: ${Math.round(r.promptPerSecond)} tok/s · Escritura: ${n1(r.generatePerSecond)} tok/s`,
    `Objetivos: ${okCount}/${r.goals.length} correctos · ${n1(avgMs / 1000)} s de media`,
    ...r.goals.map(
      (g) =>
        `  ${g.ok ? '✓' : '✗'} ${n1(g.ms / 1000)} s · ${g.validJson ? g.sports.join(', ') || '—' : 'JSON no válido'} · «${g.text}»${g.error ? ` (${g.error})` : ''}`,
    ),
  ];
  if (r.error) lines.push(`Se detuvo: ${r.error}`);
  return lines.join('\n');
}
