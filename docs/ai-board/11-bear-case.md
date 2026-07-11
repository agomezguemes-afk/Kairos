# 11 · El caso en contra (Abogado del diablo) — Por qué el pivote voz-first FRACASA

> Encargo: montar el bear case MÁS fuerte contra el pivote de 2026-07-10
> ([08-strategy-voice-first.md](./08-strategy-voice-first.md) + [BACKLOG-v3.md](./BACKLOG-v3.md)).
> Pensamiento independiente y adversarial. Ataco sobre hechos: código real (`src/lib/ai/**`,
> `src/features/onboarding/**`) + evidencia externa. No toco código. No commits.
>
> **Veredicto de una línea:** el pivote abandona el único activo del board respaldado con dinero
> real (doc 05: wedge híbrido, $18/mes ARPU probado) para construir exactamente la categoría que
> ese mismo doc declara commoditizada y en liquidación ("AI fitness" genérica), y lo hace con
> N=1 usuario (Álvaro) y cero contraste de mercado — violando la PRINCIPLES.md del propio board.

---

## Lo que el pivote ES, a nivel de código (no de narrativa)

Antes de atacar, el hecho técnico que desinfla la retórica de "el producto":

- El "motor conversacional adaptativo" (`src/lib/ai/conversation/`) es un wrapper de **Groq
  `llama-3.3-70b-versatile`** (`client.ts`) con **una sola tool**, `build_session`
  (`brief.ts`), cuyo trabajo es rellenar **7 campos**: discipline, focus, duration, location,
  intensity, equipment, notes.
- Esos 7 campos se mapean en `briefToStarterAnswers()` a **`StarterAnswers`** con
  **`frequency: 1`** y **UNA** `StarterDiscipline` de un enum de **seis**
  (strength/running/calisthenics/yoga_mobility/team_sport/hybrid), y se pasan a
  `buildStarterBlocks()` — **plantillas curadas que ya existían** (`starterTemplates.ts`).
- El fallback (`inferBriefFromText`) es **keyword-matching puro** (`t.includes('pierna')`…).
  Cuando el LLM cae, la "conversación adaptativa" colapsa a un `if/else` de palabras clave que
  elige la misma plantilla.

**Traducción:** la "conversación como héroe" es una piel de lenguaje natural sobre un selector
de 6 plantillas. El artefacto que produce es un bloque monodisciplina de plantilla. Eso importa
para los puntos 1, 2 y 5.

---

## 1. Solución en busca de problema — es una FEATURE, no un producto

- **El criterio de éxito del propio pivote lo delata.** BACKLOG-v3 y 08 definen éxito como:
  *"Álvaro (usuario nº1) abre la app, dice una frase, y en <30s tiene un bloque que haría hoy
  sin retocar."* Eso mide un **momento de generación**, con **N=1** y el fundador como único
  usuario. No mide que nadie lo necesite, ni que vuelva, ni que lo termine. YC dice *make
  something people want*; esto optimiza *make something the founder enjoys*.
- **El problema no quita el sueño.** "Me apetece entrenar y no sé qué hacer hoy" tiene sustitutos
  gratis e instantáneos: ChatGPT/Gemini con voz, un reel guardado, o simplemente **repetir la
  rutina de ayer**. No es un dolor con hemorragia. Kevin Hale (YC) puntúa problemas por
  *popular · creciente · urgente · caro/obligatorio · frecuente*: "generar un entreno on-demand"
  falla en urgente (esperable), caro (alternativas gratis) y frecuente (una vez que tienes
  "piernas 40 min en casa", lo repites sin la app).
- **Contraste demoledor:** el doc 05 SÍ encontró un problema con hemorragia — el atleta híbrido
  registrando sesiones mixtas en **Notas/spreadsheet** y pagando **$18/mes** por herramientas
  primitivas. Ese problema es urgente, caro y frecuentísimo (cada sesión). El pivote se aleja de
  él para ir hacia una conveniencia no validada. Un problema que se reduce a "rellenar 7 campos"
  (ver arriba) es un **formulario**, no una necesidad ardiente.

