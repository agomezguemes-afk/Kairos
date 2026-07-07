# Estrategia Comercial — Kairos (CRO, Directiva de IA)

> Documento 03 de la Directiva de IA. Fecha: 2026-07-07. Estado del producto:
> pre-lanzamiento, corre en iPhone físico, sin usuarios. Basado en CLAUDE.md,
> docs/MVP_PRD.md, docs/testflight-checklist.md e investigación web real
> (RevenueCat, Superwall, Adapty, Airbridge, teardowns de Runna y Cal AI).

---

## 1. Benchmarks (con fuentes)

### 1.1 Monetización en fitness apps 2025-2026

**Datos estructurales (RevenueCat State of Subscription Apps 2025/2026 — 75k-115k apps, $10-16B de revenue analizado):**

| Métrica | Valor | Implicación para Kairos |
|---|---|---|
| Trial-to-paid mediana en Health & Fitness | **39.9%** (top 10%: 68.3%) | Un trial bien colocado convierte muy bien en esta categoría |
| Download-to-paid P90 en H&F | 12.1% | El techo de la categoría es alto |
| Adopción de plan anual en H&F | **68%** (la más alta de todas las categorías) | El plan por defecto debe ser el anual |
| Trials que empiezan en Day 0 | **80-90%** | El onboarding ES el funnel de monetización; no hay segunda oportunidad |
| Compras que ocurren en Day 0 | 44.5% | Ídem |
| Paywall duro: conversión D35 | 10.7% mediana | Convierte 5x más que freemium… |
| Freemium: conversión D35 | 2.1% mediana | …pero freemium retiene igual a 1 año (28% vs 27%) y genera boca-a-boca |
| Trials largos (17-32 días) vs cortos (<4 días) | 42.5% vs 25.5% conversión | En H&F, trial de 7 días es el estándar (>80% de la categoría usa 5-9+ días) |

Fuentes:
- RevenueCat State of Subscription Apps 2025: https://www.revenuecat.com/state-of-subscription-apps-2025/
- RevenueCat 2026 (resumen con benchmarks): https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026/
- Adapty — paywalls de alto rendimiento 2026 (soft paywalls convierten ~50% más por vista: 4.85% vs 3.34%, pero el hard paywall da +21% LTV a 1 año): https://adapty.io/blog/high-performing-paywall-2026/
- Airbridge — hard vs soft vs freemium: https://www.airbridge.io/en/blog/hard-vs-soft-paywalls
- Análisis "2.1% vs 10.7%": https://neoads.substack.com/p/hard-paywalls-convert-less-but-earn

**Lectura del CRO:** el paywall duro gana cuando tienes tráfico de pago que amortizar (Fitbod, Runna). Una indie sin presupuesto vive del boca-a-boca, las reviews y el ranking orgánico — eso exige una capa gratuita real. La retención a 1 año es idéntica (27% vs 28%): el hard paywall no compra retención, solo filtra antes.

### 1.2 Precios reales de la competencia (verificados jul-2026)

| App | Mensual | Anual | Lifetime | Modelo |
|---|---|---|---|---|
| **Hevy Pro** | $4.99 | $39.99 (~$24 en oferta) | $74.99 | Freemium generoso (logging ilimitado gratis) |
| **Strong** | $4.99 | $29.99 | $99.99 | Freemium generoso (gate: 3 rutinas custom) |
| **Fitbod** | $15.99 | $95.99 | — | Paywall duro + trial 7 días, sin tier gratis |
| **Runna** | $19.99 | $119.99 | — | Trial 7 días → paywall duro |
| **Whoop** | $25-40 | $199-359 | — | Hardware + suscripción, 3 tiers |

Fuentes:
- https://hevy.com/pricing
- Comparativa Fitbod/Hevy/Strong: https://www.sensai.fit/blog/fitness-app-pricing-free-tier-comparison y https://www.smartrabbitfitness.com/blog/en/fitness-ai-apps-price-comparison-fitbod-strong-hevy-2025
- https://www.runna.com/pricing
- Whoop pricing: https://trackervs.com/pricing/whoop-pricing/ y https://support.whoop.com/s/article/Membership-Pricing?language=en_US

