// KAIROS — Canonicalize LLM-authored exercise names to the app's vocabulary.
//
// The memory is the moat: progression enrichment (src/lib/progression) matches
// an exercise against history by libraryId first, then by NORMALIZED NAME. A
// block Kai builds through the tool loop invents free-text names ("Press banca
// mancuernas", "Press militar") that never carry a libraryId and drift in
// spelling — so they never correlate with history recorded under the stable
// template/library vocabulary, and the "Con tus números de la última vez" cue
// never fires on LLM blocks.
//
// This module is the fix: a pure, deterministic post-processor that rewrites
// each generated exercise name to the closest canonical vocabulary entry
// (exercise library + starter-template options + hybrid-preset stations) and
// attaches the library entry's id where one exists (unlocking the tier-1
// match). Genuinely novel exercises with no vocabulary neighbour keep the
// model's name untouched — invention is legitimate.
//
// Matching contract (see canonicalizeExerciseName):
//   · accent/case/punctuation-insensitive, singular/plural-insensitive,
//     word-order-insensitive, connector-word-insensitive ("con", "de", "en").
//   · MOVEMENT identity is decided by the movement tokens (everything that is
//     not a connector or an implement word). Two names can only match when
//     their movement token sets are EQUAL — "Sentadilla búlgara" never
//     collapses into "Sentadilla", but "Remo con barra" == "remo barra".
//   · Implement words ("mancuernas", "barra", "goblet", "peso corporal"…) are
//     the load: same movement with a different implement is NOT the same row
//     (dumbbell RDL kilos are not barbell RDL kilos). We adopt a canonical only
//     when the implements agree — with one convention: an unmarked strength
//     name means barbell ("Press militar" IS the barbell press), so "press
//     militar con barra" still matches it at reduced affinity.
//
// Vocabulary collisions (same movement+implement under two display names, e.g.
// library "Sentadillas bodyweight" vs template "Sentadilla peso corporal")
// resolve to the BUILDER's display name with the library id merged in: template
// history matches by exact name (builder cards carry no libraryId), while
// library-picker history matches tier-1 by the merged id. Both tiers covered.
//
// Node-safe: library + routine builders + types only. No store, no transport.

import type { Discipline, MuscleGroup, WorkoutBlock } from '../../../types/core';
import { getBlockExercises } from '../../../types/core';
import type { EquipmentTag } from '../../../types/profile';
import { EXERCISE_LIBRARY } from '../../../data/exerciseLibrary';
import { buildStarterBlocks, STARTER_DISCIPLINES } from '../../routines/starterTemplates';
import type { StarterDiscipline } from '../../routines/starterTemplates';
import { buildHybridRaceBlock } from '../../routines/hybridPreset';
import { normalizeExerciseName } from '../../progression/modality';
import type { SessionBrief } from './types';

// ======================== TOKENIZATION ========================

// Multi-word phrases that must survive tokenization as ONE token. "peso muerto"
// is a movement (deadlift), not the implement word "peso"; "peso corporal" and
// "bodyweight" are the same implement said two ways.
const PHRASE_REPLACEMENTS: [RegExp, string][] = [
  [/\bpeso muerto\b/g, 'pesomuerto'],
  [/\bpeso corporal\b/g, 'pesocorporal'],
  [/\bcuerpo completo\b/g, 'fullbody'],
  [/\bpesa rusa\b/g, 'kettlebell'],
];

// Connector words carry no identity — dropped entirely before matching.
const CONNECTOR_TOKENS = new Set([
  'con',
  'de',
  'del',
  'en',
  'a',
  'al',
  'y',
  'e',
  'o',
  'u',
  'para',
  'sin',
  'por',
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  'the',
]);

// Implement / load words: same movement, different tool → different row.
const IMPLEMENT_TOKENS = new Set([
  'mancuerna',
  'barra',
  'banda',
  'kettlebell',
  'goblet',
  'peso',
  'pesocorporal',
  'disco',
  'goma',
  'toalla',
]);

// Applied after singularization: spellings that mean the same token.
const TOKEN_ALIASES: Record<string, string> = {
  bodyweight: 'pesocorporal',
};

