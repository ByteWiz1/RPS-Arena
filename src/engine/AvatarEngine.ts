import { AdaptiveAI, AIDifficulty } from './AIEngine';

export interface AvatarPersonality {
  aggression: number;
  memory: number;
  randomness: number;
  defense: number;
}

export interface Avatar {
  id: string;
  name: string;
  emoji: string;
  ai: AdaptiveAI;
  xp: number;
  level: number;
  wins: number;
  losses: number;
  ties: number;
  rating: number;
  winStreak: number;
  bestStreak: number;
  skin: string;
  unlockedSkins: string[];
  personality: AvatarPersonality;
  titles: string[];
  defeatedMasters: string[];
  createdAt: Date;
}

export const LEVELS = [0, 100, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000];

export const DEFAULT_PERSONALITY: AvatarPersonality = {
  aggression: 0.5,
  memory: 0.5,
  randomness: 0.5,
  defense: 0.5,
};

export const PERSONALITY_PRESETS: Record<string, AvatarPersonality> = {
  balanced: { aggression: 0.5, memory: 0.5, randomness: 0.5, defense: 0.5 },
  aggressive: { aggression: 0.9, memory: 0.6, randomness: 0.3, defense: 0.4 },
  defensive: { aggression: 0.3, memory: 0.7, randomness: 0.3, defense: 0.9 },
  tricky: { aggression: 0.5, memory: 0.4, randomness: 0.9, defense: 0.5 },
  chaos: { aggression: 0.8, memory: 0.3, randomness: 1.0, defense: 0.3 },
  mastermind: { aggression: 0.7, memory: 0.9, randomness: 0.2, defense: 0.8 },
};

export function calculateLevel(xp: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i]) return i + 1;
  }
  return 1;
}

export function getXPForNextLevel(level: number): number {
  return LEVELS[level] || 50000;
}

export function getRatingTier(rating: number): {
  name: string;
  emoji: string;
  color: string;
} {
  if (rating >= 2000) return { name: 'Legend', emoji: '👑', color: '#fbbf24' };
  if (rating >= 1700) return { name: 'Diamond', emoji: '💠', color: '#22d3ee' };
  if (rating >= 1400) return { name: 'Platinum', emoji: '💎', color: '#a78bfa' };
  if (rating >= 1200) return { name: 'Gold', emoji: '🥇', color: '#fbbf24' };
  if (rating >= 1000) return { name: 'Silver', emoji: '🥈', color: '#c0c0c0' };
  return { name: 'Bronze', emoji: '🥉', color: '#cd7f32' };
}

export function getPersonalityDescription(p: AvatarPersonality): string {
  const parts: string[] = [];

  if (p.aggression > 0.7) parts.push('plays aggressively');
  else if (p.aggression < 0.3) parts.push('plays cautiously');
  else parts.push('plays balanced');

  if (p.memory > 0.7) parts.push('remembers many of your moves');
  else if (p.memory < 0.3) parts.push('barely tracks your patterns');
  else parts.push('tracks recent patterns');

  if (p.randomness > 0.7) parts.push('is wildly unpredictable');
  else if (p.randomness < 0.3) parts.push('sticks to a strict strategy');
  else parts.push('mixes in some surprises');

  if (p.defense > 0.7) parts.push('protects streaks fiercely');
  else if (p.defense < 0.3) parts.push('takes risks freely');

  return 'Your AI ' + parts.join(', ') + '.';
}

export function createAvatar(name: string, difficulty: AIDifficulty = 'medium'): Avatar {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    name: name || 'My Avatar',
    emoji: '🤖',
    ai: new AdaptiveAI(name || 'My Avatar', difficulty),
    xp: 0,
    level: 1,
    wins: 0,
    losses: 0,
    ties: 0,
    rating: 1000,
    winStreak: 0,
    bestStreak: 0,
    skin: 'default',
    unlockedSkins: ['default'],
    personality: { ...DEFAULT_PERSONALITY },
    titles: [],
    defeatedMasters: [],
    createdAt: new Date(),
  };
}

export function updateAvatarStats(avatar: Avatar, result: 'win' | 'lose' | 'tie'): Avatar {
  const updated = { ...avatar };

  if (result === 'win') {
    updated.wins++;
    updated.xp += 20;
    updated.rating += 10;
    updated.winStreak++;
    if (updated.winStreak > updated.bestStreak) {
      updated.bestStreak = updated.winStreak;
    }
  } else if (result === 'lose') {
    updated.losses++;
    updated.xp += 5;
    updated.rating = Math.max(0, updated.rating - 10);
    updated.winStreak = 0;
  } else {
    updated.ties++;
    updated.xp += 10;
  }

  updated.level = calculateLevel(updated.xp);
  updated.titles = checkTitles(updated);

  return updated;
}

export function checkTitles(avatar: Avatar): string[] {
  const titles = [...avatar.titles];

  const addTitle = (title: string) => {
    if (!titles.includes(title)) titles.push(title);
  };

  if (avatar.wins >= 1) addTitle('First Win');
  if (avatar.wins >= 10) addTitle('Rising Star');
  if (avatar.wins >= 50) addTitle('Champion');
  if (avatar.wins >= 100) addTitle('Dominator');
  if (avatar.bestStreak >= 5) addTitle('Streak Master');
  if (avatar.bestStreak >= 10) addTitle('Unstoppable');
  if (avatar.defeatedMasters.length >= 4) addTitle('Dojo Master');

  return titles;
}