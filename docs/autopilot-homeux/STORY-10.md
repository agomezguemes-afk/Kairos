# STORY-10 — Pasada de minimalismo de copy (Blocks + superficies de la sesión) `[transversal]`

**Estado**: LISTA (baja prioridad — "si da tiempo"). Developer = opus. ~45-60 min.
**Restricciones**: sin deps · sin nativo · sin commits · no tocar Metro 8081 · no
cambiar lógica, solo texto/labels. Cierre: `npm run typecheck && npm test` verde +
`/code-review`.

---

## 0. Contexto

Álvaro: "textos que sobran… muy 'ai made'". STORY-08 ya recorta el copy de Home.
Esta historia extiende el principio a las superficies tocadas esta sesión (Blocks
y alrededores). Marco: **HIG "Clarity"** (el texto informa, no decora) + **Miller
5±1** (menos elementos, menos relleno) + regla de oro: **cuando dudes, resta**.
NO añadir copy nuevo, NO cambiar lógica.

---

## 1. Objetivos concretos (candidatos — el developer confirma a ojo cuáles sobran)

- `src/features/blocks/BlocksScreen.tsx`
  - Empty-state (`welcomeBody`): dos líneas largas ("Crea bloques… Cada bloque
    contiene ejercicios con series y repeticiones que puedes rastrear.") → recortar
    a una frase esencial.
  - `hintRow` (3 HintChips: "Organiza tu rutina" / "Registra cada serie" /
    "Analiza tu progreso"): son decorativos y genéricos ("ai made"). Evaluar
    quitarlos o reducir a 0 — el CTA ya dice qué hacer.
  - Subtítulo del header ("Tu espacio de entrenamiento" / "N bloques"): mantener
    solo el conteo cuando hay bloques; la frase-eslogan sobra.
- `src/features/blocks/components/BlockCard.tsx`
  - Cadenas de stats ("X ej · Y series", "~Zm", "Sin ejercicios"): ya son
    razonablemente densas; revisar que no haya redundancia (p.ej. unidad repetida).
    Cambio mínimo o ninguno si ya está limpio.
- `src/features/blocks/components/DisciplineFolder.tsx`
  - "N bloques": correcto; sin cambios salvo que se detecte redundancia con el label.
- Otras superficies tocadas esta sesión (SetCorrectionSheet, SessionOverview, etc.
  SOLO si el copy es claramente de relleno) — **no** entrar en Modo Sesión salvo
  texto obviamente redundante y sin tocar lógica.

Principios de recorte:
- Quitar adjetivos motivacionales y frases-eslogan ("Tu espacio de…", "Analiza tu
  progreso") que no informan de una acción.
- Un solo label por sección; sin subtítulos que repiten el título.
- Preferir el número/el contenido del usuario sobre el chrome textual.

---

## 2. Criterios de aceptación (verificación visual)

1. El empty-state de Blocks se lee más limpio: una frase de apoyo (no dos), y sin
   la fila de 3 chips genéricos (o justificar por qué se quedan).
2. El header de Blocks muestra solo lo esencial (conteo, no eslogan).
3. Ninguna pantalla tocada gana texto; solo pierde relleno. La claridad se mantiene
   (un usuario nuevo sigue entendiendo qué hacer — el CTA lo dice).
4. Sin cambios de lógica ni de comportamiento; `npm run typecheck` limpio;
   `npm test` verde (baseline — sin tests nuevos; es copy).

## 3. Tests
Ninguno: es edición de copy/labels, sin lógica extraíble → AC visual (regla de la
misión). Snapshot del diff en `docs/autopilot-homeux/snapshots/`.

## 4. Riesgo / duración
**Muy bajo** (texto). ~45-60 min. Prioridad por debajo de STORY-08 (corrección
directa) y STORY-09 (el "cutre" de interacción). Hacer solo si queda ventana.
