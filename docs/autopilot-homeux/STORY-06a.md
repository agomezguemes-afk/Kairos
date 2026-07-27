# STORY-06a — Apertura "zoom desde el tile" de las carpetas de Blocks `[Blocks]`

**Estado**: LISTA PARA DESPACHAR (developer = opus). 1 ciclo (60-75 min).
**Depende de**: STORY-05 (carpetas en grid) y, idealmente, **STORY-05b**
(`useAccordion` con `progress` expuesto — este brief lo asume; si 05b no está
hecho aún, hacerlo primero: da el `progress` compartido que 06a necesita).
**Restricciones**: sin deps nuevas · sin nativo · sin store · sin commits · no
tocar Metro 8081 · **NO tocar CanvasGrid / vista Lienzo** (Álvaro puede estar
viéndola). Cierre: `npm run typecheck && npm test` verde + `/code-review`.

---

## 1. Objetivo

Hoy la carpeta de disciplina (STORY-05) se abre con un acordeón uniforme (altura
+ un "rise" en bloque). Falta el gesto de folder de iOS: al abrir, los bloques
miembros **"salen" de la carpeta** — aparecen con un pop escalonado (escala pequeña
→ tamaño real, con opacidad), como cuando iOS hace zoom de las apps fuera de un
folder. Esto sube el acabado a "nativo/tangible" sobre la MISMA superficie que
Álvaro ya está revisando (vista Cuadrícula), sin tocar nada del Lienzo.

Alcance deliberado: **variante inline** (los miembros hacen zoom en su sitio dentro
del acordeón), NO un overlay modal con blur del fondo (eso sería otra historia
mayor). El inline reutiliza el `progress` del acordeón → bajo riesgo.

---

## 2. Archivos EXACTOS a tocar

**EDITAR**
1. `src/features/blocks/components/DisciplineFolder.tsx` — dar a cada celda miembro
   un estilo animado **por índice** (stagger) derivado del `progress` del
   acordeón, en vez del `contentStyle` uniforme.

Nada más. Sin store, sin CanvasGrid, sin BlockCard (el pop envuelve a BlockCard,
no lo modifica).

---

## 3. Diseño concreto

### 3.1 De "rise uniforme" a "pop escalonado por miembro"

Tras STORY-05b, `useAccordion(open)` devuelve `progress` (SharedValue 0→1),
`containerStyle` (altura), `onContentLayout` y `chevronStyle`. El `contentStyle`
uniforme deja de aplicarse al grid entero; en su lugar, **cada celda miembro**
calcula su propio estilo desde `progress` con un desfase por índice:

```tsx
// Subcomponente memoizado dentro de DisciplineFolder:
function FolderMember({ progress, localIndex, children }: {
  progress: SharedValue<number>; localIndex: number; children: React.ReactNode;
}) {
  // Stagger: cada tarjeta arranca su tramo un poco después que la anterior,
  // pero todas terminan dentro del mismo open (240ms). Cap del offset para que
  // con muchas tarjetas el escalonado no se acumule sin fin.
  const start = Math.min(localIndex * 0.07, 0.35);
  const style = useAnimatedStyle(() => {
    const p = interpolate(progress.value, [start, start + 0.5], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: p,
      transform: [
        { scale: interpolate(p, [0, 1], [0.85, 1], Extrapolation.CLAMP) },
        { translateY: interpolate(p, [0, 1], [8, 0], Extrapolation.CLAMP) },
      ],
    };
  });
  return <Animated.View style={[styles.memberCell, style]}>{children}</Animated.View>;
}
```

- El grid interior (`memberGrid`) mantiene `onLayout={onContentLayout}` (medida de
  altura) pero **ya no** lleva el `contentStyle` uniforme; el movimiento vive en
  cada `FolderMember`.
- Los miembros se renderizan envueltos en `FolderMember` con `localIndex = i`
  (índice DENTRO de la carpeta, para el stagger visual) — distinto del
  `startIndex + i` que sigue pasándose a `BlockCard` para su `index` (stagger de
  ENTRADA en mount; no confundir los dos).
- `origin` del pop: el `scale 0.85→1` + `translateY 8→0` hace que las tarjetas
  parezcan emerger hacia arriba desde la zona de la carpeta. Suficiente para el
  "sale del folder" sin montar un overlay.

### 3.2 Toque en el tile (micro-pulido opcional, bajo riesgo)

Añadir al header un `scale` de press (0.97 en `onPressIn`, 1 en `onPressOut`, con
`springs.tap`/`springs.paper` de `theme/animations`) para que el tile "responda"
al toque como un icono de app. Opcional; si añade fricción, omitir.

### 3.3 Reduce-motion y correctitud

- `useReducedMotion`: como el estilo deriva de `progress`, cuando reduce-motion
  hace que `progress` salte 0↔1 sin `withTiming`, cada `FolderMember` salta a su
  estado final (opacidad 1, escala 1) sin pop. Verificar que NO queda ninguna
  tarjeta a opacidad 0/escala 0.85 residual.
- El `accessibilityElementsHidden={!open}` del `collapsible` (STORY-05/07) se
  mantiene: el pop es puramente visual, no cambia el árbol de accesibilidad.
- El grid siempre montado + re-medida en cada layout se conserva (no romper la
  lección de STORY-01).

---

## 4. Criterios de aceptación (verificación visual precisa)

Simulador con el Metro de Álvaro ya corriendo — NO reiniciarlo; vista
**Cuadrícula** del tab Workout:

1. Al tocar una carpeta, los bloques miembros **aparecen con un pop escalonado**
   (escala 0.85→1 + fade + leve subida), no todos a la vez ni con el rise plano
   anterior. Se lee como "salen de la carpeta".
2. El escalonado va en orden (1º, 2º, 3º…) y **todos terminan dentro de la misma
   apertura** (~240ms); con carpetas de muchos miembros el desfase está **capado**
   (no hay una última tarjeta que llegue tardísimo).
3. Cerrar: reverso limpio (las tarjetas se desvanecen/encogen al colapsar).
4. **Reduce-motion ON**: apertura/cierre instantáneos, sin pop, sin tarjetas
   residuales invisibles.
5. El chevron sigue rotando; la altura del acordeón crece igual; el reflow de los
   ítems de abajo (LinearTransition de FolderGrid) sigue suave.
6. **Vista Lienzo intacta**; toggle Lienzo↔Cuadrícula OK; FAB OK; abrir bloque /
   long-press opciones OK.
7. `npm run typecheck` limpio; `npm test` verde (baseline — **sin tests nuevos**).

## 5. Por qué NO hay tests vitest
Puro movimiento Reanimated derivado de `progress`; nada de datos extraíble. AC =
verificación visual (regla de la misión). La lógica pura del frente
(`blockFolders`) ya está testeada y no se toca.

## 6. Riesgo / duración
**Bajo**: un cambio localizado en DisciplineFolder (estilo por miembro), sin
store, sin canvas, sin deps. ~60-75 min con verificación. Snapshot en
`docs/autopilot-homeux/snapshots/`.
