// src/engine/BlitzTypes.ts
//
// RPS Arena — Chat 11a (AI Training redesign).
//
// Shared type declarations for the Blitz system. Extracted so that:
//   1. AppNavigator can import `BlitzVariantId` without pulling in
//      the full BlitzRules module (which imports AvatarEngine).
//   2. BlitzMatchScreen, BlitzRules, and AppNavigator all reference
//      the same union — no duplication, no drift.
//   3. No circular import between navigation and rules.
//
// This file contains ZERO runtime code. Everything is `type` or
// `interface`. If the bundler includes this file, it contributes
// nothing to the output bundle — it's erased at build time.

import type { AvatarPersonality } from './AvatarEngine';

// ────────────────────────────────────────────────────────────
// The 10 Blitz variant identifiers
// ────────────────────────────────────────────────────────────

export type BlitzVariantId =
  | 'sprint'
  | 'pressure'
  | 'sudden-death'
  | 'streak-break'
  | 'duel'
  | 'sequence-recall'
  | 'countdown-mirror'
  | 'roulette'
  | 'betrayal'
  | 'two-faced';

// ────────────────────────────────────────────────────────────
// Category grouping — used by the picker UI and by analytics
// ────────────────────────────────────────────────────────────

export type BlitzCategory =
  | 'pacing'    // sprint, pressure, sudden-death
  | 'tempo'     // streak-break, duel
  | 'memory'    // sequence-recall, countdown-mirror
  | 'risk'      // roulette
  | 'adversity'; // betrayal, two-faced

// ────────────────────────────────────────────────────────────
// End conditions
// ────────────────────────────────────────────────────────────

export type BlitzEndCondition =
  | { kind: 'first-to'; targetWins: number }
  | { kind: 'timed'; durationSec: number }
  | { kind: 'sudden' }
  | { kind: 'fixed'; fixedRounds: number };

// ────────────────────────────────────────────────────────────
// Move type alias — mirrors GameEngine's `Move` union without
// importing it, so this file has zero runtime dependencies.
// ────────────────────────────────────────────────────────────

export type BlitzMove = 'rock' | 'paper' | 'scissors';

// ────────────────────────────────────────────────────────────
// Hook function signatures
// ────────────────────────────────────────────────────────────

// Optional score multiplier. Roulette uses this to award +2 for
// the highlighted move.
export type BlitzWinScoreValue = (
  userMove: BlitzMove,
  highlightedMove: BlitzMove | null
) => number;

// Optional AI replacement logic. Countdown Mirror uses this to
// replay the user's own N-back move instead of calling makeMove().
export type BlitzAiOverride = (
  recentUserMoves: BlitzMove[],
  recentAiMoves: BlitzMove[],
  ai: { makeMove: () => BlitzMove }
) => BlitzMove;

// ────────────────────────────────────────────────────────────
// Per-variant config shape
// ────────────────────────────────────────────────────────────

export interface BlitzVariantConfig {
  // Identity
  id: BlitzVariantId;
  name: string;
  icon: string;
  tagline: string;
  category: BlitzCategory;

  // How the match ends
  endCondition: BlitzEndCondition;

  // Optional per-round timer (Streak Break, Duel, Sequence Recall)
  perRoundTimerMs?: number;

  // Optional scoring hook (Roulette)
  winScoreValue?: BlitzWinScoreValue;

  // Optional AI replacement (Countdown Mirror)
  aiOverride?: BlitzAiOverride;

  // If true, a random move is highlighted each round (Roulette)
  highlightMoveBeforeRound?: boolean;

  // If set, the AI's personality is silently flipped every N rounds
  // (Two-Faced)
  personalityFlipEveryRounds?: number;
  personalityFlipAmount?: number;

  // If set, the AI's pick is revealed N ms before the user commits
  // (Betrayal)
  aiRevealWindowMs?: number;

  // Intensity multiplier passed to TrainingShift. Overrides the
  // default roundsPlayed-based formula.
  intensityMultiplier?: number;

  // Applied on top of the intensity multiplier. Some variants are
  // harder to win, so their shifts are weighted more heavily.
  shiftWeight?: number;

  // Which personality axes this variant is designed to influence.
  // Purely cosmetic — used by the result screen for teaching copy.
  teachesAxes?: Array<keyof AvatarPersonality>;
}