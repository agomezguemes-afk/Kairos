# 06 · Teardown de diseño — Onboarding Kairos (v1)

> Crítico de la Directiva de IA · 2026-07-08 · rige [PRINCIPLES.md](./PRINCIPLES.md) v2
> Material: 11 capturas reales del flujo en simulador (iPhone 12 Pro, Release).
> **Este documento no aprueba. Puntúa contra el mejor referente conocido de cada pantalla.**

**Nota media global: 5.7 / 10** — funcional y con voz propia (el Manuscrito es diferenciación real),
pero el flujo comete el pecado cardinal de activación (cuenta antes que valor), no entrega el "aha"
que promete, e interrumpe el momento con un tour no solicitado. Ninguna pantalla llega a nivel de
Cal AI / Headspace / Runna sin cambios concretos.

---

## Tabla resumen (pantalla × dimensión × nota /10)

| Pantalla | Jerarquía | Copy/voz | Densidad | Emoción | Fricción | Media | Referente que la bate |
|---|---|---|---|---|---|---|---|
| Welcome (onb-03) | 7 | 6 | 6 | 5 | 8 | **6.4** | Headspace (valor inmediato, no quote page) |
| Login (onb-07) | 7 | 5 | 7 | 4 | **2** | **5.0** | Duolingo/Headspace (signup DESPUÉS del valor) |
| Manuscrito (onb-09→18) | 7 | **8** | 5 | 7 | 5 | **6.4** | Cal AI (progress/goal-gradient) |
| Presentation (onb-19) | 6 | 6 | 6 | **4** | 7 | **5.8** | Cal AI (loading theatre + reveal) |
| Tour Bloques (onb-22) | 6 | 5 | 6 | **3** | **3** | **4.6** | Apple HIG (enseñar en contexto) |
| Home (onb-23) | 7 | 6 | 7 | 5 | 6 | **6.2** | Whoop (scores ganados) / Opal (1 CTA) |

Referentes con URL en cada sección. Media = promedio simple de las 5 dimensiones.

---

## Referentes (nombre · qué hace mejor · URL)

- **Cal AI** — 29–32 pantallas, $0→$30M ARR en 1 año. Demo al abrir, personalización profunda,
  **teatro de carga "construyendo tu plan"** (labor illusion), reveal del plan con números reales
  del usuario, review-prompt a mitad (sunk cost + social proof), paywall *después* del valor.
  https://www.buildwithai.io/value/cal-ai-onboarding-flow
- **Duolingo** — retrasa la creación de cuenta hasta *después* de la primera lección; objetivo y
  "por qué" antes del signup; encuadre de progreso constante.
  https://growth.design/case-studies/duolingo-user-retention
- **Headspace** — valor antes de cuenta; el botón de signup solo convierte tras sentir el producto;
  **Labor Illusion** (retraso cuidado eleva el valor percibido); Reciprocidad antes de pedir.
  https://growth.design/case-studies/headspace-user-onboarding
- **Blinkist** — **Endowment Effect** (guardar = propiedad); secuencia ideal: objetivos → entregar
  valor → capital psicológico → *luego* pedir datos/cuenta. Critica pedir permisos/personalización
  antes de dar nada. https://growth.design/case-studies/blinkist-user-onboarding
- **Runna** — segmenta al corredor, test de ritmo, **reveal de plan personalizado** 5K→maratón,
  social proof (imágenes de comunidad) a lo largo del flujo. (Mobbin · fitness onboarding 2025)
- **Whoop / Opal / Rise / Fitbod** — reveal de score/plan como clímax; Whoop **gana** sus números
  con datos de sensor reales (no inventados en día 0); Opal presenta una única primera acción clara.
- **Apple HIG · Onboarding** — no exijas cuenta antes de mostrar valor; enseña en contexto, no con
  tours upfront; facilita salir del onboarding.
  https://developer.apple.com/design/human-interface-guidelines/onboarding

---

## Teardown detallado

