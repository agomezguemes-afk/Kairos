# STORY-08 — Rehacer Home: todo visible sin scroll NI tap (retirar el acordeón) `[Home]`

**Estado**: MÁXIMA PRIORIDAD — corrige un regreso reportado por Álvaro en vivo.
Developer = opus. 1 ciclo (75-90 min).
**Restricciones**: sin deps · sin nativo · sin commits · no tocar Metro 8081 ·
**NO tocar Blocks/DisciplineFolder ni Canvas/Lienzo**. Cierre:
`npm run typecheck && npm test` verde + `/code-review`.

---

## 0. La corrección (cita de Álvaro, viéndolo en el simulador)

> "veo que has hecho todo muy 'ai made', textos que sobran… has eliminado el
> calendario, no quería que desapareciera todo, sino que todo se pudiera ver en
> ese panel de home sin bajar… se sigue viendo algo cutre."

**Diagnóstico**: el acordeón de HomeFolder (STORY-01/03/04) fue una lectura
equivocada. Esconder el calendario tras un tap se siente como que **desapareció**.
Un scroll normal NO se siente así (nadie dice que Apple Health "esconde" cosas al
hacer scroll — simplemente hay más abajo). El error fue convertir "sigue bajando"
en "toca primero para que exista". **Se revierte la arquitectura de carpeta en
Home.** (En Blocks el acordeón SÍ tiene sentido — carpetas-app es la metáfora
correcta — y Álvaro no se ha quejado: NO se toca.)

---

## 1. Objetivo — el nuevo Home

**Zona SIEMPRE visible (sin scroll, sin tap):**
`HomeHero (compacto)` → `FirstWorkoutCTA` (condicional) → `DayCard` →
`WeekStrip` (semana de 7 días, en vez del MonthGrid completo).

**Zona de scroll NORMAL (debajo, sin tap, aparece al bajar como en Apple Health):**
`ReadinessLine` → `HomeHeroStats` → `KaiSignalCard`.

Presupuesto de pliegue (iPhone 12 Pro, ~560pt útiles): topPad 59 + HomeHero
compacto ~68 + DayCard ~270 + WeekStrip ~70 ≈ **467pt** → **cabe sin scroll**.
En día vacío el HomeHero full (~170) + DayCard-empty (~140) + WeekStrip 70 + 59 ≈
439 → también cabe.

---

## 2. Archivos EXACTOS a tocar

**EDITAR**
1. `src/features/planner/TodayPlanner.tsx` — quitar `HomeFolder` y su teaser;
   renderizar `WeekStrip` en el pliegue y las 3 secciones como scroll normal.
2. `src/features/planner/components/HomeHero.tsx` — pasada de minimalismo de copy
   (§4); confirmar modo compacto (heroMode ya resuelto ahí desde STORY-02).
3. `src/features/planner/components/ReadinessLine.tsx` — **revertir** el
   strip-chrome de STORY-04 (restaurar `marginHorizontal`, `marginTop` editorial,
   `marginBottom` y su regla superior propia `rule`) para que vuelva a leerse como
   sección suelta.
4. `src/features/planner/components/HomeHeroStats.tsx` — **revertir** STORY-04
   (restaurar `paddingHorizontal`/`paddingTop`/`paddingBottom`).
5. `src/features/planner/components/KaiSignal.tsx` — **revertir** STORY-04
   (restaurar su tarjeta warm: `backgroundColor`, `borderRadius`, `marginHorizontal`,
   `marginTop`, paddings).

**BORRAR (código muerto tras retirar la carpeta de Home — verificar con typecheck
que no queda ningún importador antes de cada borrado):**
6. `src/features/planner/components/HomeFolder.tsx`
7. `src/features/planner/lib/foldSummary.ts` + `foldSummary.test.ts`
8. `src/features/planner/lib/folderState.ts` + `folderState.test.ts`
9. `src/store/uiStore.ts` — quitar `homeFolderOpen` + `setHomeFolderOpen` + su
   entrada en `partialize`. **Si `blockFoldersOpen` (STORY-06b) NO existe aún y el
   store queda vacío, borrar el archivo entero** y sus imports. Si `blockFoldersOpen`
   existe, conservar el store solo con esa clave.

**NO tocar**: `DisciplineFolder.tsx`, `blockFolders.*`, `useAccordion.ts` (si
existe), `WeekStrip.tsx` (se usa tal cual), `heroMode.ts` (sigue vivo), `MonthGrid`/
`CalendarView` (quedan sin uso en Home; dejarlos — pueden servir para una vista de
mes futura; no es necesario borrarlos).

---

## 3. Diseño concreto de `TodayPlanner.tsx`

