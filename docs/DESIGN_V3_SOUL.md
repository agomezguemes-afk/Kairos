# Kairos Design v3 — El Alma (2026-07-14)

> **El problema, en una frase:** el alma del Manuscrito está encarcelada en el onboarding.
> Fuera de `src/features/onboarding/premium/`, Kairos es una app de React Native por defecto
> con una fuente bonita encima. Este documento no reemplaza el Manuscrito: lo **libera**.

---

## 1. Diagnóstico honesto

Ocho razones, cada una anclada a código real. No son opiniones: son grep.

**D1 — El papel cálido no existe fuera del onboarding.**
`tokens.ts:14` define `bg.void: '#FFFFFF'` — *blanco puro*. Y `AmbientBackground.tsx` (el degradado
cálido + halo dorado que da cuerpo al Manuscrito) tiene **cero usos** fuera de `premium/`. El lienzo
de la app real (`ProgressTab.tsx:275`, `screen: { backgroundColor: Colors.bg.void }`, y 20 archivos
más) es blanco de laboratorio. El papel cálido `#F5F0E8` existe como token… pero solo como *relleno
de tarjeta*. Está exactamente al revés.

**D2 — Los grises son los grises de Tailwind. Literalmente.**
`tokens.ts:23-24`: `ink.tertiary: '#6B7280'` e `ink.muted: '#9CA3AF'` son `gray-500` y `gray-400` del
tema por defecto de Tailwind, verbatim. Son grises **fríos** (matiz ~220°, azulados) sobre una marca
cálida. Se usan en **75 de 160** archivos `.tsx`. Este es *el* tell definitivo de "hecho por IA": la
paleta por defecto se filtró dentro de la marca y nadie la echó.

