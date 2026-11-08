# Kairos Coach — objetivos y hoja de ruta

_Última revisión: 2026-11-08. Documento vivo: se actualiza al cerrar cada fase._

## Qué es Kairos

Un entrenador que aprende de ti. Le dices qué quieres conseguir, te propone qué hacer, comprueba si funcionó y ajusta. Sirve para cualquier deporte, funciona solo con el iPhone y mejora si conectas un reloj o un sensor.

## Principios (no negociables)

1. **Sin dependencia de la IA.** El motor de reglas genera planes y progresiones sin conexión y sin coste. La IA interpreta, explica y, en premium, crea. Si la IA falla, la app sigue funcionando entera.
2. **El nivel sin dispositivos es el producto principal.** Con el iPhone basta: series, tiempo, GPS, Apple Salud y el esfuerzo del 1 al 10. Los dispositivos aumentan la precisión, pero la experiencia es la misma.
3. **Cada propuesta enseña sus pruebas.** Nada de consejos de manual: todo cambio cita los datos propios del usuario que lo justifican.
4. **Las cifras de seguridad las pone código determinista.** Esto incluye los topes de carga, las descargas y las señales de fatiga, aunque la propuesta venga de la IA premium.
5. **Los dispositivos no son de pago.** Se paga por la inteligencia, no por conectar hardware.

## Arquitectura en 4 capas

```
┌────────────────────────────────────────────────────────────┐
│ 4. Coach IA premium  — crea sesiones/ejercicios nuevos,    │
│    revisión semanal narrada, conversación                   │
├────────────────────────────────────────────────────────────┤
│ 3. Bucle de experimentos — check-ins, propuestas "a probar",│
│    validación del resultado, aprendizaje de qué te funciona │
├────────────────────────────────────────────────────────────┤
│ 2. Árbol de capacidades — modelo vivo del usuario:          │
│    cualidades y habilidades por deporte, con nivel y pruebas│
├────────────────────────────────────────────────────────────┤
│ 1. Motor + biblioteca — reglas de progresión (ya existe) y  │
│    miles de ejercicios con metadatos y grafo de variantes   │
└────────────────────────────────────────────────────────────┘
        Datos: sesiones · series · check-ins · sensores
```

### 1. Biblioteca de ejercicios (objetivo: miles)

Cada ejercicio no es un nombre suelto. Es un registro estructurado con estos campos:

- Patrón de movimiento.
- Músculos.
- Material necesario.
- Dificultad del 1 al 5.
- Cualidades que entrena.
- Deportes a los que transfiere.
- Métricas que admite: kg, repeticiones, tiempo, distancia, ritmo y vatios.
- Indicaciones técnicas.
- Contraindicaciones.
- Medio: vídeo o ilustración.

Los ejercicios se enlazan entre sí en un **grafo de variantes**, de modo que el motor puede subir o bajar dificultad, o sustituir uno por otro, sin depender de la IA:

- `progresa_a` / `regresa_a`: pasar a una versión más difícil o más fácil.
- `sustituto_de`: mismo patrón con otro material.

**Fuentes, por orden:**

1. **Conjuntos abiertos como base.** _Revisar la licencia de cada uno antes de importarlo._
   - free-exercise-db: unos 800 ejercicios, dominio público.
   - wger: licencia CC-BY-SA, obliga a citar la fuente.
2. **Ampliación con IA bajo revisión humana**:
   - La IA propone variantes y metadatos.
   - Un script valida el esquema.
   - Tú apruebas por lotes.
3. **Ejercicios creados por el coach premium.** Entran como «ejercicio personal» del usuario y, si se repiten entre usuarios, pasan a revisión para incorporarse al catálogo.

**Almacenamiento:**

- La biblioteca va en **SQLite local** (expo-sqlite), con búsqueda de texto completo, para que funcione sin conexión con miles de registros.
- Se actualiza desde Supabase por versiones.

### 2. Árbol de capacidades

Es el «modelo del usuario». Cada nodo es una capacidad con un nivel de 0 a 5, una tendencia y las pruebas que lo sostienen. Algunos ejemplos:

- `resistencia.aerobica`
- `fuerza.traccion`
- `padel.desplazamiento_lateral`
- `movilidad.cadera`

