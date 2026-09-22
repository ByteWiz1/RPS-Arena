export interface EmojiCategory {
  id: string;
  label: string;
  emoji: string;
  minLevel: number;
  items: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'robots',
    label: 'Robots',
    emoji: '🤖',
    minLevel: 1,
    items: ['🤖', '👾', '🦾', '🧠', '⚙️', '💻', '🛸', '🔋'],
  },
  {
    id: 'animals',
    label: 'Animals',
    emoji: '🦊',
    minLevel: 1,
    items: ['🦊', '🐺', '🦁', '🐯', '🐻', '🦅', '🐉', '🦈', '🐙', '🦉'],
  },
  {
    id: 'warriors',
    label: 'Warriors',
    emoji: '⚔️',
    minLevel: 3,
    items: ['⚔️', '🛡️', '🏹', '🗡️', '🥷', '🧙', '🧝', '🦸', '👑', '⚜️'],
  },
  {
    id: 'elements',
    label: 'Elements',
    emoji: '🔥',
    minLevel: 4,
    items: ['🔥', '💧', '🌊', '⚡', '❄️', '🌪️', '🌋', '☄️', '💫', '🌙'],
  },
  {
    id: 'cosmic',
    label: 'Cosmic',
    emoji: '🌌',
    minLevel: 5,
    items: ['🌌', '⭐', '🌟', '🌠', '🌑', '🌕', '🔮', '💎', '✨', '🌞'],
  },
  {
    id: 'legends',
    label: 'Legends',
    emoji: '🐉',
    minLevel: 7,
    items: ['🐉', '🦄', '👑', '⚜️', '🎭', '🎨', '🎯', '🎪', '🏆', '🥇'],
  },
];

export const DEFAULT_EMOJIS = ['🤖', '👾', '🦊', '🐺', '🦁', '🎭'];

export function isCategoryUnlocked(minLevel: number, avatarLevel: number): boolean {
  return avatarLevel >= minLevel;
}

export function getAllUnlockedEmojis(avatarLevel: number): string[] {
  const emojis: string[] = [];
  EMOJI_CATEGORIES.forEach((cat) => {
    if (avatarLevel >= cat.minLevel) {
      emojis.push(...cat.items);
    }
  });
  return emojis;
}