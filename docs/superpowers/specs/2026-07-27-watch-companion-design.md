# Kairos · Companion de Apple Watch (W1+W2) — diseño en curso + contexto de rama

> **Estado: BORRADOR DE DISEÑO, no aprobado del todo.** Escrito el 2026-07-27 a
> petición de Álvaro para poder retomar el hilo con contexto completo tras
> atender otra tarea. Nada de este documento se ha implementado. **Cero líneas
> de código escritas. Cero commits.**
>
> Este documento tiene dos mitades que conviene no confundir:
> - **§1–§5**: hechos verificados hoy (estado de la rama, decisiones ya tomadas,
>   inventario de lo reutilizable). Se puede confiar en ello.
> - **§6–§9**: la propuesta de diseño. Los tramos 1 y 2 se le presentaron a
>   Álvaro y quedó pendiente su confirmación; los tramos 3–7 **nunca llegó a
>   verlos** — están aquí redactados por primera vez.

---

## 0. Cómo retomar esto en 60 segundos

1. Lee §1 (estado real) y §3 (las 11 decisiones que ya tomó Álvaro).
2. Lee §6 entero (el diseño).
3. Ve a §9: el siguiente paso concreto es **presentarle los tramos 3, 4 y 5** y
   resolver las decisiones abiertas de §7 — sobre todo la del **fondo negro** y
   la del **`HKWorkoutActivityType` de `team_sport`**.
4. Cuando apruebe el diseño entero → spec definitiva → `superpowers:writing-plans`
   → `/plan-eng-review` → **y solo entonces**, con su "ok" explícito al rebuild,
   implementar.

---

## 1. Estado real de la rama (verificado el 2026-07-27)

| Dato | Valor |
|---|---|
| Rama | `feat/night-run` |
| HEAD | `76d91da` — *fix(ai): el bloque por fin responde a lo que pides…* (2026-07-14) |
| Working tree | **150 ficheros sin commitear**: 83 modificados, 2 borrados, 65 nuevos |
| Tests | **987 pasan / 987** en 73 ficheros (`npx vitest run`, ~31 s) |
| Typecheck | **`npx tsc --noEmit` limpio, exit 0** |
| Expo / RN | `expo ~54.0.33`, `react-native 0.81.5` |

Scripts relevantes: `npm test` (`vitest run`), `npm run typecheck`, `npm run lint`,
`npm run audit:design`, `npm run ios` (`APP_ENV=development expo run:ios`).

### 1.1 Lo último que se construyó: Adaptive Readiness Engine (Fase 1)

Completo, testeado y **deliberadamente inerte**. Fusiona HRV + sueño (Apple Watch
vía HealthKit) + carga de entreno + objetivo + adherencia → una `AdaptationSignal`
que ajusta lo que la app *recomienda* (peso/reps sugeridos, aviso de Kai, titular
"Tu estado hoy").

- Spec: `docs/superpowers/specs/2026-07-23-adaptive-readiness-design.md`
- Plan + ledger: `docs/superpowers/plans/2026-07-24-adaptive-readiness-engine.md`
  y `.progress.md` (**el ledger tiene los 6 findings no bloqueantes del review**)
- Ficheros nuevos: `src/store/healthStore.ts`, `src/lib/readiness/adaptiveEngine.ts`,
  `src/lib/readiness/useReadinessSnapshot.ts`, `src/lib/health/dailySync.ts`
- **GATE (decisión de Álvaro, 2026-07-27):** en `readiness.ts` la señal solo
  influye si `confidence === 'high'`. Sin HealthKit activo, `adaptation` es
  siempre `null` → comportamiento byte-idéntico al anterior. **La app hoy no
  muestra nada nuevo, y eso es correcto.**

**Conexión con este proyecto:** el companion de Watch es lo que finalmente
*enciende* ese motor, porque es lo que trae los datos reales de HealthKit. Ver §6.4.

### 1.2 Reglas permanentes (no negociables, están en memoria persistente)

1. **Nunca `git commit` / `add` / `push` en runs autónomos.** Todo se queda en el
   working tree para revisión manual de Álvaro.
2. **Nunca `model:"fable"`** para subagentes.
3. **Nunca tocar código nativo ni disparar un rebuild sin autorización EXPLÍCITA.**
   Mataría la sesión de Metro viva de Álvaro (proceso 29107, puerto 8081). Aplica
   a: voice recorder (N7), **companion de Watch (N8)** y activación de HealthKit.
4. Nada de screenshots / computer-use sin que lo pida.
5. Referencias visuales aprobadas: motion.dev, kokonutui.com, bklit.com, manus.im.
   El dorado 1× por pantalla y `springs.press` sin rotación son **divergencia
   deliberada de marca**, no un hueco que arreglar.
