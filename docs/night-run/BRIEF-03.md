# BRIEF-03 — Corrige durante el descanso la serie que acabas de hacer

**Para:** agente programador (fable). **Ciclo:** ~60-90 min. **Sin commits, sin deps nuevas, sin nativo.**
**Verificación:** `npm run typecheck && npm test`.

## Objetivo

Cerrar la última fricción aguda del in-use. Tras BRIEF-01 (HECHO en un gesto) y BRIEF-02 (voz/texto),
queda el caso más común no resuelto: **das HECHO aceptando la sugerencia y, mirando de reojo en el
descanso, ves que hiciste 6 y no 8.** Hoy corregir eso exige swipe hacia atrás a una serie ya
completada — confuso y fuera del espíritu "el descanso es el estado principal". La spec lo pide
explícito: "corregir es secundario pero inmediato", en el momento en que lo notas.

Solución: en el estado **descanso**, un eco sobrio de la serie recién completada — "Hecho · 60 kg
× 8 · Corregir" — que abre el correction sheet apuntando a ESA serie. Guardar **parchea sus valores
sin reiniciar el descanso ni mover el puntero**. El countdown sigue corriendo; el usuario corrige y
vuelve al descanso sin perder nada.

Por qué es lo siguiente: es el ítem de mayor valor restante (fricción real y frecuente, on-spec) y
es 100% JS/TS, aditivo (no toca el camino set-active ya enviado), con pure-core testeable.

## Decisiones de alcance (leer antes de codear)

- **Identificar la serie recién hecha sin estado nuevo en el store:** derivarla por el `completed_at`
  MÁS RECIENTE entre todas las series de todos los ejercicios. Robusto en fronteras de ejercicio,
  puro y sin migración de estado. (No añadir un `lastCompleted` al store.)
- **Editar sin efectos colaterales:** nuevo método de store `editCompletedSetValues` que SOLO hace
  merge de `values` sobre la serie objetivo. No toca `completed`, `completed_at`, `restTimer` ni los
  índices. El descanso no se reinicia (requisito de la spec).
- **Aislar el riesgo:** NO parametrizar el `SetCorrectionSheet` actual (recién enviado). Montar una
  **segunda instancia** dedicada a la corrección-en-descanso, con su propio draft y su propio
  `onCommit`. Ambas son mutuamente excluyentes (o corriges la serie activa en set-active, o corriges
  la recién hecha en descanso), así que nunca hay dos modales a la vez.
- **PR:** editar una serie completada NO re-dispara/retira el badge PR (efímero, ya desaparecido).
  El histórico de PRs se deriva en `finishWorkout`, así que el valor corregido se guardará correcto.
  Fuera de alcance re-detectar PR aquí.

## Archivos a tocar

### 1. NUEVO: `src/features/workout/scoreboard/justCompleted.ts` (pure)
```ts
import type { ExerciseCard, FieldDefinition, FieldValue } from '../../../types/core';

export interface JustCompletedRef {
  exerciseId: string;
  exerciseIndex: number;
  setId: string;
  setIndex: number;
  exerciseName: string;
  fields: FieldDefinition[];
  values: Record<string, FieldValue>;
}

// La serie recién hecha = la de `completed_at` más reciente (ISO compara bien
// lexicográficamente). Pura, sobrevive a cambios de ejercicio, null si ninguna
// serie está completada (p.ej. antes del primer HECHO — no habría descanso).
export function resolveJustCompleted(exercises: ExerciseCard[]): JustCompletedRef | null;
```
Recorre ejercicios/series; candidato = `s.completed && s.completed_at`; se queda con el máximo
`completed_at` (reemplazo sólo si es ESTRICTAMENTE mayor → ante empate gana el primero recorrido).
Devuelve la ref con ids, índices, nombre, `fields` del ejercicio y `values` de la serie.

### 2. NUEVO: `src/features/workout/scoreboard/justCompleted.test.ts` (vitest)
Fixtures mínimas de `ExerciseCard`/set. Casos (~8):
1. `[]` → null. 2. ninguna completada → null. 3. una completada → esa ref (ids/nombre/values/índices).
4. dos completadas en el mismo ejercicio → gana la de `completed_at` posterior.
5. completadas en dos ejercicios → gana la de `completed_at` global más reciente (ejercicio 2).
6. serie completada sin `completed_at` se ignora si otra sí lo tiene.
7. `values` se devuelven intactos (p.ej. `{weight:60, reps:8}`).
8. empate de timestamps → determinista (gana la primera recorrida); afirmar cuál.

