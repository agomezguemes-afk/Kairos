# 09 · Juez de encaje YC — El pivote voz→bloque (2026-07-10)

> Evaluador: socio de YC, pensamiento independiente. Marco: YC Pocket Guide.
> Material leído: 08 + BACKLOG-v3 (el pivote), 01–07 (historia, wedge híbrido, teardown 5.7/10),
> CLAUDE.md, y el CÓDIGO real (`src/lib/ai/**`, `src/features/onboarding/**`, `src/store/**`).
> Verificación externa: Ray (rayfit.com), FitnessAI, uso real de ChatGPT para entrenos.

---

## Veredicto

**El problema tiene una raíz real, pero el pivote lo resuelve en su versión de VITAMINA, no de analgésico, y en la casilla del mercado donde compite contra GRATIS.**

El "job" subyacente — *"no quiero pensar qué entreno hoy, dime tú"* — existe y es frecuente: la gente ya se lo pide a ChatGPT a diario. Eso es señal de demanda. Pero el pivote lo empaqueta como *"habla con Kai y recibe un bloque"*, que es **exactamente lo que ya hacen (a) ChatGPT gratis, en 5 segundos, sin instalar nada, y (b) Ray a 19,99 $/mes con voz + visión + adaptación en tiempo real**. El pivote coge la INTERACCIÓN correcta (conversación/voz on-demand) y la aplica al SEGMENTO equivocado (el gym-goer genérico), tirando por la borda el único analgésico con ingresos verificados que los propios docs 02/05 habían encontrado: el atleta híbrido que hoy registra en spreadsheet porque ninguna app modela su sesión mixta, y que paga ~18 $/mes (Hyrox App: 28,7k$ MRR).

Dicho sin piedad: **cambiasteis un painkiller con moat de datos por una vitamina sin moat, y lo llamasteis "enfocar".**

### Realidad del código (qué existe vs. qué es aspiración)

El pivote es de ayer y está **andamiado, no construido**:

- ✅ Existe la cimentación: `conversation/brief.ts` (schema valibot en el boundary + inferencia determinista desde texto libre), `conversation/blockFromBrief.ts` (builder determinista), `conversation/prompts.ts`, `conversation/types.ts`, y un cliente Groq real con streaming SSE + cuota (`client.ts`).
- ❌ **No existe el motor** que orquesta el diálogo (los tipos referencian `intakeTurn`/`defaultDeps`, sin implementación). **No existe la pantalla "Hoy".** **No existe voz** (cero `expo-audio`/`whisper` en `src/`). **Nadie importa `ai/conversation`** (grep = 0 hits fuera del propio módulo).
- ⚠️ Lo que HOY arranca sigue siendo el OS: Manuscrito (formulario madlib de 6 preguntas), canvas de bloques, gamificación, badges, PR cards, árbol de progreso, AI Lab. El pivote convive con todo eso.
- ⚠️ El "bloque personalizado" del path determinista es hoy `buildStarterBlocks()[0]` renombrado — **una plantilla starter, no un bloque personalizado por historial**. La adaptación "con historial" (coach/insights) NO está cableada al loop conversacional. A día de hoy, sin LLM, Kai te da una plantilla con otro título.

---

## Análisis por los 5 puntos

### 1 · ¿Problema real o inventado? ¿Vitamina o analgésico?

**Raíz real, intensidad baja, con sustitutos gratis.** La fricción "¿qué hago hoy?" es genuina y recurrente, pero:

- **Sustitutos abundantes y gratis**: ChatGPT, YouTube, tu rutina de siempre, el bloque de la semana pasada. Nadie está *sangrando* por esto.
- **Quién lo tiene de verdad y con qué intensidad**: el gym-goer genérico lo tiene como molestia leve (vitamina). El que lo tiene como ANALGÉSICO es otro perfil — el atleta híbrido/multidisciplina que *no puede ni registrar* su sesión (erg + sled + carrera + reps) en ninguna app, y por eso paga premium a herramientas primitivas. **El pivote apunta al primero y abandona al segundo.**
- **N=1**: el único usuario validado es Álvaro. "Build something people want" hoy es "build something Álvaro wants". Legítimo como arranque (dogfooding), pero **cero señal de demanda externa para ESTE loop concreto**.

Veredicto punto 1: **vitamina para el público que el pivote elige; había un analgésico disponible y se descartó.**

### 2 · ¿"Hablar con IA y recibir un entreno" es algo que la gente YA quiere/hace, o un "sería guay"?

**Ya lo hace — y ahí está el problema, no la validación.** Que la gente use ChatGPT para esto prueba que el want existe, pero también prueba que **el status quo ya lo cubre por 0 €**. Y no es un hueco vacío: **Ray** ya vende voz + adaptación en tiempo real + programación semanal a 19,99 $/mes; FitnessAI, BodBot, Zing llevan años. La pregunta YC letal es: **¿por qué abriría Kairos en vez del ChatGPT que ya tengo?** La única respuesta defendible es *"porque el bloque cae en un sistema que lo registra y aprende de mí"* — el loop cerrado que ChatGPT no tiene. Pero eso hoy **está afirmado, no construido**: el loop no aprende del historial todavía.

### 3 · ¿Pasa el filtro "one problem well"?

**En el papel sí; en el binario, no.** El doc 08 "demota" el OS — pero *demota*, no *borra*. El código sigue siendo un OS completo con un módulo de intake enchufado al lado. El tell es lingüístico y real: si de verdad creyeras "un problema bien resuelto", **borrarías** el canvas, la gamificación y el Manuscrito del build de prueba, no los "conservarías como fallback". Mantenerlos es hedging. Riesgo concreto: que el loop se convierta en **otra feature** del OS en vez de en el producto entero. Hoy Kairos falla este filtro.

