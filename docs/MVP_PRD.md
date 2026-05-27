# Kairos MVP PRD

## 1. Tesis Del Producto

Kairos no debe posicionarse como una app fitness genérica ni como "otra app de fitness con IA".

La tesis del MVP es:

> Kairos ayuda a personas que entrenan por su cuenta a convertir rutinas dispersas en un plan diario claro, ejecutar la sesión y saber cuál es el siguiente paso.

La identidad actual ya apunta en esa dirección: fondo blanco cálido, oro como acento de marca, tarjetas limpias, animaciones suaves, haptics y Kai como una presencia calmada. El MVP no debe romper esa calidad visual. Debe reorganizarla alrededor de un flujo más simple y más útil.

El producto ganador no es "más pantallas". Es:

> Abro Kairos, sé qué entrenar hoy, completo la sesión, veo progreso y recibo una recomendación útil para seguir.

## 2. Decisión Estratégica

Kairos debe competir como:

> Un sistema personal de entrenamiento organizado en bloques inteligentes.

No debe intentar ganar desde el inicio contra:

- Hevy / Strong en velocidad pura de logging.
- Fitbod / Freeletics en coaching automático completo.
- Strava / Runna en comunidad, running y ecosistema.
- Apple Fitness / Health en sensores y distribución.
- ChatGPT en conversación libre.

La oportunidad está entre todas ellas:

- ChatGPT genera rutinas, pero no las ejecuta ni las mantiene en el tiempo.
- Hevy registra entrenamientos, pero no organiza un sistema semanal adaptativo.
- Fitbod adapta, pero da menos control al usuario que quiere construir su propio método.
- Strava registra y socializa, pero no estructura fuerza/movilidad/bloques híbridos.

Kairos puede ganar si se convierte en el lugar donde el usuario diseña, planifica, ejecuta y ajusta su entrenamiento.

## 3. Cliente Inicial

### Usuario Principal

Persona de 20-40 años que entrena 2-5 veces por semana, por su cuenta.

Comportamiento actual:

- Usa Notas, screenshots, PDFs, vídeos, Excel, WhatsApp, Notion, ChatGPT o memoria.
- Tiene rutinas, pero no un sistema.
- Mezcla fuerza, running, movilidad, calistenia o deporte.
- Quiere progresar, pero no quiere una app rígida.
- No necesita educación absoluta desde cero.
- No quiere pagar todavía un entrenador personal.

Dolores reales:

- "No sé exactamente qué toca hoy."
- "Tengo las rutinas dispersas."
- "Empiezo planes y luego pierdo el hilo."
- "No sé si estoy progresando."
- "Las apps son demasiado rígidas o demasiado manuales."
- "ChatGPT me crea rutinas, pero no me acompaña ni me organiza la semana."

### Usuarios No Prioritarios Para El MVP

No deben definir el producto inicial:

- Principiantes absolutos que necesitan educación técnica y seguridad.
- Atletas avanzados con periodización compleja.
- Usuarios que buscan comunidad/social como motivación principal.
- Usuarios que exigen Apple Watch, Strava o Garmin desde el día uno.
- Usuarios centrados en nutrición.

## 4. Promesa Del MVP

Promesa corta:

> Tu entrenamiento, organizado en bloques inteligentes.

Promesa extendida:

> Crea o genera bloques de entrenamiento, asígnalos a tu semana, abre Kairos para saber qué toca hoy, completa la sesión y deja que Kai te proponga el siguiente ajuste.

Regla interna:

> Cada función del MVP debe ayudar al usuario a saber qué hacer, hacerlo, entender qué pasó o volver mañana.

Si una función no cumple una de esas cuatro cosas, queda fuera del MVP o se esconde como experimental.

## 5. North Star Del MVP

El MVP debe validar este loop:

1. El usuario completa onboarding.
2. Kairos crea o ayuda a crear bloques iniciales.
3. El usuario asigna al menos un bloque a un día.
4. El usuario abre Hoy y ve una acción clara.
5. El usuario empieza y completa un entrenamiento.
6. Kairos registra la sesión y actualiza progreso.
7. Kai entrega una recomendación breve y útil.
8. El usuario vuelve en 2-7 días.

Señal de éxito:

