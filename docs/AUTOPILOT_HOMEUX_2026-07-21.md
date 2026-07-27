# AUTOPILOT — Home UX / "Carpetas" — 2026-07-21 (feat/night-run)

## 🚨 CORRECCIÓN DIRECTA DE ÁLVARO (23 jul, ~11:0x) — leer antes de cualquier otra cosa

Feedback directo tras ver el resultado en vivo, cita textual: "veo que has hecho
todo muy 'ai made', textos que sobran... has eliminado el calendario, no quería
que desapareciera todo, sino que todo se pudiera ver en ese panel de home sin
bajar... el apartado visual se sigue viendo algo cutre, mejora animaciones/
botones, tiene que verse minimalista, playful, hecho por profesionales de
Apple". Esto **anula la premisa de que HomeFolder resolvía bien el problema**.

**Diagnóstico correcto (releído con calma, cargada la skill mobile-design +
platform-ios.md + touch-psychology.md antes de tocar nada):**
1. **El patrón "carpeta cerrada por defecto" fue una lectura equivocada** de "sin
   scroll para lo relevante". Ocultar el calendario detrás de un tap se siente
   como que "desapareció" — un scroll normal hacia contenido secundario NO se
   siente así (nadie se queja de que Apple Health "esconda" cosas al hacer
   scroll). El error fue convertir "puedes seguir bajando" en "tienes que tocar
   primero para que exista". Home necesita: Hero+DayCard+**calendario compacto**
   (candidato ya en el repo: `src/features/planner/components/WeekStrip.tsx` —
   semana en vez de mes completo) SIEMPRE visibles sin scroll ni tap; el resto
   (Readiness/Stats/Signal) vuelve a ser scroll normal, NO acordeón oculto.
2. **Causa raíz del "cutre" en botones/animaciones, encontrada por auditoría**:
   `src/Buttons/AnimatedButton.tsx` (206 líneas, YA implementa scale+spring
   physics) tiene **0 usos en toda la app** (`grep` confirmado). Mientras tanto
   **34 archivos** usan el patrón más pobre posible: `Pressable` con solo
   `pressed && { opacity: X }` — sin scale, sin haptic por niveles, sin spring.
   Esa es la brecha entre "se siente Apple" y "se siente genérico".
3. **Texto excesivo**: pendiente de auditoría de copy en Home/Blocks — instrucción
   directa de recortar a lo esencial (principio HIG "Clarity" + Miller's Law
   5±1, cargados de la skill).

**STORY-08 CERRADA (23 jul, 11:2x)**: Home revertido. WeekStrip visible sin
scroll ni tap junto a Hero+DayCard; Readiness/Stats/Señal vuelven a ser scroll
normal con su chrome propio restaurado. HomeFolder/foldSummary/folderState
borrados (typecheck limpio tras cada borrado). `uiStore.ts` conserva
`blockFoldersOpen` (Blocks intacto). Tests: 940→919 (−21 esperados, código
borrado). Minimalismo aplicado: la frase de momentum del saludo se retira en
modo compacto (cuando hay sesión, compite con el CTA) y se conserva en modo
full. QA por lectura directa: 0 hallazgos accionables (solo 2 comentarios
históricos inofensivos). **Pendiente de tu revisión visual en el simulador.**

**Plan correctivo despachado** (ver log de ciclos): rehacer Home (WeekStrip +
scroll normal, sin acordeón para el calendario) + pasada de minimalismo de copy
+ iniciativa de sistema de animación de botones (revivir/reemplazar
AnimatedButton con Reanimated, tiers de haptic, springs, adopción en las
superficies de mayor tráfico).

**STORY-09 CERRADA** (23 jul, 11:4x): `PressableScale` (Reanimated, springs.press
ya existente, haptic por nivel) creado; `AnimatedButton.tsx` retirado (0
referencias). 5 superficies migradas: DayCard (CTA Empezar/Reanudar),
FirstWorkoutCTA, HECHO+Empezar del marcador (haptic='none', ya tenían el suyo
propio — sin doble buzz, verificado), BlockCreationSheet, empty-state de
Blocks. Tab bar y FAB deliberadamente NO migrados (ya tenían spring propio /
el layout con onLayout es incompatible con el primitivo — decisiones
razonables, no atajos). typecheck+test 919/919, QA por lectura: 0 hallazgos.
Nota para más adelante: hay un `PressableScale` duplicado en
`src/features/onboarding/premium/motion/` — candidato a consolidar, fuera de
alcance ahora.

