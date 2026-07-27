# STORY-05 — Carpetas-app por disciplina en Blocks (vista cuadrícula) `[Blocks]`

**Estado**: LISTA PARA IMPLEMENTAR (developer = opus). 1 ciclo (75-90 min).
**Autorizada explícitamente por Álvaro** (viendo el simulador en vivo; Metro ya
corriendo — NO tocarlo).
**Restricciones**: sin deps nuevas · sin nativo/rebuild · **sin store** · sin
commits/git add · no tocar Metro 8081. Cierre: `npm run typecheck && npm test`
verde + `/code-review`.

---

## 0. Decisión de diseño: NO reutilizar `HomeFolder` (justificación)

El backlog imaginó "extraer el desplegable de STORY-01 a un `<Folder>` compartido".
Tras auditar el código real, **eso no encaja** y forzarlo sería una abstracción
equivocada:

| | HomeFolder (Home) | Carpeta-app (Blocks) |
|---|---|---|
| Cardinalidad | **UNA** carpeta | **MÚLTIPLES**, una por disciplina |
| Estado | persistido global en `uiStore` (`homeFolderOpen`) | independiente por carpeta; efímero en v1 |
| Affordance | fila-lista (eyebrow + teaser + chevron) | **icono-tile** con mini-preview 2×2 (metáfora folder iOS) |
| Apertura | acordeón de altura | acordeón ahora; **zoom desde el tile** en STORY-06 |
| Lógica de contenido | fija (calendario/estado/…) | dinámica: agrupar bloques por disciplina |

Lo único de verdad compartido es la **lógica pura de agrupación**, no la UI. Así
que: se construye un componente **nuevo** `DisciplineFolder` (puede *reflejar* la
técnica de colapso por altura de HomeFolder, pero es su propio componente), y se
extrae la decisión a una función pura testeable `groupBlocksIntoFolders`. **No**
se crea todavía un primitivo `<Folder>` genérico (tres componentes parecidos >
abstracción prematura — CLAUDE.md); si STORY-06 confirma un patrón común, se
extrae entonces con dos casos reales delante.

## 0.1 Alcance de UN ciclo (y qué se difiere)

- **ESTA historia (STORY-05)**: agrupación pura + carpetas en la **vista
  cuadrícula** (grid), colapsadas por defecto, que se despliegan **in-place
  (acordeón)** revelando sus bloques miembros. Reutiliza `BlockCard`. Estado de
  apertura **efímero** (sin persistencia → sin store → menor riesgo).
- **DIFERIDO a STORY-06**: la animación "zoom desde el origen del tile" (folder
  iOS), llevar las carpetas a la vista **Lienzo/canvas** (default), y (opcional)
  persistir carpetas abiertas. La vista **canvas queda intacta** en esta historia.

---

## 1. Objetivo

En la vista cuadrícula de Blocks, cuando el usuario tiene ≥2 bloques de la misma
disciplina, verlos agrupados en una **carpeta** (tile con mini-preview de iconos +
etiqueta de disciplina + conteo) que se despliega al tocarla, en vez de una
rejilla plana larga. Es la lectura literal de "apps as activity groups" de
CLAUDE.md, aplicada al Space de bloques, en su forma de un ciclo.

Regla iOS: una carpeta necesita **≥2** miembros. Un bloque solo de su disciplina
se queda como tarjeta suelta (nadie hace una carpeta de una sola app).

---

## 2. Archivos EXACTOS a tocar

**NUEVOS**
1. `src/features/blocks/lib/blockFolders.ts` — `groupBlocksIntoFolders` (puro).
2. `src/features/blocks/lib/blockFolders.test.ts` — tests vitest.
3. `src/features/blocks/components/DisciplineFolder.tsx` — carpeta colapsable
   (header-tile + acordeón de miembros).
4. `src/features/blocks/components/FolderGrid.tsx` — contenedor que renderiza la
   salida de `groupBlocksIntoFolders` (carpetas full-width + tarjetas sueltas en
   2 columnas), con reflow animado al desplegar.

**EDITAR**
5. `src/features/blocks/BlocksScreen.tsx` — en la rama `viewMode === 'grid'`,
   sustituir el `<FlatList numColumns={2}>` (líneas ~266-277) por `<FolderGrid>`.

La vista canvas, el header/toggle, el FAB, el empty state y las sheets **no se
tocan**.

---

## 3. Diseño concreto

### 3.1 `blockFolders.ts` — agrupación pura