**Lectura del CRO:** hay dos bandas de precio claras. Banda "tracker" ($30-40/año: Hevy, Strong) donde pagas por analytics sobre tu propio esfuerzo, y banda "coach" ($96-120/año: Fitbod, Runna) donde pagas porque la app decide por ti. Kairos, por tesis de producto ("sistema personal en bloques inteligentes" + Kai adaptando), está **entre las dos**: más que un tracker, menos que un coach autónomo maduro. Con Kai todavía en reglas deterministas + LLM de redacción, no podemos defender $100/año en v1.

### 1.3 Activación y retención

- Health & Fitness: D1 ≈ 20-27%, D7 ≈ 7-13%, D30 ≈ 3-10% (mediana de la categoría). Apps top: D7 de 28-40%.
- Activación día 1 en H&F ≈ 26%, cayendo a 10% en día 28.
- **El primer workout completado es la acción más correlacionada con el retorno D7.** Todo el onboarding debe optimizarse para llegar a esa acción, no para recolectar datos.
- 55.4% de las cancelaciones de trials de 3 días ocurren en Day 0; 35% de las cancelaciones anuales ocurren en el mes 1 → el valor debe ser evidente en la primera semana, no prometido.

Fuentes:
- https://www.businessofapps.com/data/health-fitness-app-benchmarks/
- https://prooflytics.io/blog/d7-d30-retention-benchmarks-by-app-category
- https://www.plotline.so/blog/retention-rates-mobile-apps-by-industry
- https://lovable.dev/guides/what-is-a-good-retention-rate-for-an-app

### 1.4 El patrón "quiz de onboarding → personalización → paywall" (Cal AI / Runna / Fitbod)

Cómo funciona exactamente, paso a paso:

1. **Quiz de inversión progresiva** (Runna: ~30 pantallas; Cal AI: quiz largo con animaciones). Cada respuesta aumenta el "sunk cost" psicológico y alimenta la personalización real.
2. **Micro-momentos de confianza**: social proof intercalado ("otros como tú lo lograron"), petición de review a mitad del onboarding (Cal AI), pantallas que calman ansiedades (Runna: "¿seré capaz con las cuestas?").
3. **Reveal del plan personalizado**: la app *muestra* el plan generado con tus datos — este es el momento aha fabricado. El usuario ve el valor antes de que se le pida nada.
4. **Paywall inmediatamente después del reveal**: anual destacado con "SAVE 50%", precio desglosado por semana, trial de 7 días. Runna: hard paywall tras el trial. Cal AI: soft paywall (anual con trial + mensual sin trial, 75% de descuento en anual).
5. **Iteración continua**: Cal AI corrió 123 experimentos en 46 trigger points; +31% en trial-to-paid y 3x de revenue mensual en 10 meses. El paywall del onboarding solo recibió 61 experimentos.

Tasas que reporta la industria para este patrón: onboarding paywall con trial ≈ 1.35% de media por colocación (la más alta de cualquier placement — Adapty); trial-to-paid en H&F 39.9% mediana. Runna pasó de lanzamiento (mar-2022) a 7.000 suscriptores de pago en un año y a adquisición por Strava (~£150M) en 3 años con este funnel.

Fuentes:
- Teardown de Runna (Rosie Hoggmascall): https://www.growthdives.com/p/how-to-nail-onboarding-a-case-study
- Caso Cal AI en Superwall: https://superwall.com/case-studies/cal-ai
- Cal AI $35M año 1: https://getlatka.com/blog/how-cal-ai-achieved-35-million-revenue-in-just-one-year/
- Paywall de Runna en Adapty: https://adapty.io/paywall-library/runna-running-training-plans/
- Growth playbook Runna/Strava: https://growthcurve.co/runna-and-strava-the-growth-playbook-when-product-distribution-and-localisation-collide

**Lectura del CRO:** el PRD de Kairos ya define este quiz sin saberlo (Flujo 1: nombre, objetivo, días/semana, disciplinas, equipo, duración, nivel → Kai genera 2-3 bloques → propone semana). Lo que falta es tratarlo como **motor de conversión**, no como formulario: el reveal del plan generado es nuestro momento de paywall natural.

### 1.5 GTM indie sin presupuesto

