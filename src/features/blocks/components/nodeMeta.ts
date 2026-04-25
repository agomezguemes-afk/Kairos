import type { Feather } from '@expo/vector-icons';
import type { ContentNode } from '../../../types/content';

type FeatherIcon = keyof typeof Feather.glyphMap;

export function getNodeIcon(node: ContentNode): FeatherIcon {
  switch (node.type) {
    case 'text': return 'type';
    case 'exercise': return 'activity';
    case 'subBlock': return 'box';
    case 'image': return 'image';
    case 'divider': return 'minus';
    case 'customField': return 'edit-3';
    case 'dashboard': return 'bar-chart-2';
    case 'timer': return 'clock';
    case 'spacer': return 'square';
    case 'columnSection': return 'columns';
    default: return 'square';
  }
}

export function getNodeLabel(node: ContentNode): string {
  switch (node.type) {
    case 'text': return (node.data.content || 'Texto').slice(0, 60);
    case 'exercise': return node.data.exercise.name;
    case 'subBlock': return 'Sub-bloque';
    case 'image': return node.data.caption || 'Imagen';
    case 'divider': return 'Separador';
    case 'customField': return node.data.field.name;
    case 'dashboard': return node.data.label;
    case 'timer': return node.data.label || 'Timer';
    case 'spacer': return 'Espacio';
    case 'columnSection': return `${node.data.columns} cols`;
    default: return '';
  }
}
