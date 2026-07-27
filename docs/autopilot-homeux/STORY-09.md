# STORY-09 — Sistema de botones/interacción "Apple" (matar el "cutre") `[transversal]`

**Estado**: LISTA PARA DESPACHAR. Developer = opus. 1 ciclo (75-90 min).
**Restricciones**: sin deps · sin nativo · sin commits · no tocar Metro 8081.
Cierre: `npm run typecheck && npm test` verde + `/code-review`.

---

## 0. Causa raíz (auditada) del "se ve cutre"

- `src/Buttons/AnimatedButton.tsx` (206 líneas, YA hace scale+spring) tiene **0
  usos** en la app → código muerto, y además usa tokens **deprecados**
  (`Colors.text/accent`, `Typography.*`) y la API `Animated` de RN core (no
  Reanimated). No revivir; **retirar**.
- **34 archivos** usan el patrón más pobre: `Pressable` con solo
  `pressed && {opacity:X}` — sin scale, sin spring, sin haptic por niveles. Esa es
  la brecha entre "Apple" y "genérico".
- **Hallazgo clave (search-before-building)**: el vocabulario premium YA EXISTE en
  `src/theme/animations.ts` — `springs.press` (damping 16, stiffness 360, mass 0.6,
  literalmente "Card / button press depth"), `springs.tap` (14/420/0.5), y el mapa
  `hapticEvents`. La investigación (SwiftUI/UIKit spring, apps premium) confirma que
  el rango premium para press es **damping 15-18 / stiffness 170-360** y escala
  **0.95-0.98** → nuestros tokens `springs.press`/`springs.ios`(18/300) caen EXACTO
  ahí. **El problema no es diseñar springs nuevos; es ADOPTAR los que ya hay** vía
  un primitivo canónico, y retirar el bare-opacity.

