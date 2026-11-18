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

## Fase 4 — Detección de cambios y decisión

### Ritmo de progresión con detección online de cambios (BOCPD, Adams & MacKay 2007)

- Serie: incrementos del e1RM entre exposiciones consecutivas de un ejercicio, en % del valor anterior: `x_i = 100·(e_i/e_{i−1} − 1)`.
- Modelo por segmento: `x ~ N(μ, σ²)` con prior Normal-Inversa-Gamma `μ0 = 0.5 %` por exposición, `κ0 = 1`, `α0 = 1`, `β0 = 1`; el predictivo es una t de Student.
- Hazard constante `H = 1/10`: se espera un cambio de régimen cada ~10 exposiciones.
- Se calcula el posterior de la longitud de racha `P(r_t | x_1:t)` y, con él, la mezcla del posterior de `μ` del régimen actual.
- **Estancamiento**: `P(μ < 0.5 % | régimen actual) > 0.75` y al menos 3 incrementos en el régimen. Sustituye al umbral fijo de Theil-Sen.
- **Cambio de tendencia**: `P(r_t ≤ 1) > 0.5`. Se muestra como evidencia («tu progresión cambió»).

### Decisión de carga con pérdida asimétrica

- Capacidad actual: `C ~ N(ĉ, s²)`, con `ĉ = carga·(1 + (reps + RIR)/30)`, que es Epley corregido por las repeticiones en reserva. Se toma la mejor serie de la última exposición.
- La desviación `s` es la mayor entre el 2,5 % de `ĉ` y la DE de los residuos de las últimas 4 exposiciones.
- Carga candidata `L` (actual, +1 y +2 incrementos). Lo que exige: `R(L) = L·(1 + (reps_min + RIR_obj)/30)`, y `p(L) = P(C ≥ R(L))`.
- Utilidad `U(L) = Δ·(p − λ·(1 − p))`, donde Δ es el número de incrementos y `λ = 1.5`. Fallar una progresión cuesta 1,5 veces lo que se gana al acertar, porque supone sesiones perdidas, frustración y riesgo de lesión.
- Se elige la `L` de mayor utilidad. Con un solo incremento, solo se sube si `p > λ/(1+λ) = 0.6`.
- La probabilidad de completar se muestra en la evidencia de la propuesta.

### Tipo de progresión: muestreo de Thompson contextual

- Brazos para fuerza: `increase_load` (más carga) y `add_set` (más volumen).
- Contexto al iniciar cada experimento: banda de disposición (`go`, `easy`, `rest`) y deuda de sueño (`< 2 h` o `≥ 2 h`).
- Modelo jerárquico Beta-Bernoulli:
  - Por brazo: `Beta(1 + éxitos, 1 + fracasos)`.
  - Por (brazo, contexto): se parte del posterior del brazo, reducido a la mitad (pooling parcial), y se suman los datos de ese contexto.
- Decisión: una muestra de cada brazo en el contexto actual, con generador pseudoaleatorio sembrado por el id de sesión, de modo que sea reproducible. Se elige el mayor.
- Barrera de seguridad: si un brazo ha fallado ≥ 3 veces con afinidad < 0.4, se descarta sin muestrear.

### Tests de aceptación (fase 4)

1. Serie plana de 3 incrementos → estancamiento; serie con +2 %/exposición → no.
2. Tras un cambio de régimen (+2 % ×4 y luego ~0), el detector sitúa la frontera y baja el ritmo estimado. Hacen falta ~6 exposiciones estancadas (no 4) para declarar estancamiento, porque la propia frontera es incierta (con 4: P = 0.73; con 6: P = 0.87).
3. 8×3 a 60 kg con RIR 2 y objetivo 6–8 → se sube a 62,5 kg (p > 0.6) y no a 65.
4. Con mucha incertidumbre en la capacidad, no se sube.
5. Thompson: reproducible con la misma semilla; prefiere el brazo con más éxitos en ese contexto; el pooling hace que un contexto sin datos herede el posterior global.

## Fase 5 — Causalidad, adherencia y pensamiento en segundo plano

El motor no se enseña: piensa mientras el usuario descansa y solo le llegan sus decisiones (el descanso que toca, una sesión más ligera, una propuesta). La pantalla «Tu cerebro» queda como inspector de desarrollo (`SHOW_ENGINE_DEBUG`).

