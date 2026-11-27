// The AI lab's measurement run: what a model costs and how well it does
// Kairos's first task on this phone. Pure over the runtime, so it is
// tested off-device; AiLabScreen only displays it.

import { parseGoal } from '../../adaptive/goalParser';
import { GOAL_CASES, GOAL_HOLDOUT, scoreGoal, type GoalCase } from '../eval/goalCases';
import { goalChatRequest, mergeAiGoal } from '../goalInterpreter';
import type { LocalModel } from './catalog';
import { fromCompletionResult, toCompletionParams } from './mapping';
import type { DeviceInfo, LocalRuntime } from './runtimeTypes';

/**
 * Quick run: four held-out goals the rules parser was never tuned on
 * (slang, an unlisted sport, Latin American phrasing). The full run scores
 * every case in both sets.
 */
export const LAB_QUICK: readonly GoalCase[] = [
  GOAL_HOLDOUT[4], // "salir a rodar con la grupeta los domingos"
  GOAL_HOLDOUT[2], // "jugar mejor al squash"
  GOAL_HOLDOUT[11], // "agarrar fuerza en el gym para no lastimarme jugando fut"
  GOAL_HOLDOUT[9], // "correr un maratón en 16 semanas"
];
export const LAB_FULL: readonly GoalCase[] = [...GOAL_CASES, ...GOAL_HOLDOUT];

export interface GoalCheck {
  text: string;
  ms: number;
  /** The answer parsed as JSON and every checked field was right. */
  ok: boolean;
  /** The rules parser on the same case, for comparison. */
  rulesOk: boolean;
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
  cases: readonly GoalCase[] = LAB_QUICK,
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
    for (const [i, goal] of cases.entries()) {
      onStep(`Objetivo ${i + 1} de ${cases.length}…`);
      result.goals.push(await checkGoal(runtime, goal));
    }
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }
  return result;
}

const passed = (s: ReturnType<typeof scoreGoal>) =>
  s.sportOk && s.daysOk !== false && s.weeksOk !== false;

async function checkGoal(runtime: LocalRuntime, goal: GoalCase): Promise<GoalCheck> {
  const rules = { ...parseGoal(goal.text), source: 'rules' as const };
  const rulesOk = passed(scoreGoal(goal, rules));
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
      return { text: goal.text, ms, ok: false, rulesOk, validJson: false, sports: [] };
    }
    const merged = mergeAiGoal(rules, raw);
    return {
      text: goal.text,
      ms,
      ok: merged.source === 'ai' && passed(scoreGoal(goal, merged)),
      rulesOk,
      validJson: true,
      sports: merged.sports,
    };
  } catch (e) {
    return {
      text: goal.text,
      ms: Date.now() - started,
      ok: false,
      rulesOk,
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
  const rulesCount = r.goals.filter((g) => g.rulesOk).length;
  const avgMs = r.goals.length ? r.goals.reduce((a, g) => a + g.ms, 0) / r.goals.length : 0;
  const lines = [
    `Kairos · Laboratorio IA`,
    `${model.name} (${model.file}) en ${r.device.modelName ?? 'iPhone'} · ${mem}`,
    `Carga: ${n1(r.loadMs / 1000)} s`,
    `Lectura: ${Math.round(r.promptPerSecond)} tok/s · Escritura: ${n1(r.generatePerSecond)} tok/s`,
    `Objetivos: modelo ${okCount}/${r.goals.length} · reglas ${rulesCount}/${r.goals.length} · ${n1(avgMs / 1000)} s de media`,
    ...r.goals.map(
      (g) =>
        `  ${g.ok ? '✓' : '✗'}${g.rulesOk ? '' : ' (reglas ✗)'} ${n1(g.ms / 1000)} s · ${g.validJson ? g.sports.join(', ') || '—' : 'JSON no válido'} · «${g.text}»${g.error ? ` (${g.error})` : ''}`,
    ),
  ];
  if (r.error) lines.push(`Se detuvo: ${r.error}`);
  return lines.join('\n');
}