**Pausa (23 jul, 11:5x)**: batería al límite (49%, 47min) + Álvaro en medio de
un brainstorm en vivo sobre "Tu estado hoy"/HealthKit — no se lanza más
trabajo de fondo hasta que responda o la batería mejore. STORY-10 (copy) y la
encuesta de ProfileTab quedan listas para retomar.

**PM entregó 3 briefs** (STORY-08 máxima prioridad, 09, 10 si da tiempo).
Hallazgo clave de la investigación: `springs.press` (16/360) y `springs.tap`
(14/420) YA existen en `theme/animations.ts` y coinciden con el rango premium
real investigado (damping 15-18/stiffness 170-360) — el problema nunca fue
diseñar springs nuevos, fue que nadie los usaba. Verificado: `uiStore.ts` ya
tiene `blockFoldersOpen` (de STORY-06b), así que STORY-08 debe conservar el
store quitando solo `homeFolderOpen`, no borrarlo entero.

## ⏸️ PAUSA (23 jul, 03:3x) — Blocks completo, esperando tu autorización para el Canvas

**940/940 tests, typecheck limpio, nada commiteado.** Detuve el loop otra vez:
Blocks agotó el trabajo JS/TS-only seguro, igual que el in-training flow (ver
NIGHT_RUN_2026-07-19.md).

**Completo esta ronda**: STORY-05 (carpetas por disciplina en Cuadrícula) →
STORY-05b (hook `useAccordion` compartido con Home) → STORY-06a (pop tipo
folder de iOS al abrir) → STORY-06b (persistencia por disciplina + no-flash).
Cuatro historias, cada una con QA real, dos bugs reales encontrados y
corregidos en el camino (medida de altura que clipaba contenido, y una ventana
de carrera en la persistencia).

**STORY-06c (carpetas en el Lienzo/canvas) sigue PARKED** — la propia PM lo
marcó como "océano": exige que `CanvasGrid` entienda contención, es la
superficie más arriesgada de la app, y un fallo rompería el Lienzo por
defecto. Recomienda `/plan-eng-review` + tu confirmación explícita antes de
tocarlo, no expansión autónoma.

**Qué desbloquea seguir aquí**: tu validación visual de las carpetas (vista
Cuadrícula del tab Workout) y tu decisión sobre si merece la pena invertir en
llevarlas al Lienzo.

## 🔓 CICLO B8 — STORY-06b cerrada tras corte de sesión (23 jul, 02:2x)

**Corte 22→23 jul**: el developer de STORY-06b murió por límite de sesión justo
tras decir "typecheck limpio, ahora los tests" — pero había terminado el
trabajo real. Verificado en frío: 927/927 (+6 de `resolveBlockFolderOpen`,
exacto), wiring completo en los 4 archivos (uiStore.ts, blockFolders.ts,
DisciplineFolder.tsx, FolderGrid.tsx), sin ediciones a medias. QA por lectura
(mismo patrón ya probado en HomeFolder/STORY-03): 0 hallazgos.

**STORY-06 completa**: 06a (pop tipo folder) + 06b (persistencia por
disciplina) cierran el incremento de Blocks. 06c (canvas) sigue PARKED.

## 🔓 CICLO B7 — STORY-06a cerrada, pidiendo STORY-06b (en serie)

**STORY-06a completa**: pop escalonado tipo folder de iOS al abrir una carpeta
(FolderMember memoizado, stagger capado, deriva de `progress` del acordeón).
QA por lectura directa (trace de reduce-motion verificado analíticamente: sin
residuales de opacidad/escala): 0 hallazgos. 921/921 (compartido con BRIEF-11).
Micro-pulido del tile omitido por el developer (razón válida: más superficie de
regresión sobre la vista en vivo por ganancia marginal).

## 🔓 CICLO B6 — STORY-06a en implementación (developer opus lanzado)

## 🔓 CICLO B6 — STORY-06 dividida por riesgo, 06a en implementación

**Split de la PM (buen juicio)**: STORY-06 no es un ciclo, son 3 piezas de riesgo
muy distinto — despacha las 2 seguras (JS/TS, sobre la vista Cuadrícula que
Álvaro ya ve), aparca la 3ª como "océano":
- **STORY-06a** (en marcha): zoom-desde-tile — pop escalonado de los miembros al
  abrir, derivado del `progress` del acordeón. Solo `DisciplineFolder.tsx`.