### DAG fisiológico (Pearl 2009; Greenland, Pearl y Robins 1999)

- Nodos: tratamiento (condición de una prueba), carga, forma y fatiga (latentes), sueño, estrés (no medido), agujetas, dolor, rendimiento y adherencia.
- Aristas: tratamiento → {carga, rendimiento}; carga → {forma, fatiga, agujetas, dolor}; forma y fatiga → rendimiento; sueño → {rendimiento, agujetas}; estrés → {sueño, rendimiento, adherencia}; agujetas, dolor y rendimiento → adherencia; agujetas y dolor → rendimiento.
- La d-separación se calcula sobre el grafo ancestral moralizado.
- **Covariables seguras** en una prueba aleatorizada: solo las que no descienden del tratamiento. Entra el sueño; las agujetas no, porque son colisionador y mediador.
- **Conjuntos de puerta trasera**:
  - agujetas → rendimiento: {carga, sueño}. El modelo de Banister ya ajusta la carga.
  - sueño → rendimiento: no identificable, por el estrés no medido. La sensibilidad al sueño es una asociación personal, no un efecto causal, y así se trata.

### Supervivencia bayesiana (Weibull con riesgos proporcionales)

- `h(t|x) = θ·k·t^(k−1)·e^(βx)`. Dados `k` y `β`, `θ ~ Gamma` es conjugada, así que se integra de forma exacta en una rejilla (k, β), con prior log-normal sobre `k` y normal sobre `β`.
- La censura por la derecha (el hueco que sigue abierto) solo entra en la exposición `Σ t^k e^(βx)`.
- **Adherencia**:
  - Huecos entre sesiones, con una covariable: si la última sesión fue muy dura (RPE ≥ 8).
  - Prior: mediana `7/días por semana`, `k` centrado en 1,5 (el riesgo sube con el tiempo).
  - Salidas: P(entrenar en 3 y en 7 días), riesgo de que el hueco llegue a 14 días (*lapse*) y razón de riesgos de una sesión dura.
  - Si el riesgo de *lapse* supera 0,5, la revisión semanal propone un plan más ligero aunque la semana no haya sido corta.
- **Recaída de molestias**:
  - Episodios de dolor (check-ins y experimentos), fusionados si están a menos de 7 días.
  - Prior: `k` centrado en 0,8 (el riesgo es máximo justo después) y mediana de 120 días. **Revisar con un experto.**
  - Salida: P(nuevo episodio en 14 días).
- **Pérdida asimétrica dependiente del riesgo**: `λ = 1.5·(1 + 2·riesgo14)`. Con un 25 % de riesgo, un escalón de carga necesita `p > 0.69` en vez de 0,6.

### Pruebas n-of-1 ABAB silenciosas (Duan, Kravitz y Schmid 2013)

- Para elecciones reversibles. La primera es el descanso entre series: 2 min frente a 3,5 min (Grgic et al. 2018).
- Diseño: 4 pares aleatorizados (AB o BA, con semilla), 8 exposiciones. Se aplica en el plan sin pedir nada al usuario.
- Resultado por exposición: capacidad media de las series corregida por RIR, en % frente a la mediana de las 3 exposiciones previas.
- Modelo: `y = μ + γ·tendencia + δ·(B − ½) + β·sueño + ε`, con prior Normal-Inversa-Gamma (σ ≈ 2 %, DE a priori de δ ≈ 2 %).
  - ε AR(1) mediante Prais–Winsten en la rejilla ρ ∈ {0, 0.2, 0.4, 0.6}, ponderada por verosimilitud marginal más el jacobiano `½·ln(1 − ρ²)`.
  - El posterior de δ es una mezcla de t de Student.
- Decisión (ROPE ±1 %, Kruschke 2018), con al menos 2 exposiciones por brazo:
  - Gana B si `P(δ > 1 %) ≥ 0.9`.
  - Gana A si `P(δ < −1 %) ≥ 0.9`.
  - «Da igual» si `P(|δ| < 1 %) ≥ 0.9`.
  - Al terminar el calendario sin decisión, queda el descanso corto, que ahorra tiempo sin pérdida demostrada.
