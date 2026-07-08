# Onboarding "El Manuscrito" — la primera página de tu Libro

_2026-07-05 · worktree cowork-security · pedido de Álvaro: un onboarding mucho más
original, técnicamente creativo y complejo — dentro de la identidad._

## El concepto (por qué esto y no otro formulario bonito)

Kairos ya tiene su metáfora central escrita: **el Historial es un manuscrito, el
producto es tu Libro** (VUELTA_DE_ROSCA §Giro B, §5). Ningún onboarding del
mercado la tiene. Así que el onboarding deja de ser "responder preguntas" y pasa
a ser **escribir la primera página de tu Libro, con Kai de editor**:

- Kai (El Glifo como pluma) **escribe frases con huecos** en Fraunces, registro
  de libro: _"Este libro es de ____." · "Ahora mismo busco ____." · "Puedo darle
  ____ días a la semana."_
- **Tú rellenas los huecos inline** — nunca un modal, nunca una card-grid:
  - palabra elegida de una fila de palabras sueltas en itálica oro (objetivo,
    experiencia),
  - numeral Fraunces que se **arrastra** como un instrumento (días/semana), con
    detentes hápticos y alternativa de tap (accesibilidad),
  - palabras-material que se componen solas en prosa serial: _"mancuernas,
    bandas y esterilla"_ (equipo),
  - una línea libre en tus palabras (el prompt a Kai), opcional.
- Cada hueco tiene **salida sin fricción** (universalidad): saltas y Kai
  reescribe la frase con dignidad (_"Este libro es mío."_), nunca un campo vacío.
- **"Que Kai lo rellene"** visible desde el principio = skip-to-value ≤30s
  (ONBOARDING_BEST_IN_CLASS §2.3): defaults inteligentes, la página se escribe
  sola rápido, y entras.
- Al acabar, Kai firma — _"El resto se escribe entrenando. — Kai"_ — y **la
  página se pliega**: las frases pasan a tinta fantasma y de ellas sube tu
  primer bloque (la presentación actual). El building-spinner desaparece: el
  trabajo de Kai se ve como notas al margen sobre la propia página.

Progreso = la propia página componiéndose + una **regla de margen** de oro que
crece con cada frase compuesta. Sin barra de pasos: un manuscrito no tiene
stepper.

## Reglas que respeta

- Identidad: Fraunces + itálica oro para la palabra elegida (el gesto tipográfico
  firma de Kairos), oro raro, cero jerga, voz de Kai seca (KAI_VOICE).
- TTFV: el objetivo sigue siendo la única respuesta que importa; todo lo demás
  saltable con default (onboardingFlow.ts intacto — el manuscrito es una capa de
  presentación sobre el mismo OnboardingDraft).
- Motion: springs físicos, transform/opacity, reduce-motion = todo instantáneo.
- Táctil: cada palabra-opción ≥44pt de target; el scrubber tiene taps ‹ › como
  alternativa al gesto; edición re-abrible tocando cualquier frase compuesta.

## Arquitectura

```
src/features/onboarding/manuscript/
├── manuscript.ts        ← puro: specs de frases, serialList, mapeo a OnboardingDraft
├── ManuscriptStep.tsx   ← orquestador (cola de frases, margen, firma, pliegue)
├── InkSentence.tsx      ← una frase: tinta que se escribe + hueco inline
└── blanks/
    ├── ChoiceRow.tsx    ← palabras sueltas (objetivo, experiencia)
    ├── ScrubberBlank.tsx← numeral arrastrable con detentes hápticos
    ├── ChipsRow.tsx     ← material → prosa serial
    └── TextBlank.tsx    ← nombre / línea libre
```

Integración: `PremiumOnboarding` gana el paso `manuscrito`
(auth → **manuscrito** → presentation). Los steps clásicos (meet-kai, goal,
profile, equipment, coach, building) quedan en el árbol como fallback pero fuera
del flujo. El beat de "conocer a Kai" se funde en la página (El Glifo se dibuja
y escribe la primera línea); el de "building", en el pliegue final.

## Validación

Harness `initialStep="manuscrito"` + modo autoplay DEV (rellena huecos con
timers) para fotografiar cada estado en el simulador sin input táctil; typecheck
verde por hito; commit atómico por hito.