### 1 · Welcome — onb-03 · media 6.4
"Kairos. tu práctica, operada" · "Tu entrenamiento, tu **espacio**." · CTA "Comenzar" · "Kai piensa, tú entrenas".

- **Jerarquía (7).** Display serif grande + oro en una sola palabra: correcto uso del acento. Pero
  hay una **pincelada dorada huérfana** flotando a media pantalla, sin ancla semántica: parece un
  subrayado desprendido. Y un vacío muerto enorme entre subtítulo y botón.
- **Copy (6).** "operada" en español evoca cirugía, no maestría/orquestación. "Kai piensa, tú
  entrenas" sí funciona. Revisar el claim del wordmark.
- **Densidad (6).** El tercio central está vacío; el equilibrio editorial se pierde en aire muerto.
- **Emoción (5).** Es una **página de cita**, no un producto. Headspace entrega valor sensorial en la
  primera pantalla; aquí no hay preview, ni movimiento perceptible, ni promesa de producto visible.
- **Fricción (8).** Un solo CTA, cero coste. Bien.
- **Cambio a 10.** (a) Micro-motion de entrada del título (stagger de líneas 60ms, `withSpring`
  gentle) respetando reduce-motion. (b) Sustituir la pincelada huérfana por una firma coherente
  (misma pincelada que cierra el Manuscrito → hilo narrativo) o eliminarla. (c) Reducir aire central
  ~30% subiendo el bloque de título. (d) Copy: "tu práctica, orquestada".

### 2 · Login — onb-07 · media 5.0 · **EL FALLO ESTRUCTURAL**
"CREA TU CUENTA / Tu progreso, en cualquier **sitio**." · Apple / Google / correo · Términos.

- **Fricción (2).** Pecado cardinal: **se pide cuenta en la pantalla 2, antes de cualquier valor** —
  antes del Manuscrito (personalización) y antes del plan. Los tres teardowns coinciden
  (Duolingo, Headspace, Blinkist): valor → capital psicológico → *después* signup. Aquí es un muro
  frío sin nada invertido detrás. No hay ruta "continuar sin cuenta".
- **Copy (5).** "Tu **progreso**, en cualquier sitio" / "guardar tu espacio y sincronizar" prometen
  proteger algo que **aún no existe**. El beneficio es vacío en este punto del flujo.
- **Emoción (4).** Interrumpe en frío. **Cero social proof**: ni rating de App Store, ni nº de
  usuarios, ni testimonio. Cal AI ancla su signup junto a rating y reviews; Runna baña el flujo en
  prueba social. Aquí, nada que reduzca el riesgo percibido de entregar identidad.
- **Jerarquía (7).** Apple oscuro como primario, resto outline: correcto y HIG-friendly.
- **Cambio a 10.** (a) **Mover esta pantalla a después del reveal del plan** (pos. ≥8). (b) Guest-first:
  el flujo entero funciona sin cuenta; el signup aparece como "guarda lo que Kai acaba de crearte".
  (c) Añadir social proof real cuando exista (rating + "N personas ya operan su práctica").

### 3 · El Manuscrito — onb-09 / 10 / 13 / 16 / 17 / 18 · media 6.4 · **LA JOYA, A MEDIO PULIR**
Madlib editorial: "TU LIBRO · PÁGINA PRIMERA / Soy Kai. Este libro es tuyo; yo solo lo cuido." →
nombre → objetivo → experiencia → días → equipo → nota libre → firma "— Kai".

- **Copy/voz (8).** Lo mejor de la app. "Este libro es tuyo; yo solo lo cuido" es un gancho de
  **Endowment Effect** de manual (Blinkist). Los escapes ("me lo callo", "aún no lo sé", "poca cosa",
  "nada que añadir") son encantadores y bajan fricción. La firma "El resto se escribe entrenando. —Kai"
  cierra con carácter. Nada en el mercado suena así.