> "Antes tenía mis entrenamientos desperdigados. Ahora Kairos me dice qué toca y me ayuda a seguir progresando."

Señal de fracaso:

> "La app está bonita y tiene IA, pero no sé para qué abrirla cada semana."

## 6. Lo Que Ya Tiene Valor En La App Actual

### Preservar

- Sistema visual premium en `src/theme/tokens.ts`.
- Fondo blanco cálido y superficies limpias.
- Oro como acento principal.
- Bloques como objeto central de entrenamiento.
- Colores e iconos por disciplina.
- Haptics y animaciones suaves.
- Kai como asistente calmado.
- Editor de bloques.
- Creación de bloques.
- Pantalla de entrenamiento activo.
- Resumen de entrenamiento.
- PRs, streaks, misiones e insignias como motivación secundaria.

### Reenfocar

- `HomeTab` debe convertirse en **Hoy**, no en dashboard genérico.
- `AILabTab` debe salir de la navegación principal; Kai debe aparecer de forma contextual.
- `AchievementsTab` debe integrarse en **Progreso**.
- `Canvas` debe quedar como experimental, no como parte del MVP.
- El árbol de progreso puede vivir dentro de Progreso, pero no debe definir el loop principal.

## 7. Arquitectura De Producto

Tabs recomendadas para MVP:

1. **Hoy**
2. **Plan**
3. **Bloques**
4. **Progreso**
5. **Perfil**

Si hay que reducir alcance, Progreso puede vivir temporalmente dentro de Hoy o Perfil. Pero la arquitectura deseada para producto es la anterior.

### Hoy

Propósito:

- Centro diario de ejecución.
- La pantalla que responde: "¿qué hago ahora?"

Contenido:

- Saludo y fecha.
- Entrenamiento programado para hoy.
- Señal breve de Kai.
- CTA principal: empezar entrenamiento.
- Acciones rápidas: adaptar, mover, saltar, elegir otro bloque.
- Estado de racha/misión como contexto secundario.
- Empty states útiles si no hay plan.

### Plan

Propósito:

- Convertir bloques en calendario semanal.

Contenido:

- Vista semanal.
- Bloques asignados a días.
- Añadir bloque a un día.
- Repetición semanal.
- Mover sesión.
- Saltar sesión.
- "Kai, planifica mi semana" como acción opcional.

### Bloques

Propósito:

- Biblioteca y espacio de diseño.

Contenido:

- Grid actual de bloques.
- Crear bloque.
- Editar bloque.
- Acciones IA sobre bloque.
- Empezar bloque sin programar.
- Asignar bloque al Plan.

### Progreso

Propósito:

- Convertir el esfuerzo en evidencia visible.

Contenido:

- Historial.
- PR cards.
- Racha.
- Misión semanal.
- Indicadores simples de volumen/completitud.
- Insights de Kai.

### Perfil

Propósito:

- Configuración del sistema personal.

Contenido:

- Objetivo.
- Nivel.
- Días disponibles.
- Disciplinas preferidas.
- Lugar/equipo.
- Tema.
- Integraciones futuras.
- Cuenta/auth.

## 8. Flujos De Usuario MVP

### Flujo 1: Primer Uso

Objetivo:

El usuario debe llegar a Hoy con un plan útil sin tener que construir todo manualmente.

Pasos:

1. Splash.
2. Onboarding pide solo lo necesario:
   - Nombre.
   - Objetivo.
   - Días por semana.
   - Disciplinas preferidas.
   - Lugar/equipo.
   - Duración típica de sesión.
   - Nivel.
3. Kairos genera 2-3 bloques iniciales.
4. Kairos propone una semana.
5. Usuario acepta o edita.
6. Usuario aterriza en Hoy.

Criterios:

- Onboarding completado en menos de 3 minutos.
- El usuario no necesita crear un bloque desde cero para ver valor.
- Hoy tiene una acción real después del onboarding.

### Flujo 2: Apertura Diaria

Objetivo:

El usuario abre Kairos y entiende qué debe hacer.

Pasos:

1. Abre la app.
2. Hoy muestra entrenamiento programado.
3. Kai explica en una frase:
   - por qué toca eso;
   - foco de la sesión;
   - si conviene ajustar.
4. Usuario empieza, adapta, mueve o salta.

Criterios:

