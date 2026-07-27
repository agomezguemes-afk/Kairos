# STORY-04 — La carpeta abierta se lee como UN contenedor `[Home]`

**Estado**: LISTA PARA IMPLEMENTAR (developer). ~60-75 min. **Puro layout — sin
lógica extraíble, sin tests vitest** (AC = verificación visual precisa).
**Depende de**: STORY-01 + STORY-03 (HomeFolder ya con memoria + smart default +
guard de hidratación; ver el archivo real citado abajo).
**Restricciones**: sin deps nuevas · sin nativo/rebuild · sin store · sin
commits/git add · no tocar Metro 8081. Cierre: `npm run typecheck && npm test`
verde (baseline, no se añaden tests) + `/code-review`.

---

## 1. Objetivo

Hoy, al abrir la carpeta, sus cuatro secciones (Calendario, Estado, Semana,
Señal) **flotan como cosas sueltas apiladas** sobre el papel: cada hija dibuja su
propio chrome —`ReadinessLine` con su propia regla superior y un margen editorial
de 40px; `KaiSignal` como tarjeta warm con su radio y margen; `HomeHeroStats` con
su padding; `MonthGrid` con su padding— así que no hay lectura de "esto está
DENTRO de una caja". Esta historia hace que la carpeta abierta se lea como **un
contenedor único**: una superficie warm continua, esquinas redondeadas, y
**filetes (hairlines) entre secciones** en vez de huecos y reglas dispares. El
handle deja de ser una píldora aparte y pasa a ser la **tapa** de esa caja.

Verificado antes de escribir: las cuatro hijas se usan **solo** dentro de
`TodayPlanner` (grep: ninguna aparece en otra pantalla), así que retirarles su
chrome externo redundante es seguro y sin regresión externa.

---

## 2. Archivos EXACTOS a tocar

**EDITAR**
1. `src/features/planner/components/HomeFolder.tsx` — envolver handle + body en
   una caja warm; mapear los children a "secciones" con filetes entre ellas.
2. `src/features/planner/TodayPlanner.tsx` — (solo si hace falta) confirmar que
   los 4 children se pasan como elementos hermanos directos (ya lo están; sin
   cambio de wiring salvo que el dev prefiera envolverlos — ver §3.2).
3. `src/features/planner/components/ReadinessLine.tsx` — quitar chrome externo +
   su regla propia.
4. `src/features/planner/components/HomeHeroStats.tsx` — quitar padding externo.
5. `src/features/planner/components/KaiSignal.tsx` — quitar su tarjeta (bg/radio/
   margen) → sección a ras.
6. `src/features/planner/components/MonthGrid.tsx` — `paddingHorizontal` interno
   a 0 (el contenedor aporta el gutter).

Todos son **deltas de StyleSheet puros**, sin tocar contenido/tipografía/lógica.
No se crean componentes nuevos ni tests.

---

## 3. Diseño concreto

### 3.1 La caja (en `HomeFolder.tsx`)

Estructura nueva del `return` (el árbol de animación de STORY-01/03 se conserva
intacto — height/opacity/rise/chevron sin cambios):

```
<View style={styles.box}>            // ← NUEVO: la caja warm, marginHorizontal + radius + overflow hidden
  <Pressable ...handle...>           // la TAPA (pierde su bg/radio/margen propios)
     ...textCol + chevron...
  </Pressable>
  <Animated.View style={[styles.collapsible, containerStyle]}>   // ya existe
    <Animated.View style={contentStyle} onLayout={handleInnerLayout}>  // ya existe (mide alto)
      {sections}                     // ← children mapeados a secciones con filetes
    </Animated.View>
  </Animated.View>
</View>
```

Estilos (tokens reales de `theme/tokens`):
- `box`: `marginHorizontal: Spacing.screen.horizontal`, `marginTop: Spacing.gap.editorial`
  (los 40px de separación con la DayCard ahora viven UNA vez, en la caja — no en
  cada hija), `backgroundColor: Colors.paper.warm`, `borderRadius: Radius.lg`,
  `overflow: 'hidden'` (para que las esquinas recorten el body que crece).
  Mantener warm (no white) para NO cambiar el aspecto del estado cerrado que
  Álvaro ya está probando; el "contenedor" se lee por la superficie continua +
  esquinas + filetes, no por cambiar de material. (Alternativa `paper.raised` +
  `Shadows.subtle` para efecto "ventana que se eleva" — dejar como nota de
  diseño, NO implementar aquí; subiría el cambio del estado cerrado.)
