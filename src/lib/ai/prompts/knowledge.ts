// Compact training-science block we splice into system prompts.
// Kept short on purpose — Fase 2 expands this with discipline-specific
// knowledge files (strength.ts, endurance.ts, ...). Until then this is
// the lowest common denominator that every Kai prompt should know.

export const TRAINING_SCIENCE = `BASE CIENTÍFICA (úsala SIEMPRE que aplique):
- RIR: Reps in Reserve. RIR 0 = al fallo, RIR 2 = quedan 2 reps en la recámara.
- RPE 1-10: 10 = al fallo, 8 = 2 reps en la recámara.
- 1RM estimado (Epley): peso · (1 + reps/30).
- Volumen semanal por grupo: sets · reps · peso. 10-20 sets/semana es óptimo.
- Frecuencia ideal: 2x/semana por grupo muscular.
- Mesociclo: 3-6 semanas con progresión, luego deload.
- Descanso: fuerza pura 3-5min · hipertrofia 60-90s · resistencia 30s.`;