- La acción principal se ve sin scroll.
- Si no hay entrenamiento programado, Hoy ofrece:
   - planificar semana;
   - elegir bloque;
   - preguntar a Kai.

### Flujo 3: Planificar Semana

Objetivo:

Asignar bloques a días concretos.

Pasos:

1. Usuario abre Plan.
2. Ve la semana actual.
3. Toca un día.
4. Selecciona un bloque.
5. Decide si es:
   - una vez;
   - semanal;
   - varios días específicos.
6. El bloque aparece en Plan y en Hoy cuando corresponda.

Criterios:

- Programar un bloque requiere menos de 4 taps desde Plan.
- La recurrencia semanal existe en el MVP.
- Cada sesión programada se puede mover, saltar o borrar.

### Flujo 4: Ejecutar Entrenamiento

Objetivo:

Completar una sesión y actualizar todo el sistema.

Pasos:

1. Usuario pulsa Empezar desde Hoy o Bloques.
2. `ActiveWorkoutScreen` arranca.
3. Usuario completa sets.
4. Descanso aparece cuando toca.
5. Entrenamiento termina.
6. Aparece resumen.
7. Se actualiza historial, racha, PRs, misión y estado del calendario.
8. Kai propone siguiente acción.

Criterios:

- Completar entrenamiento actualiza `workoutHistory`.
- Si venía de Plan, la sesión pasa a `completed`.
- Los sets completados desde ActiveWorkout disparan gamificación/PR/misiones.
- El usuario ve un resultado concreto al terminar.

### Flujo 5: Adaptación Con Kai

Objetivo:

Kai ajusta el plan sin obligar al usuario a mantener una conversación larga.

Intenciones MVP:

- "Tengo 25 minutos."
- "Estoy cansado."
- "No tengo gimnasio."
- "Hazlo más fácil."
- "Hazlo más duro."
- "Enfócalo a fuerza."
- "Muévelo a mañana."

Comportamiento:

- Kai responde breve.
- Propone una acción aplicable.
- Usuario puede aplicar, editar o descartar.

Criterios:

- Kai no devuelve solo texto cuando puede devolver acción.
- Las sugerencias usan bloques, calendario e historial.
- Evitar afirmaciones médicas o predicciones exageradas.

## 9. Alcance Funcional

### Must Have

#### Pantalla Hoy

Elementos:

- Fecha y saludo.
- Card del entrenamiento de hoy.
- CTA principal.
- Card de señal de Kai.
- Estado vacío si no hay entrenamiento.
- Acciones rápidas:
  - adaptar;
  - mover;
  - saltar;
  - elegir bloque.

Notas visuales:

- Mantener fondo cálido.
- Usar tarjetas blancas.
- CTA en oro.
- No usar hero marketing.
- Diseño compacto y repetible.

#### Pantalla Plan

Elementos:

- Vista de 7 días.
- Entrenamientos por día.
- Añadir entrenamiento.
- Asignar bloque.
- Recurrencia semanal.
- Mover / saltar / borrar.

Notas visuales:

- Debe sentirse como planner de entrenamiento, no como Google Calendar completo.
- Cards compactas.
- Color de disciplina como tira, punto o icono.
- Semana escaneable en menos de 5 segundos.

#### Modelo ScheduledWorkout

Crear dominio nuevo de calendario.

Tipo sugerido:

```ts
export type ScheduledWorkoutStatus =
  | 'planned'
  | 'completed'
  | 'skipped'
  | 'moved';

export type RecurrenceRule =
  | { type: 'none' }
  | { type: 'weekly'; daysOfWeek: number[] }
  | { type: 'every_x_days'; intervalDays: number };

export interface ScheduledWorkout {
  id: string;
  blockId: string;
  date: string; // YYYY-MM-DD local
  status: ScheduledWorkoutStatus;
  recurrence: RecurrenceRule;
  createdAt: string;
  updatedAt: string;
  completedWorkoutHistoryId?: string;
  skippedAt?: string;
  movedFromDate?: string;
  kaiNote?: string;
}
```

Recomendación:

- Implementar `none` y `weekly` primero.
- Dejar `every_x_days` tipado, pero sin UI inicial si complica.

#### Store De Planificación

Crear `scheduleStore` con persistencia.

