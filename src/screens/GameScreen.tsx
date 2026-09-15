import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export default function GameScreen() {
  return (
      <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                    <Text style={styles.text}>Game Screen</Text>
                            <Text style={styles.subtext}>Coming soon</Text>
                                  </View>
                                      </SafeAreaView>
                                        );
                                        }

                                        const styles = StyleSheet.create({
                                          container: { flex: 1, backgroundColor: '#0a0a0f' },
                                            content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
                                              text: { fontSize: 24, color: '#ffffff', fontWeight: '700' },
                                                subtext: { fontSize: 16, color: '#5a5a7a', marginTop: 8 },
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Vibration,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useGameStore } from '../store/gameStore';
import { ALL_MOVES, MOVE_ICONS, MOVE_NAMES, Move } from '../engine/GameEngine';
import { ChevronLeft, RotateCcw } from 'lucide-react-native';
import AIDifficultySelector from '../components/AIDifficultySelector';

export default function GameScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const mode = route.params?.mode || 'pvc';
  const [showAISettings, setShowAISettings] = useState(false);

  const {
    player1Move,
    player2Move,
    player1Score,
    player2Score,
    round,
    history,
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
  }, [mode]);

  const handlePlayerMove = (player: 1 | 2, move: Move) => {
    if (isPlaying) return;

    if (mode === 'pvp') {
      if (player === 1 && player1Move) return;
      if (player === 2 && player2Move) return;
      setPlayerMove(player, move);
      Vibration.vibrate(10);
      return;
    }

    if (player === 1 && !player1Move) {
      setPlayerMove(1, move);
      Vibration.vibrate(10);
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
        <Text style={styles.moveIcon}>{MOVE_ICONS[move]}</Text>
        <Text style={styles.moveName}>{MOVE_NAMES[move]}</Text>
      </TouchableOpacity>
    );
  };

  const renderResult = () => {
    if (!winner) return null;
    const resultText = getResultText();
    const resultColor = winner === 'win' ? '#4ade80' : winner === 'lose' ? '#f87171' : '#fbbf24';

    return (
      <View style={styles.resultContainer}>
        <Text style={[styles.resultText, { color: resultColor }]}>
          {resultText}
        </Text>
        {player1Move && player2Move && (
          <View style={styles.resultMoves}>
            <Text style={styles.resultMoveText}>
              {MOVE_ICONS[player1Move]} vs {MOVE_ICONS[player2Move]}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={28} color="#e94560" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {mode === 'pvp' ? 'Player vs Player' : 'Player vs AI'}
        </Text>
        <View style={styles.headerRight}>
          {mode === 'pvc' && (
            <TouchableOpacity onPress={() => setShowAISettings(true)} style={styles.aiButton}>
              <Text style={styles.aiButtonText}>🧠</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={resetGame} style={styles.resetButton}>
            <RotateCcw size={22} color="#5a5a7a" />
          </TouchableOpacity>
        </View>
      </View>

      {mode === 'pvc' && ai && (
        <View style={styles.aiStatsContainer}>
          <Text style={styles.aiStatsText}>{ai.getSummary()}</Text>
        </View>
      )}

      <View style={styles.scoreContainer}>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreName}>{getPlayerName(1)}</Text>
          <Text style={styles.scoreValue}>{player1Score}</Text>
        </View>
        <View style={styles.scoreDivider}>
          <Text style={styles.scoreVs}>⚡</Text>
          <Text style={styles.scoreRound}>R{round}</Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreName}>{getPlayerName(2)}</Text>
          <Text style={styles.scoreValue}>{player2Score}</Text>
        </View>
      </View>

      <View style={styles.moveDisplay}>
        <View style={styles.moveDisplayItem}>
          <Text style={styles.moveDisplayLabel}>{getPlayerName(1)}</Text>
          <View style={styles.moveDisplayCircle}>
            <Text style={styles.moveDisplayIcon}>
              {player1Move ? MOVE_ICONS[player1Move] : '❓'}
            </Text>
          </View>
        </View>
        <Text style={styles.moveDisplayDivider}>⚡</Text>
        <View style={styles.moveDisplayItem}>
          <Text style={styles.moveDisplayLabel}>{getPlayerName(2)}</Text>
          <View style={styles.moveDisplayCircle}>
            <Text style={styles.moveDisplayIcon}>
              {player2Move ? MOVE_ICONS[player2Move] : '❓'}
            </Text>
          </View>
        </View>
      </View>

      {renderResult()}

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

      {isPlaying && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>⏳ Thinking...</Text>
        </View>
      )}

      {player1Move && player2Move && !isPlaying && winner && (
        <TouchableOpacity style={styles.clearButton} onPress={clearMoves}>
          <Text style={styles.clearButtonText}>Next Round →</Text>
        </TouchableOpacity>
      )}

      {history.length > 0 && (
        <View style={styles.historyContainer}>
          <Text style={styles.historyText}>Last {Math.min(history.length, 5)} rounds:</Text>
          <View style={styles.historyDots}>
            {history.slice(-5).map((entry, i) => (
              <View key={i} style={[
                styles.historyDot,
                {
                  backgroundColor:
                    entry.result === 'win' ? '#4ade80' :
                      entry.result === 'lose' ? '#f87171' :
                        '#fbbf24'
                }
              ]} />
            ))}
          </View>
        </View>
      )}

      <AIDifficultySelector
        visible={showAISettings}
        onClose={() => setShowAISettings(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff' },
  resetButton: { padding: 8 },
  aiButton: { padding: 8 },
  aiButtonText: { fontSize: 20 },
  aiStatsContainer: { paddingHorizontal: 16, paddingVertical: 6, alignItems: 'center' },
  aiStatsText: { fontSize: 12, color: '#5a5a7a' },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  scoreItem: { alignItems: 'center', flex: 1 },
  scoreName: { fontSize: 12, color: '#5a5a7a', marginBottom: 4, textTransform: 'uppercase' },
  scoreValue: { fontSize: 36, fontWeight: '700', color: '#ffffff' },
  scoreDivider: { alignItems: 'center' },
  scoreVs: { fontSize: 20, color: '#e94560' },
  scoreRound: { fontSize: 12, color: '#5a5a7a', marginTop: 2 },
  moveDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  moveDisplayItem: { alignItems: 'center', flex: 1 },
  moveDisplayLabel: { fontSize: 12, color: '#5a5a7a', marginBottom: 8, textTransform: 'uppercase' },
  moveDisplayCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  moveDisplayIcon: { fontSize: 40 },
  moveDisplayDivider: { fontSize: 20, color: '#5a5a7a', marginHorizontal: 8 },
  resultContainer: { alignItems: 'center', paddingVertical: 12 },
  resultText: { fontSize: 28, fontWeight: '700' },
  resultMoves: { marginTop: 4 }
