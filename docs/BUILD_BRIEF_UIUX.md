# BRIEF — Elevar la UI/UX de Kairos (journey-driven, dentro de la línea visual)

_Para una sesión de Claude Code en el worktree `cowork-security`. LOCAL. 2026-07-03._

## 0. Misión y filosofía del cambio (leer dos veces)

Vas a **elevar la experiencia** que define a Kairos recorriendo el **consumer journey** y el
**uso diario** de la app, paso a paso. No rediseñas de cero ni construyes el motor de IA.

Cuatro principios que gobiernan CADA cambio:
1. **Dentro de la línea visual ya establecida.** La identidad (Fraunces, oro raro, El Glifo,
   editorial, cálido) NO se reinventa — se aplica y se profundiza. Reestructuras *dentro* de
   ella.
2. **Reestructurar hacia MEJOR, nunca cambios random.** Cada cambio: (a) tiene una razón
   defendible, (b) mejora algo concreto (jerarquía, flujo, profundidad, interacción), (c) se
   verifica con **before/after** antes de seguir. **Prohibido el big-bang que se carga la
   estructura visual.** Diagnostica antes de tocar; entiende por qué está como está; mejora,
   no reemplaces por capricho.
3. **Poco a poco, siguiendo el consumer journey.** Un paso del journey a la vez, atómico,
   verificado, y luego el siguiente. Si dudas si un cambio es mejor, mócklo y compara
   (`/design-shotgun`) — no commitees a ciegas.
4. **Para y enseña.** Tras cada etapa del journey (o cada cambio significativo), muestra
   before/after a Álvaro antes de avanzar. Nada de maratón sin mostrar.

## 1. Lee primero (en `docs/`)
`KAIROS_LA_SESION_VIVA.md` (el corazón), `KAIROS_VUELTA_DE_ROSCA.md` (categoría + registro),
`KAIROS_NUCLEO_DETERMINISTA.md` §0.5 (**cero jerga en UI**), `KAIROS_EL_AGENTE.md` §1 (dial),
`KAI_VOICE.md` (voz), y abre `mockups/kairos-mockups.html` (norte visual). + el `CLAUDE.md`
del proyecto.