- **¿Aguanta la metáfora 6 preguntas? A medias (Densidad 5).** El texto **se acumula** (onb-13/16 ya
  son 6 líneas) y empuja la pregunta activa + input hacia abajo, con las opciones **bajo el pliegue**.
  El usuario re-lee el párrafo entero en cada paso: carga cognitiva creciente. El punto de fatiga es
  el paso de **equipo** (9 chips) y el paso **nota libre**.
- **Jerarquía texto-rellenado vs opciones (7).** La respuesta elegida (oro serif itálica) y las
  opciones seleccionables (oro serif subrayada) son **casi idénticas** → afordancia débil entre "lo
  que ya elegí" y "lo que puedo elegir". Además "un gimnasio" reemplazó todo el equipo: parece
  **single-select** cuando el equipo es intrínsecamente multi-select.
- **Fricción (5).** Escribir el nombre a mano abre teclado en el paso 1 (premium onboarding evita
  free-text temprano). **Sin barra de progreso**: "PÁGINA PRIMERA" insinúa más páginas pero no hay
  goal-gradient — el usuario no sabe cuánto queda. Cal AI y Duolingo siempre muestran progreso.
- **Cambio a 10.** (a) **Fijar la pregunta activa arriba** y colapsar las respuestas anteriores en un
  resumen compacto scrolleable (no empujar el input). (b) **Indicador "página X de 6"** (goal-gradient).
  (c) Diferenciar tipografía: elegido = oro **sólido**, opción = **outline**. (d) Multi-select real en
  equipo con chips que sumen. (e) Nombre: prefill desde Apple sign-in o hacerlo opcional para evitar
  teclado. (f) Transición entre pasos: crossfade + slide 220ms respetando `useReducedMotion()`.

### 4 · Presentation — onb-19 · media 5.8 · **EL AHA QUE NO CELEBRA**
"TODO LISTO / A, Kai ya creó tu **primer bloque**" · card "Fuerza · Bienvenida" (Press banca 4×8,
Sentadilla 4×10, Peso muerto 3×6, Dominadas 3×8) · CTA "Entrar a Kairos".

- **Emoción (4).** Aquí debería estar el pico. Falla en tres frentes:
  1. **Sin teatro de carga.** El plan simplemente aparece. Cal AI / Rise / Fitbod muestran un
     "construyendo tu plan…" animado (Labor Illusion) que hace sentir que la IA *trabajó*. Sin
     esfuerzo visible, el valor percibido de "Kai lo creó" se desploma.
  2. **Card estática.** Sin entrada, sin reveal, sin shared-element. El momento no se celebra: ni
     spring, ni haptic. Un clímax no puede ser un render frío.
  3. **El plan no refleja lo que el usuario respondió.** Dijo "**3 días** a la semana", "un gimnasio",
     objetivo "fuerza" → y el reveal muestra **UN** bloque genérico. **¿Dónde está la semana sembrada?**
     El usuario respondió días-por-semana y recibe un solo día. El vínculo personalización→salida está
     roto: la promesa "Kai piensa" nunca se hace visible.
- **Copy (6).** "A, Kai ya creó tu primer bloque" bien; "Fuerza · **Bienvenida**" como nombre de
  bloque suena a plantilla, no a algo mío.
- **Cambio a 10.** (a) **Loading theatre 1.8–2.4s** con copy que **cite las respuestas**: "Con 3 días
  y un gimnasio, te monto la fuerza…" (b) **Sembrar la semana visible**: los 3 días declarados, no un
  bloque. (c) Card **entra con `withSpring` responsive + haptic Success** al aparecer. (d) Callback
  explícito: "basado en lo que me contaste". Validación: el plan contiene exactamente los N días
  declarados.

### 5 · Tour Bloques — onb-22 · media 4.6 · **INTERRUMPE EL CLÍMAX**
Tras "Entrar a Kairos": tour de 3 páginas (dots · "Saltar") con card genérica "Empuje superior 45 min".

- **Fricción (3) / Emoción (3).** El usuario acaba de pulsar "Entrar a **tu** espacio" y en vez de su
  bloque recibe un **tour no solicitado**. Anti-patrón exacto: enseñar features antes de que exista la
  necesidad. Apple HIG: enseñar en contexto, no upfront.
