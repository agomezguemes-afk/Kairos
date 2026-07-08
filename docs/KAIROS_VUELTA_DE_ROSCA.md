# KAIROS — La vuelta de rosca

_Documento de trabajo para que Álvaro reaccione. Escrito 2026-07-02 en el worktree
de seguridad, LOCAL-ONLY, cero cambios de código. No es un plan a ejecutar: es una
**redefinición de producto** fundamentada y contrastada contra la realidad de mercado
de julio 2026. Continúa (y en un punto contradice) a [KAIROS_VISION.md](./KAIROS_VISION.md),
[KAIROS_CRITIQUE.md](./KAIROS_CRITIQUE.md) y [KAIROS_ARCHITECTURE_OPTIONS.md](./KAIROS_ARCHITECTURE_OPTIONS.md).
Donde este documento y la visión discrepen, gana este — porque este mira el mercado
de hace tres semanas, no de hace tres meses._

---

## 0. La tesis en una línea

> **Kairos no es una app de fitness ni un coach de IA. Es el primer sistema
> operativo personal para el cuerpo: un mundo de entrenamiento que tú redactas y
> que un operador residente (Kai) mantiene reconciliado con la realidad — y todo
> lo que hace se acumula en un historial que es tuyo y compone. No una app que
> usas. Un sistema que corre, y una obra que conservas.**

La vuelta de rosca no es "mejor IA". Es cambiar el **verbo del producto**: de
*trackear* (lo que hacen todos) a **operar** (lo que no hace nadie), y de *usar una
app* a **poseer un sistema que se opera solo**.

---

## 1. Por qué lo incremental ahora es muerte (contraste, julio 2026)

La visión de junio identificó bien la grieta. El problema: **el mercado se movió en
tres semanas y erosionó dos de nuestros tres diferenciadores.** Hay que mirarlo de
frente.

**Erosión 1 — "IA adaptativa" ya es commodity.** En 2026, adaptar un plan según
recuperación/feedback es la línea base, no el borde. Centr AI ajusta el calendario
semanal según tasa de finalización; Freeletics AI Coach adapta con un motor
entrenado sobre millones de sesiones; Vi Trainer ajusta ritmo e intensidad en tiempo
real. [8ration][skycrumbs] Si el pitch de Kairos es "un coach de IA que se adapta a
ti", ya lo dicen diez apps con más datos y más dinero. **La calidad de adaptación no
es defendible como diferenciador.** (Esto confirma el miedo de la propia crítica §7.1:
"agent quality is the product" — sí, pero *ya no es el diferenciador*, es el ticket
de entrada.)

**Erosión 2 — "el canvas que se mantiene solo" ahora es de Notion.** En mayo 2026
Notion convirtió su workspace en un hub de agentes: Autofill "mantiene tus datos
frescos, enriqueciendo y categorizando sin revisión manual"; los Custom Agents corren
por schedule "para que tu base de datos siga siendo fiable sin revisión manual".
[techcrunch][notion-agents] El argumento de la visión §1 —"Notion no tiene cerebro,
tú lo mantienes"— **acaba de caducar**. Notion ya tiene agentes que lo mantienen.

Si nos quedamos donde estábamos, en seis meses somos "un Notion de fitness peor que
Notion + un coach de IA peor que Freeletics". Dos vitaminas apiladas. Cero moat. Eso
es exactamente el veredicto que la crítica temía.

**Pero la erosión abre la grieta real.** Miremos qué NO hace ninguno de los dos:

| | Canvas propio, componible, **exportable** | Cerebro **nativo del dominio** (física de carga/adaptación/periodización) | Se **opera** solo (reconcilia plan↔realidad) |
| --- | :---: | :---: | :---: |
| WHOOP / Oura / Garmin | ✗ (app cerrada) | ~ (solo HRV/intensidad) | ✗ |
| Freeletics / Centr / Vi | ✗ (plan que alquilas) | ✓ | ~ (ajusta un plan) |
| **Notion + agentes (2026)** | ✓✓ | **✗ (no sabe qué es entrenar)** | ~ (mantiene *notas*, no un dominio) |
| Human coach ($200/mo) | ✗ | ✓ | ✓ — pero no es tuyo |
| **Kairos** | **✓✓** | **✓✓** | **✓✓** |

