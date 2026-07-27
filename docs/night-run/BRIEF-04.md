# BRIEF-04 — El número gigante es tu memoria: "Sugerido · +2.5 kg vs la última"

**Para:** agente programador (fable). **Ciclo:** ~45-60 min. **Sin commits, sin deps nuevas, sin nativo.**
**Verificación:** `npm run typecheck && npm test`.

## Objetivo

Cierre de la noche. Hacer VISIBLE el moat en la pantalla héroe del in-use: el objetivo gigante no
es un valor por defecto, es **la sugerencia que tu memoria de progresión ha calculado** — y decir
en una línea sobria cómo se compara con la última vez ("+2.5 kg", "igual que la última"). Es la
frase que convierte el HECHO en un acto de confianza ("confirmar es aceptar la sugerencia", spec
§2) y lo que mejor demuestra mañana por qué Kairos no es "otro logger": recuerda por ti.

Por qué es el cierre correcto: es el ítem de mayor valor/riesgo-bajo restante que deja la app más
redonda para la demo (toca la pantalla que más se ve), es pequeño, 100% JS/TS, aditivo, sin deps ni
nativo, con pure-core exhaustivamente testeable. N5 (descanso por tipo de set) es más fontanería y
menos visible; N6 (Live Activity) NO se ve sin rebuild del widget Swift → nula demo esta noche.

## Base ya existente (verificada)

- `ActiveWorkoutScreen` ya calcula `previousRef: PreviousReference | null`
  (`{ source, weight, reps, performedAt?, blockName? }`) y renderiza `PreviousRefPill`
  ("Última · 60 kg × 8 · hace 4 días").
- El objetivo gigante se deriva de `{ ...currentSet.values, ...draftValues }` (draft-aware) → el
  delta se recalcula solo si el usuario corrige (bonus para la demo: la comparación es viva).
- `format.ts` exporta `stripZero(n)` (trim de decimales) — reutilizar, no reimplementar.

## Archivos a tocar

### 1. NUEVO: `src/features/workout/scoreboard/progressionDelta.ts` (pure)
Toda la lógica y el copy viven aquí; el screen sólo renderiza texto.

```ts
import type { FieldValue } from '../../../types/core';
import { stripZero } from './format';

export type DeltaDirection = 'up' | 'down' | 'same';

export interface ProgressionDelta {
  field: 'weight' | 'reps';
  direction: DeltaDirection;
  /** Signed. +2.5, -1, 0. */
  delta: number;
  /** Visual: "+2.5 kg" | "−1 rep" | "igual que la última". */
  label: string;
  /** VoiceOver: "2.5 kilos más que la última" | "1 repetición menos que la última" | "igual que la última vez". */
  spoken: string;
}

// Delta del objetivo actual vs la última vez. Eje primario = peso (kg); si no
// hay peso comparable en ambos, cae a reps. null si no hay referencia previa o
// nada comparable. `previous` acepta la forma de PreviousReference (weight/reps).
export function computeProgressionDelta(
  current: Record<string, FieldValue>,
  previous: { weight: number | null; reps: number | null } | null,
): ProgressionDelta | null;

// Compone la línea que ve/escucha el usuario. `edited=false` → es la sugerencia
// de la memoria; `edited=true` → el usuario ya corrigió (no decir "Sugerido").
export function progressionCaption(
  delta: ProgressionDelta | null,
  opts: { edited: boolean },
): { text: string; spoken: string } | null;
```

Reglas de `computeProgressionDelta`:
- `previous == null` → null.
- Peso: si `previous.weight != null` y `current.weight` es number → `delta = curW - prevW`,
  `field:'weight'`. `direction`: `>0` up, `<0` down, `0` same.
  - label up `+${stripZero(d)} kg`, down `−${stripZero(|d|)} kg` (U+2212), same `igual que la última`.
  - spoken up `${stripZero(|d|)} kilos más que la última`, down `… menos que la última`, same `igual que la última vez`.
- Reps (fallback si no hubo eje peso comparable): si `previous.reps != null` y `current.reps` es
  number → delta reps, `field:'reps'`. Plural: `|d| === 1` → "rep"/"repetición", si no
  "reps"/"repeticiones". up `+2 reps`, down `−1 rep`, same `igual que la última`.
- Si ni peso ni reps son comparables → null.

