# KAIROS — Arquitectura de datos y técnica profunda

_Documento de ingeniería para Álvaro. 2026-07-03, worktree de seguridad, LOCAL-ONLY, cero
código construido. Va a fondo en la arquitectura que hace reales —no marketing— las
promesas del producto: el Historial que compone, el operador multi-dominio, el local-first
propio, y la capa coach del doc estratégico. Sucede a
[KAIROS_ARCHITECTURE_OPTIONS.md](./KAIROS_ARCHITECTURE_OPTIONS.md) (que planteó forks); este
**se compromete** con un diseño. Pareja de [KAIROS_ESTRATEGIA_CAPITAL.md](./KAIROS_ESTRATEGIA_CAPITAL.md)
y [KAIROS_LA_SESION_VIVA.md](./KAIROS_LA_SESION_VIVA.md)._

---

## 0. La decisión que desbloquea todo: event sourcing

**El Historial ("changelog de ti") no es una feature encima de la base de datos — es la base
de datos.** Todo lo que pasa es un **evento inmutable** en un log append-only; el estado
actual (tus bloques, tu plan, la memoria de Kai, tus tendencias) es una **proyección** —
un `fold` puro sobre ese log.

Por qué es *exactamente* el patrón correcto aquí, y no una elección de gusto:

| Promesa del producto | Lo que event sourcing la vuelve, gratis |
| --- | --- |
| El Historial es tuyo, versionado, compone | *Es* el log de eventos. No hay que "construir" un historial: es el sistema de registro. |
| "Git log de tu cuerpo" (manifiesto Giro B) | Time-travel/replay nativo: reconstruir cualquier estado pasado = fold hasta el evento N. |
| Local-first, sin cloud lock-in (VISION §9) | Los logs append-only sincronizan limpio entre dispositivos (nunca hay conflicto de escritura). |
| Exportable de verdad (doc estratégico) | Export = volcar el log en JSONL. La propiedad de datos es una *propiedad*, no una promesa. |
| El operador propone/dispones, auditable | Cada decisión de Kai y cada accept/reject es un evento. Reproducible, no una mutación silenciosa. |
| Capa coach / señal cross-cartera (moat) | La vista del coach = proyección sobre N logs. B2B2C es una proyección, no un rewrite. |

Una sola decisión arquitectónica y seis promesas dejan de ser aspiracionales. Esto es lo que
separa "adapts to you for real" de humo: **la verdad vive en un log que puedes leer y
exportar; el estado es derivable; nada es una caja negra.**

---

## 1. El modelo de eventos (los átomos del Historial)

Append-only, inmutables, un stream por atleta. Forma (no exhaustiva, crece por arquetipo):

```ts
type EventId = string;              // ULID (ordenable por tiempo, sin colisión multi-device)
type Millis = number;

interface KairosEvent<T extends string, P> {
  id: EventId;                      // ULID → orden total local + merge determinista
  type: T;
  at: Millis;                       // hora del hecho (wall clock)
  clock: HybridClock;              // reloj lógico híbrido para orden causal entre devices
  deviceId: string;
  payload: P;
}

// --- Eventos de estructura (el usuario redacta su mundo) ---
type MetricDefined  = KairosEvent<'metric.defined', {                // la superpotencia
  metricId: string; label: string;
  semantics: MetricSemantics;      // §3 — lo que hace al operador multi-dominio
}>;
type BlockCreated   = KairosEvent<'block.created', { blockId: string; intent: BlockIntent }>;
type BlockRevised   = KairosEvent<'block.revised', { blockId: string; patch: BlockPatch; by: 'user' | 'kai' }>;

// --- Eventos de ejecución (lo que de verdad pasó) ---
type SetLogged      = KairosEvent<'set.logged', {
  exerciseId: string; archetype: Archetype;
  values: Record<string, number>;  // campos definidos por el usuario, no esquema fijo
  target?: Record<string, number>; // el objetivo vivo que se perseguía
}>;
type SessionClosed  = KairosEvent<'session.closed', { sessionId: string; blockId: string }>;

// --- Eventos del operador (Kai propone, tú dispones — auditable) ---
type ProposalRaised = KairosEvent<'proposal.raised', { proposalId: string; kind: ProposalKind; rationale: Rationale }>;
type ProposalDecided= KairosEvent<'proposal.decided', { proposalId: string; decision: 'accept' | 'reject' }>;
type Reconciled     = KairosEvent<'reconciled', { scope: 'session' | 'week'; deltas: ReconcileDelta[] }>;
```