- **TestFlight**: hasta 10.000 testers externos con link público — es un canal de distribución en sí mismo, no solo QA. Timeline recomendado: TestFlight 8 semanas antes del lanzamiento, listing y outreach a prensa/YouTubers/newsletters 4-6 semanas antes (dales acceso TestFlight). Fuentes: https://developer.apple.com/testflight/ · https://asappstudio.com/app-store-launch-2026/
- **Reddit**: regla 90/10 (90% participación, 10% promoción). r/Fitness (10M+ miembros) tiene "Self-Promotion Saturday". Subreddits objetivo: r/workout, r/naturalbodybuilding, r/xxfitness, r/GYM, r/hybridathlete, r/Fitness_India, y en español r/fitness_es, r/gymsnark. Construir karma/historial ANTES de mencionar Kairos — los mods revisan perfiles. Fuentes: https://redship.io/blog/reddit-self-promotion-rules
- **ASO**: "workout tracker", "gym log", "fitness log", "training log" están saturados (250 apps por keyword, dominados por Strong/Hevy/FitNotes). La vía indie: long-tail + diferenciación visual en screenshots por query. El listing actual de Kairos ya está en español — **el mercado ES/LatAm de "planificador de entrenamiento" está mucho menos saturado que el inglés** y es nuestra cuña ASO inicial. Fuentes: https://asotools.io/app-store-keywords/gym-workout · https://www.apptweak.com/en/aso-blog/app-store-keyword-research-aso
- **Build in public / TikTok**: el editor Spine-Bento (espina dorada, supersets intercalados, drag & drop) es inusualmente "grabable" — contenido de 15-30s mostrando la creación de un bloque es el activo de marketing más barato que tenemos. El funnel de Runna funcionó porque el contenido de adquisición (UGC, comunidades) coincidía con el funnel de onboarding.

---

## 2. Modelo de monetización propuesto

**Decisión: freemium generoso + Kairos Pro por suscripción, con soft paywall al final del onboarding.** Ni paywall duro (mata el boca-a-boca que una indie sin presupuesto necesita, y no compra retención: 27% vs 28% a 1 año), ni freemium puro sin momento de conversión (2.1% D35 no paga servidores de LLM).

### Qué es GRATIS (para siempre — es el motor de adquisición)

- Logging ilimitado de workouts e historial completo. *Razón: Hevy y Strong lo dan gratis; cobrar por esto es perder contra su free tier antes de empezar. Los datos del usuario son suyos — coherente con "privacidad por diseño".*
- Hasta **5 bloques activos** (suficiente para una semana real de entrenamiento; el usuario medio de gimnasio usa 3-4 rutinas).
- Plan semanal manual (asignar bloques a días, recurrencia semanal, mover/saltar).
- Pantalla Hoy completa, ActiveWorkout completo, supersets, resumen post-workout.
- Racha, misiones y PRs básicos.
- **Generación inicial de bloques por Kai en el onboarding** (una vez, gratis — es el momento aha; regalarlo es marketing, no caridad).
- 1 señal de Kai al día (las deterministas — funcionan offline y no cuestan tokens).

### Qué es de PAGO — **Kairos Pro**

- **Kai ilimitado**: adaptaciones en sesión ("tengo 25 min", "no tengo gym", "hazlo más duro"), "Kai, planifica mi semana", regeneración de bloques, recomendaciones de progresión post-workout con LLM.
- Bloques ilimitados + Canvas/layouts avanzados cuando lleguen.
- Analytics de progreso avanzados: tendencias de volumen por grupo muscular, gráficos por métrica custom, insights semanales de Kai.
- Export (PDF/CSV) e integraciones futuras (Apple Health write, Strava).
- *Regla de diseño del gate: lo gratis te deja ejecutar TU sistema; lo Pro hace que el sistema piense por ti y te enseñe qué está pasando. El gate está alineado con nuestro coste marginal (tokens de LLM) — sostenible por construcción.*

### Precio

| Plan | Precio | Racional |
|---|---|---|
| **Anual (default, destacado)** | **39,99 €/año** (~3,33 €/mes, desglosar "0,77 €/semana" en el paywall) | Techo de la banda tracker (Hevy $39.99), con IA como justificación del extremo alto. 68% de la categoría elige anual — es el plan que optimizamos |
| Mensual | 6,99 €/mes | Ancla que hace obvio el anual (43% de descuento implícito). Sin trial en mensual (patrón Cal AI) |
| Trial | **7 días solo en anual** | Estándar de la categoría (>80% usa 5-9+ días); mediana de conversión trial→pago en H&F: 39.9% |
| Lifetime | Diferido a v1.1 (~89,99 €) | Útil para early adopters/build-in-public, pero decidir con datos de LTV, no antes |

