# BRIEF-10 — Consolidación del marcador: blindar la composición de 9 features

**Para:** developer opus (fable EXCLUIDO). **Ciclo:** ~45-75 min.
**Sin commits, sin deps nuevas, sin nativo, sin tocar el Metro de Álvaro (8081).**
**Verificación:** `npm run typecheck && npm test` + checklist QA manual para revisión en vivo.

## Dictamen (por qué esto y no otra feature)

El loop del Modo Sesión está **feature-complete en JS/TS**: N1-N4 + razón del sugerido (05) + advisor
intra-sesión (06) + descanso por tipo (07) + overview con acordeón (08) + WorkoutSummary pure-core
(09). PlateCalculator ya tiene su math pura en `lib/plates.ts`. El único gap de feature —números en
palabras en `parseSpokenSet` ("sesenta por ocho")— es valor **latente hasta que aterrice el grabador**
(N7, GATED): su sitio natural es la ventana de voz, junto al recorder, no ahora. Mientras tanto hay
**9 features apiladas sobre un `ActiveWorkoutScreen` de 1059 líneas** y Álvaro revisando en vivo — el
momento perfecto para blindar la COMPOSICIÓN (donde vitest no llega porque no renderiza) extrayéndola a
pure-core testeable y pasando una auditoría de interacción. Opción (b) del encargo, ejecutada concreta.

## Objetivo

1. Extraer la lógica más propensa a bug —**qué caption gana** (nudge intra-sesión > sugerido
   entre-sesiones > nada), hoy inline en un `useMemo` del screen— a una función pura testeada.
2. Auditar por lectura las interacciones de riesgo entre features y corregir lo que aparezca.
3. Dejar a Álvaro un checklist QA manual para confirmar en vivo.

## Archivos a tocar

### 1. NUEVO: `src/features/workout/scoreboard/selectCaption.ts` (pure)
Centraliza la precedencia que hoy vive en el `useMemo` de `suggestionCaption` (BRIEF-06) + el guard
`!changing` del render. Una sola fuente de verdad, testeable:
```ts
import type { FieldValue } from '../../../types/core';
import type { InSessionNudge, SuggestionBasis } from '../../../lib/progression';
import { describeSuggestion, describeInSessionNudge, type RationaleCaption } from './suggestionRationale';

export interface CaptionInput {
  changing: boolean;
  inSessionNudge: InSessionNudge | null;
  suggestion: { values: Record<string, number>; basis: Record<string, SuggestionBasis> } | null;
  currentValues: Record<string, FieldValue>; // { ...currentSet.values, ...draftValues }
}

// Precedencia: en cambio de ejercicio, nada. Si hay nudge intra-sesión, manda
// (y se oculta si el usuario editó el peso lejos del sugerido). Si no, cae al
// sugerido entre-sesiones. null = sin caption.
export function selectSuggestionCaption(input: CaptionInput): RationaleCaption | null {
  if (input.changing) return null;
  if (input.inSessionNudge) {
    return input.currentValues['weight'] === input.inSessionNudge.nextWeight
      ? describeInSessionNudge(input.inSessionNudge)
      : null;
  }
  if (input.suggestion) return describeSuggestion(input.suggestion, input.currentValues);
  return null;
}
```

### 2. NUEVO: `src/features/workout/scoreboard/selectCaption.test.ts` (vitest, ~8)
1. `changing:true` → null (aunque haya nudge/suggestion).
2. nudge presente + `currentValues.weight === nextWeight` → caption de `describeInSessionNudge` (easy/hard).
3. nudge presente + peso editado (≠ nextWeight) → null (no cae al sugerido: el usuario mandó).
4. sin nudge + suggestion con basis nudge-up → caption de `describeSuggestion` ("la última fue fácil").
5. sin nudge + suggestion carry-forward → "igual que la última".
6. sin nudge + sin suggestion → null.
7. nudge presente pero `currentValues` sin clave weight (bodyweight) → null (no casa nextWeight).
8. precedencia: nudge presente Y suggestion presente → gana el nudge.

