import { describe, it, expect } from 'vitest';
import { listeningDisplay, LISTENING_PLACEHOLDER } from './listeningDisplay';

describe('listeningDisplay', () => {
  it('shows the calm invitation before any word arrives', () => {
    expect(listeningDisplay('')).toEqual({ text: LISTENING_PLACEHOLDER, isPlaceholder: true });
  });

  it('treats whitespace-only transcripts as still empty', () => {
    expect(listeningDisplay('   \n  ')).toEqual({
      text: LISTENING_PLACEHOLDER,
      isPlaceholder: true,
    });
  });

  it('passes through and trims a real transcript', () => {
    expect(listeningDisplay('  piernas en casa  ')).toEqual({
      text: 'piernas en casa',
      isPlaceholder: false,
    });
  });

  it('keeps interior spacing as the transcript grows', () => {
    expect(listeningDisplay('una carrera suave de treinta minutos').text).toBe(
      'una carrera suave de treinta minutos',
    );
  });
});
