# BRIEF-06 — Advisor intra-sesión: la siguiente serie se adapta a la que acabas de hacer

**Para:** agente programador (fable). **Ciclo:** ~60-90 min. **Sin commits, sin deps nuevas, sin nativo.**
**Verificación:** `npm run typecheck && npm test`. (Metro de Álvaro en caliente — cada edición debe compilar.)

## Objetivo

El motor de progresión adapta el peso ENTRE sesiones, pero dentro de una sesión la siguiente serie
muestra siempre el mismo prefill, ignore cómo fue la anterior. El advisor real (visión CLAUDE:
"después de cada serie, sugiere ajustes: 'sube 2.5 kg la próxima'") vive aquí: al completar una
serie, la SIGUIENTE serie del mismo ejercicio propone el peso ajustado a lo que acabas de hacer,
usando el MISMO heurístico v1 fijado (`rpeNudgeKg`, ±2.5 kg): la anterior fue fácil (RPE≤7) → +2.5;
costó/al límite (RPE≥10) → −2.5; en rango o sin RPE → sostener. La línea "Sugerido" (BRIEF-05) lo
explica ("la serie anterior fue fácil").

Gating natural = si no hay RPE en la serie anterior, no hay ajuste → cero sorpresa. **No se toca el
store** (`completeSet`, el hot path que Álvaro está probando): el ajuste se aplica al SEED del draft
en el screen, así el objetivo gigante (draft-aware) ya muestra el número adaptado y HECHO lo
confirma (confirm-or-correct). Reutiliza el heurístico ya testeado, cero ML nuevo.

## Base ya existente (verificada)

- `src/lib/progression/suggestNextValues.ts` exporta `rpeNudgeKg(rpe)`, `WEIGHT_NUDGE_KG`,
  `RPE_EASY_MAX=7`, `RPE_HARD_MIN=10`. `src/lib/progression/modality.ts` exporta `classifyModality(fields)`.
- Serie completada: `set.values['weight']` (number) y `set.rpe` (number | null | undefined).
- `ActiveWorkoutScreen`: draft se siembra desde `currentSet.values` en un efecto keyed en
  `currentSet.id` (líneas ~237-244); el objetivo gigante = `formatScoreboardTarget(fields,
  { ...currentSet.values, ...draftValues })`; HECHO commitea `draftValues`. Caption "Sugerido"
  (BRIEF-05) vía `describeSuggestion` + `styles.suggested`.

## Archivos a tocar

### 1. NUEVO: `src/lib/progression/inSessionNudge.ts` (pure)
```ts
import type { FieldDefinition } from '../../types/core';
import { rpeNudgeKg } from './suggestNextValues';
import { classifyModality } from './modality';

export interface InSessionNudge {
  deltaKg: number;          // ±WEIGHT_NUDGE_KG
  nextWeight: number;       // max(0, priorWeight + deltaKg)
  reason: 'easy' | 'hard';  // easy = nudge up, hard = nudge down
}

// Adapta el peso de la SIGUIENTE serie a la recién completada del MISMO ejercicio,
// con la regla RPE fijada v1 (±2.5 kg). null cuando no hay señal accionable: no es
// movimiento de fuerza, sin peso previo, sin RPE, o RPE en rango de trabajo (hold).
export function inSessionWeightNudge(
  fields: FieldDefinition[],
  priorSet: { weight: number | null; rpe: number | null | undefined },
): InSessionNudge | null {
  const modality = classifyModality(fields);
  if (modality !== 'strength' && modality !== 'hybrid') return null;
  if (typeof priorSet.weight !== 'number') return null;
  const delta = rpeNudgeKg(priorSet.rpe ?? undefined);
  if (delta === 0) return null;
  return {
    deltaKg: delta,
    nextWeight: Math.max(0, priorSet.weight + delta),
    reason: delta > 0 ? 'easy' : 'hard',
  };
}
```
Exportar `inSessionWeightNudge` + tipo `InSessionNudge` desde `src/lib/progression/index.ts`.

### 2. NUEVO: `src/lib/progression/inSessionNudge.test.ts` (vitest, ~8)
Fixtures: `strengthFields = [weight(kg), reps]`, `enduranceFields = [distance(km), pace(time)]`.
1. strength, weight 60, rpe 6 → `{deltaKg:2.5, nextWeight:62.5, reason:'easy'}`.
2. rpe 7 (límite fácil) → up.
3. rpe 10 (duro) → `{deltaKg:-2.5, nextWeight:57.5, reason:'hard'}`.
4. rpe 8 (en rango) → null.
5. rpe null/undefined → null.
6. weight null → null.
7. endurance (sin weight) → null.
8. suelo en 0: weight 1, rpe 10 → `nextWeight:0`, `deltaKg:-2.5`.

