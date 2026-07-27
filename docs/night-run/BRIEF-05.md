# BRIEF-05 — "Sugerido, y por qué": la memoria explica su recomendación

**Para:** agente programador (fable). **Ciclo:** ~45-60 min. **Sin commits, sin deps nuevas, sin nativo.**
**Verificación:** `npm run typecheck && npm test`. (Álvaro está en el simulador con hot reload — esto
aterriza en caliente.)

## Objetivo

Convertir la línea "Sugerido" (N4) de un delta adivinado a **la verdad del motor de progresión, con
su razón**. Hoy `progressionDelta` compara el objetivo con la última vez por su cuenta; el motor
real `src/lib/progression/` ya sabe MÁS: `suggestNextValues` devuelve un `basis` por campo
(`nudge-up` = la última fue fácil, RPE≤7; `nudge-down` = la última costó, RPE≥10; `carry-forward` =
sostener). Surfacear esa razón hace la memoria **honesta y coach** — el diferenciador que ni los
loggers ni los voz-first tienen — en la pantalla que Álvaro más mira:

- "Sugerido +2.5 kg · la última fue fácil"
- "Sugerido −2.5 kg · la última costó"
- "Sugerido · igual que la última"

Reutiliza el engine existente (cero duplicación), es display-only (sin tocar store ni el hot path
`completeSet`), pure-core testeable, y de riesgo bajo. Es el primer movimiento correcto del día.

## Base ya existente (verificada)

- `src/lib/progression/index.ts` exporta `readExerciseHistory` y `suggestNextValues`.
- `suggestNextValues(fields, history)` → `{ modality, values: Record<string,number>, basis:
  Record<string,'nudge-up'|'nudge-down'|'carry-forward'>, reference }`. Solo `weight` se nudgea
  (strength/hybrid); resto carry-forward. Constante `WEIGHT_NUDGE_KG = 2.5` exportada.
- `readExerciseHistory(history, { name, libraryId })` → `ExerciseHistory` (mismo patrón que
  `applyProgression.enrichExercise`).
- `ActiveWorkoutScreen` ya tiene `workoutHistory`, `exercise` (name/libraryId/fields), `currentSet`
  y `draftValues`; ya renderiza la línea "Sugerido" (N4, vía `progressionCaption`) entre
  `PreviousRefPill` y `styles.targetZone`, sólo en `!changing`.
- `format.ts` exporta `stripZero`.

## Archivos a tocar

### 1. NUEVO: `src/features/workout/scoreboard/suggestionRationale.ts` (pure, sin store)
Recibe la salida del engine (no el historial) para quedar puro y sin acoplar al store — el screen
hace la parte acoplada.

```ts
import type { FieldValue } from '../../../types/core';
import type { SuggestionBasis } from '../../../lib/progression';
import { WEIGHT_NUDGE_KG } from '../../../lib/progression';
import { stripZero } from './format';

export interface RationaleCaption { text: string; spoken: string; }

// Traduce la sugerencia del motor (values + basis) a la línea que ve/escucha el
// usuario. null cuando no hay sugerencia (sin historial) o cuando el usuario ya
// editó el objetivo (su propio número habla por sí mismo).
export function describeSuggestion(
  suggestion: { values: Record<string, number>; basis: Record<string, SuggestionBasis> },
  currentValues: Record<string, FieldValue>,
): RationaleCaption | null;
```

Lógica:
1. `keys = Object.keys(suggestion.values)`; si vacío → `null` (sin historial, nada que explicar).
2. `edited = keys.some(k => currentValues[k] !== suggestion.values[k])`; si `true` → `null`.
3. `w = suggestion.basis['weight']`, `kg = stripZero(WEIGHT_NUDGE_KG)`:
   - `'nudge-up'` → `{ text: \`Sugerido +${kg} kg · la última fue fácil\`,
       spoken: \`Objetivo sugerido, ${kg} kilos más que la última porque la última serie fue fácil\` }`
   - `'nudge-down'` → `{ text: \`Sugerido −${kg} kg · la última costó\`,  // U+2212
       spoken: \`Objetivo sugerido, ${kg} kilos menos que la última porque la última serie costó\` }`
   - resto (weight carry-forward, o sin campo weight → carry de reps/pace) →
     `{ text: 'Sugerido · igual que la última', spoken: 'Objetivo sugerido, igual que la última vez' }`

