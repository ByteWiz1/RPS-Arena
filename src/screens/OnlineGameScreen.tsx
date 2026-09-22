import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, LogOut } from 'lucide-react-native';
import { getSocket, disconnectFromServer } from '../services/multiplayer';
import { useSettingsStore } from '../store/settingsStore';
import { useAvatarStore } from '../store/avatarStore';
import { useBattleStore } from '../store/battleStore';
import { ALL_MOVES, MOVE_ICONS, MOVE_NAMES, Move } from '../engine/GameEngine';
import {
  startGameMusic,
  stopMusic,
  playSound,
  playCelebrationSequence,
  stopCelebration,
} from '../services/audio';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import ChatBubble from '../components/ChatBubble';
import { showAlert } from '../utils/alert';

interface ChatMessage {
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

interface FloatingEmoji {
  id: string;
  emoji: string;
  playerName: string;
  anim: Animated.Value;
  x: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const WIN_TARGET = 30;

export default function OnlineGameScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // Route params — everything EXCEPT battleMode
  const params = route.params || {};
  const roomCode = params.roomCode || '';
  const playerId = params.playerId || '';
  const playerName = params.playerName || 'Player';
  const initialOpponent = params.opponentName || 'Opponent';

  // battleMode comes from the global store
  const battleMode = useBattleStore((s) => s.mode);
  const isAvatarMode = battleMode === 'avatar';

  console.log('[GAME] battleMode from store:', battleMode, 'isAvatar:', isAvatarMode);
  console.log('[GAME] route params:', { roomCode, playerId, playerName, initialOpponent });

  const { vibrationEnabled } = useSettingsStore();
  const { getSelectedAvatar, updateAvatarAfterMatch, recordMatch } = useAvatarStore();

  const [myMove, setMyMove] = useState<Move | null>(null);
  const [opponentMove, setOpponentMove] = useState<Move | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [myTies, setMyTies] = useState(0);
  const [opponentTies, setOpponentTies] = useState(0);
  const [round, setRound] = useState(0);
  const [winner, setWinner] = useState<'win' | 'lose' | 'tie' | null>(null);
  const [opponentName, setOpponentName] = useState(initialOpponent || 'Opponent');
  const [waiting, setWaiting] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [disconnected, setDisconnected] = useState(false);
  const [disconnectCountdown, setDisconnectCountdown] = useState(0);
  const [matchOver, setMatchOver] = useState(false);
  const [iWonMatch, setIWonMatch] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const EMOJI_LIST = ['👍', '😂', '🔥', '😎', '🤝', '😤', '💀', '🎉'];