### 3. `src/store/workoutStore.ts`
Añadir a la interfaz y a la implementación:
```ts
editCompletedSetValues: (exerciseId: string, setId: string, values: Record<string, FieldValue>) => void;
```
Impl: `set((state) => …)` — si no hay `activeWorkout`, return state. Map de `exercises`: en el
ejercicio `exerciseId`, map de `sets`: en el set `setId`, devolver `{ ...s, values: { ...s.values,
...values } }`. NO tocar `completed`, `completed_at`, `restTimer`, `currentExerciseIndex`,
`currentSetIndex`. Guard: si el set no existe, no-op. (Merge trivial, sin helper aparte — mismo
estilo que el resto del store.)

### 4. `src/components/workout/RestScoreboard.tsx`
Prop opcional nueva (backward-compatible):
```ts
justCompleted?: { label: string; target: FormattedTarget | null; onCorrect: () => void };
```
Si viene, renderizar una fila sobria (SIN oro; el oro es del anillo) entre el peek "Siguiente" y
`actionsRow`: "Hecho · {targetLine} · Corregir", como `Pressable` (minHeight 44) que llama
`onCorrect`. Reusar el patrón `nextTargetLine` para formatear el target. `accessibilityRole="button"`,
`accessibilityLabel="Corregir la serie recién hecha: {label} {target?.spoken}"`. Sin `target`, mostrar
sólo "Hecho · Corregir". No alterar el countdown, anillo, +30s/saltar ni la fila de ajuste de descanso.

### 5. `src/screens/ActiveWorkoutScreen.tsx`
- Importar `resolveJustCompleted` y `editCompletedSetValues` (del store).
- Durante descanso, calcular `const jc = resting ? resolveJustCompleted(aw.exercises) : null;` (con
  `useMemo` sobre `aw.exercises` + `resting`).
- Estado nuevo: `restCorrection: { exerciseId: string; setId: string } | null` + `editDraft:
  Record<string, FieldValue>`. Al abrir: `setEditDraft({ ...jc.values }); setRestCorrection({
  exerciseId: jc.exerciseId, setId: jc.setId });` (+ haptic light).
- Pasar a `<RestScoreboard>` la prop `justCompleted={ jc ? { label: jc.exerciseName, target:
  formatScoreboardTarget(jc.fields, jc.values), onCorrect: () => openRestCorrection(jc) } : undefined }`.
- Montar una **segunda** `<SetCorrectionSheet>` dedicada:
  - `visible={restCorrection != null}`
  - `exerciseId`/`setId` = de `restCorrection`
  - `fields` = del ejercicio recién hecho (`aw.exercises.find(e => e.id === restCorrection.exerciseId)?.fields`)
  - `values={editDraft}`; `onChange={(id,v) => setEditDraft(prev => ({ ...prev, [id]: v }))}`
  - `accent`/`tint` = por la disciplina de ESE ejercicio (mismo patrón que la sheet actual)
  - `onCommit={() => { editCompletedSetValues(restCorrection.exerciseId, restCorrection.setId, editDraft); setRestCorrection(null); Haptics.impactAsync(Light).catch(()=>{}); }}`
  - `onClose={() => setRestCorrection(null)}`; sin `children` (sin PlateCalculator en este flujo).
- **No modificar** la primera `<SetCorrectionSheet>` (set activo) ni `handleCompleteSet`.

Nota: `setIndex` que pide la sheet para el título "Ajustar set N" = `jc.setIndex`.

## Criterios de aceptación

1. En descanso aparece el eco "Hecho · <objetivo> · Corregir" de la serie con `completed_at` más
   reciente; no aparece si ninguna serie está completada.
2. Tocarlo abre el correction sheet sobre ESA serie (numpad + quick row + metadata funcionan por su
   `exerciseId/setId`). Guardar parchea sus `values`; el eco refleja el nuevo valor.
3. **El descanso NO se reinicia** al corregir (mismo `restTimer.startTime`/`duration`) y el puntero
   (`currentExerciseIndex/currentSetIndex`) no cambia.
4. Cerrar sin guardar (scrim/handle) deja la serie intacta.
5. Sin regresiones en el flujo set-active (HECHO, Cerrar sin guardar, quick row) ni en Live Activity.
6. `resolveJustCompleted` pura y con sus ~8 tests en verde; `npm run typecheck` limpio; `npm test` verde.

## Comandos de verificación
```bash
npm run typecheck && npm test
```
Foco: `npx vitest run src/features/workout/scoreboard/justCompleted.test.ts`

## Fuera de alcance (NO hacer)
- Re-detección de PR al editar; descanso por tipo de set (N5); Live Activity (N6); nada nativo.
- No parametrizar/rehacer la sheet de set activo. No tocar el WIP del usuario fuera de los archivos
  listados. Sin commit, sin push, sin git add.
