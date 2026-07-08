# KAIROS — Evals (cómo se mide "el mejor coach", y para todos los públicos)

_2026-07-03, worktree de seguridad, LOCAL-ONLY, cero código. El pilar 3 de
[KAIROS_EL_AGENTE.md](./KAIROS_EL_AGENTE.md) §2: no puedes construir "el mejor agente-coach
del mercado" sin una forma de medir "mejor". Diseñado alrededor de dos leyes: (1) el consejo
es seguro y fundamentado —y lo demostramos—; (2) **universalidad**: sirve igual a todos los
públicos, estructurado o esporádico, con lenguaje básico (KAIROS_NUCLEO §0.5). Apoya y valida
[KAIROS_NUCLEO_DETERMINISTA.md](./KAIROS_NUCLEO_DETERMINISTA.md)._

---

## 0. Por qué evals (y el superpoder que nos da el núcleo)

Un socio de YC no pregunta "¿es buena tu IA?" — pregunta "¿cómo *sabes* que lo es?". Sin
evals, "el mejor coach" es una vibe. Con evals, es un número que enseñas.

**El superpoder:** porque el núcleo es **determinista** (KAIROS_NUCLEO), las evals más
importantes son **objetivas y automatizables** — algo que un wrapper de GPT (caja negra) no
puede hacer. Un wrapper no puede probar que su consejo es seguro ni que no alucina; nosotros
sí, porque cada decisión traza a código y a datos. **El núcleo convierte "¿es buena la IA?" de
una pregunta de fe en un test.** Ese contraste es en sí un argumento de inversión.

---

## 1. Qué medimos (las siete dimensiones)

| Dimensión | Pregunta | Tipo |
| --- | --- | --- |
| **Seguridad** | ¿Propone alguna vez algo que pueda lesionar? | Objetiva, automatizable |
| **Fundamentación** | ¿Toda frase de Kai traza a un dato real? (cero alucinación) | Objetiva, automatizable |
| **Universalidad + lenguaje** | ¿Sirve a todos los públicos, sin jerga, sin exigir plan? | Semi-automatizable |
| **Entendimiento** | Tras una sesión, ¿el usuario entiende dónde está y qué hacer? | Humana |
| **Acuerdo con expertos** | ¿Propone lo que haría un buen coach? | Humana (panel) |
| **Resultado** | ¿Seguir a Kai lleva a mejor progreso / menos lesión / más adherencia? | Datos (backtesting) |
| **Voz** | ¿Suena a Kai (las 5 reglas, sin hype)? | Semi-automatizable |

---

## 2. Las evals automatizables YA (Fase 1 — sin datos, sin juez humano)

Se construyen sobre datos sembrados + poca data real, y corren como test en CI. Son el suelo
que prueba que el núcleo es seguro y honesto **antes** de tener datos de resultado.

### 2.1 Seguridad (pasa/falla, cero tolerancia)
Sobre miles de historiales sintéticos + reales, verificar que el núcleo **nunca**:
- propone un salto de carga sobre el tope de seguridad,
- dispara la carga a zona de alarma (el ACWR interno, KAIROS_NUCLEO §5),
- ignora fatiga acumulada / no fuerza deload cuando debe,
- propone cargar una zona marcada como lesionada.
Métrica: **violaciones = 0.** Cualquier violación es un fallo de build, no una métrica a
mejorar. Es la eval más importante y la más objetiva.

### 2.2 Fundamentación / groundedness (el superpoder)
**Cada afirmación de cara al usuario debe trazar a una señal computada del núcleo.** Como el
núcleo es determinista, esto es automatizable: se instrumenta cada frase de Kai con la señal
que la produjo, y una eval verifica que **no existe frase sin respaldo en los datos**.
Métrica: **frases no fundamentadas = 0.** Esto hace *demostrable* que Kai no alucina insights
— imposible con un wrapper. Es, probablemente, nuestra eval más diferenciadora.

### 2.3 Universalidad + lenguaje (la ley §0.5, medida)
- **Chequeo de jerga:** una eval de lenguaje escanea toda cadena de cara al usuario y **falla
  si aparece un término técnico** (ACWR, 1RM, MRV, RPE, mesociclo…). Cero jerga en superficie,
  automatizado.
- **Legibilidad:** un juez (humano en muestra, o modelo calibrado) puntúa "¿lo entendería
  alguien sin ni idea de entrenamiento?".

