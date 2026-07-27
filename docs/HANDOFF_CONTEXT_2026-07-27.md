# CONTEXTO DE HANDOFF — Kairos · sesión nueva (Opus)

> Pega esto entero como primer mensaje de la sesión nueva. Es el estado real a 2026-07-27.

## 1. Quién eres y qué es esto
Eres Claude Code trabajando en **Kairos**, app RN/Expo iOS-first de fitness ("The Training OS"). Dueño del producto: **Álvaro** (decide él, tú recomiendas). Repo: `/Users/alvaro/Documents/Stack/app`, rama actual `feat/night-run`. Lee `CLAUDE.md` (metodología gstack "boil the lake", tokens en `src/theme/tokens.ts`, etc.) y el índice de memoria `MEMORY.md` antes de nada.

## 2. REGLAS PERMANENTES (no negociables — están en memoria persistente)
1. **Nunca `git commit`/`git add`/`git push`** en runs autónomos/autopilot. Todo se queda en el working tree para que Álvaro lo revise a mano. (`feedback_autopilot_no_commit.md`)
2. **Nunca `model:"fable"`** para subagentes (Agent tool). fable solo para el hilo principal. (`feedback_model_orchestrator.md`)
3. **Nunca tocar código nativo / disparar rebuild sin autorización EXPLÍCITA de Álvaro** — mataría su sesión de Metro viva (proceso 29107, puerto 8081). Aplica a: voice recorder (expo-audio), **companion de Watch (N8)**, y activación de HealthKit. (`project_iphone_deploy.md`)
4. Nada de screenshots/computer-use sin que Álvaro lo pida.
5. Referencias visuales aprobadas para componentes/motion: motion.dev, kokonutui.com, bklit.com, manus.im (`reference_ui_inspiration_sites.md`). El dorado 1x por pantalla y `springs.press` sin rotación son divergencia deliberada de marca, NO un hueco a "arreglar".
6. Cortar texto de sobra (minimalismo real), nunca esconder contenido relevante tras un tap, animaciones al nivel de apps de Apple.

## 3. Qué se ACABA de construir (Adaptive Readiness Engine — Fase 1) — COMPLETO, sin commitear
Motor que fusiona datos de recuperación reales (HRV/sueño del Apple Watch vía HealthKit) + carga de entreno + objetivo del perfil + adherencia a la frecuencia semanal → una señal `AdaptationSignal` que ajusta lo que la app RECOMIENDA (peso/reps sugeridos, aviso de Kai, titular "Tu estado hoy"). Salió de que Álvaro dijo que "Tu estado hoy" no debía estar inventado sino vinculado al Watch.

- **Spec**: `docs/superpowers/specs/2026-07-23-adaptive-readiness-design.md` (con enmienda del 2026-07-27).
- **Plan**: `docs/superpowers/plans/2026-07-24-adaptive-readiness-engine.md` (17 tareas).
- **Ledger de progreso**: `docs/superpowers/plans/2026-07-24-adaptive-readiness-engine.progress.md` — LÉELO, tiene el detalle de cada tarea + los 6 findings del review final.
- **Archivos nuevos**: `src/store/healthStore.ts`, `src/lib/readiness/adaptiveEngine.ts`, `src/lib/readiness/useReadinessSnapshot.ts`, `src/lib/health/dailySync.ts` (+ tests). `src/lib/health/healthkit.ts` ganó `readHRV()`/`readSleepHours()`.
- **Archivos modificados (aditivo, no-breaking)**: `readiness.ts`, `kaiSignal.ts`, `suggestNextValues.ts`/`inSessionNudge.ts`/`applyProgression.ts` (parámetro `adaptation?` opcional), `ReadinessLine.tsx`, `TodayPlanner.tsx`, `ActiveWorkoutScreen.tsx` (solo 6 líneas), `App.tsx`.
- **GATE crítico** (decisión explícita de Álvaro 2026-07-27): en `readiness.ts`, la señal solo influye si `confidence === 'high'` (o sea, cuando haya datos REALES de HRV/sueño). Hasta que Álvaro active HealthKit, `adaptation` es siempre `null` → comportamiento byte-idéntico al de antes. **La app HOY no muestra nada nuevo; eso es correcto, no un bug.**
- Estado: **987/987 tests pasan, `tsc --noEmit` limpio, NADA commiteado.** HEAD sigue en `76d91da`.
- 6 findings no-bloqueantes del review final (ver ledger). El más relevante: el copy del titular de recuperación ("Tu recuperación real está baja hoy...") no tiene test que lo dispare de verdad.