Notas de diseño:
- **ULID como id** → orden total temporal *sin* coordinación central; dos devices offline
  generan ids que ordenan de forma estable al reunirse (crítico para el merge del §8).
- **`values` es un mapa abierto**, no columnas fijas. Es el moat estructural (campos del
  usuario) cableado en el tipo del evento. El operador analiza cualquier clave (§3).
- **La decisión de Kai y tu respuesta son eventos separados** (`proposal.raised` /
  `proposal.decided`) — el "propone/dispones" es estructural, no una convención de UI.

---

## 2. Proyecciones (el estado presente = fold puro del log)

Ningún componente lee "la base de datos"; lee **proyecciones** — reducers puros y testeables
sobre el log:

```ts
type Projection<S> = (state: S, e: AnyEvent) => S;   // puro, determinista, testeable

const projectPlan:     Projection<PlanState>   = /* bloques + horizonte vigente */;
const projectMemory:   Projection<KaiMemory>   = /* modelo de ti: afinidades, sesgos, decisiones */;
const projectMetrics:  Projection<MetricIndex> = /* series por métrica, listas para metricTrend */;
const projectLedger:   Projection<LedgerView>  = /* el Historial redactado (Giro B) */;
```

Consecuencias:
- **`metricTrend`, `brain.think`, `reflection.reflect` ya son funciones puras** (existen y
  están testeadas en `src/features/kai/`). Encajan sin fricción: operan sobre proyecciones,
  no sobre I/O. El trabajo no es reescribir el cerebro — es alimentarlo desde el log.
- **Rebuild-anywhere:** cualquier estado se reconstruye desde el log. Los tests son
  triviales (sequence de eventos → estado esperado). El "no humo" (números reproducibles
  desde tus datos por código que puedes leer, manifiesto §4) es literal.
- **Coste:** rehacer proyecciones desde cero crece con el log → **snapshots** periódicos
  (fold materializado cada N eventos; el log sigue siendo la verdad). Estándar de ES.

---

## 3. La capa de semántica de métricas (lo que hace al operador multi-dominio)

El "para todo el condicionamiento" (LA_SESION_VIVA §2.5) se sostiene en esto. Cada métrica
que el usuario inventa se autodescribe:

```ts
interface MetricSemantics {
  direction: 'higher_better' | 'lower_better' | 'target_band';   // ritmo: lower; peso: higher; HR: band
  role:      'load' | 'output' | 'effort' | 'quality' | 'duration';
  unit:      'reps' | 'mass' | 'distance' | 'time' | 'rate' | 'score' | 'ordinal';
  band?:     { lo: number; hi: number };                          // para target_band (zonas)
}
```

Con esto, un **único** `metricTrend.analyzeMetric` (que ya respeta `lowerIsBetter`) lee
"mejor/peor" sobre *cualquier* campo, sin saber a priori si es una sentadilla o un 5k. El
operador no tiene lógica por deporte: tiene lógica sobre *roles semánticos*. Añadir un
deporte nuevo = declarar métricas + mapear un arquetipo, **cero código nuevo de análisis.**

---

## 4. El motor de arquetipos y el objetivo vivo (un motor, N parametrizaciones)

El bucle vivo es el mismo (LA_SESION_VIVA §1); solo cambia la *función de objetivo* por
arquetipo:

```ts
type Archetype = 'discrete_load' | 'continuous_effort' | 'for_time' | 'range_quality' | 'skill';

interface TargetEngine {
  // Objetivo de la SIGUIENTE unidad, desde la proyección de eventos recientes de la sesión.
  nextTarget(ctx: SessionProjection, semantics: MetricIndex): LiveTarget | null;  // null = sin número (rango/habilidad)
  // Lectura mejor/peor de lo que ACABA de pasar.
  readLast(ctx: SessionProjection, semantics: MetricIndex): Reading;
}

const engines: Record<Archetype, TargetEngine> = {
  discrete_load:     strengthEngine,     // curva de fatiga intra-sesión → reps/carga
  continuous_effort: paceEngine,         // deriva de ritmo/HR → split del próximo tramo
  for_time:          roundEngine,        // caída por ronda → ritmo sostenible
  range_quality:     consistencyEngine,  // sin chase-number: consistencia + simetría
  skill:             exposureEngine,     // sin número: estructura + tu autovaloración
};
```