Cuando Kai tenga LLM real multi-turno y planificación adaptativa demostrada (Sprint 7+), subir el anual hacia 59,99 € para nuevos usuarios, grandfathering a los existentes — anunciarlo públicamente es una palanca de urgencia honesta durante el lanzamiento.

**Durante TestFlight: todo gratis con badge "Founder Beta".** A los beta testers activos, 1 año de Pro gratis al lanzar. No se cobra a nadie hasta App Store — pero el paywall se MUESTRA (modo fake-door con "gratis durante la beta") para medir intención desde el día 1.

Infraestructura: RevenueCat SDK desde el primer build de App Store (gratis hasta $2.5k MRR, y sus benchmarks son la base de este documento).

---

## 3. Onboarding como motor de conversión

El principio (validado por Cal AI, Runna, Fitbod y los datos de RevenueCat): **80-90% de los trials empiezan en Day 0 y el primer workout completado es el mayor predictor de retorno D7.** Por tanto el onboarding tiene dos clientes: la conversión (hoy) y la retención (D7). El flujo propuesto sirve a ambos:

```
Splash
  → Quiz (el del PRD Flujo 1: objetivo, días/semana, disciplinas,
    equipo, duración, nivel — 7 pantallas, <3 min, una pregunta por
    pantalla, respuestas tocables, sin teclado salvo el nombre)
  → [SIN CREAR CUENTA TODAVÍA — local-first, cero fricción]
  → Pantalla de "Kai está construyendo tu sistema…"
    (animación 2-4s: los bloques se ensamblan — teatro de personalización)
  → ✨ REVEAL: tus 2-3 bloques + tu semana propuesta
    (momento aha fabricado: el usuario VE su plan con SUS datos)
  → Acepta / edita la semana
  → SOFT PAYWALL: "Kai puede mantener este plan vivo"
    (anual destacado + trial 7 días, mensual como ancla,
    X para cerrar SIEMPRE visible — patrón Cal AI, no Runna)
  → Aterriza en Hoy con CTA "Empezar entrenamiento"
  → Cuenta: se pide DESPUÉS del primer workout completado
    (o al activar trial/sync) — nunca antes del valor
```

Decisiones clave y su porqué:

1. **El paywall va tras el reveal del plan, no antes del quiz ni en el primer arranque.** Es el punto de máxima inversión percibida y valor demostrado. Colocación de mayor conversión de la industria (onboarding paywall, Adapty).
2. **Soft, no hard.** Sin presupuesto de adquisición, cada usuario rechazado por un hard paywall es una review y un boca-a-boca perdidos. El tier gratis es nuestra publicidad.
3. **La cuenta NO es una puerta.** El PRD ya exige que Hoy funcione offline; la cuenta solo es necesaria para sync/trial. Cada campo de registro antes del valor es abandono puro. (El estado actual con AuthScreen/SKIP_AUTH debe resolverse en esta dirección: anonymous-first.)
4. **El quiz ya existe en el PRD — lo que se añade es teatro y medición.** Pantalla de "construyendo", reveal cuidado con la estética espina-oro, y eventos en cada paso del quiz para encontrar dónde se cae la gente.
5. **Post-primer-workout es el segundo momento de conversión.** El resumen con recomendación de Kai (PRD §9) debe enseñar UNA probadita Pro real ("Prueba +2,5 kg la próxima vez — Kai Pro te lo recordará en la serie") con CTA suave. Cal AI: 46 trigger points, no 1.

Métricas objetivo del funnel (contra benchmarks):

| Paso | Objetivo v1 | Benchmark |
|---|---|---|
| Quiz completado | >70% de installs | Onboarding <3 min (criterio PRD) |
| Reveal → acepta plan | >80% | — |
| Paywall view → trial start | 5-8% | Onboarding paywall ≈ mediana de mejores placements |
| Trial → pago | >35% | Mediana H&F 39.9% |
| Primer workout completado ≤48h | >40% de quiz completados | Predictor #1 de D7 |
| D7 | >15% | Mediana H&F ≈ 7-13% |

---

## 4. GTM — Primeros 90 días

### Fase 1 · Días 0-30 — Beta cerrada (TestFlight privado)

