# NIGHT RUN — Estrategia (2026-07-19)

Agente estratega (opus). Alimenta al programador (fable). Sin commits, sin screenshots, terse.
Fuente: `docs/INWORKOUT_GLANCE_MODE.md`, `CLAUDE.md`, código in-use auditado esta noche.

## 1. Razonamiento cliente final (marco YC)

**¿Qué necesita de verdad durante el entreno?** No un editor de datos. Con manos temblando,
sudor y el móvil en el suelo, quiere: (a) saber de un vistazo qué toca AHORA, (b) marcar
"hecho" sin fallar el toque, (c) que el descanso le avise solo, (d) corregir en 1 gesto cuando
la realidad no fue el plan. Todo lo demás es ruido. El Modo Sesión ya acierta el eje: marcador,
no formulario.

**¿La gente lo quiere?** Sí, categoría probada: Strong/Hevy mueven millones sólo con logging
rápido. Pero es un mar rojo de "log sets, get out". Ganar ahí por pulido es marginal.

**¿Cuál es el wedge más estrecho e irremplazable?** No "otro logger". Kairos = **el logger que
te entiende hablando y recuerda por ti**. El moat declarado (tracking híbrido + memoria + voz
in-session) es real porque los referentes NO lo tienen resuelto: el logging por voz existe ya
como categoría 2026 (RepTalk, Vora/ElevenLabs, Liftly, W8Log) pero como apps monoproducto, sin
memoria de progresión ni campos dinámicos por ejercicio. Kairos ya tiene lo caro (campos
dinámicos + memoria M4 + transporte STT productivo + canon de ejercicios). Le falta el último
tramo: **cerebro de voz (utterance→valores) + captura de audio**.

**Fin último de Kairos:** un OS personal de bienestar donde el usuario nunca siente que "usa una
app": habla, confirma con el pulgar, y la memoria compone el plan. El in-use es el corazón: si
la sesión no es glanceable y de ≤2 toques, nada más importa.

## 2. Estado actual vs referentes (teardown)

| Eje | Kairos hoy | Referente | Gap |
|---|---|---|---|
| Logging rápido | HECHO a un pulgar + prefill por progresión | Strong (flow más pulido, plate calc) | Corregir cuesta 3 toques (ver §4) |
| Descanso | Countdown pantalla completa + anillo + auto-avance + ±15s | Strong (rest por tipo de set) | Sin split warmup/work |
| Glanceable | Objetivo gigante, legible a 2 m, Live Activity en lock | Apple Watch Workout (glance + Health) | Sin muñeca; Live Activity infrautilizada |
| Memoria/guía | "Última · 60×8 · hace 4 días", PRs cross-block | WHOOP/Athlytic (capa de interpretación) | Falta capa "sugerido vs hecho" explícita |
| Voz | STT productivo + cuota + ListeningOverlay | RepTalk/Vora (voz-first) | Sin grabador ni parser voz→valores |

Dato clave de campo: voz es la más rápida (~2 s) cuando acierta pero falla ~10% en gimnasio
ruidoso; el táctil es el más consistente. → **Voz = atajo aditivo, nunca camino único.** El
diseño v2 de Kairos ya lo asume (spec §6). Nuestra ventaja: cuando la voz falla, el marcador
táctil de 2 toques sigue ahí — los voz-first no tienen ese fallback pulido.

## 3. Decisión Watch-vs-voz para ESTA noche

Restricción dura: nadie desbloquea el Mac → **cero rebuilds nativos** (prebuild, pods, xcodeproj,
watchOS target, expo-audio). Contra eso:

- **Apple Watch = DIFERIDO.** Todas las vías 2026 (@expo/apple-targets, react-native-watch-
  connectivity, target watchOS en el xcodeproj) exigen build nativo + provisioning; watchOS no
  tiene runtime JS (UI en Swift). Imposible y arriesgado overnight. Wedge intermedio: la **Live
  Activity ya compilada** es "la muñeca del pobre" — el teléfono boca arriba YA es el marcador.
- **Voz full-loop = DIFERIDO en su parte nativa.** El transporte STT está listo, pero **no hay
  grabador** (`expo-audio`/`expo-av` NO instalados) ni parser. El grabador es nativo → gate.
- **Lo que SÍ avanza el moat sin tocar nativo:** el **parser puro voz→valores** (TS, testeable,
  sin deps). Se enchufa HOY al input de TEXTO (el correction sheet ya tiene TextInput; Kai ya
  hace texto→bloque) → utilidad inmediata y "voice-ready" para cuando aterrice el micro.

**Decisión:** esta noche NO se toca nativo. Se prioriza (1) pulir el in-use al estándar de ≤2
toques y (2) sentar el cerebro de voz en TS. Watch y grabador quedan como briefs nativos gated,
sin romper la build actual.

## 4. Gaps del Modo Sesión (accionables, JS-first)

1. **Corregir cuesta un toque de más.** El `SetCorrectionSheet` cierra con "Listo" y DESPUÉS hay
   que pulsar HECHO en el marcador → 3 toques para una serie corregida. La métrica es ≤2. El
   sheet debe poder **corregir-y-completar en un gesto** (su CTA = HECHO). → **BRIEF-01.**
2. **Voz sin cerebro.** No existe `voz→{weight,reps,rpe,nota}`. Bloquea el moat. → N2 (TS puro).
3. **Corregir la serie recién hecha.** Durante el descanso, si te equivocaste en el HECHO que
   acabas de dar, hay que hacer swipe atrás. Debería corregirse in-situ en el estado descanso.
4. **"Sugerido vs hecho" implícito.** El objetivo gigante es el prefill de progresión pero no se
   nombra como sugerencia ni muestra delta vs la última; la confianza confirm-or-correct mejora
   haciéndolo explícito (sin ruido).