- **Quitar**: import y uso de `HomeFolder`; imports de `foldSummary`/`folderState`;
  el `useMemo` de `weekStats`/`readiness`/`folder` que alimentaba el teaser (las
  hijas ya computan lo suyo — no recalcular en el planner).
- **Estructura del ScrollView** (todo dentro del MISMO ScrollView; el pliegue es
  simplemente "lo que se ve sin arrastrar", no una zona separada):
  ```tsx
  <HomeHero />
  {firstWorkoutBlock ? <FirstWorkoutCTA .../> : null}
  <DayCard .../>
  <WeekStrip selectedDate={selectedDate} onSelect={handleSelectDate} />
  {/* debajo del pliegue — scroll normal, NO tap */}
  <ReadinessLine />
  <HomeHeroStats />
  <KaiSignalCard signal={signal} onAction={handleSignalAction} />
  ```
- `WeekStrip` sustituye a `CalendarView` en el árbol. `handleSelectDate` se
  conserva (al elegir día, `scrollTo({y:0})` sigue trayendo la DayCard arriba).
- Espaciado entre el WeekStrip y la zona de scroll: un respiro (`Spacing.gap.editorial`
  o `marginTop` en ReadinessLine ya restaurado) para que se sienta "hay más abajo".
- El `paddingBottom` inferior (insets.bottom + 172, despeja la barra Kai) se
  mantiene.

**Navegación de mes**: WeekStrip solo muestra la semana de `selectedDate` (sin
prev/next mes). Es aceptable para el pliegue; la navegación de mes queda **diferida**
(posible swipe horizontal del strip en el futuro). NO reintroducir el MonthGrid tras
un tap.

---

## 4. Minimalismo de copy (HIG "Clarity" + Miller 5±1)

Álvaro: "textos que sobran". Recortar en Home lo redundante, sin perder claridad:
- **HomeHero**: evaluar la línea de *momentum* (`phrase`). Si repite o adorna sin
  informar, quitarla o reservarla solo al modo `full` (día vacío). El saludo +
  fecha ya cargan el momento; una tercera línea "motivacional" es candidata a
  sobrar. Decisión del developer con criterio HIG — cuando dude, quitar.
- Revisar labels/eyebrows duplicados o genéricos ("Tu estado hoy", "Esta semana",
  etc.): mantener máximo uno por sección, sin frases de relleno.
- No inventar copy nuevo; el objetivo es **restar**, no añadir.

---

## 5. Criterios de aceptación (verificación visual precisa)

Simulador con el Metro de Álvaro corriendo — NO reiniciarlo:

1. **Al abrir Home NO hay que hacer scroll NI tap** para ver: saludo (compacto) +
   DayCard + tira de semana. El calendario (semana) **está visible de entrada**,
   no detrás de un tap.
2. Bajar con scroll normal revela ReadinessLine → semana (stats) → señal, como
   contenido que "está más abajo" (estilo Apple Health), sin ningún desplegable.
3. Ninguna parte de Home requiere un tap para "aparecer". El componente HomeFolder
   ya no existe en Home.
4. Las 3 secciones de abajo se leen como secciones sueltas bien espaciadas
   (ReadinessLine con su regla, KaiSignal como su tarjeta) — no pegadas ni con
   filete de contenedor sobrante.
5. Tocar un día del WeekStrip actualiza la DayCard y hace scroll arriba.
6. Copy: no hay líneas de texto redundantes/"motivacionales" de relleno en el
   pliegue.
7. **Blocks intacto** (vista Cuadrícula: las carpetas de disciplina siguen igual);
   Lienzo intacto.
8. `npm run typecheck` limpio (sin imports colgando tras los borrados); `npm test`
   verde — **bajará el conteo** al borrar `foldSummary.test`/`folderState.test`
   (esperado; son tests de código eliminado). Documentar el nuevo baseline.

## 6. Tests
No se añaden tests (es reversión de layout + borrado de código). Se **retiran** los
tests de `foldSummary`/`folderState` junto con su código. `heroMode.test` se
conserva (heroMode sigue vivo). La lógica pura que sobrevive (heroMode, y en Blocks
blockFolders) queda verde.

## 7. Riesgo / duración
**Medio-bajo**: es sobre todo reversión (deshacer STORY-01/03/04 en Home) + swap
MonthGrid→WeekStrip + limpieza de código muerto. El cuidado va en (a) no dejar
imports colgando (typecheck lo caza) y (b) el manejo condicional de `uiStore` según
exista o no `blockFoldersOpen`. ~75-90 min. Snapshot en
`docs/autopilot-homeux/snapshots/`. Esta historia CORRIGE STORY-01/03/04; actualizar
el estado de esas en el board a "revertidas en Home".
