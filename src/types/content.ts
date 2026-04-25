import type { ExerciseCard, FieldDefinition, FieldValue } from './core';
import { generateId } from './core';

export type TextFormat = 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet' | 'numbered' | 'checklist';

export interface TextNodeData {
  content: string;
  format: TextFormat;
  checked?: boolean;
}

export interface ExerciseNodeData {
  exercise: ExerciseCard;
}

export interface SubBlockNodeData {
  blockId: string;
  collapsed: boolean;
}

export interface ImageNodeData {
  uri: string;
  caption: string;
  width?: number;
  height?: number;
}

export interface TimerNodeData {
  mode: 'countdown' | 'stopwatch';
  duration: number;
  label: string;
}

export interface SpacerNodeData {
  height: number;
}

export interface CustomFieldNodeData {
  field: FieldDefinition;
  value: FieldValue;
}

export type DashboardMetric =
  | 'total_volume'
  | 'completed_sets'
  | 'total_exercises'
  | 'completion_pct'
  | 'estimated_duration';

export type DashboardViz = 'counter' | 'progress' | 'list';

export interface DashboardNodeData {
  metric: DashboardMetric;
  viz: DashboardViz;
  label: string;
  color: string;
}

export type ContentNodeType = 'text' | 'exercise' | 'subBlock' | 'image' | 'divider' | 'customField' | 'dashboard' | 'timer' | 'spacer' | 'columnSection';

export interface ColumnSectionData {
  columns: 2 | 3;
  widths?: number[];
}

interface NodeBase {
  id: string;
  order: number;
  column: number;
  section?: string;
}

export interface TextContentNode extends NodeBase { type: 'text'; data: TextNodeData }
export interface ExerciseContentNode extends NodeBase { type: 'exercise'; data: ExerciseNodeData }
export interface SubBlockContentNode extends NodeBase { type: 'subBlock'; data: SubBlockNodeData }
export interface ImageContentNode extends NodeBase { type: 'image'; data: ImageNodeData }
export interface DividerContentNode extends NodeBase { type: 'divider'; data: Record<string, never> }
export interface CustomFieldContentNode extends NodeBase { type: 'customField'; data: CustomFieldNodeData }
export interface DashboardContentNode extends NodeBase { type: 'dashboard'; data: DashboardNodeData }
export interface TimerContentNode extends NodeBase { type: 'timer'; data: TimerNodeData }
export interface SpacerContentNode extends NodeBase { type: 'spacer'; data: SpacerNodeData }
export interface ColumnSectionContentNode extends NodeBase { type: 'columnSection'; data: ColumnSectionData }

export type ContentNode =
  | TextContentNode
  | ExerciseContentNode
  | SubBlockContentNode
  | ImageContentNode
  | DividerContentNode
  | CustomFieldContentNode
  | DashboardContentNode
  | TimerContentNode
  | SpacerContentNode
  | ColumnSectionContentNode;

export interface BlockLayout {
  columns: 1 | 2 | 3;
  widths?: number[];
}

export function createTextNode(
  order: number,
  format: TextFormat = 'paragraph',
  content: string = '',
): TextContentNode {
  return { id: generateId(), type: 'text', order, column: 0, data: { content, format } };
}

export function createExerciseNode(order: number, exercise: ExerciseCard): ExerciseContentNode {
  return { id: generateId(), type: 'exercise', order, column: 0, data: { exercise } };
}

export function createSubBlockNode(order: number, blockId: string): SubBlockContentNode {
  return { id: generateId(), type: 'subBlock', order, column: 0, data: { blockId, collapsed: false } };
}

export function createDividerNode(order: number): DividerContentNode {
  return { id: generateId(), type: 'divider', order, column: 0, data: {} as Record<string, never> };
}

export function createImageNode(order: number): ImageContentNode {
  return { id: generateId(), type: 'image', order, column: 0, data: { uri: '', caption: '' } };
}

export function createCustomFieldNode(
  order: number,
  field: FieldDefinition,
  value: FieldValue = null,
): CustomFieldContentNode {
  return { id: generateId(), type: 'customField', order, column: 0, data: { field, value } };
}

