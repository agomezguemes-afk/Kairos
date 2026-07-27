# BRIEF-11 — El cerebro de voz entiende números en palabras ("sesenta y dos por ocho")

**Para:** developer opus (fable EXCLUIDO). **Ciclo:** ~60-90 min.
**Sin commits, sin deps nuevas, sin nativo, sin tocar el Metro de Álvaro (8081).**
**Verificación:** `npm run typecheck && npm test`.

## Dictamen (por qué SÍ vale, y por qué es 100% JS/TS)

En BRIEF-10 dejé los "números en palabras" para la ventana de voz (N7, gated). **Corrijo: fue un
error de encuadre.** El PARSEO de texto→número es lógica pura TS, totalmente independiente de la
grabación de audio (lo nativo es capturar el clip, no interpretarlo). El propio `parseSpokenSet.ts`
lo admite en su cabecera ("Digits only in this pass… spelled-out numbers are a later brief"). Avanzar
esta pieza AHORA:
- **Endurece el quick-entry de HOY** (el usuario teclea "sesenta y dos por ocho" en el
  `SetCorrectionSheet` y se registra) — cero dependencia de micrófono.
- **De-risquea el loop de voz**: Whisper en español emite con frecuencia números en palabras
  ("sesenta", "ocho"), no dígitos, sobre todo en habla conectada. Cuando el grabador aterrice, el
  cerebro ya los entiende — sin re-trabajo.

Es el último trozo claramente valioso 100% JS/TS del flujo in-training; después de esto, lo que queda
es nativo (voz/watch, gated) o la consolidación de BRIEF-10.

## Base ya existente (verificada — `parseSpokenSet.ts`)

- `parse()` normaliza (lowercase, coma decimal entre dígitos) → `tokenize()` (regex `TOKEN_RE`:
  time `\d:\d\d`, number `\d+(\.\d+)?`, text `[a-zñáéíóúü]+`, `×`) → pasos 1-6 (rpe, unidad, idioma
  "por/x", time, bare, note). Los números en palabras son tokens `text` que hoy caen en la nota o se
  descartan.
- Integración limpia: convertir las tiradas de palabras-número en tokens `number` JUSTO DESPUÉS de
  `tokenize()`, para que TODO el pipeline (unidad, idioma, bare, rpe) funcione sin cambios.

## Archivos a tocar

### 1. NUEVO: `src/features/workout/scoreboard/spanishNumbers.ts` (pure)
```ts
export interface NumberRun { value: number; length: number; } // length = nº de palabras consumidas

// Parsea una tirada MAXIMAL de palabras-número españolas desde words[start].
// null si words[start] no inicia un número. Cubre 0-999 + "y medio" (+0.5).
export function parseSpanishNumberWords(words: string[], start?: number): NumberRun | null;
```
Mapas (todas en minúscula; incluir variantes con y sin tilde):
- `UNITS`: cero0 uno1 una1 dos2 tres3 cuatro4 cinco5 seis6 siete7 ocho8 nueve9
- `TEENS` (10-29 en una palabra): diez…quince, dieciséis/dieciseis…diecinueve, veinte,
  veintiuno/veintiuna21, veintidós/veintidos22 … veintinueve29
- `TENS`: treinta30 cuarenta40 cincuenta50 sesenta60 setenta70 ochenta80 noventa90
- `HUNDREDS`: cien100 ciento100 doscientos/doscientas200 … novecientos/novecientas900

Algoritmo (`start` default 0; `i=start`, `total=0`, `matched=false`):
1. **"medio" suelto:** si `words[start]==='medio'` → `{ value:0.5, length:1 }`.
2. **Centenas:** si `HUNDREDS[words[i]]` → `total+=…; i++; matched=true`.
3. **Resto (0-99):**
   - `TEENS[words[i]]` → `r`; `i++`.
   - o `TENS[words[i]]` → `r`; `i++`; si `words[i]==='y'` y `UNITS[words[i+1]]!=null` → `r+=UNIT; i+=2`.
   - o `UNITS[words[i]]` → `r`; `i++`.
   - si hubo resto → `total+=r; matched=true`.
4. si `!matched` → `null`.
5. **Fracción "y medio":** si `words[i]==='y'` y `words[i+1]==='medio'` → `total+=0.5; i+=2`.
6. `return { value: total, length: i-start }`.

