# 01 — Visión de Producto: Onboarding y Fin Último de Kairos

_Directiva de IA · CPO · 2026-07-07 · Basado en auditoría real del código en `feat/night-run`_

---

## Flujo actual (mapa real)

Existen **dos flujos paralelos** decididos por `SKIP_AUTH` en `src/config/constants.ts` (hoy `true`) y **cuatro implementaciones de onboarding** en el repo, de las cuales solo una está viva.

### Ruta activa (SKIP_AUTH = true) — la que ve un usuario hoy

```
App launch
└─ SplashScreen (overlay, se desvanece solo)
   └─ AppNavigator: ¿workoutStore.userName está vacío?
      ├─ SÍ → OnboardingScreen (src/screens/onboarding/OnboardingScreen.tsx, 5 páginas swipe)
      │   1. Bienvenida — logo pulsante, "El primer lienzo que se adapta a ti"
      │   2. Nombre — input de texto
      │   3. Disciplina — grid de 6 (fuerza, running, calistenia, yoga, deporte, híbrido)
      │   4. Nivel + frecuencia semanal (2/3/4/5+)
      │   5. Equipamiento — 10 chips multi-select + nota libre (saltable)
      │   └─ "Comenzar" → overlay "Kai está montando tu espacio…"
      │       └─ generateOnboardingSpace() (src/lib/ai/onboardingSpace.ts):
      │           agente IA con tools create_block/add_exercise (timeout 9s,
      │           techo duro 12s, validación, snapshot/rollback) → fallback
      │           SIEMPRE a plantillas curadas (84 tests). Nunca falla.
      │       └─ commitAndNavigate(): reset a Dashboard, LUEGO setUserName
      │           (orden crítico — el stack está keyed por userName)
      └─ Dashboard → HomeTab
          ├─ PlannerTour (modal fullscreen, 3 páginas: Bloques/Programa/Progreso)
          │   se dispara ~inmediatamente si tourCompletedAt == null
          └─ TodayPlanner → FirstWorkoutCTA (héroe mientras workoutHistory
              esté vacío) → ActiveWorkout
```

### Ruta auth (SKIP_AUTH = false) — dormida pero en el código

```
Welcome (WelcomeScreen.tsx)
├─ "Crear cuenta"    → navigate('Auth')  ← SIN parámetro de modo
└─ "Iniciar sesión"  → navigate('Auth')  ← idéntico destino
   └─ AuthScreen: default mode = 'signin' ("Bienvenido de nuevo")
       · Google / Apple: console.log, no implementados
       · "¿Olvidaste tu contraseña?": console.log, no implementado
       └─ signUp/signIn (useAuthStore → Supabase) → sesión
          └─ ¿profile.onboardingCompletedAt == null?
             ├─ SÍ → ProfileSetupScreen (formulario largo: nombre, edad, peso,
             │       altura, objetivo, nivel, frecuencia, lugar, lesiones)
             │       · "Guardar y empezar" o "Ahora no" → completeOnboarding()
             │       · OnboardingChatScreen (chat con Kai) está en el mismo
             │         stack pero NADA navega hacia él → CÓDIGO MUERTO
             └─ luego, como userName sigue vacío → OnboardingScreen OTRA VEZ
                 (segunda interrogación: nombre, disciplina, nivel, frecuencia…)
```

**Inventario de implementaciones de onboarding:**

| Archivo | Estado |
|---|---|
| `src/screens/onboarding/OnboardingScreen.tsx` (1.188 líneas) | **Vivo** — el único flujo real |
| `src/screens/OnboardingChatScreen.tsx` (chat con KaiMascot) | Inalcanzable — nadie navega a él |
| `src/screens/ProfileSetupScreen.tsx` | Solo ruta auth; duplica 4 de 5 preguntas |
| `src/screens/SetupScreen.tsx` | Huérfano — cero referencias externas |
| `src/features/onboarding/PlannerTour.tsx` | Vivo — modal educativo post-onboarding |

---

## Diagnóstico

Dónde el flujo actual falla en activar (ordenado por impacto):

1. **El momento "aha" ocurre a oscuras.** Kai construye un espacio personalizado — la mejor pieza del producto — detrás de un logo que se encoge. El usuario nunca ve *qué* se creó ni *por qué*, ni puede aceptarlo/ajustarlo. Aterriza en un Dashboard genérico y tiene que descubrir su plan él solo. El PRD (Flujo 1, pasos 4-5: "Kairos propone una semana. Usuario acepta o edita") **no está implementado**.

