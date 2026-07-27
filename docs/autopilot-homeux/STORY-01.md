# STORY-01 — El pliegue de Hoy: carpeta para la zona demoted `[Home]`

**Estado**: LISTA PARA IMPLEMENTAR (developer = fable). 1 ciclo (60-90 min).
**Restricciones**: sin deps nuevas · sin nativo/rebuild · sin store · sin
commits/git add · no tocar Metro 8081. Cierre: `npm run typecheck && npm test`
verde + `/code-review`.

---

## 1. Objetivo

Que Home (`TodayPlanner`) muestre **sin scroll** solo lo de hoy —saludo, sesión,
CTA— y meta lo secundario (calendario, estado, semana, señal) en una **carpeta
desplegable** que se abre con dinámica tipo folder de iOS. Resuelve el pliegue
medido en BACKLOG.md §0: HomeHero + DayCard ya llenan ~499pt de ~560pt de
pliegue; el MonthGrid (~350pt) nace debajo. La carpeta colapsada deja el pliegue
en HomeHero + DayCard + un handle (~64pt) → todo lo relevante cabe; el resto es
apertura opt-in.

**Métrica de éxito**: al abrir Home en iPhone 12 Pro con una sesión asignada
hoy, se ve HomeHero + DayCard + el handle de la carpeta **sin arrastrar**.

---

## 2. Archivos EXACTOS a tocar

**NUEVOS**
1. `src/features/planner/lib/foldSummary.ts` — decisión pura del teaser del handle.
2. `src/features/planner/lib/foldSummary.test.ts` — tests vitest.
3. `src/features/planner/components/HomeFolder.tsx` — el desplegable ("carpeta").

**EDITAR**
4. `src/features/planner/TodayPlanner.tsx` — envolver la zona demoted en
   `<HomeFolder>` y alimentar el teaser.

No tocar ningún hijo (`CalendarView`, `ReadinessLine`, `HomeHeroStats`,
`KaiSignal`) — se re-montan **idénticos** dentro de la carpeta.

---

## 3. Diseño concreto

### 3.1 Reparto arriba-del-pliegue vs carpeta

| Siempre visible (sin scroll) | Dentro de la carpeta (colapsada por defecto) |
|---|---|
| `HomeHero` | `CalendarView` |
| `FirstWorkoutCTA` (condicional) | `ReadinessLine` |
| `DayCard` | `HomeHeroStats` |
| **handle de la carpeta** | `KaiSignalCard` |

El reparto es **estático por rol** (no hay cálculo dinámico de qué sube): lo de
"hoy" arriba, lo de "consulta" dentro. Lo único dinámico es el **teaser** del
handle (§3.3).

### 3.2 `HomeFolder.tsx` — el desplegable

Props:
```ts
interface HomeFolderProps {
  eyebrow: string;      // foldSummary().eyebrow — p.ej. "Esta semana"
  summary: string;      // foldSummary().summary — p.ej. "4 sesiones"
  children: React.ReactNode;
  defaultOpen?: boolean; // default false
}
```

**Estado**: `const [open, setOpen] = useState(defaultOpen ?? false)`. Local, sin
store (la persistencia es STORY-03). `const reduceMotion = useReducedMotion()`.

**Handle (siempre visible)** — un `Pressable` que lee como "caja cerrada", no como
CTA (el oro es solo para Kai):
- Contenedor: `backgroundColor: Colors.paper.warm`, `borderRadius: Radius.lg`,
  `paddingVertical: Spacing.md`, `paddingHorizontal: Spacing.lg`,
  `marginHorizontal: Spacing.screen.horizontal`, `marginTop: Spacing.gap.editorial`
  (40 — separa la narrativa de hoy de la caja de consulta), `flexDirection: 'row'`,
  `alignItems: 'center'`, `gap: Spacing.md`.
- Izquierda (flex:1): eyebrow (`Type.eyebrow`, `Colors.ink.muted`) sobre summary
  (`Type.caption`, `Colors.ink.secondary`, `numberOfLines={1}`).
- Derecha: chevron `Feather name="chevron-down"` size 18 `Colors.ink.tertiary`,
  dentro de un `Animated.View` que rota (§3.4).
- `pressed && { opacity: 0.7 }`.
- A11y: `accessibilityRole="button"`,
  `accessibilityState={{ expanded: open }}`,
  `accessibilityLabel={`${eyebrow}. ${summary}`}`,
  `accessibilityHint={open ? 'Toca para ocultar' : 'Toca para mostrar más'}`.
- `onPress`: `Haptics.selectionAsync().catch(() => {})` (vocabulario iOS de
  folder) + toggle `open`.

