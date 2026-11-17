# Kairos Engine v2 — especificación técnica

_Versión 0.1 · 2026-11-17 · Estado: fase 2 en implementación._

## Principio

> La fisiología fija la **estructura** del modelo y sus **priors**; los datos de cada persona ajustan los **parámetros**, siempre con su **incertidumbre**.

- Todo se calcula en el dispositivo, sin servidor ni coste por usuario.
- Ninguna salida es un número suelto: cada estimación lleva su distribución, o al menos media y varianza.
- Las reglas fisiológicas actúan como **restricciones duras** sobre los parámetros (por ejemplo, ganancias ≥ 0 y τ_fatiga < τ_forma) y como **límites de seguridad** sobre las propuestas.
- La capa neuronal (LLM pequeño y embeddings) solo **propone hipótesis**; la capa estadística las acepta o las rechaza con evidencia cuantitativa (factor de Bayes). Se implementa en una fase posterior.
- Cada regla fisiológica lleva su referencia en código (`source`) para poder auditarla y mostrarla al usuario.

## Notación

| Símbolo | Significado | Unidad |
|---|---|---|
| `w_t` | Impulso de entrenamiento del día *t* | UA/100 (sRPE × min / 100) |
| `g_t`, `h_t` | Forma (fitness) y fatiga latentes | UA/100 acumuladas |
| `τ1`, `τ2` | Constantes de decaimiento de forma y de fatiga | días |
| `θ = [p0, k1, k2]` | Rendimiento basal y ganancias de forma y fatiga | % , %/UA |
| `y_t` | Marcador de rendimiento observado | % sobre la referencia personal |
| `P` | Covarianza posterior de θ | — |

## Fase 2 — Modelo forma-fatiga (Banister) con estimación bayesiana recursiva

### Estructura (fisiología)

El modelo es el de Banister (1975), en su forma recursiva diaria:

```
g_t = g_{t-1}·e^(−1/τ1) + w_t
h_t = h_{t-1}·e^(−1/τ2) + w_t
p̂_t = p0 + k1·g_t − k2·h_t
```

- **Priors de τ** (Banister 1975; Busso 2003; revisión de Clarke y Skiba 2013): `τ1 ≈ 42 d`, `τ2 ≈ 7 d`.
  - Restricción: `τ2 < τ1`, con `τ1 ∈ [20, 60]` y `τ2 ∈ [3, 15]`.
- **Priors de las ganancias**: `k1 ~ N(0.05, 0.05²)` y `k2 ~ N(0.15, 0.10²)`.
  - Restricción: `k1, k2 ≥ 0`.
  - La fatiga pesa más que la forma a corto plazo (`E[k2] > E[k1]`). Esto reproduce la caída tras una carga alta y la supercompensación posterior.
- **Prior del basal**: `p0 ~ N(0, 3²)` %.

### Observaciones (qué se mide)

El marcador principal es el **índice de fuerza** de cada sesión.

- Para cada ejercicio de fuerza: `100 · (e1RM_sesión / ref_ejercicio − 1)`.
  - `e1RM` se calcula con Epley, solo con series de ≤ 10 repeticiones.
  - `ref_ejercicio` es la mediana de las 3 primeras exposiciones de ese ejercicio. Así la escala es personal y comparable entre ejercicios.
- `y_t` es la media de esos valores en la sesión.
- Ruido de observación: `σ_y² = 4²` (% al cuadrado), que refleja la variabilidad día a día de la fuerza estimada.
- Las sesiones sin fuerza aportan **impulso pero no observación**. Los marcadores de resistencia (ritmo a pulso constante y potencia crítica) se añaden en la fase 3, con datos de sensores.

### Estimación (estadística)

Con τ fijos, `p̂_t` es **lineal en θ** para unos regresores `φ_t = [1, g_t, −h_t]`. Por eso se usa un **filtro de Kalman sobre los parámetros**, que equivale a una regresión bayesiana recursiva:

