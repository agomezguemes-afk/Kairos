# KAIROS — La sesión viva (el bucle en-sesión)

_Documento de diseño para que Álvaro reaccione. 2026-07-02, worktree de seguridad,
LOCAL-ONLY, cero cambios de código. Compañero de
[KAIROS_VUELTA_DE_ROSCA.md](./KAIROS_VUELTA_DE_ROSCA.md): aquel define la categoría
y el porqué; este define **la experiencia mientras entrenas** — que Álvaro pidió que
fuera fácil, dinámica y adictiva, "que incite a seguir usándola mientras entrena, no
solo entrenar", y sin ser "una chapa constante". Todo lo de aquí se apoya en superficie
que ya existe en la app (`RestTimer`, `WorkoutSummary`, ghost values, `KaiFace`,
`brain.ts`) — es evolución, no reinicio._

---

## 0. La tensión, resuelta (el nudo — leer esto primero)

Álvaro pidió **adictivo** justo después de que yo canonizara _"el silencio es la
métrica"_ y _"el éxito es usarla menos"_. Parecen opuestos. **No lo son**, y la línea que
los separa es toda la ética del producto:

> **Silencio ENTRE sesiones. Vivo y adictivo DURANTE la sesión.**

- **Un dark pattern fabrica una razón para abrir la app cuando no deberías** — la
  notificación, la racha que se rompe, el feed que te reclama. Eso Kairos no lo hace
  nunca: entre sesiones, calla.
- **Kairos es irresistible solo mientras ya estás haciendo lo que la app es** — mientras
  entrenas. Y ahí ser adictivo no es manipulación, es artesanía: **estabas mirando el
  móvil en el descanso de todos modos** (a Instagram). Kairos gana esa atención que ya
  iba al teléfono y la apunta a tu entrenamiento en vez de sacarte de él.

Esa es la reconciliación entera: no competimos por tu atención en tu vida — competimos
con Instagram **por los noventa segundos de descanso que ya ibas a perder mirando el
móvil**. Ganar esos segundos para tu entrenamiento es un regalo, no un secuestro. El Giro
C del manifiesto se sostiene intacto; solo se precisa: *el silencio es hacia afuera; hacia
adentro, la sesión está viva.*

---

## 1. El bucle vivo (por qué te pide seguir, set a set)

Hoy una sesión es: haces una serie, la anotas, esperas, haces otra. El anotar es un
trámite y el esperar es tiempo muerto. **El giro: el átomo de la sesión no es *anotar una
serie* — es un micro-bucle con tensión propia en cada serie:**

```
   objetivo vivo  →  ejecutas  →  El Glifo reacciona en vivo  →  micro-lectura en el descanso  →  (recalibra) siguiente objetivo
        └───────────────────────────────  se repite cada serie  ───────────────────────────────┘
                                             ↓ al terminar
                                          La Lectura
```

Lo que engancha no es un truco pegado encima — es que **cada serie tiene algo en juego y
algo que aprendes**, y el descanso deja de ser vacío. Sales de una serie con un dato de ti
y entras en la siguiente con un objetivo que *cambió* por lo que acabas de hacer. Eso es
"dinámico" de verdad: no hay dos series iguales porque el objetivo se recalcula con tu
fatiga real de hoy.

**Tres series, en concreto** (para que "bucle vivo" no sea abstracto):

> **Serie 1.** 8 reps. El Glifo sube limpio hasta arriba y se asienta. Descanso: el anillo
> gira, y dentro _"Limpia. Te sobró."_ y el objetivo de la siguiente ya puesto: **9.**
> Miras el móvil — pero te quedas, porque hay un 9 que perseguir.
> **Serie 2.** Vas a por las 9. La cuenta recorre el trazo rep a rep; en la 8 el Glifo se
> tensa un pelo — la 9 sería tu mejor serie a este peso. Sacas la 9. Un pulso háptico
> seco. _"Nueve. A este peso, tu mejor serie."_ Ni confeti ni "¡genial!". Solo el hecho.
> **Serie 3.** El Glifo cae antes de tiempo, la cuenta se arrastra. Descanso: _"Esa cayó
> rápido."_ El objetivo baja a **6**, y debajo, pequeño: _"o 40s más y vamos a 8."_ Tú
> decides de un toque. No te empuja a lesión: cuando tu cuerpo dice basta, el número lo
> dice contigo.

Dos veces miraste el móvil en el descanso. Las dos te quedaste en Kairos. Eso es ganarle a
Instagram los segundos muertos — sin una sola notificación.

---