Las dos columnas críticas —**cerebro nativo del dominio** _y_ **sistema propio que se
opera**— no las cruza nadie. Notion tiene lo primero sin lo segundo: sus agentes
mantienen *información*, pero Notion es agnóstico de dominio por diseño y **jamás va a
codificar física de periodización** — no es su negocio. Freeletics tiene el dominio
sin lo primero: es un generador de plan cerrado que no posees ni exportas. **Kairos es
el único punto donde un canvas que es tuyo tiene dentro un operador que de verdad
entiende el dominio.** Eso no es una feature. Es una categoría.

---

## 2. El Punto de Vista (la categoría que hay que nombrar)

Category design es explícito: el 76% del valor de un mercado se lo lleva quien **crea
y nombra la categoría**, no quien gana la guerra de features. [chartmogul][playbigger]
El entregable de más valor no es una lista de features — es un **Punto de Vista**: una
lectura del problema que reordena el tablero.

**El Punto de Vista de Kairos:**

> Todo producto de entrenamiento hoy te obliga a elegir entre dos pérdidas. O te
> **quitan el sistema** y te alquilan un cerebro (WHOOP, Freeletics: adaptan un plan
> que no es tuyo, en una caja que no puedes abrir). O te dan un **lienzo sin cerebro**
> que tú mantienes (Notion: ahora hasta te ordena las notas, pero no tiene ni idea de
> qué es entrenar). En ambos casos, a los seis meses no tienes nada acumulado que sea
> **tuyo y valga más por haber esperado**.
>
> Kairos es el primero que no te hace elegir: **es tuyo Y está operado.** Un sistema
> operativo para tu cuerpo — lo redactas tú, lo corre un operador que entiende el
> dominio, y cada decisión se queda escrita en un historial que es tu propiedad y
> compone con el tiempo.

El nombre interno de trabajo —el que le diste tú— es el más preciso para ingeniería e
inversores: **"un ERP personal para el cuerpo"**. Un ERP no es un tracker ni un
documento: es el *sistema de registro que corre las operaciones de una organización* —
planifica capacidad, asigna recursos, reconcilia lo planeado con lo real. Eso es
exactamente lo que Kairos hace con tu cuerpo, y es una analogía que ninguna app de
fitness puede reclamar sin sonar ridícula, porque ninguna está construida como un
sistema operativo. (El nombre de cara al usuario **no** es "ERP" —demasiado frío—; ver
§5. "ERP personal" es el frame para pensar y para pitchear el porqué.)

**Y "el dominio" no es fuerza — es todo el condicionamiento físico** (decisión de Álvaro,
2026-07-03): fuerza, carrera, movilidad, deporte, lo que sea. No por ambición de super-app,
sino porque el operador nativo del dominio, al ver *todo lo que una persona hace a la vez*,
puede razonar **entre** dominios — _"tu carrera subió y la sentadilla se estancó: compiten
por recuperación"_ — algo que una app de una sola categoría no puede decir estructuralmente.
Ese razonamiento cruzado es el moat anti-fragmentación (el híbrido cose 5 apps que no se
hablan). La disciplina que lo salva de la dilución: **"todo" = todo lo que hace *esta
persona*, no todo para *todo el mundo*.** El cómo (arquetipos + semántica de métricas, un
solo motor) vive en [KAIROS_LA_SESION_VIVA.md](./KAIROS_LA_SESION_VIVA.md) §2.5.

### 2.1 Por qué ahora (y no hace dos años)

El test que separa una categoría real de un deseo: *¿por qué es posible ahora?* Tres
vientos de cola que en 2024 no existían y que se alinean justo este año:

1. **La economía del LLM cruzó el umbral del "operador barato".** El patrón
   determinista-primero + LLM-solo-como-voz (ARCHITECTURE §1b) hace que correr un
   *operador de dominio* continuo salga a márgenes de consumidor. Un cerebro que
   reconcilia todos los días era carísimo o alucinado hace dos años; hoy el núcleo son
   funciones puras (gratis, offline) y el LLM solo redacta.
2. **Notion acaba de educar al mercado por nosotros.** Al lanzar agentes que mantienen
   tu workspace (mayo 2026), Notion normalizó la conducta que antes era la barrera:
   "que un agente cuide mi sistema mientras no miro" pasó de raro a esperado. Notion
   probó el concepto **y dejó abierta la grieta de dominio** — hacemos surf sobre la ola
   que ellos crearon sin competir con ellos.