## 2. Foso (moat) — commoditización en modo hard

- **Es el "thin wrapper" de manual.** Wrapper de API + un prompt de sistema + UI. La literatura
  2025-26 es unánime: los thin wrappers no tienen foso, se commoditizan en **~18 meses o menos**,
  y estás **"a una actualización de OpenAI de la irrelevancia"**. Caso testigo: **Jasper**
  ($1.5B de valoración → ingresos -70% en 60 días cuando ChatGPT mejoró). El coste de inferencia
  cayó **-80% entre 2023 y 2025**: fatal si tu único margen era API-cost vs precio.
- **ChatGPT/Gemini ya lo hacen gratis y MEJOR.** "Dame un entreno de piernas de 40 min en casa"
  ya funciona en apps con **mejor modelo, voz nativa y memoria**, sin cuota. Kairos ofrece un
  modelo **inferior** (llama-3.3-70b) **con un cap de cuota** (`useAiQuota.ts`): pides al usuario
  que **pague por ser limitado en un modelo peor** frente a uno superior y gratis.
- **Se copia en un finde — literalmente.** Lo confirmé leyendo el código: es un system prompt
  (`prompts.ts`, ~30 líneas), una tool JSON-schema, y un mapeo a plantillas. Cualquiera con la
  API de Groq/OpenAI lo reproduce en dos tardes.
- **Contradicción interna letal.** El doc 05 —el análisis con revenue verificado— concluye
  textualmente: *"'AI fitness app' genérica ya no es diferenciación... todo el escalón $1-7k MRR
  de 'AI fitness' está en venta simultáneamente"* (Overlo, FitCal, sleep app…) y *"el moat no es
  'tiene IA'... es poseer un segmento con identidad + el modelo de datos que nadie más tiene"*.
  **El pivote construye exactamente la categoría que el board ya declaró commodity y en
  liquidación en Flippa/Acquire.** Está caminando hacia el black hole, no hacia el moat.

## 3. Retención — generar ≠ hacer ≠ volver

- **El pivote no tiene tesis de retención; ni siquiera la mide.** Su test de éxito termina en la
  generación del bloque. No hay métrica de "lo hizo", "volvió el día 2", "3 sesiones en 14 días".
- **Y ese es precisamente EL predictor.** Las apps de fitness pierden **~80% de usuarios en 30
  días** (D30 retention 8-12%); la señal de churn más predictiva es **<3 entrenos en los primeros
  14 días** (churn 3-4x). Las experiencias en solitario churnan **20-35% peor** que las sociales
  — y el pivote es un generador en solitario que aplaza lo social explícitamente.
- **On-demand mata la continuidad.** Cada petición genera un bloque **distinto** (o el mismo
  template otra vez). No hay progresión, ni PRs, ni "sistema de registro", ni razón para abrir la
  app la semana 2: una vez tienes "piernas 40 min en casa", lo repites **sin Kairos**. El moat
  conductual (hábito) exige volver a la **misma** estructura que evoluciona; el generador one-shot
  ofrece lo contrario.
- **El mercado de salida lo castiga a muerte.** RevenueCat/compradores 2026 (citados en doc 05)
  parten de 3-5x EBITDA, exigen **"4+ meses de retención de suscriptor"** y matan deals por
  *"weak retention"*. Stealth Venture con $80k MRR se malvende a 2.0x por retención comprada. Un
  generador sin loop de retorno construye el activo que el mercado descuenta, no el que paga a 10x.

## 4. La voz — la modalidad "ideal" es un lastre en el sitio donde se entrena

