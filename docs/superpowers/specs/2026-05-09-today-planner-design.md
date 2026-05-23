# Kairos · Today Planner Design

**Date:** 2026-05-09
**Status:** Design — approved, pending implementation
**Owner:** Álvaro
**Branch:** `feat/canvas`
**Scope:** Convert `HomeTab` into a Today Planner with selectable calendar (week/month), full schedule store (one-time + RRULE recurring), DayCard state matrix, deterministic Kai Signal, and assign/edit sheets.

---

## 1 · Vision

Kairos no es un fitness tracker ni un chat de IA. Es un sistema personal de entrenamiento basado en bloques inteligentes. La pantalla principal traduce intención en momentum: el usuario abre la app, ve qué toca hoy, entrena, registra progreso y recibe una señal útil.

**Convertir el `HomeTab` en un Today Planner** que combine:
- Calendario seleccionable (semana / mes) al estilo Apple Calendar, en clave minimalista cálida.
- Card del día con variants tipadas según estado (asignado, vacío, completado, futuro, pasado).
- Kai Signal contextual y determinístico, sin red.
- Asignación de bloques maestros con recurrencia RFC 5545 completa.

Identidad visual: la actual de `BlocksScreen` — fondo `Colors.bg.void`, cards `Colors.bg.surface`, `Shadows.card`, gold raro y significativo (solo CTAs de momento).

---

## 2 · Scope

**In:**
- Refactor `src/screens/tabs/HomeTab.tsx` → Today Planner.
- Schedule store (`scheduleStore.ts`) con persistencia AsyncStorage.
- Calendario custom (week + month) con view toggle y transición animada.
- 9 variants del DayCard.
- AssignBlockSheet (4 pasos: bloque → frecuencia → patrón → rango).
- RecurrenceEditorSheet (editar serie completa).
- Kai Signal engine determinístico.
- Integración con `workoutStore`, `GamificationContext`, `ActiveWorkoutScreen`.

**Out (v2):**
- Drag-and-drop de asignaciones en el calendario (long-press to drag).
- Vista de agenda multi-día (lista de próximos 7 días).
- Notificaciones locales / recordatorios.
- Sincronización con Apple Calendar / Google Calendar.
- Patrones alternantes con UI dedicada (en v1 se hacen como dos `RecurringAssignment` con RRULEs distintas — el data model lo soporta nativamente).

---

## 3 · Architecture decisions

| Decision | Choice | Rationale |
|---|---|---|
| Calendar grid | Custom con `date-fns` | Aesthetic fit. `react-native-calendars` pelea con minimalismo. |
| Recurrence engine | `rrule` (npm) | RFC 5545 completo, 30 años de iteración, ~30KB. |
| State | Zustand + `persist` + AsyncStorage | Consistente con `workoutStore`. |
| View toggle | Reanimated `Layout.springify()` | Transición altura week ↔ month. |
| Sheets | Reanimated bottom sheets (custom) | Patrón ya en uso (`BlockCreationSheet`). |
| Date format | ISO date string `YYYY-MM-DD` | Evita timezone hell. Local TZ vía date-fns. |

---

## 4 · Data model

### 4.1 · Types

```ts
// src/types/schedule.ts

export type ISODate = string;        // "2026-05-12"
export type ISOTimestamp = string;   // ISO 8601 con tz

interface AssignmentBase {
  id: string;
  blockId: string;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  /** Fechas marcadas como completadas. Recurring → una por ocurrencia. */
  completed: ISODate[];
}

export interface OneTimeAssignment extends AssignmentBase {
  kind: 'one-time';
  date: ISODate;
  /** True si el usuario la marcó como saltada (vs. eliminada). */
  skipped: boolean;
}

export interface RecurringAssignment extends AssignmentBase {
  kind: 'recurring';
  /** RRULE RFC 5545. Ej: "FREQ=WEEKLY;BYDAY=MO,WE,FR" */
  rrule: string;
  startDate: ISODate;
  endDate: ISODate | null;
  /** Ocurrencias saltadas explícitamente. */
  skipped: ISODate[];
  /** Ocurrencias movidas: { fechaOriginalDeRegla → nuevaFecha }. */
  moved: Record<ISODate, ISODate>;
}

export type ScheduleAssignment = OneTimeAssignment | RecurringAssignment;

export type AssignmentStatus = 'planned' | 'completed' | 'skipped';

/** Snapshot resuelto que el DayCard renderiza. */
export interface ResolvedAssignment {
  assignmentId: string;
  blockId: string;
  date: ISODate;
  status: AssignmentStatus;
  isRecurring: boolean;
  movedFrom?: ISODate;
}
```