### 3. `src/features/workout/scoreboard/suggestionRationale.ts` (añadir función)
```ts
import type { InSessionNudge } from '../../../lib/progression';
// … (imports existentes: WEIGHT_NUDGE_KG no hace falta; usa nudge.deltaKg)
export function describeInSessionNudge(nudge: InSessionNudge): RationaleCaption {
  const kg = stripZero(Math.abs(nudge.deltaKg));
  return nudge.reason === 'easy'
    ? { text: `Sugerido +${kg} kg · la serie anterior fue fácil`,
        spoken: `Objetivo sugerido, ${kg} kilos más porque la serie anterior fue fácil` }
    : { text: `Sugerido −${kg} kg · la serie anterior costó`,   // U+2212
        spoken: `Objetivo sugerido, ${kg} kilos menos porque la serie anterior costó` };
}
```
No modificar `describeSuggestion`.

### 4. `src/features/workout/scoreboard/suggestionRationale.test.ts` (añadir ~3)
`describeInSessionNudge`: easy → text contiene "+2.5 kg" y "fácil"; hard → "−2.5 kg" (U+2212) y
"costó"; ambos `spoken` no vacíos.

### 5. `src/screens/ActiveWorkoutScreen.tsx` (aditivo; NO tocar el store)
- Importar `inSessionWeightNudge` de `../lib/progression` y `describeInSessionNudge`.
- `priorCompletedSet` (memo): la serie completada más cercana con índice `< currentSetIndex` en el
  ejercicio ACTUAL → `{ weight: number|null, rpe }` (weight de `values['weight']` si es number),
  o null si no hay. (Mismo patrón que el memo `previousValues`, pero devolviendo weight+rpe.)
- `inSessionNudge = useMemo(() => (exercise && priorCompletedSet)
    ? inSessionWeightNudge(exercise.fields, priorCompletedSet) : null, [exercise?.id, priorCompletedSet])`.
- **Seed del draft** (efecto keyed en `currentSet.id`): si `inSessionNudge != null` y
  `typeof currentSet.values['weight'] === 'number'`, sembrar
  `{ ...currentSet.values, weight: inSessionNudge.nextWeight }`; si no, `{ ...currentSet.values }`
  como hoy. (Leer `inSessionNudge` dentro del efecto; mantener el patrón de deps por identidad con
  `eslint-disable react-hooks/exhaustive-deps`. Al avanzar de serie, `currentSet.id` cambia → el
  componente re-renderiza con `inSessionNudge` fresco ANTES de que corra el efecto.)
- **Selección de caption:**
  ```ts
  const suggestionCaption = useMemo(() => {
    if (!currentSet) return null;
    const cur = { ...currentSet.values, ...draftValues };
    if (inSessionNudge) {
      return cur['weight'] === inSessionNudge.nextWeight ? describeInSessionNudge(inSessionNudge) : null;
    }
    if (!suggestion) return null;
    return describeSuggestion(suggestion, cur);
  }, [inSessionNudge, suggestion, currentSet, draftValues]);
  ```
- Render del caption sin cambios (usa `suggestionCaption`, `!changing`).
- No tocar `GiantTarget`, footer, rest, corrección en descanso, ni `completeSet`.

## Criterios de aceptación
1. Tras completar una serie con RPE≤7, la SIGUIENTE serie del mismo ejercicio muestra el peso +2.5 kg
   y la línea "Sugerido +2.5 kg · la serie anterior fue fácil"; con RPE≥10, −2.5 kg y "…costó".
2. Sin RPE en la serie anterior (o RPE 8-9) → sin ajuste: el prefill y el caption entre-sesiones
   (BRIEF-05) se comportan como hoy. Cero cambio inesperado.
3. El ajuste es SOLO intra-ejercicio (no cruza cambio de ejercicio; la primera serie de un ejercicio
   no se ajusta). Editar el objetivo oculta el caption (draft ≠ sugerido).
4. HECHO registra el peso mostrado (el ajustado si no se corrigió). PR se detecta sobre ese valor.
5. El store NO cambia (mismo `completeSet`); sin estados intermedios rotos; typecheck y tests verdes
   en cada punto.
6. `inSessionWeightNudge` y `describeInSessionNudge` puras, no lanzan, ~11 tests nuevos verdes.

## Comandos de verificación
```bash
npm run typecheck && npm test
```
Foco: `npx vitest run src/lib/progression/inSessionNudge.test.ts src/features/workout/scoreboard/suggestionRationale.test.ts`

## Fuera de alcance (NO hacer)
- Señal por reps-vs-objetivo (v1 = solo RPE, heurístico fijado); descanso por tipo de set (N5);
  mutar `completeSet`/el store; voz/nativo/watch. No tocar el WIP del usuario fuera de los 5 archivos.
  Sin commit/push/git add.