- **El gimnasio es el peor entorno posible para voz.** Ruidoso (Whisper transcribe mal en ruido),
  público (**vergüenza de hablarle al móvil** — la literatura lo señala como *"el mayor obstáculo"*
  de adopción de voz), y tras **2 fallos de reconocimiento** el usuario abandona la tarea. La
  ironía fatal: la modalidad "ideal" es la que **no puedes usar donde entrenas**.
- **La UI conversacional pierde contra botones.** Datos de UX: los quick-replies/taps **reducen la
  fricción un 70%** y suben la finalización **40-60%**; *"un chat para hacer lo que se hace con 2
  botones es pura fricción"*; **69%** abandona por confusión. El **Manuscrito** (madlib con chips,
  scrubber, choices — `manuscript.ts`) era **más rápido y de menor fricción** que texto/voz libre.
  El pivote sustituye la interacción de menor fricción por la de mayor.
- **Voz "desde el día uno" invierte el propio playbook YC del board.** BACKLOG-v3 decide meter
  `expo-audio` + Whisper + permisos de micro **antes** de validar con usuarios que alguien quiere
  el output en texto. Eso es front-loadear la modalidad más frágil y cara — lo contrario de
  *launch now / 90-10 / do things that don't scale*. El 90/10 real sería: validar el loop en
  texto con 10 personas; la voz es el 10% que se añade **si** el 90% enamora.

## 5. Tirar trabajo validado por una corazonada — esto es *chasing shiny*

- **Se descarta la evidencia más fuerte que tiene el board: dinero real.** El doc 05 (validación
  con revenue verificado vía Stripe/RevenueCat) nombró un **wedge** (atleta híbrido), un **moat**
  (modelo de datos que modela sesiones mixtas), un **ARPU probado** ($18/mes), un **funnel
  validado** (quiz→reveal→paywall; Cal AI $35M año 1) y un competidor **financiado por YC**
  (HYBRD). El pivote, fechado **2 días después**, degrada TODO eso a *"fuera de foco"* y el wedge
  híbrido a *"parado a medio rebase"*, sobre una corazonada sin un solo usuario nuevo.
- **Se jubila el único activo diferenciado.** El Manuscrito puntuó **8/10 en copy/voz, "único en
  el mercado"** (doc 07). Es la pieza con personalidad propia. El pivote la retira a "fallback".
- **El generador del pivote NI SIQUIERA PUEDE reproducir el moat validado.** Confirmado en código:
  `briefToStarterAnswers` produce **una** disciplina, `frequency: 1`, plantilla monodisciplina.
  La sesión híbrida (erg m/tiempo + sled kg/m + carrera pace + reps en UNA sesión) que el doc 05
  identifica como lo que **ninguna app mainstream modela y Kairos sí** — el generador
  conversacional **no la genera**. Se aleja del moat *y* se incapacita para recrearlo.
- **Viola la PRINCIPLES.md del propio board.** §2: *"Todo se contrasta con el mercado real —
  ingresos verificados, ventures, diseño"*. §1: *"Funcional ≠ entregable"*. El pivote se justifica
  con **cero** contraste de revenue, **cero** referente batido, y un criterio de "que a Álvaro le
  dé gusto" (N=1) que es exactamente el "aprobado por funcional" que §1 prohíbe tras la corrección
  del fundador del sprint 1. El board se está saltando su propia lección.
- **YC en su contra.** *"Make something people want"* ≠ *make something the founder wants to
  build*. Y aunque 08 invoca *"startups solve one problem well"*, elige el problema **equivocado**:
  el criterio YC de "un problema bien resuelto" presupone que el problema sea *popular + urgente +
  caro + frecuente* — atributos que el doc 05 demostró para el logging híbrido y que el "generar
  entreno on-demand" no tiene. Envolver la feature más de moda de 2026 (voz + LLM conversacional)
  y llamarlo "foco" es la definición de *chasing shiny*: se cambió un wedge con caja probada por
  la superficie más hypeada del año.

## 6. Síntesis del golpe