Reglas de `progressionCaption`:
- `edited === false`:
  - delta null → `{ text: 'Sugerido', spoken: 'Objetivo sugerido por tu progresión' }`
  - direction 'same' → `{ text: 'Sugerido · igual que la última', spoken: 'Objetivo sugerido, igual que la última vez' }`
  - up/down → `{ text: \`Sugerido · ${delta.label}\`, spoken: \`Objetivo sugerido, ${delta.spoken}\` }`
- `edited === true`:
  - delta null → `null`
  - direction 'same' → `{ text: 'Igual que la última', spoken: 'Igual que la última vez' }`
  - up/down → `{ text: \`${delta.label} vs la última\`, spoken: delta.spoken }`

### 2. NUEVO: `src/features/workout/scoreboard/progressionDelta.test.ts` (vitest)
Casos `computeProgressionDelta` (~12):
1. previous null → null.
2. peso up: cur `{weight:62.5,reps:8}`, prev `{weight:60,reps:8}` → field weight, up, delta 2.5,
   label "+2.5 kg", spoken contiene "2.5 kilos más".
3. peso down: 57.5 vs 60 → label "−2.5 kg" (U+2212), spoken "…menos que la última".
4. peso same: 60 vs 60 → direction same, label "igual que la última".
5. fallback reps up: cur `{reps:10}`, prev `{weight:null,reps:8}` → field reps, "+2 reps".
6. reps down singular: cur `{reps:7}`, prev reps 8 → "−1 rep", spoken "1 repetición menos…".
7. reps same.
8. prev.weight presente pero cur sin weight ni reps → null.
9. prev.weight null + reps comparables → cae a reps.
10. decimal 62.5 se recorta bien (stripZero).
11. peso preferido sobre reps cuando ambos comparables (62.5/10 vs 60/8 → field weight).
12. cur weight presente pero prev.weight null y reps no comparables → null.

Casos `progressionCaption` (~6): edited=false con delta null / same / up; edited=true con delta
null (→null) / same / down. Afirmar `text` y que `spoken` no está vacío.

### 3. `src/screens/ActiveWorkoutScreen.tsx` (aditivo, solo set-active)
- Importar `computeProgressionDelta, progressionCaption`.
- `useMemo` `progressionCaptionData`:
  ```ts
  const currentValues = currentSet ? { ...currentSet.values, ...draftValues } : {};
  const edited = currentSet ? !shallowEqualValues(currentSet.values, draftValues) : false;
  const delta = computeProgressionDelta(currentValues, previousRef);
  const caption = progressionCaption(delta, { edited });
  ```
  `shallowEqualValues(base, draft)` = comparación superficial sobre la unión de claves (trivial,
  inline en el screen; no crear módulo). `edited` marca si el draft difiere de lo sugerido.
- Renderizar la línea **entre `PreviousRefPill` y `styles.targetZone`**, sólo cuando `!changing` y
  `caption != null`:
  ```tsx
  {!changing && caption ? (
    <Text style={styles.suggested} accessibilityLabel={caption.spoken} maxFontSizeMultiplier={1.6}>
      {caption.text}
    </Text>
  ) : null}
  ```
- Estilo `suggested`: sobrio (SIN oro), `Type.micro`/eyebrow, `Colors.ink.tertiary`, centrado,
  ligero `letterSpacing`. No tocar `GiantTarget`, `PreviousRefPill`, footer, rest, ni exercise-change.

## Criterios de aceptación
1. En set-active, bajo el nombre/pill, aparece "Sugerido" (sin datos previos) o "Sugerido · +2.5 kg"
   / "Sugerido · igual que la última" según la memoria. En exercise-change y descanso NO aparece.
2. Al corregir el objetivo (draft ≠ sugerido), la línea deja de decir "Sugerido" y pasa a
   "+X kg vs la última" (o desaparece si no hay referencia). La comparación es viva con la corrección.
3. `accessibilityLabel` describe la sugerencia/comparación en español natural.
4. Sin regresiones: HECHO, quick row, corrección en descanso, Live Activity y el resto del marcador
   intactos.
5. `computeProgressionDelta` y `progressionCaption` puras, no lanzan, ~18 tests en verde.
6. `npm run typecheck` limpio; `npm test` verde.

## Comandos de verificación
```bash
npm run typecheck && npm test
```
Foco: `npx vitest run src/features/workout/scoreboard/progressionDelta.test.ts`

## Fuera de alcance (NO hacer)
- Descanso por tipo de set (N5), Live Activity (N6), color/oro condicional por dirección, gráficas.
- Nada nativo, sin deps. No tocar el WIP del usuario fuera de los 3 archivos. Sin commit/push/git add.
