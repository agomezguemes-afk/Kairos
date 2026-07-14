# Kairos Design v2 — Dirección (2026-07-13)

> Fusión de tres fuentes: la esencia Manuscrito del onboarding (papel cálido, Fraunces, tinta),
> la gramática del referente Musemind "AI Productivity App" (Dribbble 21947771), y el sistema
> de tokens existente. Extraemos PATRONES del referente, no su paleta — la identidad Kairos
> (off-white cálido #F7F7F5 + oro raro #C9A96E) se mantiene.

## Los 5 patrones del referente, traducidos

1. **El contenido es el titular.** Cada pantalla tiene UNA afirmación dominante en tipo gigante
   (las palabras del usuario, el conteo del día, la fecha). Nada compite con ella.
   → Home: "Buenos días, Álvaro" + la sesión de hoy como héroe único. Fuera la competencia de
   tarjetas (stats+rings+calendar+daycard+señal apiladas con el mismo peso).

2. **Barra de IA ambiental.** Input persistente al pie ("¿Qué te apetece hoy?") con el orb de
   Kai, en TODAS las superficies principales. Kai deja de ser un botón enterrado: es ambiente.
   → Sustituye al KaiTodayEntry como patrón: la entrada es la barra, el hero es el contenido.

3. **Estado de escucha a pantalla completa.** Al hablar: las palabras transcritas en vivo en
   tipo enorme (Fraunces) sobre lienzo casi vacío; orb + "Escuchando…" pequeño abajo.
   Confianza mediante vacío. → Este ES el lenguaje visual de M3 push-to-talk. Resuelto aquí.

4. **Espina de timeline.** Rail vertical con nodos y línea-de-ahora; eventos como tarjetas
   suaves con chip de duración. → ActiveWorkout: sets como nodos del timeline, el set actual
   sobre la now-line. El detalle de bloque ya tiene espina — se refina, no se reinventa.

5. **Tarjetas tintadas sin borde.** Jerarquía por color de relleno suave sobre lienzo neutro
   que respira; acción primaria = pill de tinta oscura; secundaria = pill outline.
   → El tinte lo ponen los colores de disciplina existentes (fuerza/carrera/híbrido…), NUNCA
   el oro. El oro sigue siendo raro: una sola acción significativa por pantalla.

## Reglas duras (no negociables)

- Tokens only (`src/theme/tokens.ts`); si un patrón pide un token nuevo (tintes de tarjeta,
  radio XL, pill de tinta), se AÑADE al sistema, no se hardcodea.
- Fraunces para display/titulares (la voz del Manuscrito); sans del sistema para UI.
- Un oro por pantalla. Los tintes de disciplina hacen el trabajo de color.
- Motion = comprensión (100/180-280/480ms, springs de tokens); reduce-motion siempre.
- Accesibilidad conservada o mejorada: 44pt, VoiceOver, Dynamic Type (ya auditado en M4-UI).
- WEDGE_MODE se respeta: no se rediseñan superficies ocultas (gamificación, AI Lab).

## Superficies, en orden

- **Ola 1 (héroe):** Home/Hoy (hero statement + barra Kai ambiental + una tarjeta de sesión),
  KaiConversation (palabras del usuario grandes, no burbuja gris; preview de bloque como
  tarjeta tintada; pills Empezar/Cambiar), estado Listening (M3-ready, aunque la voz llegue
  después — el layout se construye ya con el texto).
- **Ola 2:** ActiveWorkout (timeline spine + now-line + numpad sin fantasmas), detalle de
  bloque (header sin solapes), Progreso (jerarquía de gráficas).
- **Fixes que entran con Ola 1:** saludo truncado ("Buenos días, Á…"), copy contradictorio
  ("Semana sin sesiones aún" vs "4 sesiones esta semana"), navegación atrás del Kai screen.

## Qué NO copiar del referente

- Paleta lavanda/periwinkle (identidad ajena).
- Densidad de integraciones/notificaciones (Slack/Asana rows) — Kairos no es un agregador.
- El canvas 3D de presentación — es marketing del shot, no UI.
