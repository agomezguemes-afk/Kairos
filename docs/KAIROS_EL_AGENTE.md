# KAIROS — El Agente (niveles de autonomía + construir el agente definitivo)

_2026-07-03, worktree de seguridad, LOCAL-ONLY, cero código. Trabaja sobre la base del
agente vertical ([KAIROS_ESTRATEGIA_CAPITAL.md](./KAIROS_ESTRATEGIA_CAPITAL.md)) y la
arquitectura event-sourced ([KAIROS_ARQUITECTURA_DATOS.md](./KAIROS_ARQUITECTURA_DATOS.md)).
Dos decisiones de Álvaro (2026-07-03): (1) niveles de autonomía del agente ("niveles de
voz" — más o menos control individual, la app trabaja de forma independiente); (2) el
agente no es un wrapper de algo que ya existe — es **el mejor coach-agent del mercado**,
construido por nosotros, con algo básico solo para iterar al principio._

---

## 0. Premisa: el agente ES el producto (y el moat)

En un agente vertical, la IA genérica no es defendible (los modelos se comoditizan). Lo
defendible es **el agente de dominio + sus datos que componen**. Por eso estas dos
decisiones no son features — son *el* proyecto: cuánto se le deja operar (§1) y cómo se
construye para ser el mejor (§2). Y son la misma máquina vista por dos lados (§3).

---

## 1. Los niveles del agente — el dial de autonomía

Tú decides cuánto control retienes y cuánto delegas para que la app trabaje sola. Cuatro
niveles con verbos claros:

| Nivel | Verbo | Qué hace Kai | Control que retienes |
| --- | --- | --- | --- |
| **N0** | **Observa** | Solo mira y registra. Cero voz. | Total (log puro) |
| **N1** | **Aconseja** | Propone; nada cambia sin tu toque (*propone, tú dispones*). El default. | Máximo con asistencia |
| **N2** | **Ajusta** | Aplica solo lo pequeño y reversible dentro de un envelope (objetivo vivo, micro-deloads, reordenar) y te lo cuenta; pregunta lo grande/irreversible. | Sobre lo que importa |
| **N3** | **Conduce** | Corre el sistema dentro de tus objetivos —planifica, ajusta, reconcilia— y solo te informa. | Máxima independencia (con override) |

### Cuatro propiedades que lo hacen bueno (no un toggle)
- **Granular, no global.** Por dominio y por clase de acción: _"ajusta mis cargas de fuerza
  (N2), pero pregúntame antes de tocar el plan de carrera (N1)."_
- **Reversible al instante y auditable.** Aquí paga el event sourcing: cada acción autónoma
  es un evento en el log — ves qué hizo Kai y lo deshaces. **Eso es lo que hace segura la
  autonomía alta**: delegas sin miedo porque nada es caja negra ni irreversible.
- **Ganado y ajustable.** Subes el nivel cuando Kai se gana la confianza. La app puede
  *sugerir* subir (_"6 semanas acertando los ajustes; ¿los hago solos?"_) pero **nunca se
  auto-asciende.** Tú redactas cuánto delega.
- **Guardarraíles duros en todos los niveles:** nunca algo peligroso, nunca irreversible sin
  ti, siempre overridable.

### Dos ejes (precisión)
- **Autonomía** (cuánto Kai *hace* sin preguntar): N0→N3. Es el dial principal.
- **Voz** (cuánto Kai *dice*): silencioso ↔ terso ↔ conversacional. Ajuste secundario sobre
  cualquier nivel. (Se puede tener N3 callado —hace y apenas informa— o N1 conversacional.)

### Técnicamente = una policy de permisos sobre el log
El nivel no es una feature suelta: es un **gate sobre qué eventos Kai puede auto-emitir**.

```ts
interface AutonomyPolicy {
  scope: { domain?: string; actionClass: ActionClass };  // granular
  level: 'observe' | 'advise' | 'adjust' | 'drive';
}
// N1 (advise):  Kai solo emite  proposal.raised
// N2 (adjust):  Kai emite       block.revised {by:'kai'}  SOLO si actionClass ∈ envelope reversible
// N3 (drive):   Kai emite       block.revised / reconciled  dentro de objetivos; todo en el log
```
Como todo es evento append-only, cada auto-acción es auditable y reversible por diseño. El
nivel gobierna el motor que ya existe; no añade uno nuevo.

### El Glifo refleja el nivel
Coherente con el carácter: a más autonomía, El Glifo actúa más y habla menos (un pulso
discreto al hacer algo, en vez de una tarjeta a aprobar). Ves *cuánto* opera Kai en cuánto
se mueve el trazo sin pedirte permiso.

### Por qué encaja con la tesis (no contradice "propone, tú dispones")
"Propones/dispones" no era una ley rígida — era el **N1**. El dial lo generaliza: la
autonomía sigue siendo sagrada (SDT) porque **tú eres el autor de cuánta hay**. Autonomía no
es "el agente no hace nada"; es "tú redactas cuánto hace, y lo cambias cuando quieras".

---

## 2. Construir el agente definitivo (no un wrapper)

**Un gran coach-agent NO es un prompt más grande sobre GPT.** Envolver un LLM lo hace
cualquiera en un fin de semana y el modelo base lo comoditiza. El mejor del mercado se
construye de cuatro cosas:

1. **Núcleo determinista de dominio.** La ciencia del entrenamiento codificada
   (periodización, gestión de fatiga, modelos de progresión, autorregulación) como lógica
   pura, testeable, auditable. Hace el consejo *correcto y seguro*, no "que suena bien". El
   LLM no decide la carga bajo la barra — la decide código que un coach de élite firmaría.
2. **Datos propios que componen.** Cada reconciliación, cada accept/reject, cada arco real
   (y con la capa coach, miles). El agente mejora porque ha *visto* miles de historias — el
   moat generativo. Ningún wrapper lo tiene.
3. **Evals como disciplina.** No puedes ser "el mejor" sin *medir* "mejor". Un harness:
   ¿el consejo coincide con lo que haría un coach de élite? ¿evita recomendaciones con
   riesgo de lesión? backtesting sobre datos reales. Así lo *sabes*. Esto separa una empresa
   de IA seria de un demo — y es lo que un socio de YC quiere ver.
4. **El humano en el bucle como señal de entrenamiento.** Cada accept/reject es un dato
   etiquetado que entrena el modelo de buen coaching (y de ti). **El uso del producto ES los
   datos de entrenamiento.**

### Estrategia de modelo (fase, no big-bang)
- **Fase 1 — andamio (ahora):** núcleo determinista + LLM base (Claude/GPT) solo como voz.
  Envía valor, itera producto/tech, empieza a recoger datos y construir las evals. *El LLM
  base es andamio, reemplazable — no el producto.*
- **Fase 2 — el definitivo:** las *decisiones* pasan cada vez más a modelos propios afinados
  + el núcleo determinista + tus datos. El LLM base se vuelve intercambiable. Ahí eres el
  mejor y **no eres replicable por el modelo base.**

### Honestidad de secuencia
Construir "el agente definitivo" *antes* de tener datos y evals es adivinar qué es "mejor".
Orden correcto: **andamio → prueba el loop → recoge datos + define "mejor" con evals → posee
las decisiones.** Es exactamente el instinto de Álvaro ("de primeras algo básico para
iterar; el definitivo es el que creemos"). El error sería enamorarse del modelo antes de
tener el producto y la vara de medir.

### El invariante que no cambia entre fases
Números y decisiones de código determinista y testeable; el LLM (base o propio) **solo pone
la voz**. Eso mantiene el consejo auditable y seguro en las dos fases, y es lo que hace que
"el mejor coach" no sea "el que mejor suena" sino "el que mejor acierta, y puedes probarlo".

---

## 3. La conexión: los niveles SON el motor del agente definitivo

No son dos proyectos — son la misma máquina:

```
   Concedes autonomía (subes de nivel)
            │
            ▼
   Kai actúa más solo  ──▶  cada accept/reject (N1) y cada acción NO-revertida (N2/N3)
            ▲                          │
            │                          ▼
   la confianza se gana con      DATO ETIQUETADO  ("¿acertó Kai?")
   datos ◀──────────────────────  → alimenta evals + entrena el agente definitivo
```

- Cada decisión en N1 y cada auto-acción no revertida en N2/N3 es señal de si Kai acertó.
- La confianza se gana con datos; conceder confianza (subir nivel) genera más datos.
- Los usuarios que llegan a N3 —y las carteras de los coaches— son la **mina de datos de
  resultados reales** con la que se construye el mejor agente. **El dial de autonomía es el
  mecanismo de recogida de la señal del moat.** UX y estrategia de datos son lo mismo.

---

## 4. Riesgos honestos
1. **Confianza mal calibrada.** Si Kai sube de nivel y falla, quema la confianza rápido. Por
   eso: subida solo sugerida (nunca automática), guardarraíles duros, y reversibilidad total
   vía el log. La barra para *sugerir* subir debe ser alta y medida (accept-rate sostenido).
2. **El núcleo determinista es trabajo de dominio real.** Codificar periodización/fatiga bien
   es difícil y es donde se gana o se pierde. No hay atajo; es el trabajo.
3. **Evals de coaching son difíciles de definir** (no hay "ground truth" único). Mitigación:
   empezar por lo negativo y objetivable (no recomendar cargas con riesgo, no ignorar
   fatiga) + comparación con heurísticas de coaches de élite, y afinar.
4. **La tentación del wrapper.** Es facilísimo enviar un GPT-wrapper y llamarlo "el agente".
   Sirve como andamio (Fase 1) pero **no** como destino. La disciplina es no confundir el
   andamio con el edificio.

---

## Registro de revisiones
- v1 (2026-07-03) — El agente: (1) dial de autonomía de 4 niveles (Observa/Aconseja/Ajusta/
  Conduce), granular/reversible/ganado, dos ejes (autonomía + voz), como policy de permisos
  sobre el log event-sourced, El Glifo reflejando el nivel, encaje con SDT; (2) construir el
  agente definitivo (no wrapper): núcleo determinista + datos que componen + evals + humano-
  como-señal, estrategia de modelo andamio→propietario, honestidad de secuencia; (3) la
  conexión: los niveles son el motor de recogida de datos que construye el agente definitivo.