6. Cortar texto de sobra (minimalismo real), nunca esconder contenido relevante
   tras un tap, animaciones al nivel de apps de Apple.

---

## 2. El encargo

La petición original de toda esta cadena de trabajo fue: pulir el *during exercise
use* (Modo Sesión en iPhone — **ya hecho**, commits `efdfabc` y `adff6d1`) y
**luego crear el complemento para Apple Watch**. El Adaptive Readiness Engine era
el puente Watch↔recomendaciones. El companion en la muñeca es lo que falta.

En esta sesión, además, Álvaro añadió dos requisitos nuevos y grandes (ver §3,
decisiones 8b y 8c) que expandieron el alcance de "companion" a algo bastante
mayor.

---

## 3. Decisiones ya tomadas (brainstorming del 2026-07-27)

Once preguntas, respondidas una a una. **Estas decisiones son de Álvaro y no se
re-litigan** — están cerradas salvo que él las reabra.

| # | Pregunta | Decisión | Consecuencia |
|---|---|---|---|
| 1 | ¿Espejo o autónomo? | **Híbrido: espejo + `HKWorkoutSession` propia** | El reloj arranca su propia sesión de HealthKit desde el segundo 1 — es lo que lo mantiene vivo al bajar el brazo, da FC y acredita los anillos |
| 2 | ¿Desde dónde se arranca? | **Ambos: el Watch también elige bloque** | El reloj necesita una copia de la librería y el iPhone tiene que aceptar arranques remotos |
| 3 | ¿Y sin iPhone cerca? | *(literal)* **"al igual que el apple watch con fitness de iphone, se vincula online por detras. quiero que sea tecnicamente complejo y similar al funcionamiento tanto de la app fitness de apple como otras similares"** | **Reescribe la decisión 1: el reloj pasa a ser cliente de primera clase, no espejo.** Autonomía real + sync en background |
| 4 | ¿IA de la pantalla? | **Páginas horizontales estilo Apple Workout** | Tres páginas deslizables. *Asunción declarada y no contestada: la página central sigue siendo el marcador que muta de Modo Sesión, no una parrilla de métricas* |
| 5 | ¿Corregir en la muñeca? | **La corona ajusta antes de confirmar** | HECHO confirma el objetivo; girar la corona sobre el número registra el valor real. Sin sheets ni teclado |
| 6 | ¿Qué disciplinas? | **Todas, con GPS y ritmo en vivo** | Entra CoreLocation, GPS de doble frecuencia, gestión de batería. Duplica el tamaño |
| 7 | ¿Kai en la muñeca? | **Háptico propio + una línea cuando hay algo real** | Patrones hápticos distintos para descanso/PR/última serie; Kai escribe solo cuando no es obvio |
| 8 | ¿Superficies fuera de sesión? | **NO CONTESTADA** — Álvaro redirigió a dos requisitos nuevos ↓ | Sigue abierta (ver §7.1) |
| 8b | *(nuevo)* | **"kai debe vivir como agente de conversacion tipo siri, interaccion pura por voz. lo que se le pida lo hace, el agente puede tener libertad para tocar bloques, crear nuevos, cambiar ejercicios especificos, etc"** | Es el moat según su propia visión (`project_core_vision_voice.md`). Se convierte en **W3** |
| 8c | *(nuevo)* | **"dependiendo del tipo de entrenamiento que componga al bloque, la interfaz cambia y se adapta a este. no es lo mismo correr, que hacer yoga, que calistenia, que un partido de tenis o futbol, que estar en el gym"** | Se convierte en **W2**, y entra en la spec actual |
| 9 | ¿Qué diseñamos ahora? | **W1 + W2 juntos, una sola spec** | Voz (W3) y superficies (W4) tendrán specs propias |
| 10 | ¿Qué reloj? | **Apple Watch Ultra 2** | Botón de Acción físico, doble toque, pantalla siempre activa 49 mm, GPS L1+L5, 3000 nits. *Versión de watchOS sin confirmar* (ver §7.2) |
| 11 | ¿Botón de Acción? | **Configurable por el usuario** | Por defecto **cerrar la unidad en curso**; alternativas: pausar, abrir Kai. Los ajustes viven en el iPhone |
| — | Arquitectura de sync | **A — Log de eventos append-only + reductor compartido** | Con escenarios dorados en CI que fallan el build si TS y Swift divergen |

---

## 4. Descomposición en sub-proyectos

Lo que Álvaro describió no es un proyecto: son cuatro subsistemas. La skill de
brainstorming obliga a trocear antes de refinar detalles.