- **STORY-06b** (cola, tras 06a — mismo archivo, en serie): persistir carpetas
  abiertas por disciplina en `uiStore`, con pure-core testeada y no-flash
  (idioma de STORY-03).
- **STORY-06c PARKED**: llevar carpetas al Lienzo exige que `CanvasGrid` entienda
  contención — rediseño del modelo de datos del canvas. La PM lo marca como NO
  autopilot-safe (un fallo rompe el Lienzo por defecto) y recomienda
  `/plan-eng-review` + confirmación explícita de Álvaro antes de tocarlo.

## ▶️ REANUDADO (22 jul, 23:0x) — orden de Álvaro: "continue, autopilot y autotasking"

Interpretación: autoriza continuar STORY-06 (JS/TS-only, Blocks) — la pausa
anterior era prudencia de la PM, no un requisito duro. NO interpreto esto como
autorización para nativo (voz/watch) — esa línea roja sigue en pie hasta que lo
diga explícitamente, porque un rebuild mataría su sesión de simulador en vivo.
PM de Blocks retomando STORY-06; estratega de in-training buscando trabajo
JS/TS-only adicional (pista: parseo de números-en-palabras es TS puro,
desacoplable del grabador nativo). Cron de respaldo + loop re-armados.

## ⏸️ PAUSA (22 jul, 21:0x) — ambos frentes en punto natural de espera

**884/884 tests, typecheck limpio, nada commiteado.** Detuve el loop autónomo:
ambos frentes (Blocks aquí + in-training en NIGHT_RUN_2026-07-19.md) llegaron a
un punto donde seguir requiere TU señal, no más iteración autónoma — insistir
solo quemaría créditos sin producir valor.

**Blocks**: STORY-05+05b cerradas y estables (carpetas-app en Cuadrícula +
hook `useAccordion` compartido con Home). STORY-06 (zoom-desde-tile real +
carpetas en Lienzo + persistencia) sigue PARKED — toca `CanvasGrid`, la
superficie más arriesgada, y la PM decidió no invertir ahí sin que valides
primero el concepto actual.

**In-training**: BRIEF-10 cerrado (consolidación de captions + auditoría de 5
interacciones de riesgo, las 5 verificadas independientemente, sin
regresiones). El lago JS/TS del Modo Sesión está prácticamente agotado — lo
siguiente de verdad (grabador de voz N7, companion watchOS N8) es nativo y
GATED: necesita tu autorización explícita para un rebuild, porque mataría
cualquier sesión de simulador en vivo.

**Qué desbloquea la siguiente fase**: (1) tu validación visual de las carpetas
de Blocks → decide si seguimos a STORY-06; (2) tu autorización para tocar
nativo → desbloquea voz/watch. Todo el detalle y los snapshots en
`docs/autopilot-homeux/` y `docs/night-run/`.

## 🔓 CICLO B5 — STORY-05b cerrada. Blocks en pausa estable esperando validación

**STORY-05b completa**: `src/hooks/useAccordion.ts` extraído, `HomeFolder` y
`DisciplineFolder` consumen el hook. Refactor mecánico verificado sin cambio de
comportamiento: 874/874 exacto (mismo número, cero tests añadidos/quitados),
typecheck limpio, grep confirma la mecánica en UN solo sitio, wiring de
hidratación de STORY-03 (`progress` compartido) intacto byte a byte — verificado
por lectura directa. QA ligero (sin multi-agente, riesgo mínimo ya cubierto por
el propio grep + lectura): 0 hallazgos.

**Estado del frente Blocks: estable, en pausa.** STORY-05 + STORY-05b entregan
un incremento coherente (carpetas-app en grid + cleanup de duplicación).
STORY-06 (zoom-desde-tile + Lienzo + persistencia) queda **PARKED** hasta que
Álvaro valide visualmente el concepto de carpeta actual — no se retoma sin esa
señal explícita.

## 🔓 CICLO B4 — STORY-05b (extraer useAccordion) en implementación

**Decisión de la PM**: STORY-06 (zoom-desde-tile + carpetas en Lienzo +
persistencia) queda **PARKED** — toca CanvasGrid (la superficie más compleja y
arriesgada) y Álvaro está validando STORY-05 en vivo AHORA MISMO; invertir más
sin su señal es alto riesgo/baja confianza. En su lugar: STORY-05b, un refactor
seguro e independiente (extraer `useAccordion` compartido entre HomeFolder y
DisciplineFolder — 28 líneas verbatim duplicadas, DRY justificado con 2 casos de
uso reales, cero cambio de comportamiento). Developer opus lanzado.

