# STORY-02 — Saludo que se encoge cuando hay sesión `[Home]`

**Estado**: LISTA PARA IMPLEMENTAR (developer = fable). 1 ciclo (60-90 min).
**Depende de**: STORY-01 (carpeta ya en árbol; el pliegue se mide ya con el
handle puesto).
**Restricciones**: sin deps nuevas · sin nativo/rebuild · sin store · sin
commits/git add · no tocar Metro 8081. Cierre: `npm run typecheck && npm test`
verde + `/code-review`.

---

## 1. Objetivo

El HomeHero corre el saludo en `Type.heroDisplay` (Fraunces 52pt, lineHeight 50)
**sin `numberOfLines`**, así que "Buenos días, Álvaro" **envuelve a 2 líneas** y
se lleva ~170pt del pliegue (BACKLOG.md §0). Cuando hay una **sesión asignada o en
progreso HOY**, ese saludo gigante compite con lo único que importa en ese
momento: la DayCard y su CTA "Empezar/Reanudar". Esta historia introduce un modo
**compacto** del saludo para esos estados → la DayCard sube ~90-110pt y el CTA
queda más arriba, más cerca del pulgar, sin scroll.

En día vacío / primer uso / sin bloques / pasado / completado, el saludo se queda
**full** (ahí el saludo SÍ carga el momento y no hay una acción urgente que
compita: es correcto que respire).

**Métrica de éxito**: con sesión asignada hoy, HomeHero compacto + STORY-01 dejan
el CTA "Empezar" de la DayCard visible sin arrastrar en iPhone 12 Pro.

---

## 2. Archivos EXACTOS a tocar

**NUEVOS**
1. `src/features/planner/lib/heroMode.ts` — decisión pura `full | compact`.
2. `src/features/planner/lib/heroMode.test.ts` — tests vitest.

**EDITAR**
3. `src/features/planner/components/HomeHero.tsx` — consumir el modo y renderizar
   la rama compacta.

**No** tocar `TodayPlanner.tsx`: HomeHero es autocontenido y ya lee el store; que
resuelva su propio modo mantiene el saludo desacoplado de `selectedDate` (el
saludo es SIEMPRE de HOY, aunque el calendario esté en otro día).

---

## 3. Diseño concreto

### 3.1 `heroMode.ts` — decisión pura

Reutiliza el enum `DayCardVariant` existente (`../hooks/useDayCardState`). El
saludo se encoge solo cuando hay algo que EMPEZAR hoy:

```ts
// src/features/planner/lib/heroMode.ts
import type { DayCardVariant } from '../hooks/useDayCardState';

export type HeroMode = 'full' | 'compact';

/**
 * El saludo cede protagonismo a la DayCard solo cuando hoy hay una sesión que
 * arrancar o continuar. En cualquier otro estado (día vacío, sin bloques, futuro
 * no aplica al hero de hoy, pasado, completado) el saludo se queda a tamaño
 * completo: ahí carga el momento y no compite con ninguna acción urgente.
 */
export function heroMode(todayVariant: DayCardVariant): HeroMode {
  return todayVariant === 'assigned' || todayVariant === 'in-progress'
    ? 'compact'
    : 'full';
}
```

Nota: `future-assigned` / `future-empty` no pueden darse para HOY (por
definición de `useDayCardState`), pero el enum los incluye; la función los mapea
a `full` por el else, así que es total y seguro sin ramas muertas.

### 3.2 `HomeHero.tsx` — consumir el modo

- Importar `useDayCardState` (`../hooks/useDayCardState`), `todayISO`
  (ya importado desde `../lib/dates`) y `heroMode` (`../lib/heroMode`).
- `const todayState = useDayCardState(todayISO());`
- `const mode = heroMode(todayState.variant);`
- Renderizar dos ramas dentro del mismo `Animated.View` contenedor (mismo
  `accessibilityLabel` en ambas — la etiqueta hablada no cambia con el modo):

**full** (idéntico a hoy): eyebrow (fecha) + greeting `Type.heroDisplay` (sin
`numberOfLines`, envuelve) + phrase `Type.body` `marginTop: Spacing.md`.

