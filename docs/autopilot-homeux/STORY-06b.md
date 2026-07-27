# STORY-06b — Persistir carpetas abiertas en Blocks `[Blocks]`

**Estado**: LISTA PARA DESPACHAR (developer = opus). 1 ciclo (50-60 min).
**Depende de**: STORY-05 + STORY-05b (`useAccordion` expone `progress`, necesario
para el salto de hidratación no-flash). Toca el MISMO archivo que STORY-06a
(`DisciplineFolder.tsx`) → **secuenciar, no paralelizar** con 06a (orden sugerido:
05b → 06a → 06b).
**Restricciones**: sin deps nuevas · sin nativo · sin commits · no tocar Metro
8081 · NO tocar CanvasGrid/Lienzo. Cierre: `npm run typecheck && npm test` verde +
`/code-review`.

---

## 1. Objetivo

Hoy el estado abierto/cerrado de cada carpeta de disciplina es efímero (se pierde
al recargar). Persistirlo: si el usuario deja una carpeta abierta, al volver a
Blocks (o recargar la app) sigue abierta. Reutiliza el idioma exacto de
persistencia + no-flash ya probado en HomeFolder (STORY-03), keyed por disciplina.

Regla: un bloque **resaltado** (recién creado) dentro de una carpeta la abre
aunque estuviera recordada cerrada — revelar el bloque nuevo gana sobre la memoria.

---

## 2. Archivos EXACTOS a tocar

**NUEVOS (tests)** — la parte pura se añade a un archivo existente:
- (edit) `src/features/blocks/lib/blockFolders.ts` — añadir `resolveBlockFolderOpen`.
- (edit) `src/features/blocks/lib/blockFolders.test.ts` — casos de la nueva fn.

**EDITAR**
1. `src/store/uiStore.ts` — añadir `blockFoldersOpen` + acción + `partialize`.
2. `src/features/blocks/components/DisciplineFolder.tsx` — leer estado persistido,
   resolver open inicial, saltar `progress` en hidratación (no-flash), persistir
   en cada toggle, guard `_hasHydrated`.
3. `src/features/blocks/components/FolderGrid.tsx` — pasar `containsHighlight` a
   `DisciplineFolder` (ya calcula `initialOpen` desde highlight; renombrar/pasar).

Sin CanvasGrid, sin Home.

---

## 3. Diseño concreto

### 3.1 Pure-core: `resolveBlockFolderOpen`

```ts
// añadir a src/features/blocks/lib/blockFolders.ts
/** Estado inicial de una carpeta: un bloque resaltado dentro la abre siempre;
 *  si no, gana lo recordado; por defecto cerrada. `persisted` = undefined cuando
 *  el usuario nunca la tocó. */
export function resolveBlockFolderOpen(
  persisted: boolean | undefined,
  containsHighlight: boolean,
): boolean {
  return containsHighlight || persisted === true;
}
```

### 3.2 `uiStore.ts` — extender (mismo idioma que `homeFolderOpen`)

```ts
interface UIState {
  homeFolderOpen: boolean | null;
  blockFoldersOpen: Record<string, boolean>; // key = discipline
  _hasHydrated: boolean;
  setHomeFolderOpen: (open: boolean) => void;
  setBlockFolderOpen: (discipline: string, open: boolean) => void;
}
// en el creator:
blockFoldersOpen: {},
setBlockFolderOpen: (discipline, open) =>
  set((s) => ({ blockFoldersOpen: { ...s.blockFoldersOpen, [discipline]: open } })),
// partialize:
partialize: (s) => ({ homeFolderOpen: s.homeFolderOpen, blockFoldersOpen: s.blockFoldersOpen }),
```
`onRehydrateStorage`/`_hasHydrated` ya existen — sin cambios.

### 3.3 `DisciplineFolder.tsx` — wiring (espejo de HomeFolder STORY-03)

- `const { blockFoldersOpen, _hasHydrated, setBlockFolderOpen } = useUIStore();`
- `const persisted = blockFoldersOpen[discipline];`
- `const resolved = resolveBlockFolderOpen(persisted, containsHighlight);`
- `open` arranca en `false` + `progress` en 0 (estado seguro pre-hidratación).
- `useEffect([_hasHydrated])`: al hidratar, si `open !== resolved` → **saltar**
  `progress.value = resolved ? 1 : 0` (instantáneo, usando el `progress` expuesto
  por `useAccordion`) y `setOpen(resolved)`. Cold-start sin animación (no-flash);
  solo los toggles animan. (Idéntico patrón a HomeFolder — mismo comentario WHY.)
- `handleToggle`: `if (!_hasHydrated) return;` (guard, lección STORY-03) +
  `Haptics.selectionAsync()` + `setOpen(next)` + `setBlockFolderOpen(discipline, next)`.
- `containsHighlight` llega por prop desde FolderGrid (= `blocks.some(b => b.id === highlightTargetId)`); reemplaza el `initialOpen` de STORY-05.

### 3.4 `FolderGrid.tsx`
- Sustituir el cálculo de `initialOpen` por `containsHighlight` y pasarlo como prop
  a `DisciplineFolder` (mismo valor, nombre honesto). Sin más cambios.

---

## 4. Criterios de aceptación

**Verificables por tests (`resolveBlockFolderOpen`)** — ver §5.

**Verificación visual** (Metro de Álvaro corriendo, vista Cuadrícula):
1. Abrir una carpeta, recargar la app → sigue **abierta**. Cerrarla, recargar →
   **cerrada**. Cada disciplina recuerda su propio estado independiente.
2. **No-flash**: en arranque en frío con una carpeta recordada abierta, aparece ya
   abierta, sin parpadeo cerrada→abierta ni animación de apertura.
3. Crear un bloque nuevo de una disciplina cuya carpeta estaba recordada cerrada →
   la carpeta se abre (highlight gana) y el bloque se ve.
4. Toggles siguen animando con el pop de STORY-06a (240ms); solo el restore en frío
   es salto.
5. **Reduce-motion ON**: restore y toggles instantáneos; estados correctos.
6. Vista Lienzo intacta; Home (su carpeta) sin cambios (misma store, clave distinta).
7. `npm run typecheck` limpio; `npm test` verde (baseline + nuevos de
   `resolveBlockFolderOpen`).

## 5. Tests vitest
Añadir a `blockFolders.test.ts` (`resolveBlockFolderOpen`):
- `(undefined, false)` → `false`; `(undefined, true)` → `true`.
- `(true, false)` → `true`; `(false, true)` → `true` (highlight gana a cerrado);
- `(false, false)` → `false`; `(true, true)` → `true`.
`uiStore`/wiring → sin test unitario (envoltorio persist + props; verificación
visual §4), igual criterio que STORY-03.

## 6. Riesgo / duración
**Bajo-medio**: toca store pero es el idioma ya probado (extiende `uiStore` con una
clave nueva + una acción; `partialize` aditivo, sin migración). El cuidado va en
replicar exacto el no-flash de STORY-03. ~50-60 min. Snapshot en
`docs/autopilot-homeux/snapshots/`.

## 7. Nota de secuencia
06a y 06b editan ambos `DisciplineFolder.tsx`. Hacerlos **en serie** (05b → 06a →
06b), verificando entre medias, para commits bisectables y sin conflictos.