- **Cómo se calibra:** el punto de partida sale del onboarding (pruebas sencillas y nivel declarado). Después lo ajustan las sesiones y los check-ins.
- **Cómo crece:** una rama nueva se desbloquea cuando el usuario demuestra la base. Por ejemplo, las dominadas lastradas aparecen al llegar a 8 dominadas estrictas.
- **Cómo se ve:** es la pantalla que responde a la pregunta «¿qué sabe Kairos de mí?» y hace visible el progreso.
- **Cómo se usa:** tanto el motor como la IA eligen ejercicios y propuestas en función de lo que el árbol dice que te falta para tu objetivo.

### 3. Bucle de experimentos (gratis y premium)

Una propuesta es un **experimento**, no una orden. Por ejemplo: «Prueba 4×8 con 42,5 kg durante 2 semanas».

1. **Proponer.**
   - Después de entrenar.
   - Y también **sin entrenar**: el check-in semanal puede activar propuestas.
2. **Probar.** El experimento queda activo durante un periodo concreto.
3. **Validar.** Al cerrar el periodo se le pregunta al usuario: «¿Lo hiciste? ¿Lo conseguiste? ¿Cómo te sentiste?».
4. **Aprender.** El resultado actualiza el árbol y también **qué tipo de propuestas te funcionan**. Por ejemplo, si respondes mejor a más series que a más peso, el motor da más peso a ese tipo de propuesta.

**Check-ins (siempre cortos, entre 10 y 20 segundos):**

| Momento | Preguntas |
|---|---|
| Al terminar una sesión | Esfuerzo 1–10 · ¿completaste todo? · una sensación (fácil / justo / duro / dolor) |
| Antes de entrenar (opcional) | Sueño 1–5 · agujetas 1–5 |
| Semanal (domingo, notificación local) | ¿Cuántos días entrenaste? (incluye lo que no registraste) · ¿algún dolor? · semana: suave / normal / dura |
| Cierre de experimento | ¿Lo hiciste? · ¿lo lograste? · ¿lo mantienes? |

- **Plan gratis:** todo se ejecuta en el dispositivo, con notificaciones locales y sin servidor.
- **Plan premium:** además, una revisión semanal en el servidor que hace la IA.

### 4. Coach IA premium

**No entrenamos un modelo propio desde cero.** Hoy no es viable: necesitaríamos muchos datos y mucho dinero, y no mejoraría lo que ya hace bien un modelo de primer nivel. El camino es este:

- **Fase A (lanzamiento).**
  - Usamos un modelo existente: Claude, GPT o similar.
  - El modelo recibe el contexto del usuario: árbol, historial, check-ins, experimentos y biblioteca.
  - Trabaja con **herramientas**: buscar ejercicio, crear ejercicio, proponer sesión y leer tendencia.
  - Responde con **salidas estructuradas** que se validan contra el esquema.
  - Puede crear rutinas y ejercicios fuera del catálogo, pero cada salida pasa por los topes de seguridad del motor.
- **Fase B (con datos reales y consentimiento).**
  - Usamos como ejemplos las propuestas que los usuarios aceptaron y que funcionaron.
  - Con ellas ajustamos (fine-tuning) un modelo más pequeño y barato, específico de Kairos.
  - Ese modelo pasa a ser «nuestro modelo»: más barato por usuario y con el criterio propio de Kairos.
- **Infraestructura:**
  - Las llamadas siempre pasan por una función de Supabase, nunca con la clave dentro de la app.
  - Hay una cuota por plan y un registro de coste por usuario.

### Planes

| | Gratis | Premium |
|---|---|---|
| Objetivo en texto libre → plan borrador | ✓ (reglas + IA ligera con cuota) | ✓ ilimitado |
| Biblioteca completa y grafo de variantes | ✓ | ✓ |
| Progresiones del motor con pruebas | ✓ | ✓ |
| Check-ins y experimentos | ✓ | ✓ |
| Árbol de capacidades | ✓ básico | ✓ completo, con ramas por deporte |
| Sensores BLE / Apple Watch | ✓ | ✓ + análisis avanzado (deriva de pulso, VFC) |
| Sesiones y ejercicios creados a medida por IA | — | ✓ |
| Revisión semanal narrada y conversación con el coach | — | ✓ |