### 3. `src/screens/ActiveWorkoutScreen.tsx` (sustituir el memo por la función pura)
- Importar `selectSuggestionCaption`.
- Reemplazar el cuerpo del `useMemo` de `suggestionCaption` por:
  ```ts
  const suggestionCaption = useMemo(
    () => selectSuggestionCaption({
      changing,
      inSessionNudge,
      suggestion,
      currentValues: currentSet ? { ...currentSet.values, ...draftValues } : {},
    }),
    [changing, inSessionNudge, suggestion, currentSet, draftValues],
  );
  ```
  (Si `changing` se computa después del memo por reglas de hooks, calcularlo antes o pasar el
  `sbState.kind === 'exercise-change'` equivalente.) El render deja de necesitar el guard
  `!changing` (ya va dentro): `{suggestionCaption ? <Text …/> : null}`. Sin cambios de estilo.

## Auditoría por lectura (corregir si aparece; anotar hallazgos en el resumen del ciclo)
Revisar en `ActiveWorkoutScreen.tsx` estas interacciones concretas de las 9 features apiladas:
- **A. Seed del nudge (06) vs quick-entry (02):** tras `parseSpokenSet` escribir en `draftValues`, el
  caption debe ocultarse si el peso resultante ≠ nextWeight/sugerido (edición del usuario). Verificar
  que el seed adaptativo NO pisa lo que el usuario dicta/teclea después (el efecto está keyed en
  `currentSet.id`, no debe re-sembrar en cada edición).
- **B. Nudge vs corrección en descanso (03):** si el usuario corrige el RPE de la serie previa durante
  el descanso (`updateSetMetadata`), la memo de `inSessionNudge`/`priorCompletedSet` debe recomputar
  con el RPE nuevo (dependencias correctas). `editCompletedSetValues` solo parchea `values` — confirmar
  que el RPE llega por su vía.
- **C. Modalidad:** endurance/bodyweight → `inSessionWeightNudge` = null y el seed NO intenta escribir
  `weight` si `currentSet.values.weight` no es number (sin crash, sin objetivo fantasma).
- **D. Primera serie de un ejercicio / cambio de ejercicio:** sin `priorCompletedSet` → sin nudge; el
  caption cae al sugerido entre-sesiones; en `exercise-change` no hay caption (guard).
- **E. PlateCalculator confirm (long-press peso):** `handleCalcConfirm` escribe `weight` en draft →
  el caption debe pasar a oculto (edición) coherentemente.

## Checklist QA manual para Álvaro (en vivo, no automatizable con vitest)
1. Serie con RPE≤7 → siguiente serie muestra +2.5 kg y "la serie anterior fue fácil"; con RPE≥10, −2.5.
2. Editar el objetivo (numpad, quick-entry "62 por 8", o plate calc) oculta el caption.
3. Corregir el RPE de la serie previa en el descanso cambia la sugerencia de la siguiente.
4. Ejercicio de resistencia (distancia/ritmo): sin nudge, sin objetivo fantasma, sin crash.
5. Overview: acordeón (solo el actual expandido), barra de progreso de oro, nombre actual en Fraunces.
6. Fin de sesión: WorkoutSummary con datos correctos, título en Fraunces.

## Criterios de aceptación
1. `selectSuggestionCaption` pura, no lanza, ~8 tests verdes; la precedencia queda pinneada.
2. El screen usa la función pura; comportamiento del caption idéntico al actual (sin regresión visible).
3. Hallazgos de la auditoría A-E corregidos o anotados explícitamente como "sin issue" en el resumen.
4. `npm run typecheck` limpio; `npm test` verde (874 previos + nuevos).

## Comandos de verificación
```bash
npm run typecheck && npm test
```
Foco: `npx vitest run src/features/workout/scoreboard/selectCaption.test.ts`

## Fuera de alcance (NO hacer)
- Números en palabras en `parseSpokenSet` (va con el grabador N7, GATED). Voz/nativo/watch/pods.
- Rediseñar el marcador o cambiar la semántica de nudge/sugerido. No tocar el WIP del usuario fuera de
  los 3 archivos (salvo fixes puntuales que la auditoría A-E justifique, anotados). Sin commit/push/git add.
