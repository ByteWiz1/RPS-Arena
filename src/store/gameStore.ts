import { create } from 'zustand';
import { Move, GameMode, Result, getWinner } from '../engine/GameEngine';
import { AdaptiveAI, AIDifficulty, AIPersonality } from '../engine/AIEngine';

export interface RoundEntry {
  round: number;
  player1Move: Move;
  player2Move: Move;
  result: Result;
}

interface GameState {
  mode: GameMode;
  player1Move: Move | null;
  player2Move: Move | null;
  player1Score: number;
  player2Score: number;
  player1Ties: number;
  player2Ties: number;
  round: number;
  history: RoundEntry[];
  isPlaying: boolean;
  winner: Result | null;
  ai: AdaptiveAI | null;
  aiDifficulty: AIDifficulty;
}

interface GameActions {
  setMode: (mode: GameMode) => void;
  setAIDifficulty: (difficulty: AIDifficulty) => void;
  setAIPersonality: (personality: AIPersonality) => void;
  setPlayerMove: (player: 1 | 2, move: Move) => void;
  playRound: () => void;
  playAIMove: () => void;
  clearMoves: () => void;
  resetGame: () => void;
  getResultText: () => string;
}

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  mode: 'pvc',
  player1Move: null,
  player2Move: null,
  player1Score: 0,
  player2Score: 0,
  player1Ties: 0,
  player2Ties: 0,
  round: 0,
  history: [],
  isPlaying: false,
  winner: null,
  ai: null,
  aiDifficulty: 'medium',

  setMode: (mode) => {
    const ai = new AdaptiveAI('AI Opponent', get().aiDifficulty);
    set({
      mode,
      ai,
      player1Move: null,
      player2Move: null,
      player1Score: 0,
      player2Score: 0,
      player1Ties: 0,
      player2Ties: 0,
      round: 0,
      history: [],
      isPlaying: false,
      winner: null,
    });
  },

  setAIDifficulty: (difficulty) => {
    const ai = new AdaptiveAI('AI Opponent', difficulty);
    set({ aiDifficulty: difficulty, ai });
  },

  setAIPersonality: (personality) => {
    const { ai, aiDifficulty } = get();
    if (ai) {
      ai.setPersonality(personality);
    } else {
      const newAI = new AdaptiveAI('AI Opponent', aiDifficulty, personality);
      set({ ai: newAI });
    }
  },

  setPlayerMove: (player, move) => {
    const state = get();
    if (state.isPlaying) return;
    if (player === 1) set({ player1Move: move });
    else set({ player2Move: move });

    const newState = get();
    if (newState.player1Move && newState.player2Move) {
      set({ isPlaying: true });
      setTimeout(() => get().playRound(), 500);
    }
  },

  playAIMove: () => {
    const state = get();
    if (state.isPlaying || state.player2Move || !state.ai) return;
    const aiMove = state.ai.makeMove();
    if (state.player1Move) state.ai.recordOpponentMove(state.player1Move);
    set({ player2Move: aiMove });
    if (state.player1Move) {
      set({ isPlaying: true });
      setTimeout(() => get().playRound(), 500);
    }
  },

  playRound: () => {
    const state = get();
    const { player1Move, player2Move, ai } = state;
    if (!player1Move || !player2Move) return;

    const result = getWinner(player1Move, player2Move);
    if (ai) {
      const aiResult = result === 'win' ? 'lose' : result === 'lose' ? 'win' : 'tie';
      ai.recordResult(aiResult);
    }

    const newHistory = [
      ...state.history,
      {
        round: state.round + 1,
        player1Move,
        player2Move,
        result,
      },
    ];

    let newP1Score = state.player1Score;
    let newP2Score = state.player2Score;
    let newP1Ties = state.player1Ties;
    let newP2Ties = state.player2Ties;

    if (result === 'win') newP1Score++;
    else if (result === 'lose') newP2Score++;
    else {
      newP1Ties++;
      newP2Ties++;
    }

    set({
      round: state.round + 1,
      history: newHistory,
      winner: result,
      isPlaying: false,
      player1Score: newP1Score,
      player2Score: newP2Score,
      player1Ties: newP1Ties,
      player2Ties: newP2Ties,
    });

    setTimeout(() => get().clearMoves(), 1500);
  },

  clearMoves: () =>
    set({
      player1Move: null,
      player2Move: null,
      winner: null,
      isPlaying: false,
    }),

  resetGame: () => {
    const { aiDifficulty } = get();
    const ai = new AdaptiveAI('AI Opponent', aiDifficulty);
    set({
      player1Move: null,
      player2Move: null,
      player1Score: 0,
      player2Score: 0,
      player1Ties: 0,
      player2Ties: 0,
      round: 0,
      history: [],
      isPlaying: false,
      winner: null,
      ai,
    });
  },

  getResultText: () => {
    const state = get();
    if (!state.winner) return '';
    if (state.winner === 'win') return '🎉 You Win!';
    if (state.winner === 'lose') return '😢 You Lose';
    return '🤝 Tie!';
  },
}));