## 2. Reglas de identidad — NO negociables
- Fondo cálido/blanco; **oro RARO y con sentido** (#D4AF37, tokens en `src/theme/tokens.ts`).
- **Fraunces** (titulares, numerales héroe, palabra-acento en itálica) + **Plus Jakarta Sans**
  (cuerpo). Cargadas por `FontGate`.
- **El Glifo** — un solo trazo de oro vivo (NO cara, NO ojo). Vive en `KaiFace.tsx`. Nuevas
  emociones = nuevas poses, no anatomía. No cambiar su forma sin OK de Álvaro.
- **Nada de sombras "PowerPoint":** sombra de contacto tight (radio ~5, offset ~3, opacidad
  baja), NUNCA halo/glow flotante. Presión = *sink* físico.
- **Movimiento vivo, no "hecho por IA":** springs físicos, sin cascadas de reveal escalonadas.
- **CERO jerga técnica en la UI** (ni ACWR, 1RM, RPE, mesociclo). Lenguaje humano universal.
- **Voz de Kai:** callada, seca, sin emojis, sin exclamaciones de relleno, sin hype. Una línea
  si cabe en una línea.
- **Universalidad:** sirve igual al estructurado y al esporádico; nunca "no tienes un plan".
- **Profundidad inversamente visible:** un vistazo arriba, el "por qué" a un toque.

## 3. El consumer journey a recorrer (EN ORDEN — pule cada etapa antes de la siguiente)
1. **Bienvenida / primera impresión.** El primer frame vende la identidad en 3 segundos.
   Composición que llena el frame (no flota arriba).
2. **Onboarding** (auth → el "por qué"/cómo quieres sentirte → perfil → equipo → conocer a Kai
   → Kai construye tu primer bloque → la primera Lectura). Ya es un flujo "novela": pule ritmo,
   respiración entre pasos, que no sepa a formulario. Cada paso una arrivada cohesiva.
3. **El Espacio / Home** *(uso diario — clave).* Entrada calmada, cross-domain, El Glifo bajo.
   El loop diario empieza aquí: abrir → vistazo → ¿algo que decir? → salir. El vacío es la
   promesa cumplida, no una pantalla sin terminar.
4. **La sesión activa — el bucle vivo** *(manejo + interacción de campos — clave).* Entrar a
   entrenar; el **descanso vivo** (objetivo vivo, El Glifo como aguja, micro-lectura);
   confirmar una serie de **un toque**; ghost → objetivo vivo. Aquí está el grueso del *manejo*
   y la *interacción de campos*.
5. **La Lectura** *(capas de profundidad — clave).* Post-sesión: titular = una frase de
   entendimiento + el foco (una sola cosa); los stats **plegados** debajo (el "por qué" a un
   toque).
6. **Construir / editar bloques** *(interacción de campos — clave).* El canvas: cómo se crean,
   editan **inline (no modales)**, y reordenan (gestos) los campos dinámicos. Edición fluida,
   háptica, presión física.
7. **El Historial / el Libro.** El activo que compone, en registro editorial (no dashboard).
8. **El dial de autonomía / ajustes de Kai** (`KAIROS_EL_AGENTE.md` §1). El control, sin
   fricción; El Glifo refleja el nivel.

## 4. Focos transversales (lo que hay que pulir y embellecer en TODAS las etapas)
- **Capas de profundidad** — progressive disclosure: lo esencial de un vistazo, el detalle a un
  toque. Nunca un muro de datos.
- **Manejo / interacción** — gestos naturales (swipe, drag), edición inline sobre modales,
  presión física (scale + sink), hápticas con criterio (confirmar, no spamear).
- **Interacción de campos** — los dynamic fields: crear, editar, reordenar, el ghost/objetivo
  vivo. Que se sienta como un instrumento de maker, no una hoja de cálculo.
- **Uso diario** — el loop recurrente (abrir → vistazo → una cosa o nada → entrenar → Lectura →
  salir) tiene que ser rápido, calmado y adictivo-en-sesión (sin ser una chapa).

## 5. Método de trabajo (el motor "a mejor, verificado, paso a paso")
- **Bucle principal por etapa: `/design-review`** — audita la pantalla viva, arregla issues
  uno a uno, **commit atómico por arreglo**, re-verifica con before/after screenshots. Es
  literalmente "cambios a mejor, verificados, no random".
- **Direcciones nuevas o dudas:** `/design-shotgun` (variantes a comparar) + `/plan-design-review`
  (crítica antes de implementar).
- **Fundamenta con referencias reales (permitido y recomendado):** `/browse` o `/connect-chrome`
  para estudiar frontales best-in-class de salud/entrenamiento y productividad (Senso, Notis+,
  Gentler Streak, Whoop, Oura, Athlytic, Superhuman, Linear). Destila patrones (jerarquía, aire,
  motion, dato-héroe) — **NO copiar; traducir a nuestra identidad.**
- **Verifica en el simulador:** iPhone 16e + `npx expo start` + Fast Refresh +
  `xcrun simctl io booted screenshot`. Usa el patrón de *preview harness* (montar una pantalla
  vía prop tipo `initialStep`) para verificar pantallas concretas sin navegación completa.

## 6. Contexto técnico (construye sobre lo que existe, no lo tires)
- RN/Expo. `react-native-reanimated/plugin` debe seguir siendo el ÚLTIMO en `babel.config.js`.
- Superficie que se evoluciona: `RestTimer.tsx` (→ descanso vivo), `WorkoutSummary.tsx`
  (→ La Lectura), `FieldInput.tsx`/`SetRow.tsx` (ghost → objetivo vivo, interacción de campos),
  `KaiFace.tsx` (El Glifo/estados), la superficie de onboarding en `features/onboarding/premium/`.
- **Datos mock realistas** (sesión sembrada; sin LLM, sin núcleo real — eso va aparte).

## 7. Envelope
- Trabaja SOLO en el worktree **`cowork-security`**. **NO toques el worktree `app`** (el
  night-run corre ahí; colisionan ficheros + índice git).
- Local-only (sin push/deploy). Commits atómicos y bisectables. `typecheck` verde.
- **Boil the lake:** completa cada pantalla (estados vacío/carga, reduce-motion, accesibilidad),
  no el 90%.

## 8. Criterio de "mejor" (para que "a mejor" no sea subjetivo)
Un cambio solo entra si es defendiblemente: más claro de un vistazo, o menos fricción, o
jerarquía más fuerte, o la identidad MÁS presente (no menos), o interacción más física/fluida,
o profundidad mejor escalonada — y siempre: cero jerga, universal, dentro de la línea visual.
Si no cumple al menos uno de estos con una razón clara, no se hace.

**Empieza por la etapa 1 del journey. Un paso, verificado, y me lo enseñas antes de seguir.**