Acciones sugeridas:

```ts
addScheduledWorkout(input)
updateScheduledWorkout(id, updates)
deleteScheduledWorkout(id)
moveScheduledWorkout(id, newDate)
skipScheduledWorkout(id)
completeScheduledWorkout(id, workoutHistoryId)
getWorkoutsForDate(date)
getWorkoutsForWeek(anchorDate)
materializeRecurringWorkouts(range)
```

Requisitos:

- Persistir con Zustand + AsyncStorage.
- Versionar store desde el inicio.
- Mantener cálculo de recurrencias determinista.

#### Integración Con ActiveWorkout

Cambios:

- `ActiveWorkoutScreen` acepta `scheduledWorkoutId?: string`.
- Hoy pasa `blockId` y `scheduledWorkoutId`.
- `finishWorkout` marca scheduled workout como completado.
- Completar sets dispara PR/gamificación/misiones.

#### Kai Signals

Antes de predicción compleja, crear un sistema simple de señales.

Tipo sugerido:

```ts
export type KaiSignalType =
  | 'next_action'
  | 'progression'
  | 'recovery'
  | 'consistency'
  | 'schedule'
  | 'warning'
  | 'celebration';

export interface KaiSignal {
  id: string;
  type: KaiSignalType;
  title: string;
  message: string;
  priority: 1 | 2 | 3;
  createdAt: string;
  relatedBlockId?: string;
  relatedScheduledWorkoutId?: string;
  action?: {
    label: string;
    kind:
      | 'start_workout'
      | 'adapt_workout'
      | 'schedule_block'
      | 'reschedule'
      | 'view_progress';
    payload?: Record<string, unknown>;
  };
}
```

Reglas MVP:

- Si hoy hay entrenamiento: explicar foco.
- Si hay bloques pero no plan: sugerir planificar.
- Si completó todas las series dos veces: sugerir pequeña progresión.
- Si perdió una sesión: sugerir reprogramar sin culpa.
- Si entrenó fuerte la misma disciplina ayer: sugerir recuperación/adaptación.
- Si no hay bloques: generar bloques iniciales.

Importante:

- Primero reglas deterministas.
- Después LLM para redacción.
- Hoy debe funcionar sin red.

#### Recomendación Post-Workout

Después del resumen:

- Mostrar una recomendación.
- Una sola acción principal.
- Ejemplos:
  - "Repite este bloque la semana que viene."
  - "Prueba +2.5 kg la próxima vez."
  - "Programa movilidad mañana."
  - "Has completado lo planeado. Siguiente: ..."

### Should Have

- "Kai, planifica mi semana".
- "Adaptar entrenamiento de hoy".
- Notificaciones locales.
- Eventos básicos de analytics.
- Progreso con historial y PRs.
- Onboarding con disponibilidad/equipo.

### Could Have

- Drag & drop en Plan.
- Vista mensual.
- Apple Health.
- Strava.
- Apple Watch.
- Árbol de progreso integrado.
- Lógica de periodización más avanzada.

### Fuera Del MVP

- Social/comunidad.
- Nutrición.
- App completa de Apple Watch.
- Sincronización completa con Strava.
- ML predictivo complejo.
- Marketplace de plantillas.
- Compartir público.
- Portal para entrenadores.
- Reglas avanzadas de calendario.
- Canvas como flujo principal.

## 10. Cambios De Navegación

Tabs actuales:

- `HomeTab`
- `WorkoutTab`
- `AchievementsTab`
- `AILabTab`
- `ProfileTab`

Tabs MVP recomendadas:

- `TodayTab`
- `PlanTab`
- `BlocksTab`
- `ProgressTab`
- `ProfileTab`

Estrategia:

1. Refactorizar `HomeTab` hacia concepto Hoy.
2. Añadir `PlanTab`.
3. Mantener `BlocksScreen` como Bloques.
4. Reemplazar `AchievementsTab` por Progreso o apuntarlo a Progreso.
5. Sacar AI Lab de tab principal; mantener `AIChat` accesible desde cards contextuales.

Rutas nuevas o modificadas:

```ts
PlanDetail?: { scheduledWorkoutId: string }
ScheduleBlock: { date?: string; blockId?: string }
ActiveWorkout: { blockId: string; scheduledWorkoutId?: string }
```