- Factor de Bayes de Savage–Dickey (Wagenmakers et al. 2010) como evidencia adicional.

### Consolidación en segundo plano

- Es un paso puro: avanza o cierra las pruebas y parchea el plan, inicia una prueba nueva (una a la vez, en el ejercicio de fuerza con más historial, a partir de 3 exposiciones), y recalcula la adherencia y el riesgo de dolor.
- También pre-planifica la siguiente sesión: la disposición prevista para ahora, o para mañana a las 9:00 si ya es de noche.
- Se ejecuta tras cada sesión, check-in o cambio de plan, al pasar la app a segundo plano y al volver tras más de 3 h.
- En la sesión en vivo:
  - Se usa el plan previo si se hizo para ese momento (±6 h); si no, se recalcula.
  - Banda «suave» o «descanso»: una serie menos por ejercicio de fuerza (nunca menos de 2), con una línea que explica por qué.
  - Al marcar una serie se inicia la cuenta atrás del descanso que toca.
- **Turno de noche**: tarea del sistema con `expo-background-task` (BGTaskScheduler en iOS, WorkManager en Android), con intervalo mínimo de 6 h. iOS la lanza cuando quiere, normalmente de noche mientras carga.
  - La tarea rehidrata el estado, consolida y espera a que el guardado llegue a disco antes de que el sistema suspenda la app.
  - De madrugada la previsión es para las 9:00 de ese día.
  - Si el usuario desactiva «Actualización en segundo plano» o activa el modo de bajo consumo, se mantienen las pasadas en primer plano.
  - Solo añade claves al Info.plist, sin entitlements, así que firma con Personal Team gratuita.

### Tests de aceptación (fase 5)

1. Condicionar en agujetas abre el camino carga–sueño (colisionador). Solo el sueño es covariable segura del tratamiento. Puerta trasera de agujetas → rendimiento = {carga, sueño}; de sueño → rendimiento = ninguna.
2. Weibull: sin datos, la mediana es la del prior. La censura reduce el riesgo estimado.
3. Adherencia: un usuario regular entrena en 7 días con P > 0,8, y un hueco largo sube el riesgo de *lapse*.
4. Dolor: los episodios cercanos se fusionan, y el riesgo es mayor justo después que 4 meses más tarde.
5. Con riesgo de dolor alto, el mismo caso que sube a 62,5 kg se queda en 60.
6. ABAB:
   - Un efecto real de +5 % se detecta (veredicto B, BF > 3).
   - Con ruido puro no se declara ganador.
   - Una tendencia sola no se confunde con un efecto.
   - No se decide sin 2 exposiciones por brazo.
7. Consolidación:
   - Inicia una prueba y parchea el descanso, y es idempotente.
   - Un dolor reciente da un día de descanso con nota.
   - El recorte nunca baja de 2 series.
   - Fuera de su momento, el plan previo se recalcula.

## Biometría — Apple Watch vía HealthKit

El Apple Watch no necesita app propia para alimentar al motor. Ya guarda en Salud los entrenos (manuales o detectados), el pulso, el sueño, la VFC y el pulso en reposo, y Kairos los lee con `@kingstinct/react-native-healthkit`.

### Flujo

- `src/lib/health/appleHealth.ts` es el puente nativo. Se carga de forma perezosa, así que en web y en tests no hace nada. Lee:
  - Entrenos con consulta anclada: la primera vez, los últimos 60 días; después, solo los nuevos y los borrados.
  - El pulso de cada entreno.
  - Sueño (21 días).
  - VFC SDNN y pulso en reposo (35 días).
- También escribe cada sesión de Kairos en Salud como `HKWorkout`, para que cuente en los anillos.
- `src/features/coach/healthSync.ts` sincroniza al abrir la app, al volver tras más de 3 h y en la tarea nocturna. Si HealthKit está cifrado (iPhone bloqueado), lo salta y consolida con lo que ya hay.
- Cada sincronización con datos nuevos lanza una consolidación, así que el plan de mañana ya usa la noche de hoy.

### Entrenos del reloj → sesiones (`src/lib/health/workoutImport.ts`)

