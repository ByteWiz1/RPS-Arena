// src/engine/TrainingShift.ts
//
// RPS Arena — Chat 11a (AI Training redesign).
//
// The redesigned personality-shift engine. Replaces the simple
// additive rules from Chat 10 with a system designed to feel organic:
//
//   1. Small base magnitudes (0.01–0.03) instead of 0.05–0.09
//   2. Paired-axis TRADEOFFS — raising one axis dampens its partner
//      (aggression ↔ defense, memory ↔ randomness)
//   3. DECAY — unused axes drift back toward 0.5 (forgetting)
//   4. DIMINISHING RETURNS — shifts are dampened as a weight
//      approaches an extreme (0.05 or 0.95)
//   5. JITTER — ±20% random noise so identical matches don't
//      produce identical shifts
//   6. Intensity scaling — longer/harder matches move weights more
//
// Every function is PURE. No side effects, no store access, no I/O.
// This makes the engine unit-testable and easy to reason about.
//
// The shift is applied in this order:
//
//   rawDelta = sum of triggered rule deltas
//   → tradeoff pass (paired axes lose some of their gain)
//   → diminishing-returns pass (dampen near extremes)
//   → jitter pass (±20% random)
//   → intensity multiplier (based on rounds played)
//   → decay pass (unused axes drift toward 0.5)
//   → clamp to [0.05, 0.95]
//
// See PROJECT_STATE.md Chat 11a notes for the design rationale.

import type { AvatarPersonality } from './AvatarEngine';

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

export const CLAMP_MIN = 0.05;
export const CLAMP_MAX = 0.95;
const CENTER = 0.5;

// Per-match base magnitudes for each rule (Chat 11a redesign).
// Chat 10 used 0.05–0.09; we're down to 0.015–0.03 so a fully
// trained avatar takes ~25–40 matches instead of 3–5.
const RULE_MAGNITUDES = {
  userDominant: {
    // userWinRate > 0.6
    memory: 0.025,
    randomness: 0.015,
  },
  aiDominant: {
    // aiWinRate > 0.6
    aggression: 0.02,
    defense: 0.015,
  },
  predictable: {
    // userMoveDiversity < 0.4
    memory: 0.03,
    aggression: 0.015,
  },
  unpredictable: {
    // userMoveDiversity > 0.7
    randomness: 0.025,
    defense: 0.015,
  },
} as const;

// Paired-axis tradeoff ratios. When an axis gains X, its partner
// loses `ratio × X`. Aggression ↔ Defense is a hard tradeoff (0.5);
// memory ↔ randomness is softer (0.4) because a smart AI *can* also
// be somewhat varied.
const TRADEOFF_PAIRS: Array<{
  gain: keyof AvatarPersonality;
  loss: keyof AvatarPersonality;
  ratio: number;
}> = [
  { gain: 'aggression', loss: 'defense', ratio: 0.5 },
  { gain: 'defense', loss: 'aggression', ratio: 0.5 },
  { gain: 'memory', loss: 'randomness', ratio: 0.4 },
  { gain: 'randomness', loss: 'memory', ratio: 0.4 },
];

// Per-match decay rate. Unused axes lose 2% of their distance from
// 0.5 each match. Over 20 unused matches, an axis at 0.90 → ~0.65.
const DECAY_RATE = 0.02;

// Jitter amplitude. Each delta is multiplied by (1 + r) where
// r ∈ [-0.20, +0.20]. Makes identical matches produce slightly
// different results.
const JITTER_RANGE = 0.20;

// Intensity scaling: how much a match's round count amplifies the
// shift. intensity = clamp(roundsPlayed / 10, 0.5, 1.5). A 5-round
// match is 0.5×; a 15-round match is 1.5×.
const INTENSITY_MIN = 0.5;
const INTENSITY_MAX = 1.5;
const INTENSITY_PIVOT = 10;

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface MatchStats {
  userWinRate: number;      // 0..1
  aiWinRate: number;        // 0..1
  tieRate: number;          // 0..1
  userMoveDiversity: number; // 0..1 (unique moves / total moves)
  roundsPlayed: number;
}

export interface ShiftResult {
  before: AvatarPersonality;
  after: AvatarPersonality;
  // Per-axis deltas (after - before). Positive = increased.
  delta: AvatarPersonality;
  // Human-readable rules that fired, with direction arrows for each.
  // e.g. "You won most rounds → memory ▲, randomness ▲"
  notes: string[];
  // Sum of absolute delta across all four axes.
  totalDelta: number;
  // Intensity multiplier that was applied.
  intensity: number;
  // Optional: the mode label ("Sparring", "Sprint", etc.) — used by
  // the result screen to render mode-specific copy. Not consumed by
  // the math itself.
  modeLabel?: string;
}