### 4 · ¿Superaría una entrevista de YC?

**Steelman (el mejor caso a favor):** El fundador dogfoodea, puede shippear el loop en un día (el 90% de infra existe), la voz reduce fricción real, y hay una cuña fina pero verdadera frente a ChatGPT: **el bloque generado no es texto muerto — cae en un logger real y (en teoría) se adapta a tu historial**. Si con 10 usuarios el loop retiene sin empujarlos, es señal. "Do things that don't scale + launch now" están perfectamente servidos por esta arquitectura.

**El ataque (por qué no pasa hoy):**
- **Un usuario, cero demanda externa** para el loop concreto.
- **Compite contra gratis (ChatGPT) y contra financiado (Ray).** "Hablar con IA y recibir un entreno" es una *feature*, no una *empresa*: clonable en un fin de semana, sin moat, sin ventaja de datos el día 1.
- **El pivote tiró lo único YC-shaped de la tesis vieja**: poseer el segmento híbrido + el modelo de datos que nadie más tiene = moat + nicho que paga 6x. Eso era un negocio; "chat que da entrenos" es un wrapper.
- **Modo de fallo YC de manual**: resolver tu propio problema, en una categoría saturada, sin cuña, y llamar "pivote" a un estrechamiento que en realidad no borra nada.

**Growth = producto (no al revés):** el crecimiento no llega porque el producto **no es 10x mejor que ChatGPT** para ese momento. Iguala a ChatGPT y añade el coste de instalar una app. No hay palanca de crecimiento.

Veredicto punto 4: **hoy, no.** Con la fusión que propongo abajo, es discutible.

### 5 · ¿Qué tendría que ser CIERTO? (condiciones falsables)

1. **Preferencia sobre ChatGPT.** ≥10 usuarios NO-Álvaro eligen Kairos para este momento ≥3x/semana en vez de su hábito de ChatGPT. *Falsado si* siguen usando ChatGPT tras probar el loop.
2. **Bloques usables sin retoque** (el propio criterio del doc 08). Álvaro y testers hacen el bloque **sin editar >30%** de las veces. *Falsado si* editan más.
3. **El loop cerrado dispara de verdad.** La 2ª sesión refleja el rendimiento de la 1ª (adaptación por historial), no una plantilla renombrada. *Falsado si* el bloque del día 2 ignora el día 1 — que es el estado actual del path determinista.
4. **Retención de nicho.** Esos 10 siguen usándolo en semana 4 sin nagging (YC: 10–100 que lo aman). *Falsado si* la curva es plana tras la novedad.
5. **Diferenciación defendible.** Existe algo que ChatGPT estructuralmente NO puede hacer (registrar+adaptar una sesión híbrida trackeable). *Falsado si* la única diferencia es "tiene voz" — Ray ya la tiene.

---

## Conclusiones y alternativas

**Mi diagnóstico independiente: la interacción del pivote es correcta; el "quién/por qué" es incorrecto. No hay que elegir entre el doc 08 y el doc 05 — hay que FUSIONARLOS.**

1. **Fusiona el loop con la cuña híbrida (la jugada fuerte).** La versión analgésica de este producto es: *"la forma más rápida del mundo de programar Y REGISTRAR una sesión híbrida hablando"*. Eso es lo único que ChatGPT no puede hacer (no te mete erg-metros + sled-kg + run-pace en una estructura trackeable), ataca a un segmento que hoy usa spreadsheet (painkiller real), apalanca el moat de datos dinámicos que Kairos YA tiene, y va a un ARPU de 18 $/mes. El pivote acertó la INTERACCIÓN (voz on-demand); el doc 05 acertó el WHO/WHY. Únelos.

2. **Responde "¿por qué no ChatGPT?" con producto, no con copy.** El diferencial debe ser el loop CERRADO —bloque hecho → registrado → el siguiente se adapta— y hay que CONSTRUIRLO y SENTIRLO, no afirmarlo. Cablea `coach.ts`/`insights.ts` al motor conversacional antes de shippear, o el día 1 eres un wrapper de Groq.

3. **Lanza a 10 usuarios reales (no-Álvaro) esta semana y mide preferencia vs. ChatGPT.** Si no vuelven, el diagnóstico es "vitamina": itera el WHO (a qué nicho sirves), no el diálogo. El listón no lo pone Álvaro pasándoselo bien; lo pone un extraño volviendo el jueves.

4. **Si crees en "one problem well", demuéstralo borrando, no demotando.** Para el build de prueba, esconde canvas, gamificación, badges y Manuscrito. Ship SOLO el loop. Mantenerlos "como fallback" es no haber pivotado.

5. **Construye el motor y la superficie antes de tocar la voz.** Voz es fast-follow correcto (doc 08 lo dice), pero hoy no existe ni el orquestador ni la pantalla "Hoy". El 10% que falta es el 100% del producto. La voz sin el loop cerrado detrás es un truco de demo que Ray ya hace mejor.

**En una frase:** el pivote es la mitad correcta de una buena idea. La otra mitad la escribió el doc 05 y la borrasteis. Volved a pegarlas: *voz → conversa → te monta y te registra una sesión (híbrida) que ChatGPT no sabe modelar*. Eso sí es "un problema, bien resuelto, para alguien que hoy sangra".

---

*Fuentes externas: Ray (rayfit.com, AI trainer por voz, 19,99 $/mes, adaptación en tiempo real); FitnessAI/BodBot/Zing (categoría saturada); uso corriente de ChatGPT para generar entrenos. Sin cambios de código. Consultado 2026-07-10.*