**D3 — Compramos la fuente con más carácter del mundo y enviamos su instancia más sosa.**
`assets/fonts/` contiene `Fraunces_400Regular.ttf`, `Fraunces_900Black.ttf`… — las estáticas por
defecto de Google Fonts. Fraunces es una **fuente variable con 4 ejes**: `wght`, `opsz`, **`SOFT`**
(cuánta tinta "moja" el trazo) y **`WONK`** (las formas torcidas, deliciosas, imperfectas).
Enviamos SOFT=0, WONK=0 y una `opsz` baja. Es decir: **apagamos toda la personalidad y nos quedamos
con una serif genérica**. ([Fraunces / Undercase Type](https://fraunces.undercase.xyz/),
[Google Design](https://design.google/library/a-new-take-on-old-style-typeface))

**D4 — Tres sets de iconos de stock, mezclados.**
181 usos de `Feather`, 94 de `MaterialCommunityIcons`, 72 de `Ionicons`. No es que no tengamos voz:
es que tenemos **tres voces prestadas discutiendo entre sí**. En `v4_02.png` la tab bar es
literalmente cuatro iconos de sets distintos.

**D5 — Todo centrado.** 39 archivos con `textAlign: 'center'`. En `v4_02.png`: "Día sin plan"
centrado, "4 bloques disponibles" centrado, la pill centrada, el calendario centrado, los anillos
centrados. En `v3_09.png` (Modo Sesión) **todo** vive en el eje central. La simetría es de hoja de
cálculo; la asimetría es de revista. *"Equal columns are for spreadsheets, not stories."*
([Editorial grid systems](https://designmd.app/library/editorial-grid-magazine/))

**D6 — Los tres anillos de colores.** `v4_02.png`, abajo: 85 en oro, 100 en azul, 100 en verde.
Es (a) el cliché de los activity rings, (b) el patrón "fila de tres tarjetas redondeadas" que es el
tell #1 de UI generada por IA, y (c) **rompe nuestra propia regla de un oro por pantalla**.
([AI slop anti-patterns](https://smoothui.dev/blog/ai-design-slop))

**D7 — Las sombras son frías.** Los 8 presets de `Shadows` usan `shadowColor: '#1A1A2E'` — negro
azulado. El papel real proyecta sombra **cálida**. Una sombra azul sobre un lienzo cálido es
precisamente lo que hace que algo "parezca digital".

**D8 — Tarjeta blanca sobre lienzo blanco → borde obligatorio.**
Como el lienzo es `#FFFFFF` y la tarjeta es `#FFFFFF`, la tarjeta *solo puede existir* si le pones un
borde de 1px (`hair.base`) y una sombra. De ahí el look "todas las cards con su bordecito gris" —
que es, otra vez, el tell canónico de AI slop. **La causa raíz es un token, no una decisión de
diseño.**

---

## 2. La tesis del alma

**Kairos es un cuaderno de entrenamiento, no un dashboard.** Papel cálido con grano, tinta prensada
que se hunde en la fibra, una serif con carácter (blanda, ligeramente torcida, viva) haciendo el
trabajo pesado, filetes finísimos en vez de bordes de tarjeta, y el oro como *una sola* marca de
atención por página — la firma de Kai. Nada está centrado salvo lo que exige el gimnasio. Los
números son tabulares y grandes porque el peso que levantaste **es** el contenido. El movimiento
tiene el peso del papel: entra con un solo rebote suave y se posa, nunca salta. La app debería
sentirse como abrir un diario caro que llevas usando dos años — cálido, gastado, tuyo — y no como
abrir una herramienta SaaS. **El Manuscrito no era el onboarding: el Manuscrito es Kairos.**

---

## 3. Los 7 movimientos

### (a) Material y textura — papel, no pantalla

**Qué.** El lienzo deja de ser blanco y pasa a ser papel cálido con grano. Las tarjetas pasan a ser
**blancas** — se *levantan* del papel en vez de esconderse en él.

**Por qué.** Invierte D8 en su origen. Si la tarjeta es blanca sobre papel cálido, existe por
**contraste de material**, no por borde. Un token elimina cientos de bordes grises.

**Cómo en RN (performante).** Grano = **un PNG de ruido de 256×256 en escala de grises**, tileado:

```tsx
// src/theme/Paper.tsx — UN nodo, en la raíz del árbol. No por tarjeta.
<Image
  source={require('../../assets/textures/grain-256.png')}
  resizeMode="repeat"                    // GPU tilea; coste por frame = 0
  style={[StyleSheet.absoluteFill, { opacity: 0.035 }]}
  pointerEvents="none"
/>
```
Descartado: `feTurbulence` de `react-native-svg` — rasteriza el filtro en cada render y se nota al
hacer scroll. El PNG tileado es una textura estática cacheada en GPU: cero coste en scroll.
([feTurbulence / Codrops](https://tympanus.net/codrops/2019/02/19/svg-filter-effects-creating-texture-with-feturbulence/),
[nnnoise generator](https://www.fffuel.co/nnnoise/) para generar el tile.)

**Tokens.**
```ts
paper: {
  base:   '#FBF9F5',  // ← EL LIENZO. Reemplaza bg.void como fondo de pantalla.
  raised: '#FFFFFF',  // ← LAS TARJETAS. Ahora sí destacan, sin borde.
  warm:   '#F4EFE5',  // zonas editoriales, bloques de cita
  deep:   '#EBE3D4',  // celebración, PR, momentos densos
  grain:  0.035,      // opacidad del tile de ruido
}
```
`bg.void` se conserva como alias deprecado → migración archivo a archivo sin romper nada.

### (b) La tipografía haciendo trabajo de verdad

**Qué.** Re-instanciar Fraunces desde la variable font y **encender SOFT y WONK**.

**Por qué.** Es la mayor ganancia de alma por euro invertido del documento. No añade un solo
componente: cambia 3 ficheros TTF y la app entera pasa de "serif de Google" a "esta fuente es de
alguien". El eje `opsz` además arregla legibilidad: a 9pt abre el tracking y sube la altura-x; a
144pt sube el contraste y aprieta. Hoy usamos una sola instancia para 11pt y para 44pt — que es
tipografía de 2005.

**Cómo.** Del repo variable de Fraunces, exportar instancias estáticas nombradas:

| Familia RN | opsz | wght | SOFT | WONK | Uso |
|---|---|---|---|---|---|
| `Fraunces-Display` | 144 | 900 | 100 | 1 | `heroDisplay`, `numHero` |
| `Fraunces-Title`   | 72  | 600 | 60  | 1 | `title`, `titleSmall`, `serifAccent` (italic) |
| `Fraunces-Text`    | 14  | 500 | 30  | 0 | citas, `numHero` pequeño |

**Tokens.**
```ts
heroDisplay: { fontFamily: 'Fraunces-Display', fontSize: 52, lineHeight: 48,  // 0.92× — apretado
               letterSpacing: -1.6 },                                          // era 44/47/-1.2
eyebrow:     { ...Type.eyebrow, fontSize: 10, letterSpacing: 2.4 },            // era 11/1.8
// numerales: fontVariant: ['tabular-nums'] YA está — extenderlo a TODO número de sesión.
// (v3_11.png: "4/4", "0/3" no son tabulares y bailan al cambiar.)
```

### (c) Tinta cálida — matar los grises

**Qué.** Borrar `#6B7280` y `#9CA3AF` del proyecto. Rampa de tinta cálida, matiz ~30°, saturación
3–8% (el rango en el que la temperatura es invisible en aislamiento pero inconfundible en superficie).
([Neutral ramps](https://colorarchive.org/guides/neutral-color-palettes/))

**Tokens.**
```ts
ink: {
  primary:   '#241F1A',  // tinta. era #1A1A2E (azul)
  secondary: '#4A4139',
  tertiary:  '#6E6357',  // ← reemplaza el gray-500 de Tailwind
  muted:     '#7D7263',  // ← reemplaza el gray-400. Subido de luminancia para mantener AA.
  faint:     '#A79C8D',  // SOLO filetes y decoración. Nunca texto.
  inverse:   '#FFFDF9',  // blanco cálido sobre tinta/oro — no #FFFFFF
}
```
**Gate obligatorio:** verificar cada par contra `paper.base` (#FBF9F5) con ≥4.5:1 antes de mergear.
`muted` es el que va justo; si no pasa, oscurecer a `#736858`, no reintroducir gris.

### (d) Asimetría y espacio negativo

**Qué.** Eliminar `textAlign: 'center'` de los 39 archivos, **con dos excepciones documentadas**:
Modo Sesión (el eje óptico es un requisito de legibilidad a 2 m) y los empty states.

**Cómo.** Rejilla editorial de 3 columnas sobre el margen de 20pt. El titular ocupa las 3; los
metadatos (fecha, duración, "4 series") van **flush-right en la columna 3**, alineados por su
baseline con la primera línea del titular. La tensión la crea el vacío, no un `space-between`.
El "Día sin plan / 4 bloques disponibles / [pill]" centrado de `v4_02.png` pasa a ser un bloque
alineado a la izquierda con el CTA colgando a la derecha.

**Tokens.** `Spacing.grid = { cols: 3, gutter: 12, margin: 20 }` + `Spacing.gap.editorial = 40`
(el aire entre bloques narrativos es el doble que entre tarjetas: 24 → 40).

### (e) Movimiento con personalidad

**Qué.** Un spring "papel" frente al spring "sistema" que usamos hoy.

**Por qué.** El modelo de WWDC23 parametriza springs por **duración + rebote**. Nuestro `ios`
(`damping: 18, stiffness: 300, mass: 0.7`) es el spring crujiente del sistema: correcto, anónimo. El
papel es **más pesado y rebota una sola vez, suave**: se *posa*.
([Animate with springs, WWDC23](https://developer.apple.com/videos/play/wwdc2023/10158/))

**Tokens.**
```ts
paper:  { damping: 17, stiffness: 170, mass: 1.0 },  // ≈ duración 0.5s, rebote 0.18. Tarjetas, sheets.
ink:    { damping: 26, stiffness: 210, mass: 0.9 },  // rebote 0. EL TEXTO NUNCA REBOTA.
settle: { damping: 30, stiffness: 140, mass: 1.2 },  // el bloque cayendo sobre la mesa
```
Regla dura: **texto = `ink` (sin rebote), materia = `paper` (un rebote)**. Hoy `celebrate`
(`damping: 9`) hace botar texto — eso es lo que lee como "app de juguete". `useReducedMotion()` ya
está cableado: se respeta sin cambios.

### (f) Detalles de artesanía

- **Filetes, no bordes.** `StyleSheet.hairlineWidth` (0.33pt en @3x) en `rgba(36,31,26,0.10)` como
  regla editorial *entre* elementos. Elimina `hair.base` como borde perimetral de tarjeta (ya no hace
  falta: (a) la resuelve).
- **Letterpress.** Sobre superficies cálidas (`paper.warm`/`deep`), los titulares en tinta llevan un
  realce claro debajo — el texto se hunde en la fibra:
  ```ts
  letterpress: { textShadowColor: 'rgba(255,253,249,0.55)',
                 textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 }
  ```
  Solo en ≥22pt (por debajo emborrona). ([técnica text-shadow](https://line25.com/tutorials/create-a-letterpress-effect-with-css-text-shadow/))
- **Sombras cálidas.** `shadowColor: '#1A1A2E'` → `'#4A3B28'` en los 8 presets. Cambio de una línea,
  efecto en toda la app.
- **Imperfección.** Radios **no uniformes**: la tarjeta de sesión a `Radius.lg`, la de Kai a
  `Radius.md`. Que no todo mida lo mismo es lo que separa "diseñado" de "generado".

### (g) Iconografía con voz

**Qué.** Tres sets → **uno**, más ~8 marcas propias.

**Cómo.** No dibujar 200 iconos (eso es un océano). Dibujar **las 8 que cargan la identidad** —
Kai, sesión, bloque, racha, PR, voz, calendario, progreso — como SVG a mano, trazo 1.75pt, terminales
ligeramente redondeados, geometría deliberadamente *no* perfecta (la misma wonkiness que WONK le da a
Fraunces). El resto del inventario: **un solo set**, Phosphor Regular, tratado como chrome neutro.
Marcas tipográficas de Fraunces (§ ¶ †) como separadores editoriales donde hoy hay iconos decorativos.

---

## 4. Antes / después por superficie

| Superficie | Antes (evidencia) | Después |
|---|---|---|
| **Home** (`v4_02.png`) | Hero Fraunces bien; debajo: bloque centrado, pill centrada, calendario stock, **3 anillos de colores**, tab bar de 3 sets de iconos. Lienzo blanco. | Papel con grano. Hero a 52pt con letterpress. "Día sin plan" **flush-left**, CTA colgando a la derecha. Anillos **fuera** (violan el un-oro-por-pantalla) → una línea de racha en tinta. Calendario reducido a filete + puntos de oro. |
| **Kai** (`v3_05.png`) | Palabras del usuario en Fraunces (¡bien!) pero envueltas en burbujas blancas redondeadas por defecto; cuerpo en gris frío; tarjeta de bloque en rosa pastel (`tint.strength`) que lee como estado de error. | Sin burbujas: las palabras del usuario son **titular sobre el papel**, la respuesta de Kai en tinta con filete de oro a la izquierda. La tarjeta de bloque en `paper.raised` con la disciplina como **filete de color de 2pt**, no como relleno pastel. |
| **Modo Sesión** (`v3_09.png`) | Centrado (correcto aquí), pero numeral "6" en Fraunces regular, gris de sistema en el cronómetro, botón pill de tinta genérico. | **Se mantiene centrado** (mandato de 2 m). Numeral a `Fraunces-Display` 96pt, tabular. Cronómetro en `ink.tertiary` cálido. Fondo `paper.base`: legible a 2 m *y* cálido — el grano no resta contraste (0.035 de opacidad ≈ 0.1% de luminancia). |
| **Progreso** (`ProgressTab.tsx`) | 12 usos de `ink.tertiary/muted` (grises Tailwind), fondo `bg.void`, badges como pastillas. | Papel. Rampa cálida. Números tabulares grandes como contenido, etiquetas en eyebrow tracked. Los badges **están tras WEDGE_MODE → no se tocan**. |

---

## 5. Qué NO hacer

1. **No añadir color para fingir calidez.** La calidez viene del *material* (papel, grano, tinta
   cálida), no de meter naranjas y terracotas. La paleta no crece.
2. **No hacer degradados de todo.** El `AmbientBackground` con halo dorado se queda **solo en el
   onboarding**. En la app, un degradado ambiental en cada pantalla es exactamente el "purple mesh
   gradient" del AI slop, con otro color.
3. **No sacrificar la legibilidad a 2 m.** Grano ≤0.04 de opacidad. Ningún texto de Modo Sesión por
   debajo de `ink.secondary`. Si un token cálido no llega a 4.5:1, se oscurece — no se aprueba.
4. **No romper la accesibilidad ya hecha.** 44pt, VoiceOver, Dynamic Type y reduce-motion están
   implementados y auditados. El letterpress es `textShadow` (no afecta a VoiceOver). El grano es
   `pointerEvents="none"` (no captura toques). Los springs nuevos pasan por `useReducedMotion()`.
5. **No tocar las superficies ocultas por `WEDGE_MODE`** (gamificación, AI Lab, `src/config/wedge.ts`).
   Rediseñar lo que nadie ve es el gold-plating perfecto.
6. **No hardcodear.** Si un movimiento pide un valor nuevo, **se añade token**. Cero hex sueltos.
7. **No dibujar 200 iconos.** Ocho marcas propias + un set. Lo demás es un océano.

---

## 6. Plan de implementación en olas

Cada ola compila, pasa gates y es shippable sola.

### Ola 1 — El material (el 70% del alma, ~1 día)
El movimiento de mayor palanca. **Solo toca `tokens.ts` + un componente nuevo.**
- Añadir `Colors.paper.*`; `bg.void` pasa a alias deprecado de `paper.base`.
- Reescribir `Colors.ink.*` a la rampa cálida (los 75 archivos que la consumen **heredan el cambio
  gratis** — no hay que tocarlos).
- `shadowColor` `#1A1A2E` → `#4A3B28` en los 8 presets.
- Nuevo `<Paper />` (grain tileado) montado una vez en el root del navegador.
- **Gate:** contraste ≥4.5:1 de cada par tinta/papel; snapshot visual de las 4 superficies.

### Ola 2 — La tipografía (el 20% restante, ~medio día)
- Re-exportar 3 TTF desde la Fraunces variable con `opsz`/`SOFT`/`WONK` encendidos.
- `Fonts` y `Type` apuntan a las nuevas familias; `heroDisplay` a 52/48/-1.6; `eyebrow` a 10/2.4.
- Añadir `Type.letterpress` y aplicarlo a titulares sobre `paper.warm`/`deep`.
- **Gate:** Dynamic Type a 200% sin desbordes; `maxFontSizeMultiplier` conservado.

### Ola 3 — Composición (~1 día)
- Purga de `textAlign: 'center'` (39 archivos → excepciones: Modo Sesión + empty states).
- Rejilla editorial: `Spacing.grid`, `gap.editorial`.
- Home: quitar los 3 anillos, hero a la izquierda, CTA a la derecha, calendario a filetes.
- Kai: fuera las burbujas; palabras del usuario como titular; bloque con filete de disciplina.
- **Gate:** 44pt táctiles intactos; VoiceOver recorre en orden de lectura.

### Ola 4 — Movimiento y artesanía (~medio día)
- `Spring.paper` / `ink` / `settle`; regla texto-no-rebota; retirar `celebrate` de texto.
- Filetes `hairlineWidth` sustituyen bordes de tarjeta; radios no uniformes.
- **Gate:** reduce-motion; 60fps en scroll de Home con grano montado.

### Ola 5 — Voz icónica (~1 día, la más cara y la menos urgente)
- Un set (Phosphor) + 8 marcas Kairos dibujadas a mano.
- Migrar 347 usos de iconos. Mecánico, no creativo. **Se puede posponer sin coste de alma.**

---

**El orden importa.** Las olas 1 y 2 son el 90% del alma y cuestan día y medio, porque el problema
no es que falte diseño: es que **tres tokens (blanco puro, gris Tailwind, Fraunces sin ejes) están
anulando el diseño que ya existe**. Arréglalos y el Manuscrito se derrama por toda la app.
