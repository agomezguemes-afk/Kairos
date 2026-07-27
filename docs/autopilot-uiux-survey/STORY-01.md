# STORY-01 — ProfileTab: sistema de tokens v3/v4, tipografía de marca y affordances honestas

**Para:** Developer (kairos-uiux-designer, opus)
**Ciclo:** 1 (60-90 min). Tokens-only. **Sin nativo. Sin commits/push/git add.**
**Estado esperado:** compila (`npx tsc --noEmit`), `npm test` verde, verificado
en simulador antes de reportar done.

## Contexto

`ProfileTab` es 1 de las 4 tabs y la **única superficie activa** que sigue sobre
los shims de tokens **deprecados** (`Colors.background/text`, `Typography.size/
weight` — tokens.ts:110-152, 346-381). Consecuencia visible: **toda la pantalla
se pinta en la fuente del sistema** (los presets `Typography.*` no llevan
`fontFamily`), mientras Home, Progress y Kai encabezan con la serif de marca
Fraunces. Además arrastra 2 tarjetas muertas, un enum inglés crudo, un logout
engañoso y falta de scroll-safety. Ver evidencia completa en `BACKLOG.md`.

Objetivo: reconstruir `ProfileTab` sobre el sistema canónico (`Colors.bg/ink/
gold/hair`, `Type.*`), plegar la identidad en un **header editorial de marca**,
y dejar en pantalla **solo lo que funciona** (afordancias honestas — filosofía
wedge ya presente en el código).

## Archivos

- **Editar:** `src/screens/tabs/ProfileTab.tsx` (único archivo de pantalla).
- **Crear:** `src/screens/tabs/lib/profileIdentity.ts` (helper puro).
- **Crear:** `src/screens/tabs/lib/profileIdentity.test.ts` (vitest).
- **NO tocar:** `src/components/ImportDataSheet.tsx` (es WIP de Álvaro — solo se
  renderiza, no se edita). `src/features/conversation/KaiConversationScreen.tsx`
  (WIP, ya pulido). Nada de `src/features/blocks/*`.

## Diseño concreto (tokens.ts como única verdad)

Importar **solo** de `../../theme/tokens`:
`{ Colors, Type, Spacing, Radius, Shadows }`. Prohibido `Colors.background.*`,
`Colors.text.*`, `Colors.accent.*`, `Typography.*` (todos deprecados).

### 1. Header editorial de marca (reemplaza el título del sistema + la tarjeta de identidad)

Plegar la tarjeta de identidad (hoy líneas 39-49) dentro del header — quita una
tarjeta y una unidad de scroll (alineado con "evitar scroll para lo relevante").
El **nombre es contenido** → recibe la serif; el resto es chrome neutro.

```
Vista:
  [eyebrow]   PERFIL              → Type.eyebrow, Colors.ink.muted
  [hero]      {displayName}       → Type.title (Fraunces SemiBold 32), Colors.ink.primary
                                    fallback "Tu perfil" si displayName == null
  [subline]   {nivel} · {N} días/semana   → Type.body, Colors.ink.tertiary
                                    solo si hay dato; oculto si ambos nulos
```

- `maxFontSizeMultiplier`: 1.3 en el hero, 1.6 en la subline (patrón de Progress).
- `accessibilityRole="header"` en el bloque; el eyebrow y el hero como un solo
  nodo accesible (`accessible`) con label `"Perfil. {displayName}. {subline}"`.
- La subline sale de `profileIdentity()` (helper puro, abajo) — resuelve la
  etiqueta ES del nivel y la pluralización de días.

### 2. Tarjetas → tokens canónicos + estructura sin doble margen

Fila de tarjeta unificada (sirve para las 3 tarjetas vivas):

```
card:        backgroundColor Colors.bg.surface, borderRadius Radius.lg,
             padding Spacing.xl, marginBottom Spacing.gap.cards, ...Shadows.subtle
row:         flexDirection row, alignItems center, gap Spacing.md   ← usar GAP,
             nunca cadenas de marginLeft (arregla el doble margen)
icon:        Feather size 20, color Colors.ink.tertiary (neutro)
textCol:     flex 1 (title + sub)
cardTitle:   Type.subheading, Colors.ink.primary
cardSub:     Type.caption, Colors.ink.tertiary, marginTop 2
chevron:     SOLO en tarjetas que navegan de verdad (ver punto 3)
```

Tarjetas que **permanecen** (todas ya cableadas):
- **Notificaciones** (toggle `Switch`): conservar el wiring actual
  (`notificationsEnabled` / `setNotificationsEnabled` de workoutStore). El
  `Switch` usa `trackColor.true = Colors.gold.base`, `thumbColor
  Colors.bg.surface`, `trackColor.false = Colors.hair.base`. **Sin chevron.**
- **Importar datos** (`Pressable` → `setImportOpen(true)` + `ImportDataSheet`):
  conservar. **Con chevron** (navega a algo real → afordancia honesta).

### 3. Eliminar las dos tarjetas muertas

Borrar "Configuración" (líneas 51-60) e "Integraciones" (80-89): son `<View>`
con chevron sin `onPress`. No existen pantallas Settings/Integraciones y
construirlas es fuera de alcance (Integraciones = Apple Health, Sprint 9). En el
wedge se muestra **solo lo que funciona**. Cuando esas pantallas existan
(post-wedge) vuelven — dejar un comentario `// Config/Integraciones vuelven
cuando existan sus pantallas (post-wedge)` donde estaban.

### 4. Gold reservado