- El deporte sale de `HKWorkoutActivityType`. **Los paseos no se importan**: el reloj los detecta todos y contarlos como entreno ocultaría una caída real de la adherencia.
- El RPE de sesión se estima desde el %FCmáx, con anclas 60 % ≈ 2, 80 % ≈ 5,5 y 90 % ≈ 8 (Foster 2001):
  - En fuerza tiene un suelo de 6, porque el pulso subestima el esfuerzo de las series.
  - Sin pulso, el RPE es 5.
- La FCmáx es la máxima observada en entrenos (si es ≥ 160). Si no, Tanaka 2001 (208 − 0,7·edad), o 190.
- Deduplicación:
  - Los entrenos que escribió el propio Kairos se reconocen por su bundle id y se saltan.
  - Un entreno del reloj que se solapa ≥ 50 % con una sesión de Kairos solo le añade el pulso.
  - Los entrenos borrados en Salud se eliminan.
  - Los de menos de 5 min se ignoran.

### Biometría → disposición (`src/lib/engine/biometrics.ts`)

- **Sueño**:
  - La noche pertenece al día en que te despiertas: todo lo que termina antes de las 14:00.
  - Los intervalos dormidos (core, profundo, REM, sin especificar) de todas las fuentes se unen antes de sumar, así que nada cuenta dos veces.
  - Menos de 2 h no es una noche.
  - Una noche medida sustituye a la respuesta 1–5 en la deuda de sueño (sd 0,3 h) y alimenta el efecto agudo de anoche con la sensibilidad aprendida de la persona.
- **VFC** (Plews 2013; Kiviniemi 2007):
  - `ln(SDNN)` se compara con la línea base propia de los 30 días anteriores, que necesita ≥ 10 días.
  - Solo cuenta por debajo de −1 SD. El efecto es `1,5·(z + 0,5)` %, con un tope de −3 %.
  - Una VFC alta nunca suma: no es motivo para apretar más.
- **Pulso en reposo** (Buchheit 2014):
  - Cuenta si está `max(5 lpm, 1,5 SD)` por encima de la línea base de 30 días.
  - El efecto es `−0,2 %` por lpm, con un tope de −2,5 %.
- VFC y pulso en reposo miden el mismo estado autonómico. La señal más fuerte cuenta entera y la otra a la mitad, para no contar dos veces la misma evidencia.

### Restricciones

- El único entitlement es `com.apple.developer.healthkit`. La entrega en segundo plano está desactivada (`background: false`); ese trabajo lo hace la tarea nocturna. Se cree que HealthKit básico firma con un Personal Team gratuito, pero **Apple no lo confirma**; hay que comprobarlo en el primer build desde el Mac.
- iOS no dice si se denegó la lectura. Una sincronización vacía es la única señal.
- Las series desde la muñeca y el pulso en directo los aporta la app del Apple Watch (siguiente sección).

### Tests de aceptación (biometría)

1. Una noche registrada por el reloj y el iPhone con fases solapadas suma 8 h, no 16. Un fragmento de 1 h no es una noche.
2. Una noche medida de 5 h genera 3 h de deuda aunque el check-in dijera «5 · genial».
3. VFC:
   - Sin línea base de 10 días, no hay señal.
   - Una mañana normal no dice nada.
   - Una caída baja la disposición.
   - Una VFC alta no suma.
4. Pulso en reposo +2 lpm es ruido; +10 lpm es señal. VFC y pulso en reposo juntos cuentan menos que su suma.
5. Entrenos del reloj:
   - Una carrera se convierte en sesión con su pulso.
   - La fuerza mantiene un RPE ≥ 6.
   - Los paseos y los entrenos de menos de 5 min no se importan.
   - Nada se importa dos veces, tampoco los entrenos del propio Kairos.
   - Un entreno solapado enriquece la sesión existente en vez de duplicarla.
   - Un entreno borrado en Salud desaparece.

## App del Apple Watch

Es una app watchOS nativa en SwiftUI (`targets/watch`), generada con `@bacons/apple-targets`. Va dentro de la app del iPhone y su bundle id es el del iPhone más `.watch`. Tiene dos modos.

### Sesión en la muñeca