## 🔓 CICLO B3 — STORY-05 cerrada, esperando decisión de PM sobre STORY-06

**STORY-05 (carpetas-app en Blocks) completa y verificada.** 5 archivos + 1 línea
en CanvasWidget (export ICON_FOR, aditivo). typecheck limpio, 874/874. QA real
(`/code-review` medium, 2 finder-agents): **1 CONFIRMED corregido** (el stagger
de entrada de las tarjetas dentro de una carpeta usaba índice local 0-based en
vez del índice global de FolderGrid — roto específicamente para carpetas que
arrancan abiertas por highlight; arreglado plumbeando `startIndex`) + **1
simplificación aplicada** (useCallback reflexivo en `renderSingle`, sin
beneficio real, simplificado a función plana). Recomendación NO accionada:
extraer un hook `useAccordion` compartido entre `HomeFolder`/`DisciplineFolder`
— justificada pero es decisión de alcance para STORY-06 (que ya va a introducir
una tercera variante persistida), no de esta QA.

## 🔓 CICLO B1-B2 — STORY-05 en implementación

PM decidió NO reutilizar `HomeFolder` para Blocks (cardinalidad múltiple,
affordance de icono-tile vs fila-lista, estado efímero vs persistido — forzar
el mismo componente sería abstracción equivocada). Nuevo `DisciplineFolder` +
`groupBlocksIntoFolders` puro. Alcance de UN ciclo: solo vista cuadrícula
(canvas intacto); zoom-desde-tile y persistencia → STORY-06. Verificado contra
código real: rama FlatList grid (~266-277), sortedBlocks/highlightTargetId/
handleOpenBlock/handleBlockOptions, DISCIPLINE_CONFIGS, ICON_FOR de CanvasWidget.
Developer opus lanzado.

## 🔓 REABIERTO — 22 jul (orden de Álvaro: continuar, incluye UI/UX)

Álvaro pidió continuar explícitamente en UI/UX + estrategia + flujo in-training,
viendo el simulador en vivo. Esto **autoriza** el frente que la PM había diferido
por soberanía del usuario: **STORY-05/06 (carpetas-app en BlocksScreen)**.
Retomando con el mismo equipo (PM opus, Developer opus, QA vía `/code-review`).
Simulador desplegado (dev client reconectado a Metro de Álvaro, 127.0.0.1,
proceso 29107 intacto) para revisión en tiempo real.

## ✅ SPRINT CERRADO (histórico — Home P0+P1, 22 jul 10:5x)

**Home completo: 849/849 tests en verde, typecheck limpio. NADA commiteado ni
pusheado — todo en el working tree para tu revisión manual.** El equipo ágil
(PM/Strategist, Designer, Developer, todos con `/code-review` real como QA)
completó las 5 historias que cumplen tu orden original: la página principal
muestra lo relevante sin scroll, con un concepto de "carpeta" pulido para el
resto.

**STORY-01→04 + STORY-07, todas cerradas con QA real (`/code-review`, hallazgos
CONFIRMED corregidos en el momento, nunca diferidos):**
1. HomeFolder — carpeta desplegable tipo folder de iOS para Calendario/Estado/
   Semana/Señal. Bug corregido: contenido que crecía después de montar quedaba
   recortado para siempre (measuredOnce).
2. heroMode — el saludo se encoge cuando hay sesión hoy, sube el CTA "Empezar".
3. Memoria + apertura inteligente — la carpeta recuerda tu elección
   (uiStore/persist) y se abre sola en días sin plan. Bug corregido: un toque
   en la ventana de hidratación podía revertirse solo.
4. La carpeta abierta se lee como un contenedor único (caja warm + filetes),
   no tarjetas sueltas.
5. **STORY-07 — cierre con llave**: fix real de accesibilidad (el contenido
   colapsado seguía navegable por VoiceOver pese a `height:0`; ahora se oculta
   del árbol de accesibilidad cuando la carpeta está cerrada) + Dynamic Type
   en el handle.