### 4.2 · Store

```ts
// src/store/scheduleStore.ts

interface ScheduleState {
  assignments: ScheduleAssignment[];
  recentlyDeleted: Array<{ assignment: ScheduleAssignment; deletedAt: number }>;

  // Mutations
  assignOnce(date: ISODate, blockId: string): string;
  assignRecurring(input: {
    blockId: string;
    rrule: string;
    startDate: ISODate;
    endDate?: ISODate | null;
  }): string;
  moveOccurrence(assignmentId: string, fromDate: ISODate, toDate: ISODate): void;
  skipOccurrence(assignmentId: string, date: ISODate): void;
  unskipOccurrence(assignmentId: string, date: ISODate): void;
  changeOccurrenceBlock(assignmentId: string, date: ISODate, newBlockId: string): void;
  completeOccurrence(assignmentId: string, date: ISODate): void;
  uncompleteOccurrence(assignmentId: string, date: ISODate): void;
  truncateSeries(assignmentId: string, lastValidDate: ISODate): void;
  removeAssignment(assignmentId: string): void;
  undoLastDelete(): void;

  // Selectors (memoizados con LRU por rango)
  resolveDate(date: ISODate): ResolvedAssignment[];
  resolveRange(start: ISODate, end: ISODate): Map<ISODate, ResolvedAssignment[]>;
  hasAssignment(date: ISODate): boolean;
}
```

**Persistencia:** `persist({ name: 'kairos-schedule', storage: createJSONStorage(() => AsyncStorage) })`.

**Cache LRU:** las `RecurringAssignment` se expanden por rango visible. Se cachean 12 rangos (mensuales). Invalidación: cualquier mutación purga la cache.

### 4.3 · Scope semántico (sin diálogos modales)

| Acción | Punto de entrada UI | Efecto |
|---|---|---|
| Mover (single) | `DayCard.SecondaryActions` | `moveOccurrence` |
| Saltar (single) | `DayCard.SecondaryActions` | `skipOccurrence` |
| Cambiar bloque (single) | `DayCard.SecondaryActions` | `changeOccurrenceBlock` |
| Editar serie | Chip recurrencia → `RecurrenceEditorSheet` | `truncateSeries` + `assignRecurring` |
| Terminar serie | Botón en `RecurrenceEditorSheet` | `truncateSeries(today - 1)` + toast undo |
| Eliminar (single) | swipe / long-press → menú | `removeAssignment` + `recentlyDeleted` (5s undo) |

**"Cambiar bloque" sobre recurring:** crea una `OneTimeAssignment` con el nuevo bloque para esa fecha y añade la fecha a `skipped[]` de la serie. La serie sigue intacta para el resto.

---

## 5 · Component hierarchy

```
src/screens/tabs/HomeTab.tsx                       (refactored)
  └─ <TodayPlanner />

src/features/planner/
  TodayPlanner.tsx                                  (orchestrator)
  components/
    PlannerHeader.tsx
    CalendarView.tsx
    WeekStrip.tsx
    MonthGrid.tsx
    DayCell.tsx
    DayCard.tsx                                     (variant dispatcher)
    DayCard.Assigned.tsx
    DayCard.InProgress.tsx
    DayCard.Completed.tsx
    DayCard.Empty.tsx
    DayCard.FutureAssigned.tsx
    DayCard.FutureEmpty.tsx
    DayCard.PastSkipped.tsx
    DayCard.PastEmpty.tsx
    DayCard.NoBlocks.tsx
    BlockPreview.tsx
    RecurrenceChip.tsx
    KaiSignal.tsx
    AssignBlockSheet.tsx
    RecurrenceEditorSheet.tsx
  hooks/
    useDayCardState.ts
    useScheduleForDate.ts
    useScheduleForRange.ts
    useMomentumPhrase.ts
  lib/
    kaiSignal.ts                                    (deterministic engine)
    rrule.ts                                        (rrule wrapper + helpers)
    dates.ts                                        (date-fns helpers)
    momentum.ts                                     (greeting + phrase)

src/store/scheduleStore.ts                          (new)
src/types/schedule.ts                               (new)
```