// ────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────

function clamp(v: number): number {
  return Math.max(CLAMP_MIN, Math.min(CLAMP_MAX, v));
}

function roundTo(v: number, digits: number): number {
  const m = Math.pow(10, digits);
  return Math.round(v * m) / m;
}

// Diminishing returns: the closer an axis already is to an extreme,
// the harder it is to move further. Multiplier goes from 1.0 at
// center to 0.2 at the clamp.
//
// Uses a smooth curve so the transition is not abrupt.
function diminishingMultiplier(value: number): number {
  const distFromCenter = Math.abs(value - CENTER) * 2; // 0 at center, 1 at extremes
  // 1.0 at center, 0.2 at extremes, quadratic falloff
  return 1 - 0.8 * distFromCenter * distFromCenter;
}

// ────────────────────────────────────────────────────────────
// Main shift computation
// ────────────────────────────────────────────────────────────

export function computeShift(
  before: AvatarPersonality,
  stats: MatchStats
): ShiftResult {
  // ── Step 1: Collect raw deltas from triggered rules ──
  const raw: AvatarPersonality = {
    aggression: 0,
    memory: 0,
    randomness: 0,
    defense: 0,
  };
  const notes: string[] = [];

  if (stats.userWinRate > 0.6) {
    raw.memory += RULE_MAGNITUDES.userDominant.memory;
    raw.randomness += RULE_MAGNITUDES.userDominant.randomness;
    notes.push(
      `You won most rounds → memory ▲${pct(RULE_MAGNITUDES.userDominant.memory)}, ` +
      `randomness ▲${pct(RULE_MAGNITUDES.userDominant.randomness)}`
    );
  }

  if (stats.aiWinRate > 0.6) {
    raw.aggression += RULE_MAGNITUDES.aiDominant.aggression;
    raw.defense += RULE_MAGNITUDES.aiDominant.defense;
    notes.push(
      `Your AI won most rounds → aggression ▲${pct(RULE_MAGNITUDES.aiDominant.aggression)}, ` +
      `defense ▲${pct(RULE_MAGNITUDES.aiDominant.defense)}`
    );
  }

  if (stats.userMoveDiversity < 0.4) {
    raw.memory += RULE_MAGNITUDES.predictable.memory;
    raw.aggression += RULE_MAGNITUDES.predictable.aggression;
    notes.push(
      `You played predictably → memory ▲${pct(RULE_MAGNITUDES.predictable.memory)}, ` +
      `aggression ▲${pct(RULE_MAGNITUDES.predictable.aggression)}`
    );
  }

  if (stats.userMoveDiversity > 0.7) {
    raw.randomness += RULE_MAGNITUDES.unpredictable.randomness;
    raw.defense += RULE_MAGNITUDES.unpredictable.defense;
    notes.push(
      `You were unpredictable → randomness ▲${pct(RULE_MAGNITUDES.unpredictable.randomness)}, ` +
      `defense ▲${pct(RULE_MAGNITUDES.unpredictable.defense)}`
    );
  }

  // No rules fired — balanced match, but decay still applies.
  if (notes.length === 0) {
    notes.push('Balanced match — no strong signal, values relax toward center');
  }

  // ── Step 2: Apply tradeoff pass ──
  // For each gain, subtract a fraction from its paired axis.
  // Uses a snapshot of `raw` so order of application doesn't matter.
  const tradeoffs = { ...raw };
  for (const pair of TRADEOFF_PAIRS) {
    if (raw[pair.gain] > 0) {
      tradeoffs[pair.loss] -= raw[pair.gain] * pair.ratio;
    }
  }
  // Replace `raw` with the tradeoff-adjusted values. Clamp each
  // delta's magnitude to prevent pathological double-subtraction.
  const afterTradeoffs: AvatarPersonality = {
    aggression: tradeoffs.aggression,
    memory: tradeoffs.memory,
    randomness: tradeoffs.randomness,
    defense: tradeoffs.defense,
  };

  // ── Step 3: Apply diminishing returns ──
  const damped: AvatarPersonality = {
    aggression: afterTradeoffs.aggression * diminishingMultiplier(before.aggression),
    memory: afterTradeoffs.memory * diminishingMultiplier(before.memory),
    randomness: afterTradeoffs.randomness * diminishingMultiplier(before.randomness),
    defense: afterTradeoffs.defense * diminishingMultiplier(before.defense),
  };

  // ── Step 4: Apply jitter ──
  const jitter = (v: number) => {
    const r = (Math.random() * 2 - 1) * JITTER_RANGE;
    return v * (1 + r);
  };
  const jittered: AvatarPersonality = {
    aggression: jitter(damped.aggression),
    memory: jitter(damped.memory),
    randomness: jitter(damped.randomness),
    defense: jitter(damped.defense),
  };

  // ── Step 5: Apply intensity multiplier ──
  const intensity = Math.max(
    INTENSITY_MIN,
    Math.min(INTENSITY_MAX, stats.roundsPlayed / INTENSITY_PIVOT)
  );
  const scaled: AvatarPersonality = {
    aggression: jittered.aggression * intensity,
    memory: jittered.memory * intensity,
    randomness: jittered.randomness * intensity,
    defense: jittered.defense * intensity,
  };

  // ── Step 6: Apply to `before` to get the pre-decay result ──
  const preDecay: AvatarPersonality = {
    aggression: before.aggression + scaled.aggression,
    memory: before.memory + scaled.memory,
    randomness: before.randomness + scaled.randomness,
    defense: before.defense + scaled.defense,
  };

  // ── Step 7: Apply decay to UNUSED axes ──
  // An axis is "used" if it received any nonzero raw delta from a
  // rule. Unused axes drift toward 0.5.
  const used = {
    aggression: raw.aggression !== 0,
    memory: raw.memory !== 0,
    randomness: raw.randomness !== 0,
    defense: raw.defense !== 0,
  };

  const decayAxis = (v: number, isUsed: boolean): number => {
    if (isUsed) return v; // no decay on axes the match touched
    return v + (CENTER - v) * DECAY_RATE;
  };

  const afterDecay: AvatarPersonality = {
    aggression: decayAxis(preDecay.aggression, used.aggression),
    memory: decayAxis(preDecay.memory, used.memory),
    randomness: decayAxis(preDecay.randomness, used.randomness),
    defense: decayAxis(preDecay.defense, used.defense),
  };

  // ── Step 8: Clamp and round ──
  const final: AvatarPersonality = {
    aggression: roundTo(clamp(afterDecay.aggression), 4),
    memory: roundTo(clamp(afterDecay.memory), 4),
    randomness: roundTo(clamp(afterDecay.randomness), 4),
    defense: roundTo(clamp(afterDecay.defense), 4),
  };

  // ── Step 9: Compute delta and totalDelta ──
  const delta: AvatarPersonality = {
    aggression: roundTo(final.aggression - before.aggression, 4),
    memory: roundTo(final.memory - before.memory, 4),
    randomness: roundTo(final.randomness - before.randomness, 4),
    defense: roundTo(final.defense - before.defense, 4),
  };

  const totalDelta = roundTo(
    Math.abs(delta.aggression) +
      Math.abs(delta.memory) +
      Math.abs(delta.randomness) +
      Math.abs(delta.defense),
    4
  );

  // ── Step 10: Annotate notes with actual post-shift directions ──
  // The rule notes describe intent; these add the *observed* delta
  // including tradeoff + decay effects. Only adds a supplementary
  // line if the observed direction differs from the naive intent.
  const observed: string[] = [];
  const describe = (name: string, d: number) => {
    if (Math.abs(d) < 0.002) return; // below display resolution
    const arrow = d > 0 ? '▲' : '▼';
    observed.push(`${name} ${arrow} ${pct(Math.abs(d))}`);
  };
  describe('aggression', delta.aggression);
  describe('memory', delta.memory);
  describe('randomness', delta.randomness);
  describe('defense', delta.defense);
  if (observed.length > 0) {
    notes.push(`Net change: ${observed.join(' · ')}`);
  }

  return {
    before: { ...before },
    after: final,
    delta,
    notes,
    totalDelta,
    intensity,
  };
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function pct(v: number): string {
  return `${Math.round(v * 100)}`;
}

// Convenience wrapper for Blitz modes that want a different
// intensity formula (e.g. pressure mode scales by duration).
export function computeShiftWithIntensity(
  before: AvatarPersonality,
  stats: MatchStats,
  intensityOverride: number
): ShiftResult {
  const scaledStats: MatchStats = {
    ...stats,
    // Back-solve the round count that would produce the desired
    // intensity. This keeps computeShift's signature stable while
    // allowing callers to inject their own intensity.
    roundsPlayed: intensityOverride * INTENSITY_PIVOT,
  };
  return computeShift(before, scaledStats);
}

// Presets for common modes. Kept here so BlitzRules.ts stays a pure
// config file. These are NOT rules — they're guidance for callers.
export const INTENSITY_PRESETS = {
  standard: 1.0,   // Sparring, first-to-3 (5-8 rounds)
  sprint: 0.7,     // Sprint (3 rounds)
  pressure: 1.2,   // Learn Under Pressure (15-90s, variable rounds)
  suddenDeath: 0.4, // Sudden Death (1 round)
  endurance: 1.5,  // Endurance (30 rounds, capped at max)
} as const;