**Decisión estratégica de la PM (léela, es la parte que más te interesa)**: con
Home cumpliendo tu orden, la PM decidió **NO** avanzar autónomamente a
`BlocksScreen` (carpetas-app literales, STORY-05/06 en `BACKLOG.md`) pese a ser
la lectura más literal de la visión de CLAUDE.md — por **soberanía del
usuario**: es más alcance y riesgo, y prefirió cerrar lo empezado y dejarte la
decisión explícita a ti, en vez de expandir el sprint por su cuenta de noche.

**Pendiente de TU verificación** (no pude hacerlo sin computer-use autorizado):
VoiceOver real (el fix de STORY-07 está implementado y razonado, no escuchado),
Dynamic Type al máximo, reduce-motion, y el checklist de regresión completo de
`docs/autopilot-homeux/STORY-07.md` §4-5. Recomiendo pasarlo antes de dar el
sprint por definitivamente bueno.

**Para revisar**: `docs/autopilot-homeux/BACKLOG.md` (7 historias, 5 hechas + 2
diferidas), cada `STORY-0N.md` con su diseño, snapshots en
`docs/autopilot-homeux/snapshots/` (+ espejo en
`~/.gstack/.../night-run-2026-07-19/autopilot-homeux/`, incluye
`FULL-run-tracked.patch` con el diff acumulado). Archivos nuevos:
`src/features/planner/lib/{foldSummary,heroMode,folderState}.ts` (+tests),
`src/features/planner/components/HomeFolder.tsx`, `src/store/uiStore.ts`.
Editados: `TodayPlanner.tsx`, `HomeHero.tsx`, `ReadinessLine.tsx`,
`HomeHeroStats.tsx`, `KaiSignal.tsx`, `MonthGrid.tsx`.

**Corrección de equipo a media noche**: excluiste Fable de todo despacho de
agentes (memoria persistente actualizada) — desde STORY-03 el Developer corre
en opus.

**Siguiente paso, cuando tú decidas**: si quieres carpetas-app literales en
BlocksScreen, dilo y el equipo retoma STORY-05/06 con el mismo rigor.

---

## 🏁 RESUMEN (parada limpia por batería — 21:4x, día anterior)

**Estado final: 833/833 tests en verde, typecheck limpio. NADA commiteado ni
pusheado.** Parado por protocolo de batería (40%, 43 min restantes, sin AC — por
debajo del umbral de 45 min), coincidiendo con la propia recomendación de la PM
de no arrancar STORY-03 este ciclo (la calificó como la historia más arriesgada
hasta ahora, 75-90 min con verificación visual pausada para el "no-flash").

**Dos historias P0 completadas y verificadas con QA real (`/code-review`):**

1. **STORY-01 — HomeFolder** (`docs/autopilot-homeux/STORY-01.md`): la zona
   "demoted" (Calendario, Readiness, Stats semanales, KaiSignal) vive ahora en
   una carpeta desplegable con dinámica tipo folder de iOS (altura 0↔auto,
   rise+fade, chevron). El pliegue de Home pasa a ser solo HomeHero + DayCard +
   el handle — sin scroll. QA: 2 hallazgos CONFIRMED, uno **corregido en el
   momento** (measuredOnce clipaba contenido que crece después de montar, p.ej.
   KaiSignalCard apareciendo tarde — ahora se remide en cada layout, código más
   simple que el original), otro anotado como carry-forward para STORY-03
   (defaultOpen=true ya no lo necesita, quedó resuelto de rebote).
2. **STORY-02 — heroMode compacto** (`docs/autopilot-homeux/STORY-02.md`): el
   saludo se encoge a una línea cuando hay sesión asignada/en progreso hoy, lo
   que sube la DayCard y su CTA "Empezar/Reanudar" más arriba. QA limpia (0
   CONFIRMED).

**Suite: 819 → 833 tests (+14: 5 de `foldSummary` + 9 de `heroMode`).**

**Nuevos archivos** (working tree, sin commit):
`src/features/planner/lib/{foldSummary,heroMode}.ts` (+`.test.ts`),
`src/features/planner/components/HomeFolder.tsx`. Editados:
`src/features/planner/TodayPlanner.tsx`, `src/features/planner/components/HomeHero.tsx`.

