# AUTOPILOT — Encuesta UI/UX del resto de la app — 2026-07-23 (feat/night-run)

Álvaro pidió seguir ("continue") tras confirmarse dos veces que Home/Blocks
(AUTOPILOT_HOMEUX) y el Modo Sesión in-training (NIGHT_RUN/DAY_RUN) agotaron su
trabajo JS/TS-only seguro. En vez de inventar relleno en esas dos áreas ya
exhaustivamente auditadas, se abre un frente NUEVO: el resto de la app que su
petición original de "uiux" cubría en amplitud (Progreso, Perfil, onboarding,
IA Lab) y que aún no se ha auditado esta ronda.

## Equipo (mismo patrón que los frentes anteriores)

Scrum Master (esta sesión) + PM/Strategist (general-purpose, opus) + Developer
(kairos-uiux-designer, opus — fable excluido de todo el equipo) + QA real vía
`/code-review`.

## Reglas (heredadas, sin excepciones)

- **SIN commits, SIN push, SIN git add.** Revisión manual de Álvaro siempre.
- **SIN nativo.** Ningún rebuild sin autorización explícita adicional de Álvaro.
- **SIN tocar CanvasGrid/Lienzo.** STORY-06c sigue PARKED en
  `docs/AUTOPILOT_HOMEUX_2026-07-21.md` — no se retoma aquí.
- **NO tocar el Metro del usuario** (proceso 29107, puerto 8081) — sigue vivo,
  verificado a las 10:5x del 23 jul.
- Schedule-before-burn: cron de respaldo (hora en punto :23) + wakeup dinámico
  antes de todo trabajo pesado.
- No inventar relleno: si el PM no encuentra un problema real y verificable en
  el código, debe decirlo explícitamente en vez de fabricar una historia.

## ⏸️ PAUSADO — corrección directa de Álvaro tiene prioridad

Auditoría S1 completa (ver log): encontró 6 defectos reales en ProfileTab,
STORY-01.md lista. **Pero Álvaro dio feedback directo y más urgente** sobre
Home/animaciones — ver `docs/AUTOPILOT_HOMEUX_2026-07-21.md` sección "🚨
CORRECCIÓN DIRECTA". Ningún developer se había lanzado aún para STORY-01 de
este frente, así que no hay nada a medias que romper. Retomar ProfileTab
cuando la corrección de Home + sistema de botones esté encarrilada.

## Estado

- **Fase**: CICLO S1 — PM/Strategist auditando el resto de la app.

## Log de ciclos

| # | Hora | Fase | Resultado |
|---|------|------|-----------|
| S1 | 23 jul, 10:5x | Scrum Master: ledger + cron + PM lanzado | en curso |