## 2. Las cuatro invenciones en-sesión (cada una sobre código que ya existe)

### 2.1 El objetivo vivo — evoluciona los *ghost values*
Hoy los ghost values (`SetRow`/`FieldInput`) son **continuidad visual pasiva**: te
enseñan lo que pusiste la vez pasada, en gris. El propio código lo dice: _"NOT prefill
from ghost; it's purely visual continuity."_ Ahí está la semilla dormida.

**El giro:** el ghost pasa de *recuerdo pasivo* a **objetivo vivo** — un número que
perseguir *esta* serie, recalculado por cómo fue la anterior. No el número del plan
(estático), sino uno que responde a tu curva de fatiga en tiempo real:
- La serie anterior salió holgada (RPE bajo, sobró) → el objetivo sube: _"esta, 9."_
- Cayó rápido, el RPE se disparó → el objetivo baja o alarga el descanso: _"esta, 6. O
  30s más de descanso y vamos a 8."_

Es el tirón sano del "una más" — pero **honesto**: sube cuando tu cuerpo tiene, y se
retira cuando la curva dice basta (es una salvaguarda, no un empujón ciego). El motor ya
existe (`brain.think`, `metricTrend` sobre `performedSets`). El cambio de front es
mínimo: el ghost ya se renderiza; hay que hacerlo activo y vivo.

**Honestidad (no vender lo que no es):** la autorregulación por RPE/RIR existe en coaching
serio, y alguna app (p. ej. RP Hypertrophy) ya autoajusta cargas. Lo que **no** existe no
es el concepto — es la *entrega*: un objetivo vivo, glanceable, que se persigue en el hueco
del descanso, con El Glifo como aguja viva, convertido en el **bucle adictivo** de la
sesión en vez de un ajuste de coach enterrado en una pantalla. Nuestro borde es la
experiencia, no el cálculo. No lo pitchees como "inventamos ajustar el peso".

**La lógica (determinista, auditable, a calibrar).** El mayor riesgo (§8.1) es un objetivo
malo. Se conjura porque el cálculo **no es una intuición del LLM — es un puñado de reglas
puras sobre lo que ya mides**, con la seguridad cableada. La forma, no las constantes
(esas se calibran con datos reales; aquí falsa precisión sería humo):

- **Entradas** (todas ya en `performedSets`): objetivo de la serie anterior vs. reps
  logradas; RPE/RIR si el usuario lo trackea; y la **caída intra-sesión** (cómo vienen
  cayendo las series de este ejercicio hoy).
- **Decisión** (una de cuatro): _subir_ (cumpliste con margen: RIR alto / RPE bajo),
  _mantener_ (cumpliste justo), _bajar_ (fallaste o el RPE se disparó), o _más descanso_
  (la caída es de fatiga, no de fuerza — a veces 30-40s recuperan la serie sin bajar peso).
- **Invariantes de seguridad, sin excepción:**
  1. Nunca proponer un salto mayor que un tope pequeño sobre lo *último logrado* (no sobre
     el plan). El techo lo pone tu cuerpo hoy, no la hoja.
  2. Ante ambigüedad o datos flacos (primeras series, sin RPE) → **mantener o bajar**,
     nunca subir. El sesgo por defecto es conservador.
  3. Caída intra-sesión brusca → ofrecer descanso o bajar, jamás empujar.
  4. Respetar el techo del plan del bloque como límite superior.
- **Lo que el LLM (si llega) sí hace:** *redactar* la frase de Kai en su voz. La *decisión*
  y el *número* salen de las reglas — reproducibles desde tus datos por código que puedes
  leer. Ese es el mismo invariante del manifiesto (ARCHITECTURE §1b): números de funciones
  puras, el LLM solo pone la voz. Un objetivo bajo la barra no puede ser una alucinación.

### 2.2 El Glifo como aguja viva — evoluciona `KaiFace`
Durante la serie no lees — no puedes, estás bajo la barra. Así que la información no puede
ser texto (eso sería la chapa). **El Glifo reacciona en vivo:** el trazo sube hacia el
objetivo conforme acumulas reps, se asienta cuando estás en el punto justo, la cuenta
(bead) recorre el trazo marcando cada rep. No lees un número: **ves una cosa viva
reaccionando a ti.** Juice + legibilidad + carácter, todo en el Glifo que ya existe, sin
caras, sin palabras. Es el antídoto exacto contra "la chapa": la inteligencia se entrega
como *forma*, no como frase.

