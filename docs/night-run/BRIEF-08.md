# BRIEF-08 — SessionOverviewSheet: glance con jerarquía, disclosure y progreso

**Para:** agente programador (fable). **Ciclo:** ~60-90 min. **Sin commits, sin deps nuevas, sin nativo.**
**Verificación:** `npm run typecheck && npm test` (pure-core) + criterios visuales para revisión manual de Álvaro.
(Metro en caliente — cada edición compila.)

**Reorden:** mantengo el orden. N7 (voz) es nativo e interrumpe su hot-testing; primero cerramos el
pulido JS/TS que aterriza en caliente, y la voz se agenda cuando Álvaro acepte un rebuild.

## Objetivo

El `SessionOverviewSheet` (la lista completa a un tap del marcador, "¿cuánto queda?") es hoy una
lista plana: TODAS las series completadas de TODOS los ejercicios se expanden a la vez → muro de
texto, scroll, abrumador, y sin un resumen de "cuánto queda" arriba. Justo lo que Álvaro quería
evitar. Rehacerlo al estándar del marcador: **jerarquía (el actual manda, Fraunces), disclosure tipo
app (un ejercicio expandido a la vez, el resto en una línea), y progreso de sesión sin scroll**
(cabecera "3/8 ejercicios · 12/24 series" + barra fina de oro). Toda la lógica de conteo/estado/
resumen sale a un pure-core testeable; el sheet queda como render fino.

## Base ya existente (verificada)

- `SessionOverviewSheet` recibe `exercises: ExerciseCard[]`, `currentExerciseIndex`, `onAddExercise`,
  `onClose`. Patrón Modal + Reanimated (SlideInDown) + tokens; dot por estado (done/current/upcoming).
- `setSummary(set, fields)` inline (ordena fields por `order`, "60 kg · 8") → se moverá al pure-core.
- Tokens: `FontFamily.serif` = Fraunces (lo usa `Type.title`); `Colors.gold.base` (indicador),
  `Colors.gold.glow` (track), `Colors.gold.deep` (ink). `Type.{micro,caption,body,bodyEmph}`.

## Archivos a tocar

### 1. NUEVO: `src/features/workout/scoreboard/sessionOverview.ts` (pure)
```ts
import type { ExerciseCard, ExerciseSet, FieldDefinition } from '../../../types/core';

export type ExerciseStatus = 'done' | 'current' | 'upcoming';

export interface OverviewSet { index: number; completed: boolean; summary: string; } // index 1-based
export interface OverviewExercise {
  id: string; name: string; done: number; total: number;
  status: ExerciseStatus;
  recap: string;          // colapsado: "4 series" | "2/4 series" | "Pendiente"
  sets: OverviewSet[];
}
export interface SessionOverview {
  exercisesDone: number; exercisesTotal: number;
  setsDone: number; setsTotal: number;
  progressLabel: string;  // "12 de 24 series"
  progress: number;       // setsDone/setsTotal, 0 cuando setsTotal===0 (para la barra)
  exercises: OverviewExercise[];
}

// "60 kg · 8" de una serie; campos por `order`, saltando vacíos/null. Pura.
export function formatSetSummary(set: ExerciseSet, fields: FieldDefinition[]): string;

export function buildSessionOverview(exercises: ExerciseCard[], currentIndex: number): SessionOverview;
```
Reglas:
- `done` = sets completados; `total` = sets.length. `complete = total>0 && done===total`.
- `status`: `complete` → 'done'; si no y `i===currentIndex` → 'current'; si no → 'upcoming'.
- `recap`: complete → `${total} ${total===1?'serie':'series'}`; `done>0` → `${done}/${total} series`;
  `done===0` → `'Pendiente'`.
- `sets[j]` = `{ index: j+1, completed: s.completed, summary: s.completed ? formatSetSummary(s, fields) : '' }`.
- Totales: `exercisesDone` = nº con status 'done'; `setsDone/setsTotal` sumados; `progress` con
  guard `setsTotal>0 ? setsDone/setsTotal : 0`; `progressLabel = \`${setsDone} de ${setsTotal} series\``.
- `currentIndex` fuera de rango → nadie es 'current' (todos done/upcoming), sin crash.