- La app del reloj recibe la semana con la sesión de hoy primero. Cada sesión lleva el ajuste de la noche (una serie menos y una nota si el día es suave) y las series prerrellenadas igual que en el iPhone (`initialLogs`, `src/lib/adaptive/prefill.ts`).
- Durante la sesión, un `HKWorkoutSession` con `HKLiveWorkoutBuilder` mantiene la app viva con la muñeca bajada y mide pulso, energía y distancia.
- Las series se registran así:
  - Con la corona se ajustan los kg (con el incremento del ejercicio) o las repeticiones.
  - «Hecha» cierra la serie y arranca el descanso del plan, con vibración a 10 s del final y otra al terminar.
  - Si cambias el peso o las repeticiones de una serie, las series siguientes heredan el cambio, para que registrar siga siendo un toque.
- Al terminar se pide el RPE de sesión (1–10, con la corona). El entreno se guarda en Salud y la sesión vuelve al iPhone.
- Hay entreno libre sin plan: solo métricas y RPE.
- Tras un cierre inesperado, `handleActiveWorkoutRecovery` recupera el entreno, y una copia guardada tras cada serie recupera las series.

### Pulso para el iPhone (modo sensor)

- En la sesión en vivo del iPhone, la fuente «Apple Watch» llama a `HKHealthStore.startWatchApp`. El reloj se abre en un entreno y envía su pulso cada ~2 s mientras el iPhone está al alcance.
- Si la sesión se guarda, el reloj conserva su entreno en Salud y el iPhone no exporta otro. Si se cancela, el reloj lo descarta.

### Protocolo (`src/lib/watch/protocol.ts` ↔ `targets/watch/Protocol.swift`)

- iPhone → reloj: `applicationContext["plan"]`. Solo guarda el último estado y se entrega aunque la app del reloj esté cerrada. El reloj lo guarda para funcionar sin el iPhone cerca. El plan se envía solo cuando cambia su contenido (`planKey`): tras cada consolidación, sesión o cambio de FCmáx, y también desde la tarea nocturna.
- Reloj → iPhone: `transferUserInfo["session"]`. El sistema lo pone en cola y lo entrega aunque la app esté cerrada. Si falla, el reloj lo reenvía.
  - El iPhone guarda cada sesión por id en `UserDefaults` hasta que JS la valida (valibot), la registra con `recordSession` y la confirma, así que nada se pierde ni entra dos veces.
  - Una sesión de una versión de protocolo más nueva se queda en cola hasta que una actualización pueda leerla.
- Una sesión registrada en el reloj entra como sesión normal de Kairos: `source: 'kairos'` y `recordedOn: 'watch'`, con los objetivos del borrador del que salió.
  - Su copia en Salud no se importa otra vez. La filtra el `externalId` (UUID del `HKWorkout`) y, aunque la sesión aún no haya llegado, el bundle `<app>.watch`.
- Zonas de pulso: mismos cortes que `hrZone()` y la FCmáx aprendida que envía el iPhone. Los huecos de más de 15 s no cuentan.

### Construir

- La app del iPhone usa el módulo nativo local `modules/kairos-watch` (Expo Modules, autolinking de `./modules`).
- Necesita macOS con Xcode 16 o posterior: `npx expo prebuild -p ios --clean` no genera iOS en Windows.
- Si existe `APPLE_TEAM_ID`, se firman con ese equipo el iPhone y el reloj. Si no, se elige el equipo en Xcode › Signing para los dos targets.
- Con un Personal Team gratuito, HealthKit en el reloj tiene la misma duda que en el iPhone: hay que confirmarlo en el primer build.

### Tests de aceptación (reloj)

1. Plan para el reloj:
   - La sesión de hoy va primero y, si el día es suave, recortada y con su nota.
   - Las series salen prerrellenadas de la última vez.
   - Solo van las sesiones aceptadas; sin plan, la lista va vacía.
   - La clave no cambia si solo cambia la hora.
2. Validación en la frontera:
   - JSON roto, RPE fuera de rango, deporte desconocido o versión futura: no se aceptan.
   - Un pulso de 0 no es una lectura.
3. Una sesión del reloj se convierte en `SessionLog`:
   - Con los objetivos del plan.
   - Con el RPE redondeado a 0,5.
   - Sin los ejercicios sin series.
   - El entreno libre o un plan que ya cambió también entran.