```
Predicción:   P ← P + Q                      (Q: deriva lenta; el cuerpo cambia)
Innovación:   e = y_t − φ_tᵀθ
              S = φ_tᵀ P φ_t + σ_y²
Ganancia:     K = P φ_t / S
Actualización: θ ← θ + K e ;  P ← (I − K φ_tᵀ) P
Restricción:  θ se proyecta al conjunto factible (k1, k2 ≥ 0)
```

- `Q = diag(0.05², 0.0005², 0.001²)` por día: deriva lenta de los parámetros. Hace que el modelo olvide poco a poco, porque la fisiología cambia con el tiempo.
- **Ajuste de τ** (en la consolidación nocturna): se evalúa una rejilla `τ1 ∈ {28, 35, 42, 50}` × `τ2 ∈ {5, 7, 10}`, filtrando el historial completo con cada pareja. Se elige la que maximiza la verosimilitud marginal `Σ log N(e_t; 0, S_t)` más un prior log-normal sobre τ centrado en (42, 7). Cuesta 12 pasadas lineales, del orden de milisegundos.
- **Salida para el día *t***:
  - media predictiva `p̂_t`;
  - varianza predictiva `φ_tᵀ P φ_t + σ_y²`;
  - **forma neta** `k1·g − k2·h` con su desviación.

### Disposición (readiness) probabilística

`P(rinde hoy ≥ su nivel reciente − SWC)`, donde:

- `SWC = 0.2 · DE_entre_días`, el cambio mínimo relevante (Hopkins 2004). Por defecto 1 %.
- El nivel reciente es la media del predictivo de los últimos 14 días.

Esa probabilidad se convierte a log-odds y se ajusta con los check-ins mediante **cocientes de verosimilitud basados en la literatura**. Son fijos en la fase 2 y se personalizan en la fase 3 con un modelo ordinal.

| Señal | Ajuste (log-odds) | Fuente |
|---|---|---|
| Sueño 1–2 / 5 | −0.8 / −0.5 | Fullagar 2015; Craven 2022: la restricción de sueño reduce sobre todo el rendimiento de resistencia y técnico |
| Sueño 5 / 5 | +0.2 | — |
| Agujetas 4 / 5 | −0.5 / −0.9 | Cheung 2003: las agujetas reducen fuerza y rango hasta 72 h |
| Dolor en las últimas 72 h | −1.5 y cap de banda "descanso" | Regla de seguridad |
| Monotonía > 2.0 y tensión en el percentil 90 personal | −0.4 | Foster 1998 |

- El modelo por sí solo nunca supera 90 % ni baja de 10 %: con ~4 % de ruido diario, más certeza sería falsa.
- **Bandas**: `≥ 0.65` entrenar, `0.40–0.65` suave, `< 0.40` descanso.
- La salida incluye siempre la probabilidad, las razones con su fuente y `informed`: si hay menos de 3 observaciones, se avisa de que se basa en los estudios y aún no en los datos del usuario.

### Monotonía y tensión (Foster 1998)

```
monotonía = media(carga diaria 7 d) / DE(carga diaria 7 d)
tensión   = carga semanal · monotonía
```

Se calculan con los días sin entrenar incluidos (carga 0). El cociente agudo/crónico (ACWR) **no** se usa para predecir lesiones, porque su validez está discutida (Impellizzeri 2020).

## Fase 3 — Sueño, recuperación por región y sensibilidad personal

Todas las señales se expresan en **unidades de rendimiento (%)** y desplazan la media predictiva del modelo forma-fatiga; la disposición se calcula después con `Φ`. Así cada efecto es interpretable ("−2,1 % por el sueño") y su incertidumbre se suma a la varianza predictiva, en lugar de sumar log-odds arbitrarios.

```
μ_hoy = p̂_FF + Σ efectos_i            σ²_hoy = σ²_FF + Σ var(efectos_i)
P(rinde ≥ nivel − SWC) = 1 − Φ((nivel − SWC − μ_hoy) / σ_hoy)
```

### Deuda de sueño (proceso homeostático, Borbély 1982)