  useEffect(() => {
    startGameMusic();
    return () => {
      stopMusic();
      stopCelebration();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    if (winner) {
      if (winner === 'win') playSound('success');
      else if (winner === 'lose') playSound('fail');
      else playSound('tie');
    }
  }, [winner]);

  const spawnFloatingEmoji = (emoji: string, senderName: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    const anim = new Animated.Value(0);
    const startX = Math.random() * (SCREEN_WIDTH - 120) + 20;

    setFloatingEmojis((prev) => [
      ...prev,
      { id, emoji, playerName: senderName, anim, x: startX },
    ]);

    Animated.timing(anim, {
      toValue: 1,
      duration: 2200,
      useNativeDriver: true,
    }).start(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== id));
    });
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      showAlert('Error', 'Not connected to server');
      navigation.goBack();
      return;
    }

    socket.on('playerJoined', (data: any) => {
      setWaiting(false);
      const opponent = data.players.find((p: any) => p.id !== playerId);
      if (opponent) setOpponentName(opponent.name);
    });

    socket.on('roomState', (data: any) => {
      setWaiting(false);
      const opponent = data.players.find((p: any) => p.id !== playerId);
      if (opponent) setOpponentName(opponent.name);
      if (data.scores) {
        setMyScore(data.scores[playerId] || 0);
        const opponentId = Object.keys(data.scores).find((id) => id !== playerId);
        setOpponentScore(opponentId ? data.scores[opponentId] : 0);
      }
      if (data.ties) {
        setMyTies(data.ties[playerId] || 0);
        const opponentId2 = Object.keys(data.ties).find((id) => id !== playerId);
        setOpponentTies(opponentId2 ? data.ties[opponentId2] : 0);
      }
      if (typeof data.round === 'number') setRound(data.round);
    });

    socket.on('playerMoved', () => setWaiting(false));

    socket.on('newMessage', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      const emojiRegex = /^\p{Emoji}+$/u;
      if (emojiRegex.test(msg.text.trim())) {
        spawnFloatingEmoji(msg.text.trim(), msg.playerName);
      }
    });

    socket.on('roundResult', (data: any) => {
      setWaiting(false);
      const myMoveValue = data.moves[playerId];
      const opponentId = Object.keys(data.moves).find((id) => id !== playerId);
      const opponentMoveValue = opponentId ? data.moves[opponentId] : null;

      setMyMove(myMoveValue);
      setOpponentMove(opponentMoveValue);

      const result = data.result;
      if (result === 'p1' || result === 'p2') {
        const iAmP1 = Object.keys(data.moves)[0] === playerId;
        const iWon = (result === 'p1' && iAmP1) || (result === 'p2' && !iAmP1);
        setWinner(iWon ? 'win' : 'lose');
        if (vibrationEnabled && !isAvatarMode) {
          Vibration.vibrate(iWon ? [0, 200, 100, 200] : [0, 300]);
        }
      } else {
        setWinner('tie');
      }

      setMyScore(data.scores[playerId] || 0);
      const opponentId2 = Object.keys(data.scores).find((id) => id !== playerId);
      setOpponentScore(opponentId2 ? data.scores[opponentId2] : 0);
      setMyTies(data.ties?.[playerId] || 0);
      setOpponentTies(opponentId2 ? data.ties?.[opponentId2] || 0 : 0);
      setRound(data.round);

      if (data.matchOver && data.matchWinner) {
        setTimeout(() => triggerMatchEnd(data.matchWinner === playerId), 1200);
      } else {
        setTimeout(() => {
          setMyMove(null);
          setOpponentMove(null);
          setWinner(null);
        }, isAvatarMode ? 1200 : 2000);
      }
    });

    socket.on('gameReset', (data: any) => {
      setMyScore(data.scores[playerId] || 0);
      setOpponentScore(0);
      setMyTies(0);
      setOpponentTies(0);
      setRound(0);
      setMyMove(null);
      setOpponentMove(null);
      setWinner(null);
      setMatchOver(false);
      setIWonMatch(false);
      stopCelebration();
    });

    socket.on('opponentDisconnected', (data: any) => {
      setDisconnected(true);
      setDisconnectCountdown(Math.round(data.timeout / 1000));
      if (countdownRef.current) clearInterval(countdownRef.current);
      let remaining = Math.round(data.timeout / 1000);
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setDisconnectCountdown(0);
        } else {
          setDisconnectCountdown(remaining);
        }
      }, 1000);
    });

    socket.on('opponentTimedOut', (data: any) => {
      setDisconnected(false);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (data.winnerId === playerId) triggerMatchEnd(true);
    });

    socket.on('playerLeft', () => {
      showAlert('Opponent Left', 'Your opponent left the room', [
        { text: 'OK', onPress: () => handleLeave() },
      ]);
    });

    return () => {
      socket.off('playerJoined');
      socket.off('roomState');
      socket.off('playerMoved');
      socket.off('newMessage');
      socket.off('roundResult');
      socket.off('gameReset');
      socket.off('opponentDisconnected');
      socket.off('opponentTimedOut');
      socket.off('playerLeft');
    };
  }, [playerId, isAvatarMode]);

  const triggerMatchEnd = async (iWon: boolean) => {
    setMatchOver(true);
    setIWonMatch(iWon);
    stopMusic();

    const avatar = getSelectedAvatar();
    if (avatar) {
      const result: 'win' | 'lose' = iWon ? 'win' : 'lose';
      updateAvatarAfterMatch(avatar.id, result);
      recordMatch({
        avatarId: avatar.id,
        mode: 'online',
        opponentName,
        myScore,
        opponentScore,
        myTies,
        opponentTies,
        result,
      });
    }
    await playCelebrationSequence(iWon);
  };

  const handleMove = (move: Move) => {
    if (isAvatarMode) return;
    if (myMove || matchOver) return;
    const socket = getSocket();
    if (!socket) return;
    setMyMove(move);
    playSound('click');
    if (vibrationEnabled) Vibration.vibrate(10);
    socket.emit('makeMove', { move });
  };

  const handleSendMessage = (text: string) => {
    const socket = getSocket();
    if (!socket) return;
    const emojiRegex = /^\p{Emoji}+$/u;
    if (emojiRegex.test(text.trim())) {
      spawnFloatingEmoji(text.trim(), playerName);
    }
    socket.emit('sendMessage', { text: text.trim() });
  };

  const handleEmoji = (emoji: string) => {
    const socket = getSocket();
    if (!socket) return;
    spawnFloatingEmoji(emoji, playerName);
    socket.emit('sendMessage', { text: emoji });
  };

  const handlePlayAgain = () => {
    stopCelebration();
    const socket = getSocket();
    if (socket) socket.emit('playAgain');
    setMatchOver(false);
    setIWonMatch(false);
    startGameMusic();
  };

  const handleLeave = () => {
    stopCelebration();
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
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.floatingLayer} pointerEvents="none">
          {floatingEmojis.map((item) => {
            const translateY = item.anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -SCREEN_HEIGHT * 0.5],
            });
            const opacity = item.anim.interpolate({
              inputRange: [0, 0.7, 1],
              outputRange: [1, 0.8, 0],
            });
            const scale = item.anim.interpolate({
              inputRange: [0, 0.3, 1],
              outputRange: [0.5, 1.3, 1],
            });
            return (
              <Animated.View
                key={item.id}
                style={[
                  styles.floatingEmoji,
                  { left: item.x, transform: [{ translateY }, { scale }], opacity },
                ]}
              >
                <Text style={styles.floatingEmojiText}>{item.emoji}</Text>
                <Text style={styles.floatingEmojiName} numberOfLines={1}>
                  {item.playerName}
                </Text>
              </Animated.View>
            );
          })}
        </View>

        <View style={styles.header}>
          <TouchableOpacity onPress={handleLeave} style={styles.headerBtn}>
            <ChevronLeft size={22} color="#e94560" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Room {roomCode}</Text>
            <Text style={styles.headerSubtitle}>
              {isAvatarMode ? '🤖 Avatar Arena' : `First to ${WIN_TARGET} wins`}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLeave} style={styles.headerBtn}>
            <LogOut size={18} color="#8a8a9a" />
          </TouchableOpacity>
        </View>

        {disconnected && (
          <View style={styles.disconnectBanner}>
            <Text style={styles.disconnectText}>
              ⚠️ Opponent disconnected · {disconnectCountdown}s
            </Text>
          </View>
        )}

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          <View style={styles.scoreRow}>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreName} numberOfLines={1}>{playerName}</Text>
              <Text style={[styles.scoreValue, myScore >= WIN_TARGET - 5 && styles.scoreNearWin]}>
                {myScore}
              </Text>
              <Text style={styles.scoreTies}>{myTies} ties</Text>
            </View>
            <View style={styles.scoreCenter}>
              <Text style={styles.scoreVs}>⚡</Text>
              <Text style={styles.scoreRound}>R{round}</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreName} numberOfLines={1}>{opponentName}</Text>
              <Text style={[styles.scoreValue, opponentScore >= WIN_TARGET - 5 && styles.scoreNearWin]}>
                {opponentScore}
              </Text>
              <Text style={styles.scoreTies}>{opponentTies} ties</Text>
            </View>
          </View>

          <View style={styles.moveDisplay}>
            <View style={styles.moveItem}>
              <Text style={styles.moveLabel}>
                {isAvatarMode ? '🤖 AI' : 'You'}
              </Text>
              <View style={styles.moveCircle}>
                <Text style={styles.moveIcon}>{myMove ? MOVE_ICONS[myMove] : '❓'}</Text>
              </View>
            </View>
            <Text style={styles.moveVs}>⚡</Text>
            <View style={styles.moveItem}>
              <Text style={styles.moveLabel} numberOfLines={1}>
                {isAvatarMode ? '🤖 AI' : opponentName}
              </Text>
              <View style={styles.moveCircle}>
                <Text style={styles.moveIcon}>{opponentMove ? MOVE_ICONS[opponentMove] : '❓'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.resultArea}>
            {winner && !matchOver && (
              <Text
                style={[
                  styles.resultText,
                  winner === 'win' ? styles.resultWin :
                    winner === 'lose' ? styles.resultLose : styles.resultTie,
                ]}
              >
                {getResultText()}
              </Text>
            )}
          </View>

          {!matchOver && (
            <View style={styles.buttonsArea}>
              {isAvatarMode ? (
                <View style={styles.avatarWatchBox}>
                  <Text style={styles.avatarWatchText}>
                    🤖 Both AIs are playing...
                  </Text>
                  <Text style={styles.avatarWatchSubtext}>
                    Watch the battle unfold
                  </Text>
                </View>
              ) : !myMove && !winner ? (
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
              ) : myMove && !winner ? (
                <Text style={styles.waitingText}>⏳ Waiting for opponent...</Text>
              ) : null}
            </View>
          )}
        </ScreenScroll>

        {!matchOver && (
          <ChatBubble
            messages={messages}
            myPlayerId={playerId}
            emojiList={EMOJI_LIST}
            onSendMessage={handleSendMessage}
            onSendEmoji={handleEmoji}
          />
        )}

        {matchOver && (
          <View style={styles.matchOverOverlay}>
            <View style={styles.matchOverContent}>
              <Text style={styles.matchOverEmoji}>{iWonMatch ? '🏆' : '💀'}</Text>
              <Text
                style={[
                  styles.matchOverTitle,
                  iWonMatch ? styles.matchOverWin : styles.matchOverLose,
                ]}
              >
                {iWonMatch ? 'YOU WIN!' : 'YOU LOSE'}
              </Text>
              <Text style={styles.matchOverScore}>{myScore} — {opponentScore}</Text>
              <View style={styles.matchOverButtons}>
                <TouchableOpacity style={styles.playAgainBtn} onPress={handlePlayAgain}>
                  <Text style={styles.playAgainBtnText}>Play Again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.exitBtn} onPress={handleLeave}>
                  <Text style={styles.exitBtnText}>Exit Room</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  floatingLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 500 },
  floatingEmoji: { position: 'absolute', bottom: 120, alignItems: 'center' },
  floatingEmojiText: { fontSize: 48 },
  floatingEmojiName: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
  headerBtn: { padding: 6 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  headerSubtitle: { fontSize: 10, color: '#a78bfa', marginTop: 1, fontWeight: '600' },
  disconnectBanner: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderColor: 'rgba(251, 191, 36, 0.4)',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginTop: 6,
    borderRadius: 10,
    alignItems: 'center',
  },
  disconnectText: { fontSize: 12, color: '#fbbf24', fontWeight: '700' },
  scrollContent: { paddingBottom: 100 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  scoreItem: { alignItems: 'center', flex: 1 },
  scoreName: { fontSize: 10, color: '#5a5a7a', textTransform: 'uppercase', fontWeight: '600' },
  scoreValue: { fontSize: 26, fontWeight: '800', color: '#ffffff', marginTop: 2 },
  scoreNearWin: { color: '#fbbf24' },
  scoreTies: { fontSize: 10, color: '#5a5a7a', marginTop: 1 },
  scoreCenter: { alignItems: 'center', paddingHorizontal: 8 },
  scoreVs: { fontSize: 16, color: '#e94560' },
  scoreRound: { fontSize: 10, color: '#5a5a7a', marginTop: 2 },
  moveDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  moveItem: { alignItems: 'center', flex: 1 },
  moveLabel: { fontSize: 10, color: '#5a5a7a', textTransform: 'uppercase', marginBottom: 4, fontWeight: '600' },
  moveCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)',
  },
  moveIcon: { fontSize: 28 },
  moveVs: { fontSize: 18, color: '#5a5a7a', marginHorizontal: 6 },
  resultArea: { alignItems: 'center', paddingVertical: 6, minHeight: 34 },
  resultText: { fontSize: 20, fontWeight: '800' },
  resultWin: { color: '#4ade80' },
  resultLose: { color: '#f87171' },
  resultTie: { color: '#fbbf24' },
  buttonsArea: { justifyContent: 'center', paddingHorizontal: 12, paddingBottom: 12, paddingTop: 12 },
  moveButtons: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  moveButton: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    width: 76,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  moveBtnIcon: { fontSize: 28, marginBottom: 2 },
  moveBtnName: { fontSize: 10, color: '#5a5a7a', fontWeight: '600', textTransform: 'uppercase' },
  waitingText: { fontSize: 13, color: '#5a5a7a', textAlign: 'center' },
  avatarWatchBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  avatarWatchText: {
    fontSize: 16,
    color: '#a78bfa',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  avatarWatchSubtext: {
    fontSize: 11,
    color: '#5a5a7a',
    fontWeight: '600',
  },
  matchOverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 15, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  matchOverContent: { alignItems: 'center', paddingHorizontal: 32, gap: 10 },
  matchOverEmoji: { fontSize: 72 },
  matchOverTitle: { fontSize: 42, fontWeight: '900', letterSpacing: 2 },
  matchOverWin: { color: '#4ade80' },
  matchOverLose: { color: '#f87171' },
  matchOverScore: { fontSize: 20, color: '#8a8a9a', fontWeight: '700', marginTop: 4 },
  matchOverButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  playAgainBtn: { backgroundColor: '#e94560', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  playAgainBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  exitBtn: { backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  exitBtnText: { color: '#8a8a9a', fontSize: 14, fontWeight: '700' },
});