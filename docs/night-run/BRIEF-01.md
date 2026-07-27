# BRIEF-01 — Corrige y completa en un gesto (≤2 toques)

**Para:** agente programador (fable). **Ciclo:** ~45-90 min. **Sin commits, sin deps nuevas.**
**Verificación:** `npm run typecheck && npm test`.

## Objetivo

Colapsar el camino de "serie corregida" de 3 toques a 2, exactamente la métrica de éxito de
`docs/INWORKOUT_GLANCE_MODE.md` ("≤2 toques por set en el 90% de los sets: hecho + quizá un
ajuste"). Hoy el `SetCorrectionSheet` cierra con "Listo" y el usuario TODAVÍA tiene que pulsar
HECHO en el marcador → toque desperdiciado en cada serie que se corrige. El sheet debe poder
**corregir y completar la serie en un solo gesto**: su CTA primario pasa a ser **HECHO** (commit
del draft + cierre + avance a descanso), conservando una escapatoria "Cerrar sin guardar".

Toques tras el cambio: tocar objetivo gigante (1) → ajustar numpad (el "ajuste" permitido) →
**HECHO en el sheet (1)**. Fin. Se elimina el "Listo" que sólo cerraba.

## Estado de partida (ya verificado)

- `src/screens/ActiveWorkoutScreen.tsx`: `handleCompleteSet` (líneas ~347-376) ya hace merge
  `{ ...currentSet.values, ...draftValues }`, detecta PR y llama `completeSet`. El sheet escribe
  sobre el MISMO `draftValues` vía `handleFieldChange`/`onChange`, así que commitear desde el
  sheet = reutilizar `handleCompleteSet` sin lógica nueva de store.
- `src/components/workout/SetCorrectionSheet.tsx`: CTA único "Listo" (líneas ~302-311) llama
  `handleClose` → sólo `onClose`. No hay tests de render (vitest sólo corre TS puro), así que
  cambiar la UI no rompe la suite.
- `PlateCalculator` se anida como `children` del sheet; el padre controla `calcOpen`.

## Archivos a tocar

### 1. NUEVO: `src/features/workout/scoreboard/commit.ts`
Pure-core testeable: compone el valor a commitear y su objetivo formateado (mismo idioma que el
marcador), para que el botón HECHO del sheet muestre/anuncie exactamente lo que va a registrar.
NO cambia la semántica de merge existente (`{ ...base, ...draft }`, draft gana) — no introducir
borrado por string vacío (eso es otro brief).

```ts
// Compose the exact values a HECHO from the correction sheet will commit, plus
// the formatted target so the sheet's button labels/announces what it logs.
// Merge matches the store + screen behaviour verbatim: draft overrides base.
import type { FieldDefinition, FieldValue } from '../../../types/core';
import { formatScoreboardTarget, type FormattedTarget } from './format';

export interface SheetCommit {
  values: Record<string, FieldValue>;
  target: FormattedTarget | null;
}

export function resolveSheetCommit(
  base: Record<string, FieldValue>,
  draft: Record<string, FieldValue>,
  fields: FieldDefinition[],
): SheetCommit {
  const values = { ...base, ...draft };
  return { values, target: formatScoreboardTarget(fields, values) };
}
```

### 2. NUEVO: `src/features/workout/scoreboard/commit.test.ts`
Vitest, sin RN. Cubre la composición merge+format en la que se apoya el botón HECHO. Usa
`FieldDefinition` mínimos (`id, name, type:'number', unit, order`). Casos:

- draft sobre-escribe base: base `{weight:60,reps:8}`, draft `{weight:62.5}` → target `62.5 kg × 8`
  (separador `×`, spoken contiene "62.5 kilos por 8").
- añadir campo desde base parcial: base `{weight:60}`, draft `{reps:8}` → `60 kg × 8`.
- draft vacío = base intacto: base `{weight:60,reps:8}`, draft `{}` → target de base.
- sin numéricos (bodyweight): base `{}`, draft `{}`, fields sólo texto → `target === null`,
  `values === {}` (HECHO sigue permitido: spec §"serie sin objetivo").
- resistencia: fields distancia (`km`) + ritmo (`min/km`) → separador `·`.
- draft introduce campo nuevo no presente en base → aparece en `values`.

Objetivo: ~6 tests. `formatScoreboardTarget` ya está testeado; aquí se valida la composición.

### 3. `src/components/workout/SetCorrectionSheet.tsx`
- Añadir prop **`onCommit: () => void`** a `Props` (obligatoria).
- Sustituir el bloque CTA único por dos acciones:
  - **Primario "HECHO"** (mismo estilo `styles.cta` ink pill): `onPress` = `() => { flushNote(); onCommit(); }`. `accessibilityLabel="Guardar y completar la serie"`. `accessibilityHint` con el objetivo hablado si se quiere (opcional; puede usar `resolveSheetCommit({}, values, fields).target?.spoken`).
  - **Secundario ghost "Cerrar sin guardar"** (estilo tipo `styles.metaToggleText`, minHeight 44):
    `onPress` = `handleClose`. Conserva la escapatoria de abrir el sheet sólo para mirar RPE/nota
    sin completar la serie.
- No tocar el numpad, metadata, ni el patrón Modal/Reanimated. El scrim y el handle siguen
  cerrando sin commitear (cancelar).

### 4. `src/screens/ActiveWorkoutScreen.tsx`
- Pasar al `<SetCorrectionSheet>` (junto a los props existentes):
  ```tsx
  onCommit={() => {
    handleCompleteSet();
    setCorrectionOpen(false);
    setCalcOpen(false);
  }}
  ```
  `handleCompleteSet` ya lee `draftValues` (que el sheet ha editado), hace PR + `completeSet`
  (avanza índice y arranca descanso). Cerrar el sheet + la calculadora deja el marcador en estado
  descanso, coherente. `draftValues` se re-siembra solo por el efecto sobre `currentSet.id`.
- No cambiar `handleCompleteSet` ni el store.

## Criterios de aceptación

1. Serie corregida en ≤2 toques: tocar objetivo (1) + ajustar + **HECHO en el sheet (1)**; ya no
   existe el par "Listo"→"HECHO".
2. Commitear desde el sheet registra valores IDÉNTICOS a commitear desde el marcador (mismo merge
   `{ ...currentSet.values, ...draftValues }`, misma detección de PR). Sin regresión del happy
   path (glance→HECHO en el marcador sigue igual).
3. Escapatoria intacta: "Cerrar sin guardar", el scrim y el handle cierran SIN registrar la serie
   (draft preservado hasta el próximo `currentSet.id`).
4. Al commitear se cierran sheet y `PlateCalculator`; el marcador entra en descanso.
5. A11y: el botón HECHO tiene rol button y label que describe la acción; VoiceOver no anuncia dos
   veces.
6. `npm run typecheck` sin errores; `npm test` verde (nuevos `commit.test.ts` incluidos, resto
   sin romper).

## Comandos de verificación

```bash
npm run typecheck && npm test
```

Opcional (foco): `npx vitest run src/features/workout/scoreboard/commit.test.ts`

## Fuera de alcance (NO hacer)

- Nada de `expo-audio`, voz, watchOS, prebuild, pods ni xcodeproj.
- No cambiar la semántica de merge (borrado por string vacío es N-posterior).
- No tocar el WIP del usuario fuera de los 4 archivos listados. Sin commit, sin push, sin git add.
