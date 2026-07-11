# 12 · ¿Hay un problema MEJOR que atacar con los mismos activos?

> Product strategist · lente YC (problema real existente + one problem well + do things that
> don't scale) · 2026-07-10. Pensamiento independiente: propone, no valida.
> Baseline a batir: el **pivote conversacional por voz** de [08](./08-strategy-voice-first.md) /
> [BACKLOG-v3](./BACKLOG-v3.md). Evidencia de revenue previa: [05](./05-market-validation.md)
> (dinero en nichos de identidad fuerte + caja negra con IA).

## Activos reales verificados en el código (no promesas)

Antes de reencuadrar, qué existe de verdad — porque el mejor problema es el que exprime el activo
que **nadie más puede copiar**:

- **Modelo de datos dinámico** (`src/types/core.ts`: `FieldDefinition` con `unit`/`isPrimary`, campos
  numéricos arbitrarios por ejercicio). Modela peso, reps, distancia, pace, metros de erg, RPE… en un
  mismo bloque. **Ningún competidor mainstream con esquema fijo de "ejercicio de gimnasio" tiene esto.**
- **Analítica de progresión ya construida**: `src/lib/history/exerciseHistory.ts` (serie temporal por
  ejercicio, volumen, top set), `src/lib/ai/predictions.ts` (**regresión lineal → "cuándo llegas a X"**),
  `src/lib/ai/insights.ts` (**detección de plateau** por semanas estancadas). Analiza cualquier campo
  numérico en el tiempo — el requisito núcleo del modelo dinámico.
- **Import CSV Strong/Hevy** (`src/lib/import/`), tolerante a nombres sucios y a columnas de distancia/tiempo.
- **Motor agente tool-use + generador de bloques** (`src/lib/ai/agent.ts`, `tools/`, `onboardingSpace.ts`).
- **Motor conversacional a medio construir** (`src/lib/ai/conversation/`: engine, brief, prompts) — el pivote.
- **scheduleStore** (Hoy/semana), **readiness**, **Kai** (coach/chat/greeting), **HealthKit** (abstracción lista, sin cablear).

**El sesgo del pivote 08**: lidera con el activo de MENOR moat (otro generador IA por voz) y **degrada a
fallback** el activo de MAYOR moat (el modelo dinámico multidisciplina, relegado a "preset invocable por
la conversación" en BACKLOG-v3). Eso es exactamente al revés de donde está la defendibilidad.

---

## Crítica al baseline (el pivote conversacional por voz)

Tres grietas, con evidencia:

1. **Ataca la superficie MÁS saturada y mejor financiada de 2026.** La voz conversacional para fitness
   ya es océano rojo: **Vora (YC, voz-first, 6 personalidades IA, ElevenLabs)**, **Ray** (voz + visión por
   computador contando reps), **FitEcho** (voz-first para trainers), VoiceFitLog, Gym Journal AI. La voz es
   commodity (Whisper); "conversación → bloque generado" es literalmente lo que Vora y GymStreak ya venden.
   ([askvora.com](https://askvora.com/voice-coaching), [fitecho.ai](https://fitecho.ai/blog/what-is-fitecho-voice-workout-tracker), [rayfit.com](https://www.rayfit.com/blog/2026/02/best-ai-personal-trainer-app/))
2. **Resuelve un "want", no un "need".** Generar un bloque on-demand porque "me apetece entrenar" lo hace
   ChatGPT gratis. No es el dolor desesperado de nadie; es conveniencia.
3. **Rema contra la retención que el mercado premia.** Un bloque nuevo cada vez = sin hilo de progresión,
   sin razón para volver a TU sistema mañana. Es el modo de fallo de Fitbod (usuarios fuera tras ~7 workouts,
   doc 02). La retención de 14 días —el activo que se paga a 10x (doc 05)— la construye la continuidad, no la generación.

Su única fortaleza real: ~90% está construido y es "one problem well" limpio. Pero *one problem well* solo
gana si es el problema **correcto**.

---

## Alternativa A — El hogar del atleta híbrido ⭐

**Problema real:** una sesión híbrida/HYROX mezcla erg (m/tiempo), sled (kg/distancia), carrera (pace) y
estaciones (reps). **Ninguna app mainstream modela UNA sesión con métricas por estación**; el atleta
fragmenta en Strava + Hevy + Notas/spreadsheet y no sabe si progresa de forma holística ni gestiona la
fatiga cruzada.

**Para quién:** el atleta híbrido con identidad fuerte ("hago HYROX"). Segmento en explosión: **~1,5M
participantes HYROX en 2026** (121 eventos, 34 países), categoría de **~$1B**, guerra de marca Puma/Adidas,
disposición a pagar $300–800 por ciclo de 8–12 semanas. ([sgieurope.com](https://www.sgieurope.com/consumer/hyrox-becomes-a-brand-battlefield/119782.article), [businessmodelanalyst.com](https://businessmodelanalyst.com/hyrox-business-model-economics/))

**Por qué duele:** paga 2–3 suscripciones en paralelo, registra la sesión mixta en Notas, y ninguna
herramienta le dice "¿estás mejorando en las 8 estaciones?".

**Activo que lo hace posible:** el **modelo de datos dinámico** (modela la sesión mixta nativamente — lo
no copiable) + **import CSV** (trae su historial de Strava/Hevy) + **predictions/insights** (progresión
sobre CUALQUIER campo numérico, cross-disciplina) + canvas de bloques (la semana de race-prep como sistema).

**Por qué paga vs. gratis:** ARPU de nicho apasionado dobla al generalista — Hyrox App **$28,7k MRR a ~$18/mes**
con solo 1.584 subs; se pidió a **9,8x con 6 ofertas** = moat de comunidad, no de código (doc 05). Ninguna app
gratis modela la sesión mixta; la alternativa es 2–3 subs + spreadsheet.

**Riesgo a navegar:** **Strava está commoditizando la AGREGACIÓN** (update de fuerza 2026, muscle maps, 14
integraciones, Hevy→Strava). ([stories.strava.com](https://stories.strava.com/articles/stravas-new-strength-update-is-built-for-athletes-who-do-it-all)) → **No competir en "ver todas mis actividades juntas" (Strava gana).** Competir en **modelado nativo + progresión** de la sesión mixta, que el feed lado-a-lado de Strava no hace. Marca HYROX registrada: usar "hybrid race", no el trademark.

## Alternativa B — El refugio del spreadsheet

**Problema real:** el lifter con criterio corre nSuns/GZCL/Reddit PPL en Google Sheets porque **ninguna app
le deja meter SU programa con SUS reglas de progresión**. Strong es un tracker mudo ("no te dice qué sigue");
Fitbod es una caja negra aleatoria. (Gap 1, doc 02; [liftvault](https://liftvault.com/programs/strength/reddit-ppl/), [setgraph](https://setgraph.app/ai-blog/best-workout-planner-reddit-recommends))

**Para quién:** el lifter autodirigido intermedio/avanzado. **Población enorme pero DIY y barata.**

**Por qué duele:** el spreadsheet es torpe en el móvil al pie del rack, sin gráficas de historial, sin PRs, con
la matemática de progresión a mano.

**Activo:** modelo dinámico + canvas (su programa, sus reglas) + import + analítica de progresión + Kai como
sugeridor **determinista** de siguiente paso/overload sobre SU historial (no caja negra).

**Por qué paga vs. gratis:** paga en fricción hoy — pero es un segmento DIY que valora "que se aparte de mi
camino" y ancla barato (Strong $50/año, Hevy $30/año, spreadsheet gratis). **Dolor real y durable, pero ARPU
bajo y exigente.** Es el wedge original de doc 02; techo más bajo que A.

## Alternativa C — "¿Qué hago hoy?" en un tap (la caja negra CON control)

**Problema real:** la gente paga **$100+/año por que le digan qué hacer hoy** (GymStreak **~$208k MRR**, Fitbod)
pero odia la caja negra y el billing con dark patterns (BH#2, doc 05). El insight decisivo: **GymStreak monetiza
esto con CERO voz** — solo una sesión de hoy a un tap.

**Para quién:** el mismo usuario-objetivo del pivote (el que no quiere decidir), pero atacado por la superficie
**probada** en vez de la contestada.

**Activo:** scheduleStore (Hoy/semana) + Kai Signals deterministas (offline) + predictions/insights + generador +
import. Casi todo especificado ya en P0-2/P0-3 de docs 02/05.

**Por qué paga vs. gratis:** es literalmente lo que GymStreak/Fitbod ya cobran; el wedge es **"control + honestidad"**
(X visible, aviso pre-cobro, export libre) contra su dark billing (safety score 31,5/100).

**Relación con el pivote:** es el **MISMO problema que eligió el pivote, menos la modalidad contestada.** Más
barato, más cerca del revenue probado, esquiva el océano rojo Vora/Ray/FitEcho. La voz pasa a fast-follow, no a apuesta.

---

## Descartadas (por qué no)

- **Coach que gestiona clientes (B2B2C):** producto distinto (roster, asignación, multi-tenant, auth de coach),
  cero infra construida, rompe "one problem well", esfuerzo alto. Fuera de foco.
- **Migración/lock-in como problema-héroe:** el import CSV es el **canal** más barato (mata el miedo a perder
  historial, Gap 4), pero **nadie paga por migrar** — se paga por lo que viene después. Es la rampa de entrada a
  A/B/C, no un problema para liderar.

---

## Tabla comparativa

Puntuaciones 1–5 (5 = mejor para Kairos). "Dolor" = intensidad del problema real; "one problem well" = foco/pureza.

| Encuadre | Dolor real | Evidencia de demanda | Defendibilidad / moat | Esfuerzo sobre lo construido | One problem well |
|---|:--:|:--:|:--:|:--:|:--:|
| **Baseline — Pivote conversacional por voz** | 3 · es un *want*; ChatGPT lo hace gratis | 3 · demanda existe pero **oferta también**: Vora/Ray/FitEcho (YC) saturan | **2** · voz = commodity Whisper; genera como todos; **banca el único activo no copiable** | 3 · engine a medias, pero STT+audio+UI+permisos reales | 4 · foco limpio, pero del problema **equivocado** |
| **A — Hogar del atleta híbrido** ⭐ | 4 · fragmentación verbalizada | **5** · Hyrox $28,7k MRR @ ~$18/mes; 1,5M part. 2026; $1B; HYBRD (YC) | **5** · modelo dinámico = no copiable por esquema fijo; comunidad = múltiplo 9,8x | 4 · assets existen (preset + import + ASO); coste = GTM por nicho | 4 · identidad tensa; expande a fuerza/running como subconjuntos |
| **B — Refugio del spreadsheet** | 4 · real y durable (Reddit) | 3 · población enorme pero **DIY y barata** ($30–50) | 3 · dynamic fields ayuda, pero Strong/Hevy/Setgraph compiten de frente | 4 · assets existen; falta UX de autoría de programa | 4 |
| **C — "¿Qué hago hoy?" en un tap** | 4 · decision fatigue **pagada** | **5** · GymStreak ~$208k MRR; Fitbod; categoría probada | 3 · moat = confianza + grounding en TU historial (medio) | 3 · scheduleStore+Signals ya existen; cablear loop determinista + paywall honesto | 5 · un loop, superficie probada |

---

## Recomendación

**No. El pivote conversacional por voz NO es el problema más fuerte para estos activos.** Lidera con el activo
de menor moat (otro generador IA) hacia la superficie más saturada y mejor financiada de 2026, resuelve un
*want* que ChatGPT ya cubre, rema contra la retención de 14 días, y **degrada a fallback el modelo de datos
dinámico — lo único que ningún competidor puede copiar.** Su ventaja ("90% construido, one problem well") solo
importa si el problema es el correcto, y la evidencia dice que no lo es.

**El problema más fuerte es la combinación A + C, con el modelo dinámico como héroe:**

1. **Liderar con A (el hogar del atleta híbrido) como wedge de identidad y posicionamiento.** Es donde
   convergen el dinero (ARPU 6x), el moat (modelo dinámico no copiable + comunidad a 9,8x) y el crecimiento
   (HYROX 1,5M/2026). Usa el activo que nadie puede replicar. Posicionar en **modelado + progresión de la sesión
   mixta**, NO en agregación (esa la gana Strava).
2. **C (el "qué hago hoy" honesto, a un tap) como motor de retención DENTRO del wedge.** Es la superficie que
   GymStreak ya monetiza a ~$208k MRR y lo que hace volver al híbrido cada día. Da la continuidad que la generación
   on-demand destruye.
3. **Import CSV como canal de adquisición** de ambos (llega con su historial intacto, ve PRs y tendencias el día 1).
4. **Degradar la voz a fast-follow: es una feature de A/C, no una estrategia.** Whisper sobre el pipeline de C
   cuesta poco; pero la voz no es el wedge, y liderar con ella es entrar sin moat al océano rojo.

**B (refugio del spreadsheet) es la expansión natural, no el arranque:** mismo motor, ARPU más bajo; se gana solo
cuando A está ganado (híbrido → fuerza pura es un subconjunto, no un pivote).

**Cambio de una frase respecto a 08/BACKLOG-v3:** invertir la jerarquía — **el modelo dinámico multidisciplina
pasa de "fallback invocable por la conversación" a HÉROE; la conversación por voz pasa de héroe a modalidad de
entrada opcional.** Mismos activos, se lidera con el que tiene moat.

---

*Documento generado por la Directiva de IA de Kairos. Sin cambios de código. Fuentes accedidas el 2026-07-10.*
