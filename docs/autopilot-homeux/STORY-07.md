# STORY-07 — Cierre de Home con llave: a11y del primitivo carpeta + regresión `[Home / transversal]`

**Estado**: LISTA PARA IMPLEMENTAR (developer = opus). ~45-60 min. Mezcla: **1
fix de correctitud a11y** (con verificación) + auditoría manual + checklist de
regresión del sprint de Home. **Sin lógica extraíble nueva → sin tests vitest**
(AC = verificación con VoiceOver / Dynamic Type / reduce-motion + snapshot).
**Depende de**: STORY-01/03/04 (todas en árbol).
**Restricciones**: sin deps nuevas · sin nativo/rebuild · sin store · sin
commits/git add · no tocar Metro 8081. Cierre: `npm run typecheck && npm test`
verde (baseline) + `/code-review`.

---

## 0. Por qué esta historia AHORA (decisión de PM)

P0+P1 completos: Home ya cumple la orden de Álvaro (lo relevante sin scroll +
carpeta pulida con dinámica iOS, memoria, smart-default y lectura de contenedor
único). Antes de abrir un frente nuevo y mayor (Blocks app-folders, STORY-05/06 —
más riesgo y se aleja del wedge validado `hablar→bloque→entrenar→memoria`), la
disciplina de sprint pide **cerrar Home con llave**: (1) endurecer la
accesibilidad del primitivo carpeta —la interacción nueva de mayor tráfico, con
un bug real ya detectado (§1)— y (2) pasar un checklist de regresión de todo lo
construido (STORY-01..04). Blocks se **difiere** como decisión deliberada de
Álvaro (soberanía del usuario), no como expansión de alcance autónoma nocturna.

---

## 1. FIX de correctitud (obligatorio): contenido colapsado oculto al lector

**Bug real**: en `HomeFolder.tsx` los children están SIEMPRE montados y solo se
recortan a `height:0` con `overflow:'hidden'` (líneas ~161-165). En RN, el clip
por altura/overflow **no** saca los descendientes del árbol de accesibilidad →
con la carpeta **cerrada**, VoiceOver todavía navega hacia dentro del calendario,
estado, semana y señal invisibles. Es el fallo a11y clásico de un colapsable.

**Arreglo** (patrón cross-plataforma estándar): en el `Animated.View`
`collapsible` (el contenedor de altura animada), condicionar a `open`:
```tsx
<Animated.View
  style={[styles.collapsible, containerStyle]}
  accessibilityElementsHidden={!open}              // iOS
  importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}  // Android
>
```
Así, cerrada, todo el subárbol desaparece del foco de VoiceOver/TalkBack; al
abrir, vuelve a ser navegable. El handle sigue siendo el único elemento accesible
en estado cerrado. (Es un toggle de props sobre el `open` que ya existe — sin
lógica nueva, por eso no hay test vitest; se verifica con VoiceOver en §3.)

---

## 2. Auditoría a11y del handle (verificar; corregir solo si falla)

El handle ya trae de STORY-01: `accessibilityRole="button"`,
`accessibilityState={{ expanded: open }}`, `accessibilityLabel`,
`accessibilityHint`. Revisar y, si aplica, ajustar:

- **Dynamic Type en el handle**: `eyebrow` y `summary` van con `numberOfLines={1}`.
  A tamaños grandes de tipo, `summary` puede truncar y el chevron desalinearse.
  Añadir `maxFontSizeMultiplier` coherente con el resto de la app (HomeHero usa
  1.4-1.6; para un handle compacto, `eyebrow` cap ~1.4, `summary` cap ~1.5) y
  verificar que la fila crece en alto sin romper (chevron centrado, sin solape).
  El handle no debe fijar altura rígida — su `paddingVertical` debe dejar crecer.
- **Etiqueta**: hoy VoiceOver lee `"<eyebrow>. <summary>"` + "botón" +
  "contraído/expandido". Es correcto. Opcional (solo si en la escucha suena
  ambiguo): anteponer contexto de "carpeta"/"más" al label. NO crear un helper
  puro para un concat de strings (sería sobre-ingeniería); si se hace, inline.
- **Chevron**: decorativo dentro de `Animated.View` sin label → correcto (no
  añadir label; el botón porta el significado). Confirmar que no es foco propio.

## 3. Auditoría de los filetes/secciones (STORY-04)

