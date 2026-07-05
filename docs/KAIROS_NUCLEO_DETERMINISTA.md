# KAIROS — El núcleo determinista (el cerebro de dominio)

_2026-07-03, worktree de seguridad, LOCAL-ONLY, cero código. El pilar 1 de
[KAIROS_EL_AGENTE.md](./KAIROS_EL_AGENTE.md) §2: la ciencia del entrenamiento codificada como
lógica pura, testeable y auditable. Es lo que hace al agente **correcto y seguro** —no "que
suena bien"— y lo que un wrapper de GPT estructuralmente no puede fingir. Anclado en ciencia
del deporte con citas, y **honestamente escalonado por nivel de confianza** (§6): no
inventamos precisión que no existe. Se apoya en el cerebro puro que ya existe
(`metricTrend`, `estimateOneRepMax`, `detectPr`, `proposal`, `brain`)._

---

## 0. Qué es y por qué

El núcleo determinista es el **cerebro de dominio**: convierte tu historial en decisiones de
entrenamiento mediante **funciones puras** (sin red, sin LLM, testeables, reproducibles). No
es "una IA que sabe de fitness" — es la ciencia del entrenamiento *codificada*, de modo que:
- El consejo es **correcto** (sale de modelos establecidos, no de plausibilidad estadística
  de un LLM), y **seguro** (los invariantes de lesión son código, no sugerencia).
- Es **auditable**: cualquier número que Kai te muestre se reproduce desde tus datos con
  código que puedes leer. Ese es el "no humo" del proyecto, hecho literal.
- Es **el moat que un wrapper no finge**: envolver GPT lo hace cualquiera; codificar
  periodización, fatiga y progresión bien, no. Aquí vive la ventaja de dominio.

El invariante que gobierna todo (repetido de la arquitectura): **las decisiones y los números
salen del núcleo; el LLM —base o propio— solo pone la voz de Kai.** Nunca al revés.

---

## 0.5 Ley rectora: lógica compleja debajo, conceptos básicos arriba (para todos los públicos)

**Toda la jerga de este documento —ACWR, e1RM, MRV, τ— es de la sala de máquinas. El usuario
NO la ve jamás.** Son dos vocabularios, separados a propósito:

| El motor piensa en… (oculto) | Kai dice… (universal, humano) |
| --- | --- |
| ACWR > 1.4, fatiga acumulada 3 sem | "Vienes cargado. Hoy yo bajaría el ritmo." |
| e1RM +4% en 6 sesiones | "Te estás haciendo más fuerte. Mira." |
| estancamiento + estímulo repetido | "El press lleva tres semanas plano. Suele ser el mismo estímulo." |
| deload debido (readiness = overreaching) | "Toca una semana más suave." |

La complejidad es **trabajo invisible al servicio del usuario, no vocabulario que tenga que
aprender.** Ningún término técnico llega a la superficie — esa es la definición de "conceptos
básicos en una lógica compleja". Cuanto más duro trabaja el motor, menos tiene que saber el
usuario. (Este doc está lleno de jerga *porque es el plano del motor*; la app no.)

**Universalidad — mismo valor, dé igual quién y por qué.** El producto no exige programa, meta
ni estructura. Quien entrena algo estructurado y quien hace algo esporádico reciben la **misma**
calidad de entendimiento. El operador se adapta a cuánta estructura traes *tú*, no al revés.
Una sola sesión suelta ya da una Lectura útil, sin plan. **Si usas la app, dé igual el motivo,
te sirve igual** — del atleta híbrido serio al que entrena una vez cada quince días sin razón
fija. Nunca un "no puedo ayudarte, no tienes un plan". El núcleo escala su profundidad a los
datos que hay, pero su *utilidad básica* está desde el primer registro. Esta ley se mide en las
evals (KAIROS_EVALS §3, universalidad).

---

## 1. La forma: un pipeline puro

```
  log de eventos ──▶ PROYECCIONES ──▶ ESTIMADORES ──▶ DETECTORES ──▶ REGLAS ──▶ SEGURIDAD ──▶ Decision
   (verdad)          (§Arq §2)        (señales)       (flags)       (propuesta)  (invariantes)     │
                                                                                                    ▼
                                                                                     narrate() → voz de Kai (LLM)
```

