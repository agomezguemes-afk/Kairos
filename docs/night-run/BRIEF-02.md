# BRIEF-02 — El cerebro de voz: "62.5 por 8, me costó" → serie registrada

**Para:** agente programador (fable). **Ciclo:** ~60-90 min. **Sin commits, sin deps nuevas, sin nativo.**
**Verificación:** `npm run typecheck && npm test`.

## Objetivo

Sentar el **cerebro del moat** (voz + memoria) como TS puro, sin tocar nativo: un parser que
convierte una frase en lenguaje natural — la que dictarías o escribirías — en valores de los
campos DINÁMICOS del ejercicio + metadatos (RPE, nota). Se enchufa HOY al `SetCorrectionSheet` vía
un input de texto rápido, así que es **útil ya sin micrófono** (escribes "62.5 por 8" y HECHO lo
registra) y queda **voice-ready**: cuando aterrice el grabador (brief nativo N7), sólo tendrá que
pasar el `transcript` al MISMO parser. Cierra el bucle de BRIEF-01: dictar/escribir → HECHO → log.

Por qué es lo siguiente: es el único ítem del backlog que avanza el diferenciador irremplazable
(los referentes voz-first no tienen memoria ni campos dinámicos; los loggers no tienen voz) SIN
requerir Mac ni rebuild, y con pure-core exhaustivamente testeable.

## Alcance y decisiones (leer antes de codear)

- **Field-aware, no hardcode.** El parser recibe `fields: FieldDefinition[]` del ejercicio y asigna
  a `weight`/`reps` en fuerza, a `distance`/`pace` en resistencia, etc. Reutiliza el criterio de
  `formatScoreboardTarget` (numéricos = tipos `number` y `time`, ordenados por `field.order`).
- **Sólo dígitos** en esta entrega: "8", "62.5", "62,5" (coma decimal). Los números en palabras
  ("ocho") quedan FUERA de alcance (Whisper suele emitir dígitos; añadirlos es un brief posterior).
- **RPE es metadato de set** (`set.rpe`, 1..10), no un campo — va por `updateSetMetadata`. Sólo el
  patrón explícito "rpe N" lo fija; frases de esfuerzo ("me costó") NO se convierten en RPE
  (adivinar es ruido) — caen en la nota.
- **Nota** = texto sobrante tras consumir números/unidades/keywords, sólo si hubo al menos un valor
  o rpe reconocido (una frase ininteligible no crea nota).
- Merge/commit siguen siendo los de BRIEF-01: los valores entran por `onChange` → `draftValues`;
  el HECHO del sheet los registra. Sin cambios de store salvo usar `updateSetMetadata` (ya existe).

## Archivos a tocar

### 1. NUEVO: `src/features/workout/scoreboard/parseSpokenSet.ts` (pure)

API:
```ts
import type { FieldDefinition, FieldValue } from '../../../types/core';

export interface ParsedSet {
  /** field.id → valor parseado (number para 'number', string "m:ss" para 'time'). */
  values: Record<string, FieldValue>;
  /** RPE explícito 1..10, o null. Fuera de rango → null. */
  rpe: number | null;
  /** Texto de esfuerzo/observación sobrante, o null. */
  note: string | null;
  /** true si se reconoció al menos un valor o rpe. */
  matched: boolean;
}

export function parseSpokenSet(utterance: string, fields: FieldDefinition[]): ParsedSet;
```

Algoritmo (documentar con comentarios WHY, no what):
1. **Normalizar:** lowercase, trim, colapsar espacios, sustituir coma decimal por punto SOLO entre
   dígitos (`62,5` → `62.5`, sin romper comas de separación "60, 8").
2. **RPE:** regex `rpe\s*(?:de\s*)?(\d{1,2})` → si 1..10, fijar `rpe` y consumir el span; si no,
   descartar el número pero consumir "rpe".
3. **Números con unidad:** para cada número seguido de un token de unidad/keyword conocido, mapear
   al campo destino y consumir ambos spans. Mapa `UNIT_ALIASES` (spoken → destino):
   - `kilo|kilos|kg` → campo id `weight` (o `unit==='kg'`)
   - `rep|reps|repe|repes|repetición|repeticion|repeticiones` → campo id `reps`
   - `km|kilómetro(s)|kilometro(s)` → campo `unit==='km'` (distancia)
   - `metro(s)|m` → `unit==='m'`
   - `min|minuto(s)` → `unit==='min'` o campo `time`; `seg|segundo(s)|s` → `unit==='sec'`
   - `ppm|pulsaciones` → `unit==='bpm'`; `cal|kcal|calorías|calorias` → `unit==='kcal'`
   Resolución de campo: primero por `field.id` (weight/reps), luego por `field.unit`, preferendo
   campos numéricos/`time`. Si no hay campo destino para esa unidad, tratar el número como bare.
4. **Idioma fuerza "A por/x B":** dos números separados por `por` | `x` | `×` (uno de ellos aún sin
   asignar) → primero=`weight`, segundo=`reps`, SI el ejercicio tiene ambos campos. Consumir.
5. **Tiempo "m:ss":** token `\d{1,2}:\d{2}` → si existe un campo `type==='time'` sin asignar, fijar
   como string "m:ss". (Best-effort; sin campo time, ignorar.)
6. **Bare numbers de relleno:** los números sin unidad ni idioma se asignan, en orden de aparición,
   a los campos numéricos aún vacíos ordenados por `field.order`. Sobrantes se descartan.