// An unmarked strength name conventionally means barbell ("Press banca",
// "Press militar", "Sentadilla"), so an explicit "…con barra" still matches an
// implement-free canonical — at reduced affinity so an exact-implement entry
// ("Sentadilla con barra") wins when both exist.
const DEFAULT_IMPLEMENT = 'barra';
const DEFAULT_IMPLEMENT_AFFINITY = 0.5;

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Crude Spanish singularizer — enough to correlate user-typed plurals with the
// vocabulary (flexiones→flexion, mancuernas→mancuerna, zancadas→zancada). It
// only has to be *consistent* across both sides, not linguistically perfect.
function singularize(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith('ss')) return token; // "press" stays "press"
  if (token.endsWith('es') && token.length > 4) {
    const stem = token.slice(0, -2);
    // "burpees"→"burpee": plural was just +s on a vowel-ending stem.
    if (/[aeiou]$/.test(stem)) return token.slice(0, -1);
    return stem; // "flexiones"→"flexion", "elevaciones"→"elevacion"
  }
  if (token.endsWith('s')) return token.slice(0, -1);
  return token;
}

function tokenize(name: string): string[] {
  let s = stripAccents(normalizeExerciseName(name));
  for (const [re, replacement] of PHRASE_REPLACEMENTS) s = s.replace(re, replacement);
  return s
    .replace(/[^a-z0-9\s]+/g, ' ') // punctuation, "·", "+", "/" → space
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => {
      const sing = singularize(t);
      return TOKEN_ALIASES[sing] ?? sing;
    });
}

interface TokenView {
  movement: Set<string>;
  implement: Set<string>;
}

function tokenView(name: string): TokenView {
  const movement = new Set<string>();
  const implement = new Set<string>();
  for (const t of tokenize(name)) {
    if (CONNECTOR_TOKENS.has(t)) continue;
    if (IMPLEMENT_TOKENS.has(t)) implement.add(t);
    else movement.add(t);
  }
  return { movement, implement };
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

/**
 * How compatible two implement sets are, in [0, 1]. Both empty = perfect (no
 * implement stated on either side). {barra} vs {} = the barbell-by-default
 * convention. Otherwise Jaccard overlap — disjoint non-empty sets score 0 and
 * are treated as DIFFERENT exercises by the matcher.
 */
function implementAffinity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const onlyBarra = (s: Set<string>): boolean => s.size === 1 && s.has(DEFAULT_IMPLEMENT);
  if ((onlyBarra(a) && b.size === 0) || (a.size === 0 && onlyBarra(b))) {
    return DEFAULT_IMPLEMENT_AFFINITY;
  }
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ======================== VOCABULARY INDEX ========================

// Display-name priority on viewKey collisions: builder names first — template
// history matches by exact name, so the builder spelling is the load-bearing
// one. The library id is merged in regardless (see dedup).
type VocabSource = 'starter' | 'preset' | 'library';
const SOURCE_PRIORITY: Record<VocabSource, number> = { starter: 0, preset: 1, library: 2 };

interface VocabEntry {
  name: string;
  source: VocabSource;
  view: TokenView;
  libraryId?: string;
  discipline?: Discipline;
  muscleGroups?: MuscleGroup[];
}

// Singleton equipment profiles surface every gated template option: the first
// satisfiable option wins, so isolating one tag at a time reveals that tier
// (e.g. {dumbbells} → "Press banca mancuernas", {} → "Flexiones").
const EQUIP_PROFILES: EquipmentTag[][] = [
  [],
  ['barbell_plates'],
  ['dumbbells'],
  ['kettlebell'],
  ['machines_full_gym'],
  ['resistance_bands'],
  ['pull_up_bar'],
];

const STARTER_DISCIPLINE_IDS: StarterDiscipline[] = STARTER_DISCIPLINES.map((d) => d.id);

interface HarvestedName {
  name: string;
  discipline: Discipline;
  source: VocabSource;
}

// Harvest option/station names from the read-only routine builders without
// touching them: build across discipline × equipment permutations (frequency 4
// unlocks day B) and read the emitted cards' name + discipline.
function harvestFromBuilders(): HarvestedName[] {
  const out: HarvestedName[] = [];
  for (const discipline of STARTER_DISCIPLINE_IDS) {
    for (const equipment of EQUIP_PROFILES) {
      const blocks = buildStarterBlocks(
        { discipline, level: 'intermediate', frequency: 4, equipment },
        'vocab_probe',
        0,
      );
      for (const b of blocks) {
        for (const ex of getBlockExercises(b)) {
          out.push({ name: ex.name, discipline: ex.discipline, source: 'starter' });
        }
      }
    }
  }
  for (const ex of getBlockExercises(buildHybridRaceBlock())) {
    out.push({ name: ex.name, discipline: ex.discipline, source: 'preset' });
  }
  return out;
}

function viewKey(view: TokenView): string {
  return `${[...view.movement].sort().join('|')}#${[...view.implement].sort().join('|')}`;
}

// Collapse entries with the same movement+implement identity, keeping the
// highest-priority source's display name while merging libraryId/muscleGroups
// from every collapsed sibling.
function dedup(entries: VocabEntry[]): VocabEntry[] {
  const byKey = new Map<string, VocabEntry>();
  for (const e of entries) {
    const key = viewKey(e.view);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, e);
      continue;
    }
    const winner = SOURCE_PRIORITY[e.source] < SOURCE_PRIORITY[existing.source] ? e : existing;
    const loser = winner === e ? existing : e;
    byKey.set(key, {
      ...winner,
      libraryId: winner.libraryId ?? loser.libraryId,
      muscleGroups: winner.muscleGroups ?? loser.muscleGroups,
    });
  }
  return [...byKey.values()];
}