Cada etapa es pura y testeada:
- **Estimadores** (§2): eventos crudos → señales derivadas (e1RM, volumen, carga aguda:crónica, fatiga).
- **Detectores** (§3): señales → flags ("estancado", "sobrecarga", "desequilibrio", "toca deload").
- **Reglas** (§4): flags + tu objetivo → cambio propuesto, por arquetipo.
- **Seguridad** (§5): clampa o veta cualquier propuesta. No se puede saltar.

---

## 2. Los estimadores (señales establecidas)

```ts
// e1RM — 1RM estimado desde carga × reps. Epley. Ya existe: estimateOneRepMax.
const e1rm = (w, reps) => w * (1 + reps / 30);            // Tier 1 (fórmula establecida)

// Volumen e intensidad relativa (por patrón/músculo)
const volume = sets => sum(sets, s => s.weight * s.reps); // Tier 1
const intensityPct = (w, e1rm) => w / e1rm;               // Tier 1

// Carga aguda:crónica (ACWR) — carga última semana / media móvil ~4 semanas
const acwr = (acute7, chronic28) => acute7 / (chronic28 / 4); // Tier 2 (constantes debatidas)

// Modelo fitness–fatiga (Banister): rendimiento ≈ fitness − fatiga,
// cada uno un rastro exponencial de los impulsos de entrenamiento.
const trace = (impulses, tau) => /* suma exponencialmente decaída */;  // Tier 2

// Pérdida de velocidad intra-serie (si se trackea VBT): parar ~20–25%.
const velocityLoss = (first, current) => (first - current) / first;    // Tier 1 (umbral Tier 2)
```

Evidencia y honestidad:
- **e1RM / volumen / intensidad** son aritmética establecida (Tier 1).
- **ACWR**: un meta-análisis 2025 (22 estudios) confirma que **>~1.5 predice más lesión y
  <0.8 menos** — pero el óptimo *individual* no está resuelto y hay estudios nulos. [acwr]
  Se codifica **la forma** (ratio agudo/crónico) como Tier 1; **las constantes** (0.8–1.3
  sweet-spot, >1.5 alarma) como Tier 2 a calibrar, nunca como dogma.
- **Fitness–fatiga** (Banister) es un modelo clásico; útil para *readiness* pero las
  constantes de tiempo (τ) son individuales → Tier 2.

---

## 3. Los detectores (señales → flags)

```ts
// Estancamiento: tendencia de e1RM plana/negativa N sesiones (usa metricTrend, ya testeado).
detectStall(e1rmSeries): { stalled: boolean; weeks: number }

// Readiness / sobrecarga: ACWR fuera de banda + subida de RPE a igual carga + caída de rendimiento.
detectReadiness(acwr, rpeTrend, perfTrend): 'fresh' | 'ok' | 'overreaching'

// Desequilibrio: ratios empuje:tirón, izq:der, agonista:antagonista, y balance entre dominios.
detectImbalance(volumeByPattern): Imbalance[]

// Deload debido: N semanas de acumulación, o readiness = overreaching sostenido.
deloadDue(weeksAccumulated, readiness): boolean
```

Los detectores no deciden nada — solo levantan flags. `proposal.ts` ya emite deload/plateau/
imbalance de forma embrionaria; esto los formaliza y los alimenta desde estimadores reales en
vez de reglas de primer-match.

---

## 4. Las reglas de progresión (flags + objetivo → propuesta), por arquetipo

**Decisión de diseño clave, con evidencia:** un meta-análisis de progresión para 1RM de
sentadilla rankea los métodos — **APRE (autorregulado progresivo) #1 (93%), RPE #2 (67%),
velocidad #3, porcentaje fijo ÚLTIMO (13%).** [autoreg] Conclusión: **el motor debe ser
autorregulado primero, no basado en porcentajes.** Y eso es exactamente lo que hace el
objetivo vivo (LA_SESION_VIVA) — estamos del lado bueno de la evidencia.

Reglas por arquetipo (mismo motor, distinta función):
- **Carga discreta (fuerza):** doble progresión (subir reps en rango → luego carga) +
  autorregulación por RPE/RIR (RIR 0–3 para hipertrofia, RPE 7–9 para fuerza — precisión
  distinta por rango de reps [autoreg]). Sobre estancamiento → variar estímulo o subir
  volumen dentro de MEV→MRV; sobre sobrecarga → deload.
