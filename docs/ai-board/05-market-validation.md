# Validación de Mercado con Ingresos Reales — Kairos

> Documento 05 de la Directiva de IA · Analista de Validación de Mercado · 2026-07-08
> Fuentes primarias: TrustMRR (MRR verificado vía Stripe/RevenueCat), Acquire.com (marketplace),
> Flippa, RevenueCat, Indie Hackers, reviews públicas. Complementa 02-market-analysis.md
> (wedge: atleta autodirigido/híbrido) y 03-commercial-strategy.md (ancla 39,99 €/año).
> Nota metodológica: los listados individuales de Acquire.com están tras login (anónimos por
> diseño); las señales de "empresa en venta" se cubren con el marketplace de TrustMRR (misma
> función, datos verificados y públicos) + fuentes secundarias. Donde el dato no es verificado,
> se marca como *no verificado*.

---

## 1. Señales de ingresos reales

Lo que factura HOY a nivel indie/bootstrap en fitness/health, con revenue verificado:

### 1.1 Categoría Health & Fitness en TrustMRR (verificado Stripe/RevenueCat)

| Producto | MRR verificado | Qué vende | ¿En venta? | Fuente |
|---|---|---|---|---|
| **Stealth Venture** (fitness iOS) | **$79.951** (rev. 30d: $125.883, 14.295 subs) | "Health and Wellness fitness app for iOS", SwiftUI + RevenueCat | Sí — $3M (2.0x, rebajado de $4M), 20 ofertas | [trustmrr.com/startup/stealth-venture-15](https://trustmrr.com/startup/stealth-venture-15) |
| **CalBuddy** | **$65.469** (42% MoM, "low churn") | Tracking de calorías/salud con IA | No | [trustmrr.com/open](https://trustmrr.com/open) |
| **GoTall** | **$56.346** (15.983 subs; $754k all-time desde jul-2025) | "Track your height journey, predict your adult height" — app de altura para adolescentes; Superwall + ads Meta/TikTok | Sí — $1M (1.5x) | [trustmrr.com/startup/gotall](https://trustmrr.com/startup/gotall) |
| **Hyrox Fitness App** | **$28.750** (rev. 30d: $32.332, **1.584 subs → ~$18/mes ARPU**) | App IA de entrenamiento para HYROX (carrera fitness híbrida) | Sí — **$3,8M (9.8x)**, 6 ofertas, 974 vistas | [trustmrr.com/startup/hyrox-fitness-app](https://trustmrr.com/startup/hyrox-fitness-app) |
| **GlowUp** | $14.000 | Wellness/estética | No | [trustmrr.com/open](https://trustmrr.com/open) |
| **3AK Track & Field** | $10.000 | Entrenamiento de atletismo con corrección de técnica | Sí | [trustmrr.com/category/health-fitness](https://trustmrr.com/category/health-fitness) |
| **FitCal** | $7.000 | Calorías/nutrición con IA | Sí | ídem |
| **athletedata.health** | $5.400 | "Proactive AI endurance coach connecting fitness apps for personalized coaching" | No | ídem |
| **Steps & Beasts** | $2.300 | Step tracker gamificado (coleccionables) | No | ídem |
| **Sleep/recovery app** (private) | $2.200 | Tracking de sueño y recuperación | Sí | ídem |
| **Freedive & Apnea Training** | $1.800 | Entrenamiento de respiración para apneístas | Sí | ídem |
| **Overlo** | $1.100 | "AI fitness app" genérica | Sí | ídem |

### 1.2 Referencias fuera de TrustMRR (contexto, distinto grado de verificación)

| Producto | Ingresos | Nota | Fuente |
|---|---|---|---|
| **GymStreak** | ~$208k MRR (*no verificado*, reportado en Indie Hackers) | Planner IA indie, 4.7★ App Store, "best-looking, smoothest workout planner" | [indiehackers.com](https://www.indiehackers.com/post/gym-streak-review-2026-my-honest-take-on-gymstreak-app-359b48d0e3) |
| **Cal AI** | $35M año 1 (*reportado*) | Foto → calorías; funnel quiz+paywall (ya analizado en doc 03) | [getlatka.com](https://getlatka.com/blog/how-cal-ai-achieved-35-million-revenue-in-just-one-year/) |
| **Habit Pixel** | $1k MRR en 8 meses, solo dev | Habit tracker bootstrapped | [indiehackers.com](https://www.indiehackers.com/post/from-0-to-1k-mrr-in-8-months-bootstrapping-habit-pixel-as-a-solo-dev-684b6c056d) |
| **HyRhythm** | n/d | Tracker HYROX indie para Apple Watch, elogiado por "ease of use and clean design" — el nicho premia el diseño | [apps.apple.com](https://apps.apple.com/us/app/hyrhythm-hyrox-tracker/id6749797434) |

### 1.3 Lecturas transversales

1. **El dinero indie verificado está en (a) nutrición-IA y (b) nichos de disciplina con identidad fuerte.** CalBuddy/FitCal/Cal AI validan (a) — fuera de nuestro wedge. Hyrox/3AK/athletedata/freedive validan (b) — **exactamente nuestro wedge híbrido/multidisciplina**.
2. **El ARPU del nicho apasionado dobla al del tracker generalista.** Hyrox App: ~$18/mes con solo 1.584 suscriptores. Hevy cobra $2.99/mes. El atleta híbrido con identidad ("hago HYROX") paga 6x más que el "voy al gym". Nuestro ancla de 39,99 €/año está en la banda conservadora; el techo real del segmento es más alto.
3. **No hace falta escala para facturar.** $10k MRR con una app de atletismo de nicho; $5.4k con un coach IA de endurance. Con 1.500-2.000 suscriptores anuales a 39,99 € Kairos estaría en la banda de los top indie verificados de la categoría.
4. **Features mínimas que les bastan**: logging del nicho + plan generado + paywall bien colocado. Ninguno tiene canvas, campos dinámicos ni import de historial. Facturan con MENOS producto del que Kairos ya tiene construido.

---

## 2. Fracasos instructivos (marketplace: qué se vende, a qué múltiplo y por qué)

Los listados individuales de Acquire.com son anónimos y requieren login; el marketplace de TrustMRR (público y verificado) y los datos de compradores de RevenueCat dan la misma señal:

| Caso | Señal | Lección para Kairos |
|---|---|---|
| **Stealth Venture** ($80k MRR) se vende a **2.0x**, rebajado de $4M a $3M pese a 20 ofertas | Revenue alto pero múltiplo de derribo → típico de apps alimentadas con paid ads (UA comprada) y retención mediocre: el comprador descuenta el churn | Revenue comprado con ads vale poco; retención orgánica vale todo. Refuerza P0 del doc 02 (loop de 14 días) |
| **GoTall** ($56k MRR) se vende a **1.5x**; razón: "moving on to another app and cofounders separating" | App-noveldad monetizada con Superwall + TikTok ads: imprime dinero pero el propio fundador no le ve futuro — es un funnel, no un producto | El patrón "quiz+paywall agresivo" genera caja pero no negocio duradero. Copiar el funnel (doc 03), no el producto |
| **Hyrox Fitness App** pide **9.8x** ($3,8M) y aún así recibe 6 ofertas | El múltiplo 5-6 veces superior al de las apps genéricas lo paga la **comunidad nicho orgánica y apasionada** | El moat no es el código: es poseer un segmento con identidad. El atleta híbrido ES ese segmento |
| **Overlo, FitCal, sleep app, freedive app** — todo el escalón $1-7k MRR de "AI fitness" está en venta simultáneamente | Saturación de wrappers de IA genéricos sin moat de datos: llegan a $2-7k MRR y se estancan → sus fundadores salen | "AI fitness app" genérica ya no es diferenciación. El moat de Kairos debe ser el modelo de datos (campos dinámicos + historial importado), no "tiene IA" |
| Compradores 2026 (RevenueCat): base **3-5x EBITDA** solo con 2+ años y 4+ meses de retención de suscriptores; matan deals por "weak retention relative to category benchmarks" y financials sucios | La retención es EL activo; todo lo demás se descuenta | Instrumentación de retención desde build 1 (D1 del doc 03) no es analytics: es valor de empresa |
| Flippa fitness: 5.289 listados pero sin apps de calidad visibles | La larga cola de fitness apps muertas se liquida a precio de saldo | Lanzar "otra fitness app" sin wedge = destino Flippa |

**Síntesis**: el mercado de salida paga múltiplos de derribo (1.5-2x) por revenue comprado y sin retención, y múltiplos premium (~10x) por nichos orgánicos apasionados. La estrategia Kairos (wedge híbrido + activación 14 días + boca-a-boca) construye exactamente el activo que el mercado paga caro.

---

## 3. Black holes identificados

Huecos donde hay facturación evidenciada A PESAR de producto mediocre, ordenados por (facturación evidenciada ÷ esfuerzo de Kairos para superarlo):

### BH#1 — El atleta híbrido/HYROX paga premium a herramientas primitivas ⭐ ranking 1

- **Facturación evidenciada**: Hyrox App $28.7k MRR verificado a ~$18/mes ARPU ([trustmrr](https://trustmrr.com/startup/hyrox-fitness-app)); HYBRD financiada por YC (doc 02); athletedata.health $5.4k MRR conectando apps porque ninguna cubre el caso completo.
- **La mediocridad**: el propio nicho documenta que su método de registro sigue siendo **Notas vs spreadsheet vs app** ([hyfit.jp guía 2026](https://hyfit.jp/en/insights/hyrox-record-method-guide/)); los trackers HYROX indie (HyRhythm) triunfan solo por "clean design" sobre lo básico. Una sesión HYROX mezcla erg (metros/tiempo), sled (peso/distancia), carrera (pace) y wall balls (reps) — **ninguna app mainstream puede modelarla; los campos dinámicos de Kairos sí, hoy**.
- **Esfuerzo para superarlo**: BAJO. No es una feature nueva: es una plantilla/preset de bloques HYROX sobre el modelo de datos existente + screenshots ASO del caso híbrido. Cero infraestructura nueva.
- **Riesgo**: marca HYROX registrada — usar "hybrid race training", no el trademark, en el marketing.

### BH#2 — La "caja negra con IA" factura pese a no dar control — ranking 2

- **Facturación evidenciada**: GymStreak ~$208k MRR reportado con 4.7★ ([indiehackers](https://www.indiehackers.com/post/gym-streak-review-2026-my-honest-take-on-gymstreak-app-359b48d0e3)); Fitbod ~$96/año (doc 02).
- **La mediocridad**: GymStreak — safety score 31.5/100 por prácticas de facturación (cobros sorpresa post-trial, sin refunds) y "not the deepest app for data analysis" ([justuseapp](https://justuseapp.com/en/app/1371187280/gymstreak-workout-planner-ai/reviews)); Fitbod — algoritmo "aleatorio", usuarios fuera tras ~7 workouts (doc 02). Facturan porque eliminan la decisión ("qué hago hoy"), y los usuarios pagan aguantando la caja negra y el dark-pattern billing.
- **Esfuerzo para superarlo**: MEDIO. Kai ya está diseñado como copiloto-sobre-TU-sistema (doc 02, P0-3). Lo que falta es que el "siguiente paso" sea tan sin-fricción como la caja negra: un tap. Y la contra-posición de confianza: trial honesto, X visible, export libre.
- **Es el centro vacío del doc 02 confirmado con revenue**: la gente PAGA $100+/año por que le digan qué hacer; nadie se lo da sin quitarle el control.

### BH#3 — La larga cola de disciplinas: cada nicho es una app entera para otros, un preset para Kairos — ranking 3

- **Facturación evidenciada**: 3AK Track & Field $10k MRR; Freedive/Apnea $1.8k; sleep/recovery $2.2k; Steps & Beasts $2.3k ([trustmrr categoría](https://trustmrr.com/category/health-fitness)). Cada micro-nicho sostiene $2-10k MRR con una app monodisciplina.
- **La mediocridad**: cada una obliga al atleta multidisciplina a fragmentar sus datos en N apps (el gap 2 del doc 02, ahora con precios: el híbrido paga 2-3 suscripciones en paralelo).
- **Esfuerzo para superarlo**: BAJO por nicho (un preset de bloques + campos por disciplina), pero MEDIO en distribución (hay que ganar cada nicho por separado). No perseguir N nichos ahora: dejar que el modelo de datos los absorba orgánicamente y documentar los presets más pedidos en beta.

### BH#4 — El funnel monetiza aunque el producto sea trivial (validación, no oportunidad) — ranking 4

- **Facturación evidenciada**: GoTall $56k MRR con una app de "predicción de altura"; CalBuddy $65k; Cal AI $35M año 1.
- **Lección**: el onboarding-como-funnel (quiz → reveal → soft paywall) del doc 03 está validado con revenue verificado en la categoría. Pero GoTall vendiéndose a 1.5x demuestra que el funnel sin producto es caja, no negocio. Kairos debe copiar la conversión, no la sustancia.
- **Esfuerzo**: ya planificado (D2/D4 del doc 03). Nada nuevo que construir aquí.

---

## Directivas

Formato: **[Prioridad] Directiva — criterio de validación.** Ninguna contradice los docs 02/03; los afinan con la evidencia de revenue.

### P0 — capturar BH#1 y BH#2 con lo ya construido

1. **[P0][Producto+Dev] Preset "Atleta Híbrido / Hybrid Race" como demo estrella del onboarding y del ASO.** Un set de bloques plantilla que mezcle en UNA sesión: erg (m/tiempo), sled (kg/m), carrera (pace), estaciones (reps) — usando exclusivamente los campos dinámicos existentes. Aparece cuando el quiz declara ≥2 disciplinas o "hybrid/HYROX-style"; protagoniza 2 screenshots del listing y los clips TikTok del editor. Sin usar la marca HYROX.
   *Validación*: un tester del nicho híbrido registra una sesión de carrera completa (8 estaciones mixtas) sin crear ningún campo a mano y sin abrir una segunda app; entrevista confirma "esto hoy lo hago en spreadsheet/Notas".

2. **[P0][Dev] El "siguiente paso" de Kai a un tap, midiendo contra la caja negra.** La razón por la que GymStreak/Fitbod facturan es fricción-cero de decisión. Cada resumen post-workout y cada pantalla Hoy terminan en UNA recomendación aplicable con un tap (ya es P0-3 del doc 02; aquí se le añade el benchmark: la aplicación de la sugerencia debe costar menos taps que abrir Fitbod).
   *Validación*: `kai_action_applied`/`kai_signal_viewed` ≥ 20% en beta; test moderado: usuario decide su próxima sesión en <10 segundos desde abrir la app.

3. **[P0][Producto] Posicionamiento anti-dark-pattern como arma de conversión.** GymStreak factura ~$200k/mes con un safety score de 31.5/100 por billing abusivo: los compradores del nicho están escaldados. En el paywall de Kairos: X siempre visible, recordatorio antes de acabar el trial ("te avisaremos 2 días antes"), export CSV/JSON libre en el tier gratis, y decirlo explícitamente en la ficha y el paywall ("tus datos son tuyos, cancela en un tap").
   *Validación*: paywall implementado con aviso pre-cobro de trial y sin quejas de billing en las primeras 50 reviews; el copy "export libre / aviso antes de cobrar" presente en listing y paywall; trial→paid ≥ 35% pese al aviso (Cal AI demuestra que la honestidad no mata la conversión — el aviso pre-cobro es estándar en los top grossing).

### P1 — construir el activo que el mercado de salida paga a 10x

4. **[P1][Dev] Retención instrumentada como métrica de valor de empresa, no solo de producto.** Los compradores 2026 parten de 3-5x EBITDA y exigen "4+ months of subscriber retention" con analytics consistentes ([revenuecat.com](https://www.revenuecat.com/blog/growth/guide-to-selling-apps/)); Stealth Venture con $80k MRR se malvende a 2.0x por retención comprada. Añadir a los eventos del doc 03 (D1) cohortes de retención de suscriptor (M1-M4) exportables desde el día del primer cobro.
   *Validación*: informe mensual de cohortes generable con un script desde datos propios + RevenueCat, desde el mes 1 post-lanzamiento.

5. **[P1][Producto] Cero paid-UA en los primeros 6 meses; todo el crecimiento orgánico en los nichos.** La evidencia del marketplace: revenue de ads se vende a 1.5-2x; comunidad orgánica de nicho, a ~10x. Doblar en la fase GTM (doc 03 §4) hacia comunidades híbridas: r/hybridathlete, grupos de hybrid racing, crossfit boxes locales; micro-creadores del nicho híbrido antes que fitness generalistas.
   *Validación*: día 90 — ≥80% de installs atribuibles a orgánico/comunidad (deep links D9 del doc 03); ≥1 comunidad híbrida donde Kairos sea mencionado espontáneamente.

6. **[P1][Dev] Import CSV como puente también para el nicho híbrido.** Strong/Hevy ya está (gap 4, doc 02); añadir tolerancia a exports "sucios" típicos del híbrido: columnas de distancia/tiempo mezcladas con fuerza (Strong exporta "Distance"/"Seconds" — mapearlas a campos dinámicos, no descartarlas).
   *Validación*: import de un export real de Strong con ejercicios de cardio/tiempo conserva el 100% de los campos; el usuario ve su historial híbrido completo, no solo las series de fuerza.

### P2 — opcionalidad y expansión

7. **[P2][Producto] Catálogo de presets por disciplina de la larga cola (BH#3), priorizado por demanda de beta.** No construir N verticales: registrar qué disciplinas configuran los testers con campos custom y empaquetar como presets las 3 más repetidas (candidatas por revenue evidenciado: track & field, apnea/natación, recovery/sueño como campos de sesión).
   *Validación*: ≥3 presets publicados post-beta, cada uno originado por ≥3 peticiones/configuraciones reales de testers.

8. **[P2][Producto] Test de precio hacia el ARPU del nicho.** Con ~$18/mes de ARPU demostrado en el nicho híbrido, el experimento D10 del doc 03 debe incluir una rama de precio superior para el segmento híbrido (59,99 €/año) además de la rama barata (34,99 vs 39,99).
   *Validación*: experimento con ≥300 paywall views por rama; decisión documentada en este directorio.

9. **[P2][Estrategia] Revisitar TrustMRR/Acquire cada trimestre como radar competitivo.** La categoría Health & Fitness de TrustMRR es un censo público y verificado de qué monetiza a nivel indie; los "for sale" son el censo de qué se estanca. Refrescar este doc con cada revisión de fase.
   *Validación*: sección "actualización" añadida a este documento en cada gate de fase del doc 03.

---

*Documento generado por la Directiva de IA de Kairos. Sin cambios de código. Fuentes accedidas el 2026-07-08.*
