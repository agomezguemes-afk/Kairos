// KAIROS — Icon Text Renderer
// Parses [marker] tokens in plain strings and renders
// them as inline KairosIcon components alongside Text nodes.

import React from 'react';
import { Text } from 'react-native';
import KairosIcon from '../components/KairosIcon';

// Maps [token] markers to KairosIcon names
const MARKER_MAP: Record<string, string> = {
  streak:       'streak',
  strength:     'strength',
  assistant:    'assistant',
  stats:        'stats',
  progress:     'progress',
  plan:         'plan',
  first_step:   'first_step',
  badge:        'badge',
  target:       'target',
  star:         'star',
  trophy:       'trophy',
  recovery:     'recovery',
  chat:         'chat',
  brain:        'brain',
  help:         'help',
  checkmark:    'checkmark',
  close:        'close',
  add:          'add',
  trash:        'trash',
  running:      'running',
  calendar:     'calendar',
  bolt:         'bolt',
  sparkle:      'sparkle',
};

const TOKEN_REGEX = /\[([a-z_]+)\]/g;

/**
 * Splits a string on [marker] tokens, replacing each with a KairosIcon.
 * Returns an array of React nodes suitable for rendering inside a <Text> wrapper.
 */
export function renderWithIcons(
  text: string,
  iconColor: string,
  iconSize: number = 16,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset lastIndex for safety
  TOKEN_REGEX.lastIndex = 0;

  while ((match = TOKEN_REGEX.exec(text)) !== null) {
    // Push preceding text
    if (match.index > lastIndex) {
      parts.push(
        <Text key={`t-${lastIndex}`}>{text.slice(lastIndex, match.index)}</Text>,
      );
    }

    const markerName = match[1];
    const iconName = MARKER_MAP[markerName];

    if (iconName) {
      parts.push(
        <KairosIcon
          key={`i-${match.index}`}
          name={iconName}
          size={iconSize}
          color={iconColor}
        />,
      );
    } else {
      // Unknown marker — render as-is
      parts.push(
        <Text key={`t-${match.index}`}>{match[0]}</Text>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push(
      <Text key={`t-${lastIndex}`}>{text.slice(lastIndex)}</Text>,
    );
  }

  return parts;
}

/**
 * Check if a text contains any [marker] tokens.
 */
export function hasIconMarkers(text: string): boolean {
  TOKEN_REGEX.lastIndex = 0;
  return TOKEN_REGEX.test(text);
}