- Cerrar blockers de docs/testflight-checklist.md y subir build 1.
- **15-30 testers reclutados a mano**: gimnasio propio, amigos que entrenan, r/SideProject, comunidad build-in-public en X. Perfil = el del PRD (20-40 años, entrena solo, rutinas en Notas/Excel/ChatGPT).
- Activar los eventos de la Fase 5 del PRD (onboarding_completed → return_d7) + los del funnel de conversión (§3). Sin datos no hay estrategia.
- Entrevistas cualitativas con las preguntas del PRD §15 (¿qué sustituyó Kairos? ¿te molestaría no poder usarlo la semana que viene?).
- Empezar build in public: 2-3 posts/semana en X + TikTok/Reels del editor Spine (15-30s, sin voz, texto overlay). Objetivo: 500 seguidores acumulados, no viralidad.
- Crear cuenta Reddit y **solo participar** (regla 90/10): responder dudas de rutinas en r/Fitness, r/workout, r/fitness_es. Cero menciones a Kairos este mes.

**Gate de salida:** loop del PRD §16 verificado por ≥10 testers reales + D7 de beta >20% (testers reclutados retienen más; si ni ellos vuelven, no lanzar).

### Fase 2 · Días 30-60 — Beta abierta (link público TestFlight)

- Link público de TestFlight (hasta 10.000 testers) como CTA de todo el contenido.
- Post de lanzamiento de beta en r/SideProject, r/iOSBeta, Self-Promotion Saturday de r/Fitness, y foros ES (ForoCoches fitness, r/fitness_es) — con historia personal, no pitch.
- Outreach a 10-15 micro-creadores fitness ES/EN (5k-50k seguidores) y newsletters indie (Consistent Quality, TestFlight roundups): acceso beta + oferta de "founder Pro gratis 1 año". Empezar ya: sus colas son de 4+ semanas.
- Iterar onboarding con datos del funnel: arreglar el paso con mayor caída del quiz, A/B del copy del reveal.
- Preparar listing final: screenshots de las 6 pantallas del checklist, keywords ES ("planificador entrenamiento", "rutinas gimnasio", "registro fuerza", "superseries") + EN long-tail ("workout planner blocks", "training system builder" — evitar pelear "workout tracker" de frente).
- Landing pública (sustituir la URL de GitHub del listing) + privacy policy hosteada.

**Gate de salida:** ≥200 testers, quiz-completion >60%, primer-workout-48h >30%.

### Fase 3 · Días 60-90 — Lanzamiento App Store

- Lanzar con paywall real (RevenueCat) y precios de §2. Los testers beta reciben su año Pro gratis (código promo) — son la primera ola de reviews de 5 estrellas (pedirla tras el 3er workout completado, nunca antes).
- Día de lanzamiento coordinado: post en Self-Promotion Saturday + X + TikTok + micro-creadores publicando la misma semana. Product Hunt como amplificador secundario (audiencia tech, no fitness — expectativas moderadas).
- ASO iterativo semanal con los datos de App Store Connect (impresiones→product page→install).
- Primer experimento de paywall a las 2 semanas de datos (precio anual 34,99 vs 39,99 o copy del trial) — cadencia Cal AI: un experimento vivo siempre.
- **KPIs día 90:** 1.000 descargas acumuladas, D7 >12%, 40-80 suscriptores de pago (≈ download-to-paid 1.5-2.5%, entre la mediana freemium y la P90), MRR ~150-300 €. Runna tardó 12 meses en llegar a 7.000 pagos — calibrar expectativas: en 90 días validamos el funnel, no el negocio.

---

## Directivas

Órdenes accionables para los desarrolladores, priorizadas. Ninguna requiere romper el PRD — lo refuerzan.

### P0 — Bloquean la estrategia comercial; hacer antes del TestFlight abierto

- **D1. Instrumentar el funnel completo de activación y conversión.** Implementar los eventos de PRD §12 Fase 5 (`onboarding_completed`, `workout_finished`, `return_d7`, etc.) MÁS: `quiz_step_viewed` (por paso), `plan_reveal_viewed`, `plan_accepted`, `paywall_viewed`, `paywall_dismissed`, `trial_started_intent` (fake door en beta), `first_workout_completed_48h`. Local-first (cola en AsyncStorage) está bien para beta; lo innegociable es que existan desde el build 1.
  *Validación: dashboard (aunque sea un script sobre logs exportados) que muestre el funnel quiz→reveal→paywall→primer workout para ≥10 testers reales.*

