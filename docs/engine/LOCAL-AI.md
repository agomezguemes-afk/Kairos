# IA local en Kairos — diseño

_Noviembre 2026. Base: `docs/research_notes/local-ai-2026-11.md` (fuentes y cifras etiquetadas)._

## Principio

La IA explica y propone; las cifras de seguridad las pone el motor determinista (ROADMAP, principio 4). Con este diseño, además, **tus datos de entrenamiento y de salud se analizan en tu iPhone por defecto**. La nube es opcional, por función y con consentimiento explícito.

## Arquitectura

Una sola interfaz (`src/lib/ai/providers`) y un router que elige quién responde a cada petición:

| Nivel | Motor | Dónde corre | Estado |
|---|---|---|---|
| 1 | Apple Foundation Models (~3B, ventana de 4K) | iPhone 15 Pro o posterior con Apple Intelligence, iOS 26+ | Pendiente (módulo nativo) |
| 2 | Modelo descargado vía llama.rn (llama.cpp + Metal) | Cualquier iPhone con 6 GB o más, **incluido el 12 Pro** | Pendiente (módulo nativo) |
| 3 | Nube: Groq hoy; Private Cloud Compute en iOS 27 | Con red y consentimiento | **Hecho** (detrás del router) |
| 4 | Reglas deterministas | Siempre | Ya existía |

El iPhone 12 Pro no admite Apple Intelligence, así que el nivel 2 es imprescindible.

### Orden por tarea (`TASK_ORDER`)

| Tarea | Orden | Por qué |
|---|---|---|
| Objetivo → JSON | Apple → local → nube → reglas | Extracción corta con esquema cerrado: un modelo pequeño con salida restringida la resuelve bien. |
| Agente de bloques (herramientas) | local → Apple → nube → reglas | La ventana de 4K de Apple solo admite unas pocas herramientas. |
| Explicaciones del coach | Apple → local → nube → plantilla | Parafrasea cifras que ya calculó el motor. |
| Revisión semanal | nube → local → Apple → plantilla | Es el texto donde más se nota la calidad. |

### Reglas del router (probadas en `router.test.ts`)

- **Sin consentimiento, nada sale del teléfono.** Sin red, se salta la nube.
- **Los modelos locales solo corren en primer plano**, porque iOS rechaza trabajo de GPU en segundo plano. Tampoco corren con el teléfono caliente (`thermalState` serious o critical).
- Se salta un proveedor que no sepa hacer lo que pide la petición: JSON o herramientas.
- Cada intento tiene su tiempo límite. Si un proveedor falla, o su respuesta no supera la validación de quien llama, se prueba el siguiente.
- Si ninguno responde, el resultado es `null` y quien llama usa sus reglas. La persona nunca ve un error de IA.

## Modelo local elegido

**Qwen3-1.7B en Q4_K_M** (~1,1 GB, Apache-2.0), con el modo de razonamiento desactivado (`enable_thinking: false`; llama.rn lo activa por defecto).

Estimación en el A14: unos 20–25 tokens/s al generar. Es una extrapolación, hay que medirlo en tu 12 Pro.

Alternativas que evaluar con nuestro propio conjunto de pruebas en español:
- **Qwen3.5-2B**: tiene un bloqueo abierto en iOS 27.2.1, llama.rn #439.
- **Qwen3-4B**: solo para teléfonos con 8 GB, y solo para la revisión semanal.

## Lo que falta, en orden

1. **Medir en tu iPhone 12 Pro.** Ejecutar el benchmark de llama.rn con Qwen3-1.7B y anotar tokens/s, memoria máxima y temperatura. Ningún dato público cubre este chip con modelos de este tamaño.
2. **Módulo llama.rn.**
   - Fijar una versión exacta. 0.12.9 pierde memoria de Metal al liberar el modelo (#398); desde 0.13.0-rc.3 está corregido.
   - Prueba de carga y descarga repetida en el 12 Pro.
   - Comprobar la memoria disponible antes de cargar el modelo.
3. **Descarga del modelo.**
   - Después de instalar, nunca incluido en la app.
   - Reanudable y con verificación SHA-256.
   - En `Application Support`, excluido de la copia de iCloud.
   - Pedir permiso antes de descargar 1,1 GB por datos móviles.
   - Manifiesto remoto para poder cambiar de modelo sin publicar una versión nueva.
4. **Conjunto de pruebas en español.** De 150 a 300 casos:
   - Objetivos, incluidas expresiones de Latinoamérica.
   - Ediciones de bloques con las llamadas a herramientas esperadas.
   - Resúmenes, con una regla clave: ninguna cifra que no esté en los datos de entrada.
   - Se ejecutan contra la nube en CI y en el dispositivo desde una pantalla interna.
5. **Apple Foundation Models**, vía `@react-native-ai/apple` o un módulo Expo propio.
6. **Pantalla de consentimiento para la nube** (App Review 5.1.2(i), noviembre de 2025). Hasta entonces `currentRouteContext()` mantiene el comportamiento actual: nube permitida.
7. **Agente con herramientas por intención.** Primero se clasifica qué quiere hacer la persona y luego se ofrecen 3–6 herramientas, no las ~36 actuales.

## Decisiones tuyas

- **Cuenta de Apple Developer de pago.**
  - El plugin de llama.rn añade dos entitlements de memoria (`increased-memory-limit`, `extended-virtual-addressing`). Hoy Kairos firma a propósito con un Personal Team gratuito, sin entitlements especiales.
  - Hay que comprobar si con el Personal Team compila. Si no, hace falta el programa de pago, que de todos modos exige TestFlight.
- **Dónde alojar el modelo.**
  - Un CDN propio, como Cloudflare R2.
  - O los paquetes de recursos que aloja Apple (iOS 26+), más integrados pero solo para iOS 26 o posterior.
- **Actualizar Expo.** Kairos está en el SDK 54. ExecuTorch y Core AI ya exigen versiones más nuevas. No bloquea llama.rn, pero el desfase irá creciendo.
