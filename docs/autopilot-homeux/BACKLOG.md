# BACKLOG — Home UX / "Carpetas" (feat/night-run) — 2026-07-21

PM/UX Strategist. Fuente: auditoría real de `TodayPlanner.tsx` + hijos y
`BlocksScreen.tsx`; `CLAUDE.md` (visión "Apps as activity groups"); night-run
STRATEGY.md; investigación de referentes (Apple Health, Whoop, iOS folders,
Things 3, Notion). Sin commits. Cada historia cierra con
`npm run typecheck && npm test` + `/code-review`.

---

## ⚠️ CORRECCIÓN DE RUMBO (2026-07-23, Álvaro en vivo)

Álvaro revisó en el simulador y corrigió de raíz: la carpeta/acordeón en **Home**
fue un error ("has eliminado el calendario… no quería que desapareciera todo, sino
que todo se pudiera ver sin bajar"; "textos que sobran"; "se ve algo cutre"). Nueva
prioridad **por encima de todo el backlog anterior**:

- **STORY-08 (máxima) — rehacer Home**: retirar HomeFolder de Home; zona siempre
  visible sin scroll ni tap (HomeHero compacto + DayCard + **WeekStrip** en vez de
  MonthGrid); Readiness/Stats/Signal vuelven a **scroll normal**; recorte de copy.
  → CORRIGE/REVIERTE **STORY-01, STORY-03, STORY-04** en Home (el acordeón y su
  código quedan como muertos y se borran). En **Blocks el acordeón se queda** (la
  metáfora carpeta-app es correcta; Álvaro no se quejó).
- **STORY-09 — sistema de botones/interacción**: primitivo canónico `PressableScale`
  (Reanimated + `springs.press` existente), retirar `AnimatedButton` muerto, migrar
  5-8 superficies de más tráfico. Ataca el "cutre".
- **STORY-10 (si da tiempo) — minimalismo de copy** en Blocks/otras superficies.

Reprioridad de lo pendiente de Blocks: **STORY-05b/06a/06b bajan** por debajo de
STORY-08/09 (Home es el regreso urgente). STORY-05 (carpetas en grid) se queda tal
cual — no se toca. Ver STORY-08.md / STORY-09.md / STORY-10.md.

---

## 0. Decisión de arranque: **Home primero, Blocks después**

Con qué pantalla abrir el sprint y por qué, con el marco de cliente final
("¿qué necesita ver en 2 segundos al abrir la app?") + competencia.

### El problema es medible y está en Home
`TodayPlanner.tsx` es un único `ScrollView` que apila 7 secciones. Presupuesto
vertical real en iPhone 12 Pro (390×844, área útil ~763pt entre insets, menos la
barra Kai flotante + cápsula de tabs ≈ 140pt → **pliegue útil ≈ 560pt**):

| Sección | Alto aprox. | Acumulado |
|---|---|---|
| paddingTop (insets.top+12) | ~59 | 59 |
| **HomeHero** (saludo Fraunces 52pt que **envuelve** a 2 líneas con "Álvaro" + eyebrow + phrase) | ~170 | 229 |
| **DayCard** (variante `assigned`: título + pills + preview + CTA + acciones) | ~270 | **499** |
| CalendarView (**MonthGrid** 6 filas × ~50pt + cabeceras) | **~350** | 849 |
| ReadinessLine (gap editorial 40 + regla + titleSmall) | ~120 | 969 |
| HomeHeroStats (numHero 44) | ~90 | 1059 |
| KaiSignalCard | ~76 | 1135 |

HomeHero + DayCard ya consumen **~499pt de ~560pt de pliegue**. Todo lo que va del
calendario hacia abajo **nace bajo el pliegue** — exactamente lo que admite el
comentario de la línea 228 ("Demoted zone — quieter, below the fold"). Alguien ya
bajó la jerarquía visual pero **no resolvió el scroll**. El calendario (MonthGrid,
~350pt) es el mayor devorador vertical de la pantalla y es contenido **secundario**
(planificar OTRO día), no lo que necesitas en 2 segundos.

### Qué necesita el cliente en 2 segundos (marco YC + core-vision)
El corazón declarado de Kairos es el loop `hablar → bloque → entrenar → memoria`.
En Home la pregunta de 2 segundos es una sola: **"¿qué entreno hoy y puedo
empezarlo ya?"** → eso es HomeHero (saludo/momentum) + DayCard (sesión de hoy +
CTA Empezar). El resto es material de **consulta ocasional**: calendario (planificar),
readiness/stats (reflexionar), señal (nudge). Los referentes confirman el patrón:
Apple Health lidera con "Favorites" (lo que marcas como relevante) y esconde el
resto bajo "Show All Health Data"; Whoop pone 3 diales glanceables arriba y usa
**progressive disclosure de 3 niveles** (score → tendencia → deep-dive); Things 3
añadió **áreas colapsables** por petición popular ("no quiero ver el trabajo el fin
de semana"). Nadie mete todo en un scroll plano.

### Por qué Home antes que Blocks
- **Tráfico y palanca**: HomeTab es la primera tab, la que se abre al arrancar.
  Es la superficie de mayor tráfico y el pliegue roto está confirmado y medido.
- **Blocks NO tiene el mismo dolor agudo**: `BlocksScreen` ya usa un layout
  no-scroll-primario (canvas de widgets / grid + FAB); su contenido es una
  *colección* legítima (biblioteca de apps), donde el scroll de una rejilla es
  esperado. Ahí la "carpeta" es una feature **organizativa futura** (agrupar
  bloques en carpetas-app tipo home iOS, la visión literal de CLAUDE.md) — más
  alcance, más riesgo, territorio Sprint 6 (Canvas). Encaja mejor con la metáfora
  literal de "carpeta de apps", pero no es donde sangra el usuario hoy.

**Conclusión:** el sprint abre en **Home** resolviendo el pliegue con una
**"carpeta"** (un desplegable único que colapsa la zona demoted y se abre con
dinámica tipo folder de iOS). Cuando Home esté limpio, se lleva **el mismo
vocabulario de carpeta a Blocks** (agrupar bloques en carpetas-app), que es la
lectura literal de la visión. Home → Blocks, en ese orden, entrega **ambos**.

### El patrón "carpeta" (destilado de la investigación)
- **Gesto**: un toque abre; un toque cierra (tap estándar iOS; sin long-press,
  sin swipe). Affordance de disclosure widget clásico (triángulo/chevron).
- **Cerrada tiene valor**: la carpeta de iOS muestra mini-iconos de lo que
  contiene. Nuestra carpeta cerrada muestra un **teaser de una línea** del dato
  interior más jugoso (p.ej. "Esta semana · 4 sesiones") → el usuario obtiene
  valor sin abrir.
- **Apertura = "zoom/rise"**: el contenido no aparece de golpe; sube a su sitio
  con escala/opacidad como el folder de iOS "zooms" desde el icono. En RN eso es
  altura 0→auto (timing) + un `translateY` de subida + opacidad en el contenido.
- **No es scroll infinito**: cerrada, el pliegue muestra solo lo relevante;
  abierta, el scroll adicional es **opt-in**.

---

## Historias (INVEST, priorizadas)

Prioridad: **P0** = ejecuta la orden directa (lo relevante sin scroll en la
pantalla de mayor tráfico). P1 = completa Home. P2 = lleva la carpeta a Blocks
(visión literal, mayor alcance). P3 = a11y transversal.

### P0 · STORY-01 — El pliegue de Hoy: carpeta para la zona demoted `[Home]`
> Como usuario que abre Kairos, quiero ver de un vistazo **solo lo de hoy**
> (saludo + sesión + CTA) sin hacer scroll, y que lo secundario viva en una
> **carpeta desplegable**, para decidir y empezar mi entreno en 2 segundos sin
> ruido.

- **Arriba del pliegue (siempre, sin scroll)**: HomeHero, FirstWorkoutCTA
  (condicional), DayCard.
- **Dentro de la carpeta (colapsada por defecto)**: CalendarView, ReadinessLine,
  HomeHeroStats, KaiSignalCard.
- **Carpeta cerrada**: handle con eyebrow + teaser de una línea (dato interior
  más útil) + chevron. Toque → expande in-place con dinámica tipo folder iOS.
- **Criterios de aceptación**: ver STORY-01.md (detallado, listo para fable).
- **Pure-core testeable**: `foldSummary()` (qué teaser mostrar en el handle) →
  vitest. El layout/interacción → verificación visual manual precisa.
- Estimación: 1 ciclo (60-90 min). **Sin deps nuevas. Sin nativo. Sin store.**

### P0 · STORY-02 — Saludo que se encoge cuando hay sesión `[Home]`
> Como usuario con una sesión asignada hoy, quiero que el saludo gigante ceda
> protagonismo a mi tarjeta de sesión, para que "Empezar" esté más arriba y el
> pliegue respire.

- El HomeHero (Fraunces 52pt que envuelve a 2 líneas) se lleva ~170pt del
  pliegue. Cuando hay una sesión resuelta para hoy, colapsar el saludo a un modo
  **compacto** (eyebrow de fecha + una línea de momentum, sin el display 52pt) →
  DayCard sube ~90-110pt.
- **Pure-core**: `heroMode(state) → 'full' | 'compact'` (full en día vacío/primer
  uso/onboarding; compact cuando hay sesión asignada o en progreso hoy). vitest.
- **AC**: con sesión asignada hoy, el CTA "Empezar" es visible sin scroll junto a
  STORY-01; en día vacío el saludo vuelve a `full`. Verificación visual + tests
  de la decisión.
- Estimación: 1 ciclo. Sin deps, sin nativo.
- **Depende de STORY-01** (mide el pliegue ya con la carpeta puesta).

### P1 · STORY-03 — Memoria y apertura inteligente de la carpeta `[Home]`
> Como usuario recurrente, quiero que la carpeta recuerde si la dejé abierta, y
> que se abra sola los días sin plan (donde el calendario/asignar ES la acción
> principal), para no repetir el mismo toque cada mañana.

- **Pure-core**: `folderDefaultOpen(inputs) → boolean` (abierta si día sin plan y
  hay bloques que asignar; cerrada si hay sesión lista). vitest.
- Persistencia de estado abierto/cerrado en una slice UI ligera (o
  AsyncStorage-backed en el store existente). Riesgo bajo pero **toca store** →
  va después del P0.
- **Carry-forward de /code-review (STORY-01)**: hoy `HomeFolder` con
  `defaultOpen=true` salta al estado abierto **sin animar** (el `progress`
  arranca en 1). No es alcanzable con el uso actual (siempre monta colapsada),
  pero en cuanto STORY-03 introduzca apertura por defecto / estado recordado hay
  que inicializar `progress` según `defaultOpen` **y** animar la primera
  apertura programática (o aceptar salto solo en el primer render de sesión).
  Resolver aquí explícitamente al implementar `folderDefaultOpen`.
- **AC**: reabrir la app conserva el último estado; día sin plan abre la carpeta
  automáticamente una vez. Tests de la decisión + verificación manual.
- Estimación: 1 ciclo.

### P1 · STORY-04 — La carpeta abierta se lee como UN contenedor `[Home]`
> Como usuario, cuando abro la carpeta quiero que su contenido se lea como **una
> caja abierta** (fondo agrupado, filetes entre Calendario/Estado/Semana/Señal),
> no como tarjetas sueltas apiladas, para que la jerarquía "esto está dentro"
> sea obvia.

- Puro layout: envolver los hijos en un contenedor `paper.warm`/`raised` con
  filetes `hair.subtle` entre secciones (patrón editorial "regla entre cosas, no
  borde alrededor"). Sin lógica extraíble → **AC = verificación visual manual
  precisa** (declarado explícitamente, sin forzar tests artificiales).
- Estimación: 1 ciclo (medio). Depende de STORY-01.

### P2 · STORY-05 — Carpetas-app en Blocks (la visión literal) `[Blocks]`
> Como usuario con muchos bloques, quiero agruparlos en **carpetas por dominio**
> (Fuerza, Running, Movilidad…) como iconos-carpeta en mi Space, que se expanden
> para revelar los bloques dentro, para tener un home limpio tipo iOS en vez de
> una rejilla larga.

- Extraer el desplegable de STORY-01 a un primitivo compartido
  `<Folder>`/`<Disclosure>` (solo cuando exista el 2º caso de uso — evitar
  abstracción prematura). Introducir agrupación por disciplina en canvas/grid.
- **Pure-core**: `groupBlocksIntoFolders(blocks) → Folder[]` (agrupa por
  discipline; solteros quedan como tiles sueltos; orden estable). vitest.
- Mayor alcance (toca `BlocksScreen` + `CanvasGrid`), va **después** de Home.
- Estimación: 2 ciclos.
- **Decisión de alcance (autorizada por Álvaro, ver STORY-05.md)**: NO se extrae
  un `<Folder>` genérico (HomeFolder no encaja — carpeta única/persistida/fila vs
  múltiples/efímeras/tile). Lo compartido es solo la lógica pura
  `groupBlocksIntoFolders`. **STORY-05 (1 ciclo)** = agrupación + carpetas en la
  vista **cuadrícula** con acordeón in-place (canvas intacto, sin store). El resto
  —zoom desde el tile, carpetas en canvas, persistir abiertas— pasa a STORY-06.

### P2.5 · STORY-05b — Extraer `useAccordion` (DRY HomeFolder + DisciplineFolder) `[refactor]`
> Cleanup post-STORY-05: 28 líneas verbatim de la mecánica de acordeón duplicadas
> entre HomeFolder y DisciplineFolder → un hook compartido `src/hooks/useAccordion.ts`.

- Refactor cero-comportamiento, ~40-50 min, sin tests nuevos (gate = 874/874
  intactos + comportamiento idéntico en ambas superficies). Ver STORY-05b.md.
- Seguro e independiente del gate de validación de Álvaro → se puede hacer YA.

### P2 · STORY-06 — "Folder de apps" completo en Blocks — **DIVIDIDA (a/b seguras + c océano)**
> **Decisión de PM (2026-07-22)**: Álvaro autorizó autopilot sobre STORY-06.
> Dividida por riesgo: dos incrementos JS-only seguros sobre las carpetas-en-grid
> que ya ve (06a, 06b) se despachan; la parte de canvas (06c) se flaggea como
> océano que NO cabe en un ciclo. Secuencia: 05b → 06a → 06b (06a y 06b editan
> ambos `DisciplineFolder.tsx` → en serie).

- **STORY-06a — zoom-desde-tile (grid)** `[listo]`: los miembros "salen" de la
  carpeta con pop escalonado (scale 0.85→1 + fade + rise) derivado del `progress`
  del acordeón. Sin store, sin canvas. Ver STORY-06a.md. ~60-75 min.
- **STORY-06b — persistir carpetas abiertas** `[listo]`: `blockFoldersOpen` por
  disciplina en `uiStore` + no-flash (idioma STORY-03) + pure-core
  `resolveBlockFolderOpen` (testeada). Ver STORY-06b.md. ~50-60 min.
- **STORY-06c — carpetas en el Lienzo/canvas** `[OCÉANO — PARKED]`: llevar las
  carpetas a la vista canvas exige que `CanvasGrid` entienda **contención** (una
  carpeta necesita su propia posición/tamaño en el lienzo y los miembros pasan a
  estar "dentro" de ella) → es un rediseño del modelo de datos del canvas
  (absolute-positioning + packing + edit-mode + drag/resize), no un ciclo. **No es
  autopilot-seguro**: un fallo rompe el Lienzo por defecto que Álvaro puede estar
  viendo. Requiere su propia historia con `plan-eng-review` antes de tocar código.
  Recomendación PM: mantener las carpetas en grid; el Lienzo sigue siendo el board
  freeform de widgets individuales. Revisar con Álvaro si de verdad quiere carpetas
  ahí antes de invertir.
> Como usuario, quiero que abrir una carpeta-app haga la animación de "el folder
> de iOS se abre" (escala desde el origen del tile, fondo se difumina), para que
> se sienta nativo y tangible.

- Shared-element/scale desde el origen del tile (Reanimated). Depende de STORY-05.
- Absorbe lo diferido de STORY-05: llevar las carpetas a la vista **Lienzo/canvas**
  (default) como tiles reales, y (opcional) **persistir** qué carpetas quedan
  abiertas (slice UI, mismo idioma que `uiStore`).
- Sin lógica extraíble nueva → AC = verificación visual (curva, origen, duración
  180-280ms, reduce-motion instantáneo).
- Estimación: 1-2 ciclos.

### P3 · STORY-07 — Auditoría a11y del primitivo carpeta `[transversal]`
> Como usuario de VoiceOver / Dynamic Type / reduce-motion, quiero que las
> carpetas sean navegables y legibles, para no quedar fuera de la función nueva.

- Handle como `button` con `accessibilityState.expanded`; hint de "toca para
  mostrar/ocultar"; reduce-motion salta la animación; Dynamic Type no rompe el
  handle. Snapshot en `docs/autopilot-homeux/snapshots/`.
- Sin lógica extraíble → AC = checklist de verificación manual con VoiceOver.
- Estimación: 1 ciclo.

---

## Secuencia recomendada
`STORY-01 → STORY-02` (P0, entregan la orden en Home) → `STORY-03 → STORY-04`
(P1, pulen Home) → `STORY-05 → STORY-06` (P2, carpetas-app en Blocks) →
`STORY-07` (P3, a11y). STORY-01 es la única lista para implementar YA;
`STORY-01.md` la deja llave en mano para fable.

## Fuera de alcance (no tocar)
Modo Sesión / ActiveWorkoutScreen y satélites in-use (ya pulido, night/day run).
Nada de nativo/rebuild. No matar el Metro de Álvaro (8081). Sin deps nuevas.