export function createColumnSectionNode(
  order: number,
  columns: 2 | 3 = 2,
  widths?: number[],
): ColumnSectionContentNode {
  return { id: generateId(), type: 'columnSection', order, column: 0, data: { columns, widths } };
}

export function createTimerNode(
  order: number,
  mode: 'countdown' | 'stopwatch' = 'countdown',
  duration: number = 60,
  label: string = '',
): TimerContentNode {
  return { id: generateId(), type: 'timer', order, column: 0, data: { mode, duration, label } };
}

export function createSpacerNode(order: number, height: number = 24): SpacerContentNode {
  return { id: generateId(), type: 'spacer', order, column: 0, data: { height } };
}

export function createDashboardNode(
  order: number,
  metric: DashboardMetric = 'total_volume',
  viz: DashboardViz = 'counter',
  label?: string,
  color: string = '#C9A96E',
): DashboardContentNode {
  const defaultLabels: Record<DashboardMetric, string> = {
    total_volume: 'Volumen total',
    completed_sets: 'Series completadas',
    total_exercises: 'Ejercicios',
    completion_pct: 'Progreso',
    estimated_duration: 'Duración estimada',
  };
  return {
    id: generateId(),
    type: 'dashboard',
    order,
    column: 0,
    data: { metric, viz, label: label ?? defaultLabels[metric], color },
  };
}

export function getExercisesFromContent(content: ContentNode[]): ExerciseCard[] {
  return content
    .filter((n): n is ExerciseContentNode => n.type === 'exercise')
    .sort((a, b) => a.order - b.order)
    .map(n => n.data.exercise);
}

export function getNextOrder(content: ContentNode[]): number {
  if (content.length === 0) return 0;
  return Math.max(...content.map(n => n.order)) + 1;
}

export function reorderNodes(nodes: ContentNode[]): ContentNode[] {
  return nodes
    .sort((a, b) => a.order - b.order)
    .map((n, i) => ({ ...n, order: i }));
}

// ======================== RENDER GROUPS ========================

export interface FullWidthGroup {
  type: 'fullWidth';
  nodes: ContentNode[];
}

export interface SectionGroup {
  type: 'section';
  sectionNode: ColumnSectionContentNode;
  children: ContentNode[];
}

export type RenderGroup = FullWidthGroup | SectionGroup;

export function buildRenderGroups(content: ContentNode[]): RenderGroup[] {
  const sorted = [...content].sort((a, b) => a.order - b.order);

  const sectionNodes = sorted.filter(
    (n): n is ColumnSectionContentNode => n.type === 'columnSection',
  );
  const sectionIds = new Set(sectionNodes.map(n => n.id));

  const sectionChildrenMap = new Map<string, ContentNode[]>();
  for (const s of sectionNodes) sectionChildrenMap.set(s.id, []);

  const freeNodes: ContentNode[] = [];

  for (const node of sorted) {
    if (node.type === 'columnSection') continue;
    if (node.section && sectionIds.has(node.section)) {
      sectionChildrenMap.get(node.section)!.push(node);
    } else {
      freeNodes.push(node);
    }
  }

  const groups: RenderGroup[] = [];
  let freeIdx = 0;

  for (const node of sorted) {
    if (node.type === 'columnSection') {
      while (freeIdx < freeNodes.length && freeNodes[freeIdx].order < node.order) {
        const last = groups[groups.length - 1];
        if (last?.type === 'fullWidth') {
          last.nodes.push(freeNodes[freeIdx]);
        } else {
          groups.push({ type: 'fullWidth', nodes: [freeNodes[freeIdx]] });
        }
        freeIdx++;
      }
      groups.push({
        type: 'section',
        sectionNode: node,
        children: sectionChildrenMap.get(node.id) ?? [],
      });
    }
  }

  while (freeIdx < freeNodes.length) {
    const last = groups[groups.length - 1];
    if (last?.type === 'fullWidth') {
      last.nodes.push(freeNodes[freeIdx]);
    } else {
      groups.push({ type: 'fullWidth', nodes: [freeNodes[freeIdx]] });
    }
    freeIdx++;
  }

  return groups;
}
