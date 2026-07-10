# BACKLOG v3 — El loop conversacional (voz → bloque adaptado)

Deriva de [08-strategy-voice-first.md](./08-strategy-voice-first.md). **Decisiones de Álvaro (2026-07-10):
voz desde el día uno · la conversación es el héroe (onboarding al mínimo, Manuscrito retirado/fallback).**
Marco: YC Pocket Guide (launch now · 90/10 · one problem well · do things that don't scale).

## El único objetivo del sprint

Álvaro abre la app, pulsa grabar, dice en una frase qué le apetece ("hoy piernas, 40 min, en casa"
o "no sé, algo suave"), Kai conversa lo justo (adaptativo, no un guion) y en <30s hay un bloque
listo para hacer hoy. Sin configurar nada antes.

## Infra existente a REUSAR (no reinventar)

- LLM: Groq `llama-3.3-70b-versatile` vía `src/lib/ai/client.ts` (`chatCompletion`/`streamChatCompletion`,
  tool-use, cuota). Prod = Supabase Edge Function `ai-chat`; dev = Groq directo (EXPO_PUBLIC_GROQ_API_KEY).
- Agente tool-use: `src/lib/ai/agent.ts` + `src/lib/ai/tools/`.
- Generador de bloques: `src/lib/ai/onboardingSpace.ts` (`create_block`/`add_exercise`, fallback garantizado).
- STT: Groq Whisper (`whisper-large-v3`) por el MISMO patrón de cliente (endpoint `/audio/transcriptions`).

## Tareas (vertical slice, aditivas donde se pueda)

- **V1 · Motor conversacional adaptativo.** `src/lib/ai/conversation/` — orquesta un diálogo con Groq
  que: infiere del texto libre, pregunta SOLO lo que falta (no guion fijo), y cuando tiene lo mínimo
  llama al generador de bloques existente. Prompt de sistema que fuerce tono variable según el detalle
  del usuario (1 turno si es claro, 2-3 si va perdido). Streaming. Estado de sesión conversacional.
  ✓ Tests: input claro → 0-1 preguntas → bloque; input vago → guía adaptativa → bloque. Fallback si LLM cae.
- **V2 · Voz.** `expo-audio` (o `expo-av`) para grabar; transcribir con Groq Whisper por el cliente;
  el texto entra al motor V1. Botón grabar como entrada primaria; texto como alternativa.
  ✓ Grabar → transcribir → mismo pipeline. Permisos de micro con priming. Estado de "escuchando/transcribiendo".
- **V3 · Superficie "Hoy" (el héroe).** Pantalla/entrada única "Kai, ¿qué hacemos hoy?": burbujas de
  conversación (streaming), botón de voz prominente, y reveal del bloque generado (reusar el momento
  del reveal v2: spring + haptic). Al confirmar, el bloque queda en el espacio listo para empezar.
  ✓ Es la primera pantalla útil tras el arranque mínimo; de voz-a-bloque sin tocar más que confirmar.
- **V4 · Onboarding al mínimo.** Reducir el primer arranque a lo justo para llegar a la conversación
  (guest-first, nombre opcional). Retirar el Manuscrito del flujo por defecto (conservar archivos como
  fallback, sin borrar). El reveal/teatro v2 y el home honesto se mantienen.
  ✓ Instalación limpia → en ≤2 taps estás hablando con Kai; sin formulario de 6 preguntas.

## Fuera de foco este sprint (YC: one problem well)

Wedge híbrido (DEV-L v2, parado a medio rebase — se retoma como preset invocable por la conversación,
más tarde) · paywall/monetización · import CSV UI · social proof · presets de larga cola.

## Reglas

Gate por commit (tsc + eslint 0 + vitest, base 360 tests). Commits bisectables, sin Co-Authored-By.
Copy en español, tokens siempre, `useReducedMotion`. Deps nuevas vía `npx expo install`. Si el LLM/STT
no está disponible en dev, degradar con mock determinista (nunca romper el flujo).

## Éxito (YC: build something people want)

Si a Álvaro no le da gusto usarlo, se itera el DIÁLOGO (prompts, tono, qué pregunta), no se añaden
features. El listón lo pone el usuario nº1 usándolo de verdad.
