# 08 · Replanteamiento estratégico — El problema único (Directiva, 2026-07-10)

> Marco rector: The Pocket Guide of Essential YC Advice. Sustituye el foco de 07 (que optimizaba
> el onboarding madlib) por **un solo problema bien resuelto**.

## El problema único (YC: "startups solve one problem well")

> **"Me apetece entrenar. Se lo cuento a Kai hablando. Conversa breve conmigo, itera de fondo
> mapeando lo que quiero, y me devuelve un bloque de entrenamiento adaptado."**

Personalizado de verdad, **incluidas las interacciones**: el diálogo no es rígido — varía según
cuánta claridad y detalle da el usuario. Si lo tengo claro, Kai no me interroga; si voy perdido,
me guía. Modalidad ideal: **voz**. El texto conversacional es el 90/10 para lanzar ya.

## La lente YC sobre lo que teníamos

- **One problem well.** El loop voz→conversación→bloque es el producto. Todo lo demás se demota.
- **El Manuscrito madlib es lo contrario de esto.** Es un formulario fijo de 6 preguntas. Deja de
  ser el héroe: pasa a ser, como mucho, un primer arranque mínimo ("launch now"), o desaparece a
  favor de la propia conversación. El activo real del Manuscrito era su VOZ ("—Kai"), no su forma.
- **90/10.** No construimos IA nueva: ya existe el motor. Falta la superficie conversacional.
- **Do things that don't scale.** Diálogo con LLM real + generador existente; sin infra pesada.
- **Growth = producto, no precursor.** Nada de paywall/ASO/funnel hasta que ESTE loop enamore.

## Lo que YA está construido (reutilizar, no reinventar)

| Pieza | Dónde | Sirve para |
|---|---|---|
| Motor agente tool-use | `src/lib/ai/agent.ts`, `tools/` | Conversar + ejecutar acciones |
| Generador de bloques | `src/lib/ai/onboardingSpace.ts` (`create_block`/`add_exercise`, fallback garantizado) | Materializar el bloque |
| Chat | `src/screens/AIChatScreen.tsx`, `src/lib/ai/chat/` | Superficie de conversación |
| Cuota IA | `src/lib/ai/useAiQuota.ts` | Control de coste |
| Coach/insights | `coach.ts`, `insights.ts`, `predictions.ts` | Adaptación con historial |

**~90% del sistema existe.** El 10% que falta: un flujo de intake conversacional que (a) abra con
"¿qué te apetece hoy?", (b) haga una conversación **adaptativa** (Kai pregunta solo lo que falta,
no un guion fijo), (c) llame al generador existente, (d) inserte el bloque y lo deje listo.

## Qué sobrevive del trabajo previo

- **Fixes de activación (iter 2, ya en night-run):** guest-first, home honesto día-0, fuera el tour,
  fix del nombre. Sobreviven a cualquier paradigma de onboarding.
- **Wedge híbrido (DEV-L v2, pendiente de merge):** el preset híbrido se convierte en algo que la
  CONVERSACIÓN puede invocar ("quiero algo tipo HYROX"), no en una rama de formulario.
- **Kai one-tap / paywall honesto / import (DEV-L v2):** se mantienen; el paywall más tarde (YC:
  producto antes que monetización).

## El 90/10 del próximo sprint (propuesta)

1. **Superficie conversacional "Hoy" (el héroe).** Entrada única: "Kai, ¿qué hacemos hoy?" → campo
   de texto libre. Kai responde con diálogo adaptativo (LLM decide qué falta preguntar) y, cuando
   tiene lo mínimo, genera el bloque con el motor existente y lo muestra. No rígido: 1 mensaje si el
   usuario es claro, 2-3 si va perdido.
2. **Diálogo adaptativo real.** Prompt de sistema que instruya a Kai a NO interrogar: inferir del
   texto libre, preguntar solo lo imprescindible, tono variable según detalle del usuario.
3. **Voz (fast-follow, mismo pipeline).** Grabar (`expo-av`/`expo-audio`) → transcribir → mismo
   flujo de texto. Se puede lanzar el loop en texto y añadir voz sin rehacer nada.
4. **Onboarding mínimo.** Reducir el primer arranque a lo justo para llegar a la conversación
   (nombre opcional, guest-first). El Manuscrito se conserva o se retira según decida Álvaro.

## Criterio de éxito (YC: build something people want)

Álvaro (usuario nº1) abre la app sin ganas de configurar nada, dice en una frase qué le apetece, y
en <30s tiene un bloque que haría hoy sin retocar. Si no da ganas de usarlo, se itera el diálogo,
no se añaden features.