Fuentes de calibración: [SwiftUI spring guide](https://medium.com/codetodeploy/understanding-spring-animation-in-swiftui-2026-edition-the-complete-guide-to-physics-based-4835b7c2b095) · [GetStream spring params](https://github.com/GetStream/swiftui-spring-animations) · touch-psychology.md §5/§8 (haptics + premium feel: respuesta <50ms).

---

## 1. Objetivo

Un primitivo canónico `PressableScale` (Reanimated + tokens actuales) que dé a
CADA toque el feedback premium: escala con spring en press-in, retorno con spring,
respuesta <50ms, y **haptic por nivel de significancia**. Migrar las 5-8
superficies de mayor tráfico ahora; dejar plan claro para el resto. Retirar
`AnimatedButton`.

---

## 2. Archivos EXACTOS a tocar

**NUEVO**
1. `src/components/PressableScale.tsx` — el primitivo canónico.

**BORRAR**
2. `src/Buttons/AnimatedButton.tsx` (0 importadores — confirmado por grep; typecheck
   lo revalida).

**EDITAR — adopción prioritaria (5-8 superficies de mayor tráfico)**:
3. `src/features/planner/components/DayCard.tsx` — `PrimaryCTA` (Empezar/Reanudar)
   + `ctaGhost`: envolver en PressableScale (haptic 'medium', la acción clave del día).
4. `src/features/planner/components/FirstWorkoutCTA.tsx` — el CTA de activación
   (haptic 'medium').
5. `src/components/KairosTabBar.tsx` — los items de tab (haptic 'light'/'selection'
   por switch; ya hay animación de icono — coexistir, no romper).
6. `src/components/workout/RestScoreboard.tsx` (o donde viva el botón **HECHO** del
   marcador) — el toque más frecuente in-session. **SOLO cosmético**: envolver el
   Pressable existente en PressableScale (haptic 'medium'), **sin tocar la lógica
   de sesión/completar set** (Modo Sesión está pulido — no cambiar comportamiento).
7. `src/components/BlockCreationSheet.tsx` — botón crear (haptic 'success' al crear).
8. `src/features/blocks/BlocksScreen.tsx` — botones del empty-state (welcome) y, si
   procede, alinear el FAB (que ya usa `springs.tap` — dejarlo o pasarlo al
   primitivo por consistencia, sin regresión).

(Si el tiempo aprieta, priorizar 3-5-6-4 en ese orden: Home CTA, tab bar, HECHO,
activación.)

---

## 3. Diseño de `PressableScale.tsx`

```tsx
import React, { useCallback } from 'react';
import { Pressable, StyleProp, ViewStyle, PressableProps } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { springs } from '../theme/animations';

type HapticLevel = 'none' | 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

interface PressableScaleProps extends Pick<PressableProps,
  'onPress' | 'onLongPress' | 'disabled' | 'hitSlop' |
  'accessibilityRole' | 'accessibilityLabel' | 'accessibilityHint' | 'accessibilityState'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Escala en press-in. Default 0.96 (rango premium 0.95-0.98). */
  scaleTo?: number;
  /** Significancia de la acción → intensidad háptica. Default 'light'. */
  haptic?: HapticLevel;
}

function fireHaptic(level: HapticLevel) {
  switch (level) {
    case 'none': return;
    case 'selection': return void Haptics.selectionAsync().catch(() => {});
    case 'light': return void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    case 'medium': return void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    case 'heavy': return void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    case 'success': return void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    case 'warning': return void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    case 'error': return void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }
}

export default function PressableScale({
  children, style, scaleTo = 0.96, haptic = 'light', disabled, ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const onPressIn = useCallback(() => {
    if (disabled) return;
    // Háptico en press-IN → respuesta táctil <50ms (touch-psychology §3/§8).
    fireHaptic(haptic);
    if (!reduceMotion) scale.value = withSpring(scaleTo, springs.press);
  }, [disabled, haptic, reduceMotion, scale, scaleTo]);

  const onPressOut = useCallback(() => {
    if (!reduceMotion) scale.value = withSpring(1, springs.press);
  }, [reduceMotion, scale]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} disabled={disabled} {...rest}>
      <Animated.View style={[style, animStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
```

Decisiones y por qué:
- **`springs.press`** (16/360) para press-in y retorno — es el token "button press
  depth" existente, dentro del rango premium confirmado por la investigación. NO
  inventar valores nuevos.
- **Escala 0.96** default (rango 0.95-0.98 de touch-psychology §3); override por
  prop para superficies que quieran más/menos.
- **Háptico en press-in** (no en press): la respuesta táctil instantánea es lo que
  se siente "Apple"; el mapa de nivel sigue la tabla de significancia de
  touch-psychology §5 (selection/light/medium/heavy/success…).
- **reduce-motion**: se salta la escala (sin animación); el háptico se mantiene
  (no es movimiento). Accesible.
- **Touch target**: el primitivo no fuerza tamaño — cada call site debe garantizar
  ≥44pt (HIG); donde el visual sea menor, añadir `hitSlop`.
- **A11y passthrough**: role/label/hint/state se pasan al Pressable; el consumidor
  los aporta (no se pierden respecto al Pressable que reemplaza).

---

## 4. Plan de adopción (sin migrar los 34 de golpe)

- **AHORA** (este ciclo): las 5-8 de §2 — máximo tráfico/visibilidad.
- **Después** (backlog, STORY-10 o siguiente): migrar el resto por tráfico.
  Comando para el inventario:
  `grep -rn "pressed && {" src --include=*.tsx | grep -i opacity` → lista de
  candidatos; priorizar CTAs y acciones de lista sobre chrome pasivo.
- Regla de nivel háptico al migrar: navegar/seleccionar → 'light'/'selection';
  acción estándar → 'medium'; completar/crear → 'success'; destructivo →
  'heavy'/'warning'. No poner háptico en toques pasivos (evitar fatiga háptica,
  touch-psychology §5).

---

## 5. Criterios de aceptación (verificación visual + háptica)

Simulador/dispositivo con Metro corriendo — NO reiniciarlo (el háptico solo se
siente de verdad en dispositivo físico; en simulador verificar la escala/spring y
que no crashea):

1. Los CTAs migrados (Empezar de Home, HECHO del marcador, tab bar, crear bloque)
   **se hunden con spring** al tocarlos y vuelven con spring — respuesta inmediata,
   sin el salto de opacidad plano anterior.
2. En dispositivo: cada uno dispara el háptico del nivel correcto (medium en
   Empezar/HECHO, success al crear, light/selection en tabs).
3. **reduce-motion ON**: sin escala, pero el toque sigue registrando y (en
   dispositivo) el háptico se mantiene; nada crashea.
4. Touch targets de los migrados ≥44pt (o hitSlop que lo garantice).
5. `AnimatedButton.tsx` borrado; `npm run typecheck` limpio (0 imports colgando).
6. Sin regresiones: DayCard/FirstWorkoutCTA/tab bar/HECHO/creación siguen
   navegando/actuando igual (el cambio es solo feedback, **no comportamiento** —
   crítico en el marcador de sesión).
7. `npm test` verde (baseline; PressableScale no añade tests — §6).

## 6. Tests
`PressableScale` es puramente Reanimated + expo-haptics (efectos nativos), sin
lógica de datos extraíble → **sin tests vitest** (forzarlos sería artificial; regla
de la misión). AC = verificación visual/háptica §5. El mapa `fireHaptic` es un
switch fino sobre expo-haptics, no unit-testeable con sentido.

## 7. Riesgo / duración
**Bajo-medio**: el primitivo es ~50 líneas sobre tokens existentes; las migraciones
son envolturas mecánicas (Pressable→PressableScale conservando estilos/handlers).
El único cuidado real: en `RestScoreboard` (marcador), envolver **sin** tocar la
lógica de completar set. ~75-90 min. Snapshot en
`docs/autopilot-homeux/snapshots/`.