## 11. Decisiones De Datos

### Bloques Como Objeto De Diseño

Los bloques siguen siendo:

- Plantilla reutilizable.
- Lugar donde se diseñan ejercicios y sets.
- Objeto que Kai crea y edita.

`ScheduledWorkout` debe referenciar `blockId`, no duplicar el bloque entero.

### ActiveWorkout Como Snapshot

El comportamiento actual de copiar ejercicios al empezar entrenamiento es correcto.

Motivo:

- Si el usuario edita el bloque luego, no corrompe la sesión activa.
- La sesión debe reflejar lo que se ejecutó.

### WorkoutHistory Como Fuente De Verdad

Las sesiones completadas deben vivir en `workoutHistory`.

Mejoras necesarias:

- Añadir `scheduledWorkoutId?: string`.
- Añadir `source: 'scheduled' | 'unscheduled'`.
- Guardar suficiente detalle de ejercicios/sets para futuros insights.

### Progreso Derivado De Historial

Evitar sistemas paralelos que se contradigan.

Problema actual:

- `TrainingContext.dayEntries` vive en memoria.
- `workoutStore.workoutHistory` persiste.
- Gamificación persiste aparte.
- `MissionBridge` lee una clave legacy.

Objetivo MVP:

- Historial completado como centro.
- Streak, PRs, misiones y Kai Signals derivados de historial/bloques cuando sea posible.

## 12. Plan Técnico

### Fase 0: Estabilizar Núcleo Actual

Objetivo:

Hacer fiable el entrenamiento antes de añadir calendario.

Tareas:

- Convertir `SKIP_AUTH` en configuración/env, no hardcode.
- Persistir o eliminar `TrainingContext.dayEntries` como fuente de verdad.
- Decidir si `TrainingContext` sigue o se reemplaza por selectores derivados.
- Arreglar `MissionBridge` para usar `useWorkoutStore` en vez de `kairos_blocks_v1`.
- Conectar `ActiveWorkoutScreen` con gamificación, PRs, misiones y árbol.
- Ampliar `finishWorkout` para registrar datos útiles para Kai Signals.

Criterios:

- Completar entrenamiento desde ActiveWorkout actualiza historial, streak, PRs y misiones.
- Reiniciar la app no pierde historial.
- Misiones leen bloques actuales.

### Fase 1: Base De Planificación

Objetivo:

Añadir modelo y store de calendario.

Tareas:

- Crear `src/types/schedule.ts`.
- Crear `src/store/scheduleStore.ts`.
- Helpers de fecha:
  - `YYYY-MM-DD` local;
  - inicio/fin de semana;
  - materialización de recurrencias.
- CRUD de schedule.
- Selectores para Hoy y semana actual.

Criterios:

- Se puede programar un bloque para una fecha.
- La programación persiste.
- La recurrencia semanal aparece en la semana actual.

### Fase 2: Hoy

Objetivo:

Convertir la pantalla principal en superficie diaria.

Tareas:

- Refactorizar `HomeTab`.
- Reemplazar "bloque sugerido por reciente" por entrenamiento de hoy.
- Estados:
  - sin bloques;
  - bloques sin plan;
  - día de descanso;
  - entrenamiento completado.
- Card de Kai Signal.
- Empezar workout con `scheduledWorkoutId`.

Criterios:

- Usuario puede empezar desde la primera pantalla.
- Si no hay plan, Hoy guía al usuario.
- Hoy no depende de red ni LLM.

### Fase 3: Plan

Objetivo:

Permitir asignar bloques a días.

Tareas:

- Crear `PlanTab`.
- Semana horizontal/lista.
- Detalle de día.
- Flujo "Asignar bloque".
- UI de recurrencia semanal.
- Mover/saltar/borrar.

Criterios:

- Programar bloque para hoy u otro día.
- Crear recurrencia semanal.
- Mover o saltar sesión.

### Fase 4: Kai Signals Y Post-Workout

Objetivo:

Convertir Kai en capa útil, no solo chat.

Tareas:

- Crear `src/types/kai.ts`.
- Crear `src/services/kaiSignalService.ts`.
- Generar señales desde:
  - schedule;
  - bloques;
  - historial;
  - streak;
  - PRs.