| | Sub-proyecto | Qué es | Depende de | Estado |
|---|---|---|---|---|
| **W1** | **El cimiento** | Target watchOS, transporte WatchConnectivity, motor de sync (log de eventos + reconciliación), `HKWorkoutSession`, marcador de series en la muñeca | — | **Esta spec** |
| **W2** | **Interfaz por disciplina** | La página central muta según `Discipline`: series en gym, GPS+ritmo corriendo, tiempo en yoga, cronómetro de partido en tenis/fútbol | W1 | **Esta spec** |
| **W3** | **Kai por voz** | Micro del reloj → STT → agente con herramientas → toca bloques, cambia ejercicios, registra series. Interacción pura por voz tipo Siri | W1 (o el iPhone) | Spec propia, pendiente |
| **W4** | **Superficies** | Complicación en la esfera, Smart Stack con "Tu estado hoy", resumen de sesión en la muñeca | W1 | Spec propia, pendiente |

**Recomendación que quedó sin explorar:** W3 podría entregarse **primero en el
iPhone**, antes de que exista el reloj. El agente y el STT ya están construidos
(§5); solo falta el grabador (N7, gated pero mucho más pequeño que un target de
watchOS). Validaría la pregunta de producto más difícil — *¿da gusto o da miedo
que Kai toque tus bloques solo?* — con una fracción del riesgo, y el reloj
heredaría el trabajo entero. Álvaro eligió W1+W2 primero; esto queda como nota.

---

## 5. Base reutilizable (inventario verificado)

Todo lo de esta tabla existe **hoy** en la rama y se comprobó leyéndolo.

### 5.1 El contrato del marcador ya está escrito dos veces y coincide

`src/lib/liveActivity/payload.ts` (`LiveActivityPayload`) y
`modules/kairos-live-activity/ios/WorkoutActivityAttributes.swift`
(`ContentState`) son **el mismo contrato**, campo por campo:

```
blockName · exerciseName · targetLine (pre-formateado) · setIndex/setTotal
restStartedAt/restEndsAt · nextUp · phase ('set' | 'rest' | 'change')
```

Esto es literalmente el payload que consumiría un Watch. El comentario de cabecera
de `payload.ts` ya lo dice: *"la Live Activity es un THIN CLIENT del marcador del
teléfono… nunca una segunda implementación"*. El reloj hereda esa regla.

Decisión de diseño importante que se deriva: **`targetLine` viaja
pre-compuesto** ("60 kg × 6", "5 km · 5:30 min/km"). Swift nunca re-deriva
unidades ni formatos. Por eso las sesiones de correr/movilidad/híbridas se
renderizan tan bien como las de fuerza sin código extra.

### 5.2 Ficheros clave

| Ruta | Qué aporta |
|---|---|
| `src/lib/liveActivity/payload.ts` | Derivación pura snapshot → payload. Testeado |
| `src/lib/liveActivity/widgetActions.ts` | Acciones del widget → store (HECHO / +30 s / saltar). Testeado |
| `src/lib/liveActivity/widgetBridge.ts` | Puente de acciones que sobrevive a una pantalla desmontada |
| `src/lib/liveActivity/useLiveActivitySync.ts` | Hook de sync, ya montado en `ActiveWorkoutScreen` |
| `modules/kairos-live-activity/` | **El patrón a copiar** para el módulo Expo del puente de Watch |
| `src/features/workout/scoreboard/machine.ts` | La máquina de estados de la sesión (`deriveScoreboardState`) |
| `src/features/workout/scoreboard/format.ts` | `formatScoreboardTarget` — el formateador único del objetivo gigante |
| `src/features/workout/scoreboard/parseSpokenSet.ts` | **Convierte "sesenta y dos por ocho" en valores.** Puro TS, exhaustivamente testeado. Base de W3 |
| `src/features/workout/scoreboard/spanishNumbers.ts` | Números en palabras → dígitos |
| `src/lib/ai/tools/` | `blockTools.ts`, `exerciseTools.ts`, `contentTools.ts` — **el agente YA sabe crear y editar bloques y ejercicios** |
| `src/lib/ai/stt/` | `transcribe.ts` + `quota.ts` — **la transcripción YA existe con cuota** |
| `src/lib/ai/agent.ts` | Bucle del agente |
| `src/types/core.ts` | `Discipline` (8 valores) + `DISCIPLINE_CONFIGS` con campos por defecto por disciplina |
| `src/store/workoutStore.ts` | `completeSet`, `restTimer`, `currentExerciseIndex/SetIndex` — el estado que el log de eventos debe reproducir |
| `src/lib/readiness/`, `src/lib/health/` | El motor de readiness, esperando datos reales |
| `docs/LIVE_ACTIVITY_SETUP.md` | **Léelo antes de tocar Xcode.** Documenta las trampas de target membership |