### 2.3 El descanso como superficie — evoluciona `RestTimer`
Hoy `RestTimer` es un anillo de oro y un numeral. Precioso y **vacío** — noventa segundos
de cuenta atrás mirando un reloj. **Ese es el espacio a ganar.** El descanso se convierte
en la superficie donde Kairos gana la atención que ya iba al móvil:
- **La micro-lectura de la serie que acabas de hacer**, de un vistazo: no un párrafo — una
  cosa. _"Esa cayó rápido."_ / _"Limpia. Te sobró."_
- **El objetivo vivo de la siguiente**, ya calculado.
- **El Glifo respirando**, cargando el estado.
- El anillo sigue ahí (el timer que ya funciona), pero ahora *rodea* algo que importa.

Miras Kairos en el descanso **porque es lo más interesante que mirar**, no porque te haya
dado un toque. Ganamos a Instagram en su propio terreno: los segundos muertos.

### 2.4 El momento — surface `detectPr` EN VIVO (no como trofeo tardío)
Hoy `WorkoutSummary` detecta PRs *al final* y los muestra como medalla (`detectPr` ya
existe y funciona). **El giro: llevar esa señal al *antes* de la serie, como tensión.**
De vez en cuando —raro, ganado— una serie es *un momento*: estás a una rep de tu récord, o
el objetivo vivo batiría tu marca. Kairos lo sabe y crea tensión callada: el Glifo se
tensa, el número brilla apenas. **No confeti** (prohibido) — tensión, y luego un
reconocimiento limpio: _"102. Récord."_ Raro, para que siga siendo real (la voz: el elogio
es escaso y ganado). La adicción de las apuestas, con la contención de Kairos.

---

### 2.5 El objetivo vivo para TODO el condicionamiento — arquetipos + semántica
_Decisión de Álvaro (2026-07-03): Kairos no es de una categoría — es para todo lo que se
considere condicionamiento físico (fuerza, carrera, movilidad, deporte, lo que sea)._

**Lo bueno — es el unificador (moat, no solo scope).** El híbrido cose 5 apps que no se
hablan; su dolor real es que ninguna ve el conjunto. Que **un solo operador** vea fuerza +
carrera + movilidad a la vez le deja razonar *entre* dominios: _"tu volumen de carrera
subió y la sentadilla se estancó — compiten por recuperación."_ Una app de una sola
categoría no puede decir eso, **estructuralmente**. "Para todo" es el anti-fragmentación.

**Lo difícil (sin humo).** Una sola fórmula no abarca fuerza (series × carga × RPE),
carrera (ritmo/HR continuo), movilidad (rango/calidad) y habilidad (técnica). Fingir que sí
es humo. Y hardcodear una lógica por deporte es volver a las 5 apps por dentro.

**La respuesta — un motor, dos capas finas (es el moat estructural de Kairos cobrando):**
1. **Semántica de métricas.** Cada campo que el usuario inventa lleva etiquetas: *dirección*
   (más/menos es mejor / banda), *rol* (carga / output / esfuerzo / calidad / duración),
   *familia de unidad* (reps / masa / distancia / tiempo / ritmo / escala / ordinal). Con
   eso `metricTrend` (que ya respeta `lowerIsBetter`) lee "mejor/peor" sobre *cualquier*
   métrica. Es aditivo — extiende Vein 2C/3 de ARCHITECTURE, no reescribe nada.
2. **Arquetipos.** Toda unidad de trabajo cae en unos pocos; **el bucle vivo (§1) es el
   mismo** — solo cambian la *función de objetivo* y la *lectura de mejor/peor*:

| Arquetipo | Ejemplos | Objetivo vivo | Profundidad |
| --- | --- | --- | --- |
| Carga discreta | fuerza, hipertrofia, calistenia | reps/carga próxima serie (curva de fatiga intra-sesión) | **alta** — el objetivo aprieta |
| Esfuerzo continuo | carrera, remo, bici, natación | ritmo/split/zona del próximo tramo (deriva de ritmo/HR) | alta |
| Por tiempo / rondas | HIIT, metcon, EMOM, circuitos | reps o ritmo por ronda a sostener (caída por ronda) | media |
| Rango / calidad | movilidad, flexibilidad, rehab | consistencia + simetría, **sin número que perseguir** | baja — nudge, no chase |
| Habilidad | escalada, boxeo, drills de deporte | estructura + tu propia valoración; frecuencia/exposición | **mínima — Kai hace menos** |

**Dos disciplinas que lo salvan de la dilución** (así mueren las super-apps):
- **La profundidad escala con lo cuantificable; donde no, Kai calla más.** Fingir un número
  en el boxeo es el humo que la crítica prohíbe. La honestidad del operador (silencio >
  ruido) es lo que impide que "para todo" se vuelva "flojo en todo".
