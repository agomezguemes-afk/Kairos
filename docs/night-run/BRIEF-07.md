# BRIEF-07 — Descanso por tipo de set (warmup ≠ work)

**Para:** agente programador (fable). **Ciclo:** ~45-60 min. **Sin commits, sin deps nuevas, sin nativo.**
**Verificación:** `npm run typecheck && npm test`. (Metro de Álvaro en caliente — cada edición compila.)

## Objetivo

Paridad con Strong (ventaja que Hevy no tiene): un warmup no merece el mismo descanso que una serie
de trabajo. Hoy `completeSet` usa `currentEx.rest_seconds || 90` para CUALQUIER serie. Cambio: el
descanso que SIGUE a una serie depende del **tipo de la serie completada** — warmup rampa con
descanso corto; working/drop/failure conservan el descanso de trabajo del ejercicio. El usuario ya
puede marcar warmup en el `SetCorrectionSheet` (metadata `kind`), así que la señal existe y la
funcionalidad es real (no un no-op). Pequeño toque de legibilidad: el estado descanso rotula
"Descanso · calentamiento" cuando la serie recién hecha fue warmup.

Riesgo bajo: para working (el 99% de los sets) el resultado es idéntico a hoy, así que ni el hot
path ni los tests existentes cambian de comportamiento; solo el warmup se acorta.

## Base ya existente (verificada)

- `src/store/workoutStore.ts` `completeSet`: `const restDuration = currentEx.rest_seconds || 90;`
  → `restTimer: { duration: restDuration, startTime: Date.now(), active: true }`. La serie
  completada está en `currentEx.sets[aw.currentSetIndex]` (puntero antes de avanzar).
- `SetKind = 'working' | 'warmup' | 'drop' | 'failure'` (`types/core.ts`); cada set tiene `.kind`.
- `RestScoreboard` rotula fijo `<Text style={styles.label}>Descanso</Text>`.
- `ActiveWorkoutScreen` ya computa la ref de la serie recién hecha (`resolveJustCompleted`, BRIEF-03)
  durante el descanso para la fila "Corregir".

## Archivos a tocar

### 1. NUEVO: `src/features/workout/scoreboard/restForSet.ts` (pure, leaf — solo importa tipos)
```ts
import type { SetKind } from '../../../types/core';

export const DEFAULT_REST_SECONDS = 90;  // espeja el `|| 90` de completeSet
export const WARMUP_REST_SECONDS = 45;   // rampa corta, estilo Strong

// Descanso que SIGUE a una serie, por su tipo. El warmup rampa: descanso corto,
// nunca mayor que el descanso de trabajo del ejercicio. Working/drop/failure →
// descanso de trabajo completo. Pura, sin efectos.
export function restForSet(kind: SetKind, workRestSeconds: number | undefined): number {
  const work = workRestSeconds && workRestSeconds > 0 ? workRestSeconds : DEFAULT_REST_SECONDS;
  if (kind === 'warmup') return Math.min(work, WARMUP_REST_SECONDS);
  return work;
}
```
(Módulo hoja: no importa el store → sin ciclo. El store lo importará.)

### 2. NUEVO: `src/features/workout/scoreboard/restForSet.test.ts` (vitest, ~7)
1. `('working', 120)` → 120. 2. `('warmup', 120)` → 45. 3. `('warmup', 30)` → 30 (work < cap).
4. `('working', undefined)` → 90. 5. `('working', 0)` → 90 (falsy → default).
6. `('drop', 120)` → 120 y `('failure', 120)` → 120. 7. `('warmup', undefined)` → 45.

### 3. `src/store/workoutStore.ts` (`completeSet`, cambio mínimo)
- Importar `restForSet` de `../features/workout/scoreboard/restForSet`.
- Reemplazar `const restDuration = currentEx.rest_seconds || 90;` por:
  ```ts
  const completedSet = currentEx.sets[aw.currentSetIndex];
  const restDuration = restForSet(completedSet?.kind ?? 'working', currentEx.rest_seconds);
  ```
- Nada más del store cambia (avance de índices, restTimer shape, skipRest/extendRest intactos).
  Para `working` el valor es idéntico al actual → sin regresión.

### 4. `src/components/workout/RestScoreboard.tsx`
- Añadir prop opcional `label?: string` (default `'Descanso'`), retro-compatible.
- Usarla en el `<Text style={styles.label}>{label ?? 'Descanso'}</Text>`. No tocar anillo, countdown,
  +30s/saltar, ni la fila de ajuste de descanso.

### 5. `src/screens/ActiveWorkoutScreen.tsx` (aditivo)
- Con la ref `jc` de `resolveJustCompleted` ya calculada en descanso, mirar el `kind` de esa serie
  (sin tocar `justCompleted.ts`): 
  ```ts
  const jcKind = resting && jc
    ? aw.exercises.find(e => e.id === jc.exerciseId)?.sets.find(s => s.id === jc.setId)?.kind
    : undefined;
  const restLabel = jcKind === 'warmup' ? 'Descanso · calentamiento' : 'Descanso';
  ```
- Pasar `label={restLabel}` al `<RestScoreboard>`. No tocar la fila "Corregir" ni nada más.

## Criterios de aceptación
1. Completar una serie marcada **warmup** arranca un descanso de `min(rest_seconds, 45)`; el estado
   descanso rotula "Descanso · calentamiento".
2. Completar una serie **working/drop/failure** mantiene exactamente el descanso de hoy
   (`rest_seconds || 90`) y el rótulo "Descanso".
3. El ajuste −15/+15 y el override `setExerciseRestForCurrent` siguen operando sobre el descanso
   resultante; auto-avance y haptics sin cambios.
4. Sin estados intermedios rotos; `working` no cambia de comportamiento (tests previos verdes).
5. `restForSet` pura, no lanza, ~7 tests nuevos verdes; `npm run typecheck` limpio; `npm test` verde.

## Comandos de verificación
```bash
npm run typecheck && npm test
```
Foco: `npx vitest run src/features/workout/scoreboard/restForSet.test.ts`

## Fuera de alcance (NO hacer)
- Descansos distintos para drop/failure (v1 = warmup vs work), campo configurable de warmup-rest,
  tagging automático de warmup, voz/nativo/watch. No modificar `resolveJustCompleted` ni sus tests.
  No tocar el WIP del usuario fuera de los 5 archivos. Sin commit/push/git add.
