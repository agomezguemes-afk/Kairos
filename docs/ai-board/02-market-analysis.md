# Análisis de Mercado y Venture Capital — Kairos

> Directiva de IA · Analista de Mercado/VC · 2026-07-07
> Fuentes: investigación web real (YC, prensa VC, reviews de apps, benchmarks de retención). Todas las afirmaciones clave llevan URL.

---

## Señales YC/VC

### Qué está financiando Y Combinator (2024-2026)

Los batches recientes muestran una tesis repetida: **el coach de IA "full-stack" que sintetiza datos y devuelve un plan diario**, no un chatbot genérico:

- **Nori** (F2025) — "concierge-level AI health coach": ingiere Apple Health, wearables e historial médico y lo reduce a **un plan diario personalizado**. ([ycombinator.com/companies/industry/consumer-health-and-wellness](https://www.ycombinator.com/companies/industry/consumer-health-and-wellness))
- **Vora** (W2025) — AI health coach en iPhone/Apple Watch para entreno, nutrición y recuperación. ([askvora.com](https://askvora.com/blog/ai-fitness-coaching-2026))
- **HYBRD** (2024, fundadores ex-WHOOP/AWS) — agrega datos de wearables y construye programas personalizados; su pitch literal: *"todo lo que te da un coach de $500/mes a un precio 50x menor"*. Nótese: apuntan explícitamente al **atleta híbrido**.
- **Prana** (W2026), **Mito Health** (S2024) — monitorización continua + IA longitudinal: la señal es "datos del usuario → plan proactivo".

**Tesis dominante que se repite**: la IA no como herramienta, sino como *"contratar un trabajador full-stack"* (Marc Andreessen, feb 2025: [timmermanreport.com](https://timmermanreport.com/2025/02/the-future-of-ai-and-health-part-ii-andreessen-and-colleagues-weigh-in/)). a16z destinó ~40% de su mix 2025 a healthcare ([feedtheai.com](https://www.feedtheai.com/a16zs-ai-startups-portfolio/)) y describe al consumidor rodeado de "especialistas inteligentes" personales ([a16z.com](https://a16z.com/how-ai-will-usher-in-an-era-of-abundance/)).

### Señales de capital y consolidación

- **Ladder** levantó **$100M+** (Series B de Point72 + $90M de General Catalyst para go-to-market) con 300.000 miembros de pago a $29.99/mes — demuestra que el usuario paga precios premium por *programación estructurada*, no solo logging. ([businesswire.com](https://www.businesswire.com/news/home/20241120017577/en/Ladder-Secures-Over-$100-Million-in-New-Funding-to-Scale-1-Strength-Training-App))
- **Strava compró Runna** (abril 2025) y luego The Breakaway — los agregadores de actividad compran *planes de entrenamiento* porque el logging solo ya no retiene. Runna cobraba ~$120/año y creció hasta la adquisición. ([techcrunch.com](https://techcrunch.com/2025/05/22/strava-is-buying-up-athletic-training-apps-first-runna-and-now-the-breakaway/), [press.strava.com](https://press.strava.com/articles/strava-to-acquire-runna-a-leading-running-training-app))
- Mercado de AI personal trainer: **$16.9B en 2025 → $65.7B proyectado 2033** (18.6% CAGR). ([touchlane.com](https://touchlane.com/ai-powered-personal-trainers-how-predictive-workouts-and-virtual-coaching-are-changing-fitness-apps/))

### La cruda realidad de retención (el problema que el capital quiere resolver)

- Retención D30 en fitness apps: **3-10%** típica; los líderes llegan a ~25%. ([retentioncheck.com](https://retentioncheck.com/churn-benchmarks/fitness-apps), [businessofapps.com](https://www.businessofapps.com/data/health-fitness-app-benchmarks/))
- Churn mensual medio de la categoría: **9.2%**; el cuartil superior, 2.0%.
- **La señal más predictiva de churn: frecuencia de sesión en los primeros 14 días.** Usuarios con <3 workouts en sus primeros 14 días abandonan a 3-4x la tasa de los que establecen hábito semanal. ([retentioncheck.com](https://retentioncheck.com/churn-benchmarks/fitness-apps))
- Planes anuales retienen 40-60% mejor que mensuales; precio típico $10-20/mes.

**Implicación directa para Kairos**: el North Star del PRD (onboarding → plan → Hoy → completar → volver en 2-7 días) está alineado exactamente con la métrica que decide la vida o muerte de estas apps. La activación en los primeros 14 días ES el producto.

---

## Mapa competitivo

| App | Modelo / Precio | Qué hace bien | Queja recurrente (el gap) | Fuente |
|---|---|---|---|---|
| **Strong** | Freemium, $4.99/mes · $49.99/año (sin lifetime ya) | Logging rápido y fiable, buen export CSV | Free tier limitado a 3 rutinas; "es un tracker, no un planner — no te dice qué hacer después"; desarrollo estancado | [aitoolsbakery.com](https://aitoolsbakery.com/blog/hevy-vs-strong-app/), [setgraph.app](https://setgraph.app/ai-blog/hevy-vs-strong) |
| **Hevy** | Freemium, $2.99/mes · $29.99/año · $74.99 lifetime | Velocidad de logging, social, precio; Hevy Trainer (feb 2026) añade programación algorítmica | Depende de red en gimnasios sin señal; datos en su nube, no locales; sin rest timers diferenciados warmup/work; export menos completo que Strong | [prpath.app](https://prpath.app/blog/strong-vs-hevy-2026.html), [aitoolsbakery.com](https://aitoolsbakery.com/blog/hevy-vs-strong-app/) |
| **Fitbod** | Suscripción ~$80-160/año | Genera el workout por ti (cero fricción de decisión) | Algoritmo percibido como "aleatorio", sin progresión/periodización real; los usuarios no retienen más allá de ~7 workouts; caja negra sin control | [dr-muscle.com](https://dr-muscle.com/fitbod-workout-app-review/) |
| **Ladder** | Premium, $29.99/mes · $179.99/año | Programación estructurada + accountability social; bundle entreno+nutrición | Cara; programas de equipo, no personalización individual real | [corahealth.app](https://www.corahealth.app/compare/ladder), [joinladder.com](https://www.joinladder.com/pricing) |
| **Runna** (Strava) | $120/año (bundle Strava $149.99/año) | Planes de running personalizados, onboarding a plan en minutos | Solo running; la fuerza es complemento superficial | [dcrainmaker.com](https://www.dcrainmaker.com/2025/04/strava-acquires-runna-thoughts-forward.html) |
| **Whoop** | Hardware + suscripción $199-359/año | Recovery/strain, datos fisiológicos | No programa entrenamientos; requiere hardware propio | [trackervs.com](https://trackervs.com/pricing/whoop-pricing/) |
| **Caliber** | Freemium (app gratis) + coaching humano de pago | Coaching humano asequible | El plan gratuito es limitado; escala humana, no producto | [garagegymreviews.com](https://www.garagegymreviews.com/best-workout-apps) |
| **Alpha Progression** | ~$70-80/año | Generador de planes con progresión automática, buen soporte | "Adaptación limitada; ajustes manuales; insuficiente para avanzados"; analytics poco profundos | [fitnessdrum.com](https://fitnessdrum.com/alpha-progression-app-review/), [compareworkoutapps.com](https://www.compareworkoutapps.com/reviews/alpha-progression-app-review/) |
| **Gymshark Training** | Gratis (marketing de marca) | 450+ workouts guiados, cero fricción | Sin personalización: no drop sets, no supersets, no tracking de progreso real | [tomsguide.com](https://www.tomsguide.com/wellness/fitness/gymshark-training-app-review-effective-workouts-for-free), [dr-muscle.com](https://dr-muscle.com/gymshark-workout-app-review/) |
| **Peloton** | Contenido, $12.99-24/mes, 2.8M subs | Clases + comunidad | Modelo de contenido, no de sistema personal; irrelevante para self-directed | [businessofapps.com](https://www.businessofapps.com/data/peloton-statistics/) |

**Lectura del mapa**: el mercado está polarizado en dos extremos — *trackers pasivos* (Strong/Hevy: tú decides todo, la app solo registra) y *cajas negras* (Fitbod/Ladder: la app decide todo, tú obedeces). El centro — **control del usuario + asistencia inteligente + planificación semanal** — está estructuralmente vacío. Exactamente donde el PRD de Kairos ya apunta (§2 "La oportunidad está entre todas ellas").

---

## Gaps no satisfechos (con evidencia)

### Gap 1 — "Tengo rutinas, no un sistema" (el gap del planner)

Strong "es un tracker, no un planner — no te dice qué hacer después ni cómo progresar; necesitas ya tener un programa en mente" ([setgraph.app](https://setgraph.app/ai-blog/best-strength-training-app-reddit)). Los lifters con criterio siguen usando **spreadsheets** (nSuns, Reddit PPL en Google Sheets — [liftvault.com](https://liftvault.com/programs/strength/reddit-ppl/)) porque "lo que funciona es poder meter TU programa fácilmente, no ser forzado a elegir plantillas" ([setgraph.app](https://setgraph.app/ai-blog/best-workout-planner-reddit-recommends)). Y en el otro extremo, Fitbod falla porque su algoritmo "parece aleatorio, sin progresión estratégica" y pierde a los usuarios tras ~7 workouts ([dr-muscle.com](https://dr-muscle.com/fitbod-workout-app-review/)). **Nadie da: tu programa, tus reglas, con una semana organizada y un siguiente paso claro.**

### Gap 2 — El atleta híbrido/multidisciplina no tiene casa

"Las apps de running asumen que solo corres. Las de fuerza asumen que solo levantas. Al combinarlas, tu entrenamiento se vuelve un caos sin estructura semanal, con fatiga en conflicto y cero idea de si progresas" ([findyouredge.app](https://www.findyouredge.app/news/best-hybrid-fitness-apps-2025)). La única respuesta nativa es Edge, un entrante minúsculo de 2025-2026; la alternativa real de los usuarios es *Strava + Hevy con los datos en dos sitios*. Que HYBRD (YC, ex-WHOOP) haya nacido para esto confirma que los VCs ven el mismo hueco. Los bloques de Kairos con campos dinámicos por ejercicio (peso, reps, distancia, pace, RPE) son **disciplina-agnósticos por diseño** — ningún competidor mainstream tiene ese modelo de datos.

### Gap 3 — ChatGPT genera el plan, nadie lo ejecuta

El PRD lo identifica y el mercado lo confirma: la gente usa ChatGPT/Notas/PDF/Excel para diseñar y luego no tiene dónde vivir el plan. El coach de IA financiado por YC (Nori, Vora, HYBRD) ataca justo la conversión *datos → plan diario accionable*. El terreno "de la conversación al calendario a la ejecución con seguimiento" sigue abierto en fitness self-directed.

### Gap 4 — Fricción de cambio y miedo al lock-in

"El mayor miedo al cambiar de app es perder años de historial — empezar de cero rompe el progressive overload, borra PRs y oculta tendencias" ([gainflow.app](https://www.gainflow.app/blog/how-to-import-workouts-from-strong-to-gainflow)). Hevy solo permite **una** importación y solo desde Strong en inglés ([help.hevyapp.com](https://help.hevyapp.com/hc/en-us/articles/38001424401943-How-to-Import-Strong-App-CSV-Files-and-Export-Your-Data-in-Hevy)). Kairos **ya tiene import CSV de Strong y Hevy implementado** — es el puente de adquisición más barato que existe: el usuario llega con su historial intacto y sus PRs reconocidos desde el minuto uno.

### Gap 5 — La retención se decide en 14 días y casi nadie diseña para eso

<3 workouts en 14 días = churn 3-4x ([retentioncheck.com](https://retentioncheck.com/churn-benchmarks/fitness-apps)). Fitbod pierde usuarios tras 7 workouts; Strong ni siquiera intenta darte razón para volver mañana. La app que convierte onboarding → plan semanal aceptado → 3 sesiones completadas en 2 semanas gana la categoría. El PRD ya define este loop; el mercado dice que es LA batalla correcta.

---

## Posicionamiento y wedge

### Posicionamiento

> **Kairos: el sistema personal de entrenamiento para quien entrena por su cuenta y mezcla disciplinas.** Tú diseñas tus bloques con control total (campos a tu medida, tu método); Kai los convierte en una semana organizada y te da el siguiente paso. Ni tracker mudo, ni caja negra: un copiloto sobre TU sistema.

Es el centro vacío del mapa: control de spreadsheet + estructura de Runna + ejecución de Hevy, con estética premium que ninguno tiene.

### El wedge más estrecho y defendible

**El lifter/atleta híbrido autodirigido que hoy vive en spreadsheet + Notas/ChatGPT + Hevy/Strong y no sabe "qué toca hoy".**

Por qué este y no otro:
1. **Dolor probado y verbalizado** (Reddit spreadsheets, quejas Strong/Fitbod citadas arriba) — no requiere educar al mercado.
2. **Canal de entrada ya construido**: import CSV Strong/Hevy → historial y PRs migran en 60 segundos. El competidor más barato de atacar es el que descuida a sus power users (Strong estancado, Hevy con Android/export cojos).
3. **Defendible por modelo de datos**: campos dinámicos + bloques multidisciplina son costosos de replicar para apps con esquema fijo de "ejercicio de gimnasio". Fitbod no puede darte control sin romper su caja negra; Hevy no puede darte campos custom sin reescribir su núcleo.
4. **Alineado con la tesis VC dominante** ("coach de $500/mes a 50x menos", plan diario desde tus datos) sin necesitar hardware (vs Whoop) ni coaches humanos (vs Caliber/Future).
5. Es un wedge que **expande solo**: híbrido → fuerza pura y running puro son subconjuntos, no pivotes.

**Pricing de referencia validado por mercado**: $60-90/año (entre Hevy $30 y Runna $120; muy por debajo de Ladder $180). El valor percibido no es el logging (commodity a $30) sino el sistema semanal + Kai.

---

## Directivas

Órdenes priorizadas para el equipo de desarrollo, derivadas del mercado. Formato: **[Prioridad] Directiva — criterio de validación.**

### P0 — decide la supervivencia (activación y loop de 14 días)

1. **[P0] Cerrar el loop Hoy → Plan → Ejecutar → Siguiente paso antes que cualquier otra feature** (Fases 0-4 del PRD sin desvíos: scheduleStore, Hoy, Plan, integración ActiveWorkout, Kai Signals deterministas).
   *Validación*: un beta user nuevo completa **≥3 workouts programados en sus primeros 14 días** (el umbral anti-churn de la industria). Medir con los eventos `workout_finished` + `return_d7` del PRD §12 Fase 5.

2. **[P0] Onboarding "plan en <3 minutos" con el import Strong/Hevy CSV como camino de primera clase, no escondido.** El usuario migrado debe ver sus PRs históricos reconocidos y una semana propuesta por Kai inmediatamente después del import. Es nuestro canal de adquisición más barato y ataca el gap 4.
   *Validación*: time-to-first-scheduled-workout < 3 min; ≥70% de onboardings completados llegan a Hoy con ≥1 sesión programada; en beta, ≥30% de los testers entran vía import CSV sin ayuda manual.

3. **[P0] Kai accionable y determinista antes que conversacional** (Kai Signals con `action`, funcionando offline; LLM solo para redacción). El mercado castiga la IA decorativa (Fitbod "aleatorio") y premia el "siguiente paso" (Runna).
   *Validación*: `kai_action_applied` / `kai_signal_viewed` ≥ 20% en beta; toda sesión completada termina con exactamente UNA recomendación aplicable en 1 tap.

### P1 — construye el moat (diferenciación híbrida y confianza)

4. **[P1] Demostrar el multidisciplina en el onboarding**: los 2-3 bloques iniciales generados deben poder mezclar fuerza + running/movilidad si el usuario declara varias disciplinas, con campos dinámicos correctos por tipo (kg/reps vs distancia/pace). Es el gap 2 y nadie mainstream lo tiene.
   *Validación*: un beta user híbrido planifica una semana con ≥2 disciplinas sin crear un bloque desde cero; entrevista cualitativa confirma "esto no lo hace mi combinación Strava+Hevy".

5. **[P1] Export CSV/JSON abierto y sin límites desde el día uno** ("tus datos son tuyos" como valor de marca, ataque directo al lock-in de Hevy y a su dependencia de nube).
   *Validación*: export completo de historial funcional antes de beta pública; mencionado en la ficha de App Store.

6. **[P1] Fiabilidad offline total del loop diario** (Hoy, ejecutar, completar, señal de Kai — cero red requerida). Queja documentada contra Hevy en gimnasios sin señal.
   *Validación*: test manual en modo avión: sesión completa de inicio a resumen sin errores ni pérdida de datos tras reinicio.

### P2 — prepara la monetización y la expansión

7. **[P2] Instrumentar el funnel de activación completo** (eventos del PRD §12 Fase 5) y panel semanal de D2/D7/workouts-en-14-días para pilotar la beta con datos, no vibes.
   *Validación*: dashboard (aunque sea script local) reportando las 3 métricas cada semana de beta.

8. **[P2] Definir paywall alineado con el valor "sistema"**: logging ilimitado gratis (commodity — no repetir el error del free tier de Strong); pagar por Kai planificación/adaptación y analytics. Precio ancla $59-89/año, plan anual por defecto (retiene 40-60% mejor).
   *Validación*: ≥5 entrevistas de beta users confirmando qué pagarían; willingness-to-pay declarada ≥ $5/mes en el segmento wedge.

9. **[P2] Analytics de progresión para power users** (tendencias por campo dinámico: e1RM, volumen, pace) — la queja "analytics poco profundos" de Alpha Progression/Hevy es la retención a 6 meses del wedge.
   *Validación*: un usuario migrado de Strong encuentra una tendencia de 6+ meses de su propio historial importado en <30 segundos.

---

*Documento generado por la Directiva de IA de Kairos. Sin cambios de código. Fuentes accedidas el 2026-07-07.*