- Horas por noche: `sleepHours` si existe (HealthKit, más adelante); si no, se estiman desde la escala 1–5 con `{1: 4.5, 2: 5.75, 3: 6.75, 4: 7.5, 5: 8.25}` h y una incertidumbre de ±1 h (σ = 1).
- Necesidad: `N ~ N(8, 0.5²)` h. Consenso de ≥ 7 h en adultos, más en deportistas (Watson 2015).
- Deuda acumulada con recuperación incompleta (Belenky 2003): `D_t = D_{t−1}·e^(−1/4) + max(0, N − h_t)`. Las noches sin dato no suman ni restan; solo decae lo que ya había.
- Efecto: `−γ·D`, con `γ ~ N(0.35, 0.15²)` % por hora de deuda y un tope de −6 %.

### Efecto agudo de la última noche y de las agujetas (efecto monótono con escala personal)

La escala 1–5 es ordinal: no se promedia. Se usa una **forma monótona fija** tomada de la literatura y un **factor de escala personal β** (efecto monótono, análogo a `mo()` de Bürkner & Charpentier 2020):

| Nivel | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| `s_sueño(k)` | −1.00 | −0.55 | −0.15 | 0 | +0.10 |
| `s_agujetas(k)` | 0 | 0 | −0.20 | −0.55 | −1.00 |

- `efecto = β·s(k)`, con priors `β_sueño ~ N(3.0, 1.5²)` % y `β_agujetas ~ N(3.0, 1.5²)` %. Con estos priors, dormir 1/5 resta ≈ 3 % (Fullagar 2015; Craven 2022) y agujetas 5/5 restan ≈ 3 % (Cheung 2003).
- **Aprendizaje personal**: cada sesión con fuerza observada y check-in previo da un residuo `r = y − p̂_FF`. Se actualizan β conjugadamente (regresión bayesiana en 2D sobre `[s_sueño, s_agujetas]`, ruido `σ_y`). Restricción: β ≥ 0, porque dormir peor nunca mejora el rendimiento.

### Recuperación por región muscular

- Regiones: `piernas`, `cadena posterior`, `tracción`, `empuje`, `core`, `agarre`, `pantorrillas`. Cada movimiento del catálogo tiene un mapa de pesos por región (0–1).
- Daño de una sesión en la región *r*: `Σ series · w_r · i(RIR)`, donde `i(RIR) = 1 + 0.15·max(0, 3 − RIR)`, porque cerca del fallo el daño es mayor (Helms 2016). Los ejercicios pliométricos y excéntricos suman un 20 % más.
- Fatiga residual: `F_r(t) = Σ_sesiones D·e^(−Δt/τ_r)`, con `τ_r = m · 24 h · (1 + 0.25·ln(1 + series))`. A más volumen, recuperación más lenta. Base de 48–72 h hasta ~90 % (McLester 2003; Bishop 2008).
- Recuperado: `R_r = 1 − min(1, F_r / F_ref)`, con `F_ref` = daño de una sesión dura típica (12 series a RIR 1).
- **Ritmo personal** `m ~ LogNormal(0, 0.3²)`: posterior en rejilla `m ∈ {0.6 … 1.8}`. La verosimilitud viene de los check-ins de agujetas mediante un modelo **logit acumulativo** (umbrales fijos y pendiente 4) sobre la fatiga predicha de la región más castigada. Si reportas agujetas cuando el modelo te creía recuperado, `m` sube (recuperas más lento), y al revés.
- Efecto en la disposición: si la siguiente sesión carga una región con `R < 0.7`, `−4 %·(0.7 − R)/0.7` ponderado por el peso de esa región en la sesión.

### Tests de aceptación (fase 3)

1. Tres noches a 2/5 acumulan deuda; dos noches buenas la reducen sin borrarla.
2. Forma monótona: peor sueño ⇒ efecto ≤; más agujetas ⇒ efecto ≤.
3. Atleta sintético con β_sueño real = 6 %: el posterior se mueve de 3 hacia 6 y su varianza baja.
4. Sentadilla pesada ayer ⇒ piernas < 70 %; a las 96 h > 90 %; el doble de series recupera más lento.
5. Agujetas 5/5 con el modelo creyéndote recuperado ⇒ `m` sube.
6. La disposición baja si la siguiente sesión carga una región sin recuperar y no cambia si carga otra.
7. El dolor sigue forzando "descanso".

