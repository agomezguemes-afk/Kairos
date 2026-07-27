# STORY-05b — Extraer `useAccordion` (DRY de HomeFolder + DisciplineFolder) `[refactor]`

**Estado**: LISTA PARA IMPLEMENTAR (developer = opus). ~40-50 min. **Refactor de
calidad, cero cambio de comportamiento.** Sin lógica pura nueva → sin tests
vitest nuevos; el gate es "suite intacta + comportamiento idéntico".
**Restricciones**: sin deps nuevas · sin nativo · sin store · sin commits/git add
· no tocar Metro 8081. Cierre: `npm run typecheck && npm test` verde (874/874
igual) + `/code-review`.

---

## 0. Por qué esta historia (y por qué AHORA, no dentro de STORY-06)

El /code-review de STORY-05 detectó **28 líneas verbatim duplicadas** de la
mecánica de acordeón entre `HomeFolder.tsx` (STORY-01/03/04) y
`DisciplineFolder.tsx` (STORY-05). Ya hay **DOS casos de uso reales** → extraer
deja de ser abstracción prematura y pasa a ser DRY justificado (CLAUDE.md: "tres
líneas parecidas > abstracción prematura" se cumple al revés aquí — son 28 líneas
idénticas en dos sitios). Es un **refactor, no una feature**: por eso NO se
mezcla dentro de STORY-06 (que es trabajo de producto pendiente de validación de
Álvaro) — este cleanup es seguro e independiente del gate de validación, y de paso
deja UNA sola fuente de la mecánica para lo que venga (STORY-06 o un rediseño).

---

## 1. Qué se duplica exactamente

Idéntico en ambos componentes (comparar `HomeFolder.tsx` ~55-136 y
`DisciplineFolder.tsx` ~62-105):
- `reduceMotion = useReducedMotion()`
- `measured = useSharedValue(0)` + `handleInnerLayout` (setea `measured` si `h>0`)
- `progress = useSharedValue(open ? 1 : 0)`
- `useEffect([open, reduceMotion])`: `progress = reduceMotion ? (open?1:0) : withTiming(open?1:0, {duration:240, easing:Easing.out(Easing.cubic)})`
- `containerStyle` (height interpolate 0→measured, CLAMP)
- `contentStyle` (opacity + translateY -8→0, el "rise")
- `chevronStyle` (rotate 0→180)

Lo que **NO** se comparte (se queda en cada componente):
- HomeFolder: todo lo de `uiStore` + `resolveFolderOpen` + el `useEffect` de
  hidratación que **salta** `progress` (cold-start no-flash, STORY-03) + el guard
  `if (!_hasHydrated) return` en `handleToggle`.
- DisciplineFolder: `initialOpen`, `startIndex`, la mini-preview 2×2, el toggle
  simple.

---

## 2. Diseño del hook

**NUEVO** `src/hooks/useAccordion.ts` (crear la carpeta `src/hooks/` — hoy los
hooks están colocalizados por feature, pero este es cross-feature planner+blocks,
así que vive en un hogar compartido neutral).