3. **La fatiga del wearable maduró el nicho.** Media década de sobre-tracking dejó a un
   segmento entero que *mide mucho y progresa poco* — el auto-entrenado que se ahoga en
   sus propios datos. Ese cansancio de anillos y gráficas es precisamente la demanda de
   "que alguien de confianza me lo opere y me devuelva la atención".

---

## 3. Las cuatro vueltas de rosca (contrastadas), y por qué se componen en una

No presento una idea: presento cuatro giros, cada uno con su contra honesta, y luego
demuestro que **no son rivales — son las cuatro caras de un mismo producto.** Ese es el
ingenio: no elegir, sino ver que encajan.

### Giro A — "Reconciliación": matar el verbo *trackear*

**La idea.** El átomo de Kairos no es *una sesión registrada*. Es un bucle continuo
**plan ↔ realidad ↔ re-plan**. Kai sostiene un plan operativo rodante de tu capacidad;
cada sesión *reconcilia* el plan contra lo que de verdad pasó (lo que hiciste + cómo te
sentiste), y Kai re-planifica el horizonte. **Nunca "haces un plan" y nunca "sigues un
plan"** — el plan es una cosa viva que se mantiene fiel a la realidad sola. Es
S&OP/MRP (la planificación operativa de un ERP) aplicada al cuerpo.

**Por qué es disruptivo, no incremental.** Freeletics *ajusta un plan*: hay un plan, se
queda viejo, se retoca. Kairos **nunca tiene un plan viejo que retocar** porque la
reconciliación es continua — el desajuste entre lo planeado y lo vivido *es* la
superficie del producto, no un evento. Trackear es mirar atrás; reconciliar es mantener
el presente y el futuro coherentes con lo que tu cuerpo acaba de decir.

**Dónde falla / la contra honesta.** Puede sonar abstracto y frío (quantified-self de
juguete) si no aterriza en **beneficio sentido hoy** — la trampa que la crítica §3 ya
marcó vía Segar. La reconciliación tiene que *sentirse* como "abro la app y ya está
resuelto lo de hoy", no como un panel de varianzas. Riesgo real: sobre-ingeniería de un
concepto de ERP que al usuario le da igual.

### Giro B — "El Historial": el moat convertido en el centro del producto

**La idea.** La crítica §4 fue tajante: el único moat de software posible es *el sistema
propio que compone + la memoria de Kai sobre ti*, **y solo funciona si compone Y es
visible**. Entonces hazlo el centro literal: un **historial versionado, redactado y
exportable de ti** — cada decisión que Kai propuso, cada una que aceptaste o mataste,
cada fase, cada récord, cada por-qué. Un `git log` de las operaciones de tu cuerpo. El
mes 6 tiene que sentirse dramáticamente más *tuyo* que la semana 1, y el Historial es
donde eso se ve y se toca. Irte de Kairos = abandonar tu historial.

**Por qué es disruptivo.** WHOOP te muestra gráficas que no posees ni exportas de
verdad. Los agentes de Notion mantienen notas frescas, pero **no existe en ningún sitio
un historial redactado de decisiones sobre un dominio** — Notion no sabe que una
decisión de deload importa más que un cambio de color. El Historial es el activo que
todos los incumbentes estructuralmente *no pueden* darte: los cerrados no te lo dejan
poseer, los agnósticos no saben qué merece ser historia.

**Dónde falla.** Un historial que nadie revisita es peso muerto y museo. Solo compone si
está **tejido en el uso diario**: Kai lo cita ("la última vez que estuvimos aquí, subir
la frecuencia funcionó"), no lo archiva. Si es una pestaña de "estadísticas", está
muerto.

### Giro C — "El silencio es la métrica": la postura contraria

**La idea.** Todo competidor optimiza *engagement* — DAU, rachas, notificaciones (los
dark patterns que la propia crítica y KAI_VOICE ya prohíben). Kairos invierte el signo:
**el éxito es que pienses en el sistema *menos* mientras mejoras.** El producto se
retira. El default de Kai es callar. La estrella polar interna no es "minutos en la app"
sino **"silencio correcto"**: días en que no hizo falta decir nada y aun así
progresaste. La anti-app.

**Por qué es disruptivo.** Es lo único que un incumbente que vive del engagement *no
puede copiar sin canibalizarse*. WHOOP necesita que mires el anillo; Kairos te devuelve
la atención. Es marca y es moat de confianza a la vez. Encaja como un guante con El
Glifo (el trazo callado) y con la voz de Kai ("silencio > ruido").

**Dónde falla.** Anti-engagement es duro de crecer y monetizar — si el producto se
esconde, ¿por qué vuelves, por qué pagas? La atención liberada tiene que **convertirse
en competencia sentida** (te ves mejorar, sin drama), o es solo una app silenciosa que
olvidas. El silencio sin progreso visible es indistinguible del abandono.

**Precisión crítica (el silencio es hacia afuera, no hacia adentro).** "Silencio como
métrica" **no** significa una app apagada. Significa: **silencio ENTRE sesiones** (cero
notificaciones, cero racha que culpabiliza, cero feed) y **vivo y adictivo DURANTE la
sesión** — porque mientras entrenas, hacer cada serie legible y con algo en juego es
artesanía, no manipulación. La línea ética: un dark pattern fabrica una razón para
abrirla cuando no deberías; Kairos es irresistible solo mientras ya estás haciendo lo que
la app es. No competimos por tu atención en tu vida — competimos con Instagram por los
noventa segundos de descanso que ya ibas a perder. El diseño completo del bucle en-sesión
(adictivo con integridad) vive en [KAIROS_LA_SESION_VIVA.md](./KAIROS_LA_SESION_VIVA.md).