4. La copia en Salud de un entreno del reloj no se importa dos veces: ni por UUID ni por bundle.

## Calibración y panel de perspectivas

El motor razona como un profesional con formación en biotecnología, fisioterapia y preparación física: mira el mismo día desde varios ángulos, decide en un orden fijo y solo se fía de cada ángulo tanto como haya acertado contigo.

### Calibración prequencial (`src/lib/engine/calibration.ts`, `backtest.ts`)

- **Repetición del pasado (Dawid 1984).** Cada predicción se vuelve a hacer con los datos que había en ese momento y se compara con lo que pasó. Siempre juzga el modelo actual y tiene historial desde el primer día; no hace falta un registro que tarde semanas en llenarse.
- **Familias:**

| Familia | Predicción | Resultado | Perspectiva |
|---|---|---|---|
| `readiness` | P(rendimiento ≥ nivel − SWC), sin el tope de dolor | Observación de fuerza de esa sesión | Fisiología |
| `performance` | Rendimiento esperado ± SD | Rendimiento observado | Fisiología (intervalo) |
| `load` | P(completar el objetivo con la carga usada), desde la exposición anterior | Alguna serie con reps + RIR ≥ objetivo | Preparación física |
| `adherence` | P(volver a entrenar en 7 días) tras cada salida | Hubo sesión en 7 días (sin resolver hasta que pasa la semana) | Hábito |
| `pain` | P(nuevo episodio de dolor en 14 días), una por semana | Empezó un episodio nuevo (> 7 días tras el anterior) | Fisioterapia |

- **Puntuación.** Brier frente a la tasa base acumulada con Beta(1,1), que hace de «el que no sabe nada»; skill = 1 − Brier/Brier_ref. ECE y diagrama de fiabilidad en 5 tramos con intervalo de Wilson al 80 %.
- **Corrección.** Recalibración logística bayesiana p' = σ(a + b·logit p), con priors a ~ N(0, 0,3²) y b ~ N(1, 0,3²); MAP por Newton y Laplace. Con pocos datos se queda cerca de la identidad. El Brier corregido también es prequencial: la corrección para la predicción i se ajusta solo con las anteriores.
- **Veredicto.** Por debajo de 15 comprobaciones dice `learning`. Después necesita un 80 % de masa posterior más allá de un margen que importe: pendiente fuera de [0,8; 1,25] (`overconfident` / `underconfident`) o sesgo de más de ±0,25 logits (`optimistic` / `pessimistic`). Sin margen, con datos suficientes cualquier oscilación trivial saldría como hallazgo.
- **Intervalos.** z = (y − μ)/σ: sesgo, dispersión, cobertura al 80 % y un factor de varianza con posterior inversa-gamma (α₀ = 3, β₀ = 2).
- **Dónde se aplica.** La disposición y el riesgo de dolor y de abandono se corrigen antes de decidir. `chooseLoad` corrige su probabilidad de éxito antes de calcular la utilidad, así que una subida de carga necesita el umbral con la probabilidad ya corregida.

### Panel de perspectivas (`src/lib/engine/lenses.ts`)

| Perspectiva | Mira | Postura |
|---|---|---|
| Fisioterapia | Dolor reciente, riesgo de recaída a 14 días, recuperación de las regiones que carga la sesión, carga aguda:crónica (señal, no predictor: Impellizzeri 2020) | `rest` con dolor; `ease` si una región va < 50 % o hay pico de carga; `steady` (sin subir carga) si el riesgo de recaída ≥ 25 % |
| Fisiología | Disposición (forma-fatiga, sueño, VFC, FC en reposo, monotonía), ya corregida | `push` ≥ 65 %, `ease` ≥ 40 %, `rest` por debajo |
| Hábito | Supervivencia de los huecos entre sesiones, efecto de las sesiones muy duras | `ease` (sesión corta mejor que ninguna) con riesgo de abandono ≥ 40 % y ≥ 3 días sin entrenar |
| Preparación física | Estancamiento por BOCPD, series semanales por región (6–25; agarre y core no se dosifican), proporción de cardio suave (Seiler 2010) | `steady` si la mitad o más de los ejercicios de fuerza están estancados |

