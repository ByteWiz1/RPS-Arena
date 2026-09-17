import { Move, getCounterMove, getRandomMove } from './GameEngine';

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface AIStats {
  wins: number;
  losses: number;
  ties: number;
  totalGames: number;
  winRate: number;
}

export interface AIPersonality {
  aggression: number;
  memory: number;
  randomness: number;
  defense: number;
}

const DEFAULT_PERSONALITY: AIPersonality = {
  aggression: 0.5,
  memory: 0.5,
  randomness: 0.5,
  defense: 0.5,
};

const DIFFICULTY_BASE: Record<
  AIDifficulty,
  { randomChance: number; memoryDepth: number; aggression: number }
> = {
  easy: { randomChance: 0.6, memoryDepth: 0, aggression: 0.1 },
  medium: { randomChance: 0.35, memoryDepth: 3, aggression: 0.4 },
  hard: { randomChance: 0.15, memoryDepth: 8, aggression: 0.7 },
  expert: { randomChance: 0.05, memoryDepth: 30, aggression: 0.9 },
};

export class AdaptiveAI {
  private opponentHistory: Move[] = [];
  private moveFrequencies: Record<Move, number> = { rock: 0, paper: 0, scissors: 0 };
  private recentResults: ('win' | 'lose' | 'tie')[] = [];
  public stats: AIStats = { wins: 0, losses: 0, ties: 0, totalGames: 0, winRate: 0 };
  public name: string;
  public difficulty: AIDifficulty;
  public personality: AIPersonality;

  constructor(
    name: string = 'AI Opponent',
    difficulty: AIDifficulty = 'medium',
    personality?: AIPersonality
  ) {
    this.name = name;
    this.difficulty = difficulty;
    this.personality = personality || { ...DEFAULT_PERSONALITY };
  }

  setPersonality(personality: AIPersonality): void {
    this.personality = personality;
  }

  recordOpponentMove(move: Move): void {
    this.opponentHistory.push(move);
    this.moveFrequencies[move] = (this.moveFrequencies[move] || 0) + 1;
    if (this.opponentHistory.length > 50) this.opponentHistory.shift();
  }

  recordResult(result: 'win' | 'lose' | 'tie'): void {
    this.stats.totalGames++;
    if (result === 'win') this.stats.wins++;
    else if (result === 'lose') this.stats.losses++;
    else this.stats.ties++;
    this.stats.winRate =
      this.stats.totalGames > 0 ? this.stats.wins / this.stats.totalGames : 0;

    this.recentResults.push(result);
    if (this.recentResults.length > 5) this.recentResults.shift();
  }

  private getDifficultyBase() {
    return DIFFICULTY_BASE[this.difficulty] || DIFFICULTY_BASE.medium;
  }

  private combinedRandomChance(): number {
    const base = this.getDifficultyBase().randomChance;
    const personality = this.personality.randomness;
    return Math.min(0.9, base * 0.6 + personality * 0.4);
  }

  private combinedMemoryDepth(): number {
    const base = this.getDifficultyBase().memoryDepth;
    const personality = Math.floor(this.personality.memory * 30);
    return Math.max(2, Math.min(base + personality, 40));
  }

  private combinedAggression(): number {
    const base = this.getDifficultyBase().aggression;
    const personality = this.personality.aggression;
    return Math.min(1, base * 0.6 + personality * 0.4);
  }

  private isOnLosingStreak(): boolean {
    if (this.recentResults.length < 2) return false;
    return this.recentResults.slice(-2).every((r) => r === 'lose');
  }

  private isOnWinningStreak(): boolean {
    if (this.recentResults.length < 2) return false;
    return this.recentResults.slice(-2).every((r) => r === 'win');
  }

  private predictByPattern(): Move | null {
    const depth = this.combinedMemoryDepth();
    if (depth < 2) return null;

    const history = this.opponentHistory.slice(-depth);
    if (history.length < 2) return null;

    const lastTwo = history.slice(-2);
    const matches: Move[] = [];

    for (let i = 0; i < history.length - 2; i++) {
      if (history[i] === lastTwo[0] && history[i + 1] === lastTwo[1]) {
        matches.push(history[i + 2]);
      }
    }

    if (matches.length === 0) return null;

    const freq: Record<Move, number> = { rock: 0, paper: 0, scissors: 0 };
    matches.forEach((m) => freq[m]++);

    let max = 0;
    let predicted: Move = matches[0];
    for (const [m, c] of Object.entries(freq)) {
      if (c > max) {
        max = c;
        predicted = m as Move;
      }
    }
    return predicted;
  }

  private predictByFrequency(): Move | null {
    const depth = this.combinedMemoryDepth();
    if (depth < 3) return null;

    const history = this.opponentHistory.slice(-depth);
    if (history.length < 5) return null;

    const freq: Record<Move, number> = { rock: 0, paper: 0, scissors: 0 };
    history.forEach((m) => freq[m]++);

    let max = 0;
    let mostCommon: Move = 'rock';
    for (const [m, c] of Object.entries(freq)) {
      if (c > max) {
        max = c;
        mostCommon = m as Move;
      }
    }

    if (max < 3) return null;
    return mostCommon;
  }

  makeMove(): Move {
    if (Math.random() < this.combinedRandomChance()) {
      return getRandomMove();
    }

    const aggression = this.combinedAggression();

    if (this.personality.defense > 0.6 && this.isOnLosingStreak()) {
      const lastMove = this.opponentHistory[this.opponentHistory.length - 1];
      if (lastMove) return getCounterMove(lastMove);
    }

    if (aggression > 0.7 && this.isOnWinningStreak()) {
      const lastMove = this.opponentHistory[this.opponentHistory.length - 1];
      if (lastMove) return getCounterMove(lastMove);
    }

    if (Math.random() < aggression) {
      const patternPrediction = this.predictByPattern();
      if (patternPrediction) return getCounterMove(patternPrediction);
    }

    const frequencyPrediction = this.predictByFrequency();
    if (frequencyPrediction && Math.random() < this.personality.memory) {
      return getCounterMove(frequencyPrediction);
    }

    const lastMove = this.opponentHistory[this.opponentHistory.length - 1];
    if (lastMove && Math.random() < aggression) {
      return getCounterMove(lastMove);
    }

    return getRandomMove();
  }

  getSummary(): string {
    const total = this.stats.totalGames;
    if (total === 0) return `${this.difficulty.toUpperCase()} AI · ${this.name}`;
    return `${this.difficulty.toUpperCase()} · ${this.stats.wins}W/${this.stats.losses}L/${this.stats.ties}T`;
  }

  reset(): void {
    this.opponentHistory = [];
    this.moveFrequencies = { rock: 0, paper: 0, scissors: 0 };
    this.recentResults = [];
    this.stats = { wins: 0, losses: 0, ties: 0, totalGames: 0, winRate: 0 };
  }
}