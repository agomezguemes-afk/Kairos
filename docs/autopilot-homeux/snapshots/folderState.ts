// src/features/planner/lib/folderState.ts
// Pure decisions for the Home "carpeta": what it does on first contact
// (smart default) and how a remembered choice overrides it (STORY-03).

import type { DayCardVariant } from '../hooks/useDayCardState';

/** Smart default (solo primer contacto): la carpeta se abre sola los días donde
 * su contenido (calendario para asignar, estado para consultar) ES la acción
 * principal — es decir, no hay nada que empezar hoy. Con sesión en cola, cerrada:
 * el CTA "Empezar" lidera. */
export function folderDefaultOpen(todayVariant: DayCardVariant): boolean {
  return todayVariant === 'empty' || todayVariant === 'no-blocks';
}

/** Estado resuelto de la carpeta: una elección explícita del usuario (remembered)
 * gana siempre; sin ella, cae al smart default. `null` = nunca tocada. */
export function resolveFolderOpen(
  remembered: boolean | null,
  todayVariant: DayCardVariant,
): boolean {
  return remembered !== null ? remembered : folderDefaultOpen(todayVariant);
}
