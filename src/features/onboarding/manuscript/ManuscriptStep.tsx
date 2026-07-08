// KAIROS — ManuscriptStep: the first page of your Book, written with Kai.
//
// The onboarding questions become a manuscript: Kai's ink types sentences with
// blanks; the user fills them inline (loose gold-italic words, a draggable
// numeral, prose-composing equipment words, a free line). Every blank has a
// dignified skip (Kai rewrites the sentence — never an empty slot), and the
// whole page can be handed to Kai ("skip to value", ≤30s). When the page is
// signed it folds to ghost ink and the first block rises from it (the
// presentation step). See docs/ONBOARDING_MANUSCRITO.md.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Type } from '../../../theme/tokens';
import { Fonts } from '../../../theme/fonts';
import KaiFace from '../premium/KaiFace';
import {
  CLOSING_LINE,
  OPENING_LINE,
  SENTENCES,
  SIGNATURE,
  serialList,
  type ChoiceOption,
  type FilledBlank,
  type SentenceSpec,
} from './manuscript';
import { MAX_AI_PROMPT_LEN, MAX_NAME_LEN } from '../flow/onboardingFlow';
import InkSentence, { useTyped, type SentencePhase } from './InkSentence';
import WordRow from './blanks/WordRow';
import ScrubberBlank from './blanks/ScrubberBlank';
import TextBlank from './blanks/TextBlank';

interface LineState {
  phase: SentencePhase;
  skipped: boolean;
  /** Prose mirrored into the sentence blank. */
  fill: string | null;
  /** Raw value handed back to the draft. */
  value: string | number | readonly string[] | null;
}

interface ManuscriptStepProps {
  onDone: (filled: FilledBlank[]) => void;
  /** DEV: drive the page with scripted fills (visual self-validation). */
  autoplay?: boolean;
  /** DEV: stop the autoplay at a state so it can be photographed. */
  freezeAt?: SentenceSpec['id'] | 'signature';
}

type PageStage = 'opening' | 'sentences' | 'closing' | 'signed' | 'folding';

/** Kai's own ink (opening/closing) — typed, no blank. */
function InkLine({
  text,
  muted = false,
  onDone,
}: {
  text: string;
  muted?: boolean;
  onDone?: () => void;
}) {
  const reduce = useReducedMotion();
  const shown = useTyped(text, true, reduce, onDone);
  return (
    <Animated.Text
      entering={reduce ? undefined : FadeIn.duration(200)}
      style={[styles.kaiInk, muted && styles.kaiInkMuted]}
    >
      {shown}
    </Animated.Text>
  );
}

