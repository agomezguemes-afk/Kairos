# BRIEF-09 — WorkoutSummary: pure-core del payoff + pulido editorial (pivote de N6)

**Para:** developer opus (fable EXCLUIDO de todo despacho). **Ciclo:** ~60-90 min.
**Sin commits, sin deps nuevas, sin nativo, sin tocar el Metro de Álvaro (29107/8081).**
**Verificación:** `npm run typecheck && npm test` (pure-core) + criterios visuales para revisión en vivo.

## Por qué pivote (dictamen)

N6 pedía enriquecer el payload de la Live Activity SOLO en `payload.ts`. Al revisar el contrato real:
`modules/kairos-live-activity/ios/WorkoutActivityAttributes.swift` (`ContentState`) espeja `payload.ts`
**campo por campo**, y tanto el `.swift` como `index.ts` avisan: "ActivityKit empareja el widget por la
forma codificada de ContentState — change one, change all three". Conclusión: **cualquier campo NUEVO
en el payload no se renderiza sin tocar el `.swift` + la UI del widget (nativo, GATED — mataría su
sesión en vivo), y además desincroniza la forma**. Los cambios TS-only shape-preserving de payload.ts
son marginales (ya está bien y testeado). → Movimiento JS/TS-only de mayor valor para el in-training
flow: **WorkoutSummary**, la única superficie del flujo aún sin pulir en este run, que Álvaro alcanza
en vivo al terminar una sesión de prueba, y con pure-core real que extraer y testear.

## Estado actual (verificado — `src/components/workout/WorkoutSummary.tsx`)

- Payoff de fin de sesión (ScrollView): eyebrow + nombre de bloque, hero de volumen (numHero serif),
  fila de stats (duración/series/ejercicios), lista de PRs auto-detectados, comparativa vs sesión
  previa, adherencia, sugerencia "Siguiente", CTA oro.
- Lógica pura EXISTENTE y reutilizable: `./lib/summaryCompare` (`compareToPrevious`,
  `nextActionSuggestion`) y `../../lib/history/exerciseHistory` (`detectPr`, `estimateOneRepMax`,
  `lookupExerciseHistory`). `formatVolume` de `../../lib/stats/weekStats`.
- Lógica pura **INLINE** (sin tests propios, sin extraer): `fmtDuration`, `signed`, `prDeltaLabel`, y
  el bucle `useMemo` que construye `PrEntry[]` (volumen, top set, `detectPr` por ejercicio). Ese bucle
  es el corazón verificable del payoff y hoy no tiene cobertura.
- Detalles de estética: `styles.title` usa `Type.heading` (sans bold), no Fraunces; fondo del scroll
  `Colors.bg.void`.

## Archivos a tocar

### 1. NUEVO: `src/components/workout/lib/workoutSummaryModel.ts` (pure)
Extraer, sin cambiar comportamiento:
```ts
import type { WorkoutHistoryEntry } from '../../../store/workoutStore';
import { detectPr, estimateOneRepMax, type ExerciseSessionPoint, type PrResult }
  from '../../../lib/history/exerciseHistory';

export function fmtDuration(sec: number): string;          // "0s" | "5m" | "5m 03s"
export function signedDelta(n: number, suffix: string): string; // "+3 kg" | "−2 kg" | "0 kg" (U+2212, redondeo)
export function prDeltaLabel(pr: { kind: PrResult['kind']; delta: number }): string; // "+2.5 kg" | "+X kg 1RM" | "+X kg vol." | ""

export interface SummaryPr { name: string; delta: number; kind: PrResult['kind']; }

// PRs de la sesión recién terminada. `lookup` inyecta el historial por ejercicio
// (el componente pasa (ref) => lookupExerciseHistory(ref, historyIndex)) para que
// esta función sea pura y testeable sin el hook del índice.
export function buildSessionPrs(
  entry: WorkoutHistoryEntry,
  lookup: (ref: { libraryId?: string; name: string }) => Parameters<typeof detectPr>[1],
): SummaryPr[];
```
`buildSessionPrs` reproduce EXACTA la lógica inline actual: por ejercicio, acumula volumen y top
weight/reps de `performedSets` completados; salta si `topWeight==null && volume===0`; arma el
`ExerciseSessionPoint` candidato (`at`, `date`, `topWeight`, `topReps`, `volume`, `setsCompleted`,
`estimatedOneRm`, `libraryId`); `detectPr(candidate, lookup({libraryId,name}))`; incluye si
`isPr && kind && delta>0`. Mismo orden de recorrido.

