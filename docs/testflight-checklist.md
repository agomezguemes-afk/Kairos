# Kairos — TestFlight Readiness Checklist

Working punch-list for the first TestFlight build. Tick items as they
land. Anything listed under "Blockers" must be done before submission;
"Nice-to-have" items can ship in build 2.

## Blockers (must do before submission)

### Native + build

- [ ] `app.json` `version` → bump to `0.1.0`
- [ ] `ios.buildNumber` incremented for each upload
- [ ] App icon (1024×1024, no transparency, no rounded corners) in
      `assets/icon.png`
- [ ] Splash screen / launch screen renders cleanly on iPhone SE,
      iPhone 15, iPhone 15 Pro Max
- [ ] Release build runs disconnected from Metro (`xcodebuild
      -configuration Release`)
- [ ] Embedded JS bundle does not reference Expo Dev Tools
- [ ] `NSHealthShareUsageDescription` + `NSHealthUpdateUsageDescription`
      in `Info.plist` if HealthKit is wired
- [ ] If notifications ship enabled: install `expo-notifications`,
      replace adapter stubs with real calls, request permission on
      first toggle

### Functional acceptance

- [ ] Cold launch under 2s on iPhone 12 Pro
- [ ] Onboarding tour plays once and stays dismissed across relaunches
- [ ] Create a block from scratch → add 3 exercises → start workout →
      complete all sets → see summary → land in history
- [ ] Drag-reorder rows on the spine, verify order persists after
      relaunch
- [ ] Superset: add one with 2 exercises, 3 cycles → start workout →
      verify interleaving (A1, B1, A2, B2, A3, B3)
- [ ] Mark a planned session complete from DayCard → spine progress
      reflects in active workout
- [ ] Toggle notifications off/on → adapter logs cancel/schedule
- [ ] Reduced Motion ON (Settings → Accessibility) → spine pulse
      becomes static, FadeIn/LayoutTransition skip
- [ ] Dynamic Type at largest size: no clipped text in editor or
      ActiveWorkout
- [ ] VoiceOver: walk top bar → spine row → station → tile → AddStation
      → menu and back, all accessibilityLabels read

## Screenshots to capture (for App Store Connect)

iPhone 6.7" (15 Pro Max) — required:

1. **Home / Today** — empty state with onboarding tour first card
2. **Planner / Week view** — DayCard with one planned + one completed
3. **Block editor** — spine with CompoundTile + Accessory + Note + Superset
4. **Active workout** — exercise mid-session with horizontal spine
   progress + current-pulse node + set input visible
5. **Workout summary** — completion screen with PR badge
6. **Progress tab** — adherence grid + month chart

iPhone 6.5" (older max) — same six.

iPad (if shipping iPad-class build): defer to build 2.

## App Store Connect — listing draft

**Name:** Kairos · Sistema operativo de entrenamiento

**Subtitle (30c):** Tu entrenamiento, tu sistema

**Promotional text (170c):** _Bloques personalizables, supersets con
ciclos interleaved, planner semanal y un editor visual donde cada
sesión se construye como una columna vertebral de oro._

**Description draft:**

> Kairos no es una app de fitness al uso. Es un espacio personal donde
> tú decides cómo se ve tu entrenamiento.
>
> · **Editor Spine-Bento.** Cada bloque es una columna vertebral
>   vertical en oro con estaciones (ejercicios, notas, supersets,
>   divisores). Toca para configurar al detalle. Mantén pulsado para
>   reordenar.
>
> · **Sesiones con foco.** Durante el workout, la espina se vuelve
>   indicador de progreso: estaciones completadas en oro sólido, actual
>   pulsando, futuras vacías. Sin distracciones.
>
> · **Supersets reales.** Define 2-3 ejercicios y los ciclos que
>   quieres. Kairos intercala las series por ronda durante la sesión
>   (A1, B1, A2, B2…) en lugar de hacerlas en bloque.
>
> · **Planner semanal con RRULE.** Programa una vez, repite con
>   patrones (lunes/miércoles/viernes, primer lunes de mes…). La app
>   detecta huecos y te recuerda con un toque suave.
>
> · **Privacidad por diseño.** Tus datos viven en tu dispositivo. Sin
>   anuncios, sin tracking, sin servidores.

**Keywords (100c):** entrenamiento, fitness, gimnasio, planificador,
fuerza, hipertrofia, superset, ciclos

**Support URL:** https://github.com/agomezguemes-afk/kairos
(temporary — replace with public landing before public release)

**Privacy policy URL:** Markdown in `docs/privacy-policy.md` — host as
a GitHub Pages site or static page before submission.

**Category:** Health & Fitness · Secondary: Productivity

**Content rights:** I own all content used in the app.

**Age rating:** 4+ (no questionable content)

## Nice-to-have (build 2+)

- Localize listing to English
- Real iCloud / device-to-device sync
- Replace expo-notifications stub adapter with the real implementation
- AI coach (post-TestFlight per product decision)
- Apple Watch companion
- Widgets for Today screen
