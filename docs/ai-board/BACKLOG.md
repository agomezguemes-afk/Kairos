# BACKLOG — Sprint "Onboarding que activa" (Directiva de IA, 2026-07-07)

Síntesis de los 4 informes (01-producto, 02-mercado, 03-comercial, 04-ux). Los cuatro
convergen en el mismo eje: **el momento aha (generación IA del espacio) existe en el código
pero ocurre invisible; el flujo pide cuenta antes de dar valor; y el plan generado nunca
llega a la semana.** Este sprint convierte eso en el flujo canónico: quiz → teatro de
generación → reveal del sistema → semana sembrada → primer workout. Cuenta después del valor.

## Consenso P0 (aparece en ≥3 informes)

| # | Directiva | Fuentes |
|---|---|---|
| 1 | Un solo onboarding canónico; retirar flujos muertos; flag explícito `onboardingCompletedAt` | 01-P0.3, 04-P0.1 |
| 2 | Anonymous-first: valor antes de cuenta; fix bug modo Auth | 03-D3, 04-P0.2, 01-P1.7 |
| 3 | Loading theatre por etapas + pantalla Reveal (bloques + mini-semana) | 01-P0.2, 03-D2, 04-P0.3 |
| 4 | Sembrar la semana: bloques generados asignados a días según frecuencia | 01-P0.1, 02-P0.2 |
| 5 | Instrumentar el funnel (eventos locales persistidos) desde el build 1 | 01-P1.6, 02-P2.7, 03-D1, 04-P2.12 |
| 6 | Hueco de paywall post-reveal ("Kairos Pro — gratis durante la beta", fake door con eventos) | 03-D2c |

## Sprint 1 — reparto por desarrollador

### DEV-L (kairos-ai-engineer) — lógica. PROPIEDAD EXCLUSIVA de:
`src/store/**`, `src/lib/**`, `src/navigation/**`, `src/context/**`, `App.tsx`,
y el BORRADO de pantallas muertas.

- **L1. Semana sembrada.** `generateOnboardingSpace`/`applyStarterSpace` asignan los bloques
  a días concretos según `frequency` (3→lu/mi/vi, etc.). El resultado expone
  `{ blocks, weekAssignments }` para que el Reveal lo pinte.
  ✓ Tras onboarding fresco, Plan muestra ≥frequency sesiones en 7 días; Hoy resuelve
  "sesión de hoy o próxima" sin estado vacío. Test unitario por frecuencia (2/3/4/5).
- **L2. Flag canónico.** Sustituir el gate `userName.trim().length > 0` de AppNavigator por
  `onboardingCompletedAt` (persistido). Acción de store `completeOnboarding(result)` que:
  siembra la semana (L1), persiste el flag, y emite `onboarding_completed`.
  ✓ Instalación limpia hace UNA pasada de preguntas; kill de app en cualquier página no corrompe estado.
- **L3. Retirar flujos muertos.** Eliminar `OnboardingChatScreen`, `SetupScreen` y el paso
  previo `ProfileSetupScreen` del navigator y del árbol (borrar archivos si nada más los usa).
  ✓ `grep` sin referencias vivas; typecheck verde.
- **L4. Módulo de analytics local-first.** `src/lib/analytics/` — `track(event, props)`, cola
  persistida en AsyncStorage, exportable a JSON. Eventos: `onboarding_started`,
  `quiz_step_viewed(n)`, `onboarding_step_completed(n)`, `space_generated(source, duration_ms)`,
  `plan_reveal_viewed`, `reveal_action(start|adjust|regenerate)`, `paywall_viewed`,
  `paywall_dismissed`, `onboarding_completed`, `first_workout_started`, `first_workout_completed`.
  ✓ Tras un run e2e, eventos con timestamps coherentes; test unitario del módulo.

### DEV-U (kairos-uiux-designer) — UI/UX. PROPIEDAD EXCLUSIVA de:
`src/screens/onboarding/**`, `src/components/onboarding/**`, `src/screens/WelcomeScreen.tsx`,
`src/screens/AuthScreen.tsx`.

