import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useGameStore } from '../store/gameStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAvatarStore } from '../store/avatarStore';
import { ALL_MOVES, MOVE_ICONS, MOVE_NAMES, Move } from '../engine/GameEngine';
import { ChevronLeft, RotateCcw } from 'lucide-react-native';
import { startGameMusic, stopMusic, playSound } from '../services/audio';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';

export default function GameScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const mode = route.params?.mode || 'pvc';
  const training = route.params?.training || false;
  const difficultyFromRoute = route.params?.difficulty;
  const { vibrationEnabled } = useSettingsStore();
  const { getSelectedAvatar, updateAvatarAfterMatch, recordMatch } = useAvatarStore();

  const {
    player1Move,
    player2Move,
    player1Score,
    player2Score,
    player1Ties,
    player2Ties,
    round,
    isPlaying,
    winner,
    setMode,
    setPlayerMove,
    playAIMove,
    resetGame,
    clearMoves,
    getResultText,
    ai,
  } = useGameStore();

  useEffect(() => {
    setMode(mode);
    resetGame();

    if (difficultyFromRoute) {
      useGameStore.getState().setAIDifficulty(difficultyFromRoute);
    }

    const avatar = getSelectedAvatar();
    if (avatar && mode === 'pvc') {
      setTimeout(() => {
        useGameStore.getState().setAIPersonality(avatar.personality);
      }, 50);
    }

    startGameMusic();
    return () => {
      stopMusic();
    };
  }, [mode, difficultyFromRoute]);

  useEffect(() => {
    if (winner) {
      if (winner === 'win') playSound('success');
      else if (winner === 'lose') playSound('fail');
      else playSound('tie');

      const avatar = getSelectedAvatar();
      if (avatar && mode === 'pvc') {
        updateAvatarAfterMatch(avatar.id, winner);
        recordMatch({
          avatarId: avatar.id,
          mode: 'pvc',
          opponentName: 'AI Opponent',
          myScore: player1Score,
          opponentScore: player2Score,
          myTies: player1Ties,
          opponentTies: player2Ties,
          result: winner,
        });
      }
    }
  }, [winner]);

  const handlePlayerMove = (player: 1 | 2, move: Move) => {
    if (isPlaying) return;
    playSound('click');
    if (vibrationEnabled) Vibration.vibrate(10);

    if (mode === 'pvp') {
      if (player === 1 && player1Move) return;
      if (player === 2 && player2Move) return;
      setPlayerMove(player, move);
      return;
    }

    if (player === 1 && !player1Move) {
      setPlayerMove(1, move);
      setTimeout(() => playAIMove(), 300);
    }
  };

  const getPlayerName = (player: 1 | 2): string => {
    if (mode === 'pvp') return player === 1 ? 'Player 1' : 'Player 2';
    return player === 1 ? 'You' : 'AI';
  };

  const renderMoveButton = (move: Move, player: 1 | 2) => {
    const isSelected = player === 1 ? player1Move === move : player2Move === move;
    const isDisabled = isPlaying || (player === 1 ? player1Move !== null : player2Move !== null);
    return (
      <TouchableOpacity
        key={`${player}-${move}`}
        style={[
          styles.moveButton,
          isSelected && styles.selectedMove,
          isDisabled && styles.disabledMove,
        ]}
        onPress={() => handlePlayerMove(player, move)}
        disabled={isDisabled}
        activeOpacity={0.6}
      >
        <Text style={styles.moveBtnIcon}>{MOVE_ICONS[move]}</Text>
        <Text style={styles.moveBtnName}>{MOVE_NAMES[move]}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <ChevronLeft size={24} color="#e94560" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {training ? '🥋 Sparring' : mode === 'pvp' ? 'Local Multiplayer' : 'Player vs AI'}
            </Text>
            {mode === 'pvc' && ai && !training && (
              <Text style={styles.headerSubtitle} numberOfLines={1}>{ai.getSummary()}</Text>
            )}
            {training && <Text style={styles.headerSubtitle}>Fighting your tuned AI</Text>}
          </View>
          <View style={styles.headerRight}>
            {mode === 'pvc' && !training && (
              <TouchableOpacity
                onPress={() => navigation.navigate('AISettings')}
                style={styles.headerBtn}
              >
                <Text style={styles.aiIconText}>🧠</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={resetGame} style={styles.headerBtn}>
              <RotateCcw size={20} color="#5a5a7a" />
            </TouchableOpacity>
          </View>
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          <View style={styles.scoreRow}>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreName} numberOfLines={1}>{getPlayerName(1)}</Text>
              <Text style={styles.scoreValue}>{player1Score}</Text>
              <Text style={styles.scoreTies}>{player1Ties} ties</Text>
            </View>
            <View style={styles.scoreCenter}>
              <Text style={styles.scoreVs}>⚡</Text>
              <Text style={styles.scoreRound}>R{round}</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreName} numberOfLines={1}>{getPlayerName(2)}</Text>
              <Text style={styles.scoreValue}>{player2Score}</Text>
              <Text style={styles.scoreTies}>{player2Ties} ties</Text>
            </View>
          </View>

          <View style={styles.moveDisplay}>
            <View style={styles.moveItem}>
              <Text style={styles.moveLabel}>{getPlayerName(1)}</Text>
              <View style={styles.moveCircle}>
                <Text style={styles.moveIcon}>{player1Move ? MOVE_ICONS[player1Move] : '❓'}</Text>
              </View>
            </View>
            <Text style={styles.moveVs}>⚡</Text>
            <View style={styles.moveItem}>
              <Text style={styles.moveLabel} numberOfLines={1}>{getPlayerName(2)}</Text>
              <View style={styles.moveCircle}>
                <Text style={styles.moveIcon}>{player2Move ? MOVE_ICONS[player2Move] : '❓'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.resultWrapper}>
            {winner && (
              <Text style={[
                styles.resultText,
                winner === 'win' ? styles.resultWin :
                  winner === 'lose' ? styles.resultLose : styles.resultTie,
              ]}>
                {getResultText()}
              </Text>
            )}
          </View>

          <View style={styles.buttonsArea}>
            {!isPlaying && !winner && (
              <>
                {mode === 'pvc' ? (
                  <View style={styles.moveButtons}>
                    {ALL_MOVES.map((move) => renderMoveButton(move, 1))}
                  </View>
                ) : (
                  <View style={styles.pvpContainer}>
                    <View style={styles.pvpSection}>
                      <Text style={styles.pvpLabel}>Player 1</Text>
                      <View style={styles.moveButtons}>
                        {ALL_MOVES.map((move) => renderMoveButton(move, 1))}
                      </View>
                    </View>
                    <View style={styles.pvpDivider} />
                    <View style={styles.pvpSection}>
                      <Text style={styles.pvpLabel}>Player 2</Text>
                      <View style={styles.moveButtons}>
                        {ALL_MOVES.map((move) => renderMoveButton(move, 2))}
                      </View>
                    </View>
                  </View>
                )}
              </>
            )}
            {isPlaying && <Text style={styles.waitingText}>⏳ Thinking...</Text>}
            {player1Move && player2Move && !isPlaying && winner && (
              <TouchableOpacity style={styles.nextButton} onPress={clearMoves}>
                <Text style={styles.nextButtonText}>Next Round →</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScreenScroll>
      </SafeAreaView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerBtn: { padding: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  aiIconText: { fontSize: 18 },
  headerCenter: { alignItems: 'center', flex: 1, paddingHorizontal: 8 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  headerSubtitle: { fontSize: 10, color: '#5a5a7a', marginTop: 1 },
  scrollContent: { paddingBottom: 40 },
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
  scoreItem: { alignItems: 'center', flex: 1 },
  scoreName: { fontSize: 11, color: '#5a5a7a', textTransform: 'uppercase', fontWeight: '600' },
  scoreValue: { fontSize: 28, fontWeight: '800', color: '#ffffff', marginTop: 2 },
  scoreTies: { fontSize: 10, color: '#5a5a7a', marginTop: 1 },
  scoreCenter: { alignItems: 'center', paddingHorizontal: 8 },
  scoreVs: { fontSize: 16, color: '#e94560' },
  scoreRound: { fontSize: 10, color: '#5a5a7a', marginTop: 2 },
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
  moveItem: { alignItems: 'center', flex: 1 },
  moveLabel: { fontSize: 10, color: '#5a5a7a', textTransform: 'uppercase', marginBottom: 6, fontWeight: '600' },
  moveCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)',
  },
  moveIcon: { fontSize: 32 },
  moveVs: { fontSize: 18, color: '#5a5a7a', marginHorizontal: 6 },
  resultWrapper: { minHeight: 44, justifyContent: 'center' },
  resultText: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  resultWin: { color: '#4ade80' },
  resultLose: { color: '#f87171' },
  resultTie: { color: '#fbbf24' },
  buttonsArea: { justifyContent: 'center', paddingHorizontal: 12, paddingBottom: 12, paddingTop: 12 },
  moveButtons: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
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
  selectedMove: { borderColor: '#e94560', backgroundColor: 'rgba(233, 69, 96, 0.1)' },
  disabledMove: { opacity: 0.3 },
  moveBtnIcon: { fontSize: 32, marginBottom: 2 },
  moveBtnName: { fontSize: 11, color: '#5a5a7a', fontWeight: '600', textTransform: 'uppercase' },
  pvpContainer: { gap: 10 },
  pvpSection: { gap: 6 },
  pvpLabel: { fontSize: 10, color: '#5a5a7a', textAlign: 'center', textTransform: 'uppercase', fontWeight: '700', letterSpacing: 1 },
  pvpDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 4 },
  waitingText: { fontSize: 14, color: '#5a5a7a', textAlign: 'center' },
  nextButton: {
    backgroundColor: '#e94560',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignSelf: 'center',
    marginTop: 8,
  },
  nextButtonText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});