**Contenido colapsable** — `children` SIEMPRE montado (para medir su alto y para
que VoiceOver los descubra al expandir), dentro de un wrapper con
`overflow: 'hidden'` cuya altura se anima 0 ↔ altoMedido:
- Medir una vez el alto natural con `onLayout` en un `View` interior:
  `const h = e.nativeEvent.layout.height; if (h > 0) measured.value = h;`
  (guardar en un `useSharedValue(0)` + un flag `useState` para no re-medir en
  cada frame; medir en el layout del inner, no del contenedor animado).
- `progress = useSharedValue(open ? 1 : 0)`. En un `useEffect([open])`:
  `progress.value = reduceMotion ? (open ? 1 : 0)
      : withTiming(open ? 1 : 0, { duration: 240, easing: Easing.out(Easing.cubic) })`.

### 3.3 Teaser del handle — `foldSummary()` (pure-core)

La carpeta cerrada debe tener valor (como el folder de iOS muestra mini-iconos).
El handle muestra el dato interior más útil por prioridad:

```ts
// src/features/planner/lib/foldSummary.ts
export interface FoldSummaryInputs {
  sessionsThisWeek: number;      // computeWeekStats(history).sessionsThisWeek
  readinessCalibrating: boolean; // snapshot.signals.daysSinceLastWorkout === null
  readinessHeadline: string;     // snapshot.headline
}
export interface FoldSummary { eyebrow: string; summary: string; }

export function foldSummary(i: FoldSummaryInputs): FoldSummary {
  // 1) El número del que el usuario está orgulloso (Apple Health / Whoop lideran con el conteo).
  if (i.sessionsThisWeek > 0) {
    const n = i.sessionsThisWeek;
    return { eyebrow: 'Esta semana', summary: `${n} ${n === 1 ? 'sesión' : 'sesiones'}` };
  }
  // 2) Si no hay sesiones aún pero sí lectura de estado, previsualiza el estado.
  if (!i.readinessCalibrating) {
    return { eyebrow: 'Tu estado', summary: i.readinessHeadline };
  }
  // 3) Día 0 — nada que presumir todavía.
  return { eyebrow: 'Más', summary: 'Calendario, estado y semana' };
}
```

Regla: primera coincidencia gana, determinista, sin IO (mismo patrón que
`kaiSignal.ts`). Es intencional que el teaser "Esta semana · N" adelante el dato
de HomeHeroStats: es el **preview** de lo que hay dentro, no una duplicación
completa.

### 3.4 Animación (Reanimated, respetando tokens y reduce-motion)

- **Altura del contenedor** (`useAnimatedStyle`):
  `height: interpolate(progress.value, [0, 1], [0, measured.value])`. Se usa
  **`withTiming` 240ms** (dentro de la banda 180-280) y **no** spring: un
  overshoot de spring sobre un alto de ~350pt (calendario) clipa/salta feo. El
  contenedor lleva `overflow: 'hidden'`.
- **"Rise" tipo folder de iOS** (la vida va aquí, no en la altura): el `View`
  interior lleva su propio `useAnimatedStyle` con
  `opacity: progress.value` y
  `transform: [{ translateY: interpolate(progress.value, [0, 1], [-8, 0]) }]` —
  el contenido sube a su sitio como el folder "zooms" abierto.
- **Chevron**: `transform: [{ rotate: `${interpolate(progress.value,[0,1],[0,180])}deg` }]`.
- **Reduce-motion**: `progress` salta a 0/1 sin `withTiming` (ya cubierto en el
  `useEffect`). Sin translateY perceptible ni rotación animada (el valor final es
  correcto igualmente).
- Duraciones/easing desde el vocabulario existente: 240ms + `Easing.out(Easing.cubic)`
  (mismo easing que ya usa `DayCard`/`KaiSignal`). Imports:
  `Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate, Easing, useReducedMotion } from 'react-native-reanimated'`.

### 3.5 Cambio en `TodayPlanner.tsx`

- Importar `computeWeekStats` (`../../lib/stats/weekStats`), `computeReadiness`
  (`../../lib/readiness/readiness`), `foldSummary` (`./lib/foldSummary`) y
  `HomeFolder` (`./components/HomeFolder`).
- `history` ya está disponible (`useWorkoutStore((s) => s.workoutHistory)`).
  `useMemo` para `weekStats`/`readiness`/`summary`:
  ```ts
  const weekStats = useMemo(() => computeWeekStats(history), [history]);
  const readiness = useMemo(() => computeReadiness(history), [history]);
  const folder = useMemo(() => foldSummary({
    sessionsThisWeek: weekStats.sessionsThisWeek,
    readinessCalibrating: readiness.signals.daysSinceLastWorkout === null,
    readinessHeadline: readiness.headline,
  }), [weekStats, readiness]);
  ```