**Los invariantes de seguridad son código, no promesa** (LA_SESION_VIVA §2.1), y viven en un
wrapper común a todos los engines para que sea imposible saltárselos:

```ts
function safeTarget(raw: LiveTarget | null, ctx): LiveTarget | null {
  if (raw == null) return null;                          // rango/habilidad: no forzar número
  const cap = lastAchieved(ctx) * MAX_STEP;              // el techo lo pone tu cuerpo hoy, no la hoja
  if (thinData(ctx) || sharpDecay(ctx)) return holdOrLower(raw, ctx);  // ante duda, conservador
  return clampToPlanCeiling(min(raw, cap), ctx);
}
```

Determinista, testeable, offline, gratis. El LLM no toca esto (§5).

---

## 5. La frontera determinista / LLM (dónde vive cada cosa)

Regla dura, arquitectónica: **los números y las decisiones salen de funciones puras; el LLM
solo redacta la voz de Kai.** El LLM es un *servicio de narración sin estado*:

```
proyecciones ──▶ brain.think() (puro) ──▶ Decision{kind, numbers, rationale}
                                              │
                          ┌───────────────────┴───────────────────┐
                          ▼                                        ▼
             narrate(Decision) → LLM (voz Kai)          fallbackCopy(Decision) (determinista)
                          │  (contexto MINIMIZADO,                  │  (offline / sin API key /
                          │   estructurado, nunca el log)           │   presupuesto agotado)
                          └───────────────────┬───────────────────┘
                                              ▼
                                        string en voz de Kai
```

Propiedades:
- **Privacidad como arquitectura:** el LLM ve un `Decision` estructurado y minimizado, jamás
  el log crudo. Tu vida no sale del dispositivo; sale una frase-plantilla rellena.
- **Economía cierra:** el coste es proporcional a *decisiones que merecen voz* (pocas —
  silencio > ruido), no a aperturas. Coherente con el modelo anti-engagement (estrategia §5)
  y con "determinista primero" (P3 de la visión).
- **Degradación con gracia:** sin red, la copia determinista mantiene el producto vivo. El
  LLM es una mejora de calidez, nunca un punto único de fallo.

---

## 6. Almacenamiento local-first (el compromiso concreto)

- **El log de eventos → `expo-sqlite`, tabla append-only** `events(id ULID PK, type, at, clock,
  device_id, payload JSON)`. SQLite da consultas indexadas y time-series baratas (analizar
  "RPE 6 meses" es un `SELECT`, no escanear JSON en JS — resuelve el cuello del
  ARCHITECTURE_OPTIONS §3a).
- **Proyecciones → en memoria (Zustand)**, hidratadas al abrir desde el último **snapshot** +
  replay de la cola. El store actual (`workoutStore`) se convierte en un *consumidor de
  proyecciones*, no en el sistema de registro.
- **Config caliente / flags → `react-native-mmkv`** (síncrono, rapidísimo).
- **Por qué no WatermelonDB/Realm** (los forks del doc anterior): son DBs de documentos
  reactivas — brillantes para apps CRUD, pero aquí el sistema de registro es un *log*, no un
  conjunto de documentos mutables. Event-sourcing quiere un append-log + proyecciones, y eso
  es SQLite + reducers puros. Menos dependencia, más control, y encaja el moat (el log ES el
  activo). Realm/Watermelon serían reescribir el store para ganar reactividad que Zustand ya
  da sobre proyecciones.

---

## 7. Sync multi-dispositivo (local-first sin lock-in)

Single-user, multi-device (móvil + iPad + web) → **mucho más simple que CRDT de documentos**:
- Los eventos son **append-only e inmutables** → nunca hay conflicto de escritura sobre un
  evento. Sincronizar = **unir dos streams** y ordenar por ULID/reloj híbrido.
- El único "conflicto" posible es semántico (dos devices proponen cambios divergentes del
  plan offline) → se resuelve en la **proyección** con reglas deterministas (last-writer-wins
  por reloj híbrido para el plan; los dos eventos *se conservan* en el log — no se pierde
  historia, solo se elige el estado vigente). Como es single-user, es rarísimo.
