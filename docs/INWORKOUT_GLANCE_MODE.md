# In-Workout v2 — «Modo Sesión» como marcador, no como app (2026-07-14)

> Directiva de Álvaro: el proceso in-workout no convence. Rebrandearlo por su FUNCIÓN:
> el usuario NO quiere usar el móvil mientras entrena. Debe ser simple, de consulta rápida,
> con todo lo relevante visible, y nada intrusivo.

## El replanteamiento funcional

La pantalla actual es un FORMULARIO (numpad, campos, metadata) — asume que el móvil es el
centro de la sesión. La verdad del gimnasio: el móvil está en el suelo/banco y se mira de
reojo 10-30 veces por sesión, se toca lo mínimo. La función real es **marcador (scoreboard)
+ botón de "hecho"**, no editor de datos.

**Rebrand: la sesión activa es un marcador glanceable.** El nombre interno del modo:
"Modo Sesión" (scoreboard). La edición fina existe pero está UNA capa por debajo, nunca
delante.

## Principios (en orden)

1. **Legible a 2 metros.** Lo que toca hacer AHORA en tipo gigante: ejercicio, set N/M,
   objetivo (peso×reps o distancia/ritmo, pre-cargado por la memoria M4). Un vistazo, cero
   scroll, cero ambigüedad.
2. **Una acción = un pulgar.** El 90% de las interacciones es "set hecho". Un botón enorme
   (media pantalla inferior), imposible de fallar con manos temblando post-serie. Los valores
   ya vienen sugeridos por la progresión — confirmar es aceptar la sugerencia.
3. **Corregir es secundario pero inmediato.** Tap en el valor → stepper/numpad como capa
   (bottom sheet), no como estado permanente. El confirm-or-correct de M3 vive aquí.
4. **El descanso es el estado principal.** Entre sets, la pantalla ES el countdown (número
   gigante, anillo), + "siguiente: X". Auto-avance al terminar el descanso. Haptic/sonido al
   acabar — el usuario no mira hasta que vibra.
5. **No intrusivo = el móvil bloqueado sigue informando.** La Live Activity existente
   (targets/WorkoutActivity) pasa a ser superficie de primera clase: set actual, descanso
   restante, siguiente ejercicio en lock screen / Dynamic Island. El teléfono boca arriba en
   el suelo YA es el marcador.
6. **La voz es el futuro de la corrección** (M3): push-to-talk "60 kilos, 8, me costó" —
   pero el diseño v2 no la espera: funciona 100% táctil hoy y la voz se enchufa como atajo.
7. **PRs y celebración: momentos, no muebles.** El badge PR aparece al confirmar y se va.
   La celebración completa vive al FINAL de la sesión, no entre sets.

## Qué se va de la vista principal

- El numpad permanente (→ bottom sheet bajo demanda).
- Metadata visible (RPE/notas/kind → dentro de la capa de corrección, un tap más).
- La lista completa de ejercicios (→ un peek "siguiente: X"; la lista completa tras un tap).
- Cualquier navegación que no sea: hecho / corregir / saltar / salir.

## Estados del marcador

| Estado | Dominante | Secundario | Acción |
|---|---|---|---|
| Set activo | Ejercicio + objetivo (peso×reps) gigante | set N/M, timer sesión | HECHO (botón enorme) |
| Descanso | Countdown gigante + anillo | siguiente set/ejercicio | saltar descanso / +30s |
| Cambio de ejercicio | Nombre nuevo + objetivo | progreso del bloque (nodos) | empezar / ver lista |
| Fin | Resumen + celebración + PRs | — | guardar y cerrar |

## Implicaciones técnicas (para el agente implementador)

- `completeSet` ya acepta values — confirmar-con-sugerencia = enviar los values pre-cargados
  por applyProgression sin edición. Cero cambios de store para el happy path.
- Rest timer ya existe en el store (`ActiveWorkoutRestTimer`, skipRest, extendRest).
- Live Activity sync ya existe (`useLiveActivitySync`) — extender payload si hace falta
  (siguiente ejercicio), no reconstruir.
- La capa de corrección reutiliza el numpad existente (ya des-fantasmado en Ola 2) como sheet.
- PR badge + announcements de M4-UI se conservan tal cual (aparecen sobre el marcador).
- A11y: el marcador es el caso perfecto de Dynamic Type gigante + VoiceOver por estados;
  reduce-motion en el anillo del countdown.

## Métrica de éxito (criterio Álvaro)

En una sesión real: ≤2 toques por set en el 90% de los sets (hecho + quizá un ajuste),
ningún vistazo >3 segundos, y el usuario nunca siente que "está usando una app".