### 2. NUEVO: `src/features/workout/scoreboard/suggestionRationale.test.ts` (vitest)
Fixtures triviales (objetos `{ values, basis }` a mano — sin historial). Casos (~8):
1. `values:{}` → null.
2. basis weight `nudge-up`, values `{weight:62.5,reps:8}`, current igual → text contiene "+2.5 kg" y
   "fácil"; spoken no vacío.
3. `nudge-down` → text contiene "−2.5 kg" (U+2212) y "costó".
4. weight `carry-forward` → "Sugerido · igual que la última".
5. sin campo weight (values `{reps:8}`, basis `{reps:'carry-forward'}`) → "igual que la última".
6. editado: values `{weight:62.5}`, current `{weight:60}` → null.
7. no editado exacto (current === values) → no null.
8. current con clave extra no sugerida no cuenta como editado (values `{weight:60}`,
   current `{weight:60, reps:8}`) → no null.

### 3. `src/screens/ActiveWorkoutScreen.tsx` (cambia la FUENTE del caption, mismo hueco visual)
- Importar `readExerciseHistory, suggestNextValues` de `../lib/progression` y `describeSuggestion`.
- Sustituir el `useMemo` que hoy produce el caption vía `progressionDelta`/`progressionCaption` por:
  ```ts
  const suggestion = useMemo(() => {
    if (!exercise) return null;
    const hist = readExerciseHistory(workoutHistory, {
      name: exercise.name, libraryId: exercise.libraryId,
    });
    return suggestNextValues(exercise.fields, hist);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id, workoutHistory.length, completedInSession]);

  const suggestionCaption = useMemo(() => {
    if (!suggestion || !currentSet) return null;
    const currentValues = { ...currentSet.values, ...draftValues };
    return describeSuggestion(suggestion, currentValues);
  }, [suggestion, currentSet, draftValues]);
  ```
- En el render (mismo sitio, `!changing`), usar `suggestionCaption`:
  ```tsx
  {!changing && suggestionCaption ? (
    <Text style={styles.suggested} accessibilityLabel={suggestionCaption.spoken} maxFontSizeMultiplier={1.6}>
      {suggestionCaption.text}
    </Text>
  ) : null}
  ```
- **No** borrar `progressionDelta.ts` ni sus tests (siguen verdes; retiro en un brief posterior si
  procede) — solo dejar de usarlos en el screen. No tocar `GiantTarget`, footer, rest, ni el store.
- Mantener el estilo `styles.suggested` sobrio existente (SIN oro).

## Criterios de aceptación
1. En set-active, la línea bajo el nombre/pill explica la sugerencia del motor real: "+2.5 kg · la
   última fue fácil" (RPE≤7 la última), "−2.5 kg · la última costó" (RPE≥10), o "igual que la
   última" (sostener / resistencia). Sin historial → no aparece.
2. Al editar el objetivo (draft ≠ sugerido), la línea desaparece (el número del usuario manda).
3. En exercise-change y descanso NO aparece. `accessibilityLabel` en español natural.
4. El número gigante y el caption son coherentes (ambos derivan del mismo motor).
5. Sin regresiones: HECHO, quick row, corrección en descanso, Live Activity intactos.
6. `describeSuggestion` pura, no lanza, ~8 tests verdes; `npm run typecheck` limpio; `npm test`
   verde (777 previos + nuevos; los de `progressionDelta` siguen pasando).

## Comandos de verificación
```bash
npm run typecheck && npm test
```
Foco: `npx vitest run src/features/workout/scoreboard/suggestionRationale.test.ts`

## Fuera de alcance (NO hacer)
- Adaptación intra-sesión (es BRIEF-06), descanso por tipo de set (N5), voz/nativo, watch.
- No modificar el motor `src/lib/progression/` ni el store. No tocar el WIP del usuario fuera de los
  3 archivos. Sin commit/push/git add.
