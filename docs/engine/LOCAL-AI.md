# IA local en Kairos — diseño

_Noviembre 2026. Base: `docs/research_notes/local-ai-2026-11.md` (fuentes y cifras etiquetadas)._

## Principio

La IA explica y propone; las cifras de seguridad las pone el motor determinista (ROADMAP, principio 4). Con este diseño, además, **tus datos de entrenamiento y de salud se analizan en tu iPhone por defecto**. La nube es opcional, por función y con consentimiento explícito.

## Arquitectura

Una sola interfaz (`src/lib/ai/providers`) y un router que elige quién responde a cada petición:

| Nivel | Motor | Dónde corre | Estado |
|---|---|---|---|
| 1 | Apple Foundation Models (~3B, ventana de 4K) | iPhone 15 Pro o posterior con Apple Intelligence, iOS 26+ | Pendiente (módulo nativo) |
| 2 | Modelo descargado vía llama.rn (llama.cpp + Metal) | Cualquier iPhone con GPU Apple7+ (A14 o posterior), **incluido el iPhone 13 de pruebas** | **Hecho**, a falta de medirlo en el dispositivo |
| 3 | Nube: Groq hoy; Private Cloud Compute en iOS 27 | Con red y consentimiento | **Hecho** (detrás del router) |
| 4 | Reglas deterministas | Siempre | Ya existía |

El iPhone 13 de pruebas no admite Apple Intelligence (hace falta un iPhone 15 Pro o posterior), así que el nivel 2 es imprescindible.

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

## Modelos candidatos y dispositivo de pruebas

Pruebas en un **iPhone 13 (A15, 4 GB)** y **sin la cuenta de pago de Apple Developer** hasta el lanzamiento. Eso fija dos condiciones:

- **Sin entitlements de memoria.** El plugin de llama.rn está configurado con `enableEntitlements: false`; verificado con `expo config`, el único entitlement es HealthKit. La app sigue firmando con el Personal Team.
- **Sin entitlements, iOS cierra la app hacia la mitad de la RAM.** Hay una medición de 2,1 GB en un iPhone 13. El modelo tiene que caber en ese margen junto a Kairos.

| Modelo | Archivo (Q4_K_M) | Licencia | iPhone 13 (estimado) | 6 GB (estimado) |
|---|---|---|---|---|
| Qwen3 0.6B | 397 MB | Apache-2.0 | Cabe | Cabe |
| LFM2.5 1.2B | 731 MB | LFM Open 1.0 (gratis por debajo de 10 M$/año) | Cabe | Cabe |
| Qwen3 1.7B | 1.107 MB | Apache-2.0 | Demasiado grande | Cabe |

Los tamaños y las SHA-256 son los registros LFS de Hugging Face, leídos el 24 de noviembre de 2026; están en `src/lib/ai/local/catalog.ts`. Las estimaciones salen de `fitOnDevice` y **el laboratorio las sustituye por medidas**.

## Laboratorio IA

Pantalla interna (Perfil → Laboratorio IA). Solo aparece en las variantes "Kairos Dev" y "Kairos β"; en producción, nunca.

Por cada modelo permite:
- descargarlo, con confirmación del tamaño y aviso de datos móviles;
- probarlo;
- marcarlo como **el modelo del coach**;
- borrarlo.

La prueba (`src/lib/ai/local/lab.ts`) mide:
- el tiempo de carga;
- la velocidad de lectura y de escritura (`bench` de llama.cpp);
- 4 objetivos reales en español: JSON válido y deporte correcto.

El informe sale en texto seleccionable para pegarlo en el chat.

Al marcar un modelo como el del coach, el intérprete de objetivos lo usa primero. Si falla, pasa a la nube o a las reglas.

## Cómo está montado

| Pieza | Archivo | Notas |
|---|---|---|
| Registro de proveedores y contexto vivo | `src/lib/ai/providers/index.ts` | Sin importaciones nativas: todo lo que lo usa se prueba en Node. |
| Proveedor local | `src/lib/ai/local/llamaProvider.ts` | Una generación a la vez. Cancelar detiene la generación nativa. Si iOS borró el archivo, marca el modelo como ausente y el router pasa al siguiente. |
| Traducción a llama.rn | `src/lib/ai/local/mapping.ts` | Razonamiento desactivado. Esquema JSON convertido en gramática. Contexto lleno o interrupción cuentan como fallo. |
| Runtime nativo | `src/lib/ai/local/runtime.ios.ts` | `runtime.ts` es el sustituto fuera de iOS, así la web y los tests no cargan nada nativo. |
| Ciclo de vida | `src/lib/ai/local/install.ts` | En segundo plano: detener. Ante un aviso de memoria: liberar el modelo. Al volver: comprobar los archivos. |

Decisiones técnicas:
- **Modelos en `Library/Caches/models`**, como piden las normas de iOS para lo que se puede volver a descargar. `Documents` se copia a iCloud: 1 GB en la copia de cada persona es motivo de rechazo.
- **Contexto de 2.048 tokens** con caché de claves y valores en q8.
- **llama.rn fijado en `0.13.0-rc.12`**: la 0.12.9 pierde memoria de Metal al liberar el modelo (#398).

## Lo que falta, en orden

1. **Medir en el iPhone 13** con el laboratorio. Con las cifras se elige el modelo por defecto para 4 GB y para 6 GB o más.
2. **Comprobar la integridad completa del archivo.** Hoy se comprueban el tamaño exacto, la cabecera GGUF y que el modelo cargue. Para producción falta verificar la SHA-256 con CryptoKit (un módulo nativo pequeño) y servir los modelos desde un CDN propio con manifiesto remoto, no desde Hugging Face.
3. **Conjunto de pruebas en español** (150–300 casos), en CI contra la nube y en el dispositivo desde el laboratorio.
4. **Llevar el coach y el agente de bloques al router.** El agente necesita elegir herramientas según la intención: 3–6 por petición, no ~36.
5. **Apple Foundation Models** para iPhone 15 Pro y posteriores.
6. **Pantalla de consentimiento para la nube** (App Review 5.1.2(i)).

## Decisiones tuyas

- **Cuenta de pago:** pospuesta hasta el lanzamiento. Los modelos se eligen para funcionar sin ella.
- **Dónde alojar los modelos en producción:** un CDN propio, como Cloudflare R2, o los paquetes de recursos que aloja Apple (solo iOS 26+).
- **Actualizar Expo.** El SDK 54 se va quedando atrás: ExecuTorch y Core AI ya exigen versiones más nuevas.