El pivote no es "one problem well": es **el problema equivocado, resuelto con la arquitectura
menos defendible (thin wrapper), en la modalidad más frágil (voz en el gym), optimizando la
métrica que menos importa (generación, no retención), y descartando la única evidencia de dinero
real que el board ha producido** — todo con N=1 y sin el contraste de mercado que sus propios
principios exigen.

---

## Cuándo me equivoco + alternativas más seguras

### Condiciones bajo las que el bear case falla (lo que tendría que ser cierto)

1. **Que el problema real sea la parálisis del lienzo en blanco, no la generación.** Si el dolor
   verdadero es "abro la app y no sé por dónde empezar", la conversación es la **rampa de
   activación más rápida** hacia un sistema retenido — no un juguete. *Requisito:* el bloque
   generado **persiste y progresa** (misma estructura, PRs, semana), de modo que la semana 2 tenga
   motivo. Si la generación desemboca en un programa retenido, deja de ser one-shot.
2. **Que el dogfood N=1 sea señal pre-PMF legítima.** YC avala *"be your own user"*. Si Álvaro lo
   usa **≥3 veces en 14 días** y le cambia la conducta, y **acto seguido encuentra 10 personas**
   que hacen lo mismo, el N=1 era el primer punto de una curva, no una corazonada.
3. **Que la voz gane en un momento concreto donde los botones pierden.** No en el gym ruidoso al
   *pedir* el entreno, sino en **capturar series a media sesión con las manos ocupadas**, o en el
   sofá de casa *antes* de salir. Si el testing muestra **finalización** (no solo generación) con
   voz en ese momento, la modalidad se justifica.
4. **Que emerja un data flywheel.** Si cada sesión conversada + registrada realimenta una
   personalización que ChatGPT no tiene (historial, PRs, patrón de recuperación del usuario), el
   wrapper se "engorda" hacia un moat conductual + de datos con el tiempo. Hoy no existe; sería la
   apuesta a 12-18 meses.
5. **Que sea un wedge de DISTRIBUCIÓN, no de producto.** Si "háblale a Kai y te monta el entreno"
   es el **clip de TikTok** que trae instalaciones baratas hacia el producto retenido del doc 05,
   entonces la conversación es marketing genial aunque no sea el moat. En ese caso el error sería
   confundirla con "el producto" en vez de con "el anzuelo".

### Alternativas más defendibles (ordenadas por fuerza)

- **A — Ejecutar el wedge del doc 05 (la más defendible).** Logging del atleta híbrido + modelo de
  sesión mixta + preset "Hybrid Race" como demo estrella + paywall honesto. Tiene **revenue
  probado** ($18/mes ARPU, Hyrox App $28.7k MRR), **moat** (modelo de datos que nadie replica) y
  **loop de retención** (registrar cada sesión → sistema de registro). La voz/conversación entra
  **después**, como capa de conveniencia sobre ese sistema, no como el producto.
- **B — Conversación como rampa a un sistema RETENIDO, no como generador one-shot.** Mantener el
  loop conversacional, pero que **siembre un programa persistente que progresa** (el mismo bloque
  evoluciona; PRs; estructura semanal). La generación es el gancho; el programa retenido es el
  producto. Convierte el punto 3 (retención) de fatal en tesis.
- **C — Voz donde sí gana: captura in-workout.** Reorientar `expo-audio`/Whisper a **loggear
  series por voz a media sesión** (manos ocupadas, un caso real donde la voz bate al tap), en vez
  de voz-como-intake donde los botones ganan. Menos hype, más jobs-to-be-done.

---

*Documento generado por el Abogado del diablo de la Directiva de IA. Sin cambios de código.
Fuentes de código: `src/lib/ai/conversation/{brief,prompts,blockFromBrief}.ts`, `client.ts`,
`onboardingSpace.ts`, `starterTemplates.ts`, `manuscript.ts`. Evidencia externa accedida
2026-07-10 (retención fitness, commoditización de wrappers, fricción de voz/chat UI).*
