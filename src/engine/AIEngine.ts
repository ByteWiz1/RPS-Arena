import { Move, getCounterMove, getRandomMove } from './GameEngine';

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface AIStats {
  wins: number;
  losses: number;
  ties: number;
  totalGames: number;
  winRate: number;
}

export class AdaptiveAI {
  private opponentHistory: Move[] = [];
  private moveFrequencies: Record<Move, number> = { rock: 0, paper: 0, scissors: 0 };
  public stats: AIStats = { wins: 0, losses: 0, ties: 0, totalGames: 0, winRate: 0 };
  public name: string;
  public difficulty: AIDifficulty;

  constructor(name: string = 'AI Opponent', difficulty: AIDifficulty = 'medium') {
    this.name = name;
    this.difficulty = difficulty;
  }

  recordOpponentMove(move: Move): void {
    this.opponentHistory.push(move);
    this.moveFrequencies[move] = (this.moveFrequencies[move] || 0) + 1;
    if (this.opponentHistory.length > 30) this.opponentHistory.shift();
  }

  recordResult(result: 'win' | 'lose' | 'tie'): void {
    this.stats.totalGames++;
    if (result === 'win') this.stats.wins++;
    else if (result === 'lose') this.stats.losses++;
    else this.stats.ties++;
    this.stats.winRate = this.stats.totalGames > 0 ? this.stats.wins / this.stats.totalGames : 0;
  }

  private getRandomChance(): number {
    const factors: Record<AIDifficulty, number> = {
      easy: 0.6,
      medium: 0.35,
      hard: 0.15,
      expert: 0.05,
    };
    return factors[this.difficulty] || 0.3;
  }

  makeMove(): Move {
    if (Math.random() < this.getRandomChance()) return getRandomMove();

    let predicted: Move | null = null;
    const history = this.opponentHistory;

    if (history.length >= 2) {
      const lastTwo = history.slice(-2);
      for (let i = 0; i < history.length - 2; i++) {
        if (history[i] === lastTwo[0] && history[i + 1] === lastTwo[1]) {
          predicted = history[i + 2];
          break;
        }
      }
    }

    if (predicted) return getCounterMove(predicted);

    let maxCount = 0;
    let mostCommon: Move = 'rock';
    for (const [move, count] of Object.entries(this.moveFrequencies)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = move as Move;
      }
    }

    if (history.length > 5 && maxCount > 2) return getCounterMove(mostCommon);

    return getRandomMove();
  }

  getSummary(): string {
    const total = this.stats.totalGames;
    if (total === 0) return 'No games played yet';
    return `${this.name} (${this.difficulty}): ${this.stats.wins}W/${this.stats.losses}L/${this.stats.ties}T`;
  }

  reset(): void {
    this.opponentHistory = [];
    this.moveFrequencies = { rock: 0, paper: 0, scissors: 0 };
    this.stats = { wins: 0, losses: 0, ties: 0, totalGames: 0, winRate: 0 };
  }
}