**compact**: eyebrow (fecha, igual) + greeting en `Type.titleSmall` (Fraunces
SemiBold 22/28) con `numberOfLines={1}` `maxFontSizeMultiplier={1.3}` + phrase en
`Type.caption` (`Colors.ink.tertiary`) `marginTop: Spacing.xs`. Alto ≈ 14+4+28+4+18
≈ 68pt (vs ~170 full → ahorra ~100pt).
  - En compact el greeting va a UNA línea con `numberOfLines={1}`; a 22pt el
    riesgo de truncar "Buenos días, Álvaro" es mínimo, y si truncara,
    `ellipsizeMode="tail"` es aceptable en modo compacto (el nombre completo vive
    en full; el label de accesibilidad lo dice entero igual).

Mantener `paddingHorizontal: Spacing.screen.horizontal`. `paddingBottom`:
`Spacing.lg` en full (actual); en compact reducir a `Spacing.md` para apretar
aún un poco más sin pegar la DayCard.

### 3.3 Transición entre modos (opcional, bajo riesgo)

El modo se fija al montar y solo cambia si el usuario asigna/empieza una sesión
en la propia pantalla (poco frecuente). Para coherencia con la DayCard —que ya
anima su layout con `LinearTransition`— envolver el contenido del HomeHero en
`Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(220).easing(Easing.out(Easing.cubic))}`
(`useReducedMotion` ya se puede importar; `Easing`/`LinearTransition` de
reanimated). Así, cuando el saludo se encoge tras asignar bloque, colapsa suave
en 220ms (dentro de banda 180-280) en vez de saltar. Si añade complejidad, es
descartable: el core es §3.1 + §3.2.

---

## 4. Criterios de aceptación

**Verificables por tests (`heroMode`)** — ver §5.

**Verificación visual manual precisa** (simulador con el Metro de Álvaro ya
corriendo — NO reiniciarlo):

1. Con **sesión asignada hoy** (variant `assigned`): el saludo aparece en versión
   compacta (una línea, 22pt); junto a STORY-01 el CTA "Empezar" de la DayCard es
   visible **sin scroll**.
2. Con **sesión en progreso hoy** (`in-progress`): saludo compacto igual; "Reanudar"
   visible sin scroll.
3. En **día vacío** (`empty`), **sin bloques** (`no-blocks`), **completado**
   (`completed`) y **primer uso** (history vacío): el saludo vuelve a **full**
   (Fraunces 52pt, envuelve).
4. Al **asignar un bloque a hoy** desde el estado vacío, el saludo se encoge
   (suave si se implementó §3.3; salto aceptable si no) y la DayCard sube.
5. La fecha (eyebrow) y el label de VoiceOver son idénticos en ambos modos; el
   nombre completo se anuncia aunque en compact la línea trunque visualmente.
6. **Reduce-motion ON**: sin animación de transición; el estado final (full o
   compact) es el correcto.
7. Sin regresiones: el fix del bug de truncado del saludo original (full nunca
   trunca el nombre) se mantiene en full.
8. `npm run typecheck` limpio y `npm test` verde (baseline + nuevos de `heroMode`).

---

## 5. Tests vitest (pure-core)

`src/features/planner/lib/heroMode.test.ts` — estilo `momentum.test.ts`
(`import { describe, it, expect } from 'vitest'`). Cubrir los 9 variants:

- `'assigned'` → `'compact'`
- `'in-progress'` → `'compact'`
- `'empty'` → `'full'`
- `'no-blocks'` → `'full'`
- `'completed'` → `'full'`
- `'future-assigned'` → `'full'`
- `'future-empty'` → `'full'`
- `'past-skipped'` → `'full'`
- `'past-empty'` → `'full'`

(Un `it` por caso o un `it.each` sobre la tabla — exhaustivo sobre el enum, sin
ramas muertas.)

`HomeHero.tsx` es JSX (dos ramas de render) → **sin tests unitarios
artificiales**; su correctitud se cubre por la verificación visual §4 (declarado
explícitamente, per instrucción de no forzar tests de layout).

---

## 6. Notas / trampas

- **No** meter la fecha/greeting/phrase en el store ni tocar `TodayPlanner` — el
  hero se autoresuelve. Evita el acoplamiento con `selectedDate`.
- `useDayCardState(todayISO())` añade una suscripción de schedule a HomeHero;
  es barata y ya usada por MonthGrid/DayCard — sin coste perceptible.
- Gold sigue reservado a Kai: ambos modos son ink puro, nada de oro.
- No introducir un tercer modo ni parametrizar tamaños: dos ramas, una decisión.
  (Tres líneas parecidas > abstracción prematura — CLAUDE.md.)
- Snapshot del diff en `docs/autopilot-homeux/snapshots/` al cerrar (sin commit).
