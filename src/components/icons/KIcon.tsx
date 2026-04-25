import React from 'react';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

import { Colors } from '../../theme/tokens';

export type KIconName =
  | 'barbell'
  | 'running'
  | 'mat'
  | 'clock'
  | 'note'
  | 'image'
  | 'lock'
  | 'unlock'
  | 'plus'
  | 'x'
  | 'grid'
  | 'columns'
  | 'chart'
  | 'zap'
  | 'dashboard'
  | 'file'
  | 'link'
  | 'drag'
  | 'settings'
  | 'eye';

interface Props {
  name: KIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export default function KIcon({
  name,
  size = 24,
  color = Colors.gold[500],
  strokeWidth = 1.5,
}: Props) {
  const stroke = color;
  const sw = strokeWidth;
  const lc = 'round' as const;
  const lj = 'round' as const;

  switch (name) {
    case 'barbell':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Line x1="3" y1="12" x2="21" y2="12" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} />
          <Rect x="2" y="8" width="2" height="8" rx="1" stroke={stroke} strokeWidth={sw} fill="none" />
          <Rect x="20" y="8" width="2" height="8" rx="1" stroke={stroke} strokeWidth={sw} fill="none" />
          <Rect x="5" y="6" width="3" height="12" rx="1" stroke={stroke} strokeWidth={sw} fill="none" />
          <Rect x="16" y="6" width="3" height="12" rx="1" stroke={stroke} strokeWidth={sw} fill="none" />
        </Svg>
      );
    case 'running':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="14" cy="4" r="2" stroke={stroke} strokeWidth={sw} fill="none" />
          <Path d="M5 20l4-6 3 2 4-3-2-4-4 1-3 4" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj} fill="none" />
          <Path d="M14 13l3 3 3-2" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj} fill="none" />
        </Svg>
      );
    case 'mat':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="3" y="6" width="18" height="12" rx="3" stroke={stroke} strokeWidth={sw} fill="none" />
          <Path d="M7 6v12M17 6v12" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} />
        </Svg>
      );
    case 'clock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="9" stroke={stroke} strokeWidth={sw} fill="none" />
          <Path d="M12 7v5l3 2" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj} fill="none" />
        </Svg>
      );
    case 'note':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="5" y="3" width="14" height="18" rx="2" stroke={stroke} strokeWidth={sw} fill="none" />
          <Path d="M8 8h8M8 12h8M8 16h5" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} />
        </Svg>
      );
    case 'image':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="3" y="4" width="18" height="16" rx="2" stroke={stroke} strokeWidth={sw} fill="none" />
          <Circle cx="9" cy="10" r="1.5" stroke={stroke} strokeWidth={sw} fill="none" />
          <Path d="M3 17l5-5 4 4 4-3 5 4" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj} fill="none" />
        </Svg>
      );
    case 'lock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="4" y="11" width="16" height="10" rx="2" stroke={stroke} strokeWidth={sw} fill="none" />
          <Path d="M8 11V7a4 4 0 018 0v4" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} fill="none" />
        </Svg>
      );
    case 'unlock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="4" y="11" width="16" height="10" rx="2" stroke={stroke} strokeWidth={sw} fill="none" />
          <Path d="M8 11V7a4 4 0 017.5-2" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} fill="none" />
        </Svg>
      );
    case 'plus':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Line x1="12" y1="5" x2="12" y2="19" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} />
          <Line x1="5" y1="12" x2="19" y2="12" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} />
        </Svg>
      );
    case 'x':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Line x1="6" y1="6" x2="18" y2="18" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} />
          <Line x1="18" y1="6" x2="6" y2="18" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} />
        </Svg>
      );
    case 'grid':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="3" y="3" width="7" height="7" rx="1" stroke={stroke} strokeWidth={sw} fill="none" />
          <Rect x="14" y="3" width="7" height="7" rx="1" stroke={stroke} strokeWidth={sw} fill="none" />
          <Rect x="3" y="14" width="7" height="7" rx="1" stroke={stroke} strokeWidth={sw} fill="none" />
          <Rect x="14" y="14" width="7" height="7" rx="1" stroke={stroke} strokeWidth={sw} fill="none" />
        </Svg>
      );
    case 'columns':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="3" y="4" width="7" height="16" rx="1.5" stroke={stroke} strokeWidth={sw} fill="none" />
          <Rect x="14" y="4" width="7" height="16" rx="1.5" stroke={stroke} strokeWidth={sw} fill="none" />
        </Svg>
      );
    case 'chart':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M3 20h18" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} />
          <Path d="M6 16V9M11 16V5M16 16v-7M21 16v-3" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} />
        </Svg>
      );
    case 'zap':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" stroke={stroke} strokeWidth={sw} strokeLinejoin={lj} fill="none" />
        </Svg>
      );
    case 'dashboard':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="3" y="3" width="8" height="11" rx="1.5" stroke={stroke} strokeWidth={sw} fill="none" />
          <Rect x="13" y="3" width="8" height="6" rx="1.5" stroke={stroke} strokeWidth={sw} fill="none" />
          <Rect x="13" y="11" width="8" height="10" rx="1.5" stroke={stroke} strokeWidth={sw} fill="none" />
          <Rect x="3" y="16" width="8" height="5" rx="1.5" stroke={stroke} strokeWidth={sw} fill="none" />
        </Svg>
      );
    case 'file':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" stroke={stroke} strokeWidth={sw} strokeLinejoin={lj} fill="none" />
          <Path d="M14 3v5h5" stroke={stroke} strokeWidth={sw} strokeLinejoin={lj} fill="none" />
        </Svg>
      );
    case 'link':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M10 14a4 4 0 005.66 0l3-3a4 4 0 10-5.66-5.66L11 7" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} fill="none" />
          <Path d="M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66L13 17" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} fill="none" />
        </Svg>
      );
    case 'drag':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="9" cy="6" r="1.4" fill={stroke} />
          <Circle cx="15" cy="6" r="1.4" fill={stroke} />
          <Circle cx="9" cy="12" r="1.4" fill={stroke} />
          <Circle cx="15" cy="12" r="1.4" fill={stroke} />
          <Circle cx="9" cy="18" r="1.4" fill={stroke} />
          <Circle cx="15" cy="18" r="1.4" fill={stroke} />
        </Svg>
      );
    case 'settings':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="3" stroke={stroke} strokeWidth={sw} fill="none" />
          <Path d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.5-2.4.9a7 7 0 00-2-1.2L14 3h-4l-.5 2.5a7 7 0 00-2 1.2L5 5.8 3 9.3l2 1.5a7 7 0 000 2.4L3 14.7l2 3.5 2.4-.9a7 7 0 002 1.2L10 21h4l.5-2.5a7 7 0 002-1.2l2.4.9 2-3.5-2-1.5c.07-.4.1-.8.1-1.2z" stroke={stroke} strokeWidth={sw} strokeLinejoin={lj} fill="none" />
        </Svg>
      );
    case 'eye':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke={stroke} strokeWidth={sw} strokeLinejoin={lj} fill="none" />
          <Circle cx="12" cy="12" r="3" stroke={stroke} strokeWidth={sw} fill="none" />
        </Svg>
      );
    default:
      return null;
  }
}
