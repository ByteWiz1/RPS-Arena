// src/engine/BlitzRules.ts
//
// RPS Arena — Chat 11a (AI Training redesign).
//
// Rule configs for the 10 Blitz Test variants. Pure data + a small
// set of helper functions. No UI, no side effects, no I/O.
//
// Each variant is described as a `BlitzVariantConfig` object. The
// BlitzMatchScreen is a state machine that reads this config and
// adapts its behavior — one screen handles all 10 modes.
//
// Design constraints:
//   - Every variant must be WINNABLE. No rigged-by-design modes.
//     The AI gets advantages (info, tempo, drift, etc.) but always
//     leaves the user real agency to win.
//   - Every variant must produce DIFFERENT signal to feed
//     TrainingShift. If two variants produced identical stats, one
//     of them would be redundant.
//   - Every variant must feel distinct in 30 seconds of play.
//
// See PROJECT_STATE.md Chat 11a notes for design rationale per mode.

import type { AvatarPersonality } from './AvatarEngine';
import type { Move } from './GameEngine';

// ────────────────────────────────────────────────────────────
// Types
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

export type BlitzCategory = 'pacing' | 'tempo' | 'memory' | 'risk' | 'adversity';

export interface BlitzVariantConfig {
  id: BlitzVariantId;
  name: string;
  icon: string;        // lucide-react-native icon name (string), or emoji
  tagline: string;     // one-line description for the picker card
  category: BlitzCategory;

  // How the match ends.
  // - 'first-to' : first side to reach `targetWins` wins
  // - 'timed'    : match ends when `durationSec` elapses; higher score wins
  // - 'sudden'   : exactly one round decides the match
  // - 'fixed'    : `fixedRounds` rounds are played; higher score wins
  endCondition:
    | { kind: 'first-to'; targetWins: number }
    | { kind: 'timed'; durationSec: number }
    | { kind: 'sudden' }
    | { kind: 'fixed'; fixedRounds: number };

  // Optional per-round timer. If set, the user has `ms` to commit a
  // move before the round auto-resolves.
  perRoundTimerMs?: number;

  // Optional score multiplier for round wins. Called with the move
  // the user played and the highlighted move (if any).
  winScoreValue?: (userMove: Move, highlightedMove: Move | null) => number;

  // Optional AI override hook. When set, the AI's move is decided by
  // this function instead of the standard makeMove(). The function is
  // called with the AI instance and the recent move history.
  aiOverride?: (
    recentUserMoves: Move[],
    recentAiMoves: Move[],
    ai: { makeMove: () => Move }
  ) => Move;

  // If set, a move is highlighted before the round begins (used by
  // Roulette). The user can still play any move.
  highlightMoveBeforeRound?: boolean;

  // If set, the variant periodically mutates the AI's personality
  // mid-match. BlitzMatchScreen owns the timer; the config says how
  // often and by how much.
  personalityFlipEveryRounds?: number;
  personalityFlipAmount?: number;

  // If set, the AI reveals its move N ms before the user commits.
  // Used by Betrayal.
  aiRevealWindowMs?: number;

  // Intensity multiplier for TrainingShift. Overrides the default
  // roundsPlayed-based formula.
  intensityMultiplier?: number;

  // Shift weighting — some modes count more toward the personality
  // shift because they're harder to win. Betrayal is 1.5×, most are
  // 1.0×. Applied as a multiplier on top of intensity.
  shiftWeight?: number;

  // Optional: which axes this variant is designed to teach. Used by
  // TrainingResultScreen to highlight the intended learning. Purely
  // cosmetic.
  teachesAxes?: Array<keyof AvatarPersonality>;
}

// ────────────────────────────────────────────────────────────
// The catalog
// ────────────────────────────────────────────────────────────