- Mostrar señal en Hoy.
- Mostrar recomendación en resumen.

Criterios:

- Siempre hay al menos una señal útil en estados clave.
- El resumen post-workout tiene siguiente paso.
- Las señales son breves y accionables.

### Fase 5: Instrumentación Beta

Eventos:

- `onboarding_completed`
- `starter_blocks_generated`
- `block_created`
- `scheduled_workout_created`
- `scheduled_workout_started`
- `workout_started`
- `set_completed`
- `workout_finished`
- `kai_signal_viewed`
- `kai_action_applied`
- `scheduled_workout_skipped`
- `scheduled_workout_rescheduled`
- `return_d2`
- `return_d7`

Al principio pueden ser logs locales. Lo importante es diseñar el producto para medir comportamiento real.

## 13. Guía UX Y Visual

Kairos debe seguir sintiéndose:

- Calmado.
- Premium.
- Focalizado.
- Cálido, no infantil.
- Útil de un vistazo.
- Ligero por defecto, con modo oscuro en entrenamiento si se mantiene.

### Hoy

Usar como base el estilo actual de Home:

- Fondo cálido.
- Cards blancas.
- CTA oro.
- Labels compactas.
- Sombras suaves.
- Kai como presencia sutil.

Evitar:

- Hero gigante.
- Texto de marketing.
- Demasiadas insignias arriba.
- Gamificación ruidosa.
- Párrafos largos de IA.

### Plan

Debe parecer un planner de entrenamiento.

Layout recomendado:

- Selector horizontal de semana.
- Días como pills compactas.
- Día seleccionado con sesiones debajo.
- Cards con tira/color de disciplina.
- Recurrencia con icono discreto.

### Voz De Kai

Kai debe hablar como compañero de entrenamiento competente:

- Específico.
- Breve.
- Calmado.
- Accionable.
- Sin culpa.
- Sin claims médicos.
- Sin exceso de motivación.

Buen ejemplo:

> "Hoy toca torso. La semana pasada completaste todas las series; prueba subir 2.5 kg solo si la primera serie se siente sólida."

Mal ejemplo:

> "Hoy vas a destruir tus límites. Tu cuerpo necesita hipertrofia máxima para optimizar tu rendimiento."

### Gamificación

Debe apoyar hábito, no dominar.

Usar:

- Racha.
- Misión.
- PR.
- Celebración pequeña.

Evitar:

- Demasiados badges.
- Confetti excesivo.
- Árbol como obligación central.

## 14. Estrategia IA

Principio:

> La IA no es el producto. La IA reduce fricción dentro del producto.

Priorizar IA accionable:

- Generar bloques iniciales.
- Planificar semana.
- Adaptar entrenamiento por tiempo/equipo/energía.
- Sugerir progresión.
- Explicar cambios.
- Recomendar siguiente sesión.

Baja prioridad:

- Chat libre de fitness.
- Motivación larga.
- Programación autónoma compleja.

### Reglas Primero, LLM Después

El MVP debe funcionar con reglas deterministas:

- Son fiables.
- Funcionan offline.
- Son testeables.
- Reducen coste.

LLM para:

- Redacción natural.
- Generación de plantillas.
- Parsear intención del usuario.
- Explicar adaptaciones.

Producción:

- No enviar una API key real como `EXPO_PUBLIC_*` en cliente móvil.
- Antes de beta pública, usar backend/proxy con límites.

## 15. Métricas De Éxito

### Activación

- Onboarding completado.
- Plan inicial aceptado.
- Primer bloque creado.
- Primer workout programado.
- Primer workout empezado.
- Primer workout completado.

### Retención

- Retorno D2.
- Retorno D7.
- Workouts programados completados en 7 días.
- Aperturas de Hoy.

### Engagement

- Bloques creados.
- Bloques programados.
- Acciones de Kai aplicadas.
- Workouts adaptados.
- Workouts reprogramados en vez de abandonados.

### Cualitativo

Preguntar a beta users:

- ¿Qué sustituyó Kairos?
- ¿Sabías qué hacer hoy?
- ¿Kai fue útil o decorativo?
- ¿Qué ignoraste?
- ¿Qué confundió?
- ¿Te molestaría no poder usar Kairos la semana que viene?

