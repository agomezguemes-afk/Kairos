// KAIROS — Conversational intake: shared types.
//
// The voice→block loop is a human-in-the-loop conversation: Kai reads free
// text, asks only what's missing, and materialises ONE session block for today
// as soon as it has enough. These types describe the session state the engine
// carries and the boundary contracts (IntakeDecision, ConversationDeps) that
// keep the LLM wiring injectable — so the engine is unit-testable in node with
// a deterministic mock, never importing the real transport.

import type { Discipline } from '../../../types/core';
// Type-only: erased at runtime, so node tests that import the engine never pull
// the Groq client (and its supabase side effects) into the graph.
import type { GroqMessage } from '../client';
import type { EquipmentPolicy } from './equipment';

/** Where the conversation is right now. Drives the UI's status affordances. */
export type ConversationPhase =
  | 'idle' // awaiting the user's next message
  | 'thinking' // an LLM turn is streaming
  | 'building' // the block is being generated
  | 'done' // a block is ready in the store
  | 'error';

/**
 * The minimal structured intent Kai extracts from the conversation. Everything
 * except `discipline`/`title` is optional — a good session can be built from a
 * single clear sentence. Free-form `focus`/`equipment` keep the model honest to
 * what the user actually said ("piernas", "lo que tenga en casa").
 */
export interface SessionBrief {
  /** Human title for the block, e.g. "Piernas en casa". */
  title: string;
  discipline: Discipline;
  /** What the session targets in the user's words, or null if unspecified. */
  focus: string | null;
  /** Rough session length in minutes, or null. */
  durationMin: number | null;
  location: 'casa' | 'gym' | 'aire_libre' | null;
  intensity: 'suave' | 'normal' | 'fuerte';
  /** Free-form equipment words the user mentioned, affirmatively. */
  equipment: string[];
  /**
   * The user's equipment intent as tags: what they NAMED (which becomes the
   * allowed set, replacing the location baseline) and what they NEGATED ("sin
   * barra"). Absent = they said nothing → the location baseline stands. Derived
   * deterministically from their own words; see equipment.ts for the semantics.
   */
  equipmentPolicy?: EquipmentPolicy;
  /** Anything else worth carrying into generation. */
  notes: string | null;
}

/** A materialised session, ready in the store. */
export interface BuiltSession {
  blockId: string;
  blockName: string;
  discipline: Discipline;
  exercises: { name: string; detail: string }[];
  /**
   * Estimated block duration in minutes (0 when unknown). Feeds the duration
   * chip on the block-ready card — the reference's "chip de duración". Derived
   * from the committed block's stats, so it reflects the real session, not the
   * loose brief number.
   */
  durationMin: number;
  source: 'ai' | 'template';
  /**
   * True when applyProgression actually pre-filled at least one exercise from
   * the user's history (block reference changed). Drives the quiet "memoria que
   * compone" cue on the ready card. Additive + optional: a first-ever session,
   * or a build with no matching history, leaves it undefined → no cue, no fake.
   */
  enrichedFromHistory?: boolean;
}

/** A UI-facing bubble (system messages stay out of this list). */
export interface ConversationMessage {
  id: string;
  role: 'kai' | 'user';
  text: string;
  /** True while Kai's text is still streaming in. */
  streaming?: boolean;
}

export interface ConversationState {
  /** Full LLM history including the system prompt at index 0. */
  history: GroqMessage[];
  /** UI bubbles, in order. */
  messages: ConversationMessage[];
  /** Raw user utterances, concatenated for deterministic fallback inference. */
  utterances: string[];
  userTurns: number;
  phase: ConversationPhase;
  brief: SessionBrief | null;
  result: BuiltSession | null;
  error: string | null;
}

/**
 * The outcome of one intake turn: Kai either asks a clarifying question or
 * commits to building. `closing` is an optional one-liner the model may attach
 * to the build decision; the engine has a canned fallback so confirmation copy
 * is always well-formed Spanish.
 */
export type IntakeDecision =
  | { kind: 'ask'; text: string }
  | { kind: 'build'; brief: SessionBrief; closing: string | null };

/**
 * Injected collaborators. Production wires the real Groq transport + block
 * generator (see defaultDeps.ts); tests pass deterministic stand-ins so the
 * engine's branching is verifiable without the network.
 */
export interface ConversationDeps {
  /** Can we reach the LLM right now? When false, the engine goes deterministic. */
  aiAvailable: () => boolean;
  /**
   * Run one intake turn against the model. `onDelta` receives streamed text
   * fragments (empty on the tool-call path). `forceBuild` pins the model to the
   * build tool so a rambling conversation always terminates.
   */
  intakeTurn: (
    history: GroqMessage[],
    onDelta: (delta: string) => void,
    forceBuild: boolean,
  ) => Promise<IntakeDecision>;
  /** Materialise a block from the brief and return its summary. */
  buildBlock: (brief: SessionBrief) => Promise<BuiltSession>;
}

/** Callbacks fired during a single `send`, for live UI updates. */
export interface SendCallbacks {
  /** Kai's streamed text so far (full running string, not the delta). */
  onDelta?: (fullText: string) => void;
  onPhase?: (phase: ConversationPhase) => void;
}