- **Inconsistencia.** La card del tour ("Empuje superior") **no es** el bloque que se acaba de crear
  ("Fuerza · Bienvenida"). Contenido genérico que **rompe otra vez** el hilo de personalización.
- **Artefacto.** Banner "Open debugger to view warnings" visible (dev). Que no llegue a Release.
- **Cambio a 10.** (a) **Eliminar el tour de pantalla completa.** (b) Sustituir por **un** coach-mark
  contextual anclado al **bloque real** ("Fuerza · Día A"), dismissable, solo la primera vez.
  (c) La primera pantalla tras entrar debe ser **el espacio del usuario con su bloque**, no chrome.

### 6 · Home — onb-23 · media 6.2 · **SÓLIDO, CON TRAMPAS DE CONFIANZA**
"ESTA SEMANA · 0 Tu primera semana" · "Buenos días, **A**" · card "TU PRIMER ENTRENAMIENTO / Fuerza ·
Día A / Empezar ahora" (oro) · "TU ESTADO HOY" rings 90/70/100 · calendario Julio.

- **Copy (6).** "Buenos días, **A**" — el saludo truncado a la inicial parece un bug de placeholder.
  Consistente con el input "A", pero como saludo lee roto. Con nombre completo se resuelve.
- **Emoción (5).** Rings **fabricados en día 0**: Energía 90 / Fuerza 70 / Recuperación 100 **sin
  ningún dato**. Métricas inventadas en el primer arranque **socavan la credibilidad** del sistema.
  Whoop se gana sus scores con sensores reales; aquí son números de la nada. El propio texto
  ("Tu sistema empieza con tu primer entrenamiento") delata que no hay datos — entonces ¿por qué
  mostrar 90/70/100? Además tres rings de color (oro/azul/verde) rompen "oro ≤ 1 vez por pantalla".
- **Fricción (6).** **Doble CTA en conflicto**: la card superior dice "Programa un bloque" y la card
  oro dice "Empezar ahora". Dos primeras-acciones que compiten (programar vs empezar). El oro
  "Empezar ahora" es claramente el primario correcto; el mensaje superior lo contradice.
- **Jerarquía (7) / Densidad (7).** La pantalla más resuelta funcionalmente; buen uso del oro en el
  CTA principal.
- **Cambio a 10.** (a) En día 0 **sin datos, sin números inventados**: estado "por calibrar" hasta la
  1ª sesión. (b) **Una sola acción primaria** (mantener "Empezar ahora" oro; el mensaje superior deja
  de ordenar "programar"). (c) **Nombre completo** en el saludo. (d) Rings a un solo acento hasta que
  haya datos reales.

---

## Los 5 gaps más graves (rankeados por impacto en activación)

1. **Muro de cuenta antes del valor (onb-07).** Signup en pantalla 2, sin nada invertido, sin guest
   mode, sin social proof. Mata la activación en el punto de mayor fragilidad.
   *Referente:* Headspace + Duolingo — valor → capital psicológico → *después* cuenta.
2. **El "aha" no se entrega (onb-19).** Sin teatro de carga (labor illusion), card estática sin
   celebración, y **la semana sembrada no aparece**: el plan no refleja los días/equipo/objetivo que
   el usuario acaba de dar. La promesa "Kai piensa" nunca se hace visible.
   *Referente:* Cal AI (construyendo tu plan + reveal con tus números) + Headspace (Labor Illusion).
3. **Tour no solicitado que interrumpe el clímax (onb-22).** 3 páginas de chrome genérico justo
   cuando el usuario debería tocar su bloque; además contenido inconsistente con lo creado.
   *Referente:* Apple HIG Onboarding (enseñar en contexto) + Blinkist (progressive disclosure).