Único punto de dorado admisible: el `Switch` activo de Notificaciones
(`Colors.gold.base`), coherente con "el dorado es raro y significativo". Todos
los iconos de tarjeta van neutros (`Colors.ink.tertiary`). El icono `target`
dorado de la vieja tarjeta de identidad desaparece con ella.

### 5. Scroll-safety + safe-area

- Envolver en `ScrollView` (`showsVerticalScrollIndicator={false}`).
- `useSafeAreaInsets()`; `contentContainerStyle` con
  `paddingTop: insets.top + 16`, `paddingBottom: insets.bottom + 100`
  (holgura de la tab bar flotante). Sustituye el `Spacing.screen.top`
  hardcodeado (línea 141).
- `paddingHorizontal: Spacing.screen.horizontal`.

### 6. Logout honesto (guard por sesión + signOut real)

- Importar `useAuthStore`. `const session = useAuthStore((s) => s.session)` y
  `const signOut = useAuthStore((s) => s.signOut)`.
- El botón **"Cerrar sesión"** se renderiza **solo si `session != null`**, y su
  `onPress` llama a `signOut()` real (con confirmación `Alert` estilo iOS,
  `style: 'destructive'`). En beta (`SKIP_AUTH=true`) `session` es null → el
  botón no aparece (deja de mentir). Quitar el `// TODO: real logout` y la
  llamada a `handleReset` desde ahí.
- **"Reiniciar onboarding"** se queda como la única acción destructiva
  disponible hoy (ya cableada a `resetProfile`), sin cambios de lógica; solo
  migrar sus estilos a tokens canónicos (`Colors.ink.tertiary`, `Type.caption`).

## Helper puro + test (vitest)

`src/screens/tabs/lib/profileIdentity.ts`

```ts
import type { UserProfile } from '../../../types/profile';

export interface ProfileIdentity {
  title: string;       // displayName o fallback
  subline: string | null; // "Intermedio · 3 días/semana", o parcial, o null
}

const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
};

export function profileIdentity(profile: UserProfile): ProfileIdentity {
  const title = profile.displayName?.trim() || 'Tu perfil';
  const level = profile.fitnessLevel ? LEVEL_LABEL[profile.fitnessLevel] : null;
  const freq = profile.weeklyFrequency;
  const freqStr =
    freq != null && freq > 0
      ? `${freq} ${freq === 1 ? 'día' : 'días'}/semana`
      : null;
  const parts = [level, freqStr].filter(Boolean) as string[];
  return { title, subline: parts.length > 0 ? parts.join(' · ') : null };
}
```

> Nota: mantener el mapa de etiquetas alineado con `profile.ts:86-88`. Si el
> Developer prefiere importar la constante existente (`FITNESS_LEVELS` u
> homónima) en vez de re-declarar, mejor — evita duplicar la fuente de verdad.

`profileIdentity.test.ts` — casos (describe/it/expect de 'vitest', sin mocks):
1. displayName + nivel + freq → `{ title:'Álvaro', subline:'Intermedio · 3 días/semana' }`.
2. displayName null → `title:'Tu perfil'`.
3. `weeklyFrequency: 1` → `"1 día/semana"` (singular).
4. `weeklyFrequency: 0` o null → se omite de la subline.
5. fitnessLevel null + freq presente → subline solo con la frecuencia.
6. Ambos nulos → `subline: null`.
7. `fitnessLevel:'beginner'` → `"Principiante"` (nunca el enum crudo inglés).

## Criterios de aceptación

**Visuales (verificar en simulador):**
- [ ] El header "Perfil" / nombre se pinta en **Fraunces** (serif), no en la
      fuente del sistema. Comparar lado a lado con Progress: misma familia.
- [ ] La subline muestra el nivel en **español** ("Intermedio"), nunca
      "intermediate".
- [ ] No quedan tarjetas con chevron que no naveguen. Solo "Importar datos"
      lleva chevron.
- [ ] Único dorado en pantalla: el track del `Switch` activo. Iconos de tarjeta
      neutros.
- [ ] Con Dynamic Type grande (Ajustes → texto XXL), el contenido hace scroll y
      el último botón **no** queda tapado por la tab bar.
- [ ] En beta (SKIP_AUTH) **no** aparece "Cerrar sesión"; sí "Reiniciar
      onboarding".
- [ ] Sangría de tarjetas consistente (sin el doble margen antiguo).

**Comportamiento / a11y:**
- [ ] Toggle de Notificaciones sigue leyendo/escribiendo `notificationsEnabled`.
- [ ] "Importar datos" abre `ImportDataSheet`; cierra bien.
- [ ] "Reiniciar onboarding" mantiene el `Alert` de confirmación y `resetProfile`.
- [ ] Header con `accessibilityRole="header"` y label compuesto legible por
      VoiceOver.

**Código:**
- [ ] `ProfileTab.tsx` no importa nada de `theme/index` deprecado: cero
      `Colors.background.*`, `Colors.text.*`, `Colors.accent.*`, `Typography.*`.
      (Verificar: `grep -nE "Colors\.(background|text|accent)\.|Typography\." src/screens/tabs/ProfileTab.tsx` → 0 resultados.)
- [ ] `npx tsc --noEmit` limpio.
- [ ] `npm test` verde (incluye `profileIdentity.test.ts`).

## Fuera de alcance (no hacer)

- No construir pantallas Settings/Integraciones (solo retirar sus tarjetas
  muertas).
- No tocar `ImportDataSheet`, Kai, ni nada de `blocks/*` (WIP de Álvaro).
- No migrar AILabScreen (oculta por el wedge).
- No cambiar la lógica de `resetProfile` ni del store de notificaciones.