---

## 6 · Calendar UX

### 6.1 · View toggle

Encima del calendario, segmented control discreto:

```
[ Semana  ·  Mes ]
```

`Spacing.sm` height, `gold.glow` highlight en el activo, `Type.caption` labels. Tap → Reanimated `Layout.springify()` cambia la altura del contenedor; `WeekStrip` y `MonthGrid` viven en el mismo árbol pero solo uno se renderiza.

### 6.2 · WeekStrip

7 cells horizontales, día seleccionado destacado con fill `gold.glow` y ring `gold.base`. Hoy = ring `gold.base` sin fill (se diferencia visualmente del seleccionado).

```
  L    M    X    J    V    S    D
  12   13  ─14─  15   16   17   18
   ·    ·    ·         ·              ← dot indicator si has assignment
```

Tap en celda → cambia `selectedDate`, haptic `impactAsync(Light)`.

### 6.3 · MonthGrid

6 filas × 7 columnas (siempre 6 para evitar saltos de altura). Días de meses adyacentes en `ink.muted`. Header con nombre del mes + flechas `‹ ›` para navegar. Swipe horizontal entre meses (Reanimated gesture handler) opcional v1, button-only OK.

### 6.4 · DayCell

```
┌──────────┐
│    14    │  ← Type.body, ink.primary (today: gold.base, selected: ink.inverse on gold.glow fill)
│   ···    │  ← max 3 dots; >3 → un solo dot doble-grueso
└──────────┘
```

Tamaño: 40×48 en WeekStrip, 36×40 en MonthGrid. Tap target real ≥ 44×44.

### 6.5 · Animaciones

- View toggle: `LinearTransition.springify().damping(18)` ~280ms.
- Day select: spring del fill (scale 0.95 → 1, opacity ramp), ~140ms.
- Mes anterior/siguiente: slide horizontal 280ms con cubic out.

---

## 7 · DayCard

Variant dispatcher en `DayCard.tsx`:

```ts
function DayCard({ date }: { date: ISODate }) {
  const state = useDayCardState(date);  // computa el variant
  switch (state.variant) {
    case 'assigned':       return <Assigned {...state} />;
    case 'in-progress':    return <InProgress {...state} />;
    case 'completed':      return <Completed {...state} />;
    case 'empty':          return <Empty {...state} />;
    case 'future-assigned':return <FutureAssigned {...state} />;
    case 'future-empty':   return <FutureEmpty {...state} />;
    case 'past-skipped':   return <PastSkipped {...state} />;
    case 'past-empty':     return <PastEmpty {...state} />;
    case 'no-blocks':      return <NoBlocks {...state} />;
  }
}
```

Container compartido: card blanca, `Radius.lg`, `Shadows.card`, `padding: Spacing.xl`. Layout transition entre variants: `Layout.springify()`, fade-cross del contenido en 180ms.

### 7.1 · Variant matrix

| variant | hero | meta | primaryCTA | secondary |
|---|---|---|---|---|
| `assigned` | block.name (serif 22) | `{disc} · {dur}m · {N}ej · {M}sets` | **Empezar** (gold.base fill) | Mover · Saltar · Cambiar |
| `in-progress` | block.name + dot pulse | `{done}/{total} sets hechos` | **Reanudar** (gold.base fill) | Terminar sesión |
| `completed` | `✓ ` + block.name (ink.tertiary 20) | `{sets} sets · {vol}kg · {min}min` | Ver resumen (ghost gold.deep) | — |
| `empty` | "Día sin plan" (serif 22) | `Tienes {N} bloques listos` | **Asignar bloque** (gold.base fill) | Kai, planifica mi semana (ghost) |
| `future-assigned` | block.name (serif 22) | `En {N} días · {disc}` | Programado (ghost gold.deep) | Mover · Saltar · Cambiar |
| `future-empty` | "Sin plan" (ink.tertiary 18) | `{dayLabel}` | Asignar bloque (ghost gold.deep) | — |
| `past-skipped` | block.name (ink.muted 18) | `Saltado · {dayLabel}` | — | Reasignar a hoy (ghost) |
| `past-empty` | "Sin plan" (ink.muted 16) | `{dayLabel}` (ink.muted) | — | — |
| `no-blocks` | "Tu primer bloque" (serif 22) | `Define una rutina y empieza` | **Crear bloque** (gold.base fill) | — |