### 5.3 Lo que NO existe

- `src/lib/watch/` — no existe. Todo el pure-core de este proyecto es nuevo.
- `react-native-health` — **no está en `node_modules`**. El require es lazy y la
  app ships inerte. Activarlo es un paso de una sola vez de Álvaro, descrito en
  `docs/superpowers/specs/healthkit-integration.md`.
- El target de widget de Live Activity **tampoco existe todavía** en
  `ios/Kairos.xcodeproj` (`grep -c WorkoutActivity project.pbxproj` → 0). El
  código está, el target no. Es decir: hay **dos** trabajos de Xcode pendientes,
  no uno.
- Plugins actuales en `app.config.ts`: solo `expo-font` y `expo-secure-store`.

### 5.4 La `Discipline` que ya existe

```ts
type Discipline = 'strength' | 'running' | 'calisthenics' | 'mobility'
               | 'team_sport' | 'cycling' | 'swimming' | 'general';
```

Con `DISCIPLINE_CONFIGS` dando `defaultFields` por disciplina (p. ej. `strength`
→ weight/reps/rir con `step: 2.5` en el peso). **El modelo de datos para la UI
adaptativa de W2 ya está**: no hay que inventar taxonomía, solo mapear.

---

## 6. EL DISEÑO

### 6.1 Tramo 1 · Fronteras y transporte
> *Presentado a Álvaro. Pendiente de su confirmación explícita.*

**Dos apps, una verdad.**

El **iPhone** sigue siendo donde se *crea*: librería de bloques, agente de IA,
historial, progreso, readiness, ajustes. El **reloj** pasa a ser dueño de una
sola cosa, entera: **la sesión en vivo** — store local durable, `HKWorkoutSession`,
`HKLiveWorkoutBuilder`, y CoreLocation cuando la disciplina lo pide.

> ⚠️ **React Native no corre en watchOS.** La app del reloj es 100 % SwiftUI
> nativo. Ese es el coste real y no negociable de esta decisión: el núcleo de la
> sesión existe dos veces, en TS y en Swift. Todo §6.2 está diseñado alrededor
> de contener ese coste.

El puente es un módulo Expo nuevo, `modules/kairos-watch-bridge/`, calcado del
patrón que ya funciona en `kairos-live-activity`. Usa los tres canales de
WatchConnectivity para lo que cada uno sabe hacer:

| Canal | Para qué | Por qué ese |
|---|---|---|
| `transferUserInfo` | **El log de eventos. La espina dorsal.** | Entrega garantizada y en orden. Encola sin conexión, sobrevive a que maten la app y a un reinicio |
| `updateApplicationContext` | Proyección de la librería de bloques, cabecera de sesión activa | Coalescente: solo importa el último. Barato, sobrevive al sueño del reloj |
| `sendMessage` | Espejo en vivo en la pantalla del iPhone; arranque remoto | Baja latencia cuando ambos están despiertos. Puede despertar la app de iOS en background |

**La regla que hace que funcione el caso de la taquilla: ninguna función depende
de `sendMessage`.** Si nunca hay conexión directa, todo sigue funcionando — solo
se pierde el espejo en el móvil.

**La librería en el reloj** es una proyección compacta (id, nombre, disciplina,
ejercicios con campos y objetivos, descansos), no el modelo entero. Se regenera
cuando cambian los bloques y viaja por `applicationContext`. En v1 es de **solo
lectura** en la muñeca: puedes arrancar y correr cualquier bloque y editar
valores, pero la autoría sigue en el móvil — hasta W3, que es justo lo que la
abre por voz.

**La Live Activity actual no se toca ni se duplica.** Cuando entrenas sin reloj,
sigue igual; cuando hay sesión de reloj, el iPhone alimenta su Live Activity
desde el mismo estado reducido. Un solo marcador, tres superficies (pantalla,
Live Activity, muñeca).

```
┌─────────────── iPhone (RN + Zustand) ───────────────┐
│  librería · IA/agente · historial · readiness       │
│  ActiveWorkoutScreen ─┬─ Live Activity (existente)  │
│                       │                             │
│           reductor TS ─┴─ log de eventos ◄──┐       │
└──────────────────────────┬──────────────────┼───────┘
                           │ WatchConnectivity│
        transferUserInfo (eventos, garantizado)│
        applicationContext (librería, último)  │
        sendMessage (espejo, oportunista)      │
                           │                  │
┌──────────────────────────▼──────────────────┴───────┐
│  Apple Watch Ultra 2 (SwiftUI nativo)               │
│  reductor Swift ── log local durable ── outbox      │
│  HKWorkoutSession + HKLiveWorkoutBuilder            │
│  CoreLocation (arquetipo distancia)                 │
└─────────────────────────────────────────────────────┘
```

