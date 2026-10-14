export type RPSMove = 'rock' | 'paper' | 'scissors';
export type BattleAnimation =
  | 'idle'
  | 'throw_rock'
  | 'throw_paper'
  | 'throw_scissors'
  | 'hit'
  | 'win'
  | 'lose';

export interface CharacterAnimation {
  row: number;
  startFrame: number;
  endFrame: number;
  loop: boolean;
  fps: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  sheet: any; // require() result
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  animations: Record<BattleAnimation, CharacterAnimation>;
  isPremium: boolean;
}

export const KNIGHT: CharacterDef = {
  id: 'knight',
  name: 'Knight',
  sheet: require('../../assets/characters/knight/knight.png'),
  frameWidth: 143,
  frameHeight: 121,
  columns: 24,
  rows: 7,
  isPremium: false,
  animations: {
    idle:           { row: 0, startFrame: 0, endFrame: 23, loop: true,  fps: 12 },
    throw_rock:     { row: 1, startFrame: 0, endFrame: 16, loop: false, fps: 12 },
    throw_paper:    { row: 2, startFrame: 0, endFrame: 11, loop: false, fps: 12 },
    throw_scissors: { row: 3, startFrame: 0, endFrame: 15, loop: false, fps: 12 },
    hit:            { row: 4, startFrame: 0, endFrame: 7,  loop: false, fps: 12 },
    win:            { row: 5, startFrame: 0, endFrame: 15, loop: true,  fps: 12 },
    lose:           { row: 6, startFrame: 0, endFrame: 20, loop: false, fps: 12 },
  },
};

export const CHARACTERS: CharacterDef[] = [KNIGHT];

export function getCharacter(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? KNIGHT;
}

export function animationForMove(move: RPSMove): BattleAnimation {
  switch (move) {
    case 'rock':     return 'throw_rock';
    case 'paper':    return 'throw_paper';
    case 'scissors': return 'throw_scissors';
  }
}