Casos compuestos que deben salir: "sesenta y dos"→62; "doscientos veinte"→220; "ciento treinta y
cinco"→135; "veintiuno"→21; "sesenta y dos y medio"→62.5; "cien"→100; "por"→null; "y"→null.

### 2. NUEVO: `src/features/workout/scoreboard/spanishNumbers.test.ts` (vitest, ~14)
Unidades (ocho→8), teens/veinti (quince→15, veinticinco→25), tens (sesenta→60), tens+y+unit
(sesenta y dos→62), centenas (cien→100, doscientos→200), centena+resto (ciento treinta y cinco→135,
doscientos veinte→220), fracción (sesenta y dos y medio→62.5, medio→0.5), null (por, y, kg, ""→[]),
`length` correcto en cada uno, y `start` != 0 (parsear desde media lista, p.ej. `['por','ocho']` con
start 1 → {8,1}).

### 3. `src/features/workout/scoreboard/parseSpokenSet.ts` (integrar el fold)
- Importar `parseSpanishNumberWords`.
- Tras `const tokens = tokenize(normalized);`, plegar palabras-número a tokens `number`:
  ```ts
  // Palabras-número españolas → tokens numéricos, ANTES de los pasos 1-6, para que
  // "sesenta por ocho" recorra el mismo pipeline que "60 por 8".
  function foldSpanishNumbers(tokens: Token[]): Token[] {
    const out: Token[] = [];
    for (let i = 0; i < tokens.length; ) {
      if (tokens[i].kind === 'text') {
        const raws: string[] = [];
        for (let j = i; j < tokens.length && tokens[j].kind === 'text'; j++) raws.push(tokens[j].raw);
        const run = parseSpanishNumberWords(raws, 0);
        if (run) { out.push({ raw: String(run.value), kind: 'number', consumed: false }); i += run.length; continue; }
      }
      out.push(tokens[i]); i++;
    }
    return out;
  }
  const folded = foldSpanishNumbers(tokens);
  ```
  Usar `folded` en lugar de `tokens` en el resto de `parse()`.
- Actualizar la cabecera: quitar "Digits only in this pass…"; anotar que ahora entiende números en
  palabras vía `spanishNumbers.ts` (dígitos y palabras conviven).
- No tocar los pasos 1-6, `UNIT_ALIASES`, `FILLERS`, ni la firma pública `ParsedSet`.

### 4. `src/features/workout/scoreboard/parseSpokenSet.test.ts` (añadir integración, ~8)
- "sesenta por ocho" (fuerza) → `{weight:60, reps:8}`.
- "sesenta y dos por ocho" → `{weight:62, reps:8}`.
- "sesenta y dos y medio por ocho" → `{weight:62.5, reps:8}`.
- "ocho reps" → `{reps:8}`; "cinco km" (resistencia) → `{distance:5}`.
- "rpe ocho" → `rpe:8`.
- mixto dígito+palabra "60 por ocho" → `{weight:60, reps:8}`.
- "doscientos veinte por cinco" → `{weight:220, reps:5}`.
- regresión: los casos con dígitos previos ("62.5 por 8", "60x8") siguen verdes sin cambios.

## Criterios de aceptación
1. `parseSpanishNumberWords` pura, no lanza, ~14 tests verdes; compone tens+y+unit y centenas, entiende
   "y medio", devuelve `length` correcto y `null` para no-números.
2. `parseSpokenSet` entiende números en palabras Y dígitos (y su mezcla), sin regresión en NINGÚN caso
   de dígitos previo; sigue sin lanzar nunca.
3. La fila quick del `SetCorrectionSheet` registra "sesenta y dos por ocho" idéntico a "62.5 por 8"…
   (nota: 62 vs 62.5 — usar los ejemplos exactos de los tests) — commit vía HECHO de BRIEF-01 sin cambios.
4. `npm run typecheck` limpio; `npm test` verde (todo lo previo + nuevos).

## Comandos de verificación
```bash
npm run typecheck && npm test
```
Foco: `npx vitest run src/features/workout/scoreboard/spanishNumbers.test.ts src/features/workout/scoreboard/parseSpokenSet.test.ts`

## Fuera de alcance (NO hacer)
- Grabación de audio / expo-audio / push-to-talk (N7, GATED — nativo). Miles ("mil"), decimales por
  "coma/punto" (fuera; "y medio" cubre el salto de 2.5 kg), números en inglés, multiidioma.
- No tocar el WIP del usuario fuera de los 4 archivos. Sin commit/push/git add. No matar el Metro (8081).