7. **Nota:** de los tokens no consumidos, quitar fillers (`por, x, ×, y, de, a, con, el, la` +
   tokens de unidad ya usados), trim/colapsar; si queda texto con letras Y `matched===true`, es la
   nota; si no, `null`.
8. `matched = Object.keys(values).length > 0 || rpe !== null`.

Robustez: no lanzar nunca; entrada vacía/ininteligible → `{ values:{}, rpe:null, note:null,
matched:false }`.

### 2. NUEVO: `src/features/workout/scoreboard/parseSpokenSet.test.ts` (vitest)

Helpers de fixtures: `numField(id,name,order,unit?)` y `timeField(...)`. Fuerza =
`[weight(kg), reps]`; resistencia = `[distance(km), pace(time)]`; bodyweight = `[reps]`.

Casos (~16):
1. `"62.5 por 8"` (fuerza) → `{weight:62.5, reps:8}`, matched.
2. `"60x8"` → `{weight:60, reps:8}`.
3. `"60 kg × 8 reps"` → `{weight:60, reps:8}`.
4. `"62,5 por 8"` (coma decimal) → `{weight:62.5, reps:8}`.
5. `"8 reps"` → `{reps:8}`.
6. `"60 kilos"` → `{weight:60}`.
7. `"60 8"` (bare, orden) → `{weight:60, reps:8}` (weight.order < reps.order).
8. `"rpe 9"` → `rpe:9`, `values:{}`, matched true.
9. `"62.5 por 8 rpe 9"` → weight/reps + `rpe:9`.
10. `"60 por 8 me costó"` → weight/reps + `note:"me costó"`.
11. `"rpe 11"` → `rpe:null` (fuera de rango), matched false.
12. `""` → matched false, todo vacío/null.
13. `"hola qué tal"` → matched false, `note:null` (no crea nota sin valores).
14. resistencia `"5 km"` → `{distance:5}`.
15. resistencia `"5 km 5:30"` → `{distance:5, pace:"5:30"}` (campo time).
16. bodyweight `"8"` → `{reps:8}` (fallback al único numérico).
Extra recomendados: `"10.5 km"`→`{distance:10.5}`; `"8 repeticiones"`→`{reps:8}`; nota con espacios
colapsados `"60 por 8   me   costó mucho"`→`note:"me costó mucho"`.

### 3. `src/components/workout/SetCorrectionSheet.tsx` (wiring, sin props nuevas)

El sheet ya recibe `fields`, `values`, `onChange`, `exerciseId`, `setId`, y usa
`updateSetMetadata`. Añadir una fila compacta **al principio del `ScrollView` body, encima de
`<SetInput>`**: un `TextInput` de una línea (`returnKeyType="done"`, `blurOnSubmit`), placeholder
`"Escribe la serie: 62.5 por 8"`, con estado local `quick` (string).

`onSubmitEditing`:
```ts
const parsed = parseSpokenSet(quick, fields);
if (!parsed.matched) { /* haptic warning suave, no borrar */ return; }
Object.entries(parsed.values).forEach(([id, v]) => onChange(id, v));
if (parsed.rpe != null) updateSetMetadata(exerciseId, setId, { rpe: parsed.rpe });
if (parsed.note) updateSetMetadata(exerciseId, setId, { notes: parsed.note });
Haptics.selectionAsync().catch(() => {});
setQuick('');
```
`accessibilityLabel="Dictar o escribir la serie en lenguaje natural"`. Estilo sobrio con tokens
(no oro): fondo `Colors.bg.elevated`, radio `Radius.md`, misma familia que `noteInput`. No tocar
el numpad, la metadata, ni el CTA HECHO de BRIEF-01. La fila es opcional y no roba foco al numpad.

Nota: los valores aplicados por `onChange` alimentan `draftValues` del padre → el objetivo gigante
y el HECHO del sheet ya reflejan lo dictado (BRIEF-01). Sin cambios en `ActiveWorkoutScreen`.

## Criterios de aceptación

1. `parseSpokenSet` es pura, no lanza nunca, y pasa los ~16 casos (fuerza, resistencia, bodyweight,
   rpe, nota, coma decimal, idioma "por/x", vacío/ininteligible).
2. Escribir "62.5 por 8" en la fila del sheet y pulsar HECHO registra `{weight:62.5, reps:8}`
   idéntico a haberlo tecleado en el numpad (mismo `draftValues` → mismo commit de BRIEF-01).
3. "rpe 9" fija el RPE del set vía metadata; "me costó" cae en la nota; entrada ininteligible no
   altera nada (feedback háptico suave, texto conservado).
4. Sin regresiones: numpad, metadata, CTA HECHO / "Cerrar sin guardar" intactos; Live Activity y
   marcador sin cambios.
5. `npm run typecheck` limpio; `npm test` verde con los nuevos tests incluidos.

## Comandos de verificación

```bash
npm run typecheck && npm test
```
Foco: `npx vitest run src/features/workout/scoreboard/parseSpokenSet.test.ts`

## Fuera de alcance (NO hacer)

- Nada de `expo-audio`/`expo-av`, grabación, push-to-talk, watchOS, prebuild, pods, xcodeproj.
- Números en palabras ("ocho"), multiidioma, o inferir RPE de frases de esfuerzo (briefs futuros).
- No tocar el WIP del usuario fuera de los 3 archivos. Sin commit, sin push, sin git add.