```ts
// src/hooks/useAccordion.ts
import { useCallback, useEffect } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing, Extrapolation, interpolate, useAnimatedStyle,
  useReducedMotion, useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';

const DEFAULT_DURATION = 240; // dentro de la banda 180-280

export interface Accordion {
  /** Expuesto para que el caller pueda SALTARLO sin animar (p.ej. el restore de
   *  hidratación no-flash de HomeFolder). El uso normal no lo toca. */
  progress: SharedValue<number>;
  /** onLayout del contenido interior (mide el alto natural; re-mide siempre). */
  onContentLayout: (e: LayoutChangeEvent) => void;
  containerStyle: ReturnType<typeof useAnimatedStyle>;
  contentStyle: ReturnType<typeof useAnimatedStyle>;
  chevronStyle: ReturnType<typeof useAnimatedStyle>;
}

export function useAccordion(open: boolean, durationMs = DEFAULT_DURATION): Accordion {
  const reduceMotion = useReducedMotion();
  const measured = useSharedValue(0);
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    progress.value = reduceMotion
      ? (open ? 1 : 0)
      : withTiming(open ? 1 : 0, { duration: durationMs, easing: Easing.out(Easing.cubic) });
  }, [open, reduceMotion, durationMs, progress]);

  const onContentLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) measured.value = h;
  }, [measured]);

  const containerStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [0, measured.value], Extrapolation.CLAMP),
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [-8, 0], Extrapolation.CLAMP) }],
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 180], Extrapolation.CLAMP)}deg` }],
  }));

  return { progress, onContentLayout, containerStyle, contentStyle, chevronStyle };
}
```

Decisión de API: se expone `progress` a propósito (no encapsulado del todo)
porque HomeFolder LO NECESITA para su salto de hidratación instantáneo. No se
mete la lógica de hidratación/persistencia en el hook — eso es específico de Home.
El hook cubre **solo** la mecánica de movimiento compartida.

---

## 3. Cambios en los dos consumidores

### `DisciplineFolder.tsx`
- Borrar `measured`, `progress`, el `useEffect([open,reduceMotion])`,
  `handleInnerLayout`, `containerStyle`, `contentStyle`, `chevronStyle`,
  `reduceMotion`, `OPEN_DURATION` y los imports de reanimated que dejen de usarse
  (`Easing`, `Extrapolation`, `interpolate`, `useAnimatedStyle`, `useReducedMotion`,
  `useSharedValue`, `withTiming` — dejar `Animated`).
- Añadir `const { onContentLayout, containerStyle, contentStyle, chevronStyle } = useAccordion(open);`
- Sustituir `onLayout={handleInnerLayout}` → `onLayout={onContentLayout}`. El
  resto del JSX (tile, mini-grid, chevron, collapsible con
  `accessibilityElementsHidden`) queda igual.

### `HomeFolder.tsx`
- Borrar los mismos locales de mecánica (measured, el effect de `[open]`,
  handleInnerLayout, los tres estilos, OPEN_DURATION, reduceMotion salvo que lo
  use otra cosa).
- Añadir `const { progress, onContentLayout, containerStyle, contentStyle, chevronStyle } = useAccordion(open);`
- **Conservar intacto** el `useEffect([_hasHydrated])` de STORY-03 que hace
  `progress.value = resolved ? 1 : 0` (ahora `progress` viene del hook — funciona
  igual, es el mismo SharedValue) y el guard `_hasHydrated` de `handleToggle`.
- Sustituir `onLayout={handleInnerLayout}` → `onLayout={onContentLayout}`.

---

## 4. Criterios de aceptación (comportamiento idéntico — es un refactor)

**Es un cambio sin diferencia observable.** Verificar que NADA cambió:

1. `npm run typecheck` limpio; `npm test` verde con **el mismo número, 874/874**
   (no se añaden ni quitan tests).
2. **Home** (re-verificación rápida de STORY-01/03/04): abrir/cerrar la carpeta
   anima igual (240ms, rise, chevron); memoria + smart-default + **no-flash** de
   arranque siguen exactos; reduce-motion instantáneo.
3. **Blocks** (re-verificación de STORY-05, vista Cuadrícula): desplegar/colapsar
   una carpeta de disciplina anima igual; reflow OK; reduce-motion instantáneo;
   auto-abrir por highlight OK.
4. Grep de confirmación: la mecánica (withTiming 240 + interpolate height/rise/
   chevron) aparece **una sola vez** en el repo (`src/hooks/useAccordion.ts`); ya
   no en HomeFolder ni DisciplineFolder.
5. `/code-review` sin hallazgos nuevos.

## 5. Por qué NO hay tests vitest
El hook es puramente Reanimated (SharedValues + useAnimatedStyle), no una función
pura de datos → no es unit-testeable en vitest sin runtime RN, y forzarlo sería
artificial. La garantía es "cero cambio de comportamiento", cubierta por la suite
intacta (§4.1) + la re-verificación visual de ambos consumidores (§4.2-3). Los
tests puros del trabajo (foldSummary/heroMode/folderState/blockFolders) siguen
verdes sin tocarse.

## 6. Riesgo / duración
**Riesgo: bajo** (mueve código idéntico a un hook; los dos consumidores quedan más
cortos y legibles). El único cuidado es preservar en HomeFolder el acoplamiento
`progress`↔hidratación (por eso el hook expone `progress`). ~40-50 min con
re-verificación. Snapshot del diff en `docs/autopilot-homeux/snapshots/`.

## 7. Estado del frente Blocks tras esto
STORY-05 (carpetas en grid) + STORY-05b (este cleanup) cierran un incremento
coherente y de bajo riesgo. **STORY-06 (zoom-desde-tile real + carpetas en Lienzo
+ persistencia) queda PARKED** en el backlog, pendiente de la validación visual de
Álvaro sobre el concepto de carpeta-en-grid antes de invertir en la superficie más
compleja (CanvasGrid). No arrancar STORY-06 sin esa señal.