function buildVocabulary(): VocabEntry[] {
  const raw: VocabEntry[] = [];
  for (const e of EXERCISE_LIBRARY) {
    const view = tokenView(e.name);
    if (view.movement.size === 0) continue;
    raw.push({
      name: e.name,
      source: 'library',
      view,
      libraryId: e.id,
      discipline: e.discipline,
      muscleGroups: e.muscleGroups,
    });
  }
  for (const h of harvestFromBuilders()) {
    const view = tokenView(h.name);
    if (view.movement.size === 0) continue;
    raw.push({ name: h.name, source: h.source, view, discipline: h.discipline });
  }

  const deduped = dedup(raw);
  // Borrow muscle groups from a library sibling (same movement) so builder
  // options can be focus-filtered too: "Press banca mancuernas" inherits chest,
  // "Sentadilla con barra" inherits quads/glutes.
  const withGroups = deduped.filter((e) => e.muscleGroups && e.muscleGroups.length > 0);
  return deduped.map((e) => {
    if (e.muscleGroups && e.muscleGroups.length > 0) return e;
    const sibling = withGroups.find((l) => setsEqual(l.view.movement, e.view.movement));
    return sibling ? { ...e, muscleGroups: sibling.muscleGroups } : e;
  });
}

let VOCAB: VocabEntry[] | null = null;
function vocabulary(): VocabEntry[] {
  if (!VOCAB) VOCAB = buildVocabulary();
  return VOCAB;
}

// ======================== MATCHING ========================

export interface CanonicalName {
  name: string;
  libraryId?: string;
}

/** Deterministic tie-break at equal affinity. */
function preferOver(cand: VocabEntry, cur: VocabEntry): boolean {
  const cl = cand.libraryId ? 1 : 0;
  const ul = cur.libraryId ? 1 : 0;
  if (cl !== ul) return cl > ul; // a libraryId (tier-1 match) is worth more
  const cp = SOURCE_PRIORITY[cand.source];
  const up = SOURCE_PRIORITY[cur.source];
  if (cp !== up) return cp < up;
  if (cand.name.length !== cur.name.length) return cand.name.length < cur.name.length;
  return cand.name < cur.name; // stable, deterministic
}

/**
 * Resolve one free-text exercise name to its canonical vocabulary entry.
 * Adopts a canonical only when the movement tokens are identical AND the
 * implements are compatible (affinity > 0). Everything else — novel movements,
 * implement variants the vocabulary doesn't carry ("sentadilla con
 * mancuernas") — keeps the model's name: an honest new row beats a polluted
 * history under a non-comparable load.
 */
export function canonicalizeExerciseName(rawName: string): CanonicalName {
  const q = tokenView(rawName);
  if (q.movement.size === 0) return { name: rawName };

  let best: VocabEntry | null = null;
  let bestAffinity = 0;
  for (const cand of vocabulary()) {
    if (!setsEqual(q.movement, cand.view.movement)) continue;
    const affinity = implementAffinity(q.implement, cand.view.implement);
    if (affinity > bestAffinity || (affinity === bestAffinity && best && preferOver(cand, best))) {
      best = cand;
      bestAffinity = affinity;
    }
  }
  if (!best || bestAffinity <= 0) return { name: rawName };
  return best.libraryId ? { name: best.name, libraryId: best.libraryId } : { name: best.name };
}

/**
 * Return a copy of `block` with every exercise name canonicalized and, where
 * the canonical carries one, its libraryId attached. Pure + immutable:
 * unchanged exercises pass through by reference, and an all-novel block returns
 * the same block reference. Must run BEFORE applyProgression so enrichment
 * sees canonical names.
 */
