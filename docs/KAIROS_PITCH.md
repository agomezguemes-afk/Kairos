# KAIROS — Pitch (formato aplicación YC)

_2026-07-03, LOCAL-ONLY. Operacionaliza [KAIROS_ESTRATEGIA_CAPITAL.md](./KAIROS_ESTRATEGIA_CAPITAL.md)
en la narrativa de captación. Redactado como se lee una aplicación fuerte de YC:
frases cortas, cero humo, confronta lo dudoso. Borrador para afilar, no para enviar._

---

**¿Qué hacéis?**
Kairos es un agente vertical de IA para el condicionamiento físico. Programa, ajusta y
reconcilia el entrenamiento de una persona —fuerza, carrera, movilidad, lo que sea— para que
deje de ser su propio coach confundido sin perder el control. No una app de fitness: un
operador residente que corre tu sistema y te lo deja entender en un solo entrenamiento.

**¿Qué problema, para quién, y por qué duele?**
El auto-entrenado serio (híbrido, funcional) se ahoga programándose solo: cose 5 apps que no
se hablan, se estanca o se lesiona por prueba y error, y no va a pagar €200/mes por un
humano. El dolor no es falta de contenido — es la carga cognitiva de ser su propio coach.

**¿Por qué ahora?**
(1) El LLM cruzó el umbral de "operador barato" (núcleo determinista + voz LLM = márgenes de
consumidor). (2) Notion normalizó en 2026 que un agente mantenga tu sistema — cayó la barrera
conductual y dejó abierta la grieta de dominio. (3) La fatiga del wearable maduró un nicho que
mide mucho y progresa poco.

**¿Por qué vosotros / qué insight tenéis que otros no?**
Todos venden "IA que adapta tu plan" (ya commodity). El insight: la adaptación no es el moat
—los modelos la regalan—; el moat es un **sistema propio que compone** (un historial
event-sourced que es tuyo y exportable) + un operador que **razona entre dominios** (tu
carrera compite con tu sentadilla por recuperación — invisible para una app de una categoría).
Poseemos el workflow doloroso, no el modelo.

**¿Cuál es el moat, honestamente?**
Generativo y per-usuario: cuanto más lo usas, más valen tu sistema y el modelo de Kai sobre ti,
y son tuyos (switching-cost tipo Notion/Obsidian, no jaula). Honesto: **no es un moat de red**
en single-player. El moat de red aparece en la capa coach (señal cross-cartera). No lo vendemos
como lo que no es.

**Mercado y por qué es venture-scale (o por qué no).**
Como app individual: gran negocio prosumer, difícil de fondo (fitness software flaquea; sin
hardware —Whoop $10B— ni red —Strava $2.2B—). El vector venture: **individuo (cuña) → coaches
(escala)**. Un coach lleva 20-40 atletas haciendo a mano lo que el operador automatiza; le
multiplica la capacidad → ASP alto, retención alta, y el flywheel de datos cross-cartera. B2C
prueba el operador; B2B2C escala. Playbook Notion sobre un agente vertical físico (tesis YC 2026).

**Modelo de negocio.**
Gratis (log + primer bloque + reglas). Individual ~€15-25/mes (el operador vivo). Coach
~€50-200/mes (multiplica su capacidad). El activo propio que compone es el mecanismo
anti-churn; la métrica que lo prueba: retención de cohorte mes-6 ≫ mes-1.

**¿Qué habéis construido?**
Base real en React Native/Expo: modelo de datos dinámico (campos definidos por el usuario),
cerebro puro y testeado (`metricTrend`, `brain`, `proposal`, `memory`, `reflection`),
onboarding editorial, El Glifo (carácter), superficie de sesión (RestTimer, WorkoutSummary,
ghost values). Arquitectura event-sourced diseñada (el Historial = el log). Falta: cablear el
objetivo vivo, La Lectura como entendimiento, y el log.

**El riesgo que os mata, y cómo lo cubrís.**
La calidad del operador es el producto. Mitigación estructural: decisiones deterministas y
testeables (el LLM solo pone voz), valor antes de IA, humano en el bucle (propones/dispones)
como seguridad. No lo resolvemos con humo, con arquitectura.

**¿Por qué no lo hace ya un gigante?**
Whoop necesita vender hardware; Strava vive de su red; Notion es agnóstico de dominio (jamás
codificará periodización). Cada uno tiene un ADN que le impide ocupar la intersección
"tuyo + operado + nativo del dominio". Nosotros nacemos ahí.

---

## Registro de revisiones
- v1 (2026-07-03) — Pitch tipo YC: qué/para quién/por qué ahora/insight/moat honesto/mercado
  y venture-scale/modelo/tracción/riesgo/por qué no un gigante.