2. **El plan generado no toca el calendario.** `generateOnboardingSpace` crea 1-2 bloques pero no los asigna a días. El usuario dijo "entreno 4 días/semana" y la pantalla Plan queda vacía. La promesa central del PRD ("abro Kairos y sé qué toca hoy") depende de FirstWorkoutCTA como único hilo — el resto de la semana no existe.

3. **Educación antes que valor.** Nada más aterrizar, PlannerTour (modal fullscreen de 3 páginas sobre conceptos abstractos: Bloques/Programa/Progreso) se interpone entre el usuario y su espacio recién creado. Es enseñar el manual antes de entregar el regalo. El tour explica lo que el Reveal debería *mostrar*.

4. **Doble interrogación en la ruta auth.** ProfileSetup pregunta objetivo/nivel/frecuencia/lugar; después OnboardingScreen vuelve a preguntar disciplina/nivel/frecuencia/equipo. Dos fuentes de verdad (`profile.onboardingCompletedAt` en Supabase vs `userName` en workoutStore) gobiernan el mismo concepto. Cuando se active auth para TestFlight, esto es un abandono garantizado.

5. **Promesas rotas en Auth.** "Continuar con Google/Apple" y "¿Olvidaste tu contraseña?" son botones visibles que hacen `console.log`. Además "Crear cuenta" desde Welcome aterriza en modo *signin* ("Bienvenido de nuevo") porque no se pasa el modo — el primer tap del usuario ya lo contradice.