```ts
// src/features/blocks/lib/blockFolders.ts
import type { WorkoutBlock, Discipline } from '../../../types/core';

export interface BlockFolder {
  kind: 'folder';
  discipline: Discipline;
  blocks: WorkoutBlock[]; // ≥2, en el orden de entrada (respeta el sort del caller)
}
export interface BlockSingleton {
  kind: 'single';
  block: WorkoutBlock;
}
export type BlockGridItem = BlockFolder | BlockSingleton;

/**
 * Agrupa por disciplina preservando el orden de entrada. Una disciplina con ≥2
 * bloques → una carpeta (en la posición de su PRIMER bloque). Con exactamente 1 →
 * tarjeta suelta. El caller pasa ya filtrado (sin archivados) y ordenado; esta
 * función no filtra ni ordena, solo agrupa de forma estable.
 */
export function groupBlocksIntoFolders(blocks: WorkoutBlock[]): BlockGridItem[] {
  // Recorre una vez; agrupa por discipline manteniendo primera aparición.
  // (Implementación: Map<Discipline, WorkoutBlock[]> por orden de inserción,
  //  luego emitir folder si length>=2 else single, en orden de primera aparición.)
}
```

Orden de salida = orden de **primera aparición** de cada disciplina en la entrada
→ estable y respeta el sort activo (recientes/nombre/…). Sin `null`, sin IO,
determinista (mismo patrón que `foldSummary`/`canvasLayout`).

### 3.2 `DisciplineFolder.tsx` — la carpeta

Props:
```ts
interface DisciplineFolderProps {
  discipline: Discipline;
  blocks: WorkoutBlock[];       // ≥2
  initialOpen?: boolean;        // true si contiene el bloque resaltado (§3.4)
  onOpenBlock: (b: WorkoutBlock) => void;
  onBlockOptions: (b: WorkoutBlock) => void;
  highlightTargetId?: string | null;
}
```

- **Header-tile (siempre visible)** — un `Pressable` que lee como icono-carpeta:
  - Izquierda: un tile cuadrado (~56×56, `Radius.lg`) con fondo `Colors.tint[discipline]`
    (o `Colors.discipline[discipline]` a baja alpha) que contiene una **mini-grid
    2×2** de los primeros 4 iconos de los bloques miembros (emoji vía el mapa de
    iconos ya existente — reutilizar el de `CanvasWidget.tsx` línea ~21, no
    duplicar el switch de `BlockCard`). Si hay >4 miembros, el 4º hueco puede
    mostrar "+N".
  - Centro: etiqueta de disciplina (de `DISCIPLINE_CONFIGS[discipline]?.name` —
    ver import en `TemplatePickerSheet.tsx`) + conteo (`${n} bloques`).
  - Derecha: chevron `Feather "chevron-down"` que rota 180° al abrir.
  - A11y: `accessibilityRole="button"`, `accessibilityState={{ expanded }}`,
    label `"${disciplineLabel}, ${n} bloques"`, hint "Toca para mostrar/ocultar".
  - Haptic `selectionAsync()` al togglear.
- **Cuerpo colapsable (acordeón)** — reutiliza la técnica probada de HomeFolder
  (NO el componente): `progress` sharedValue 0↔1 con `withTiming(240ms,
  Easing.out(Easing.cubic))` (instantáneo si `useReducedMotion`), altura
  `interpolate(progress,[0,1],[0,measured])` con `overflow:'hidden'`, contenido con
  opacidad + `translateY(-8→0)` (rise), chevron `rotate`. Los miembros se
  renderizan como **`BlockCard`** en un sub-grid de 2 columnas (flexWrap). Ojo
  clave de STORY-01: **re-medir en cada layout** (no cachear con un `measuredOnce`),
  para no clipar si el contenido cambia.
- **Estado `open`**: `useState(initialOpen ?? false)`. Efímero (sin persistencia).

### 3.3 `FolderGrid.tsx` — el contenedor

- Recibe `blocks` (= `sortedBlocks`), llama `groupBlocksIntoFolders(blocks)`.
- Render dentro de un `ScrollView` (no FlatList — necesitamos mezclar carpetas
  full-width + filas de 2 col + expansión con reflow):
  - `folder` → `<DisciplineFolder .../>` a ancho completo.
  - `single` → `<BlockCard .../>`; agrupar sueltos consecutivos en filas de 2
    columnas (contenedor flexWrap) para conservar la densidad actual del grid.
- **Reflow al desplegar**: envolver la lista en un `Animated.View
  layout={reduceMotion ? undefined : LinearTransition.duration(220).easing(Easing.out(Easing.cubic))}`
  para que, al expandir una carpeta, los ítems de abajo se desplacen suave en vez
  de saltar (mismo patrón que `DayCard`).
- `contentContainerStyle` con `paddingBottom: bottomInset + 100` (igual que el
  FlatList actual) y `paddingHorizontal` acorde a `H_PAD` para alinear con el
  header. `index` para `BlockCard` = posición global (para su stagger de entrada).

### 3.4 Auto-abrir la carpeta del bloque resaltado

BlocksScreen ya resalta un bloque recién creado/enfocado (`highlightTargetId`).
Si ese bloque cae dentro de una carpeta colapsada, el usuario no lo vería. →
`FolderGrid` calcula, por carpeta, `initialOpen = blocks.some(b => b.id === highlightTargetId)`
y lo pasa a `DisciplineFolder`. Así la carpeta que contiene el bloque resaltado
arranca **abierta**. (Es lógica de UI trivial; el resaltado en sí ya existe.)

### 3.5 Integración en `BlocksScreen.tsx`