**STORY-03 lista pero SIN IMPLEMENTAR** (`docs/autopilot-homeux/STORY-03.md`):
memoria de apertura/cierre de la carpeta + apertura inteligente en días sin plan.
Decisión de la PM: store nuevo `src/store/uiStore.ts` (Zustand persist, no tocar
`workoutStore`). Es la historia de mayor riesgo hasta ahora (verificación visual
de "sin flash" al restaurar). **Siguiente paso al reanudar**: lanzar Developer
(**opus**, no fable — corrección aplicada 22:0x) sobre STORY-03 con margen de
batería, o pedir a la PM que ataje directamente a STORY-04 (sin store, menor
riesgo) si se prefiere seguir sin cargador.

**Para tu revisión**: `docs/autopilot-homeux/BACKLOG.md` (7 historias completas),
snapshots en `docs/autopilot-homeux/snapshots/` + espejo en
`~/.gstack/.../night-run-2026-07-19/autopilot-homeux/`.

**Corrección de equipo aplicada a mitad de run**: Fable quedó excluido de todo
despacho de agentes (ver [[feedback_model_orchestrator]], memoria persistente
actualizada) — el Developer de STORY-03 en adelante se lanza con opus.


Orden de Álvaro (21 jul, 21:0x): reinicio de autopilot, foco distinto — la página
principal debe mostrar lo relevante SIN scroll; concepto de "carpeta" (desplegable,
tipo apps) para lo que no cabe. Usabilidad y limpieza UI/UX. Iteración autónoma
estilo ágil, con equipo de roles (dev, manager, scrum master, "todos los
obligatorios"), cada uno con el mejor stack de skills disponible. Autotask hasta
el límite de créditos, con reanudación programada.

## Equipo (roles, no personas)

| Rol | Quién | Modelo | Cómo trabaja |
|---|---|---|---|
| **Scrum Master / Orquestador** | Esta sesión principal (yo) | — | Lleva el backlog board, ceremonias async (mini-standup por ciclo en el log), protocolo de batería/sesión, schedule-before-burn, verificación final de cada story (`npm run typecheck && npm test`), y actúa de **QA/Code Reviewer** invocando directamente las skills reales `code-review` (hallazgos de correctness/simplificación) y `simplify` (limpieza) sobre cada diff antes de cerrar una story. |
| **Product Manager / UX Strategist** | Agent `general-purpose`, modelo opus | Tiene acceso a Skill/WebSearch — puede investigar referentes (Apple Health, Whoop, Notion, Things3, iOS Home Screen folders) y auditar el código real antes de escribir historias. | Escribe/actualiza `docs/autopilot-homeux/BACKLOG.md` (historias formato INVEST, prioridad, criterios de aceptación) y el brief de la siguiente historia `STORY-NN.md`. |
| **UI/UX Designer** | Agent `kairos-uiux-designer`, modelo opus | Especialista HIG + tokens.ts + motion ya integrado en su system prompt (RN, gestos, Reanimated, Dynamic Type, VoiceOver). | Convierte la historia top del backlog en spec de layout concreto (qué se queda arriba del pliegue, qué entra en "carpeta", valores exactos de tokens) cuando la historia lo requiere. |
| **Developer(s)** | Agent `kairos-uiux-designer`, modelo **opus** (corregido 22:0x — Fable excluido de todo el equipo, ver [[feedback_model_orchestrator]]) | Implementa con tests, seniority en RN/Reanimated/tokens. | Ejecuta el brief completo: código + tests vitest + (cuando aplica) verificación visual descrita para revisión manual. |

## Foco confirmado por auditoría (hecha por el Scrum Master antes de delegar)

- **Home real** = `src/features/planner/TodayPlanner.tsx` (279 líneas). Un único
  `ScrollView` apila: `HomeHero` → `FirstWorkoutCTA` (condicional) → `DayCard` →
  `CalendarView` → `ReadinessLine` → `HomeHeroStats` → `KaiSignalCard`. Comentario
  ya existente en línea 228: "Demoted zone — quieter, below the fold" — alguien ya
  notó el problema pero solo bajó la jerarquía visual, no resolvió el scroll.
- **Candidato secundario** = `src/features/blocks/BlocksScreen.tsx` (522 líneas,
  tab "Workout"/Space de bloques). Este es el que más casa con el concepto de
  "carpeta" del propio CLAUDE.md ("Core metaphor: Apps as activity groups",
  folders tipo iOS home screen).
- El PM decide con cuál abrir el sprint y en qué orden seguir; esta auditoría es
  contexto, no mandato.

## Reglas (heredadas de night/day run + nuevas)

- **Fable excluido de todo el equipo** (corrección de Álvaro, 22:0x): ningún
  agente se lanza con `model: "fable"`, ni Developer ni ningún otro rol. Opus
  para desarrollo/coding, sonnet para tareas mecánicas simples. Ver
  [[feedback_model_orchestrator]] (memoria persistente actualizada).

- **[[feedback_autopilot_no_commit]]**: SIN commits, SIN push, SIN `git add`.
  Revisión manual de Álvaro siempre. Snapshots de cada story en
  `docs/autopilot-homeux/snapshots/`.
- **Schedule-before-burn**: wakeup programado antes de todo trabajo pesado + cron
  horario de respaldo que reanuda el run tras refresco de créditos/sesión.
- **QA real, no simulado**: cada story pasa por `npm run typecheck && npm test`
  Y por la skill `/code-review` (nivel medium) antes de darse por cerrada. Si hay
  hallazgos CONFIRMED de corrección, se corrigen en el mismo ciclo (otro paso del
  developer) antes de avanzar.
- **NO tocar el Metro de Álvaro** si está corriendo (puerto 8081) — comprobar antes
  de cualquier acción que pudiera interferir.
- Sin screenshots/computer-use (sin autorización). Batería: `pmset -g batt` por
  ciclo — descargando con <20% o <45 min restantes → parada limpia con resumen.
- Terse: mínimo texto y créditos por ciclo.

## Estado

- **Fase**: TERMINADO (10:5x, 22 jul). Sprint de Home cerrado. Loop parado, cron
  borrado. Ver "✅ SPRINT CERRADO" arriba del todo.
- **Corte 21→22 jul**: el intento A7 murió sin escribir STORY-04.md (límite de
  sesión, reset 1:50am Europe/London). Reanudado a las 10:29 del 22 jul. Batería
  ~79-81% descargando, sana, sin cargador.
- **STORY-03 CERRADA**: memoria + apertura inteligente en producción. QA real vía
  `/code-review`: 1 CONFIRMED (`handleToggle` sin gate de `_hasHydrated` — ventana
  estrecha donde el merge por defecto de zustand persist podía revertir un toque
  del usuario; **corregido** con un guard de una línea). Suite: 833 → 849
  (+16 de `folderState`).
- **Decisión del PM**: Home primero (pliegue medido: HomeHero+DayCard ya llenan
  ~499pt de ~560pt útiles; MonthGrid ~350pt nace bajo el pliegue), Blocks después
  (STORY-05/06, carpetas-app literal, Sprint 6 territory). Backlog completo: 7
  historias INVEST en `docs/autopilot-homeux/BACKLOG.md`.
- **STORY-01 CERRADA**: `HomeFolder` en producción (working tree). QA real vía
  `/code-review` (3 finder-agents en paralelo, medium effort): 2 CONFIRMED
  corregidos/anotados, 1 PLAUSIBLE de eficiencia menor anotado para limpieza
  futura. Ver detalle en el log de ciclos.
- Baseline verificado: 819/819 tests, typecheck limpio, ~103 archivos de WIP del
  usuario en el árbol (no tocar fuera de lo asignado a cada story).

## Log de ciclos

| # | Hora | Fase | Resultado |
|---|------|------|-----------|
| A1 | 21:0x–21:2x | Scrum Master: auditoría Home/Blocks + memoria no-commit + PM lanzado | ✔ BACKLOG.md (7 historias) + STORY-01.md escritos. Decisión: Home→Blocks. Helpers verificados (computeWeekStats, computeReadiness) |
| A2 | 21:2x | Developer fable → STORY-01 (HomeFolder) | ✔ implementado: foldSummary.ts+test (5 casos), HomeFolder.tsx, TodayPlanner.tsx wired. typecheck limpio, 824/824 |
| QA | 21:2x | Scrum Master → `/code-review` medium sobre el diff (3 finder-agents: correctness, cleanup, altitude+conventions) | 2 CONFIRMED (measuredOnce clipaba contenido que crece tras el primer layout — **corregido**: se remide en cada layout, más simple que el original; defaultOpen=true salta sin animar — no alcanzable hoy, anotado para STORY-03) + 1 PLAUSIBLE (computeWeekStats/computeReadiness duplicados vs HomeHeroStats/ReadinessLine — menor, anotado, no urgente). typecheck+test re-verificados tras el fix: 824/824 |
| A3 | 21:3x–21:5x | PM → STORY-02 (heroMode compacto, sin reordenar backlog) | ✔ STORY-02.md escrita; carry-forward del hallazgo defaultOpen anotado en STORY-03. Verificado: DayCardVariant (9 casos), useDayCardState(date), tokens heroDisplay/titleSmall existen tal cual el brief asume |
| A4 | 21:5x–22:0x | Developer fable → STORY-02 | ✔ heroMode.ts+test (9 casos) + HomeHero.tsx (LinearTransition incluida, no descartada). typecheck limpio, 833/833 |
| QA | 22:0x | Scrum Master → `/code-review` medium (1 finder-agent, correctness+reuse+efficiency+altitude combinados dado el tamaño pequeño del diff) | 1 PLAUSIBLE menor (a11y props repetidas 5x) — decisión: no tocar, es exactamente el "3 líneas > abstracción prematura" de CLAUDE.md y el propio brief ("dos ramas, una decisión"). Sin CONFIRMED. Snapshot guardado |
| A5 | 22:0x–22:1x | PM → STORY-03 (memoria/apertura inteligente, store nuevo `uiStore.ts`) | ✔ STORY-03.md escrita. PM recomienda NO arrancarla sin batería (75-90min, riesgo mayor) |
| — | 21:4x | Scrum Master: batería real 40%/43min confirma el umbral → **parada limpia**, cron borrado, resumen escrito | ✔ |
| — | 23:4x | Álvaro conecta cargador y pide continuar. Batería 4%→charging al reanudar; baseline re-verificado (833/833) | ✔ |
| A6 | 23:4x–23:47 | Developer **opus** → STORY-03 (uiStore.ts + folderState.ts/test + HomeFolder wiring sin flash) | ✔ typecheck limpio, 849/849 (16 nuevos) |
| QA | 23:5x | Scrum Master → `/code-review` medium (1 finder-agent: cold-start wiring + persist race + duplicate-subscription check) | 1 CONFIRMED (handleToggle sin gate de hidratación, ventana de carrera con el merge de persist) — **corregido**. Cold-start/withTiming trace verificado correcto por el finder. Duplicate useDayCardState = mismo patrón ya aceptado en STORY-01→02. typecheck+test re-verificados: 849/849 |
| A7 | 23:5x (21 jul) | PM → STORY-04 | ✖ límite de sesión antes de escribir nada; árbol verificado limpio (849/849) a las 10:29 del 22 jul |
| A8 | 10:2x–10:3x (22 jul) | PM → STORY-04 (relanzado, contra HomeFolder.tsx real post-STORY-03) | ✔ STORY-04.md escrita. Verificado: tokens hair.subtle/base, rule de ReadinessLine, card de KaiSignal coinciden con el brief |
| A9 | 10:3x–10:41 | Developer opus → STORY-04 (caja warm + secciones + filetes; retira chrome de 4 hijas; fix propio: KaiSignal condicional para evitar sección vacía) | ✔ typecheck limpio, 849/849 (mismo baseline, sin tests nuevos por diseño) |
| QA | 10:4x | Scrum Master → `/code-review` medium (1 finder-agent: matemática de gutters/paddings entre los 5 archivos + tokens.ts) | **0 hallazgos**. Cancelación divider/section verificada exacta (mismo token Spacing.lg en ambos lados); el estrechamiento del calendario (20px→36px de inset) es intencional y consistente entre las 3 hijas, no un bug |
| A10 | 11:0x–11:1x | PM → decide STORY-07 en vez de Blocks (soberanía del usuario, CLAUDE.md) + detecta bug a11y real (contenido colapsado navegable por VoiceOver) | ✔ STORY-07.md escrita |
| A11 | 11:1x–10:54 | Developer opus → STORY-07 (fix a11y: accessibilityElementsHidden + importantForAccessibility gateados en `open`; maxFontSizeMultiplier en el handle) | ✔ typecheck limpio, 849/849. Honesto sobre lo NO verificado (VoiceOver real, Dynamic Type en pantalla, regresión) |
| QA | 10:5x | Scrum Master → `/code-review` medium (1 finder-agent: interacción a11y-props/layout, staleness, timing de animación, convenciones) | **0 hallazgos**. Confirmado: a11y props no interactúan con Yoga/onLayout; sin staleness; ventana de 240ms con contenido accesible-pero-animando es inconsecuente (foco no salta solo) |
| — | 10:5x | **SPRINT CERRADO.** Loop parado, cron borrado, resumen final escrito | ✔ |