## 4. Lo que Álvaro QUIERE AHORA: el companion de Apple Watch (N8) + sesiones en vivo
Su petición original de toda esta cadena de trabajo fue: pulir el "during exercise use" (Modo Sesión, ya hecho en iPhone) y **luego crear el complemento para Apple Watch**. El Adaptive Readiness Engine era el puente Watch↔recomendaciones; el companion en la muñeca es lo que falta.

**Lo que ya existe como base (verificado):**
- Módulo nativo `modules/kairos-live-activity/` — Live Activity + Dynamic Island para iPhone (NO es app de Watch todavía). Expone `WorkoutActivityAttributes.swift` (`ActivityAttributes` + `ContentState`).
- Puente JS↔nativo YA vivo: `src/lib/liveActivity/` (`useLiveActivitySync.ts`, `payload.ts`, `widgetBridge.ts`, `widgetActions.ts`). El `ActiveWorkoutScreen` ya llama `useLiveActivitySync`.
- Doc: `docs/LIVE_ACTIVITY_SETUP.md`.
- `react-native-health`: NO instalado en node_modules (require lazy, ships inert). app.json plugins actuales: solo `expo-font`, `expo-secure-store`.

**Lo que N8 implica (por qué está GATED):**
Un companion de watchOS de verdad requiere un target nativo de Watch en el proyecto Xcode, `expo prebuild`, y rebuild — eso mata la sesión de Metro de Álvaro. NO empezar sin su "ok" explícito.

## 5. Cómo proceder con N8 (recomendado)
1. **NO escribir código aún.** Arranca con la skill `superpowers:brainstorming` (gate duro: nada de implementación hasta diseño aprobado por Álvaro). Preguntas 1 a 1.
2. Decisiones de producto a resolver con él ANTES de diseñar: ¿el Watch es solo un "mando/marcador" espejo de la sesión del iPhone (registrar serie, ver descanso, HECHO desde la muñeca) o corre la sesión de forma autónoma sin el iPhone cerca? ¿Métricas en vivo (FC, calorías) del sensor del Watch? ¿Escribe el workout a HealthKit desde el Watch o desde el iPhone?
3. Investiga primero qué se reutiliza: `WorkoutActivityAttributes`/`ContentState` y el patrón de `src/lib/liveActivity/` son la base natural del payload que el Watch consumiría.
4. Recomienda a Álvaro correr `/plan-eng-review` antes de tocar nativo (riesgo alto, target nuevo en Xcode).
5. Cuando haya diseño aprobado → escribe spec en `docs/superpowers/specs/` → `writing-plans` → y solo entonces, con su autorización explícita para el rebuild, implementar.

## 6. Otras cosas aparcadas (por si pregunta)
- **N7 voice recorder** (expo-audio) — gated, rebuild nativo.
- **Fase 2 del readiness**: auto-cambio de QUÉ ejercicios aparecen según recuperación — spec propio pendiente, necesita modelo de equivalencia de ejercicios (la librería hoy solo tiene discipline+muscleGroups).
- **Activación de HealthKit**: paso una-vez de Álvaro (`npx expo install react-native-health` + plugin en app.json + `expo prebuild --clean && expo run:ios`), descrito en `docs/superpowers/specs/healthkit-integration.md`. Hasta que lo haga, el Adaptive Readiness Engine está inerte.

## 7. Primer paso concreto en la sesión nueva
Confirma el estado (`git status` debe mostrar todo unstaged, HEAD en `76d91da`), lee el ledger del readiness engine, y arranca el brainstorming de N8 con Álvaro preguntando primero el punto 5.2 (¿Watch espejo vs autónomo?). No toques nativo sin su ok.