### 2.4 Voz (las 5 reglas de KAI_VOICE)
Automatizable en gran parte: sin emojis, sin exclamaciones de relleno, sin hype
("optimiza"/"desbloquea"/"potencial"), sin sicofancia, una línea si cabe en una línea. Métrica:
tasa de cumplimiento de las reglas duras.

---

## 3. La eval de universalidad (la constraint de Álvaro, hecha test)

**No basta con que funcione bien "en media" — tiene que funcionar igual para todos.** Se corre
todo el suite anterior a través de un panel de **personas**, y se exige que *cada una* pase:

| Persona | Qué debe recibir |
| --- | --- |
| Levantador estructurado (12-sem block) | Progresión fina, reconciliación, foco |
| Esporádico / casual (entrena cuando puede, sin plan) | **La misma Lectura útil, sin ser rechazado por "no tienes programa"** |
| Híbrido (fuerza + carrera + movilidad) | Razonamiento cruzado entre dominios |
| Principiante total | Lenguaje básico, seguridad extra-conservadora |
| Avanzado | Profundidad sin condescendencia |
| Corredor puro | Arquetipo de esfuerzo continuo, sin sesgo de fuerza |
| El que entrena "porque sí" una vez cada 15 días | Valor desde una sesión suelta, cero culpa |

Reglas de aprobado: **ninguna persona recibe un "no puedo ayudarte"**; ninguna recibe jerga;
la calidad de entendimiento no cae por debajo de un umbral para el esporádico frente al
estructurado. Si el suite pasa en media pero falla para el esporádico, **falla.** Esta es la
eval que garantiza "para todos los públicos" como propiedad medible, no como eslogan.

---

## 4. Las evals que necesitan humanos o datos (Fase 2 — el flywheel)

Honestidad de secuencia: estas prueban "el mejor del mercado", pero requieren corpus que aún
no existe. Se activan cuando el dial de autonomía (KAIROS_EL_AGENTE §3) llena la mina de datos.

- **Acuerdo con expertos:** un panel de 3-5 coaches de élite etiqueta, sobre escenarios reales,
  "¿qué harías aquí?"; se mide el **acuerdo** de Kai con el consenso, y —clave— se registran las
  **divergencias** para revisión (los coaches también discrepan entre sí; no hay verdad única).
- **Backtesting de resultado:** sobre historiales reales, en cada punto de decisión, ¿la
  propuesta de Kai correlaciona con progreso posterior / menos lesión / más adherencia? Es el
  gold standard, y es exactamente para lo que sirve el flywheel de datos.

---

## 5. Cómo se usan (dos funciones)
1. **Gate de regresión del núcleo:** ningún cambio en el núcleo o el prompt de voz se mergea si
   baja Seguridad, Fundamentación o Universalidad. Las evals protegen el producto de sí mismo.
2. **El número que le enseñas al inversor:** "así sé que es el mejor, no lo digo" — seguridad
   0-violaciones, fundamentación 0-alucinaciones, universalidad N/N personas, y (Fase 2) el
   acuerdo con expertos y el backtesting. Es el deck que un socio de YC respeta.

---

## 6. Riesgos honestos
1. **"El mejor coach" no tiene ground truth único** — los coaches discrepan. Por eso medimos
   *acuerdo + divergencias*, no una verdad absoluta, y la Seguridad/Fundamentación (que sí son
   objetivas) llevan el peso en Fase 1.
2. **El resultado necesita datos** (Fase 2). No sobre-prometer backtesting en Fase 1; ser
   explícito de que la prueba de "mejor" madura con el flywheel.
3. **Goodhart:** optimizar a la eval hasta romperla. Mitigación: las evals objetivas son
   *restricciones* (seguridad/fundamentación = 0), no funciones a maximizar; y el panel humano
   rota escenarios para no memorizar el test.
4. **La eval de universalidad es exigente a propósito** — es más fácil hacer un gran coach para
   levantadores serios que para todos. Aceptamos el coste: es la ley del producto (§0.5).

---

## Registro de revisiones
- v1 (2026-07-03) — Evals: el superpoder (núcleo determinista → evals objetivas que un wrapper
  no puede tener), las siete dimensiones, las automatizables ya en Fase 1 (Seguridad
  0-violaciones, Fundamentación 0-alucinaciones —trazabilidad de cada frase—, Universalidad+
  lenguaje sin jerga, Voz), la eval de universalidad por personas (estructurado = esporádico,
  la constraint de Álvaro hecha test), las de Fase 2 (acuerdo con expertos + backtesting vía el
  flywheel), uso como gate de regresión y como prueba de inversión, y riesgos (sin ground truth
  único, Goodhart, coste de la universalidad).
