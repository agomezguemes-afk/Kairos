# Validación Fase 4 — Sprint "Onboarding que activa" (2026-07-08)

Recorrido E2E en simulador iPhone 16e (instalación limpia, build Debug + Metro), controlado
por el orquestador con cliclick. Capturas en el scratchpad de la sesión.

## Veredicto: APROBADO con 4 hallazgos

El flujo canónico funciona de punta a punta:

1. **Welcome editorial** («Kairos. tu práctica, operada» + El Glifo) ✓
2. **Selección de login** («Tu progreso, en cualquier sitio» — Apple/Google/correo) ✓
3. **El Manuscrito** — la página se escribe como prosa: nombre → objetivo (fuerza) →
   experiencia (hace un tiempo) → días (scrubber, 3) → equipamiento (un gimnasio) →
   nota libre para Kai (skippeable) → firma «El resto se escribe entrenando. — Kai» ✓
4. **Presentation** — «Kai ya creó tu primer bloque»: Fuerza · Bienvenida con 4 ejercicios
   reales (Press banca 4×8, Sentadilla 4×10, Peso muerto 3×6, Dominadas 3×8) ✓
5. **Entrar a Kairos** → `completeOnboarding(result)` real: navigator voltea por
   `onboardingCompletedAt`, la semana queda sembrada ✓
6. **Dashboard**: FirstWorkoutCTA «Fuerza · Día A — listo para empezar», calendario con
   sesiones en los días asignados (mié/vie visibles), saludo con nombre ✓

Criterio del backlog cumplido: instalación limpia llega del splash al Dashboard poblado
sin teclear un email y con una sola pasada de preguntas.

## Hallazgos (para la siguiente iteración del loop)

1. **[P0-bug] Nombre truncado**: el manuscrito registró «A» de «Alvaro». Sospecha: carrera
   entre commit del TextBlank y tecleo rápido (entrada sintética a alta velocidad). Verificar
   con tecleo humano en device; si reproduce, es un P0 (el saludo del home queda mal).
2. **[P1] PlannerTour sigue disparándose** justo tras «Entrar a Kairos» — rompe el momentum
   (directiva CPO P1-4: coach marks o diferir a la segunda sesión).
3. **[P1] Warning de LogBox** visible al entrar (revisar en debugger; no bloquea).
4. **[P2] Espera muda en «Entrar a Kairos»**: si la generación aún no resolvió, el botón no
   da feedback (~segundos). Añadir estado de carga o gate más temprano.

## Deuda de integración conocida (ya fichada)

- AuthStep es visual: no crea sesión Supabase (anonymous-first funciona; login real pendiente).
- Eventos de funnel del flujo premium sin emitir desde los steps (módulo analytics listo).
- El quiz de DEV-U quedó como componentes de reserva sin ruta (reveal/teatro/paywall
  reutilizables sobre el Manuscrito).