- **El servidor es un relay tonto de logs (backup + fan-out), no el cerebro.** El usuario
  posee el log; el server lo replica cifrado. Eso mantiene "no cloud lock-in" (VISION §9)
  como propiedad real: puedes correr sin servidor, y exportar es un volcado.

---

## 8. Export y propiedad (la propiedad de datos como propiedad técnica)

`export()` = volcar el log de eventos en **JSONL portable** (una línea por evento) + el
esquema de semántica de métricas. Con eso, *otro* sistema podría reconstruir tu mundo. La
"propiedad de datos" que la estrategia vende como moat de confianza **es literalmente el
formato de export**, no una promesa de settings. Lo que *no* se exporta a un competidor es el
entendimiento acumulado del operador *sobre ti* (la calidad de la narración/heurística
afinada) — el moat es la relación, no la jaula (estrategia §3).

---

## 9. La capa coach / federación (el vector de escala, como proyección)

El desbloqueo venture (estrategia §5) es natural en event-sourcing:
- **Vista de coach** = proyección de solo-lectura sobre los logs de sus atletas (con token de
  consentimiento por atleta). El coach no "importa" nada: proyecta.
- **Señal cross-cartera (el moat generativo fuerte)** = **agregados** sobre miles de logs
  (p. ej. "qué reconciliaciones funcionaron para atletas con este patrón"), computados como
  proyecciones agregadas **sin mover logs crudos** (privacy-preserving: agrega features, no
  datos personales). El operador mejora *porque ha visto miles de cierres reales* — pero
  ningún log personal sale de su sitio.
- **B2B2C es una proyección nueva, no una reescritura.** Por eso el doc estratégico dice
  "diseñar la capa coach desde el día uno": no cuesta un pivot, cuesta un reducer.

---

## 10. Qué existe hoy vs. qué es nuevo (migración aditiva)

| Pieza | Hoy | Cambio |
| --- | --- | --- |
| Cerebro puro | `metricTrend`, `brain`, `proposal`, `reflection`, `memory` (testeados) | **Sin cambio de lógica** — pasan a leer proyecciones |
| Datos de ejecución | `workoutStore` + `performedSets` (Zustand+AsyncStorage) | Se convierte en consumidor de proyecciones; el log es nuevo |
| Objetivo vivo | ghost values pasivos (`FieldInput`) | `TargetEngine` por arquetipo + `safeTarget` |
| Historial | `WorkoutSummary` (recap) | `projectLedger` (el log redactado) |
| Persistencia | AsyncStorage (doc) | `expo-sqlite` (log) + snapshots + MMKV |

Ruta: **introducir el log en paralelo** (doble-escritura: el store actual + el nuevo log),
proyectar el log a la forma del store, y una vez verificado, invertir la dependencia (el
store se vuelve proyección). Aditivo, bisectable, sin big-bang.

---

## 11. Riesgos y tradeoffs honestos
1. **Event sourcing tiene coste cognitivo.** Es más disciplina que un CRUD. Se paga con
   testabilidad, time-travel y el moat. Para un producto cuyo *núcleo* es "un historial que
   compone", es el patrón correcto; para una app CRUD normal sería sobre-ingeniería.
2. **Rebuild de proyecciones crece con el log** → snapshots (mitigación estándar). Medir
   antes de optimizar.
3. **Coste del LLM** → contenido por la frontera del §5 (pocas decisiones merecen voz) y el
   fallback determinista. Vigilar que la narración no se vuelva una llamada por apertura.
4. **La calibración de los engines es el trabajo real** (LA_SESION_VIVA): la arquitectura es
   sólida; las *constantes* de los `TargetEngine` se afinan con datos reales, arquetipo a
   arquetipo. No fingir precisión antes de tenerla.

---

## Registro de revisiones
- v1 (2026-07-03) — Arquitectura de datos comprometida: event sourcing como espina (el
  Historial = el log), modelo de eventos con tipos, proyecciones puras, capa de semántica de
  métricas (multi-dominio), motor de arquetipos + objetivo vivo con invariantes de seguridad
  como código, frontera determinista/LLM (privacidad + economía), storage local-first
  (SQLite log + snapshots + MMKV + por qué no Realm/Watermelon), sync multi-device por unión
  de logs, export/propiedad como formato, capa coach/federación como proyección (el vector
  de escala), migración aditiva desde el código actual, riesgos.
