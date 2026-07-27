# STORY-03 — Memoria + apertura inteligente de la carpeta `[Home]`

**Estado**: LISTA PARA IMPLEMENTAR (developer = fable). ~75-90 min (ver §7,
riesgo/batería).
**Depende de**: STORY-01 (HomeFolder en árbol; el fix de `measuredOnce` ya
permite que una apertura programática anime/mida bien).
**Restricciones**: sin deps nuevas · sin nativo/rebuild · sin commits/git add ·
no tocar Metro 8081. Cierre: `npm run typecheck && npm test` verde + `/code-review`.

---

## 1. Objetivo

Dos mejoras sobre la carpeta de STORY-01:

1. **Memoria**: la carpeta recuerda si el usuario la dejó abierta o cerrada, y
   respeta esa elección al reabrir la app (principio "Álvaro decide").
2. **Apertura inteligente (primer contacto)**: mientras el usuario no haya
   tocado la carpeta nunca, se abre sola los días **sin plan** (donde el
   calendario/asignar ES la acción principal) y se queda cerrada los días con
   sesión lista (donde el CTA "Empezar" debe liderar).

Regla de precedencia (simple y defendible): **la elección explícita del usuario
gana siempre**; el "smart default" solo siembra la primera experiencia (cuando
aún no hay elección recordada). Tradeoff documentado en §6.

---

## 2. Mecanismo de persistencia elegido (justificación en 2 líneas)

**Un store UI dedicado y diminuto** (`src/store/uiStore.ts`, Zustand `persist`,
clave propia `kairos-ui`, `partialize`), NO un campo en `workoutStore`.
Porque: (1) `workoutStore` está tras un `migrate` versionado (v4) y su shape
persistido es dominio puro — meter estado de UI lo contamina y arriesga la
cadena de migración; (2) replica exactamente el idioma ya existente de
`scheduleStore` (store pequeño, persist, `partialize`, `onRehydrateStorage`),
así que es el camino de menor sorpresa y menor riesgo. AsyncStorage directo en el
componente se descarta: obliga a hidratación async manual y flash de estado.

---

## 3. Archivos EXACTOS a tocar

**NUEVOS**
1. `src/store/uiStore.ts` — store UI persistido (`kairos-ui`).
2. `src/features/planner/lib/folderState.ts` — `folderDefaultOpen` + `resolveFolderOpen` (puro).
3. `src/features/planner/lib/folderState.test.ts` — tests vitest.

**EDITAR**
4. `src/features/planner/components/HomeFolder.tsx` — consumir uiStore + variant
   de hoy, resolver estado inicial sin flash, persistir en cada toggle.

**No** tocar `TodayPlanner.tsx`: HomeFolder se autoresuelve (mismo criterio que
HomeHero en STORY-02). Mantiene el orquestador limpio y deja la
persistencia/smart-default FUERA del futuro primitivo genérico `<Folder>`
(STORY-05).

---

## 4. Diseño concreto

### 4.1 `folderState.ts` — decisiones puras

```ts
// src/features/planner/lib/folderState.ts
import type { DayCardVariant } from '../hooks/useDayCardState';

/** Smart default (solo primer contacto): la carpeta se abre sola los días donde
 * su contenido (calendario para asignar, estado para consultar) ES la acción
 * principal — es decir, no hay nada que empezar hoy. Con sesión en cola, cerrada:
 * el CTA "Empezar" lidera. */
export function folderDefaultOpen(todayVariant: DayCardVariant): boolean {
  return todayVariant === 'empty' || todayVariant === 'no-blocks';
}

/** Estado resuelto de la carpeta: una elección explícita del usuario (remembered)
 * gana siempre; sin ella, cae al smart default. `null` = nunca tocada. */
export function resolveFolderOpen(
  remembered: boolean | null,
  todayVariant: DayCardVariant,
): boolean {
  return remembered !== null ? remembered : folderDefaultOpen(todayVariant);
}
```