- **Esfuerzo continuo (carrera):** progresión de volumen/intensidad con el mismo ACWR sobre
  kilometraje, zonas de ritmo/HR, y VLT análogo (deriva de ritmo). Ciencia madura propia.
- **Por tiempo / rango / habilidad:** progresiones más ligeras o (habilidad) sin número
  (el núcleo hace menos — coherente con §2.5 de LA_SESION_VIVA).

```ts
interface ProgressionRule {
  propose(flags: Flags, goal: Goal, ctx: Projection): ProposedChange | null;
}
```

---

## 5. La capa de seguridad (los invariantes duros — no negociables)

Envuelve TODA propuesta. Ninguna regla puede saltárselos:

1. **Tope de salto de carga:** nunca proponer > X% sobre lo *último logrado* (no sobre el
   plan). El techo lo pone tu cuerpo hoy.
2. **Techo de ACWR:** no proponer una semana que dispare el ACWR a zona de alarma (>~1.3–1.5).
   Progresar sin spikear es una restricción, no un consejo. [acwr]
3. **Parar por velocidad/fatiga:** si se trackea velocidad, cortar la serie a 20–25% de
   pérdida. [autoreg]
4. **Deload forzado:** no dejar acumular fatiga más allá del umbral (readiness = overreaching
   sostenido → deload obligatorio, no opcional).
5. **Zona lesionada / marcada:** nunca proponer cargar un área que el usuario marcó.
6. **Conservador ante datos flacos:** primeras sesiones, sin RPE, señal ruidosa → mantener o
   bajar, nunca subir.

Estos invariantes son la diferencia entre "el mejor coach" y "un consejo que lesiona". Son
código, testeados, y valen en todos los niveles de autonomía del agente (KAIROS_EL_AGENTE §1).

---

## 6. La honestidad por niveles de confianza (el corazón del no-humo)

No todo lo que hace un coach es codificable con la misma certeza. Ser explícito con esto **es**
lo que hace creíble la ambición de "el mejor agente":

| Nivel | Qué es | Ejemplos | Cómo lo tratamos |
| --- | --- | --- | --- |
| **Tier 1 — Establecido** | Fórmulas y aritmética con consenso | e1RM (Epley), volumen/intensidad, forma del ACWR, umbral VLT 20–25% | Se codifica como verdad. |
| **Tier 2 — Evidencia con constantes debatidas** | Modelos con soporte pero cuyo óptimo individual no está cerrado | umbrales de ACWR, τ de fitness–fatiga, landmarks de volumen (MEV/MAV/MRV), progresión autorregulada | Se codifica **la forma**; las **constantes se calibran** con datos/evals. Nunca dogma. |
| **Tier 3 — Necesita datos / no es puro** | Variación individual, técnica, ejercicios nuevos, respuesta idiosincrática | tu τ personal, si tu forma degrada, respuesta a un estímulo nuevo | El núcleo **defiere o va conservador**; aquí es donde los modelos aprendidos de la Fase 2 (datos propios) ganan de verdad. |

Esta tabla es el mapa de trabajo: Tier 1 se escribe ya; Tier 2 se escribe con constantes
provisionales y se afina con las evals + datos; Tier 3 es la razón de ser del flywheel de
datos y del agente definitivo (KAIROS_EL_AGENTE §2). **Prometer Tier-1-de-todo sería el humo
exacto que la crítica prohíbe.**

---

## 7. Multi-dominio: qué es agnóstico y qué es específico

- **Agnóstico de dominio** (funciona sobre la semántica de métricas, KAIROS_ARQUITECTURA §3):
  carga aguda:crónica, fitness–fatiga, detección de tendencia/estancamiento, balance. Estas
  leen *roles* (carga/output/esfuerzo), no deportes.
- **Específico de arquetipo:** las reglas de progresión (§4). Fuerza es el más codificable y
  va primero; carrera tiene ciencia madura propia (TRIMP, zonas, ACWR sobre kilometraje);
  rango/habilidad hacen menos.

Un núcleo, parametrizado — como el objetivo vivo. Añadir un deporte = declarar métricas +
mapear arquetipo + (si aplica) una regla de progresión, no reescribir el cerebro.

---

## 8. Qué existe hoy vs. qué se formaliza (aditivo)