export default function ManuscriptStep({
  onDone,
  autoplay = false,
  freezeAt,
}: ManuscriptStepProps) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<PageStage>('opening');
  const [cursor, setCursor] = useState(-1);
  const [lines, setLines] = useState<LineState[]>(() =>
    SENTENCES.map(() => ({ phase: 'writing', skipped: false, fill: null, value: null })),
  );
  // Chips working set (equipment) — words compose live into the sentence.
  const [picked, setPicked] = useState<string[]>([]);
  const [days, setDays] = useState(3);
  const [text, setText] = useState('');
  // Re-opened settled line (tap to edit). Only one editor lives at a time.
  const [editing, setEditing] = useState<number | null>(null);
  const cursorRef = useRef(cursor);
  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  const patch = useCallback((i: number, p: Partial<LineState>) => {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...p } : l)));
  }, []);

  // ── Page flow ──────────────────────────────────────────────────────────────
  const startSentences = useCallback(() => {
    setStage('sentences');
    setCursor(0);
  }, []);

  const advance = useCallback((from: number) => {
    if (from !== cursorRef.current) return; // a re-edited line never moves the pen
    Keyboard.dismiss();
    if (from + 1 < SENTENCES.length) {
      setCursor(from + 1);
    } else {
      setStage('closing');
    }
  }, []);

  const settle = useCallback(
    (i: number, fill: string, value: LineState['value']) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (editing === i) {
        // Re-edited line: its closing ink is already written — just retint.
        patch(i, { phase: 'done', fill, value, skipped: false });
        setEditing(null);
        Keyboard.dismiss();
        return;
      }
      patch(i, { phase: 'settling', fill, value });
    },
    [patch, editing],
  );

  const skip = useCallback(
    (i: number) => {
      Haptics.selectionAsync().catch(() => {});
      patch(i, { phase: 'settling', skipped: true, fill: null, value: null });
      setEditing(null);
      Keyboard.dismiss();
    },
    [patch],
  );

  // The whole-page skip: Kai fills the rest (skip-to-value ≤30s).
  const handToKai = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Keyboard.dismiss();
    setLines((prev) =>
      prev.map((l) => (l.phase === 'done' ? l : { ...l, phase: 'settling', skipped: true })),
    );
    setCursor(SENTENCES.length - 1);
    setStage('closing');
  }, []);

  // Sign + fold once the closing ink is on the page.
  const fold = useSharedValue(0);
  const signed = useCallback(() => {
    setStage('signed');
    if (freezeAt === 'signature') return;
    const filled: FilledBlank[] = SENTENCES.map((s, i) => ({
      id: s.id,
      skipped: lines[i].skipped || lines[i].phase !== 'done',
      value: lines[i].value,
    }));
    const go = () => doneRef.current(filled);
    setTimeout(
      () => {
        setStage('folding');
        fold.value = withTiming(1, {
          duration: reduce ? 80 : 620,
          easing: Easing.in(Easing.cubic),
        });
        setTimeout(go, reduce ? 120 : 700);
      },
      reduce ? 200 : 1100,
    );
  }, [lines, fold, reduce, freezeAt]);

  const pageStyle = useAnimatedStyle(() => ({
    opacity: 1 - fold.value * 0.85,
    transform: [{ translateY: fold.value * -14 }, { scale: 1 - fold.value * 0.02 }],
  }));

  const reopen = useCallback(
    (i: number) => {
      if (stage !== 'sentences') return; // the signed page is history, not a form
      const spec = SENTENCES[i];
      const l = lines[i];
      Haptics.selectionAsync().catch(() => {});
      if (spec.kind === 'scrubber') setDays(typeof l.value === 'number' ? l.value : 3);
      if (spec.kind === 'chips') setPicked(Array.isArray(l.value) ? [...l.value] : []);
      if (spec.kind === 'text' || spec.kind === 'prompt')
        setText(typeof l.value === 'string' ? l.value : '');
      patch(i, { phase: 'filling', skipped: false });
      setEditing(i);
    },
    [stage, lines, patch],
  );

  // ── Live fill mirrors ─────────────────────────────────────────────────────
  const fillFor = useCallback(
    (i: number): string | null => {
      const spec = SENTENCES[i];
      const l = lines[i];
      if (l.phase === 'settling' || l.phase === 'done') return l.fill;
      if (l.phase !== 'filling') return null;
      const active = editing ?? cursor;
      if (i !== active) return l.fill;
      switch (spec.kind) {
        case 'scrubber':
          return String(days);
        case 'chips':
          return picked.length > 0
            ? serialList(picked.map((v) => spec.options?.find((o) => o.value === v)?.word ?? v))
            : null;
        case 'text':
        case 'prompt':
          return text.length > 0 ? text : null;
        default:
          return null;
      }
    },
    [lines, days, picked, text, editing, cursor],
  );

  // ── Editors ────────────────────────────────────────────────────────────────
  const confirmChoice = useCallback(
    (i: number, o: ChoiceOption) => settle(i, o.word, o.value),
    [settle],
  );

  const renderEditor = (i: number) => {
    const spec = SENTENCES[i];
    switch (spec.kind) {
      case 'choice':
        return (
          <WordRow
            options={spec.options ?? []}
            selected={[]}
            onToggle={(o) => confirmChoice(i, o)}
            skipLabel={spec.skipLabel}
            onSkip={() => skip(i)}
          />
        );
      case 'chips':
        return (
          <WordRow
            options={spec.options ?? []}
            selected={picked}
            onToggle={(o) =>
              setPicked((prev) =>
                prev.includes(o.value) ? prev.filter((x) => x !== o.value) : [...prev, o.value],
              )
            }
            skipLabel={spec.skipLabel}
            onSkip={() => skip(i)}
            confirmLabel="y ya"
            onConfirm={() =>
              settle(
                i,
                serialList(picked.map((v) => spec.options?.find((o) => o.value === v)?.word ?? v)),
                picked,
              )
            }
          />
        );
      case 'scrubber':
        return (
          <ScrubberBlank
            value={days}
            onChange={setDays}
            onConfirm={() => settle(i, String(days), days)}
            skipLabel={spec.skipLabel}
            onSkip={() => skip(i)}
          />
        );
      case 'text':
        return (
          <TextBlank
            value={text}
            onChange={(t) => setText(t)}
            // The committed text comes from the input's own submit/blur event —
            // never from `text` render state, which lags fast typing (P0 fix).
            onConfirm={(committed) => {
              const t = committed.trim();
              if (t.length > 0) settle(i, t, t);
              else skip(i);
            }}
            skipLabel={spec.skipLabel}
            onSkip={() => skip(i)}
            placeholder="tu nombre"
            maxLength={MAX_NAME_LEN}
          />
        );
      case 'prompt':
        return (
          <TextBlank
            value={text}
            onChange={(t) => setText(t)}
            onConfirm={(committed) => {
              const t = committed.trim();
              if (t.length > 0) settle(i, t, t);
              else skip(i);
            }}
            skipLabel={spec.skipLabel}
            onSkip={() => skip(i)}
            placeholder="lo que Kai deba saber"
            maxLength={MAX_AI_PROMPT_LEN}
            multiline
          />
        );
    }
  };

  // Reset per-sentence working state when the cursor moves.
  useEffect(() => {
    setText('');
  }, [cursor]);

  // ── Autoplay (DEV visual validation) ──────────────────────────────────────
  useEffect(() => {
    if (!autoplay || cursor < 0 || cursor >= SENTENCES.length) return;
    const l = lines[cursor];
    if (l.phase !== 'filling') return;
    const spec = SENTENCES[cursor];
    if (freezeAt === spec.id) {
      // Photographic freeze: stage the editor's state but never settle.
      if (spec.id === 'days') setDays(4);
      if (spec.id === 'equipment') setPicked(['dumbbells', 'resistance_bands', 'yoga_mat']);
      return;
    }
    const t = setTimeout(() => {
      switch (spec.id) {
        case 'name':
          settle(cursor, 'Álvaro', 'Álvaro');
          break;
        case 'goal':
          confirmChoice(cursor, spec.options![0]);
          break;
        case 'experience':
          confirmChoice(cursor, spec.options![1]);
          break;
        case 'days': {
          setDays(4);
          setTimeout(() => settle(cursor, '4', 4), 600);
          break;
        }
        case 'equipment': {
          const vals = ['dumbbells', 'resistance_bands', 'yoga_mat'];
          setPicked(vals);
          setTimeout(
            () =>
              settle(
                cursor,
                serialList(vals.map((v) => spec.options?.find((o) => o.value === v)?.word ?? v)),
                vals,
              ),
            700,
          );
          break;
        }
        case 'prompt':
          skip(cursor);
          break;
      }
    }, 900);
    return () => clearTimeout(t);
  }, [autoplay, cursor, lines, settle, skip, confirmChoice, freezeAt]);

  // ── Margin rule (progress as ink, not a stepper) ──────────────────────────
  const settledCount = lines.filter((l) => l.phase === 'done').length;
  const [pageH, setPageH] = useState(0);
  const rule = useSharedValue(0);
  useEffect(() => {
    const target = pageH * (settledCount / SENTENCES.length);
    rule.value = reduce ? target : withSpring(target, { damping: 22, stiffness: 120 });
  }, [settledCount, pageH, rule, reduce]);
  const ruleStyle = useAnimatedStyle(() => ({ height: rule.value }));

  const glifoEmotion = useMemo(() => {
    if (stage === 'signed' || stage === 'folding') return 'happy' as const;
    if (cursor >= 0 && cursor < SENTENCES.length && lines[cursor]?.phase === 'writing')
      return 'thinking' as const;
    return 'idle' as const;
  }, [stage, cursor, lines]);

  const visibleCount = stage === 'opening' ? 0 : Math.min(cursor + 1, SENTENCES.length);
  const pageDone = stage === 'signed' || stage === 'folding';

  return (
    <Animated.View style={[styles.root, pageStyle]}>
      <View style={styles.masthead}>
        <Text style={styles.eyebrow}>TU LIBRO · PÁGINA PRIMERA</Text>
        <KaiFace size={44} emotion={glifoEmotion} showGlow={false} interactive={false} />
      </View>

      <View style={styles.page} onLayout={(e) => setPageH(e.nativeEvent.layout.height)}>
        <Animated.View style={[styles.marginRule, ruleStyle]} />

        <InkLine text={OPENING_LINE} muted onDone={startSentences} />

        {SENTENCES.slice(0, visibleCount).map((spec, i) => {
          const l = lines[i];
          return (
            <View key={spec.id}>
              <InkSentence
                spec={spec}
                phase={l.phase}
                fill={fillFor(i)}
                skipped={l.skipped}
                onReady={() => patch(i, { phase: 'filling' })}
                onSettled={() => {
                  if (l.phase === 'done') return;
                  patch(i, { phase: 'done' });
                  setEditing(null);
                  setTimeout(() => advance(i), 340);
                }}
                onReopen={stage === 'sentences' && editing == null ? () => reopen(i) : undefined}
              />
              {l.phase === 'filling' && (editing ?? cursor) === i && !pageDone && (
                <Animated.View
                  entering={reduce ? undefined : FadeIn.duration(240)}
                  style={styles.editorRow}
                >
                  {renderEditor(i)}
                </Animated.View>
              )}
            </View>
          );
        })}

        {(stage === 'closing' || pageDone) && (
          <View style={styles.closing}>
            <InkLine text={CLOSING_LINE} onDone={signed} />
            {pageDone && (
              <Animated.View
                entering={reduce ? undefined : FadeIn.duration(300)}
                style={styles.signatureRow}
              >
                <Text style={styles.signature}>{SIGNATURE}</Text>
                <KaiFace size={44} emotion="happy" showGlow={false} interactive={false} />
              </Animated.View>
            )}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {!pageDone && stage !== 'closing' && (
          <Pressable
            onPress={handToKai}
            accessibilityRole="button"
            accessibilityLabel="Que Kai rellene el resto"
            style={styles.handOff}
            hitSlop={8}
          >
            <Text style={styles.handOffText}>Que Kai lo rellene</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: Spacing.sm },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  eyebrow: { ...Type.eyebrow, color: Colors.gold.deep },
  page: { paddingLeft: Spacing.lg, position: 'relative' },
  marginRule: {
    position: 'absolute',
    left: 0,
    top: 4,
    width: 2,
    borderRadius: 1,
    backgroundColor: Colors.gold.base,
    opacity: 0.55,
  },
  kaiInk: {
    fontFamily: Fonts.serifItalic,
    fontSize: 19,
    lineHeight: 27,
    color: Colors.ink.secondary,
    marginBottom: Spacing.xl,
  },
  kaiInkMuted: { color: Colors.ink.tertiary },
  editorRow: {
    marginTop: -Spacing.xs,
    marginBottom: Spacing.lg,
  },
  closing: { marginTop: Spacing.md },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  signature: {
    fontFamily: Fonts.serifSemiBoldItalic,
    fontSize: 22,
    color: Colors.ink.primary,
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    minHeight: 56,
    marginTop: Spacing.xl,
  },
  handOff: { paddingVertical: 12, paddingHorizontal: 16 },
  handOffText: { ...Type.caption, color: Colors.ink.tertiary },
});