### 4.2 `uiStore.ts` — persistencia (espejo de `scheduleStore`)

```ts
// src/store/uiStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UIState {
  /** null = el usuario nunca ha tocado la carpeta de Home → usar smart default. */
  homeFolderOpen: boolean | null;
  /** Falso hasta que persist rehidrata desde disco (evita flash de estado). */
  _hasHydrated: boolean;
  setHomeFolderOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      homeFolderOpen: null,
      _hasHydrated: false,
      setHomeFolderOpen: (open) => set({ homeFolderOpen: open }),
    }),
    {
      name: 'kairos-ui',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ homeFolderOpen: s.homeFolderOpen }),
      onRehydrateStorage: () => () => useUIStore.setState({ _hasHydrated: true }),
    },
  ),
);
```

### 4.3 `HomeFolder.tsx` — wiring sin flash

Importar `useUIStore`, `useDayCardState` (`../hooks/useDayCardState`), `todayISO`
(`../lib/dates`), `resolveFolderOpen` (`../lib/folderState`).

```ts
const { homeFolderOpen, _hasHydrated, setHomeFolderOpen } = useUIStore();
const todayVariant = useDayCardState(todayISO()).variant;
const resolved = resolveFolderOpen(homeFolderOpen, todayVariant);
```

Estado y no-flash — **punto crítico de correctitud**:
- `open` (useState) arranca en `false` (colapsada, seguro) y `progress` en 0.
- `useEffect` sobre `[_hasHydrated]`: cuando pasa a `true`, si `open !== resolved`
  → `setOpen(resolved)` y **fijar `progress.value = resolved ? 1 : 0` de forma
  INSTANTÁNEA (sin `withTiming`)**. Es decir: el restore de arranque en frío
  **no anima** (aparece ya en su estado), solo los toggles del usuario animan.
  Esto es exactamente el carry-forward que anotó el /code-review de STORY-01:
  `defaultOpen`/apertura programática no debe "saltar" con animación a medias —
  aquí se hace salto limpio en frío y animación solo en interacción.
- Toggle del usuario (en el `onPress` del handle, además del `Haptics` y el
  `setOpen` que ya existen de STORY-01): persistir con
  `setHomeFolderOpen(next)`. La animación del toggle sigue siendo la de STORY-01
  (`withTiming` 240ms / instantánea si `reduceMotion`).

Quitar el prop `defaultOpen` de STORY-01 si queda sin uso (TodayPlanner no lo
pasaba) — o dejarlo inerte; no reintroducir un segundo camino de apertura.

Nota de re-medida: como la carpeta puede arrancar ya abierta, confirmar que el
alto se mide igual (el fix de `measuredOnce` remide en cada layout, así que el
alto correcto llega en cuanto los hijos hacen layout aunque `progress` ya sea 1).

---

## 5. Criterios de aceptación

**Verificables por tests (`folderState`)** — ver §7.1.

**Verificación visual manual precisa** (simulador con el Metro de Álvaro ya
corriendo — NO reiniciarlo; para probar rehidratación, recargar el bundle / cerrar
y reabrir la app en el simulador, no reiniciar Metro):

1. **Memoria**: abrir la carpeta, recargar la app → reaparece **abierta**.
   Cerrarla, recargar → reaparece **cerrada**.
2. **Smart default, usuario nuevo** (sin toggle previo — borrar datos o key
   `kairos-ui`): en un día **sin plan** (`empty`/`no-blocks`) la carpeta arranca
   **abierta**; en un día con **sesión asignada** (`assigned`/`in-progress`)
   arranca **cerrada**.
3. **Sin flash**: en arranque en frío con estado recordado = abierta, la carpeta
   aparece **ya abierta**, sin parpadeo cerrada→abierta ni animación de apertura.