- **"Todo" = todo lo que hace *esta persona*, no todo para *todo el mundo*.** Amplitud **por
  usuario** (su práctica mixta, operador profundo), no **por mercado** (masas diluidas). Esa
  línea separa el unificador del cementerio de super-apps. Sigue siendo el nicho de la
  crítica §6 — solo que ese nicho entrena varias cosas.

**MVP sin traicionar "para todo":** el motor es genérico desde el día uno (semántica +
arquetipos es capa aditiva y barata), pero **la prueba del bucle empieza en carga discreta**
— ahí el objetivo es inequívoco y el experimento no tiene ruido. Luego carrera (ritmo),
luego el resto. La arquitectura no discrimina; la *calibración* aterriza arquetipo a
arquetipo.

---

## 3. La Lectura — evoluciona `WorkoutSummary` de recap a entendimiento
`WorkoutSummary` ya es editorial (volumen héroe en Fraunces, PRs, comparativa vs. sesión
previa, adherencia, "siguiente"). Pero hoy es un **recap de estadísticas**: te dice *qué
pasó*, no *qué significa*. El giro —el que Álvaro pidió en el turno anterior— es que el
titular deje de ser el volumen y pase a ser **el entendimiento**:

- **Diagnóstico (dónde fuiste mejor/peor):** de la estructura de la propia sesión — la
  curva de fatiga, el margen (RPE vs. output), la simetría. _"Tu fuerza estuvo donde debe.
  Lo que te frenó fue la última serie: ahí es donde ganas ahora."_
- **El foco (la única cosa):** una, no cinco. Lo que más mueve la aguja hoy.
- **El recap de stats de hoy queda debajo, plegado** — es el _"por qué"_ para quien quiera
  el fondo (el volumen, los deltas, los PRs que ya renderiza siguen ahí, en el desplegable).

Un titular que entiendes en un vistazo; el fondo, a un toque. Cada Lectura es, además, una
línea del Libro (ver manifiesto §Giro B).

---

## 4. La ley anti-chapa (el guardarraíl de "no puede ser una chapa constante")

Sin esto, todo lo anterior degenera en un coach parlanchín. Reglas duras:
- **90% forma y vistazo, 10% una frase.** La inteligencia se entrega como El Glifo, un
  número, una háptica. El texto es la excepción.
- **Kai habla solo entre series, nunca a mitad de serie.** Una línea. Y solo si cambia la
  siguiente serie. Si no cambia nada, calla (silencio > ruido, aplicado al minuto a
  minuto).
- **Nunca un párrafo dentro del entreno.** La Lectura larga es al final, y aun así plegada.
- La háptica ya está en el código (`RestTimer` usa `expo-haptics`); es un canal de "voz"
  sin palabras — úsalo para confirmar objetivo cumplido, no para spamear.

---

## 5. Fácil de usar — el modelo de input (la mitad que se olvida)
"Adictivo" muere si anotar cuesta. Bajo la barra apenas piensas:
- **Confirmar una serie = un toque.** El campo viene pre-cargado con el objetivo vivo; si
  lo cumpliste, confirmas de un toque. Solo tocas números si te desviaste.
- **Objetivos de toque grandes, a un pulgar.** Nada de teclados ni modales a mitad de
  entreno (CLAUDE.md: "heavy modals — avoid").
- Análisis pesado, input pluma. Toda la inteligencia por detrás; por delante, un gesto.

---

## 6. Por qué es adicción sana, no dark pattern (la honestidad, explícita)
La adicción de las apps de casino viene de **recompensa variable aleatoria**. La de Kairos
viene de que **la varianza es honesta**: el objetivo cambia porque *tu cuerpo* cambió hoy,
no porque un algoritmo tira un dado para engancharte. Persigues objetivos reales, las
apuestas (PRs) son reales, nada está fabricado. Esa es la diferencia entre "incita a
seguir entrenando bien" y "te mantiene enganchado a la pantalla". Mantenerla exige un
invariante: **la varianza siempre sale de tus datos, nunca de un programa de refuerzo.**
El día que un número brille para engancharte y no porque tu cuerpo lo ganó, cruzamos a
dark pattern y hemos fallado.

---

## 7. Semillas que ya existen (por qué esto es cercano, no un rewrite)