---

### 6.2 Tramo 2 · El log de eventos
> *Presentado a Álvaro. Pendiente de su confirmación explícita.*

Definido una sola vez en TS (`src/lib/watch/events.ts`), portado a Swift.

```
session.started   { sessionId, blockId, discipline, origin }
session.ended     { sessionId, reason }
set.completed     { exerciseId, setId, values }
set.corrected     { exerciseId, setId, values }
exercise.advanced | exercise.skipped
rest.started | rest.extended | rest.skipped
lap.marked        ← arquetipo distancia
segment.closed    ← arquetipo abierto
```

Todo evento lleva `id` (UUID), `deviceId`, `at` (epoch ms) y `lamport` (contador
monotónico por dispositivo). El orden es (`at`, `deviceId`), con `lamport`
deshaciendo empates del mismo dispositivo cuando el reloj de pared no se mueve.
Se deduplica por `id`.

El reductor es **total**: no lanza nunca, y un tipo de evento desconocido **se
ignora** en vez de romper — así una build vieja del reloj no se atraganta con
eventos de una build nueva del móvil. (Compatibilidad hacia delante: los dos
binarios se actualizan por separado y no hay forma de garantizar que vayan a la
par.)

**Las tres reglas de conflicto son decisiones de producto, no de ingeniería:**

1. **`set.completed` sobre una serie ya cerrada → se ignora.** Gana la primera:
   el instante real en que la hiciste.
2. **`set.corrected` → gana el último** por (`at`, `deviceId`). Corregir es, por
   definición, decir "lo de antes estaba mal".
3. **Nada destruye datos.** Saltar un ejercicio mueve el puntero; las series que
   registraste ahí sobreviven.

**Entrega:** cada lado guarda un buzón persistente y una marca de agua de lo que
el otro ya reconoció. Al reconectar manda solo lo que falta. Si el buzón supera
N eventos (cola de `transferUserInfo` llena, reloj días sin ver el móvil), se
colapsa en un evento-snapshot.

**El antídoto contra la deriva de los dos reductores** — `src/lib/watch/__fixtures__/*.json`:
escenarios con los eventos deliberadamente barajados, duplicados y con huecos,
más el estado esperado. Vitest los pasa por el reductor de TS; un target de
XCTest pasa **los mismos ficheros** por el de Swift. Si divergen, el build falla.
Los fixtures viven en un único sitio y se compilan en ambos targets.

> **Sin este mecanismo no empezaría la opción A.** Es lo único que impide que los
> dos reductores se separen en seis meses y los datos empiecen a mentir.

---

### 6.3 Tramo 3 · La muñeca (W2)
> **NUNCA PRESENTADO A ÁLVARO.** Primera redacción. Contiene una decisión de
> marca que necesita su permiso explícito (§6.3.4).

#### 6.3.1 Tres páginas (decisión 4)

Deslizamiento horizontal estilo Apple Workout:

- **Izquierda · Métricas** — FC con zona, calorías, tiempo transcurrido, y lo
  propio de la disciplina (ritmo, distancia, vueltas).
- **Centro · El marcador** — muta por fase *y* por arquetipo. Es la que sale al
  levantar la muñeca, siempre.
- **Derecha · La sesión** — lo que queda, saltar ejercicio, terminar. Aquí vivirá
  el acceso a Kai (W3).

#### 6.3.2 Tres arquetipos, no ocho interfaces

La disciplina afina campos, iconos y tipo de workout; la *forma* de la pantalla
solo tiene tres variantes. Ocho UIs a medida serían inmantenibles y el modelo de
datos ya da los campos por disciplina.

| Arquetipo | Disciplinas | Página central | Botón de Acción |
|---|---|---|---|
| **Series** | `strength`, `calisthenics`, `mobility` | Objetivo gigante ("60 kg × 6"), SERIE 2/4, HECHO a un pulgar. Descanso = cuenta atrás a pantalla completa (estado principal, como en Modo Sesión). Corona ajusta el valor primario antes de confirmar | Cierra la serie |
| **Distancia** | `running`, `cycling`, `swimming` | Distancia gigante, ritmo actual grande, vuelta en curso. El objetivo del bloque ("5 km · 5:30") es línea de referencia y el ritmo se colorea contra ella | Marca vuelta / largo |
| **Abierto** | `team_sport`, `general` | Cronómetro de parte gigante, FC y zona como métrica principal. Sin objetivo numérico: el valor está en FC y duración | Cierra el tiempo/parte |

