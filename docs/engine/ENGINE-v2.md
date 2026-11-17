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

## Fases siguientes

| Fase | Contenido | Métodos |
|---|---|---|
| 3 | Sueño y recuperación | Deuda de sueño con el modelo de dos procesos (Borbély 1982); recuperación por grupo muscular, exponencial con constante dependiente del volumen (48–72 h); check-ins 1–5 con regresión logística ordinal (logit acumulativo) |
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
- Adams RP, MacKay DJC (2007). *Bayesian online changepoint detection.* arXiv:0710.3742.