- `handle`: quitar de STORY-01 `backgroundColor`, `borderRadius`, `marginHorizontal`,
  `marginTop` (ahora los aporta `box`). Conservar `flexDirection/alignItems/gap`
  y el `paddingVertical: Spacing.md` / `paddingHorizontal: Spacing.lg`. Conservar
  `handlePressed`.

### 3.2 Secciones + filetes (en `HomeFolder.tsx`)

`children` llega como los 4 elementos hermanos. Mapearlos para intercalar filetes
y dar padding uniforme:

```tsx
const sections = React.Children.toArray(children);
// ...
{sections.map((child, i) => (
  <View key={i} style={styles.section}>
    {i > 0 && <View style={styles.divider} pointerEvents="none" />}
    {child}
  </View>
))}
```

- `section`: `paddingHorizontal: Spacing.lg`, `paddingVertical: Spacing.lg`. Este
  es el ÚNICO gutter horizontal/vertical de cada sección (las hijas pierden el
  suyo, §3.3).
- `divider`: `height: StyleSheet.hairlineWidth`, `backgroundColor: Colors.hair.subtle`,
  `marginHorizontal: -Spacing.lg` (para que el filete **cruce todo el ancho de la
  caja** como separador de fila estilo Ajustes/Wallet, no un filete flotando con
  gutter), `marginBottom: Spacing.lg` (aire entre filete y contenido de la
  sección). Si en verificación `hair.subtle` (0.06) queda demasiado tenue sobre
  warm, subir a `Colors.hair.base` (0.10) — es el valor que usaba la regla
  original de `ReadinessLine`.

**Detalle crítico de estado cerrado**: el PRIMER filete (entre la tapa y la
primera sección) debe vivir DENTRO del `collapsible` (es decir, el `i > 0` va
dentro del map, y el map entero está dentro del `Animated.View` colapsable). Así,
con la carpeta cerrada (altura 0), **no cuelga ningún filete ni borde bajo el
handle**. La tapa cerrada se ve limpia, idéntica a hoy salvo por vivir en una
caja warm.

### 3.3 Retirar el chrome redundante de las hijas (deltas de estilo)

El objetivo: cada hija queda a ras dentro de su `section`, alineada al mismo
inset, sin dibujar su propio borde/tarjeta/margen.

- **`ReadinessLine.tsx`** (`styles.container`): quitar `marginHorizontal`,
  `marginTop: Spacing.gap.editorial`, `marginBottom`. **Borrar el nodo `rule` de
  su JSX** (el `<View style={styles.rule} />` superior) y su estilo — el filete
  de la sección lo sustituye. Conservar eyebrow + headline + figures.
- **`HomeHeroStats.tsx`** (`styles.container`): quitar `paddingHorizontal`,
  `paddingTop`, `paddingBottom` (la `section` aporta el ritmo vertical y el
  gutter). Conservar `row/cell/divider` internos (el divider vertical entre
  Sesiones|Volumen es contenido, se queda).
- **`KaiSignal.tsx`** (`styles.card`): quitar `backgroundColor`, `borderRadius`,
  `marginHorizontal`, `marginTop`, `paddingHorizontal`, `paddingVertical` → pasa
  de tarjeta a fila a ras. Conservar `flexDirection/alignItems/gap` y todo el
  contenido (dot + label + message + action). (Nota: su bg actual `bg.warm` es el
  mismo `#F4EFE5` que la caja, así que ya se fundía; esto solo formaliza que sea
  una sección plana.)
- **`MonthGrid.tsx`**: en `header`, `weekdayHeader` y `grid`, poner
  `paddingHorizontal: 0` (el gutter lo da `section`). Verificar que las celdas
  (`width: 100/7 %`) siguen llenando el ancho y que el header de mes (flechas +
  label) queda alineado al mismo inset que las demás secciones.

**Regla de reconciliación (a verificar a ojo)**: tras los deltas, las 4 secciones
deben compartir EXACTAMENTE el mismo inset izquierdo/derecho (= `section`
paddingHorizontal) y un ritmo vertical consistente. Sin dobles gutters, sin
reglas propias sobrantes, sin tarjeta anidada en Señal.