Notas por arquetipo:

- **Series**: es el que hereda directamente Modo Sesión del iPhone. El descanso
  como estado principal (no como banner secundario) es la decisión que ya se
  validó en `efdfabc`.
- **Distancia**: GPS de doble frecuencia (L1+L5) en `running` y `cycling` —
  ventaja real del Ultra 2. `swimming` apaga GPS y usa acelerómetro + declara
  `HKMetadataKeySwimmingLocationType`. **Sin señal GPS (gimnasio subterráneo,
  túnel): la distancia cae al acelerómetro y el ritmo se oculta en vez de mentir.**
- **Abierto**: no hay serie que cerrar, así que el botón segmenta el tiempo
  (partes, sets de tenis). El registro que se guarda es duración + FC + zonas.

#### 6.3.3 Mapeo a `HKWorkoutActivityType`

| `Discipline` | `HKWorkoutActivityType` |
|---|---|
| `strength` | `.traditionalStrengthTraining` |
| `calisthenics` | `.functionalStrengthTraining` |
| `mobility` | `.flexibility` |
| `running` | `.running` |
| `cycling` | `.cycling` |
| `swimming` | `.swimming` (+ metadata de piscina/aguas abiertas) |
| `team_sport` | **`.other` en v1** — ver §7.3, hace falta decisión |
| `general` | `.other` |

#### 6.3.4 Pantalla siempre activa y lenguaje visual — **DECISIÓN PENDIENTE**

Dos cosas:

**(a) Always-On Display es obligatorio, no opcional.** El Ultra 2 la tiene
siempre; si no se implementa el render reducido (`luminanceReduced`), al bajar el
brazo verás la pantalla atenuada con la UI completa quemando batería y sin
jerarquía. Propuesta: en modo reducido sobreviven el objetivo y la cuenta atrás
del descanso; la FC se atenúa; cero animación.

**(b) Propongo romper el canvas blanco de la marca en el reloj.** Kairos es
off-white cálido `#F7F7F5` + dorado `#C9A96E`. En la muñeca propongo **fondo
negro real**: es OLED (ahorra batería de verdad en una sesión de 90 min), es lo
que hace Apple en entrenamiento, y con 3000 nits al sol un fondo claro es un
foco en la cara. Numerales blancos enormes, y **el dorado exactamente una vez**
por pantalla (el arco de progreso activo o la confirmación) — la regla de marca
se respeta, el lienzo cambia.

> **Esto contradice `src/theme/tokens.ts` como fuente única de verdad y por eso
> requiere el permiso explícito de Álvaro.** Si dice que no, la alternativa es
> off-white en la muñeca, asumiendo el coste de batería y de legibilidad al sol.

---

### 6.4 Tramo 4 · HealthKit y el bucle que se cierra
> **NUNCA PRESENTADO A ÁLVARO.**

- El reloj corre `HKWorkoutSession` + `HKLiveWorkoutBuilder` y escribe un
  `HKWorkout` real con FC, energía activa y distancia. **Los anillos reciben
  crédito.** Esa es la paridad con Apple Fitness que Álvaro pidió en la decisión 3.
- Metadata de Kairos en el workout (nombre del bloque, volumen total, número de
  series) vía el diccionario `metadata`.
- El resumen de FC/energía vuelve como eventos → La Lectura del iPhone gana FC
  media, zonas y kcal reales en vez de estimados.
- **Y aquí se cierra el círculo:** el término de *carga* del Adaptive Readiness
  Engine deja de ser estimado, y sobre todo el gate `confidence === 'high'`
  empieza a poder satisfacerse, porque HealthKit queda activo. **Este proyecto es
  literalmente lo que enciende el motor que se construyó la semana pasada.**
- Requiere: `npx expo install react-native-health` + plugin en `app.config.ts` +
  entitlement de HealthKit + `NSHealthShareUsageDescription` /
  `NSHealthUpdateUsageDescription`. Es el paso de una sola vez ya documentado en
  `docs/superpowers/specs/healthkit-integration.md`.

---

### 6.5 Tramo 5 · Bordes y fallos
> **NUNCA PRESENTADO A ÁLVARO.**