4. **Precedencia**: tras cerrar explícitamente la carpeta un día sin plan,
   recargar en otro día sin plan → sigue **cerrada** (la elección del usuario gana
   sobre el smart-open). Tradeoff §6.
5. **Reduce-motion ON**: el restore es instantáneo (ya lo es) y los toggles no
   animan; estado final correcto.
6. Los toggles del usuario siguen animando en 240ms (comportamiento STORY-01
   intacto); solo el restore en frío es salto.
7. Sin regresiones en HomeFolder (teaser, chevron, hijos, a11y) ni en el resto de
   Home. `npm run typecheck` limpio y `npm test` verde (baseline + nuevos).

---

## 6. Tradeoff documentado (para revisión de Álvaro)

"Remembered gana siempre" significa que el smart-open **solo dispara para un
usuario que nunca tocó la carpeta**. Alternativa (NO implementada por simplicidad
y por respetar la intención del usuario): re-abrir automáticamente los días sin
plan aunque el usuario la haya cerrado antes. Se deja como posible refinamiento
futuro si en dogfooding la carpeta se siente "demasiado pegada a cerrada" los días
que el calendario es lo único accionable. La versión actual prioriza
predictibilidad + soberanía del usuario (CLAUDE.md).

---

## 7. Tests + valoración de riesgo/duración

### 7.1 Tests vitest (`folderState.test.ts`, estilo `momentum.test.ts`)

`folderDefaultOpen` (exhaustivo sobre los 9 variants):
- `'empty'` → `true`; `'no-blocks'` → `true`.
- `'assigned'`, `'in-progress'`, `'completed'`, `'future-assigned'`,
  `'future-empty'`, `'past-skipped'`, `'past-empty'` → `false`.

`resolveFolderOpen`:
- `(true, 'assigned')` → `true` (remembered gana sobre smart-closed).
- `(false, 'empty')` → `false` (remembered gana sobre smart-open).
- `(null, 'empty')` → `true` (smart default).
- `(null, 'assigned')` → `false` (smart default).

`uiStore.ts` NO se testea unitariamente (envoltorio fino sobre `zustand/persist`,
igual que `scheduleStore` no se testea su persist). El wiring de HomeFolder →
verificación visual §5.

### 7.2 Riesgo / duración — LEER ANTES DE EJECUTAR

Esta es la historia **más arriesgada del sprint hasta ahora**: la lógica pura es
trivial, pero el wiring de hidratación **sin flash** es la interacción más fina
(distinguir "restore en frío = salto" de "toggle = animación", más verificar en
simulador que no hay parpadeo). Estimación realista **75-90 min incluyendo la
verificación visual on-device del no-flash**, que NO debe hacerse con prisa.

**Recomendación dado el aviso de batería (45%, ~63 min, umbral 45 min):** NO
arrancar este ciclo. Dejarla LISTA y ejecutarla al principio del próximo ciclo
con batería/cargador, para no rozar el corte de batería justo en la parte que
exige verificación visual pausada. Si el coordinador decide arrancar igualmente,
el orden seguro es: (1) `folderState.ts` + tests (2) `uiStore.ts` (3) wiring de
HomeFolder — y si la batería obliga a parar, se corta limpio tras (1)/(2), que ya
compilan y pasan tests, dejando solo el wiring para después.

---

## 8. Notas / trampas

- No meter estado de UI en `workoutStore` (contamina dominio + migrate). Store UI
  aparte, ya justificado §2.
- La persistencia/smart-default vive en el **wrapper de Home**, no en HomeFolder-
  como-primitivo-genérico: cuando STORY-05 extraiga `<Folder>`, esta lógica se
  queda fuera del primitivo (un `<Folder>` reusable es controlado/uncontrolled
  puro, sin conocer Kairos).
- Gold sigue reservado a Kai. Sin deps nuevas (`zustand`, `persist`, AsyncStorage
  ya están en el proyecto).
- Snapshot del diff en `docs/autopilot-homeux/snapshots/` al cerrar (sin commit).