export const BLITZ_VARIANTS: Record<BlitzVariantId, BlitzVariantConfig> = {
  // ─────────────────────────────────────────────────────────
  // 1. Sprint — baseline fast training
  // ─────────────────────────────────────────────────────────
  sprint: {
    id: 'sprint',
    name: 'Sprint',
    icon: '🏃',
    tagline: 'First to 3. Fast, clean baseline.',
    category: 'pacing',
    endCondition: { kind: 'first-to', targetWins: 3 },
    intensityMultiplier: 0.7,
    shiftWeight: 1.0,
    teachesAxes: ['aggression', 'memory'],
  },

  // ─────────────────────────────────────────────────────────
  // 2. Learn Under Pressure — timed 15–90s
  // ─────────────────────────────────────────────────────────
  pressure: {
    id: 'pressure',
    name: 'Learn Under Pressure',
    icon: '⏱️',
    tagline: 'Timed match. Higher score wins at zero.',
    category: 'pacing',
    // durationSec is set dynamically from the user's slider choice;
    // the config default is 30s but TrainingScreen / BlitzMatchScreen
    // will override it. Default kept here so the type is complete.
    endCondition: { kind: 'timed', durationSec: 30 },
    perRoundTimerMs: 0, // no per-round timer — pressure comes from the total
    intensityMultiplier: 1.2,
    shiftWeight: 1.0,
    teachesAxes: ['aggression', 'randomness'],
  },

  // ─────────────────────────────────────────────────────────
  // 3. Sudden Death — one round, decisive
  // ─────────────────────────────────────────────────────────
  'sudden-death': {
    id: 'sudden-death',
    name: 'Sudden Death',
    icon: '💀',
    tagline: 'One round. One move. Decides it all.',
    category: 'pacing',
    endCondition: { kind: 'sudden' },
    intensityMultiplier: 0.4,
    shiftWeight: 0.6, // less data, so less shift
    teachesAxes: ['aggression'],
  },

  // ─────────────────────────────────────────────────────────
  // 4. Streak Break — AI scores if you stall
  // ─────────────────────────────────────────────────────────
  'streak-break': {
    id: 'streak-break',
    name: 'Streak Break',
    icon: '⚡',
    tagline: 'Stall 5s and the AI scores. Move fast.',
    category: 'tempo',
    endCondition: { kind: 'first-to', targetWins: 3 },
    perRoundTimerMs: 5000, // auto-resolve if user doesn't commit
    intensityMultiplier: 1.0,
    shiftWeight: 1.0,
    teachesAxes: ['aggression', 'defense'],
  },

  // ─────────────────────────────────────────────────────────
  // 5. Duel — AI contests your move every 3s
  // ─────────────────────────────────────────────────────────
  duel: {
    id: 'duel',
    name: 'Duel',
    icon: '⚔️',
    tagline: 'AI grabs your move every 3s. Fight it back.',
    category: 'tempo',
    endCondition: { kind: 'first-to', targetWins: 3 },
    // The "flip" behavior is implemented in BlitzMatchScreen — every
    // 3s, if the user hasn't committed, their selection is overwritten
    // by an AI-suggested move. perRoundTimerMs is used as the flip
    // interval for this variant (misnomer, but keeps the type simple).
    perRoundTimerMs: 3000,
    intensityMultiplier: 1.0,
    shiftWeight: 1.0,
    teachesAxes: ['randomness', 'defense'],
  },

  // ─────────────────────────────────────────────────────────
  // 6. Sequence Recall — answer a 3-move pattern
  // ─────────────────────────────────────────────────────────
  'sequence-recall': {
    id: 'sequence-recall',
    name: 'Sequence Recall',
    icon: '🧠',
    tagline: 'AI shows 3 moves. Counter the next one.',
    category: 'memory',
    endCondition: { kind: 'first-to', targetWins: 3 },
    // A 5s window to watch the sequence, then commit your counter.
    // Implementation is in BlitzMatchScreen — this timer gates the
    // sequence display phase.
    perRoundTimerMs: 5000,
    intensityMultiplier: 1.1,
    shiftWeight: 1.1,
    teachesAxes: ['memory'],
  },

  // ─────────────────────────────────────────────────────────
  // 7. Countdown Mirror — AI plays your move from N rounds ago
  // ─────────────────────────────────────────────────────────
  'countdown-mirror': {
    id: 'countdown-mirror',
    name: 'Countdown Mirror',
    icon: '🪞',
    tagline: 'AI plays your own move from N rounds back.',
    category: 'memory',
    endCondition: { kind: 'first-to', targetWins: 3 },
    // The AI does NOT adapt during this match — it replays the user's
    // own history at a fixed offset. The offset starts at 5 and
    // decrements by 1 each round, bottoming out at 1.
    aiOverride: (recentUserMoves, _recentAiMoves, _ai) => {
      const offset = Math.min(5, Math.max(1, 5 - recentUserMoves.length + 1));
      const idx = recentUserMoves.length - offset;
      if (idx >= 0 && idx < recentUserMoves.length) {
        return recentUserMoves[idx];
      }
      // Not enough history yet — play a random move as fallback.
      const moves: Move[] = ['rock', 'paper', 'scissors'];
      return moves[Math.floor(Math.random() * moves.length)];
    },
    intensityMultiplier: 1.0,
    shiftWeight: 1.0,
    teachesAxes: ['memory', 'randomness'],
  },

  // ─────────────────────────────────────────────────────────
  // 8. Roulette — highlighted move = +2, any move = +1
  // ─────────────────────────────────────────────────────────
  roulette: {
    id: 'roulette',
    name: 'Roulette',
    icon: '🎰',
    tagline: 'Highlighted move wins +2. Others win +1.',
    category: 'risk',
    endCondition: { kind: 'first-to', targetWins: 6 }, // need more wins because of +2
    highlightMoveBeforeRound: true,
    winScoreValue: (userMove, highlightedMove) => {
      if (highlightedMove && userMove === highlightedMove) return 2;
      return 1;
    },
    intensityMultiplier: 1.0,
    shiftWeight: 1.0,
    teachesAxes: ['aggression'],
  },

  // ─────────────────────────────────────────────────────────
  // 9. Betrayal — AI reveals its pick 0.5–1.5s early
  // ─────────────────────────────────────────────────────────
  betrayal: {
    id: 'betrayal',
    name: 'Betrayal',
    icon: '🎭',
    tagline: 'AI predicts your move. Counter it in time.',
    category: 'adversity',
    endCondition: { kind: 'first-to', targetWins: 3 },
    // The reveal window shrinks as the match progresses.
    // BlitzMatchScreen reads this and picks a value based on round
    // number: 1500ms round 1–2, 1000ms round 3–4, 700ms round 5+,
    // 500ms on final round if tied.
    aiRevealWindowMs: 1500,
    intensityMultiplier: 1.0,
    shiftWeight: 1.5, // harder mode = more learning signal
    teachesAxes: ['defense', 'randomness'],
  },

  // ─────────────────────────────────────────────────────────
  // 10. Two-Faced — AI silently flips weights every 3 rounds
  // ─────────────────────────────────────────────────────────
  'two-faced': {
    id: 'two-faced',
    name: 'Two-Faced',
    icon: '🎭',
    tagline: 'AI silently shifts its own style every 3 rounds.',
    category: 'adversity',
    endCondition: { kind: 'fixed', fixedRounds: 9 }, // 3 flips over 9 rounds
    personalityFlipEveryRounds: 3,
    personalityFlipAmount: 0.15, // swaps weights by up to 15% each flip
    intensityMultiplier: 1.1,
    shiftWeight: 1.2, // hidden rule = harder to game
    teachesAxes: ['memory', 'randomness', 'defense'],
  },
};

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