- Los `divider` (STORY-04) son `View` decorativos con `pointerEvents="none"`;
  confirmar que **no** capturan foco de VoiceOver (Views sin texto normalmente no
  son foco; si alguno lo fuera, `importantForAccessibility="no"` /
  `accessibilityElementsHidden`).
- Confirmar que el **orden de lectura** al abrir es el visual esperado: handle →
  Calendario → Estado → Semana → Señal (cuando hay señal).

---

## 4. Criterios de aceptación (verificación manual precisa)

Simulador con el Metro de Álvaro ya corriendo — NO reiniciarlo. Activar VoiceOver
(Ajustes → Accesibilidad → VoiceOver) y probar en iPhone 12 Pro:

1. **Carpeta cerrada**: al deslizar el foco de VoiceOver por Home, tras la DayCard
   el siguiente y ÚLTIMO elemento accesible de la zona es el **handle** ("… ,
   botón, contraído"). VoiceOver **NO** entra en calendario/estado/semana/señal
   (el fix §1). Antes del fix, sí entraba → confirmar el antes/después.
2. **Abrir con VoiceOver**: activar el handle lo anuncia "expandido"; a partir de
   ahí el foco recorre Calendario → Estado → Semana → Señal en orden.
3. **Cerrar**: vuelve a "contraído" y el contenido desaparece del foco.
4. **Dynamic Type** (Ajustes → Accesibilidad → Tamaño de texto, al máximo, y
   texto más grande AX): el handle crece sin romper (chevron alineado, sin solape,
   summary trunca con elipsis limpia); HomeHero compacto/full y la DayCard siguen
   legibles.
5. **Reduce-motion ON**: abrir/cerrar y el restore de arranque son instantáneos
   (sin animación); estados finales correctos.
6. `npm run typecheck` limpio; `npm test` verde (baseline — **sin tests nuevos**).

---

## 5. Checklist de regresión del sprint de Home (STORY-01..04) — gate de cierre

Recorrer a mano y marcar (sin VoiceOver, uso normal):

- [ ] Home abre con **HomeHero + DayCard visibles sin scroll** (sesión asignada).
- [ ] HomeHero **compacto** con sesión hoy / **full** en día vacío/primer uso.
- [ ] Handle muestra el **teaser** correcto por estado (Esta semana · N / Tu
      estado · … / Más · …).
- [ ] Abrir/cerrar la carpeta: altura crece suave, contenido "rise", chevron rota
      (~240ms); reduce-motion instantáneo.
- [ ] **Memoria**: recargar la app conserva abierto/cerrado; **no-flash** en frío.
- [ ] **Smart-default**: usuario sin toque previo → abierta en día sin plan,
      cerrada con sesión lista.
- [ ] Carpeta abierta se lee como **un contenedor** (superficie warm continua,
      filetes entre secciones, mismo inset, sin tarjetas sueltas).
- [ ] Estado cerrado: **sin filete colgando** bajo el handle.
- [ ] Señal ausente → **no** hay sección vacía con filete (el `{signal ? … : null}`
      del developer en STORY-04).
- [ ] Seleccionar día en el calendario hace **scroll a la DayCard** arriba.
- [ ] Sheets (Assign/Move/Change/Recurrence/Template) y barra Kai OK; padding
      inferior despeja la barra flotante.
- [ ] Gold sigue reservado a Kai en toda la pantalla.

Cualquier fallo del checklist se corrige en este mismo ciclo (es el gate de
cierre de Home) antes de dar el sprint por terminado.

---

## 6. Entregable de cierre

- El fix §1 aplicado y verificado (antes/después con VoiceOver).
- Ajustes §2 si la auditoría los pidió.
- Snapshot del diff + una nota breve de resultado de auditoría/regresión en
  `docs/autopilot-homeux/snapshots/` (sin commit).
- Con esto, **Home queda cerrado con llave**. El siguiente frente (Blocks
  app-folders, STORY-05/06) queda listo en el backlog pero **pendiente de decisión
  explícita de Álvaro** — no arrancarlo autónomamente.

## 7. Por qué NO hay tests vitest
Todo el trabajo es props de accesibilidad (toggle sobre `open`), verificación
sensorial (VoiceOver/Dynamic Type/reduce-motion) y regresión manual — nada
extraíble a una función pura. Forzar un test sería artificial (regla de la
misión). Los tests puros del sprint ya viven en `foldSummary`/`heroMode`/
`folderState`.
