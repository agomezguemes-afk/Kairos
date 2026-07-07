# 04 · UX Research — Onboarding y creación de cuenta

**Autor:** Director de UX Research, Directiva de IA de Kairos
**Fecha:** 2026-07-07
**Alcance:** Welcome → Auth → Onboarding → primer aterrizaje en el Space. Nivel de pulido objetivo: Craft / Notion / Apple-featured.

---

## 1. Auditoría del flujo actual

### 1.1 Mapa de rutas reales (AppNavigator.tsx)

Existen **dos modos** y **tres flujos de onboarding distintos** que se solapan:

```
MODO LOCAL (sin auth):
  Splash → OnboardingScreen (quiz 5 páginas) → Dashboard

MODO AUTH (Supabase):
  Splash → Welcome → Auth (email+password)
        → ProfileSetup (formulario largo)          ← si !isOnboardingComplete
        → OnboardingChatScreen (chat con Kai)      ← misma condición
        → OnboardingScreen (quiz 5 páginas)        ← si !onboarded (userName vacío)
        → Dashboard
```

**Hallazgo crítico #1 — Triple redundancia.** `ProfileSetupScreen`, `OnboardingChatScreen` y `OnboardingScreen` preguntan las mismas cosas (objetivo, nivel, frecuencia, disciplinas) con tres UIs distintas. Un usuario nuevo en modo auth puede responder "¿cuál es tu nivel?" hasta **tres veces**. Esto es un fallo de arquitectura de flujo, no de pantalla.

**Hallazgo crítico #2 — Sign-up antes del valor.** En modo auth, lo primero que Kairos pide es email + contraseña, antes de mostrar nada del producto. El estándar de la industria (Duolingo, Cal AI, Runna) es exactamente el inverso: quiz → valor percibido → cuenta.

**Hallazgo crítico #3 — Bug en Welcome.** Ambos CTAs («Crear cuenta» y «Iniciar sesión») hacen `navigation.navigate('Auth')` sin parámetros, y `AuthScreen` inicializa `mode = 'signin'`. Resultado: pulsar **«Crear cuenta»** aterriza en «Bienvenido de nuevo» (modo sign-in). Archivo: `src/screens/WelcomeScreen.tsx:150-169` + `src/screens/AuthScreen.tsx:30`.

### 1.2 Pantalla a pantalla — estado actual

| Pantalla | Archivo | Qué hace | Problemas |
|---|---|---|---|
| **WelcomeScreen** | `src/screens/WelcomeScreen.tsx` | Logo + wordmark serif + tagline eyebrow, CTA oro, ghost login, pulse idle. Reanimated + haptics + reduce-motion. | La mejor pantalla del flujo. Solo el bug del modo Auth y cero preview del producto (no hay carrusel de valor). |
| **AuthScreen** | `src/screens/AuthScreen.tsx` | Email+password, toggle signin/signup, validación local. | Botones Google/Apple son `console.log` placeholder con iconos incorrectos (`globe`, `smartphone` — deben ser logos oficiales). «¿Olvidaste tu contraseña?» es TODO. Usa RN `Animated` (no Reanimated) y shims deprecados (`Colors.background`, `Typography.size`) en vez de tokens v3. Sin Sign in with Apple, que es requisito de App Store si ofreces login social de terceros. |
| **ProfileSetupScreen** | `src/screens/ProfileSetupScreen.tsx` | Formulario scrollable: nombre, edad, peso, altura, lesiones, objetivo, nivel, frecuencia, lugar. | Formulario denso pre-valor — antipatrón directo según CLAUDE.md («editing feels fluid», evitar formularios pesados). Duplica todo lo que pregunta el quiz. |
| **OnboardingChatScreen** | `src/screens/OnboardingChatScreen.tsx` | Chat con mascota Kai (círculo oro + ojos geométricos), respuestas como chips, paso opcional de datos corporales. | Concepto encantador pero redundante: tercera vez que se pregunta objetivo/nivel/frecuencia. El chat sin streaming ni delay de "typing" real se siente mecánico. |
| **OnboardingScreen** (v2, el canónico) | `src/screens/onboarding/OnboardingScreen.tsx` | Quiz 5 páginas (welcome, nombre, disciplina, nivel+frecuencia, equipamiento) en FlatList horizontal con parallax, dots, backdrop de rejilla oro 0.03, cierre con logo + «Kai está montando tu espacio…» mientras `generateOnboardingSpace()` corre. | Es la base correcta. Fallos: (a) entradas a 600ms (`ENTER_MS`) — CLAUDE.md fija 180-280ms estándar y 480ms máximo; (b) dots sin sensación de avance ni botón atrás visible; (c) selección con relleno oro sólido en superficies grandes — el oro deja de ser «raro y significativo»; (d) heading de la página 1 en oro (texto largo en acento = ruido); (e) loading theatre mínimo: una caption estática, sin pasos, sin reveal del espacio generado; (f) valores hardcodeados (`#FFFFFF`, paddings mágicos) en vez de `Spacing`/`Colors`; (g) no hay recap ni celebración. |
| **PlannerTour** | `src/features/onboarding/PlannerTour.tsx` | Overlay modal de 3 páginas en el primer HomeTab (bloques/programa/progreso) con mocks visuales. | Buen patrón (feature discovery just-in-time). Mantener. |
| **Componentes** | `src/components/onboarding/{KaiMascot,OptionChip,UserBubble}.tsx` | Avatar animado con spring bounce, chips, burbujas. | Solo los usa el flujo chat redundante. KaiMascot es un activo valioso (memoria del proyecto: mascota Kai planificada con estados) — rescatarlo para el loading theatre y el reveal. |