- **D2. Construir el momento "reveal del plan" en el onboarding.** Tras el quiz del Flujo 1, insertar: (a) pantalla "Kai está construyendo tu sistema" (2-4s, animación espina/bloques ensamblándose, estética tokens.ts), (b) pantalla de reveal con los 2-3 bloques generados + semana propuesta, editable, (c) hueco arquitectónico para el paywall justo después (en beta: pantalla "Kairos Pro — gratis durante la beta" con botón continuar, que ya emite `paywall_viewed`/`paywall_dismissed`). El onboarding completo debe seguir bajo 3 minutos.
  *Validación: vídeo del flujo en iPhone físico; quiz→reveal completion >70% en los primeros 20 testers; evento paywall_viewed presente en ≥95% de onboardings completados.*

- **D3. Cuenta después del valor, nunca antes: anonymous-first.** Eliminar cualquier pantalla de auth previa al quiz (resolver el estado actual de AuthScreen/SKIP_AUTH en esta dirección, como env/config según PRD Fase 0). Todo el onboarding, el plan y el primer workout deben funcionar sin cuenta y sin red. La creación de cuenta se ofrece tras el primer workout completado (para "guardar tu progreso en la nube") o al iniciar trial — nunca como puerta.
  *Validación: instalación limpia en avión-modo llega desde splash hasta resumen de primer workout sin ver ninguna pantalla de registro; datos sobreviven reinicio.*

### P1 — Necesarias para el lanzamiento App Store (días 30-60)

- **D4. Integrar RevenueCat SDK y el paywall real.** Productos: anual 39,99 € con trial 7 días (destacado, precio desglosado por semana) + mensual 6,99 € sin trial. Soft paywall: X visible siempre. Colocaciones: post-reveal (primaria) y CTA contextual en resumen post-workout (secundaria).
  *Validación: compra sandbox completa en TestFlight; ambos placements emiten eventos; el estado Pro gatea Kai ilimitado y bloques >5.*

- **D5. Implementar el gate free/Pro en el producto.** Free: 5 bloques activos, generación inicial de Kai (una vez), 1 señal determinista/día, logging e historial ilimitados. Pro: Kai ilimitado (adaptaciones, planificar semana, regenerar), bloques ilimitados, analytics avanzados. El gate debe fallar elegante: al tocar una feature Pro, mini-paywall contextual, nunca un error.
  *Validación: con cuenta free, cada superficie Pro muestra su upsell contextual y emite `paywall_viewed` con `source`; con Pro activo, cero gates visibles.*

- **D6. Probadita Pro en el resumen post-workout.** La recomendación post-workout (PRD §9) muestra una recomendación real de Kai con nota "Kai Pro te lo recordará en tu próxima sesión" + CTA suave. Es el trigger point #2 (patrón Cal AI: 46 trigger points).
  *Validación: evento `kai_post_workout_upsell_viewed` y tasa de tap medible; visible solo para free.*

- **D7. Petición de review en el momento correcto.** `SKStoreReviewController` tras el 3er workout completado (nunca en onboarding, nunca tras un workout saltado).
  *Validación: prompt aparece exactamente una vez, en el 3er `workout_finished`, verificado en device.*

### P2 — Optimización post-lanzamiento (días 60-90+)

- **D8. Localizar listing y onboarding a inglés** (el checklist ya lo lista como build 2) — el mercado EN es 10x, pero entramos con la cuña ES ganada.
  *Validación: listing EN publicado; keywords EN long-tail rankeando en top 100 para ≥2 términos.*

- **D9. Deep links de atribución ligera** (`?src=reddit|tiktok|creator_x`) guardados en el evento `onboarding_completed`, para saber qué canal trae usuarios que completan workouts, no solo installs.
  *Validación: informe por canal con quiz-completion y first-workout-rate por fuente.*

- **D10. Primer experimento de paywall** a las 2 semanas de datos reales: precio anual (34,99 vs 39,99) o framing del trial. Un experimento vivo siempre (cadencia Cal AI).
  *Validación: experimento con ≥300 paywall views por rama y decisión documentada en este directorio.*

---

*Documento vivo — actualizar tras cada gate de fase con datos reales. Próxima revisión: al cerrar la beta privada (día 30).*