export function canonicalizeBlock(block: WorkoutBlock): WorkoutBlock {
  let changed = false;
  const content = block.content.map((node) => {
    if (node.type !== 'exercise') return node;
    const card = node.data.exercise;
    const canonical = canonicalizeExerciseName(card.name);
    const nextLibraryId = canonical.libraryId ?? card.libraryId;
    if (canonical.name === card.name && nextLibraryId === card.libraryId) return node;
    changed = true;
    return {
      ...node,
      data: {
        ...node.data,
        exercise: {
          ...card,
          name: canonical.name,
          libraryId: nextLibraryId,
          updated_at: new Date().toISOString(),
        },
      },
    };
  });
  if (!changed) return block;
  return { ...block, content, updated_at: new Date().toISOString() };
}

// ======================== VOCABULARY BIAS (generation) ========================

// Focus phrase → target muscle groups. The ONE mapping from the user's words to
// the data model's muscle groups: it biases the compact prompt list (LLM path),
// enforces coherence (off-target moves never enter a focused session's list),
// and drives the deterministic focus-aware composer (focusSession.ts).
//
// A phrase we don't recognise ("cuerpo completo", "hyrox", "lo que sea") yields
// NO groups on purpose — the caller then keeps its unfocused, full-body default
// instead of guessing.
const FOCUS_MUSCLES: { keywords: string[]; groups: MuscleGroup[] }[] = [
  {
    keywords: [
      'pierna',
      'cuadriceps',
      'gluteo',
      'sentadilla',
      'femoral',
      'gemelo',
      'tren inferior',
    ],
    groups: ['quads', 'glutes', 'hamstrings', 'calves'],
  },
  { keywords: ['pecho', 'banca', 'pectoral'], groups: ['chest'] },
  { keywords: ['espalda', 'dominad', 'remo', 'jalon', 'dorsal'], groups: ['back'] },
  { keywords: ['hombro', 'militar', 'deltoide'], groups: ['shoulders'] },
  {
    keywords: ['biceps', 'triceps', 'brazo', 'curl', 'antebrazo'],
    groups: ['biceps', 'triceps', 'forearms'],
  },
  { keywords: ['core', 'abdomin', 'plancha'], groups: ['core'] },
  {
    keywords: ['tren superior', 'torso'],
    groups: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  },
  // Movement patterns: the gym vernacular for push/pull days.
  { keywords: ['empuje', 'empujar', 'push'], groups: ['chest', 'shoulders', 'triceps'] },
  { keywords: ['tiron', 'traccion', 'pull'], groups: ['back', 'biceps'] },
];

/**
 * The user's free-text focus ("espalda", "tren superior", "empuje") → the muscle
 * groups it targets. Empty when the focus is absent or unrecognised.
 */
export function focusMuscleGroups(focus: string | null): MuscleGroup[] {
  if (!focus) return [];
  const f = stripAccents(focus.toLowerCase());
  const groups = new Set<MuscleGroup>();
  for (const { keywords, groups: g } of FOCUS_MUSCLES) {
    if (keywords.some((k) => f.includes(k))) g.forEach((x) => groups.add(x));
  }
  return [...groups];
}

function scoreForBrief(e: VocabEntry, discipline: Discipline, groups: MuscleGroup[]): number {
  if (groups.length > 0) {
    // Focused session: keep only on-target moves — the coherence guarantee.
    if (!e.muscleGroups || e.muscleGroups.length === 0) return 0;
    if (!e.muscleGroups.some((g) => groups.includes(g))) return 0;
    return 5 + (e.discipline === discipline ? 1 : 0);
  }
  // Unfocused: rank by discipline, keep mobility/general as low-priority filler.
  if (e.discipline === discipline) return 3;
  if (e.discipline === 'general' || e.discipline === 'mobility') return 1;
  return 0;
}

/**
 * A compact, focus-biased list of canonical exercise names to steer generation.
 * Capped (default 60) to protect the token budget; for a focused session it
 * contains only on-target moves, so the model is nudged away from incoherent
 * picks (no bench press in a leg day).
 */
export function selectVocabularyForBrief(
  brief: Pick<SessionBrief, 'discipline' | 'focus'>,
  limit = 60,
): string[] {
  const groups = focusMuscleGroups(brief.focus);
  const scored = vocabulary()
    .map((e) => ({ e, score: scoreForBrief(e, brief.discipline, groups) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name));

  const names: string[] = [];
  const seen = new Set<string>();
  for (const { e } of scored) {
    if (seen.has(e.name)) continue;
    seen.add(e.name);
    names.push(e.name);
    if (names.length >= limit) break;
  }
  return names;
}