**Recurrence chip:** `↻ Lun · Mié · Vie ›` aparece bajo la meta line en `assigned`, `in-progress`, `future-assigned` cuando `isRecurring === true`. Tap → `RecurrenceEditorSheet`.

**BlockPreview:** lista vertical compacta de hasta 4 ejercicios con `KIcon` + nombre + meta. Aparece en `assigned`, `future-assigned`. Si `block.exercises.length > 4` → línea final "+ {N − 4} más" en `gold.deep`.

### 7.2 · `useDayCardState`

```ts
function useDayCardState(date: ISODate): DayCardState {
  const blocks       = useWorkoutStore(s => s.blocks);
  const activeWorkout= useWorkoutStore(s => s.activeWorkout);
  const history      = useWorkoutStore(s => s.workoutHistory);
  const resolved     = useScheduleStore(s => s.resolveDate(date));
  const today        = todayISO();

  if (blocks.length === 0) return { variant: 'no-blocks', date };

  const r = resolved[0] ?? null;  // v1: una asignación por día (multi en v2)
  const block = r ? blocks.find(b => b.id === r.blockId) : null;

  if (date < today) {
    if (!r)                          return { variant: 'past-empty', date };
    if (r.status === 'completed')    return { variant: 'completed', date, resolved: r, block };
    return { variant: 'past-skipped', date, resolved: r, block };
  }

  if (date > today) {
    if (!r) return { variant: 'future-empty', date };
    return { variant: 'future-assigned', date, resolved: r, block };
  }

  // today
  if (!r)                            return { variant: 'empty', date };
  if (r.status === 'completed')      return { variant: 'completed', date, resolved: r, block };
  if (activeWorkout?.blockId === r.blockId) return { variant: 'in-progress', date, resolved: r, block, activeWorkout };
  return { variant: 'assigned', date, resolved: r, block };
}
```

---

## 8 · AssignBlockSheet

Bottom sheet con 4 pasos lineales. Header con back arrow + step indicator (3 dots).

| Step | Title | Body |
|---|---|---|
| 1 | "Elige un bloque" | Lista de `WorkoutBlock` master (filtrar `parentBlockId == null`). Cards compactas (`BlockCardCompact`). Tap → next. |
| 2 | "¿Cuándo?" | Tres pills grandes: `Una vez`, `Cada semana`, `Avanzado`. |
| 3a | (Una vez) | Date picker inline (mes mostrado). Tap día → next. |
| 3b | (Cada semana) | Selector de días L M X J V S D (toggleable). Default: día seleccionado. |
| 3c | (Avanzado) | TextInput RRULE + 4 presets ("Cada 2 sem. L/X/V", "1er lunes del mes", "Lun a Vie", "Fines de semana"). |
| 4 | "Hasta cuándo" | Tres pills: `Sin fin`, `Hasta una fecha`, `N veces`. Solo si Step 2 ≠ "Una vez". |
| Final | "Confirmar" | Resumen humano de la asignación + botón **Asignar** (gold.base fill). |

**Validación:** rrule lib `RRule.fromString()` lanza si la regla es inválida. Catch → muestra error inline `Regla no válida` en `Colors.semantic.error`.

---

## 9 · RecurrenceEditorSheet

Para editar serie completa. Misma estructura que steps 2-4 de AssignBlockSheet pero precargado con la regla actual. Botones:

- **Aplicar a esta y futuras** (gold.base): trunca rule actual a `lastValidDate = selectedDate - 1` y crea nueva con rule editada desde `selectedDate`.
- **Terminar serie** (ghost, ink.muted): `truncateSeries(yesterday)`. Toast "Serie terminada · Deshacer".

---

## 10 · Kai Signal engine