Sustituir SOLO la rama grid (el `<FlatList ...>` de líneas ~266-277) por:
```tsx
<FolderGrid
  blocks={sortedBlocks}
  onOpenBlock={handleOpenBlock}
  onBlockOptions={handleBlockOptions}
  highlightTargetId={highlightTargetId}
  bottomInset={insets.bottom}
/>
```
`handleOpenBlock` y `handleBlockOptions` ya existen y sirven tal cual. El toggle
Lienzo/Cuadrícula, el sort y todo lo demás quedan igual. (El sort sigue siendo
significativo: reordena dentro de cada carpeta y la primera-aparición de las
disciplinas.)

---

## 4. Criterios de aceptación

**Verificables por tests (`groupBlocksIntoFolders`)** — ver §5.

**Verificación visual manual precisa** (simulador con el Metro de Álvaro ya
corriendo — NO reiniciarlo; asegurarse de estar en vista **Cuadrícula** con el
toggle del header):

1. Con ≥2 bloques de la misma disciplina: aparece una **carpeta** (tile con
   mini-preview 2×2 de iconos + etiqueta de disciplina + "N bloques" + chevron),
   **colapsada** por defecto.
2. Una disciplina con 1 solo bloque se muestra como **BlockCard suelta**, no como
   carpeta.
3. Tocar la carpeta la **despliega in-place** (~240ms: altura crece, contenido
   "rise", chevron rota) mostrando los miembros como BlockCards en 2 columnas; los
   ítems de abajo **reflowean** suave. Tocar de nuevo colapsa.
4. Tocar un bloque miembro abre `BlockDetail`; mantener pulsado abre las opciones
   (favorito/duplicar/eliminar) — mismos handlers de hoy.
5. Crear un bloque nuevo (o llegar con highlight) cuya disciplina forme carpeta:
   esa carpeta **arranca abierta** y el bloque resaltado se ve.
6. **Reduce-motion ON**: desplegar/colapsar y el reflow son instantáneos; estados
   finales correctos.
7. La vista **Lienzo** sigue idéntica; el toggle Lienzo↔Cuadrícula funciona; el
   FAB (crear rápido / sheet) funciona; el empty state no cambia.
8. Gold sigue reservado a Kai (las carpetas usan tint de disciplina + ink, no oro).
9. `npm run typecheck` limpio; `npm test` verde (baseline + nuevos de
   `blockFolders`).

---

## 5. Tests vitest (pure-core)

`src/features/blocks/lib/blockFolders.test.ts` — estilo `canvasLayout.test.ts`.
Usar un factory mínimo de `WorkoutBlock` (o reutilizar el helper de
`canvasLayout.test.ts` si existe uno). Casos:

1. `[]` → `[]`.
2. 1 bloque → `[{kind:'single'}]`.
3. 2 bloques misma disciplina → `[{kind:'folder', blocks.length:2}]`.
4. 2 bloques distinta disciplina → `[single, single]`.
5. Mixto (3 strength, 1 running, 2 mobility en orden intercalado) → carpeta
   strength(3), single running, carpeta mobility(2), **en orden de primera
   aparición**.
6. Estabilidad: cambiar el orden de entrada cambia el orden de salida de forma
   coherente (respeta el sort del caller).
7. Disciplina `'general'` con ≥2 → también forma carpeta (sin caso especial).

`DisciplineFolder`/`FolderGrid` son JSX + animación → **sin tests unitarios
artificiales**; su correctitud va por la verificación visual §4 (regla de la
misión).

---

## 6. Riesgo / duración

**Riesgo: medio-bajo.** Sin store, sin deps, sin nativo, **solo la rama grid**
(la vista canvas por defecto queda intacta → blast radius acotado). El punto que
pide ojo es el **reflow del `ScrollView`** al expandir (que los sueltos en 2 col +
las carpetas full-width convivan sin saltos) y **re-medir la altura** del acordeón
sin cachear (lección de STORY-01). Estimación 75-90 min con verificación. Orden
seguro: (1) `blockFolders` + tests (compila y verde aunque no haya UI); (2)
`DisciplineFolder` aislada; (3) `FolderGrid` + swap en BlocksScreen; verificar tras
cada uno. Corte limpio posible tras (1) si hiciera falta.

## 7. Notas / trampas
- No tocar canvas ni el toggle: si Álvaro está en Lienzo, que cambie a Cuadrícula
  para ver las carpetas (decirlo en el reporte).
- Reutilizar el mapa de iconos emoji existente (`CanvasWidget.tsx`) y
  `DISCIPLINE_CONFIGS` para labels; **no** duplicar el switch de iconos de BlockCard.
- Estado de apertura efímero a propósito (v1): persistir carpetas abiertas es
  STORY-06, no lo metas aquí (evita tocar store).
- La animación "zoom desde el tile" (folder iOS de verdad) es STORY-06; aquí basta
  el acordeón in-place.
- Snapshot del diff en `docs/autopilot-homeux/snapshots/` al cerrar (sin commit).