| Situación | Comportamiento diseñado |
|---|---|
| Reloj sin batería a media sesión | El iPhone tiene todos los eventos hasta el último lote entregado; la sesión es recuperable, no se pierde entera |
| Móvil sin batería / en la taquilla | El reloj sigue entero; sincroniza al reconectar |
| Los dos arrancan sesión a la vez | Gana el `session.started` más antiguo; el segundo se rechaza con mensaje claro |
| Evento duplicado o fuera de orden | Dedup por UUID + orden por (`at`, `deviceId`). Es el caso normal, no el excepcional |
| Cola de `transferUserInfo` llena | El buzón se colapsa en un evento-snapshot |
| Sesión huérfana (3 días sin sincronizar) | El iPhone la acepta y la fecha por `at`, no por la hora de llegada |
| Otra app toma el `HKWorkoutSession` | watchOS solo permite una activa: manejar el delegate de interrupción y avisar en la muñeca |
| Llamada entrante / Siri encima | La sesión sobrevive en background gracias a `HKWorkoutSession`; al volver, el estado se re-renderiza del log |
| GPS sin señal | Distancia por acelerómetro; **el ritmo se oculta** en lugar de mostrar un número falso |
| Reloj con hora desviada | `lamport` por dispositivo evita que un salto de reloj reordene eventos del mismo dispositivo; entre dispositivos manda `at` (aceptado como limitación) |
| Build vieja del reloj + build nueva del móvil | Eventos desconocidos ignorados por el reductor total |

---

### 6.6 Tramo 6 · Estrategia de test
> **NUNCA PRESENTADO A ÁLVARO.**

- **TS (vitest, infraestructura existente — 987 tests hoy):** reductor unitario,
  serialización de eventos, proyección de la librería, mapeo
  disciplina→arquetipo→`HKWorkoutActivityType`.
- **Escenarios dorados compartidos:** el mecanismo de §6.2. Los mismos JSON en
  vitest y en XCTest.
- **Convergencia:** tests que barajan, duplican y retrasan eventos y afirman que
  el estado final es idéntico sea cual sea el orden de llegada.
- **Swift (XCTest, target nuevo):** reductor, buzón/marca de agua, mapeo de
  HealthKit.
- **En dispositivo, manualmente:** nada sustituye a una sesión real. Checklist:
  entrenar con el móvil en la taquilla, matar la app del reloj a media serie,
  modo avión, sesión larga con AOD, y una de correr al aire libre para el GPS.

---

### 6.7 Tramo 7 · Fases de entrega y el gate nativo
> **NUNCA PRESENTADO A ÁLVARO.**

| Fase | Contenido | ¿Toca nativo? |
|---|---|---|
| **0 · Pure-core** | `src/lib/watch/`: tipos de evento, reductor, buzón/marca de agua, fixtures dorados, proyección de la librería, mapeo de disciplinas. Todo TS, todo testeable con vitest | **NO.** Se puede construir hoy sin matar Metro |
| **1 · El puente** *(GATED)* | Módulo Expo `modules/kairos-watch-bridge/` + target watchOS + arquetipo Series + `HKWorkoutSession` + HealthKit | **SÍ** — requiere ok explícito |
| **2 · Disciplinas** *(GATED)* | Arquetipos Distancia (GPS, vueltas) y Abierto | **SÍ** |
| **3** | W3 (voz) y W4 (superficies), specs propias | — |

**La fase 0 es sustancial y no requiere permiso de nada.** Es la recomendación
de arranque: llegar con el motor de sync escrito y probado antes de abrir Xcode.

#### Fricción de Xcode que hay que mirar de frente

- `ios/` **está checkeado en git y sucio**. `npx expo prebuild` regeneraría el
  proyecto y es la herramienta equivocada ahora mismo (lo dice
  `docs/LIVE_ACTIVITY_SETUP.md`). Habrá que decidir entre: hacer el target a
  mano en Xcode, o evaluar `@bacons/apple-targets` — **pendiente de verificar si
  su soporte de watchOS es suficiente**, ver §7.4.
- **Hay tres variantes de bundle id** (`com.alvaro.kairos.dev` / `.staging` / a
  secas). La app de reloj necesita su propio bundle id hijo **por variante**, más
  su provisioning.
- Expo Go no puede alojar una app de watchOS. Álvaro ya usa dev-client, así que
  no es bloqueante, pero conviene tenerlo claro.
- **Quedan dos trabajos de Xcode pendientes, no uno:** el target de Live Activity
  (ya escrito, nunca linkado) y el de watchOS. Puede tener sentido hacer los dos
  en la misma ventana de rebuild y aprovechar el viaje.

**Recomendación firme: pasar `/plan-eng-review` antes de tocar nada nativo.**

---

## 7. Decisiones abiertas (esto es lo que hay que resolver al retomar)

### 7.1 La pregunta 8 sigue sin contestar
¿Qué superficies fuera de la sesión construimos? Las opciones que se le
ofrecieron eran: complicación en la esfera, widget de Smart Stack con "Tu estado
hoy" del readiness engine, aviso háptico de fin de descanso siempre, y resumen de
sesión en la muñeca. Redirigió a los requisitos 8b/8c sin elegir. **Es W4, pero
"aviso háptico de fin de descanso" probablemente pertenece a W1** — sin él, el
descanso en la muñeca está a medias.