### 2. NUEVO: `src/components/workout/lib/workoutSummaryModel.test.ts` (vitest)
- `fmtDuration`: 0→"0s"; 45→"45s"; 300→"5m"; 303→"5m 03s"; 3600→"60m".
- `signedDelta`: +3→"+3 kg"; -2→"−2 kg" (U+2212); 0→"0 kg"; redondea 2.6→"+3 kg".
- `prDeltaLabel`: kind 'weight' → "+2.5 kg"; 'oneRm' → "…kg 1RM"; 'volume' → "…kg vol.".
- `buildSessionPrs` (inyectando `lookup`): 
  (a) ejercicio cuyo top weight bate el historial inyectado → aparece con su delta;
  (b) ejercicio sin sets completados / volumen 0 → excluido;
  (c) `delta<=0` o `isPr=false` → excluido;
  (d) varios ejercicios → orden de recorrido preservado.
  (Leer `detectPr` para construir fixtures que produzcan PR/no-PR deterministas.)

### 3. `src/components/workout/WorkoutSummary.tsx` (refactor fino + pulido)
- **Refactor (sin cambio de comportamiento):** borrar `fmtDuration`/`signed`/`prDeltaLabel` inline y el
  bucle de PRs; importar de `./lib/workoutSummaryModel`; el `useMemo` de PRs pasa a
  `buildSessionPrs(entry, (ref) => lookupExerciseHistory(ref, historyIndex))`. `signed(` →
  `signedDelta(`. Resto (comparativa, adherencia, sugerencia, colores) intacto.
- **Pulido editorial (visible, bajo riesgo):** el título del bloque en Fraunces para eco del marcador:
  `styles.title` → `{ fontFamily: FontFamily.serif, fontSize: 26, lineHeight: 30, fontWeight: '600',
  color: Colors.ink.primary, marginBottom: Spacing.xl }` (importar `FontFamily`). El hero ya es serif;
  el oro sigue reservado (eyebrow, PR, CTA) — no añadir oro nuevo.
- **Recomendación marcada para decisión de Álvaro (User Sovereignty, NO imponer):** el fondo del scroll
  es `Colors.bg.void`; si NO es un payoff oscuro intencional, alinearlo a `Colors.paper.base` para
  coherencia con el paper cálido de la sesión que cierra. Dejar el cambio en UNA línea aislada y
  anotarlo en el resumen del ciclo para que Álvaro lo apruebe o revierta trivialmente. Si hay duda,
  NO cambiarlo.

## Criterios de aceptación
**Pure-core (tests):**
1. `workoutSummaryModel` puro, no lanza; `buildSessionPrs` reproduce exactamente la salida del bucle
   inline previo (mismos PRs, mismo orden). ~12 tests verdes.
2. `npm run typecheck` limpio; `npm test` verde (todo lo previo + nuevos).

**Visual (revisión en vivo de Álvaro, al completar una sesión de prueba):**
3. El resumen se ve idéntico en datos a antes (hero, stats, PRs, comparativa, adherencia, sugerencia) —
   cero regresión funcional del refactor.
4. El nombre del bloque aparece en Fraunces (mismo carácter editorial que el objetivo del marcador).
5. El oro sigue siendo escaso (solo eyebrow/PR/CTA). Si se aplica el cambio de fondo, el payoff queda
   sobre paper cálido coherente con la sesión.

## Comandos de verificación
```bash
npm run typecheck && npm test
```
Foco: `npx vitest run src/components/workout/lib/workoutSummaryModel.test.ts`

## Fuera de alcance (NO hacer)
- Tocar `payload.ts`/`.swift`/`.pbxproj`/pods/prebuild (N6/N7/N8 GATED — matarían su sesión en vivo).
- Rediseñar el layout del summary o cambiar la lógica de comparativa/adherencia/sugerencia.
- No tocar el WIP del usuario fuera de los 3 archivos. Sin commit/push/git add. No matar el Metro (8081).