Determinístico, sin red. Una sola función pura: `kaiSignal(inputs) → KaiSignal | null`.

```ts
// src/features/planner/lib/kaiSignal.ts

export function kaiSignal(inputs: KaiInputs): KaiSignal | null {
  // Reglas en orden de prioridad — primera que matchea gana.

  if (inputs.blocksCount === 0) {
    return { id: 'no-blocks', tone: 'momentum',
      message: 'Crea tu primer bloque para empezar a planificar.',
      action: { label: 'Crear bloque', kind: 'create-block' } };
  }

  if (inputs.hasActiveWorkout) {
    return { id: 'resume', tone: 'progress',
      message: 'Tienes una sesión a medias. Reanuda donde la dejaste.',
      action: { label: 'Reanudar', kind: 'resume' } };
  }

  if (inputs.isToday && inputs.resolved?.status === 'completed') {
    return { id: 'done', tone: 'celebrate',
      message: 'Sesión completada. Buen ritmo, descansa o estira.' };
  }

  if (inputs.isToday && !inputs.resolved && inputs.streak >= 3) {
    return { id: 'streak', tone: 'momentum',
      message: `Llevas ${inputs.streak} días. Una sesión corta mantiene la racha.`,
      action: { label: 'Asignar bloque', kind: 'assign' } };
  }

  if (inputs.isToday && !inputs.resolved) {
    return { id: 'no-plan', tone: 'momentum',
      message: 'Día sin plan. Programa una sesión para mantener momentum.',
      action: { label: 'Kai planifica', kind: 'plan-week' } };
  }

  if (inputs.isToday && inputs.resolved && !inputs.lastSession) {
    return { id: 'first-time', tone: 'focus',
      message: 'Foco de hoy: completa el bloque sin cambiar accesorios.' };
  }

  if (inputs.isToday && inputs.resolved && inputs.lastSessionRatio === 1) {
    return { id: 'progress-up', tone: 'progress',
      message: 'La última vez cerraste todas las series. Puedes subir ligeramente.' };
  }

  if (inputs.isToday && inputs.resolved && inputs.lastSessionRatio !== null && inputs.lastSessionRatio < 1) {
    const remaining = inputs.lastSessionMissingSets;
    return { id: 'close-block', tone: 'focus',
      message: `La última vez quedaste a ${remaining} series. Hoy intenta cerrar el bloque.` };
  }

  return null;  // futuro o pasado completado → silencio
}
```

**Visual:** card pequeña, `Radius.md`, `padding: Spacing.lg`, `bg: Colors.bg.warm`, dot `tone color` 6×6 a la izquierda, mensaje en `ink.secondary`, action button ghost `gold.deep` alineado a la derecha. Sin sombra (más calmada que las cards principales).

---

## 11 · Integration points

### 11.1 · Active workout completion

Cuando `ActiveWorkoutScreen` finaliza:

```ts
// pseudo — en endWorkout handler
const todayKey = todayISO();
const resolved = useScheduleStore.getState().resolveDate(todayKey);
const match = resolved.find(r => r.blockId === currentBlockId);
if (match) {
  useScheduleStore.getState().completeOccurrence(match.assignmentId, todayKey);
}
useWorkoutStore.getState().endWorkout(...);  // existente
```

Streak/badges se calculan desde `workoutHistory` (single source of truth para "qué pasó realmente"). El campo `completed` del schedule store es índice rápido para el DayCard.

### 11.2 · "Kai planifica mi semana"

CTA en `Empty` variant y en KaiSignal. v1 = abre `AIChatScreen` con prompt prefijado: `"Planifica mi semana"`. La generación de plan que ya muta blocks → ahora también puede mutar schedule. Out of scope para esta v1: la integración con tool calling para asignaciones queda para v2; en v1 el AI sugiere bloques en chat y el usuario los asigna manualmente desde el sheet.

### 11.3 · Navigation

`HomeTab` mantiene su slot en `DashboardTabs` del `AppNavigator`. CTAs:
- "Empezar" / "Reanudar" → `nav.navigate('ActiveWorkout', { blockId })`.
- "Asignar bloque" → abre `AssignBlockSheet` (modal sobre HomeTab).
- "Crear bloque" → `nav.navigate('WorkoutTab')`.
- "Ver resumen" → `nav.navigate('SessionSummary', { historyId })`.

