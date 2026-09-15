import { AdaptiveAI, AIDifficulty } from './AIEngine';

export interface Avatar {
  id: string;
  name: string;
  ai: AdaptiveAI;
  xp: number;
  level: number;
  wins: number;
  losses: number;
  ties: number;
  rating: number;
  skin: string;
  unlockedSkins: string[];
  createdAt: Date;
}

export function calculateLevel(xp: number): number {
  const levels = [0, 100, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  for (let i = levels.length - 1; i >= 0; i--) {
    if (xp >= levels[i]) return i + 1;
  }
  return 1;
}

export function createAvatar(name: string, difficulty: AIDifficulty = 'medium'): Avatar {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    name: name || 'My Avatar',
    ai: new AdaptiveAI(name || 'My Avatar', difficulty),
    xp: 0,
    level: 1,
    wins: 0,
    losses: 0,
    ties: 0,
    rating: 1000,
    skin: 'default',
    unlockedSkins: ['default'],
    createdAt: new Date(),
  };
}

export function updateAvatarStats(avatar: Avatar, result: 'win' | 'lose' | 'tie'): Avatar {
  const updated = { ...avatar };

  if (result === 'win') {
    updated.wins++;
    updated.xp += 20;
    updated.rating += 10;
  } else if (result === 'lose') {
    updated.losses++;
    updated.xp += 5;
    updated.rating = Math.max(0, updated.rating - 10);
  } else {
    updated.ties++;
    updated.xp += 10;
  }

  updated.level = calculateLevel(updated.xp);
  return updated;
}