- **Decisión.** Manda la postura más prudente; en caso de empate, el orden es tejido → estado → hábito → progreso. `rest` → descanso, `ease` → una serie menos y `push`/`steady` → sesión normal. Si una perspectiva está dos niveles por encima del veredicto, se dice una vez («Fisiología te ve bien (82 %), pero manda fisioterapia»).
- **Plan del día.** `DayPlan` guarda `lead` y `stance`, y `probability` es la disposición ya corregida (con tope de 0,35 si hay dolor).
- **Qué ve el usuario.** En Hoy, «Cuatro miradas sobre hoy»: una línea por perspectiva y, al tocarla, sus hallazgos con fuentes, la previsión corregida y su fiabilidad («Cuando digo 70 %, pasa el 68 % · 24 comprobaciones»). El funcionamiento interno sigue oculto.

### Tests de aceptación (calibración y panel)

1. Unas previsiones honestas se ajustan a la identidad y salen `calibrated`, con skill > 0.
2. Unas previsiones demasiado extremas salen `overconfident`, y la corrección baja el Brier.
3. Unas previsiones altas salen `optimistic`, y 0,6 se corrige por debajo de 0,5.
4. Con 4 previsiones el veredicto es `learning`, y la corrección mueve menos de 12 puntos.
5. Una moneda al aire no tiene skill frente a la tasa base.
6. Unos intervalos demasiado estrechos dan cobertura < 65 % y un factor de varianza > 3.
7. La repetición nunca usa el futuro: cambiar la última sesión no cambia las previsiones anteriores.
8. Las previsiones de constancia esperan a que pase la semana; las de dolor cuentan solo episodios nuevos, una por semana.
9. Con dolor reciente decide fisioterapia y el día es de descanso. Tras un hueco largo, el hábito pide sesión corta. Con un estancamiento se mantiene la carga sin recortar series.
10. Un historial de exceso de confianza acerca a 50 % la previsión de fisiología y lo dice.

## Fases siguientes

| Fase | Contenido | Métodos |
|---|---|---|
| BG | Aviso adaptativo | Notificación local a la hora de mayor probabilidad de entrenar cuando sube el riesgo de *lapse* (requiere `expo-notifications`, que añade entitlement de push: comprobar con Personal Team) |
| 6 | Segundo cerebro | Grafo de conocimiento (nodos = estados y parámetros); hipótesis de la capa neuronal validadas por factor de Bayes; consolidación nocturna; inspector interno, no visible |
| Continuo | Calibración | Hecho (ver «Calibración y panel de perspectivas»). Pendiente: diagrama de fiabilidad completo en el inspector interno |

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
- Pearl J (2009). *Causality* (2nd ed.). Cambridge University Press.
- Greenland S, Pearl J, Robins JM (1999). *Causal diagrams for epidemiologic research.* Epidemiology.
- Ibrahim JG, Chen MH, Sinha D (2001). *Bayesian Survival Analysis.* Springer.
- da Silva T et al. (2019). *Recurrence of low back pain is common: a prospective inception cohort study.* J Physiother.
- Duan N, Kravitz RL, Schmid CH (2013). *Single-patient (n-of-1) trials: a pragmatic clinical decision methodology for patient-centered comparative effectiveness research.* J Clin Epidemiol.
- Grgic J et al. (2018). *Effects of rest interval duration in resistance training on measures of muscular strength: a systematic review.* Sports Med.
- Kruschke JK (2018). *Rejecting or accepting parameter values in Bayesian estimation.* Adv Methods Pract Psychol Sci.
- Wagenmakers EJ et al. (2010). *Bayesian hypothesis testing for psychologists: a tutorial on the Savage–Dickey method.* Cogn Psychol.
- Plews DJ et al. (2013). *Training adaptation and heart rate variability in elite endurance athletes: opening the door to effective monitoring.* Sports Med.
- Kiviniemi AM et al. (2007). *Endurance training guided individually by daily heart rate variability measurements.* Eur J Appl Physiol.
- Buchheit M (2014). *Monitoring training status with HR measures: do all roads lead to Rome?* Front Physiol.
- Foster C et al. (2001). *A new approach to monitoring exercise training.* J Strength Cond Res.
- Tanaka H, Monahan KD, Seals DR (2001). *Age-predicted maximal heart rate revisited.* J Am Coll Cardiol.
