import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, RotateCcw } from 'lucide-react-native';
import { useAvatarStore } from '../store/avatarStore';
import { useSettingsStore } from '../store/settingsStore';
import { ALL_MOVES, MOVE_ICONS, MOVE_NAMES, Move, getWinner } from '../engine/GameEngine';
import { AdaptiveAI, AIDifficulty } from '../engine/AIEngine';
import { startGameMusic, stopMusic, playSound } from '../services/audio';

interface Master {
  id: string;
  name: string;
  emoji: string;
  rating: number;
  tagline: string;
  rewardXP: number;
  rewardRating: number;
  difficulty: AIDifficulty;
  color: string;
}

const MASTERS: Record<string, Master> = {
  rookie: { id: 'rookie', name: 'Rookie', emoji: '😊', rating: 400, tagline: 'Everyone starts somewhere.', rewardXP: 10, rewardRating: 5, difficulty: 'easy', color: '#4ade80' },
  tactician: { id: 'tactician', name: 'Tactician', emoji: '🤔', rating: 800, tagline: 'I see your patterns.', rewardXP: 25, rewardRating: 10, difficulty: 'medium', color: '#4facfe' },
  hunter: { id: 'hunter', name: 'Hunter', emoji: '😤', rating: 1400, tagline: 'I know what you will do.', rewardXP: 50, rewardRating: 20, difficulty: 'hard', color: '#e94560' },
  grandmaster: { id: 'grandmaster', name: 'Grandmaster', emoji: '🧠', rating: 2000, tagline: 'Defeat Hunter to face me.', rewardXP: 100, rewardRating: 50, difficulty: 'expert', color: '#a78bfa' },
};

const ROUNDS_TO_WIN = 5;