- **U1. Welcome → quiz directo (soft-wall).** «Empezar» lleva al quiz, no a Auth. «Ya tengo
  cuenta» navega a Auth con `route.params.mode='signin'` (fix del bug actual). En AuthScreen:
  respetar `mode`, retirar botones placeholder Apple/Google (hacen `console.log`) y el link
  de contraseña hasta que existan.
  ✓ Instalación limpia llega al reveal sin teclear email; «Crear cuenta» muestra copy de signup.
- **U2. Loading theatre.** Sustituir la espera muda por 3-4 pasos narrados con checks oro
  («Creando Día A…», «Programando tu semana…»), mínimo percibido 2.6s, idéntico en camino IA
  y fallback de plantilla. KaiMascot presente si el componente existe.
  ✓ Forzando fallback (sin red) se ven ≥3 pasos; ningún estado mudo >2s.
- **U3. Reveal.** Fase final dentro del flujo de onboarding (no ruta nueva del navigator):
  muestra bloques generados con ejercicios + mini-semana (de `weekAssignments`), acciones
  Empezar / Ajustar / Regenerar. Cascada con springs de tokens, oro SOLO en CTA primario,
  `Shadows.cardWarm`, entrada 480ms, haptic Success.
  ✓ El usuario ve nombre de bloque + ejercicios + días ANTES del Dashboard.
- **U4. Paywall fake-door beta.** Tras el Reveal: pantalla «Kairos Pro — gratis durante la
  beta» con continuar; emite `paywall_viewed`/`paywall_dismissed`.
- **U5. Motion a norma.** ENTER_MS 600→280, PAGE_FADE 400→240, stagger 240; 480 solo para el
  reveal; `useReducedMotion` respetado. Selección con glow (`gold.glow` + borde) en lugar de
  relleno oro sólido; headings nunca en oro.
  ✓ Sin duraciones fuera de rango en el quiz; área oro sólido ≤ CTA.

## Contrato de integración (AMBOS deben respetarlo exactamente)

```ts
// src/lib/analytics/index.ts  (implementa DEV-L; DEV-U solo lo importa)
export function track(event: string, props?: Record<string, unknown>): void;

// Acción de store (implementa DEV-L en el store de onboarding/workout que corresponda;
// DEV-U la llama al pulsar «Empezar» en el Reveal):
completeOnboarding(result: OnboardingSpaceResult): void;

// generateOnboardingSpace devuelve (DEV-L extiende, DEV-U consume):
type OnboardingSpaceResult = {
  blocks: WorkoutBlock[];
  weekAssignments: { blockId: string; weekday: number }[]; // 0=domingo … 6=sábado
  source: 'ai' | 'template';
  durationMs: number;
};
```

Si DEV-U necesita el contrato antes de que exista, programa contra estas firmas con un
stub local marcado `// TODO(integración)` — el orquestador lo conecta al mergear.

## Reglas para ambos devs

1. NO tocar archivos propiedad del otro. Conflictos de merge = trabajo perdido.
2. Gate antes de cada commit: `npx tsc --noEmit` ✅ · `npx eslint <archivos tocados>` 0 errores ·
   `npx vitest run` verde. Boil the lake: tests para toda lógica nueva.
3. Commits bisectables, mensajes en convención del repo, SIN línea Co-Authored-By.
4. Tokens de `src/theme/tokens.ts` siempre; oro raro y significativo; sin modales pesados.
5. Copy de usuario en español.

## Diferido (P1/P2 — próximas iteraciones del loop)

Coach marks en vez de PlannerTour modal · duración de sesión en el quiz · rama de import CSV
en onboarding · Sign in with Apple/Google reales · priming de notificaciones · preview viva
del espacio durante el quiz · export abierto · RevenueCat + gates free/Pro · analytics de
progresión · migración AuthScreen a tokens v3 · KaiMascot como personaje del flujo completo.

## Criterio de validación del sprint (Fase 4 — lo revisa la directiva)

Instalación limpia en simulador: splash → quiz (una pasada, back conserva respuestas) →
teatro ≥3 pasos → reveal con bloques reales + semana → paywall beta → Dashboard con Hoy
poblado y Plan con ≥frequency sesiones. Cero pantallas de auth antes del reveal. Eventos
del funnel completos en el log. Gate verde. Vídeo/capturas como evidencia.