| Invención | Vive hoy en | El giro |
| --- | --- | --- |
| Objetivo vivo | `SetRow` / `FieldInput` ghost values (pasivos) | pasar de continuidad visual → objetivo activo recalculado |
| El Glifo aguja | `KaiFace` (poses por ánimo) | poses = estado del set en vivo (sube/asienta/bead) |
| Descanso-superficie | `RestTimer` (anillo + numeral, vacío) | llenar el hueco con micro-lectura + próximo objetivo |
| El momento | `detectPr` en `WorkoutSummary` (al final) | llevar la señal al *antes* como tensión |
| La Lectura | `WorkoutSummary` (recap de stats) | titular = entendimiento (limitante + foco); stats plegados |
| El motor | `brain.ts` / `metricTrend` / `reflection.ts` | ya calcula sobre `performedSets`; alimenta el objetivo vivo |

Casi todo es re-enfocar superficie construida. El trabajo nuevo real: la lógica del
**objetivo vivo** (recalcular set a set desde la curva de fatiga) y llenar el **descanso**.

---

## 8. Riesgos honestos
1. **El objetivo vivo tiene que ser *bueno*.** Un objetivo malo (demasiado alto) empuja a
   lesión o desanima; demasiado bajo, aburre. Debe ser **determinista y conservador**, y
   retirarse ante la duda (misma disciplina que el manifiesto: decisiones en código puro,
   el LLM solo redacta). Un objetivo alucinado bajo la barra es un daño real.
2. **La superficie del descanso se puede saturar.** Micro-lectura + objetivo + Glifo +
   timer es fácil que se vuelva ruido. La ley anti-chapa (§4) es el guardarraíl: si dudas,
   quita. El descanso limpio también es válido.
3. **"Adictivo" puede tentarnos al dark pattern.** El invariante de honestidad (§6) es lo
   único que nos separa de convertirnos en lo que decimos que no somos. Hay que defenderlo
   como se defiende "propone, tú dispones".
4. **Entre-series es poco tiempo.** La micro-lectura tiene que caber en un vistazo de dos
   segundos o no se lee. El diseño es de resta, siempre.

---

## 9. La prueba más pequeña (barato, on-sim, sin LLM)
Un solo experimento decide si esto engancha: **el descanso vivo con un objetivo vivo**,
determinista, sobre datos sembrados. En `RestTimer`, dentro del anillo que ya existe:
la micro-lectura de la última serie (una frase de `brain.think`) + el objetivo de la
siguiente. Sin LLM, sin backend, verificable en el simulador.

La pregunta que responde en un solo entreno simulado:

> En el descanso, ¿miras el móvil… y te quedas en Kairos porque hay algo que perseguir en
> la siguiente serie? ¿O sales a Instagram igual?

Si te quedas, el bucle vivo funciona y todo lo demás es ejecución. Si sales, el objetivo
vivo no tiene suficiente tensión y hay que volver aquí antes de construir. Es coherente con
el gate del manifiesto (§9): determinista primero, la percepción es lo que se prueba.

---

## Registro de revisiones
- v1 (2026-07-02) — Primer diseño de la sesión viva: resolución de la tensión
  adictivo↔silencio (silencio afuera / vivo adentro), el bucle vivo, las cuatro invenciones
  sobre código existente (objetivo vivo, El Glifo aguja, descanso-superficie, el momento),
  La Lectura como entendimiento, la ley anti-chapa, el modelo de input fácil, la honestidad
  anti-dark-pattern, tabla de semillas, riesgos, prueba mínima.
- v2 (2026-07-02) — Pulido: escena "Tres series, en concreto" (aterriza el bucle) y nota de
  honestidad en §2.1 (la autorregulación por RPE ya existe; nuestro borde es la *entrega*,
  no el cálculo — no pitchear "inventamos ajustar el peso").
- v3 (2026-07-02) — De-riesgada la parte más difícil: §2.1 "La lógica (determinista,
  auditable, a calibrar)" — la forma de las reglas del objetivo vivo (entradas, decisión de
  cuatro ramas, 4 invariantes de seguridad) sobre `performedSets`, sin LLM. Prueba que el
  objetivo bajo la barra no puede ser una alucinación. Constantes deliberadamente sin fijar.
- v4 (2026-07-03) — Decisión de Álvaro "lo quiero para todo": §2.5 "El objetivo vivo para
  TODO el condicionamiento" — un motor parametrizado por semántica de métricas + 5
  arquetipos (mismo bucle, distinta función de objetivo), la profundidad escala con lo
  cuantificable (habilidad = Kai hace menos, sin fingir números), "todo" = por usuario no
  por mercado, y el moat de razonamiento cruzado entre dominios. MVP: motor genérico,
  calibración arquetipo a arquetipo (carga discreta primero).
