import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Vibration,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, RotateCcw } from 'lucide-react-native';
import { getSocket, disconnectFromServer } from '../services/multiplayer';
import { ALL_MOVES, MOVE_ICONS, MOVE_NAMES, Move } from '../engine/GameEngine';

export default function OnlineGameScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { roomCode, playerId, playerName } = route.params;

  const [myMove, setMyMove] = useState<Move | null>(null);
  const [opponentMove, setOpponentMove] = useState<Move | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [round, setRound] = useState(0);
  const [winner, setWinner] = useState<'win' | 'lose' | 'tie' | null>(null);
  const [opponentName, setOpponentName] = useState('Opponent');
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      Alert.alert('Error', 'Not connected to server');
      navigation.goBack();
      return;
    }

    socket.on('playerJoined', (data: any) => {
      setWaiting(false);
      const opponent = data.players.find((p: any) => p.id !== playerId);
      if (opponent) setOpponentName(opponent.name);
    });

    socket.on('playerMoved', () => {
      setWaiting(false);
    });

    socket.on('roundResult', (data: any) => {
      setWaiting(false);
      const myMoveValue = data.moves[playerId];
      const opponentId = Object.keys(data.moves).find(id => id !== playerId);
      const opponentMoveValue = opponentId ? data.moves[opponentId] : null;

      setMyMove(myMoveValue);
      setOpponentMove(opponentMoveValue);

      const result = data.result;
      if (result === 'p1' || result === 'p2') {
        const iAmP1 = Object.keys(data.moves)[0] === playerId;
        const iWon = (result === 'p1' && iAmP1) || (result === 'p2' && !iAmP1);
        setWinner(iWon ? 'win' : 'lose');
        Vibration.vibrate(iWon ? [0, 200, 100, 200] : [0, 300]);
      } else {
        setWinner('tie');
      }

      setMyScore(data.scores[playerId] || 0);
      const opponentId2 = Object.keys(data.scores).find(id => id !== playerId);
      setOpponentScore(opponentId2 ? data.scores[opponentId2] : 0);
      setRound(data.round);

      setTimeout(() => {
        setMyMove(null);
        setOpponentMove(null);
        setWinner(null);
      }, 2000);
    });

    socket.on('gameReset', (data: any) => {
      setMyScore(data.scores[playerId] || 0);
      setOpponentScore(0);
      setRound(0);
      setMyMove(null);
      setOpponentMove(null);
      setWinner(null);
    });

    socket.on('playerLeft', () => {
      Alert.alert('Opponent Left', 'Your opponent disconnected', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    });

    return () => {
      socket.off('playerJoined');
      socket.off('playerMoved');
      socket.off('roundResult');
      socket.off('gameReset');
      socket.off('playerLeft');
    };
  }, [playerId]);

  const handleMove = (move: Move) => {
    if (myMove) return;
    const socket = getSocket();
    if (!socket) return;
    setMyMove(move);
    Vibration.vibrate(10);
    socket.emit('makeMove', { move });
  };

  const handleReset = () => {
    const socket = getSocket();
    if (socket) socket.emit('resetGame');
  };

  const handleLeave = () => {
    const socket = getSocket();
    if (socket) socket.emit('leaveRoom');
    disconnectFromServer();
    navigation.goBack();
  };

  const getResultText = () => {
    if (winner === 'win') return '🎉 You Win!';
    if (winner === 'lose') return '😢 You Lose';
    if (winner === 'tie') return '🤝 Tie!';
    return '';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLeave} style={styles.backButton}>
          <ChevronLeft size={28} color="#e94560" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Room: {roomCode}</Text>
          <Text style={styles.headerSubtitle}>
            {waiting ? 'Waiting for opponent...' : 'Connected'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
          <RotateCcw size={22} color="#5a5a7a" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.scoreContainer}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreName}>{playerName}</Text>
            <Text style={styles.scoreValue}>{myScore}</Text>
          </View>
          <View style={styles.scoreDivider}>
            <Text style={styles.scoreVs}>⚡</Text>
            <Text style={styles.scoreRound}>R{round}</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreName}>{opponentName}</Text>
            <Text style={styles.scoreValue}>{opponentScore}</Text>
          </View>
        </View>

        <View style={styles.moveDisplay}>
          <View style={styles.moveDisplayItem}>
            <Text style={styles.moveDisplayLabel}>You</Text>
            <View style={styles.moveDisplayCircle}>
              <Text style={styles.moveDisplayIcon}>
                {myMove ? MOVE_ICONS[myMove] : '❓'}
              </Text>
            </View>
          </View>
          <Text style={styles.moveDisplayDivider}>⚡</Text>
          <View style={styles.moveDisplayItem}>
            <Text style={styles.moveDisplayLabel}>{opponentName}</Text>
            <View style={styles.moveDisplayCircle}>
              <Text style={styles.moveDisplayIcon}>
                {opponentMove ? MOVE_ICONS[opponentMove] : '❓'}
              </Text>
            </View>
          </View>
        </View>

        {winner && (
          <View style={styles.resultContainer}>
            <Text style={[
              styles.resultText,
              winner === 'win' ? styles.resultWin :
                winner === 'lose' ? styles.resultLose :
                  styles.resultTie
            ]}>
              {getResultText()}
            </Text>
          </View>
        )}

        {!myMove && !winner && (
          <View style={styles.moveButtons}>
            {ALL_MOVES.map((move) => (
              <TouchableOpacity
                key={move}
                style={styles.moveButton}
                onPress={() => handleMove(move)}
                activeOpacity={0.6}
              >
                <Text style={styles.moveIcon}>{MOVE_ICONS[move]}</Text>
                <Text style={styles.moveName}>{MOVE_NAMES[move]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {myMove && !winner && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>⏳ Waiting for opponent...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  scrollContent: { paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  backButton: { padding: 8 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff' },
  headerSubtitle: { fontSize: 12, color: '#5a5a7a', marginTop: 2 },
  resetButton: { padding: 8 },
  scoreContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, margin: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  scoreItem: { alignItems: 'center', flex: 1 },
  scoreName: { fontSize: 12, color: '#5a5a7a', marginBottom: 4, textTransform: 'uppercase' },
  scoreValue: { fontSize: 36, fontWeight: '700', color: '#ffffff' },
  scoreDivider: { alignItems: 'center' },
  scoreVs: { fontSize: 20, color: '#e94560' },
  scoreRound: { fontSize: 12, color: '#5a5a7a', marginTop: 2 },
  moveDisplay: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, marginHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  moveDisplayItem: { alignItems: 'center', flex: 1 },
  moveDisplayLabel: { fontSize: 12, color: '#5a5a7a', marginBottom: 8, textTransform: 'uppercase' },
  moveDisplayCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)' },
  moveDisplayIcon: { fontSize: 40 },
  moveDisplayDivider: { fontSize: 20, color: '#5a5a7a', marginHorizontal: 8 },
  resultContainer: { alignItems: 'center', paddingVertical: 12 },
  resultText: { fontSize: 28, fontWeight: '700' },
  resultWin: { color: '#4ade80' },
  resultLose: { color: '#f87171' },
  resultTie: { color: '#fbbf24' },
  moveButtons: { flexDirection: 'row', justifyContent: 'center', padding: 16, gap: 16 },
  moveButton: { alignItems: 'center', padding: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, width: 80, borderWidth: 2, borderColor: 'transparent' },
  moveIcon: { fontSize: 36, marginBottom: 4 },
  moveName: { fontSize: 12, color: '#5a5a7a', fontWeight: '500', textTransform: 'uppercase' },
  statusContainer: { alignItems: 'center', padding: 16 },
  statusText: { fontSize: 16, color: '#5a5a7a' },
});