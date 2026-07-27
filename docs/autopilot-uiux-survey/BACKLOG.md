# BACKLOG — Encuesta UI/UX del resto de la app (2026-07-23, feat/night-run)

PM/Strategist. Auditadas las pantallas del árbol de navegación **NO tocadas**
esta sesión (Home/Blocks y Modo Sesión quedan fuera: ya cerrados). Regla dura de
la misión: **cero relleno** — solo entra lo que tiene evidencia de código.

## Alcance auditado (con veredicto honesto)

| Pantalla | Ruta | Alcanzable en beta (WEDGE_MODE) | Veredicto |
|---|---|---|---|
| **ProfileTab** | tab #4 | Sí | **Deuda real — 6 defectos verificables → STORY-01** |
| ProgressTab | tab #3 | Sí | Sano. Tokens canónicos, héroe Fraunces, sparklines, adherencia, gamificación wedge-gated. Sin historia. |
| KaiConversationScreen | `KaiToday` | Sí (WIP de Álvaro) | Pulido. Tokens canónicos, reduce-motion, anuncios VoiceOver, targets 44pt, un solo dorado. **No tocar** (WIP). |
| PremiumOnboardingScreen | `Onboarding` | Sí | Adaptador fino sobre `PremiumOnboarding` (feature premium madura, "El Manuscrito"). Fuera de una historia de 60-90 min. |
| BlockEditorScreen | `BlockDetail` | Sí | **Deuda de tokens real pero diferida** (ver ítem B). |
| AILabScreen | `AILabScreen` | **No** — `isSurfaceVisible('aiLab')` corta el único wire (TodayPlanner:172) | Usa tokens deprecados, pero está **oculta por el wedge**. Pulirla sería relleno. Fuera de alcance. |

**Cifra honesta:** en superficies **activas** no tocadas, los problemas reales se
concentran en **1 pantalla (ProfileTab, 6 defectos)** → 1 historia lista ahora
(STORY-01). Más **1 ítem de deuda diferido** (BlockEditor) que **no** se convierte
en historia todavía (tamaño + colisión con el WIP de Álvaro). Todo lo demás está
genuinamente bien o correctamente fuera del wedge.

---

## STORY-01 — ProfileTab al sistema v3/v4: tipografía de marca + affordances honestas

**Prioridad: ALTA.** Es 1 de las 4 tabs (tráfico permanente) y es la **única
superficie activa que sigue enteramente sobre los shims de tokens deprecados**.
`ProfileTab.tsx` está limpio en git (no es WIP de Álvaro) → seguro de tocar.

Evidencia (todo en `src/screens/tabs/ProfileTab.tsx`):

1. **Toda la pantalla en fuente del sistema, no la de marca.** Importa de
   `../../theme/index` y usa `Typography.size.*` / `Typography.weight.*`
   (tokens.ts:346-381, marcados `@deprecated`). Esos presets **no llevan
   `fontFamily`** → todo el texto se pinta en San Francisco del sistema, no en
   Plus Jakarta Sans ni Fraunces. El título "Perfil" (línea 143-148) es un
   `bold 28` del sistema, mientras Home (HomeHero, Fraunces display), Progress
   (`Type.numHero` Fraunces) y Kai (`Type.title` Fraunces) **todos** encabezan
   con la serif de marca. Profile parece de otra app, más vieja.
2. **Dos tarjetas muertas.** "Configuración" (línea 51-60) e "Integraciones"
   (línea 80-89) son `<View>` con `chevron-right` — afordan navegación — pero
   **sin `onPress`**. El chevron promete, el tap no hace nada. Afordancia
   deshonesta (viola "editing feels fluid" / minimalismo premium del CLAUDE.md).
3. **Enum inglés crudo en UI español.** Línea 45: `profile.fitnessLevel ?? '—'`
   pinta el valor crudo `'beginner'|'intermediate'|'advanced'` (profile.ts:6) en
   una UI en castellano. Ya existe el mapa de etiquetas ES en
   `profile.ts:86-88` (`Principiante/Intermedio/Avanzado`) — no se usa aquí.
4. **Sin scroll ni holgura de tab-bar.** Es un `<View>` plano (línea 35), no
   `ScrollView`. Con Dynamic Type grande el contenido se recorta, y el botón
   "Cerrar sesión" del fondo cae bajo la tab bar flotante (absolute, ~88px) sin
   `paddingBottom` que lo compense. Progress y AILab sí usan el patrón
   `insets.bottom + 100`.
5. **Logout engañoso y duplicado.** "Cerrar sesión" (línea 122-131) tiene un
   `// TODO: real logout` y **llama a `handleReset`** — exactamente lo mismo que
   "Reiniciar onboarding", y de forma destructiva. Hay `signOut()` real en
   `useAuthStore` (useAuthStore.ts:87,155). En beta `SKIP_AUTH=true` → no hay
   sesión real, así que hoy el botón miente dos veces (ni cierra sesión, ni es
   distinto del reset).
6. **Doble margen estructural.** `cardContent` lleva `marginLeft: Spacing.md`
   (línea 160) y `cardTitle` **otra vez** `marginLeft: Spacing.md` (línea 168);
   las tarjetas sin `cardContent` (Config/Integr.) montan el título distinto →
   sangrías inconsistentes entre tarjetas.

Entregable: STORY-01.md. Tokens-only, sin nativo, un solo archivo de pantalla +
un helper puro con test vitest.

---

## Ítem B (DIFERIDO — no es historia ahora) — BlockEditorScreen: deuda de tokens

`src/features/blocks/BlockEditorScreen.tsx` (1240 líneas) importa **a la vez**
`Typography, Type` de `../../theme/index` y mezcla canónico con deprecado
(21 usos de `Colors.text.` / `Colors.background.` / `Typography.size.` /
`Colors.accent.`). Migración parcial → inconsistencia tipográfica interna.

**Por qué NO se convierte en historia ahora (honesto):**
- **Tamaño:** 1240 líneas; migrar y re-verificar visualmente excede un ciclo de
  60-90 min — sería >1 historia.
- **Colisión con WIP:** el editor de bloques es el corazón del trabajo activo de
  Álvaro (todo `src/features/blocks/*` aparece modificado en git status). Tocar
  su token layer ahora arriesga conflictos con su rama de diseño en curso.

Recomendación: retomar tras el merge del WIP de bloques, con snapshot de
referencia antes/después. Prioridad BAJA hasta entonces.

---

## Qué hacer con el resto del ciclo

1. Ejecutar **STORY-01** con el Developer (kairos-uiux-designer, opus).
2. **No** abrir historias de relleno para Progress / Kai / onboarding / AILab:
   están bien o fuera del wedge. Decirlo es la respuesta honesta.
3. Ítem B queda anotado y **parqueado** hasta que baje el WIP de bloques.
