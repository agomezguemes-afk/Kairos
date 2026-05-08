// Few-shot block templates. Compact textual sketches of "what a good output
// looks like" for the common requests. We don't inject ALL of them every
// turn — the chat surface picks 1-2 most relevant by query keywords.
//
// Each template intentionally describes structure (h2 headings, dividers,
// columns, dashboard) rather than tool sequence — Kai is responsible for
// translating structure to tool calls.

export interface BlockTemplate {
  id: string;
  /** Trigger keywords used by `pickTemplates`. Lowercase. */
  triggers: string[];
  description: string;
}

export const BLOCK_TEMPLATES: BlockTemplate[] = [
  {
    id: 'push_day',
    triggers: ['push', 'pecho', 'tríceps', 'hombros', 'empuje'],
    description: `EJEMPLO PUSH DAY:
- create_block(name="Día de empuje", discipline="strength")
- add_text(format="h2", content="Calentamiento")
- add_exercise("Banded pull-apart", sets=2, reps=15)
- add_exercise("Pike push-up", sets=2, reps=10)
- add_divider()
- add_text(format="h2", content="Bloque principal")
- add_exercise("Press de banca con mancuernas", sets=4, reps=8, rest=120)
- add_exercise("Press de hombros con mancuernas", sets=3, reps=10, rest=90)
- add_exercise("Fondos en banco", sets=3, reps=12, rest=60)
- add_text(format="h2", content="Accesorios")
- wrap_in_columns([elevaciones, tríceps], columns=2)
- add_dashboard(metric="completion_pct")`,
  },
  {
    id: 'pull_day',
    triggers: ['pull', 'espalda', 'bíceps', 'remo', 'dominadas'],
    description: `EJEMPLO PULL DAY:
- create_block(name="Día de tirón", discipline="strength")
- add_text(format="h2", content="Movilidad")
- add_exercise("Cat-cow", sets=1, reps=10)
- add_exercise("Banded pull apart", sets=2, reps=15)
- add_divider()
- add_text(format="h2", content="Trabajo principal")
- add_exercise("Dominadas", sets=4, reps=6)
- add_exercise("Remo con mancuerna", sets=3, reps=10, rest=90)
- add_exercise("Face pull", sets=3, reps=15)
- wrap_in_columns([curl bíceps, hammer curl], columns=2)
- add_dashboard(metric="total_volume")`,
  },
  {
    id: '5k_progression',
    triggers: ['5k', '5 km', 'carrera', 'correr', 'running'],
    description: `EJEMPLO PLAN 5K (semana tipo):
- create_block(name="Plan 5K · Semana 1", discipline="running")
- add_text(format="h2", content="Día 1 · Rodaje suave")
- add_exercise("Carrera continua suave", reps="30m")
- add_text(format="h2", content="Día 2 · Series")
- add_exercise("Series de 400m", sets=6, rest=90)
- add_text(format="h2", content="Día 3 · Tirada larga")
- add_exercise("Tirada larga", reps="50m")
- add_dashboard(metric="completion_pct")`,
  },
  {
    id: 'hiit_home',
    triggers: ['hiit', 'tabata', 'casa', 'home', 'sin equipamiento'],
    description: `EJEMPLO HIIT EN CASA:
- create_block(name="HIIT 20 min", discipline="general")
- add_text(format="h2", content="Calentamiento (3min)")
- add_exercise("Jumping jacks", reps="60s")
- add_exercise("World's greatest stretch", sets=1, reps=8)
- add_divider()
- add_text(format="h2", content="Tabata x4 bloques")
- add_timer(mode="countdown", duration_sec=20, label="Trabajo")
- add_timer(mode="countdown", duration_sec=10, label="Descanso")
- add_exercise("Burpees", reps="20s")
- add_exercise("Mountain climbers", reps="20s")
- add_exercise("Sentadilla con salto", reps="20s")
- add_exercise("Plancha", reps="20s")`,
  },
  {
    id: 'mobility_morning',
    triggers: ['movilidad', 'mobility', 'estiramiento', 'mañana', 'morning'],
    description: `EJEMPLO MOVILIDAD MAÑANERA:
- create_block(name="Movilidad 10 min", discipline="mobility")
- add_text(format="h3", content="Despierta la columna")
- add_exercise("Cat-cow", sets=1, reps=10)
- add_exercise("Rotación torácica en cuadrupedia", sets=1, reps=8)
- add_text(format="h3", content="Caderas")
- add_exercise("90/90 cadera", reps="60s")
- add_exercise("World's greatest stretch", sets=1, reps=6)
- add_text(format="h3", content="Activación")
- add_exercise("Bird-dog", sets=2, reps=8)
- add_exercise("Glute bridge", sets=2, reps=12)`,
  },
  {
    id: 'football_prep',
    triggers: ['fútbol', 'football', 'soccer'],
    description: `EJEMPLO PREPARACIÓN FÚTBOL:
- create_block(name="Prep fútbol", discipline="team_sport")
- add_text(format="h2", content="Activación")
- add_exercise("Banded pull apart", sets=2, reps=15)
- add_exercise("Glute bridge", sets=2, reps=12)
- add_text(format="h2", content="Fuerza específica")
- add_exercise("Sentadilla búlgara", sets=3, reps=8)
- add_exercise("Curl nórdico", sets=3, reps=6)
- add_exercise("Plancha Copenhagen", sets=2, reps="30s")
- add_text(format="h2", content="Agilidad / explosividad")
- add_exercise("Saltos laterales", sets=3, reps=10)
- add_exercise("Sprints de ida y vuelta", sets=4)`,
  },
  {
    id: 'rehab_knee',
    triggers: ['rodilla', 'knee', 'rehab', 'lesión'],
    description: `EJEMPLO REHAB RODILLA (carga ligera, sin dolor):
- create_block(name="Rehab rodilla", discipline="mobility")
- add_text(format="h2", content="Activación isométrica")
- add_exercise("Glute bridge", sets=3, reps=12)
- add_exercise("Bird-dog", sets=3, reps=10)
- add_text(format="h2", content="Fortalecimiento controlado")
- add_exercise("Split squat", sets=3, reps=8)
- add_exercise("Curl nórdico", sets=2, reps=5)
- add_text(format="h2", content="Movilidad")
- add_exercise("Couch stretch", reps="60s")`,
  },
  {
    id: 'hypertrophy_upper',
    triggers: ['hipertrofia', 'upper', 'volumen', 'tren superior'],
    description: `EJEMPLO HIPERTROFIA TREN SUPERIOR:
- create_block(name="Hipertrofia upper", discipline="strength")
- add_text(format="h2", content="Empuje compuesto")
- add_exercise("Press de banca con barra", sets=4, reps=8, rest=120)
- add_exercise("Press de hombros con mancuernas", sets=4, reps=10, rest=90)
- add_text(format="h2", content="Tirón compuesto")
- add_exercise("Remo con barra", sets=4, reps=10, rest=90)
- add_exercise("Dominadas", sets=3, reps=8)
- add_text(format="h2", content="Aislamiento")
- wrap_in_columns([elevaciones laterales, face pull], columns=2)
- wrap_in_columns([curl bíceps, triceps pushdown], columns=2)
- add_dashboard(metric="total_volume")`,
  },
];

/**
 * Pick the templates whose trigger words appear in the user query. Cap at 2
 * so we don't bloat the prompt.
 */
export function pickTemplates(query: string): BlockTemplate[] {
  const q = query.toLowerCase();
  const hits = BLOCK_TEMPLATES.filter((t) => t.triggers.some((trig) => q.includes(trig)));
  return hits.slice(0, 2);
}

export function renderTemplatesForPrompt(templates: BlockTemplate[]): string {
  if (templates.length === 0) return '';
  return ['PLANTILLAS DE EJEMPLO (estructura recomendada):', ...templates.map((t) => t.description)].join('\n\n');
}