6. **Datos pedidos que no se usan; datos útiles que no se piden.** Se pide el nombre pero el prompt de Kai apenas lo usa ("sin nombre" como fallback). No se pide duración típica de sesión (el PRD la lista). El gate de navegación por `userName.trim().length > 0` es un hack frágil que ya causó un bug crítico de activación (NIGHT_REPORT #1).

7. **Deuda que confunde:** 3 onboardings muertos o semi-muertos (~1.500 líneas) que cualquier desarrollador puede tocar por error creyendo que están vivos.

**Lo que ya está bien (preservar):** el contrato "onboarding nunca falla" con snapshot/rollback/fallback de `onboardingSpace.ts` es arquitectura de nivel senior; las plantillas curadas con 84 tests; FirstWorkoutCTA como héroe de activación; la calidad de motion (parallax, springs, haptics) de OnboardingScreen; el copy sobrio en español.

---

## Tesis de producto

**El problema no satisfecho:** las personas que entrenan por su cuenta (20-40 años, 2-5 días/semana, mezclan fuerza/running/movilidad) tienen *rutinas* pero no tienen *sistema*. Su entrenamiento vive fragmentado en Notas, capturas, Excel, WhatsApp y conversaciones de ChatGPT. Nadie une las cuatro fases: **diseñar → planificar → ejecutar → ajustar**.

**Por qué los incumbentes no lo resuelven:**

- **Strong/Hevy** registran rápido, pero no organizan la semana ni proponen el siguiente paso. Son cuadernos, no sistemas.
- **Fitbod** prescribe, pero confisca la propiedad: el usuario que quiere construir *su* método no cabe en su rigidez.
- **Notion** da libertad total de estructura, pero no ejecuta: no cronometra descansos, no detecta PRs, no sabe qué toca hoy.
- **ChatGPT** genera rutinas excelentes y luego las abandona: no las guarda, no las programa, no acompaña la sesión, no aprende del historial.

**Kairos es el único donde la rutina generada se convierte en sistema vivo:** bloques editables como en Notion, ejecución con fantasmas/PRs/descansos como Strong, y un copiloto (Kai) que genera y ajusta como ChatGPT — pero con memoria y calendario. El fin último: **que el usuario sienta que por fin tiene *su* sistema de entrenamiento, uno que se mantiene solo.**

**Por qué el onboarding es EL momento crítico:** la promesa es "un sistema personal". Un sistema no se puede prometer — se tiene que *materializar delante del usuario* en los primeros 3 minutos, o el usuario vuelve a Notas + ChatGPT esa misma noche. La infraestructura ya existe (generación con fallback garantizado, plantillas, FirstWorkoutCTA); lo que falta es el **teatro del valor**: mostrar el sistema naciendo, dejarlo aceptar/ajustar, y sembrar la semana. El onboarding no es un formulario previo al producto — **es la primera demo del producto haciéndose a sí mismo.**

---

## Onboarding 10 estrellas

Minuto a minuto, del primer tap al primer workout:

**0:00 — Apertura.** Splash con el logo respirando (ya existe). Sin Welcome intermedio en modo local: directo a la conversación. Una sola frase: *"Vamos a construir tu espacio de entrenamiento. Dos minutos."*

**0:10 – 1:20 — Las preguntas construyen, no interrogan.** Las 5 páginas actuales se conservan (nombre → disciplina → nivel+frecuencia → equipo) pero con un cambio de encuadre: detrás de las tarjetas, el lienzo del espacio se va materializando en tiempo real como fondo desenfocado — eliges "Fuerza" y aparece la silueta de un bloque; eliges "4 días" y se duplican; marcas equipo y los ejercicios parpadean dentro. Cada respuesta tiene consecuencia visible inmediata. El nombre se usa desde el segundo siguiente ("Perfecto, Álvaro. ¿Qué vas a entrenar?"). Se añade una pregunta: duración típica de sesión (30/45/60/90) — la única que falta según el PRD.

**1:20 – 1:40 — La construcción es visible.** En vez del logo que se encoge, el overlay muestra a Kai trabajando con sus tool calls reales como narración: *"Creando Día A — Empuje…"*, *"Añadiendo press banca, 4 series…"*, *"Programando tu semana: lunes, miércoles, viernes…"*. La generación real tarda 2-9s — exactamente el tiempo de esta micro-narrativa. Si cae al fallback de plantilla, la narración es idéntica: el usuario nunca distingue el camino.

**1:40 – 2:20 — El Reveal (el momento aha).** Pantalla nueva: *"Este es tu espacio."* Los bloques generados aparecen en cascada (spring, stagger) con sus ejercicios visibles, y debajo una mini-semana con los días ya asignados según su frecuencia. Tres acciones: **Empezar así** (oro, primario), **Ajustar** (abre el bloque en el editor real — la primera lección de que todo es editable), **Regenerar** (una vez, con feedback de qué cambiar). Esto ES el producto: libertad de Notion + generación de ChatGPT, en 40 segundos.

**2:20 – 2:30 — Aterrizaje en Hoy.** Sin PlannerTour modal. Hoy muestra: saludo con nombre, la sesión de hoy (o la próxima), FirstWorkoutCTA en oro. Los conceptos Bloques/Plan/Progreso se enseñan con coach marks contextuales la primera vez que el usuario pisa cada tab — no con un manual por adelantado.

**2:30+ — El primer dato es el gancho.** Al tocar "Empezar ahora", la primera sesión arranca con Kai presente en el primer set ("Registra tu primer set — a partir de aquí, todo cuenta"). Al completar el primer set: haptic de éxito + primer punto de datos en Progreso. El usuario ha pasado de cero a *sistema con datos propios* en menos de 3 minutos.

**Ruta auth (cuando se active):** Welcome pasa el modo correcto a Auth; signup pide solo email+contraseña; TODO el perfil se recoge en el mismo flujo de 5 páginas (ProfileSetupScreen desaparece como pantalla previa: sus campos extra — edad/peso/lesiones — se piden después, en contexto, cuando Kai los necesite). Una sola interrogación, siempre.

---

## Directivas

Para los dos desarrolladores: **DEV-L** (lógica) y **DEV-U** (UI/UX). Prioridad P0 = bloquea la tesis; P1 = multiplica activación; P2 = pulido con retorno.

### P0

1. **[DEV-L] Sembrar la semana al generar el espacio.** Extender `generateOnboardingSpace`/`applyStarterSpace` para que, tras crear los bloques, los asigne a días concretos de la semana según `frequency` (lu/mi/vi para 3, etc.) usando el modelo de scheduling existente (`ScheduledWorkout` del PRD §9). Exponer el resultado (bloques + asignaciones) en el retorno para que el Reveal lo pinte.
   *Validación:* tras un onboarding fresco, la pantalla Plan muestra ≥ `frequency` sesiones asignadas en los próximos 7 días y Hoy resuelve "sesión de hoy o próxima" sin estado vacío. Test unitario por cada frecuencia (2/3/4/5).

2. **[DEV-U] Construir el Reveal.** Pantalla post-generación (entre el overlay "Kai está montando…" y el Dashboard) que muestra los bloques creados con sus ejercicios y la mini-semana, con acciones Empezar así / Ajustar / Regenerar. Cascada con springs de `tokens.ts`, oro solo en el CTA primario.
   *Validación:* en instalación limpia, el usuario ve nombre de bloque + lista de ejercicios + días asignados ANTES de pisar el Dashboard; "Ajustar" abre el BlockEditor real y vuelve al Reveal; tiempo desde "Comenzar" hasta Reveal ≤ 12s incluso en fallback (medido en iPhone 12 Pro).

3. **[DEV-L] Unificar el onboarding en un solo flujo y una sola fuente de verdad.** Retirar `OnboardingChatScreen`, `SetupScreen` y el paso previo `ProfileSetupScreen` (sus campos únicos migran a Perfil/contexto); reemplazar el gate `userName.trim().length > 0` de AppNavigator por un flag explícito `onboardingCompletedAt` local (sincronizado con el de Supabase cuando hay sesión).
   *Validación:* con `SKIP_AUTH` true Y false, una instalación limpia hace exactamente UNA pasada de preguntas y llega al Dashboard con espacio poblado; `grep` no encuentra referencias vivas a las pantallas retiradas; el flujo completo sobrevive a kill de la app en cada página (estado persiste o reinicia limpio, nunca corrupto).

### P1

4. **[DEV-U] Matar el PlannerTour modal en el primer arranque.** Sustituirlo por coach marks contextuales (primera visita a cada tab) o dispararlo solo a partir de la segunda sesión de la app.
   *Validación:* en instalación limpia, cero modales entre el Reveal y FirstWorkoutCTA; `tourCompletedAt` se conserva para usuarios existentes.

5. **[DEV-U] Narración de la construcción.** El overlay de generación muestra los pasos del agente ("Creando Día A…", "Programando tu semana…") con la misma narrativa en el camino IA y en el fallback de plantilla.
   *Validación:* en ambos caminos (forzar fallback desconectando red) el usuario ve ≥ 3 pasos narrados; ningún estado de espera muda > 2s.

6. **[DEV-L] Instrumentar el funnel de activación.** Eventos locales (persistidos, exportables): `onboarding_started`, `onboarding_step_completed(n)`, `space_generated(source: ai|template, duration_ms)`, `reveal_action(start|adjust|regenerate)`, `first_workout_started`, `first_workout_completed`.
   *Validación:* tras un run e2e manual, los 6 eventos aparecen con timestamps coherentes; el PRD §15 (métricas de activación) es medible sin backend.

7. **[DEV-L] Honestidad en Auth (antes de activar SKIP_AUTH=false).** Welcome pasa `mode` como param a Auth; ocultar Google/Apple y "olvidaste tu contraseña" hasta que existan (o implementarlos).
   *Validación:* "Crear cuenta" aterriza en modo signup con copy correcto; ningún botón visible termina en `console.log`.

8. **[DEV-L] Pedir duración de sesión y usar el nombre.** Añadir duración típica (30/45/60/90) a la página nivel+frecuencia; pasar `userName` y duración al prompt de Kai y a las plantillas (recorte de volumen para 30min).
   *Validación:* el bloque generado para 30min tiene ≤ 4 ejercicios; el saludo de páginas 3+ usa el nombre; tests de plantilla actualizados.

### P2

9. **[DEV-L] Rama de importación en el onboarding.** En la página de disciplina, opción "Ya tengo mis rutinas" → reutilizar el pipeline CSV Strong/Hevy (Fase 4) o pegado de texto para construir el espacio desde datos reales del usuario.
   *Validación:* un CSV de Strong pegado durante onboarding produce un espacio con esos ejercicios y el historial importado visible en Progreso.

10. **[DEV-U] Preview viva del espacio durante las preguntas.** El fondo del onboarding materializa siluetas de bloques que reaccionan a cada respuesta (disciplina, frecuencia, equipo).
    *Validación:* cada respuesta produce un cambio visible < 300ms; 60fps en iPhone 12 Pro; `useReducedMotion` respetado.

11. **[DEV-U] Iconografía de equipamiento propia.** Hoy 4 de 10 chips comparten el icono `barbell`. Ampliar `KIcon` con glifos distinguibles.
    *Validación:* 10 chips, 10 glifos únicos, mismo stroke y estilo del set actual.

12. **[DEV-U] Primer set acompañado.** Micro-guía de Kai dentro del primer ActiveWorkout (un solo mensaje contextual al primer set, celebración al completarlo).
    *Validación:* aparece solo cuando `workoutHistory` está vacío; nunca más de 1 mensaje; haptic de éxito al primer set.

---

_Los P0 convierten la mejor arquitectura ya escrita (generación con fallback garantizado) en el momento de producto que la tesis necesita: el sistema naciendo delante del usuario. Nada de esto requiere backend nuevo ni rediseño del modelo de datos._