### 1.3 Sistema de diseño disponible (tokens v3)

`src/theme/tokens.ts` ya provee todo lo necesario: `Colors.gold.base #D4AF37` / `deep` / `glow`, serif editorial (`Type.title`, `Type.numHero`), `Type.eyebrow` (uppercase tracked), `Spacing`, `Radius['2xl']` (radio de sheet iOS), `Shadows.cardWarm` (sombra dorada), y springs en `src/theme/animations.ts`. **El problema no es el sistema — es que Auth/ProfileSetup/Chat consumen los shims deprecados y el quiz hardcodea.**

---

## 2. Referencias y patrones (con URLs)

### 2.1 Runna — el benchmark de la categoría running/fitness plan

- Case study: [How to nail onboarding — a case study of Runna (Rosie Hoggmascall, UX Collective)](https://uxdesign.cc/how-to-nail-onboarding-a-case-study-of-runna-7780ba89c202) · [versión Growth Dives](https://www.growthdives.com/p/how-to-nail-onboarding-a-case-study) · [Flow completo en Uiland](https://uiland.design/screens/runna/screens/b7d405f1-038c-4c19-9787-b1cc3f41e2d2/flows/onboarding) · [Showcase screensdesign](https://screensdesign.com/showcase/runna-running-training-plans)
- **~30 pasos / 12 minutos** y no molesta: cada pregunta se percibe como construcción del plan, no como formulario.
- **Social proof intercalado**: fotografía humana real en el carrusel de apertura; avatares de comunidad («230+ corredores entrenando para tu carrera») a mitad de flujo; clúster de prueba social justo antes del paywall.
- **Validación que genera confianza**: si el usuario mete un ritmo objetivo irreal, la app le dice que ese plan «no está hecho para ti» — paradójicamente refuerza el fit.
- **Transparencia de resultado**: muestra el tiempo de carrera estimado con y sin la app («8 minutos más rápido»).
- **Recap antes del compromiso**: resumen de todas las elecciones del usuario antes de la pantalla de suscripción — refuerza el valor personalizado que está a punto de desbloquear.
- **Copy en lenguaje llano**, sin jerga runner.

### 2.2 Duolingo — sign-up diferido (el patrón #1 que Kairos viola)

- [Duolingo Onboarding Teardown: 7 A/B tests detrás de su 8.9% de conversión (Relaunch)](https://relaunch.ai/blog/duolingo-onboarding-teardown-7-b-tests-behind-their-9-conver.html) · [Case study de onboarding (Medium)](https://kittuvaidyakv.medium.com/duolingo-onboarding-product-feature-case-study-804e597a19f9)
- **No pide cuenta hasta que has completado una lección** y quieres guardar tu progreso: «parkea» el sign-up hasta que el usuario ya está invertido. Secuencia soft-wall → hard-wall.
- Convierte al 8.9% donde la media de la industria es 2%: el norte es engagement, no conversión temprana.

### 2.3 Cal AI — loading theatre y personalización percibida

- [Flow completo en Mobbin](https://mobbin.com/explore/flows/579da5dd-453a-4e7c-9c11-d20708a4db82) · [UI breakdown (screensdesign)](https://screensdesign.com/showcase/cal-ai-calorie-tracker) · [Desglose en Figma Community](https://www.figma.com/community/file/1540803063078176882/cal-ais-onboarding-broken-down)
- Quiz largo con **animaciones en cada paso**, demo en vídeo al inicio, prompt de review a mitad de flujo, y una pantalla de **«generando tu plan»** por etapas antes del reveal. La generación del plan es el clímax del flujo, no un spinner.

### 2.4 Headspace / Opal / Whoop — participación, hook emocional y priming

- [Headspace user onboarding — JTBD (growth.design)](https://growth.design/case-studies/headspace-user-onboarding) · [Catálogo de 47 case studies](https://growth.design/case-studies)
- Headspace abre con una **animación de respiración en la que participas** antes de cualquier copy o petición: el usuario usa el producto antes de que el producto le pida nada.
- [Chat-based onboarding (Retention.blog)](https://www.retention.blog/p/chat-based-onboarding) · [Does your onboarding have a hook?](https://www.retention.blog/p/does-your-onboarding-have-a-hook) · [10+ tests for onboarding](https://www.retention.blog/p/10-tests-for-onboarding) — patrón: **ancla emocional → micro-compromiso → prueba de valor → peticiones mayores**. Una pantalla de carga que comunica valor y muestra que estás creando una experiencia personalizada es «net positive si se hace decentemente».
- [WHOOP iOS Onboarding Flow en Mobbin](https://mobbin.com/explore/flows/06390f2f-8598-4b94-88f5-0bcb7b65ece4) — metas personalizadas (sueño/actividad) y datos base para calibrar recomendaciones.

### 2.5 Permission priming

- [Permission Priming (UserOnboard)](https://www.useronboard.com/onboarding-ux-patterns/permission-priming/) · [3 estrategias de priming móvil (Appcues)](https://www.appcues.com/blog/mobile-permission-priming) · [Asking permission to use notifications (Apple HIG/docs)](https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications) · [Cómo mejorar el opt-in de push (Batch)](https://help.batch.com/en/articles/4195576-how-to-improve-the-push-opt-in-rate)
- Pedir notificaciones durante el onboarding frío es un error medible: pedirlas **tras un evento de alto valor** (primer plan generado, primera sesión completada) casi **triplica** el opt-in.
- Pantalla de pre-permiso **full-screen y de marca** > modal parcial. Para HealthKit, la sheet del sistema no es personalizable → la pantalla previa debe explicar qué datos y por qué.
- Si el usuario deniega, explicar qué pierde y cómo reactivarlo — nunca castigar.

### 2.6 Meta-análisis de patrones

- [I studied the UX/UI of over 200 onboarding flows (DesignerUp)](https://designerup.co/blog/i-studied-the-ux-ui-of-over-200-onboarding-flows-heres-everything-i-learned/) — segmentar por tipo de usuario en la primera pregunta (patrón Notion), «just-in-time rule» (información solo cuando se necesita), **opciones de skip siempre visibles** (evitar el «escape room»), selecciones cerradas > campos de texto libre, definir el «first win» de cada segmento antes de monetizar.
- [12 apps with great user onboarding (UXCam)](https://uxcam.com/blog/10-apps-with-great-user-onboarding/) · [10 onboarding UX examples con IA (Userpilot)](https://userpilot.com/blog/onboarding-ux-examples/)

### 2.7 Síntesis: anatomía del onboarding fitness 2025-2026

1. **Hook** (1-2 pantallas): valor emocional + prueba social, cero peticiones.
2. **Quiz de personalización** (5-12 pantallas): una pregunta por pantalla, chips/cards, progreso segmentado visible, skip en lo opcional, micro-momentos de reconocimiento («Perfecto para empezar con base»).
3. **Recap / compromiso**: resumen de elecciones — el espejo del usuario.
4. **Loading theatre** (2.5-4 s): pasos secuenciales con checks («Analizando tu nivel… Seleccionando ejercicios… Montando tu espacio») — ilusión de trabajo = valor percibido.
5. **Reveal / celebración**: el plan personalizado presentado como un momento — haptic success, animación de entrada, preview real del contenido.
6. **Priming de permisos** contextual, después del first win.
7. **Cuenta** (si no existía): pedida como «guarda tu progreso», con Apple/Google primero.

---

## 3. Flujos obligatorios que faltan (o están mal)

| # | Flujo | Estado en Kairos | Estándar de la industria |
|---|---|---|---|
| F1 | **Un solo flujo canónico de onboarding** | Tres flujos solapados (ProfileSetup + Chat + Quiz) que preguntan lo mismo | Un quiz único; cada dato se pregunta exactamente una vez |
| F2 | **Value-first: quiz antes de cuenta** | Auth pide email/contraseña antes de mostrar producto | Duolingo/Cal AI: quiz → plan generado → «crea tu cuenta para guardarlo» |
| F3 | **Loading theatre por etapas** | Caption estática «Kai está montando tu espacio…» + logo | 3-4 pasos secuenciales con checkmarks, 2.5-4 s, labor illusion |
| F4 | **Reveal / celebración del plan** | Navegación seca al Dashboard con `reset` | Pantalla de reveal: preview del espacio generado, haptic success, CTA «Entrar en tu espacio» |
| F5 | **Recap pre-generación** | No existe | Runna: resumen de elecciones antes del compromiso |
| F6 | **Permission priming de notificaciones** | No se piden notificaciones en ningún momento del flujo | Pantalla full-screen de marca tras el first win, nunca en frío |
| F7 | **Priming de HealthKit** | No existe (Sprint 9, pero el hueco en el flujo debe reservarse) | Pantalla previa explicando qué datos y por qué, antes de la sheet del sistema |
| F8 | **Progreso segmentado + atrás** | Dots pasivos, sin back visible | Barra segmentada que avanza (relleno oro), chevron back, swipe |
| F9 | **Social proof** | Cero en todo el flujo | Runna/Opal: 1 pantalla o franja de prueba social (diferible hasta tener usuarios reales — usar «beta» honesto mientras tanto) |
| F10 | **Sign in with Apple / Google reales** | Placeholders `console.log` con iconos incorrectos | Apple Sign In es además requisito de App Store Review 4.8 si hay login de terceros |
| F11 | **Recuperación de contraseña** | TODO | Flujo mínimo con Supabase `resetPasswordForEmail` |

---

## 4. Especificación pantalla a pantalla del flujo ideal

**Orden propuesto (modo auth, el definitivo):**
`Splash → S1 Welcome → S2-S6 Quiz → S7 Recap → S8 Generación → S9 Reveal → S10 Priming notificaciones → S11 Cuenta (soft-wall) → Dashboard + PlannerTour`

El modo local usa el mismo flujo saltándose S11. Regla transversal: **una decisión por pantalla, oro solo en el elemento que importa, 180-280 ms para todo lo estándar, 480 ms máximo para el reveal.**

### S1 · Welcome (existente — retocar)
- **Layout:** mantener. Logo 80 + wordmark `Type.title` (serif 32) + tagline `Type.eyebrow` en `Colors.gold.deep`. CTA oro + ghost.
- **Cambios:** «Crear cuenta» → «Empezar» y navega **directo al quiz** (no a Auth). Ghost «Ya tengo cuenta» → `Auth` con `route.params.mode='signin'`.
- **Oro:** solo CTA + tagline (ya correcto).
- **Motion:** entradas actuales (340 ms) están bien; el idle pulse se mantiene.
- **Haptics:** `impactAsync(Light)` en CTA (ya existe).

### S2 · Quiz — Nombre
- **Layout:** heading `Type.heading` (22/700) en `Colors.ink.primary` — **nunca oro en headings**. Input en card `Colors.bg.surface`, borde `Colors.hair.base` en reposo → `Colors.hair.goldStrong` con foco (el oro señala foco, no decora). Helper `Type.caption` en `Colors.ink.muted`.
- **Progreso:** barra segmentada (5 segmentos, 3 px, `Radius.pill`): completados en `Colors.gold.base`, actual en `gold.glow` animándose, restantes en `Colors.hair.base`. Sustituye a los dots.
- **Motion:** entrada del contenido 240 ms `Easing.out(cubic)` + `springs.gentle` para translateY (bajar de los 600 ms actuales). Avance de barra: `withTiming` 280 ms.
- **Haptics:** ninguno al teclear; `selectionAsync` al avanzar.

### S3 · Quiz — Disciplina
- **Layout:** grid 2×3 actual. Cards sin seleccionar: `bg.surface` + `Shadows.subtle` + borde `hair.base`. **Seleccionada: fondo `Colors.gold.glow` (18%), borde `hair.goldStrong`, icono y label en `ink.primary`, check pequeño en `gold.base`** — NO el relleno oro sólido actual (respeta «gold rare»; el tinte glow ya se usa como lenguaje de selección en el resto de la app).
- **Micro-momento:** al seleccionar, caption contextual 200 ms fade: «Kai preparará tu espacio de fuerza» — personalización percibida inmediata (patrón Runna).
- **Motion:** scale spring `springs.tap` (0.97→1) al pulsar; check con `FadeIn` 180 ms.
- **Haptics:** `impactAsync(Light)` en selección.

### S4 · Quiz — Nivel + frecuencia
- **Layout:** actual (rows + pills), con el mismo tratamiento de selección glow de S3. Hints `Type.caption` `ink.muted`.
- **Validación-confianza (patrón Runna):** si nivel=beginner y frecuencia=5+, mostrar nota `Type.caption` con icono info: «Kai empezará suave y subirá contigo» — reconoce la elección sin bloquear.
- **Haptics:** `impactAsync(Light)` por selección; `selectionAsync` en Siguiente.

### S5 · Quiz — Equipamiento
- **Layout:** actual (chips 2-col + nota libre). Mantener skip implícito («si no marcas nada, asumimos peso corporal») pero añadir **botón «Omitir» textual** arriba a la derecha (`Type.caption`, `ink.muted`) — regla anti-«escape room» de DesignerUp.
- **Motion:** stagger actual (28 ms/chip) pero con duración 240 ms, no 400.

### S6 · Quiz — (hueco reservado) Lesiones / datos corporales — opcional
- Rescatar la única pregunta valiosa de ProfileSetup/Chat que el quiz no cubre: lesiones (texto corto) o edad/peso (chips de rango, no inputs numéricos). **Skippeable con botón visible.** Si alarga el flujo, diferir a P2 y preguntarlo en contexto (primera sesión).

### S7 · Recap — «Tu espacio»
- **Layout (nueva):** eyebrow `Type.eyebrow` oro-deep «TU PLAN» · título `Type.titleSmall` serif «Esto es lo que Kai va a montar» · card resumen con filas icono + valor (`Type.bodyEmph`): disciplina, nivel, frecuencia, equipamiento. Cada fila con `FadeInDown` stagger 60 ms.
- **Editable:** tap en una fila vuelve a su página del quiz (inversión barata, confianza alta).
- **CTA:** «Crear mi espacio» — oro, full-width. Este es un «moment screen»: el oro del CTA es el único oro grande de la pantalla.
- **Haptics:** `impactAsync(Medium)` en CTA.

### S8 · Generación — loading theatre
- **Layout (evolución del closing actual):** `AnimatedLogoPulse` (o KaiMascot animado — rescatar el activo) centrado + **lista de 3-4 pasos** que se completan secuencialmente: «Analizando tu punto de partida» → «Seleccionando ejercicios para [disciplina]» → «Montando tu primer bloque» → «Preparando tu espacio». Cada paso: `Type.body` `ink.muted` → al completarse, check oro `FadeIn` 180 ms + texto a `ink.primary`.
- **Timing:** mínimo percibido 2.6 s aunque `generateOnboardingSpace()` resuelva antes (gate con `Promise.all([generate, delay(2600)])`); si la generación tarda más, el último paso espera. Nunca spinner.
- **Haptics:** `selectionAsync` sutil por check; nada más — la contención es premium.

### S9 · Reveal — el momento oro
- **Layout (nueva):** el único uso legítimo de celebración: fondo `bg.void`, eyebrow «TU ESPACIO ESTÁ LISTO», título serif `Type.title` con el nombre del usuario, y **preview real del espacio generado** (mini-card del primer bloque: nombre, nº ejercicios, disciplina con su color) elevándose con `springs.gentle` + `Shadows.cardWarm` (la sombra dorada existe exactamente para esto).
- **Motion:** entrada del card 480 ms (el máximo permitido, reservado para este layout shift) con scale 0.95→1 + fade; glow radial `gold.glow` detrás del card, 280 ms.
- **Haptics:** `notificationAsync(Success)` al aparecer el card — una sola vez.
- **CTA:** «Entrar en mi espacio» → S10.

### S10 · Priming de notificaciones
- **Layout (nueva, full-screen de marca):** ilustración mínima (KaiMascot), título `Type.heading` «Kai te avisa cuando toca entrenar», 2-3 bullets de valor concretos (`Type.body` + iconos), CTA oro «Activar avisos» → dispara la sheet del sistema; ghost «Ahora no» — sin culpa, mismo peso visual que un secondary.
- **Regla:** solo se muestra aquí (post-first-win). Si deniega, no reintentar hasta un segundo evento de valor (primera sesión completada).
- **Nota HealthKit:** NO en onboarding. Reservar priming contextual para cuando el usuario toque una feature que lo necesite (Sprint 9).

### S11 · Cuenta — soft-wall (patrón Duolingo)
- **Layout:** título «Guarda tu progreso» + subtítulo que nombra lo que ya posee («Tu espacio de fuerza y tu primer bloque te esperan»). Botones: **Apple primero, Google segundo** (logos oficiales, no Feather), email como tercera opción textual. Link «Más tarde» (`Type.caption`, `ink.muted`) si se decide permitir modo local — decisión de producto de Álvaro.
- **AuthScreen refactor:** acepta `mode` por params; migrar a Reanimated y tokens v3 (`Colors.ink/bg/hair/gold`, `Type.*`); implementar reset de contraseña; estados de error con `notificationAsync(Error)` (ya existe) + shake sutil 3×4 px, 180 ms.

### Post-flujo
- **PlannerTour se mantiene** tal cual (just-in-time, primera visita a HomeTab).
- **OnboardingChatScreen y ProfileSetupScreen se retiran** del navigator. KaiMascot/OptionChip/UserBubble se conservan como componentes (S8/S10 y futuro chat del AI Lab).

---

## Directivas

Prioridad: P0 = bloquea la percepción de calidad del primer uso · P1 = siguiente sprint · P2 = backlog dirigido.

### P0

1. **[lógica] Unificar el onboarding en un solo flujo canónico.** Retirar `ProfileSetupScreen` y `OnboardingChatScreen` del `AppNavigator`; el quiz (`src/screens/onboarding/OnboardingScreen.tsx`) pasa a ser la única fuente de perfil, y en modo auth escribe en Supabase lo que hoy escribe ProfileSetup (upsert al finalizar, con reintento silencioso).
   *Validación:* un usuario nuevo (modo local y modo auth) responde cada pregunta exactamente **una** vez de Welcome a Dashboard; `grep ProfileSetupScreen\|OnboardingChatScreen src/navigation` no devuelve rutas activas; el perfil llega a Supabase con nivel/frecuencia/disciplina/equipamiento.

2. **[lógica + uiux] Invertir el orden valor→cuenta (soft-wall).** «Empezar» en Welcome lleva al quiz, no a Auth; la cuenta se pide en S11 tras el reveal, con copy «Guarda tu progreso». `AuthScreen` acepta `route.params.mode` y «Ya tengo cuenta» abre sign-in directamente (arregla el bug actual de Welcome).
   *Validación:* desde instalación limpia se llega al reveal del espacio sin haber tecleado un email; pulsar «Ya tengo cuenta» muestra «Bienvenido de nuevo» y el CTA de crear cuenta muestra «Crea tu cuenta».

3. **[uiux] Loading theatre + reveal (S8+S9).** Sustituir la caption estática por 3-4 pasos secuenciales con checks oro (mínimo percibido 2.6 s, gate sobre `generateOnboardingSpace`), y añadir pantalla de reveal con preview real del primer bloque generado, `Shadows.cardWarm`, entrada 480 ms y `notificationAsync(Success)`.
   *Validación:* vídeo en device (iPhone 12 Pro) mostrando: checks secuenciales sin spinner, haptic al reveal, y que el bloque del preview coincide con el que aparece luego en el Dashboard; si la IA falla, el fallback de plantilla pasa por el mismo teatro sin diferencia visible.

### P1

4. **[uiux] Progreso segmentado + navegación atrás en el quiz.** Barra de 5-6 segmentos con relleno oro animado (280 ms) reemplaza los dots; chevron back arriba-izquierda desde la página 2; botón «Omitir» textual en pasos opcionales.
   *Validación:* screenshot por página mostrando la barra avanzar; back devuelve a la página anterior conservando la respuesta ya elegida.

5. **[uiux] Lenguaje de selección glow, no relleno oro sólido.** En disciplina/nivel/frecuencia/equipamiento: seleccionado = `gold.glow` + borde `hair.goldStrong` + check `gold.base`; texto permanece `ink.primary`. Headings nunca en oro (página 1 del quiz incluida).
   *Validación:* auditoría visual — en cualquier página del quiz, el área total pintada de oro sólido ≤ el CTA; contraste del texto de cards seleccionadas ≥ 4.5:1.

6. **[uiux] Ajustar motion a la norma de CLAUDE.md.** `ENTER_MS` 600→280 ms, `PAGE_FADE_MS` 400→240 ms, stagger de chips a 240 ms; reservar 480 ms solo para el reveal. Respetar `useReducedMotion` en todas las pantallas nuevas (Welcome ya lo hace; el quiz no).
   *Validación:* `grep -n "600\|400" src/screens/onboarding/OnboardingScreen.tsx` no muestra duraciones de animación fuera de rango; con «Reducir movimiento» activado en iOS, el quiz entra sin animaciones.

7. **[lógica] Sign in with Apple + Google reales, y reset de contraseña.** Implementar `expo-apple-authentication` + OAuth de Google vía Supabase; logos oficiales (no `globe`/`smartphone`); `resetPasswordForEmail` detrás de «¿Olvidaste tu contraseña?». Si no entra en el sprint, **retirar los botones placeholder** — un botón que hace `console.log` es peor que su ausencia.
   *Validación:* login completo con Apple en device físico; email de reset recibido; cero `console.log` en handlers de AuthScreen.

8. **[uiux] Priming de notificaciones post-reveal (S10).** Pantalla full-screen de marca con valor concreto y ghost «Ahora no»; la sheet del sistema solo se dispara tras el CTA afirmativo; denegación registrada para no repreguntar hasta el siguiente evento de valor.
   *Validación:* la sheet de iOS nunca aparece sin priming previo; elegir «Ahora no» no vuelve a mostrar la pantalla en el mismo flujo; opt-in dispara la sheet inmediatamente.

### P2

9. **[uiux] Migrar AuthScreen a tokens v3 + Reanimated.** Eliminar shims deprecados (`Colors.background`, `Typography.size`) y RN `Animated`; shake de error 180 ms; foco de inputs con borde `hair.goldStrong`.
   *Validación:* `grep -n "Colors.background\|Colors.text\.\|Typography.size" src/screens/AuthScreen.tsx` vacío; screenshot de estados foco/error.

10. **[uiux] Paso opcional de lesiones/datos corporales (S6) con chips de rango**, skippeable, alimentando al coach IA.
    *Validación:* el paso puede omitirse en un tap; el dato aparece en el perfil si se responde.

11. **[uiux + lógica] Franja de social proof honesta** cuando existan usuarios reales (contador de espacios creados o testimonios beta); mientras tanto, un «Estás en la beta de Kairos» con eyebrow oro es más premium que cifras infladas.
    *Validación:* ninguna cifra mostrada que no provenga de datos reales.

12. **[lógica] Telemetría del funnel.** Evento por página del quiz (vista, respuesta, back, skip, drop) para poder medir dónde se cae la gente antes de iterar más.
    *Validación:* dashboard o log local con el conteo por paso tras una pasada completa.

13. **[uiux] Rescatar KaiMascot como personaje del flujo** (S8 «montando», S9 celebrando) alineado con el plan de mascota Kai (estados idle/happy/excited); retirar sus pantallas huérfanas.
    *Validación:* KaiMascot renderiza en generación/reveal; `OnboardingChatScreen` eliminado sin referencias rotas.