5. **Descanso plano por ejercicio.** Sin split warmup/work (la ventaja de Strong).

## 5. Backlog priorizado N1..N8 (valor / esfuerzo / riesgo)

| # | Brief | Nativo | Valor | Esf. | Riesgo |
|---|---|---|---|---|---|
| **N1** | **Corrige-y-completa en un gesto (≤2 toques). BRIEF-01.** | no | Alto | S | Bajo |
| N2 | Parser voz→valores (TS puro) + enchufe al TextInput del sheet (voice-ready sin micro) | no | Alto (moat) | M | Bajo |
| N3 | Descanso: eco + corrección 1-tap de la serie recién hecha (store: editar set completado sin reiniciar descanso) | no | Alto | M | Medio |
| N4 | "Sugerido vs hecho": badge de sugerencia + delta vs última en el objetivo gigante | no | Medio | S | Bajo |
| N5 | Descanso por tipo de set (warmup/work) — paridad Strong | no | Medio | M | Bajo |
| N6 | Live Activity como wedge de muñeca: enriquecer payload (sólo TS de `payload.ts`, sin tocar Swift/xcodeproj) | frontera | Medio | M | Medio |
| N7 | Grabador voz (`expo-audio`) + push-to-talk in-workout → alimenta N2. **GATED (Mac).** | sí | Alto | L | Alto |
| N8 | Companion watchOS (@expo/apple-targets + WatchConnectivity). **DIFERIDO (Mac + provisioning).** | sí | Alto (LP) | XL | Alto |

**Secuencia:** N1→N5 son 100% JS/TS y caben en ciclos overnight. N6 es frontera: sólo si el
diff se limita a `payload.ts` y sus tests (nada de `.swift`/`.pbxproj`). N7/N8 se dejan
especificados pero NO se ejecutan sin Mac — cuando haya ventana nativa, N7 primero (rebuild
trivial, rollback = quitar la dep) y N8 después.

## 6. Regla de oro del run

Cada brief: pure-core testeable con vitest, sin deps nuevas (salvo N7/N8 gated con justificación),
todo al working tree (sin commit), `npm run typecheck && npm test` verde antes de cerrar ciclo.
El in-use manda: si un cambio no reduce toques, no aumenta legibilidad a 2 m, o hace que "parezca
una app", no entra.

## DÍA 19 — Dictamen de dirección (automode, Álvaro despierto)

**Contexto operativo.** Álvaro prueba el in-use en el simulador con SU Metro (8081, hot reload).
Lo JS/TS aterriza en caliente y lo siente al instante; lo **nativo** (expo-audio, watch, pods,
prebuild) fuerza rebuild → interrumpe su sesión y arriesga romper la build que está usando. Regla
del día: nativo solo con rollback trivial documentado y sin romper la build jamás. → **Front-load
JS/TS**; el nativo (voz) se agenda como UN ciclo opt-in preparado, disparable cuando él lo acepte.

**Cliente / competencia / wedge.** El moat es memoria + voz + tracking híbrido. N4 hizo la memoria
VISIBLE (el número gigante se declara sugerencia). El siguiente salto de valor JS es hacerla
**honesta y coach**: que explique POR QUÉ sugiere y que **adapte serie a serie**. Descubrimiento
clave: el motor `src/lib/progression/` (suggestNextValues → carry-forward + nudge RPE ±2.5 kg, con
`basis` = nudge-up/down/carry) ya existe pero opera **entre sesiones** (al construir el bloque);
in-session no adapta, y N4 calcula su delta sin conocer ese `basis`. Ahí está el oro barato. La voz
(grabador) es el mayor salto pero interrumpe → se prepara en JS y se dispara en un solo ciclo.

**Secuencia prevista del día:**
- **BRIEF-05 (hoy):** "Sugerido, y por qué" — la línea de sugerencia explica su base con el motor
  REAL (`basis`): nudge-up "la última fue fácil", nudge-down "la última costó", carry "igual que la
  última". Display-only, reutiliza el engine, sin store, sin nativo, hot-reload. Convierte N4 de
  delta-adivinado a verdad + coaching. Riesgo bajo.
- **BRIEF-06:** Advisor intra-sesión — la sugerencia de la SIGUIENTE serie se adapta a la que
  acabas de hacer (nudge por reps-vs-objetivo + RPE aplicado dentro de la sesión). Toca el prefill
  en `completeSet`; mayor valor, riesgo moderado; tras validar la superficie de D-a.
- **BRIEF-07:** N5 descanso por tipo de set (warmup/work) — paridad Strong; JS store, bajo riesgo.
- **BRIEF-08:** pase UI/UX de las pantallas satélite del in-use (SessionOverview, WorkoutSummary,
  interstitial de cambio de ejercicio) al nivel del marcador; lente kairos-uiux-designer.
- **BRIEF-09 (= N7, NATIVO opt-in):** grabador `expo-audio` + push-to-talk in-workout → alimenta
  `parseSpokenSet` (N2). Completa el loop de voz, el mayor salto del moat. Preparar hook+UI en JS
  antes; el add nativo es mínimo (dep + config plugin), rollback trivial (quitar dep+plugin +
  prebuild). Disparar SOLO cuando Álvaro acepte un rebuild.
- **N8 (watch):** diferido a ventana dedicada; mayor esfuerzo y riesgo, lo último.

**Racional.** Los primeros 4 briefs son 100% JS/TS → él los vive en caliente sin interrupción y el
moat memoria→coach gana profundidad y honestidad. La voz nativa se concentra en un solo ciclo
preparado para minimizar interrupción y riesgo. El watch, al final.