## Fases siguientes

| Fase | Contenido | Métodos |
|---|---|---|
| 4 | Detección y decisión | Detección online de cambios de tendencia (BOCPD, Adams y MacKay 2007) en lugar del umbral Theil-Sen; bandido contextual con muestreo de Thompson para el tipo de progresión; pérdida asimétrica (pasarse cuesta más que quedarse corto) |
| 5 | Causalidad y adherencia | Experimentos n-of-1 ABAB con estimación bayesiana del efecto; DAG fisiológico para evitar condicionar en colisionadores; supervivencia (Cox o Weibull) para abandono y recaída de molestias |
| 6 | Segundo cerebro | Grafo de conocimiento (nodos = estados y parámetros); hipótesis de la capa neuronal validadas por factor de Bayes; consolidación nocturna; pantalla «Tu cerebro» |
| Continuo | Calibración | Diagrama de fiabilidad: si dice 70 %, ¿acierta el 70 %? Se muestra al usuario |

## Tests de aceptación (fase 2)

1. **Sin datos**: el predictivo es igual al prior, `informed = false` y la varianza es la del prior.
2. **Atleta sintético** con θ real conocido: tras 60 días el filtro recupera los signos (`k1, k2 > 0`), reduce el error predictivo frente al prior y la varianza de θ disminuye de forma monótona.
3. **Pico de carga**: tras 3 días de carga ×3, la disposición baja. Tras 7 días de descarga, sube por encima del nivel previo (supercompensación).
4. **Restricciones**: nunca `k < 0` aunque los datos empujen.
5. **Rejilla de τ**: con datos generados con τ2 = 5, se prefiere τ2 = 5 frente a 10.
6. **Monotonía**: semana de cargas idénticas → monotonía alta; semana variada → baja.
7. **Check-ins**: sueño 1 reduce la probabilidad y el dolor fuerza la banda "descanso".

## Referencias

- Banister EW et al. (1975). *A systems model of training for athletic performance.* Aust J Sports Med.
- Busso T (2003). *Variable dose-response relationship between exercise training and performance.* Med Sci Sports Exerc.
- Clarke DC, Skiba PF (2013). *Rationale and resources for teaching the mathematical modeling of athletic training and performance.* Adv Physiol Educ.
- Foster C (1998). *Monitoring training in athletes with reference to overtraining syndrome.* Med Sci Sports Exerc.
- Hopkins WG (2004). *How to interpret changes in an athletic performance test.* Sportscience.
- Fullagar HHK et al. (2015). *Sleep and athletic performance.* Sports Med.
- Craven J et al. (2022). *The effect of consecutive nights of sleep restriction on athletic performance: a systematic review.* Sports Med.
- Cheung K, Hume P, Maxwell L (2003). *Delayed onset muscle soreness.* Sports Med.
- Impellizzeri FM et al. (2020). *Acute:chronic workload ratio: conceptual issues and fundamental pitfalls.* Int J Sports Physiol Perform.
- Borbély AA (1982). *A two process model of sleep regulation.* Hum Neurobiol.
- Watson NF et al. (2015). *Recommended amount of sleep for a healthy adult.* Sleep.
- Belenky G et al. (2003). *Patterns of performance degradation and restoration during sleep restriction and subsequent recovery.* J Sleep Res.
- Bürkner PC, Charpentier E (2020). *Modelling monotonic effects of ordinal predictors in Bayesian regression models.* Br J Math Stat Psychol.
- McLester JR et al. (2003). *A series of studies—a practical protocol for testing muscular endurance recovery.* J Strength Cond Res.
- Bishop PA, Jones E, Woods AK (2008). *Recovery from training: a brief review.* J Strength Cond Res.
- Helms ER et al. (2016). *Application of the repetitions in reserve-based RPE scale for resistance training.* Strength Cond J.
- Adams RP, MacKay DJC (2007). *Bayesian online changepoint detection.* arXiv:0710.3742.