- Cobros con **RevenueCat** sobre StoreKit.

## Onboarding (decide la calidad de todo lo demás)

Máximo de 2 a 3 minutos. Solo se pregunta lo que cambia el plan:

1. El objetivo en tus palabras (ya funciona).
2. El deporte y el nivel actual.
3. Los días por semana y los minutos por sesión.
4. El material disponible: casa, gimnasio, parque o nada.
5. Lesiones o molestias.
6. **Pruebas de partida opcionales**, de unos 5 minutos, sin aparatos:
   - Flexiones máximas.
   - Plancha.
   - Sentadilla a una pierna asistida.
   - 12 minutos andando o corriendo con GPS.

   Con ellas se calibra el árbol desde el primer día. Si te las saltas, el árbol empieza con lo que has declarado y se calibra durante las 2 o 3 primeras sesiones.

## Hoja de ruta

Cada fase sigue este orden: pensar → planificar → construir → revisar → probar en el iPhone → publicar.

| Fase | Entregable | Hecho cuando |
|---|---|---|
| **0 · Dirección visual** ← _ahora_ | Referencias de fuera (no fitness genérico) → 3 direcciones visuales en maqueta (objetivo + propuesta desbloqueada) → elección → sistema de diseño v2 (tipografía propia, tokens, movimiento) | Álvaro elige una dirección y las 5 pantallas del coach se rehacen con ella |
| **1 · Biblioteca** | Esquema de ejercicio + grafo de variantes, importación de datasets abiertos (licencias verificadas), SQLite local con búsqueda, motor y borrador usando la biblioteca | ≥1.000 ejercicios con metadatos completos; el borrador elige por material, nivel y deporte |
| **2 · Onboarding + árbol** | Onboarding nuevo, pruebas de partida, modelo de datos del árbol, pantalla «Lo que Kairos sabe de ti» | El árbol se calibra con el onboarding y se actualiza tras cada sesión |
| **3 · Bucle de experimentos** | Check-ins (sesión / semanal / cierre), notificaciones locales, experimentos con periodo y validación, pesos por tipo de propuesta, pruebas citadas en cada tarjeta | Una propuesta puede nacer de un check-in sin entrenar y su resultado cambia las siguientes |
| **4 · Nivel sin dispositivos completo** | GPS para correr/andar, Apple Salud, readiness por sueño/agujetas | Un usuario solo con iPhone recibe progresiones de fuerza y resistencia con pruebas |
| **5 · Backend y cobros** | Cuenta y sincronización con Supabase, proxy de IA con cuotas, RevenueCat, paywall | Datos a salvo entre dispositivos; plan premium comprable en TestFlight |
| **6 · Coach IA premium (fase A)** | Agente con herramientas sobre biblioteca, árbol e historial; creación de sesiones/ejercicios fuera de catálogo con validación y topes | El coach crea una semana nueva y coherente que el motor acepta sin saltarse topes |
| **7 · Apple Watch** | App watchOS (SwiftUI), sesión en directo y pulso en vivo, VFC y pulso en reposo | Una sesión en el reloj llega completa al iPhone |
| **8 · Modelo propio (fase B)** | Dataset con consentimiento, fine-tuning de un modelo pequeño, comparación A/B con el modelo base | El modelo propio iguala la calidad con menor coste |

**Estado actual:**

- La rama `feat/adaptive-coach-prototype` ya incluye el motor de reglas, los sensores BLE, las 5 pantallas del coach y la interpretación del objetivo con IA (con las reglas como respaldo). Es la base de las fases 1 a 4.
- Lo pendiente del entorno:
  - Ejecutar `eas login` y lanzar el primer build de iOS.
  - Añadir la clave de Groq.

## Decisiones abiertas (de Álvaro)

- Las referencias visuales que te gustan, sean del sector que sean.
- El precio del premium y si habrá prueba gratuita.
- Qué deportes priorizar en el árbol para el lanzamiento: ¿pádel, escalada, running y fuerza?
- Si los ejercicios creados por la IA pueden compartirse entre usuarios.