## 16. Criterios Para Llamarlo MVP

No llamar MVP hasta que:

- Un usuario nuevo llegue a Hoy con un plan.
- Un usuario pueda programar un bloque.
- Un usuario pueda completar una sesión programada.
- La sesión pase a completada en calendario.
- El entrenamiento aparezca en historial.
- Streak/PR/misión se actualicen desde ActiveWorkout.
- Kai entregue siguiente paso útil.
- Datos sobrevivan reinicio.
- No haya tabs principales que parezcan placeholders.

## 17. Instrucciones Para Agentes Especializados

Usar agentes solo después de aceptar este PRD. Cada agente debe tener un área acotada y no tocar archivos fuera de su responsabilidad.

### Agente 1: Datos Y Calendario

Ownership:

- `src/types/schedule.ts`
- `src/store/scheduleStore.ts`
- helpers de fecha
- tests si existen

Tarea:

- Implementar modelo, persistencia, CRUD, selectores semanales y recurrencia.

No tocar:

- UI visual salvo wiring mínimo.
- Editor de bloques.

### Agente 2: Today UX

Ownership:

- Refactor de Home/Today.
- Cards de Today.
- Empty states.
- Start workout wiring.

Tarea:

- Convertir Home en Hoy respetando la identidad visual.
- Mostrar entrenamiento del día y Kai Signal.

No tocar:

- Stores internos salvo selectores acordados.

### Agente 3: Plan UX

Ownership:

- `PlanTab`.
- Flujo de asignar bloque.
- UI semana/día.

Tarea:

- Construir Plan usando `scheduleStore`.
- Permitir asignar, mover, saltar y borrar.

No tocar:

- Internals de ActiveWorkout.
- Servicios IA.

### Agente 4: Integración Entrenamiento

Ownership:

- `ActiveWorkoutScreen`
- `workoutStore.finishWorkout`
- forma de `workoutHistory`
- hooks de gamificación/misión/árbol

Tarea:

- Completar scheduled workouts correctamente.
- Hacer que ActiveWorkout alimente progreso.

No tocar:

- UI de Plan salvo params/rutas.

### Agente 5: Kai Signals

Ownership:

- `src/types/kai.ts`
- `src/services/kaiSignalService.ts`
- componentes de signal
- integración post-workout

Tarea:

- Construir señales deterministas y recomendaciones.

No tocar:

- Provider LLM salvo integración mínima.

### Agente 6: QA Y Coherencia

Ownership:

- Checklist manual.
- Revisión de regresiones.
- TypeScript.
- Revisión contra PRD.

Tarea:

- Verificar loop completo.
- Marcar cualquier feature que complique sin reforzar el loop.

## 18. Orden De Implementación

1. Estabilizar progreso actual.
2. Crear modelo/store de schedule.
3. Refactorizar Hoy.
4. Crear Plan.
5. Conectar ActiveWorkout con schedule.
6. Crear Kai Signals.
7. Añadir recomendación post-workout.
8. Añadir eventos.
9. Beta cerrada.

No empezar por Apple Health, Strava o predicción compleja. Serán más valiosos cuando el loop interno funcione.

## 19. Preguntas Abiertas

1. ¿Scheduled workouts usan la última versión del bloque o snapshot al programar?
   - Recomendación MVP: usar última versión al empezar; snapshot solo al iniciar workout.

2. ¿Saltar sesión afecta racha?
   - Recomendación MVP: no extender racha, pero tampoco castigar. Reprogramar debe ser fácil.

3. ¿Hoy permite varios entrenamientos?
   - Recomendación MVP: sí, pero optimizar para uno principal.

4. ¿Kai planifica automáticamente tras onboarding?
   - Recomendación MVP: sí, pero el usuario acepta antes de guardar.

5. ¿AI Lab sigue visible?
   - Recomendación MVP: no como tab. Kai debe ser contextual.

6. ¿Calendario mensual?
   - Recomendación MVP: no. Semana primero.

## 20. Definition Of Done

El MVP está definido por este loop:

> Crear bloques, programarlos, abrir Hoy, completar el entrenamiento planificado, ver progreso y recibir una siguiente acción de Kai.

Todo lo demás queda subordinado hasta que ese loop sea fiable, simple y valioso para usuarios reales.