export const BLITZ_VARIANT_ORDER: BlitzVariantId[] = [
  'sprint',
  'pressure',
  'sudden-death',
  'streak-break',
  'duel',
  'sequence-recall',
  'countdown-mirror',
  'roulette',
  'betrayal',
  'two-faced',
];

export function getBlitzConfig(id: BlitzVariantId): BlitzVariantConfig {
  return BLITZ_VARIANTS[id];
}

export function getBlitzVariantsByCategory(
  category: BlitzCategory
): BlitzVariantConfig[] {
  return BLITZ_VARIANT_ORDER.map((id) => BLITZ_VARIANTS[id]).filter(
    (v) => v.category === category
  );
}

// Human-readable label for the mode's end condition. Used by the
// match screen header and the result screen subtitle.
export function describeEndCondition(cfg: BlitzVariantConfig): string {
  switch (cfg.endCondition.kind) {
    case 'first-to':
      return `First to ${cfg.endCondition.targetWins}`;
    case 'timed':
      return `${cfg.endCondition.durationSec}s timer`;
    case 'sudden':
      return 'One round';
    case 'fixed':
      return `${cfg.endCondition.fixedRounds} rounds`;
  }
}

// Valid duration range for the Pressure variant.
export const PRESSURE_MIN_SEC = 15;
export const PRESSURE_MAX_SEC = 90;
export const PRESSURE_DEFAULT_SEC = 30;
export const PRESSURE_PRESETS = [15, 30, 60, 90] as const;

// Returns a copy of the Pressure config with the given duration baked
// in. Used by BlitzMatchScreen after the user picks a duration.
export function withPressureDuration(durationSec: number): BlitzVariantConfig {
  const clamped = Math.max(
    PRESSURE_MIN_SEC,
    Math.min(PRESSURE_MAX_SEC, Math.round(durationSec))
  );
  return {
    ...BLITZ_VARIANTS.pressure,
    endCondition: { kind: 'timed', durationSec: clamped },
  };
}

// Returns the reveal window (ms) for the Betrayal variant based on
// how many rounds have been played. Smaller = harder.
export function betrayalRevealWindowMs(
  round: number,
  isFinalTied: boolean
): number {
  if (isFinalTied) return 500;
  if (round >= 5) return 700;
  if (round >= 3) return 1000;
  return 1500;
}

// Returns a randomly flipped copy of a personality for the Two-Faced
// variant. Swaps two weights by ±amount each, never letting a value
// leave [CLAMP_MIN, CLAMP_MAX].
export function flipTwoFacedPersonality(
  p: AvatarPersonality,
  amount: number
): AvatarPersonality {
  const keys: Array<keyof AvatarPersonality> = [
    'aggression',
    'memory',
    'randomness',
    'defense',
  ];
  // Pick two distinct axes at random.
  const shuffled = [...keys].sort(() => Math.random() - 0.5);
  const [a, b] = shuffled;
  const signA = Math.random() < 0.5 ? -1 : 1;
  const signB = Math.random() < 0.5 ? -1 : 1;
  const next: AvatarPersonality = { ...p };
  next[a] = clamp01(next[a] + signA * amount);
  next[b] = clamp01(next[b] + signB * amount);
  return next;
}

function clamp01(v: number): number {
  return Math.max(0.05, Math.min(0.95, v));
}

// Random move helper used by aiOverride fallbacks.
export function randomMove(): Move {
  const moves: Move[] = ['rock', 'paper', 'scissors'];
  return moves[Math.floor(Math.random() * moves.length)];
}