| Pieza | Hoy | Se convierte en |
| --- | --- | --- |
| e1RM | `estimateOneRepMax` | estimador Tier 1 |
| PR | `detectPr` | señal para detectores + "el momento" en vivo |
| tendencias | `metricTrend` (cualquier métrica, `lowerIsBetter`) | base de `detectStall`/readiness |
| propuestas | `proposal.ts` (deload/plateau/imbalance, reglas de primer-match) | reglas §4, alimentadas por estimadores reales |
| composición | `brain.think` | el pipeline §1 orquestado |

No es un rewrite: es formalizar y profundizar el cerebro que ya está seedeado, y conectarlo al
log event-sourced.

---

## 9. Cómo conecta con todo lo demás
- **Es la base del moat** (KAIROS_ESTRATEGIA §3): la ciencia codificada + los datos que
  componen. Lo que un wrapper no puede replicar.
- **Es contra lo que miden las evals** (KAIROS_EL_AGENTE §2, pilar 3): ¿el núcleo propone lo
  que haría un coach de élite? ¿evita el riesgo? Sin núcleo determinista, no hay nada que
  evaluar objetivamente.
- **Alimenta el objetivo vivo** (LA_SESION_VIVA §2.1): `safeTarget` ES la capa de seguridad §5
  aplicada en vivo.
- **Fase 1 → Fase 2:** las constantes Tier 2 y la individualización Tier 3, que en Fase 1 se
  fijan a mano/heurística, en Fase 2 se aprenden de tus datos. El núcleo no se tira — se
  vuelve más tuyo. El LLM nunca entra a decidir; entra a narrar.

---

## 10. Por dónde empezar (el núcleo mínimo coherente, on-sim, sin LLM)
El cerebro más pequeño que ya es un cerebro de verdad — carga discreta (fuerza):
1. **Estimadores:** e1RM + volumen + ACWR (ya tienes e1RM).
2. **Detectores:** `detectStall` (sobre `metricTrend`) + `detectReadiness` (ACWR + RPE).
3. **Regla:** doble progresión autorregulada por RPE/RIR.
4. **Seguridad:** tope de salto + techo de ACWR + conservador-ante-duda.
Todo puro, testeable, verificable en el simulador sobre datos sembrados, cero red. Es también
el motor del experimento-gate de LA_SESION_VIVA §9 (el objetivo vivo en el descanso).

---

## 11. Riesgos honestos
1. **Codificar la ciencia bien es el trabajo real** — Tier 2 mal calibrado da consejo malo.
   Mitigación: constantes conservadoras + evals + humano en el bucle.
2. **La tentación de fingir Tier 1 donde es Tier 2/3.** La tabla §6 es la disciplina; hay que
   defenderla como "propone, tú dispones".
3. **La ciencia del deporte evoluciona y tiene debate** (el propio ACWR). El núcleo debe ser
   *versionable* (las constantes son datos, no código hardcodeado) para actualizarse sin
   reescribir.
4. **Individualización (Tier 3) es genuinamente difícil** y es donde Fase 2 + datos mandan; no
   sobre-prometer en Fase 1.

---

## Fuentes
- [acwr] ACWR para predecir riesgo de lesión — revisión sistemática y meta-análisis 2025
  (>1.5 más riesgo, <0.8 menos; óptimo individual sin resolver):
  https://link.springer.com/article/10.1186/s13102-025-01332-x
- [autoreg] Entrenamiento autorregulado para fuerza máxima — meta-análisis en red (APRE > RPE >
  velocidad > porcentaje): https://www.sciencedirect.com/science/article/pii/S1728869X25000590
  ; RPE/RIR/velocidad como herramientas y VLT 20–25%:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC12360324/

## Registro de revisiones
- v1 (2026-07-03) — El núcleo determinista: pipeline puro (estimadores→detectores→reglas→
  seguridad), estimadores establecidos (e1RM/volumen/ACWR/fitness-fatiga/VLT) con citas,
  detectores (stall/readiness/imbalance/deload), reglas autorreguladas-primero (con evidencia
  de que porcentaje fijo es lo peor), capa de seguridad como invariantes duros, la tabla de
  honestidad Tier 1/2/3 (el corazón del no-humo), multi-dominio agnóstico vs específico, mapa
  de lo existente, conexión con moat/evals/objetivo-vivo/Fase2, y el núcleo mínimo por donde
  empezar.
