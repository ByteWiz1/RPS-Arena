import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Vibration,
  Alert,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, RotateCcw, Send, MessageCircle } from 'lucide-react-native';
import { getSocket, disconnectFromServer } from '../services/multiplayer';
import { useSettingsStore } from '../store/settingsStore';
import { ALL_MOVES, MOVE_ICONS, MOVE_NAMES, Move } from '../engine/GameEngine';
import { playBackground, stopBackground, playSound } from '../services/audio';

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
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OnlineGameScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { roomCode, playerId, playerName } = route.params;
  const { vibrationEnabled } = useSettingsStore();

  const [myMove, setMyMove] = useState<Move | null>(null);
  const [opponentMove, setOpponentMove] = useState<Move | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [myTies, setMyTies] = useState(0);
  const [opponentTies, setOpponentTies] = useState(0);
  const [round, setRound] = useState(0);
  const [winner, setWinner] = useState<'win' | 'lose' | 'tie' | null>(null);
  const [opponentName, setOpponentName] = useState('Opponent');
  const [waiting, setWaiting] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  const EMOJI_LIST = ['👍', '😂', '🔥', '😎', '🤝', '😤', '💀', '🎉'];

  useEffect(() => {
    playBackground();
    return () => {
      stopBackground();
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

    setFloatingEmojis((prev) => [...prev, { id, emoji, playerName: senderName, anim }]);

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

    socket.on('newMessage', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);

      const emojiRegex = /^\p{Emoji}+$/u;
      if (emojiRegex.test(msg.text.trim())) {
        spawnFloatingEmoji(msg.text.trim(), msg.playerName);
      }

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
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
        if (vibrationEnabled) Vibration.vibrate(iWon ? [0, 200, 100, 200] : [0, 300]);
      } else {
        setWinner('tie');
      }

      setMyScore(data.scores[playerId] || 0);
      const opponentId2 = Object.keys(data.scores).find(id => id !== playerId);
      setOpponentScore(opponentId2 ? data.scores[opponentId2] : 0);
      setMyTies(data.ties?.[playerId] || 0);
      setOpponentTies(opponentId2 ? data.ties?.[opponentId2] || 0 : 0);
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
      setMyTies(0);
      setOpponentTies(0);
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
      socket.off('newMessage');
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
    playSound('click');
    if (vibrationEnabled) Vibration.vibrate(10);
    socket.emit('makeMove', { move });
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    const socket = getSocket();
    if (!socket) return;

    const emojiRegex = /^\p{Emoji}+$/u;
    if (emojiRegex.test(inputText.trim())) {
      spawnFloatingEmoji(inputText.trim(), playerName);
    }

    socket.emit('sendMessage', { text: inputText.trim() });
    setInputText('');
  };

  const handleEmoji = (emoji: string) => {
    const socket = getSocket();
    if (!socket) return;
    spawnFloatingEmoji(emoji, playerName);
    socket.emit('sendMessage', { text: emoji });
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

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.floatingLayer} pointerEvents="none">
        {floatingEmojis.map((item) => {
          const translateY = item.anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -400],
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
                {
                  transform: [{ translateY }, { scale }],
                  opacity,
                },
              ]}
            >
              <Text style={styles.floatingEmojiText}>{item.emoji}</Text>
              <Text style={styles.floatingEmojiName}>{item.playerName}</Text>
            </Animated.View>
          );
        })}
      </View>

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
            <Text style={styles.scoreTies}>{myTies} ties</Text>
          </View>
          <View style={styles.scoreDivider}>
            <Text style={styles.scoreVs}>⚡</Text>
            <Text style={styles.scoreRound}>R{round}</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreName}>{opponentName}</Text>
            <Text style={styles.scoreValue}>{opponentScore}</Text>
            <Text style={styles.scoreTies}>{opponentTies} ties</Text>
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

      <View style={styles.chatSection}>
        <TouchableOpacity
          style={styles.chatToggle}
          onPress={() => setChatOpen(!chatOpen)}
        >
          <MessageCircle size={18} color="#5a5a7a" />
          <Text style={styles.chatToggleText}>
            Chat {chatOpen ? '▼' : '▲'}
          </Text>
          {messages.length > 0 && !chatOpen && (
            <View style={styles.chatBadge}>
              <Text style={styles.chatBadgeText}>{messages.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        {chatOpen && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.chatMessages}
              contentContainerStyle={styles.chatMessagesContent}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.length === 0 ? (
                <Text style={styles.chatEmpty}>No messages yet. Say hi!</Text>
              ) : (
                messages.map((msg, i) => (
                  <View
                    key={i}
                    style={[
                      styles.chatBubble,
                      msg.playerId === playerId ? styles.chatBubbleMine : styles.chatBubbleTheirs,
                    ]}
                  >
                    <Text style={styles.chatBubbleName}>{msg.playerName}</Text>
                    <Text style={styles.chatBubbleText}>{msg.text}</Text>
                    <Text style={styles.chatBubbleTime}>{formatTime(msg.timestamp)}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.emojiRow}>
              {EMOJI_LIST.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiButton}
                  onPress={() => handleEmoji(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Type a message..."
                placeholderTextColor="#5a5a7a"
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSendMessage}
                maxLength={100}
              />
              <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
                <Send size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  floatingLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  floatingEmoji: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
  },
  floatingEmojiText: { fontSize: 48 },
  floatingEmojiName: { fontSize: 10, color: '#ffffff', marginTop: 2, opacity: 0.7 },
  scrollContent: { paddingBottom: 20 },
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
  scoreTies: { fontSize: 11, color: '#5a5a7a', marginTop: 2 },
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
  chatSection: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', backgroundColor: '#0a0a0f' },
  chatToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, gap: 8 },
  chatToggleText: { fontSize: 14, color: '#5a5a7a', fontWeight: '500' },
  chatBadge: { backgroundColor: '#e94560', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 4 },
  chatBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  chatMessages: { maxHeight: 140, paddingHorizontal: 16 },
  chatMessagesContent: { paddingVertical: 8 },
  chatEmpty: { fontSize: 12, color: '#5a5a7a', textAlign: 'center', paddingVertical: 20 },
  chatBubble: { padding: 8, borderRadius: 10, marginBottom: 6, maxWidth: '80%' },
  chatBubbleMine: { backgroundColor: 'rgba(233, 69, 96, 0.15)', alignSelf: 'flex-end' },
  chatBubbleTheirs: { backgroundColor: 'rgba(255,255,255,0.05)', alignSelf: 'flex-start' },
  chatBubbleName: { fontSize: 10, color: '#5a5a7a', marginBottom: 2, fontWeight: '600' },
  chatBubbleText: { fontSize: 14, color: '#ffffff' },
  chatBubbleTime: { fontSize: 9, color: '#3a3a4a', marginTop: 2, textAlign: 'right' },
  emojiRow: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 6, gap: 6, flexWrap: 'wrap', paddingHorizontal: 8 },
  emojiButton: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)' },
  emojiText: { fontSize: 22 },
  chatInputRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4, gap: 8 },
  chatInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: '#ffffff', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  sendButton: { backgroundColor: '#e94560', borderRadius: 12, width: 44, justifyContent: 'center', alignItems: 'center' },
});