### 2. NUEVO: `src/features/workout/scoreboard/sessionOverview.test.ts` (vitest, ~14)
`formatSetSummary`: peso+reps "60 kg · 8"; reps sin unidad "8"; respeta `order`; salta null/''; distancia+ritmo.
`buildSessionOverview`: conteos (exercisesDone/Total, setsDone/Total); `progressLabel` y `progress`
(incl. `setsTotal===0` → 0, sin división por cero); `status` por ejercicio (done/current/upcoming);
`recap` en los 3 casos (completo/parcial/pendiente); `sets` con index 1-based + completed + summary;
`currentIndex` fuera de rango sin crash; `exercises: []` → ceros + "0 de 0 series".

### 3. `src/components/workout/SessionOverviewSheet.tsx` (rehacer render, mismo Modal/props)
- `const ov = buildSessionOverview(exercises, currentExerciseIndex);`
  `const currentId = exercises[currentExerciseIndex]?.id ?? null;`
- **Cabecera (sin scroll para lo importante):** bajo el título "Sesión", una línea
  `${ov.exercisesDone}/${ov.exercisesTotal} ejercicios · ${ov.progressLabel}` (Type.caption,
  ink.tertiary). Debajo, **barra de progreso fina** (alto 3-4, `Radius.full`, track `Colors.gold.glow`,
  relleno `Colors.gold.base` a `width: ${ov.progress*100}%`). Único acento de oro (progreso = dato).
- **Disclosure tipo acordeón:** exactamente UN ejercicio expandido; por defecto el actual.
  `const [expandedId, setExpandedId] = useState<string|null>(null);`
  `const shownId = expandedId ?? currentId;` `isExpanded = (id) => id === shownId;`
  Fila = `Pressable` → `Haptics.selectionAsync()` + `setExpandedId(id)`.
  - **Expandida:** render de las líneas por serie completada (`ov.exercises[i].sets` con
    `completed && summary`), como hoy ("1 · 60 kg · 8").
  - **Colapsada:** una sola línea `recap` (Type.caption, ink.muted). Nada de muro de texto.
- **Jerarquía / Fraunces:** el nombre del ejercicio ACTUAL en Fraunces
  (`fontFamily: FontFamily.serif, fontSize: 17, lineHeight: 22, color: Colors.ink.primary`),
  eco del titular del marcador; los demás en sans (`Type.body`, ink.secondary). Mantener fondo
  `bg.warm` + dot de oro en el actual.
- Badge `done/total` y fila "Añadir ejercicio" se conservan. Importar `formatSetSummary` del módulo;
  **borrar** el `setSummary` inline. No tocar el patrón Modal/animación ni `onAddExercise/onClose`.
- **A11y:** cada fila `accessibilityRole="button"`, `accessibilityState={{ expanded: isExpanded(id) }}`,
  label con nombre + `done/total` + estado (actual/completado) + `recap` cuando está colapsada.

## Criterios de aceptación
**Pure-core (verificable con tests):**
1. `buildSessionOverview` y `formatSetSummary` puras, no lanzan, ~14 tests verdes; `setsTotal===0`
   no divide por cero; `currentIndex` fuera de rango no crashea.
2. `npm run typecheck` limpio; `npm test` verde (803 previos + nuevos).

**Visual (revisión manual de Álvaro en simulador):**
3. Al abrir la hoja: cabecera con "X/Y ejercicios · N de M series" + barra de oro fina proporcional;
   lo importante ("cuánto queda") se ve sin scroll.
4. Solo el ejercicio actual aparece expandido con sus series; el resto en una línea (`recap`). Tocar
   otra fila mueve la expansión a esa (acordeón), con haptic.
5. El nombre del ejercicio actual está en Fraunces (mismo carácter editorial que el marcador); dot de
   oro; fondo cálido. Los demás, sans y sobrios.
6. Sin oro decorativo salvo la barra de progreso y el dot del actual; paper cálido de fondo.
7. Sin regresiones: "Añadir ejercicio" abre `AddExerciseSheet`; cerrar por scrim/handle funciona;
   VoiceOver anuncia estado + expandido/colapsado.

## Comandos de verificación
```bash
npm run typecheck && npm test
```
Foco: `npx vitest run src/features/workout/scoreboard/sessionOverview.test.ts`

## Fuera de alcance (NO hacer)
- WorkoutSummary y AddExerciseSheet (otro brief si procede); auto-scroll al actual; navegar la sesión
  desde la hoja (sigue siendo glance de solo lectura); voz/nativo/watch. No tocar el WIP del usuario
  fuera de los 3 archivos. Sin commit/push/git add.