### 7.2 Versión de watchOS
Dijo "Apple Watch Ultra 2" pero no la versión. Hace falta para fijar el
deployment target y saber si se puede contar con las APIs más recientes. **Pedir:
Ajustes → General → Información en el reloj.**

### 7.3 `team_sport` → ¿qué tipo de workout?
`.other` funciona (registra FC, energía y anillos) pero es genérico. La
alternativa es pedir el deporte concreto al crear el bloque (`.soccer`,
`.tennis`, `.basketball`…), lo que mejora las estadísticas de Apple Fitness pero
añade un campo al modelo de bloques. **Adivinarlo por el nombre del bloque no es
una opción** — es exactamente el tipo de suposición que produjo el bug de
"dominadas = natación" que se arregló en `76d91da`.

### 7.4 `@bacons/apple-targets` vs target manual
Sin verificar. Hay que comprobar el soporte real de watchOS (no solo widgets)
antes de comprometerse. Si no da, es Xcode a mano y documentarlo como se hizo
con `LIVE_ACTIVITY_SETUP.md`.

### 7.5 Fondo negro en el reloj
§6.3.4(b). Necesita su permiso porque contradice el sistema de diseño.

### 7.6 Confirmar los tramos 1 y 2
Se presentaron y quedaron sin respuesta explícita porque pidió este documento.

---

## 8. Riesgos, honestamente

1. **El reductor duplicado es el riesgo número uno.** Los fixtures dorados en CI
   son el único control. Si en el plan se recortan "para ir más rápido", el
   proyecto se pudre.
2. **El alcance es XXL y crece.** Empezó como "companion espejo" y en once
   preguntas se convirtió en: cliente autónomo + sync distribuido + GPS + tres
   arquetipos de UI + agente de voz. Cada decisión individual fue razonable y la
   suma es enorme. La descomposición W1–W4 es lo que lo hace ejecutable; **si se
   colapsa otra vez en "hagámoslo todo de una", no sale.**
3. **La ventana de rebuild nativo es cara** (mata Metro, provisioning, tres
   variantes). Conviene planificarla como un evento consciente y aprovecharla
   también para el target de Live Activity que lleva pendiente desde julio.
4. **GPS y batería** en un Ultra 2 son buenos, pero una sesión de 90 min con GPS
   L1+L5 + FC continua + AOD tiene coste real. Medir, no asumir.
5. **Riesgo de producto:** un reloj que registra series *casi* bien es peor que
   ninguno. Si el marcador miente una vez en un entreno de verdad, se pierde la
   confianza y no vuelve.

---

## 9. Siguiente paso concreto

1. Confirmar §6.1 y §6.2 (tramos 1 y 2).
2. Presentar §6.3, §6.4 y §6.5 — y resolver §7.5 (fondo negro) y §7.3
   (`team_sport`).
3. Presentar §6.6 y §6.7.
4. Con el diseño entero aprobado: reescribir este documento como spec definitiva
   → `superpowers:writing-plans` → `/plan-eng-review`.
5. **Empezar por la fase 0** (pure-core en TS), que no requiere permiso de nada y
   deja el motor de sync escrito y probado antes de abrir Xcode.
6. Nada nativo sin su "ok" explícito.

---

## 10. Referencias

**Docs de este proyecto**
- `docs/LIVE_ACTIVITY_SETUP.md` — trampas de target membership en Xcode
- `docs/superpowers/specs/2026-07-23-adaptive-readiness-design.md`
- `docs/superpowers/plans/2026-07-24-adaptive-readiness-engine.progress.md` — ledger + 6 findings
- `docs/superpowers/specs/healthkit-integration.md` — activación de HealthKit
- `docs/INWORKOUT_GLANCE_MODE.md` — el mandato del marcador glanceable
- `docs/KAIROS_LA_SESION_VIVA.md` — "silencio hacia afuera, vivo hacia adentro"
- `docs/night-run/STRATEGY.md` §5 — el backlog N1..N8 donde nació "N8"
- `docs/HANDOFF_CONTEXT_2026-07-27.md` — el handoff que abrió esta sesión

**Memoria persistente relevante**
- `project_core_vision_voice.md` — voz in-session como moat
- `project_iphone_deploy.md` — cadena de build en el iPhone 12 Pro
- `feedback_autopilot_no_commit.md` — nunca commitear en runs autónomos
- `reference_ui_inspiration_sites.md` — referencias visuales aprobadas