### Giro D — "Kai opera, no anima": el registro editorial

**La idea.** Cambiar el registro emocional entero. Entrenar no es una tarea que
gamificar (rachas/medallas = prohibido) ni una meta clínica que golpear. Es **una obra
que rediseñas durante años**, y Kai (El Glifo) es tu **editor/operador callado**, no un
coach motivacional. Los bloques son capítulos; el Historial es el manuscrito; el
progreso es una narrativa de en quién te estás convirtiendo. La identidad tipográfica
que ya construiste (Fraunces editorial, oro raro, movimiento físico) **ya apunta aquí** —
solo que aún no lo dijimos en voz alta.

**Por qué es disruptivo.** Toda app de fitness es o bien *gym-bro motivacional* o bien
*clínica-quantified*. **Ninguna es digna, autoral, editorial.** Ese registro es
imposible de copiar por un incumbente porque va contra su ADN (WHOOP no puede ser
sobrio; Freeletics no puede ser autoral). Es el moat de identidad creativa — el "esto
solo pudo salir de Kairos".

**Dónde falla.** Riesgo de pretensión. El registro editorial sobre un producto vacío es
*humo bonito* — exactamente la trampa que la crítica nombra ("beauty is necessary but
not sufficient"). El operador tiene que *operar de verdad* (Giro A) o la obra es pose.

### La síntesis (por qué son uno solo)

No hay que elegir. Se componen en un único producto con una única espina:

- **A (Reconciliación)** es el **mecanismo** — cómo el sistema se opera.
- **B (El Historial)** es el **activo** que ese mecanismo produce — el moat, hecho tangible.
- **C (Silencio-métrica)** es la **postura conductual** que hace al producto confiable y
  no-copiable por los que farmean atención.
- **D (Kai operador / editorial)** es el **registro y el carácter** que lo hacen *solo Kairos*.

Un mecanismo que produce un activo que compone, gobernado por una postura que ningún
incumbente puede imitar, vestido de un carácter que ninguno puede fingir. **Esa es la
vuelta de rosca**: no una feature nueva, sino un producto que se define por un verbo
distinto (*operar*), mide un éxito distinto (*silencio correcto*), acumula un activo
distinto (*tu historial redactado*) y habla en un registro distinto (*editorial, no
motivacional*).

---

## 4. Los mecanismos que lo hacen real (y no humo)

La crítica exige substancia. Aquí está lo concreto, y —clave— **casi todo se apoya en
código que ya existe** en `src/features/kai/`. No es un reinicio; es enfocar lo ya
construido hacia una tesis más afilada.

### 4.1 La Reconciliación (Giro A) — sobre `brain.ts` + `metricTrend.ts`
Ya existe un cerebro puro y testeado: `metricTrend.analyzeMetric` (analiza *cualquier*
métrica que el usuario definió), `brain.think` (compone tendencias + memoria + reglas),
`proposal.ts` (genera propuestas deload/plateau/imbalance). Hoy eso emite *propuestas
sueltas*. El giro es **enmarcarlo como un cierre**: cada sesión Kai "cierra" el día
(reconcilia plan vs. lo vivido) y re-abre el horizonte. Mismo motor, verbo nuevo. El
invariante de la arquitectura se mantiene: **los números salen de funciones puras
testeables; el LLM solo los redacta** (ARCHITECTURE §1b, §3b). La reconciliación no
alucina — se reproduce desde tus datos con código que puedes leer. Eso es lo que la
hace *no humo*.

### 4.2 El Historial (Giro B) — sobre `memory.ts` + `proposal.ts`
`memory.ts` ya modela "Kai te conoce" (afinidad de dominio, métricas seguidas, sesgo de
guía, `observeProposalDecision`). `proposal.ts` ya tiene propuestas como objetos con
estado. El giro es **hacer del historial de esas decisiones un objeto de primera clase y
visible**: no una tabla de estadísticas, sino un *documento redactado* — la línea de
tiempo de decisiones que construyeron tu sistema, con el porqué de cada una, exportable.
La memoria deja de ser un contexto invisible para el prompt y se convierte en **la cosa
que posees**. Lo que ya está latente en el código (la memoria) se vuelve el centro
narrativo del producto.

### 4.3 El silencio (Giro C) — la métrica, no una feature
No hay que construir nada: hay que **medir distinto y prometer distinto**. La estrella
polar deja de ser retención-por-enganche y pasa a ser *"días de silencio correcto"* —
progresaste, Kai no tuvo que interrumpir. Esto ya está codificado en la voz
(KAI_VOICE: "una superficie proactiva como máximo", "un home vacío es un buen día"). El
giro es **elevarlo de regla de tono a tesis de producto**: la ausencia de fricción es el
entregable, y se mide.

### 4.4 El Glifo como estado del sistema (Giro D) — sobre `KaiFace.tsx`
El Glifo ya redibuja su pose por estado de ánimo. El giro conceptual: sus poses dejan de
ser "emociones" y pasan a ser **estados del sistema operativo** — *reconciliado y en
calma* (el trazo respira, bajo, quieto: todo cuadra), *tiene una cosa que decir* (la
cuenta/bead recorre el trazo: hay un desajuste que merece una frase), *cerrando el día*
(un pulso al reconciliar). El carácter y la máquina se vuelven la misma cosa: **ves el
estado del sistema en el estado del trazo.** Sin caras, sin ojos — coherente con la
decisión de El Glifo.

---

## 5. Identidad creativa (cómo se llama, se lee, se ve, se siente)

Aquí es donde "una verdadera identidad creativa" se gana o se pierde.

**El nombre de la categoría.** Tres registros, elige por audiencia:
- **Ingeniería / inversores:** _"un ERP personal para el cuerpo"_ — preciso, memorable,
  provocador. Explica el *por qué es defendible* en cinco palabras.
- **Producto / consumidor:** evita "ERP" y "OS" (fríos, techie). El registro editorial
  (Giro D) pide algo con dignidad: **"tu práctica, operada"** o, centrado en el activo,
  **"todo lo que construyes se queda tuyo"**. La palabra ancla que propongo es **práctica**
  (registro de oficio/arte) fundida con **operada** (registro de sistema). Kairos es *tu
  práctica, operada por Kai*.
- **Una línea (el painkiller, heredado y afilado de la crítica §5):** _"Deja de ser tu
  propio coach confundido. No sigues un plan y no mantienes un sistema — tienes uno que se
  corre solo y es tuyo."_

**El registro de la voz** (extiende KAI_VOICE hacia lo editorial): Kai no es coach ni
asistente — es **editor**. No anima; observa, propone, y calla. La diferencia con un
coach: un editor respeta que la obra es tuya. Ejemplos, en el registro nuevo:
- Coach genérico: _"¡Toca pierna hoy, a darlo todo! 💪"_
- Kai editor: _"Ayer las piernas venían pesadas. Hoy dejé la sesión más corta. Si
  quieres, la abrimos."_
- Reconciliación: _"Cerrado el mes. El press subió; la dominada se quedó plana. Cambio
  el estímulo la semana que viene."_

**Cómo se ve.** Todo ya existe en tokens: Fraunces para los números-héroe y el titular,
el oro raro y con significado, fondo cálido, movimiento físico (no cascadas "hechas por
IA"). El giro visual: **el Historial es la pieza editorial central** — grandes numerales
Fraunces, una línea de tiempo redactada como un manuscrito, no como un dashboard. La
competencia (verte mejorar) se hace *legible*, no cuantificada a lo WHOOP.

**Cómo se siente.** Abres Kairos y casi siempre no hay nada que hacer: El Glifo respira,
bajo, quieto — todo está reconciliado. Ese vacío no es una pantalla sin terminar: **es
la promesa cumplida.** Cuando sí hay algo, es una frase de Kai y un cambio que aceptas o
matas de un toque. Sales en diez segundos, con el sistema al día. Con los meses, el
Historial se vuelve grueso y es tuyo. Eso es lo que se siente distinto: **un sistema que
te devuelve la atención en vez de robártela, y una obra que crece.**

**Una semana, en concreto** (para que "Reconciliación" deje de ser abstracto):

> **Lunes.** Abres Kairos. El Glifo está bajo y quieto. No hay nada. Cierras. Entrenas
> lo que ya estaba puesto; al acabar, tres campos: peso, RPE, cómo fue. Diez segundos.
> **Miércoles.** El Glifo tiene la cuenta recorriéndolo — una cosa que decir. _"El press
> lleva dos semanas plano y el RPE sube. Suele ser el mismo estímulo demasiado tiempo. Si
> quieres, cambio a inclinado tres semanas."_ Aceptas de un toque. El bloque se reescribe
> solo; queda una línea en el Historial con el porqué.
> **Jueves–sábado.** Silencio. Progresas. Kai no aparece porque no hacía falta.
> **Domingo.** El Glifo pulsa una vez: el cierre de semana. _"Cerrada la semana. La
> dominada subió; el press, a ver si el cambio lo mueve. Bajé el volumen de piernas: tres
> sesiones seguidas venían pesadas."_ Una pantalla editorial, numerales grandes, una línea
> de decisiones. La miras veinte segundos. Es tuya.
>
> No "abriste la app siete veces". La abriste dos. Y el sistema está más al día que si la
> hubieras abierto setenta.

---

## 6. Cómo captura valor (el modelo de negocio coherente)

La objeción más dura contra este documento no es técnica, es comercial: **si el éxito es
que uses el sistema *menos* (Giro C), ¿cómo demonios se monetiza?** Un producto
anti-engagement con un modelo de suscripción por uso o publicidad se contradice a sí
mismo. Hay que responderlo de frente, porque aquí mueren las ideas bonitas.

La respuesta es que la tesis **no solo es compatible con un buen modelo — lo exige**:

- **Pagas por el operador; el activo es tuyo.** La suscripción no compra "acceso a tus
  datos" ni "minutos de app". Compra al **operador residente** — el juicio continuo que
  reconcilia tu sistema y que te conoce cada vez mejor. Es el retainer de un entrenador,
  no el alquiler de un gimnasio-app. El Historial (Giro B) es **tuyo y exportable incluso
  si te vas** — la postura de propiedad que la visión exigió (VISION §9, "no cloud
  lock-in") se convierte aquí en argumento de venta, no en riesgo.
- **El anti-Strava: pagas por *no tener que pensar*.** Al nicho que se ahoga en su propia
  programación (CRITIQUE §6) no le vendes engagement — le vendes que deje de ser su propio
  coach confundido. Eso es un painkiller que la gente paga: pagarían €200/mes por un
  humano; €15–30/mes por un operador que además es *tuyo* es una ganga. La disposición a
  pagar es alta precisamente porque el dolor es real y caro de resolver de otro modo.
- **El moat no es la cárcel, es la relación.** Cualquiera puede exportar sus datos crudos
  (y debe poder — es la dignidad del producto). Lo que **no** se exporta a un competidor es
  *el entendimiento acumulado del operador sobre ti* — la memoria compuesta (`memory.ts`).
  Te vas con tu historial pero pierdes a quien lo sabía leer. Eso retiene por valor, no por
  secuestro. Es el mismo mecanismo por el que la gente no abandona Obsidian: su mundo vive
  ahí — solo que aquí, además, ese mundo *te opera*.
- **La escalera gratis→pago que respeta la secuencia P1→P3.** Gratis: log + primer bloque
  bien hecho + reglas deterministas (valor real antes de cualquier IA — el arranque en
  frío que la crítica teme). Pago: el operador vivo — reconciliación continua, la voz de
  Kai, el Historial que redacta y compone. Se paga por lo que compone, no por lo que
  engancha.

Contraste que lo hace defendible: WHOOP subvenciona la suscripción con hardware (no
podemos ni queremos competir ahí); Freeletics te alquila un plan que no posees. **Kairos
cobra por un operador que es un ahorro frente a un humano y por un activo que es tuyo.**
Es el único de los tres cuyo modelo *no* depende de robarte la atención — y por eso es el
único que puede sostener honestamente el Giro C.

Honestidad: el margen depende de mantener el LLM como *voz fina sobre un núcleo
determinista* (ARCHITECTURE §1b). Si el operador se vuelve una llamada gorda a un modelo
por cada apertura, la economía anti-engagement (pocas aperturas) se vuelve en contra
(pocas aperturas = poco valor entregado por suscripción). El diseño determinista-primero
no es solo pureza técnica: es lo que hace que el modelo de negocio cierre.

---

## 7. Qué EXTIENDE y qué CONTRADICE de lo ya escrito (honestidad intelectual)

Para que sea fundamentado y no un reinicio caprichoso:

**Extiende (mantiene y afila):**
- La tesis de "autonomía asistida" (VISION §0) — intacta; el operador que carga el
  mantenimiento es exactamente el Giro A.
- El moat "sistema propio + memoria que compone y es visible" (CRITIQUE §4) — el Giro B
  lo *cumple literalmente* al hacerlo el centro visible.
- El nicho (CRITIQUE §6: el auto-entrenado que se ahoga en su propia programación) —
  intacto y afilado por el painkiller de §5.
- "Propone, tú dispones" + "silencio > ruido" (VISION §9, KAI_VOICE) — el Giro C los
  eleva de guardarraíl a tesis.
- El Glifo (kai-character) — no se toca la forma; solo se reinterpretan sus poses como
  estados del sistema (§4.4), sin caras ni ojos.

**Contradice (a propósito):**
- **VISION §1 y §3 vendían "Notion no tiene cerebro, tú lo mantienes" como grieta.** Eso
  caducó (Notion 2026 ya se auto-mantiene). La grieta se **re-funda**: no es "canvas +
  cualquier cerebro", es "canvas + un cerebro **nativo del dominio** que Notion nunca
  tendrá". Diferencia crucial: nos deja de comparar con Notion (que ya nos alcanzó en
  auto-mantenimiento) y nos compara con nadie.
- **VISION §5 "la escalera del ecosistema" como narrativa central.** La crítica ya la
  llamó vitamina de power-user; este documento lo termina: **"construye tu ecosistema"
  desaparece del pitch.** La escalera existe como *mecánica silenciosa* (subes de rung
  sin darte cuenta porque el operador te sube), nunca como promesa.
- **El framing de "app".** VISION ya pedía quitar "fitness app"; esto va más lejos:
  quitar "app". Kairos es un *sistema*, y el éxito es usarlo *menos*.

---

## 8. Riesgos honestos y lo que NO es (disciplina no-humo)

Mantengo viva la capacidad crítica; una idea bonita que no aguanta esto no merece
construirse.

1. **El operador tiene que operar de verdad.** El Giro D (editorial) sobre un Giro A
   flojo es humo bonito. La reconciliación determinista (`brain.ts`) tiene que dar
   propuestas que un entrenador serio firmaría. Este es el riesgo make-or-break, sin
   cambios respecto a la crítica.
2. **El arranque en frío sigue duro.** Semana 1 no hay historial que componer ni cierre
   que reconciliar. El valor inicial es el primer bloque bien hecho + las reglas
   deterministas; el Historial *promete* pero aún no *pesa*. Hay que ser honesto: el moat
   es un activo de mes 6, no de día 1. El onboarding debe sembrar la promesa sin fingir el
   peso.
3. **"El silencio es la métrica" es comercialmente arriesgado.** Un producto que se
   esconde tiene que reaparecer con un motivo real (el cierre semanal, el Historial que
   engorda). Si el silencio no se convierte en competencia sentida y visible, es
   indistinguible del churn. Hay que diseñar el *reencuentro*, no solo la retirada.
4. **El nicho es real pero no masivo.** Sigue siendo un producto de nicho admirable, no
   un unicornio de masas. Bien — pero no lo diluyas persiguiendo a todo el mundo. Category
   king de una categoría pequeña y propia > competidor #7 en fitness.
5. **La analogía "ERP" puede sonar pretenciosa** si se dice al usuario. Es un frame de
   pensamiento e inversión, no un nombre de producto. En el momento en que un usuario oiga
   "ERP para tu cuerpo" y ponga los ojos en blanco, hemos fallado el registro.

**Lo que NO es:** no es un tracker con mejor IA. No es "Notion de fitness" (Notion ya se
mantiene solo; no jugamos ahí). No es gamificación (rachas/medallas fuera). No es un
coach motivacional. No es una app que quiere tu atención. Y no es un ecosistema que te
toca construir.

---

## 9. El experimento que lo probaría o lo mataría (barato, on-sim, sin LLM)

La disciplina YC: prueba el supuesto más arriesgado, barato, ya. El supuesto más
arriesgado **no** es técnico (el cerebro determinista ya existe y funciona). Es
**perceptual**: *¿el usuario siente la Reconciliación + el Historial como algo tuyo que
vale, o como una app de stats más?*

**El experimento:** el shell del **"Cierre"** + una primera página del **Historial**,
alimentados por el `brain.ts` determinista, sobre datos sembrados de 6-8 semanas.
Verificable en el simulador, sin API key, sin backend. Nada de LLM (ARCHITECTURE §1b:
determinista primero). La pregunta que responde en una sesión de mirarlo:

> Cuando Kai "cierra el mes" y te muestra la línea de decisiones que construyeron tu
> sistema — ¿se siente como *tu obra*, o como un dashboard? ¿Da ganas de conservarlo?

Si a los cinco minutos de mirarlo la respuesta es "esto es mío y no lo quiero perder",
la vuelta de rosca es real y todo lo demás es ejecución. Si es "bonito, otra pantalla de
stats", hay que volver aquí antes de escribir una línea de producto. Ese es el gate — y
es coherente con el propio P1 de la visión (proposal inbox shell, on-open, off the
first-paint path), solo que reencuadrado como *Cierre + Historial* en vez de *inbox de
propuestas*.

---

## Fuentes (contraste julio 2026)

- [8ration] Por qué las mejores apps de fitness se mueven a IA agéntica en 2026:
  https://www.8ration.com/blogs/agentic-ai-fitness-apps/
- [skycrumbs] Mejores apps de fitness con IA 2026 (Centr, Freeletics, Vi — adaptación ya
  es base): https://skycrumbs.com/blog/ai-fitness-apps-2026
- [techcrunch] Notion convierte su workspace en hub de agentes (mayo 2026):
  https://techcrunch.com/2026/05/13/notion-just-turned-its-workspace-into-a-hub-for-ai-agents/
- [notion-agents] Notion — agentes 24/7, Autofill que mantiene datos frescos sin revisión
  manual: https://www.notion.com/product/agents
- [chartmogul] Qué hace falta para ser category king (76% del valor):
  https://blog.chartmogul.com/what-it-takes-category-king
- [playbigger] Qué es category design y por qué es la estrategia:
  https://www.playbigger.com/media/what-is-category-design-in-marketing-and-why-is-it-an-important-strategy
- Continúa el análisis de mercado sourced en KAIROS_VISION.md §Sources y KAIROS_CRITIQUE.md
  §Sources (SDT, churn 71%, Segar, moat vs hardware).

---

## Registro de revisiones
- v1 (2026-07-02) — Primer manifiesto completo: tesis, contraste de mercado, PdV/categoría,
  cuatro giros contrastados + síntesis, mecanismos sobre código existente, identidad,
  extiende/contradice, riesgos, experimento-gate.
- v2 (2026-07-02) — Red-team propio. Añadido: §2.1 "Por qué ahora" (test YC de timing),
  la escena "Una semana, en concreto" (aterriza la Reconciliación), y §6 "Cómo captura
  valor" — el hueco grave: el modelo de negocio coherente con "el silencio es la métrica"
  (pagas por el operador, el activo es tuyo; el anti-Strava; el moat es la relación, no la
  cárcel). Renumeradas §7 extiende / §8 riesgos / §9 experimento.
- v3 (2026-07-02) — Reconciliada la tensión adictivo↔silencio (Álvaro pidió "adictivo, que
  incite a seguir usándola mientras entrena"). Giro C precisado: silencio ENTRE sesiones,
  vivo DURANTE. El diseño completo del bucle en-sesión se mueve a su propio doc,
  KAIROS_LA_SESION_VIVA.md.
- v4 (2026-07-03) — Decisión de Álvaro "para todo el condicionamiento": §2 precisado — el
  "dominio nativo" abarca fuerza/carrera/movilidad/deporte; el razonamiento cruzado entre
  dominios es el moat anti-fragmentación; "todo" = por usuario, no por mercado (anti
  dilución). El cómo (arquetipos + semántica) en LA_SESION_VIVA §2.5.