---

## 12 · Visual & motion

Todo desde `src/theme/tokens.ts` v3:
- bg pantalla: `Colors.bg.void`
- cards: `Colors.bg.surface` + `Shadows.card`
- gold solo en CTAs de momento (Empezar, Reanudar, Asignar bloque, Crear bloque)
- hairline dividers: `Colors.hair.subtle`
- spacing screen: `Spacing.screen.horizontal`
- radii: `Radius.lg` cards, `Radius.md` chips, `Radius.full` pills

**Animaciones:**
- Entrance: `FadeInDown.delay(i*60).duration(280)` por sección.
- Day select: spring fill 140ms.
- View toggle: `Layout.springify().damping(18)`.
- Variant cross-fade: 180ms cubic out.
- KaiSignal: `FadeIn.duration(220)` cuando aparece, no animación cuando re-renderiza con mismo `id`.

---

## 13 · Accessibility

- VoiceOver labels en todos los `Pressable` (DayCell, CTA, action buttons).
- Dynamic Type respetado vía `Type.*` tokens.
- Reduce-motion: `useReducedMotion()` desde Reanimated → reemplaza spring por linear 200ms.
- Tap targets ≥ 44×44 (incluye DayCell aunque visualmente sean menores).

---

## 14 · Persistence

- Zustand `persist` middleware con `name: 'kairos-schedule'`.
- Hydration race: `onRehydrateStorage` callback ya pattern existente en `workoutStore`.
- Migración: no hay v0 previa, no se necesita migration handler.

---

## 15 · Testing strategy

- Unit: `kaiSignal()` con 10 fixtures de inputs cubriendo cada rama. `resolveDate`/`resolveRange` con RRULE samples.
- Integration: Today Planner monta con seed → cambia día → click Empezar → mock nav navigate llamado con blockId correcto.
- Manual: device run en iPhone 12 Pro (build chain en CLAUDE.md §7).

---

## 16 · File deltas

**New files:**
- `src/types/schedule.ts`
- `src/store/scheduleStore.ts`
- `src/features/planner/TodayPlanner.tsx`
- `src/features/planner/components/*.tsx` (10 archivos listados §5)
- `src/features/planner/hooks/*.ts` (4 archivos listados §5)
- `src/features/planner/lib/*.ts` (4 archivos listados §5)

**Modified:**
- `src/screens/tabs/HomeTab.tsx` → renderiza `<TodayPlanner />` (delgado, solo wrapper).
- `src/screens/ActiveWorkoutScreen.tsx` → en endWorkout llama `completeOccurrence`.
- `package.json` → añade `rrule`, `date-fns`.

**Untouched:** `BlocksScreen`, `BlockEditorScreen`, `ActiveWorkoutScreen` (excepto el hook de finalización), `tokens.ts`, navegación.

---

## 17 · Acceptance criteria

1. Abrir HomeTab muestra header "Hoy" + fecha + frase momentum + streak pill, calendario con vista semana por defecto, day card del día seleccionado y Kai Signal contextual.
2. Toggle Semana ↔ Mes anima con spring sin saltos de layout.
3. Asignar un bloque a una fecha vía AssignBlockSheet (one-time): aparece dot indicator en el calendario, DayCard muestra variant Assigned, persiste tras reload.
4. Asignar un bloque recurrente weekly L/X/V: dots aparecen en todas las ocurrencias del rango visible, navegación entre meses los preserva.
5. Tap "Empezar" → ActiveWorkoutScreen con el bloque correcto. Al terminar la sesión, DayCard pasa a variant Completed.
6. Mover una ocurrencia recurrente: solo esa fecha se mueve, las demás permanecen.
7. Saltar una ocurrencia: variant pasa a PastSkipped el día siguiente, racha lo respeta.
8. Editar serie via chip recurrencia → trunca regla anterior, crea nueva. Histórico intacto.
9. Eliminar via swipe → toast undo durante 5s funciona.
10. Sin bloques: HomeTab muestra variant NoBlocks, CTA navega a WorkoutTab.
11. TypeScript compila limpio, no hay warnings de tokens deprecados.

---

**End of spec.**
