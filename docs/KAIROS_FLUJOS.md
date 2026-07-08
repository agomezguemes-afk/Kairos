# KAIROS — Flujos clave

_2026-07-03, LOCAL-ONLY. Los recorridos que conectan la estrategia, la sesión viva y la
arquitectura. Diagramas de forma, no specs de pantalla. Pareja de los mockups
(`mockups/kairos-mockups.html`)._

---

## Flujo 1 — Onboarding → primera Lectura (resolver el arranque en frío)
El arranque en frío deja de ser un vacío: se convierte en "Kai te lee por primera vez".

```
Bienvenida (editorial)
   │
   ▼
¿Qué entrenas?  ── selecciona dominios (fuerza / carrera / movilidad / deporte…)
   │              → siembra arquetipos + semántica de métricas por dominio
   ▼
¿Cómo quieres sentirte?  ── el "por qué" sentido (Segar), no meta abstracta
   │
   ▼
Kai arma tu primer bloque  ── generativo, sobre intent; lo aceptas/ajustas
   │
   ▼
PRIMERA SESIÓN  ── (bucle vivo, Flujo 2) — aunque sin historial, la estructura
   │                intra-sesión ya da señal (curva de fatiga, margen, simetría)
   ▼
LA PRIMERA LECTURA  ── "Kai te ha leído por primera vez. Esto es lo que ha visto."
                        gancho, no vacío · primera línea del Historial
```
Valor entregado **antes** de cualquier IA (reglas deterministas + primer bloque). PLG:
el usuario ve el operador funcionar en <2 min.

---

## Flujo 2 — El bucle vivo en-sesión (el corazón adictivo, silencio afuera / vivo adentro)

```
   ┌───────────────────────────────────────────────────────────────┐
   │  OBJETIVO VIVO ──▶ EJECUTAS ──▶ El Glifo reacciona en vivo     │
   │       ▲                              │                          │
   │       │                              ▼                          │
   │  recalibra ◀── MICRO-LECTURA en el descanso  (una frase, un    │
   │  (safeTarget)   + próximo objetivo             número, El Glifo)│
   └───────────────────────────────── se repite cada serie ─────────┘
                                   │
                          (¿es un momento? PR a una rep → El Glifo se tensa)
                                   │  al terminar
                                   ▼
                              LA LECTURA  (Flujo 3)
```
Reglas: Kai habla solo entre series, una línea, solo si cambia la siguiente. 90%
forma/vistazo, 10% texto. La varianza sale de tu cuerpo, nunca de un dado (no dark pattern).

---

## Flujo 3 — El Cierre / reconciliación (el operador "corre" el sistema)

```
Fin de sesión ──▶ SessionClosed (evento)
   │
   ▼
brain.think() sobre proyecciones  ── determinista, puro, testeable
   │        ├─ curva de fatiga / margen / simetría → diagnóstico ("dónde peor")
   │        └─ ranking de qué mueve la aguja → EL FOCO (una sola cosa)
   ▼
LA LECTURA (entendimiento) ── titular = 1 frase + 1 foco; stats plegados
   │
   ▼
¿Genera propuesta?  ── proposal.raised (deload / swap / cross-domain)
   │                    (a lo sumo UNA; silencio > ruido)
   ▼
tú DISPONES  ── accept/reject = proposal.decided (evento) → memory aprende
   │
   ▼
plan re-planificado  ── el horizonte se mantiene fiel a la realidad, solo
                        (entre sesiones: SILENCIO — nada te reclama)
```

---

## Flujo 4 — Razonamiento cruzado entre dominios (el moat anti-fragmentación)

```
log de eventos (todos los dominios)
   │  projectMetrics (semántica → series comparables entre dominios)
   ▼
brain detecta acoplamiento:
   "volumen de carrera ↑  &  sentadilla estancada  →  compiten por recuperación"
   │
   ▼
UNA propuesta cruzada (que ninguna app de una sola categoría puede ver)
```
Esto es scope como moat: un operador que ve todo lo que haces razona entre dominios.

---

## Flujo 5 — El vector de escala: individuo → coach (B2B2C, el desbloqueo venture)

```
INDIVIDUO (cuña, B2C)                          COACH (escala, B2B2C)
   │  usa el operador, retiene por                │  invita/lleva su cartera
   │  switching-cost (Historial propio)           │
   ▼                                              ▼
log de eventos propio  ──(token de consentimiento)──▶  vista de coach
                                                       = PROYECCIÓN sobre N logs
                                                          │
                                                          ▼
                                              agregados cross-cartera (privados)
                                              → el operador programa mejor
                                              → MOAT GENERATIVO fuerte
```
Arquitectónicamente: la capa coach es **un reducer/proyección más**, no un pivot
(ver KAIROS_ARQUITECTURA_DATOS §9). Por eso se diseña desde el día uno aunque se lance
después.

---

## Registro de revisiones
- v1 (2026-07-03) — Cinco flujos: onboarding→primera Lectura, bucle vivo en-sesión, el
  Cierre/reconciliación, razonamiento cruzado entre dominios, y el vector individuo→coach.
