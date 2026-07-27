# BRIEF-12 — Cierre: cobertura del plate solver (el último pure-core sin test)

**Para:** developer opus (fable EXCLUIDO). **Ciclo:** ~30-45 min.
**Sin commits, sin deps nuevas, sin nativo, sin tocar el Metro de Álvaro (8081).**
**Verificación:** `npm run typecheck && npm test`.

## Dictamen — el lago JS/TS del in-training está hervido; esto es el cierre

Tras auditar el estado real: el loop del Modo Sesión está feature-complete Y consolidado (BRIEF-10
`selectCaption` implementado y en uso; sin TODOs abiertos en las superficies in-training; parser con
dígitos + palabras + fix `una/uno`). **No queda valor de FEATURE 100% JS/TS sin inventar relleno.**
El ÚNICO hueco legítimo restante es de cobertura: `solvePlates`/`formatPlateList`
(`src/components/workout/lib/plates.ts`) hace math real que se usa EN PLENA SESIÓN (cargar la barra:
greedy descendente, reparto por lado, `shortBy`, warnings, redondeo) y es el único pure-core del
flujo sin test vitest — solo tiene un harness `plates.dev.ts`. En un repo que testea todos los demás
pure-cores, ese hueco es un riesgo de regresión silenciosa en una herramienta crítica. Este brief lo
cierra; **no toca la fuente, solo añade tests** → riesgo cero.

## Archivo a tocar

### 1. NUEVO: `src/components/workout/lib/plates.test.ts` (vitest)
Testear `solvePlates` y `formatPlateList` contra la firma real:
`solvePlates({ target, bar, inventory? }) → { plates, perSideKg, totalKg, shortBy, warning }`.

Casos (~12):
1. **Exacto simple:** `{target:60, bar:20}` (default kg) → `plates:[{25? no}]`… concretamente perSide=20 →
   `[{size:20,count:1}]`, `perSideKg:20`, `totalKg:60`, `shortBy:0`, `warning:null`.
2. **Greedy multi-disco:** `{target:100, bar:20}` → perSide 40 → `[{25,1},{15,1}]`, total 100, short 0.
3. **Por debajo de la barra:** `{target:15, bar:20}` → `warning:'below-bar'`, `plates:[]`, `totalKg:20`,
   `shortBy:-5`.
4. **Target == barra:** `{target:20, bar:20}` → perSideTarget≈0 → `plates:[]`, `shortBy:0`,
   `warning:null`.
5. **Target impar inalcanzable:** `{target:87.5, bar:20, inventory:{sizes:[25,20,15,10,5]}}` → perSide
   33.75 → `[{25,1},{5,1}]`, no cierra 3.75 → `warning:'odd-target'`, `shortBy≈7.5`.
6. **Cap `maxPerSide`:** `{target:120, bar:20, inventory:{sizes:[25], maxPerSide:{25:1}}}` → solo
   `[{25,1}]` por lado, resto short, `warning:'odd-target'`.
7. **Inventario lb clásico:** `{target:135, bar:45, inventory:DEFAULT_LB_PLATES}` → `[{45,1}]`, total 135.
8. **Redondeo a 1 decimal:** un caso con residuo fraccionado comprueba que `perSideKg/totalKg/shortBy`
   pasan por `round1` (p.ej. sin llegar exacto, `shortBy` con 1 decimal, no ruido flotante).
9. **Orden descendente:** las `plates` salen de mayor a menor aunque `inventory.sizes` venga desordenado
   (`sizes:[5,25,10]`).
10. **`formatPlateList`:** `[]` → `'Sin discos'`; `[{size:25,count:1},{size:2.5,count:2}]` →
    `'1×25 · 2×2.5'` (verifica `stripZero`: 25→"25", 2.5→"2.5").
11. **Barra + epsilon:** `{target: 20.0000001, bar:20}` → tratado como 0 (perSideTarget < 1e-6) →
    `plates:[]`, `warning:null`.
12. **Default kg con discos pequeños cierra impar:** `{target:87.5, bar:20}` (DEFAULT_KG_PLATES tiene
    0.5/1.25/2.5) → cierra exacto (`[{25,1},{5,1},{2.5,1},{1.25,1}]`), `shortBy:0`, `warning:null`.

## Criterios de aceptación
1. `plates.test.ts` cubre exacto, greedy multi-disco, below-bar, target==barra, odd-target, cap
   maxPerSide, inventario lb, redondeo, orden y `formatPlateList`. ~12 tests verdes.
2. **NO se modifica `plates.ts`** (solo se añade el test) → cero regresión.
3. `npm run typecheck` limpio; `npm test` verde (921 previos + nuevos).

## Comandos de verificación
```bash
npm run typecheck && npm test
```
Foco: `npx vitest run src/components/workout/lib/plates.test.ts`

## Observación para Álvaro (no accionar, solo anotar)
El tipo `PlateSolution['warning']` declara `'short'` pero `solvePlates` nunca lo emite (usa
`'odd-target'` para "no llega"). Es un valor muerto del union, no un bug. Si algún día se quiere
distinguir "corto por poco" de "target imposible de partir", ahí está el gancho. Dejar como está salvo
que Álvaro lo pida.

## Fuera de alcance (NO hacer)
- Cambiar la lógica de `solvePlates`/`formatPlateList`. Voz/nativo/watch (GATED). Números en inglés.
- No tocar el WIP del usuario fuera del archivo nuevo de test. Sin commit/push/git add. No matar el Metro.
