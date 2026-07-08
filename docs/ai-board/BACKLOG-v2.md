# BACKLOG v2 — Sprint "Activación de nivel + wedge híbrido"

Deriva de [07-strategy-v2.md](./07-strategy-v2.md), teardown [06](./06-design-teardown.md) e ingresos
[05](./05-market-validation.md). Objetivo del sprint: subir el onboarding de **5.7 → ≥8/10** contra
sus referentes y apuntar al **atleta híbrido**. Reglas de [PRINCIPLES.md](./PRINCIPLES.md) v2.

## En vuelo (dev iteración 2, worktree `agent-afed09327c8520a5b`)

Ya en ejecución, NO reasignar — se integran antes de arrancar la ola v2:
- Fix P0 nombre truncado (causa: commit por-keystroke en TextBlank).
- PlannerTour gate (parcial de A1 abajo — el crítico pide **eliminarlo**, no solo diferirlo; el dev v2 lo remata).
- Funnel analytics emitido desde el flujo premium.
- Feedback del CTA "Entrar a Kairos" durante la generación.

## Ola v2 — reparto por desarrollador

### DEV-U (kairos-uiux-designer) — arquitectura de activación. Propiedad: `src/screens/onboarding/**`, `src/features/onboarding/**`, `src/screens/WelcomeScreen.tsx`, `src/screens/AuthScreen.tsx`, `src/screens/tabs/**` (home día-0).

- **U-A · Valor antes que cuenta (06 P0-1).** Mover la pantalla de login a **después del reveal**.
  El flujo entero (manuscrito → teatro → reveal) funciona guest-first sin cuenta. El signup se
  reencuadra: "guarda lo que Kai acaba de crearte". Ruta "continuar sin cuenta" siempre visible.
  ✓ Signup en posición ≥8 del flujo; instalación limpia llega al reveal sin teclear email; existe skip.

- **U-B · El reveal es un momento (06 P0-2).** Teatro de carga 1.8-2.4s con copy que **cite las
  respuestas** ("Con 3 días y un gimnasio, te monto la fuerza…"); la card del plan entra con
  `withSpring` responsive + `notificationAsync(Success)`; y **muestra la semana sembrada** (los N días
  declarados, de `weekAssignments`), no un bloque suelto. Mismo teatro en camino IA y fallback.
  ✓ El reveal muestra exactamente los N días declarados; hay animación de entrada (no estática); haptic
  al aparecer; el copy referencia ≥1 respuesta del usuario. Forzar fallback = mismo teatro.

- **U-C · Fuera el tour, coach-mark en contexto (06 P0-3).** Eliminar el tour full-screen de 3 páginas.
  Primera pantalla tras entrar = el espacio del usuario con su bloque real. Un único coach-mark
  contextual anclado a "Fuerza · Día A" real, dismissable, primera-vez-solo. Sin overlay de debug en Release.
  ✓ 0 pantallas de tour; el coach-mark nombra el bloque real; sin banner de debug.

- **U-D · Manuscrito sin fatiga (06 P1-1).** Fijar la pregunta activa arriba (respuestas previas
  colapsadas en resumen), indicador "página X de 6" (goal-gradient), tipografía diferenciada
  elegido(oro sólido)/opción(outline), **multi-select real en equipo** con chips que sumen.
  ✓ Progress presente en cada paso; input activo siempre visible sin scroll; equipo admite ≥2.

- **U-E · Home honesto día-0 (06 P1-2).** Sin scores numéricos fabricados con 0 sesiones (estado "por
  calibrar"); una sola acción primaria oro (el mensaje superior deja de ordenar "programar"); saludo
  con **nombre completo**; rings a un solo acento hasta que haya datos.
  ✓ Con 0 sesiones no se renderiza ningún número inventado; 1 solo CTA oro sobre el pliegue; saludo completo.

### DEV-L (kairos-ai-engineer) — wedge híbrido + Kai accionable. Propiedad: `src/store/**`, `src/lib/**`.

- **L-A · Preset "Atleta Híbrido / Hybrid Race" (05 P0-1).** Plantilla de bloques que mezcle en UNA
  sesión erg (m/tiempo), sled (kg/m), carrera (pace), estaciones (reps) usando **solo** los campos
  dinámicos existentes. Se ofrece cuando el quiz declara disciplina híbrida/multidisciplina. Sin usar
  la marca "HYROX" (usar "hybrid race / entrenamiento híbrido"). Tests del preset.
  ✓ Un perfil híbrido genera una sesión con ≥4 tipos de campo distintos sin crear campos a mano; test verde.

- **L-B · "Siguiente paso" de Kai a un tap (05 P0-2, 02 P0-3).** Cada resumen post-workout y la pantalla
  Hoy terminan en UNA recomendación determinista aplicable con un tap (offline, sin LLM para el signal).
  Evento `kai_action_applied`/`kai_signal_viewed`.
  ✓ Toda sesión completada termina en 1 recomendación aplicable en 1 tap; eventos emitidos; test de la heurística.

- **L-C · Paywall anti-dark-pattern (05 P0-3, 03 D4).** Estructura de datos + gating para: X siempre
  visible, aviso "te avisamos 2 días antes de cobrar", export CSV/JSON libre en tier gratis. Copy del
  paywall y flag de estado Pro. (Fake-door en beta, sin RevenueCat aún.)
  ✓ El paywall expone aviso pre-cobro y export libre; emite `paywall_viewed/dismissed`; el estado Pro gatea.

- **L-D · Import CSV tolerante al híbrido (05 P1-6).** El pipeline existente (Strong/Hevy) mapea columnas
  de distancia/tiempo/pace a campos dinámicos en vez de descartarlas.
  ✓ Un export de Strong con ejercicios de cardio/tiempo conserva el 100% de campos; test con fixture sucio.

## Contrato de integración (sin cambios respecto a v1, ampliado)

```ts
// L-A expone el preset consumible por el quiz de DEV-U:
generateHybridPreset(answers: StarterAnswers): OnboardingSpaceResult;
// generateOnboardingSpace ya devuelve weekAssignments — U-B los pinta en el reveal.
// track() y ANALYTICS_EVENTS de src/lib/analytics para todos los eventos nuevos.
```

Propiedad de archivos estricta (ningún dev toca la carpeta del otro). Gate por commit: tsc + eslint 0
errores + vitest verde. Commits bisectables, copy en español, tokens siempre, sin Co-Authored-By.

## Criterio de cierre del sprint (lo revisa el crítico, NO el autor — PRINCIPLES v2)

Re-teardown de las mismas pantallas contra los mismos referentes: **nota media ≥ 8/10**, con los 3 gaps
P0 del informe 06 cerrados y verificados en simulador (guest hasta el reveal · reveal con semana + teatro
+ haptic · sin tour). Preset híbrido demostrable. Si no converge en esta iteración, se re-itera; no se
rebaja el listón.

## Diferido explícito (P2, no este sprint)

Welcome (pincelada huérfana, "operada"→"orquestada", micro-motion) · nombre sin teclado (prefill Apple) ·
social proof real en signup (cuando exista) · RevenueCat real · catálogo de presets de la larga cola ·
test de precio a 59,99€ para híbrido · cohortes de retención M1-M4 · radar trimestral trustmrr/acquire.