- Sustituir el bloque demoted (líneas ~228-233, `{/* Demoted zone… */}` con
  `CalendarView`/`ReadinessLine`/`HomeHeroStats`/`KaiSignalCard`) por:
  ```tsx
  <HomeFolder eyebrow={folder.eyebrow} summary={folder.summary}>
    <CalendarView selectedDate={selectedDate} onSelect={handleSelectDate} />
    <ReadinessLine />
    <HomeHeroStats />
    <KaiSignalCard signal={signal} onAction={handleSignalAction} />
  </HomeFolder>
  ```
- **Preservar** `handleSelectDate` (sigue haciendo `scrollTo({ y: 0 })` para
  traer DayCard a la vista cuando eliges día en el calendario ya abierto —
  ahora aún más útil).

---

## 4. Criterios de aceptación

**Verificables por tests (pure-core `foldSummary`)** — ver §5.

**Verificación visual manual precisa** (esta historia es sobre todo layout +
interacción; el resto de AC se comprueba a ojo en el simulador con el Metro de
Álvaro ya corriendo — NO reiniciarlo):

1. Al abrir Home con **sesión asignada hoy**: se ven HomeHero + DayCard + handle
   de la carpeta **sin hacer scroll**. El calendario NO es visible hasta abrir.
2. El handle muestra eyebrow + teaser correcto según estado (con sesiones esta
   semana → "Esta semana · N sesiones"; sin sesiones pero con lectura → "Tu
   estado · <headline>"; día 0 → "Más · Calendario, estado y semana").
3. Toque en el handle → expande en ~240ms: la altura crece suave (sin salto ni
   clip), el contenido **sube** a su sitio con fade, el chevron rota a apuntar
   arriba. Segundo toque → colapsa simétrico.
4. Con el calendario abierto, tocar un día lo selecciona y hace scroll a DayCard
   arriba (comportamiento preservado).
5. **Reduce-motion ON** (Ajustes simulador → Accesibilidad → Movimiento):
   abrir/cerrar es **instantáneo**, sin animación, y el contenido final es
   correcto.
6. **VoiceOver**: el handle se anuncia como botón "contraído/expandido"; al
   expandir, los hijos (calendario, estado…) quedan accesibles en orden.
7. Sin regresiones: DayCard, sheets (Assign/Move/Change/Recurrence/Template) y la
   barra Kai siguen funcionando; `paddingBottom` inferior sigue despejando la
   barra flotante.
8. `npm run typecheck` limpio y `npm test` verde (los 819 de baseline + los
   nuevos de `foldSummary`).

---

## 5. Tests vitest (pure-core)

`src/features/planner/lib/foldSummary.test.ts` — mismo estilo que
`momentum.test.ts` (`import { describe, it, expect } from 'vitest'`). Casos:

1. `sessionsThisWeek: 3` → `{ eyebrow: 'Esta semana', summary: '3 sesiones' }`.
2. `sessionsThisWeek: 1` → summary `'1 sesión'` (**singular**).
3. `sessionsThisWeek: 0, readinessCalibrating: false, readinessHeadline: 'Listo para rendir'`
   → `{ eyebrow: 'Tu estado', summary: 'Listo para rendir' }`.
4. `sessionsThisWeek: 0, readinessCalibrating: true` → fallback
   `{ eyebrow: 'Más', summary: 'Calendario, estado y semana' }`.
5. Prioridad: `sessionsThisWeek: 2` con `readinessCalibrating: false` → gana la
   regla de sesiones (no la de estado).

`HomeFolder.tsx` es JSX + animación → **sin tests unitarios artificiales**; su
correctitud se cubre por la verificación visual §4 (declarado explícitamente,
per instrucción de no forzar tests de layout).

---

## 6. Notas de implementación / trampas

- **Medir alto una vez**: si re-mides en cada `onLayout` y actualizas
  `measured.value` sin guardas, el calendario (que re-renderiza al cambiar de
  mes) puede reintroducir saltos. Guardar con un flag o `Math.max` y solo cuando
  `open` para tener el alto real; alternativa robusta: medir en el layout del
  inner y actualizar `measured.value` siempre pero **solo animar `height` cuando
  `open` es true** (cerrada la altura es 0 fija, sin depender de la medida).
- **No** usar `LayoutAnimation` global ni `Animated.timing` de RN core — el
  proyecto es Reanimated (plugin obligatorio último en babel).
- **No** añadir librerías (`react-native-collapsible`, etc.). El primitivo son
  ~90 líneas; la abstracción compartida con Blocks es STORY-05, no ahora
  (evitar abstracción prematura — CLAUDE.md).
- Gold sigue reservado a Kai: el handle es `paper.warm` + ink, nada de oro.
- Snapshot del diff en `docs/autopilot-homeux/snapshots/` al cerrar (sin commit).