### 3.4 Animación — sin cambios

No se toca `progress`, `measured`, `containerStyle`, `contentStyle`,
`chevronStyle`, ni el efecto cold-start/hidratación de STORY-03. La medida de alto
(`handleInnerLayout`) sigue en el `Animated.View` interior, que ahora contiene las
secciones mapeadas → mide el alto total apilado igual que antes. La caja externa
no es de altura fija (envuelve su contenido), así que crece con el body sin ajuste
extra. `overflow:'hidden'` en `box` recorta las esquinas del body que crece.

---

## 4. Criterios de aceptación (verificación visual manual precisa)

Simulador con el Metro de Álvaro ya corriendo — NO reiniciarlo. Probar en iPhone
12 Pro:

1. **Cerrada**: el handle se ve como hoy (superficie warm, esquinas redondeadas,
   eyebrow + teaser + chevron), ahora como tapa de una caja. **No cuelga ningún
   filete ni borde** bajo el handle en estado cerrado.
2. **Abierta = un contenedor**: las 4 secciones (Calendario, Estado, Semana,
   Señal) se asientan sobre UNA superficie warm continua con esquinas redondeadas;
   **filetes finos** las separan; todas comparten el mismo inset izq/der; ninguna
   flota como tarjeta propia (Señal incluida); sin dobles gutters.
3. La sección Estado ya **no** dibuja su antigua regla superior propia (esa
   separación ahora es el filete del contenedor); el hueco editorial de 40px que
   había sobre Estado desaparece (esa separación vive UNA vez, encima de la caja).
4. **Animación intacta**: abrir/cerrar mantiene el crecimiento de altura + el
   "rise" del contenido + la rotación del chevron de STORY-01; la caja redondeada
   **recorta** el body que crece (sin esquinas cuadradas asomando).
5. **Reduce-motion ON**: la carpeta aparece en su estado resuelto sin animación;
   el contenedor se renderiza correcto.
6. **Memoria/smart-default (STORY-03) intactos**: recordar abierto/cerrado, la
   apertura inteligente en días sin plan y el no-flash de arranque siguen
   funcionando; el teaser del handle sigue correcto.
7. Sin regresiones: seleccionar día en el calendario sigue haciendo scroll a la
   DayCard; sheets y barra Kai OK; el padding inferior sigue despejando la barra.
8. `npm run typecheck` limpio; `npm test` verde (mismo baseline — **no se añaden
   tests**, es puro layout).

---

## 5. Por qué NO hay tests vitest

Esta historia es enteramente layout/JSX/StyleSheet: no introduce ninguna decisión
pura ni transformación de datos extraíble (a diferencia de `foldSummary`,
`heroMode`, `folderState`). Forzar un test sería artificial. Se declara
explícitamente y la correctitud se cubre con la verificación visual §4 (regla de
la misión: layout sin lógica → AC visual preciso, no tests de relleno).

---

## 6. Riesgo / duración

**Riesgo lógico: bajo** (cero lógica, cero store, cero deps, cero nativo). Toca 5-6
archivos pero todos son deltas de estilo en componentes **solo-carpeta**, sin
consumidores externos. El único punto que exige ojo es la **reconciliación de
padding** (§3.3, que las 4 secciones alineen a un mismo inset) y el **detalle del
primer filete dentro del colapsable** (§3.2, para que cerrado quede limpio).
Estimación ~60-75 min incluyendo verificación visual. Orden seguro de trabajo:
(1) caja + secciones + filetes en `HomeFolder`, verificar apertura; (2) retirar
chrome hija por hija, re-verificando alineación tras cada una — así cualquier
desalineación se aísla al archivo que la causó.

## 7. Notas / trampas
- Gold sigue reservado a Kai: la caja es warm + ink + filetes, nada de oro.
- No convertir esto en el primitivo genérico `<Folder>` todavía — esa extracción
  es STORY-05 (cuando exista el 2º caso de uso en Blocks). Aquí, grouping inline
  en HomeFolder (tres líneas de map > abstracción prematura — CLAUDE.md).
- No añadir sombra/`paper.raised` (cambiaría el estado cerrado) salvo que el
  designer lo pida explícitamente; queda como nota de diseño en §3.1.
- Snapshot del diff en `docs/autopilot-homeux/snapshots/` al cerrar (sin commit).