4. **Fatiga del Manuscrito (onb-13/16).** Acumulación que empuja el input bajo el pliegue, **sin
   goal-gradient**, y afordancia débil entre respuesta elegida y opción. La joya se enfría en el paso 5–6.
   *Referente:* Cal AI (progress bars) + Goal-Gradient (Blinkist).
5. **Señales de confianza fabricadas en Home día-0 (onb-23).** Rings 90/70/100 sin datos + doble CTA +
   saludo truncado "Buenos días, A". Erosiona la credibilidad justo al entrar.
   *Referente:* Whoop (scores ganados con datos reales) + Opal (una sola primera acción).

---

## Directivas (para devs · con criterio de validación medible)

### P0 — bloquean activación, esta iteración

- **P0-1 · Valor antes que cuenta.** Mover el login a **después del reveal del plan** y añadir ruta
  guest-first (el flujo completo funciona sin cuenta).
  *Validar:* la pantalla de signup aparece en posición ≥ 8 del flujo; existe "continuar sin cuenta";
  el % de usuarios que alcanza el Home sube respecto al baseline actual.
- **P0-2 · El reveal se convierte en momento.** Teatro de carga 1.8–2.4s con copy que **cite las
  respuestas** del Manuscrito; después la card entra con `withSpring` responsive + haptic Success; y
  **se siembra la semana declarada** (N días, no un bloque).
  *Validar:* el plan mostrado contiene exactamente los N días que el usuario declaró; existe animación
  de entrada (no estática); dispara haptic en el reveal; el copy referencia ≥1 respuesta del usuario.
- **P0-3 · Fuera el tour de 3 páginas.** Sustituir por **un** coach-mark contextual anclado al bloque
  real creado, dismissable, primera-vez-solo. Retirar banner de debug de Release.
  *Validar:* 0 pantallas de tour full-screen; el coach-mark referencia "Fuerza · Día A" real (no
  "Empuje superior" genérico); sin overlays de debug en build Release.

### P1 — calidad percibida, siguiente iteración

- **P1-1 · Manuscrito sin fatiga.** Fijar la pregunta activa arriba (colapsar respuestas previas),
  indicador "página X de 6" (goal-gradient), tipografía diferenciada elegido(sólido)/opción(outline),
  multi-select real en equipo.
  *Validar:* progress indicator presente en cada paso; el input activo siempre visible sin scroll; el
  paso equipo admite ≥2 selecciones.
- **P1-2 · Home honesto en día 0.** Sin números inventados hasta la 1ª sesión (estado "por calibrar");
  una sola acción primaria oro; saludo con nombre completo.
  *Validar:* con 0 sesiones no se renderiza ningún score numérico fabricado; existe exactamente 1 CTA
  primario oro por encima del pliegue; el saludo usa el nombre completo capturado.
- **P1-3 · Social proof en signup.** Añadir rating de App Store / nº de usuarios / testimonio junto a
  los botones de cuenta (cuando el dato exista).
  *Validar:* la pantalla de cuenta incluye ≥1 elemento de prueba social real.

### P2 — pulido

- **P2-1 · Welcome.** Resolver la pincelada dorada huérfana (convertir en firma coherente con el
  cierre del Manuscrito o eliminar); micro-motion de entrada del título; revisar "operada".
- **P2-2 · Nombre sin teclado.** Prefill desde Apple sign-in o hacerlo opcional para evitar abrir
  teclado en el paso 1.
- **P2-3 · Tokens de motion del Manuscrito.** Transición entre pasos (crossfade + slide 220ms) con
  fallback `useReducedMotion()`.

---

*Cierre del crítico:* la voz de Kairos (el Manuscrito, el Endowment Effect, la firma "—Kai") es un
activo real y raro en el mercado. El problema no es el carácter: es la **arquitectura de activación**
alrededor de él. Se pide la cuenta antes de merecerla, no se entrega el "aha" que se promete, y se
interrumpe el único momento que importa. Corregidos P0-1/2/3, este flujo pasa de "bonito pero pierde
usuarios" a competir con Cal AI y Headspace. Sin ellos, la nota no sube de 6.