export default function DojoMatchScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const masterId = route.params?.masterId || 'rookie';
  const master = MASTERS[masterId];
  const { vibrationEnabled } = useSettingsStore();
  const { getSelectedAvatar, addDefeatedMaster, addXPReward, recordMatch, updateAvatarAfterMatch } = useAvatarStore();
  const avatar = getSelectedAvatar();

  const [ai] = useState(() => new AdaptiveAI(master.name, master.difficulty));
  const [myMove, setMyMove] = useState<Move | null>(null);
  const [aiMove, setAiMove] = useState<Move | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [myTies, setMyTies] = useState(0);
  const [aiTies, setAiTies] = useState(0);
  const [round, setRound] = useState(0);
  const [winner, setWinner] = useState<'win' | 'lose' | 'tie' | null>(null);
  const [matchOver, setMatchOver] = useState(false);
  const [matchWinner, setMatchWinner] = useState<'player' | 'ai' | null>(null);

  useEffect(() => {
    startGameMusic();
    return () => {
      stopMusic();
    };
  }, []);

  useEffect(() => {
    if (winner) {
      if (winner === 'win') playSound('success');
      else if (winner === 'lose') playSound('fail');
      else playSound('tie');
    }
  }, [winner]);

 useEffect(() => {
  if (myScore >= ROUNDS_TO_WIN && !matchOver) {
    setMatchOver(true);
    setMatchWinner('player');
    playSound('success');
    handleVictory();
  } else if (aiScore >= ROUNDS_TO_WIN && !matchOver) {
    setMatchOver(true);
    setMatchWinner('ai');
    playSound('fail');

    if (avatar) {
      updateAvatarAfterMatch(avatar.id, 'lose');
      recordMatch({
        avatarId: avatar.id,
        mode: 'dojo',
        opponentName: master.name,
        myScore: myScore,
        opponentScore: aiScore,
        myTies: myTies,
        opponentTies: aiTies,
        result: 'lose',
      });
    }
  }
}, [myScore, aiScore]);

 const handleVictory = () => {
  if (!avatar) return;

  const isFirstWin = !avatar.defeatedMasters.includes(master.id);

  if (isFirstWin) {
    addDefeatedMaster(avatar.id, master.id);
    addXPReward(avatar.id, master.rewardXP, master.rewardRating);
  } else {
    addXPReward(avatar.id, Math.floor(master.rewardXP / 2), 0);
  }

  updateAvatarAfterMatch(avatar.id, 'win');
  recordMatch({
    avatarId: avatar.id,
    mode: 'dojo',
    opponentName: master.name,
    myScore: myScore,
    opponentScore: aiScore,
    myTies: myTies,
    opponentTies: aiTies,
    result: 'win',
  });
};

  const handleMove = (move: Move) => {
    if (myMove || matchOver) return;

    playSound('click');
    if (vibrationEnabled) Vibration.vibrate(10);

    setMyMove(move);
    ai.recordOpponentMove(move);

    setTimeout(() => {
      const aiChoice = ai.makeMove();
      setAiMove(aiChoice);

      setTimeout(() => {
        const result = getWinner(move, aiChoice);
        setWinner(result);

        if (result === 'win') {
          setMyScore((s) => s + 1);
          ai.recordResult('lose');
        } else if (result === 'lose') {
          setAiScore((s) => s + 1);
          ai.recordResult('win');
        } else {
          setMyTies((s) => s + 1);
          setAiTies((s) => s + 1);
          ai.recordResult('tie');
        }

        setRound((r) => r + 1);

        setTimeout(() => {
          setMyMove(null);
          setAiMove(null);
          setWinner(null);
        }, 1500);
      }, 400);
    }, 400);
  };

  const handleRematch = () => {
    setMyMove(null);
    setAiMove(null);
    setMyScore(0);
    setAiScore(0);
    setMyTies(0);
    setAiTies(0);
    setRound(0);
    setWinner(null);
    setMatchOver(false);
    setMatchWinner(null);
    ai.reset();
  };

  if (!avatar) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
              <ChevronLeft size={24} color="#e94560" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Dojo Match</Text>
            <View style={styles.headerBtn} />
          </View>
          <View style={styles.center}>
            <Text style={styles.emptyText}>Create an avatar first</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <ChevronLeft size={24} color="#e94560" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {master.emoji} {master.name}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              First to {ROUNDS_TO_WIN}
            </Text>
          </View>
          <TouchableOpacity onPress={handleRematch} style={styles.headerBtn}>
            <RotateCcw size={20} color="#5a5a7a" />
          </TouchableOpacity>
        </View>

        {/* Score */}
        <View style={styles.scoreRow}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreName} numberOfLines={1}>{avatar.name}</Text>
            <Text style={styles.scoreValue}>{myScore}</Text>
            <Text style={styles.scoreTies}>{myTies} ties</Text>
          </View>
          <View style={styles.scoreCenter}>
            <Text style={styles.scoreVs}>⚡</Text>
            <Text style={styles.scoreRound}>R{round}</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreName} numberOfLines={1}>{master.name}</Text>
            <Text style={styles.scoreValue}>{aiScore}</Text>
            <Text style={styles.scoreTies}>{aiTies} ties</Text>
          </View>
        </View>

        {/* Move Display */}
        <View style={styles.moveDisplay}>
          <View style={styles.moveItem}>
            <Text style={styles.moveLabel}>You</Text>
            <View style={styles.moveCircle}>
              <Text style={styles.moveIcon}>
                {myMove ? MOVE_ICONS[myMove] : '❓'}
              </Text>
            </View>
          </View>
          <Text style={styles.moveVs}>⚡</Text>
          <View style={styles.moveItem}>
            <Text style={styles.moveLabel} numberOfLines={1}>{master.name}</Text>
            <View style={styles.moveCircle}>
              <Text style={styles.moveIcon}>
                {aiMove ? MOVE_ICONS[aiMove] : '❓'}
              </Text>
            </View>
          </View>
        </View>

        {/* Result / Match Over */}
        <View style={styles.resultWrapper}>
          {winner && !matchOver && (
            <Text
              style={[
                styles.resultText,
                winner === 'win' ? styles.resultWin :
                  winner === 'lose' ? styles.resultLose :
                    styles.resultTie,
              ]}
            >
              {winner === 'win' ? '🎉 Round Won!' : winner === 'lose' ? '😢 Round Lost' : '🤝 Tie!'}
            </Text>
          )}
        </View>

        {/* Match Over Screen */}
        {matchOver ? (
          <View style={styles.matchOverArea}>
            <Text style={styles.matchOverEmoji}>
              {matchWinner === 'player' ? '🏆' : '💀'}
            </Text>
            <Text
              style={[
                styles.matchOverTitle,
                matchWinner === 'player' ? styles.matchOverWin : styles.matchOverLose,
              ]}
            >
              {matchWinner === 'player' ? 'Victory!' : 'Defeat'}
            </Text>
            {matchWinner === 'player' && (
              <Text style={styles.matchOverReward}>
                +{master.rewardXP} XP  •  +{master.rewardRating} Rating
              </Text>
            )}
            <View style={styles.matchOverButtons}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleRematch}>
                <Text style={styles.primaryBtnText}>Rematch</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.secondaryBtnText}>Back to Dojo</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.buttonsArea}>
            {!myMove && !winner && (
              <View style={styles.moveButtons}>
                {ALL_MOVES.map((move) => (
                  <TouchableOpacity
                    key={move}
                    style={styles.moveButton}
                    onPress={() => handleMove(move)}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.moveBtnIcon}>{MOVE_ICONS[move]}</Text>
                    <Text style={styles.moveBtnName}>{MOVE_NAMES[move]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {myMove && !winner && (
              <Text style={styles.waitingText}>⏳ {master.name} is thinking...</Text>
            )}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    ...(Platform.OS === 'web' ? { height: '100vh' as any } : {}),
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerBtn: {
    padding: 6,
    width: 32,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#5a5a7a',
    marginTop: 1,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  scoreItem: {
    alignItems: 'center',
    flex: 1,
  },
  scoreName: {
    fontSize: 11,
    color: '#5a5a7a',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 2,
  },
  scoreTies: {
    fontSize: 10,
    color: '#5a5a7a',
    marginTop: 1,
  },
  scoreCenter: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  scoreVs: {
    fontSize: 16,
    color: '#e94560',
  },
  scoreRound: {
    fontSize: 10,
    color: '#5a5a7a',
    marginTop: 2,
  },
  moveDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  moveItem: {
    alignItems: 'center',
    flex: 1,
  },
  moveLabel: {
    fontSize: 10,
    color: '#5a5a7a',
    textTransform: 'uppercase',
    marginBottom: 6,
    fontWeight: '600',
  },
  moveCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  moveIcon: {
    fontSize: 32,
  },
  moveVs: {
    fontSize: 18,
    color: '#5a5a7a',
    marginHorizontal: 6,
  },
  resultWrapper: {
    minHeight: 44,
    justifyContent: 'center',
  },
  resultText: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  resultWin: { color: '#4ade80' },
  resultLose: { color: '#f87171' },
  resultTie: { color: '#fbbf24' },
  buttonsArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  moveButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  moveButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    width: 80,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  moveBtnIcon: {
    fontSize: 32,
    marginBottom: 2,
  },
  moveBtnName: {
    fontSize: 11,
    color: '#5a5a7a',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  waitingText: {
    fontSize: 14,
    color: '#5a5a7a',
    textAlign: 'center',
  },
  matchOverArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  matchOverEmoji: {
    fontSize: 56,
  },
  matchOverTitle: {
    fontSize: 30,
    fontWeight: '800',
  },
  matchOverWin: { color: '#4ade80' },
  matchOverLose: { color: '#f87171' },
  matchOverReward: {
    fontSize: 13,
    color: '#fbbf24',
    fontWeight: '700',
    marginTop: 4,
  },
  matchOverButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  primaryBtn: {
    backgroundColor: '#e94560',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  secondaryBtnText: {
    color: '#8a8a9a',
    fontSize: 14,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#5a5a7a',
  },
});