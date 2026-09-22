import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  PanResponder,
  Animated,
} from 'react-native';
import { MessageCircle, X, Send } from 'lucide-react-native';

interface ChatMessage {
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

interface Props {
  messages: ChatMessage[];
  myPlayerId: string;
  emojiList: string[];
  onSendMessage: (text: string) => void;
  onSendEmoji: (emoji: string) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BUBBLE_SIZE = 54;

export default function ChatBubble({
  messages,
  myPlayerId,
  emojiList,
  onSendMessage,
  onSendEmoji,
}: Props) {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [lastReadCount, setLastReadCount] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const pan = useRef(new Animated.Value(0)).current;
  const panValue = useRef(0);

  useEffect(() => {
    const listenerId = pan.addListener(({ value }) => {
      panValue.current = value;
    });
    return () => pan.removeListener(listenerId);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderGrant: () => {
        pan.setOffset(panValue.current);
        pan.setValue(0);
      },
      onPanResponderMove: Animated.event([null, { dy: pan }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const clamped = Math.max(
          -SCREEN_HEIGHT + 260,
          Math.min(SCREEN_HEIGHT - 320, panValue.current)
        );
        Animated.spring(pan, {
          toValue: clamped,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  const unreadCount = open ? 0 : Math.max(0, messages.length - lastReadCount);

  const handleOpen = () => {
    setOpen(true);
    setLastReadCount(messages.length);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 200);
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleEmoji = (emoji: string) => {
    onSendEmoji(emoji);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  };

  useEffect(() => {
    if (open && messages.length > lastReadCount) {
      setLastReadCount(messages.length);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, open]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  if (open) {
    return (
      <Animated.View style={[styles.panel, { transform: [{ translateY: pan }] }]}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Chat</Text>
          <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
            <X size={18} color="#8a8a9a" />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <Text style={styles.emptyText}>Say hi! 👋</Text>
          ) : (
            messages.map((msg, i) => (
              <View
                key={i}
                style={[
                  styles.bubble,
                  msg.playerId === myPlayerId ? styles.bubbleMine : styles.bubbleTheirs,
                ]}
              >
                <Text style={styles.bubbleName}>{msg.playerName}</Text>
                <Text style={styles.bubbleText}>{msg.text}</Text>
                <Text style={styles.bubbleTime}>{formatTime(msg.timestamp)}</Text>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.emojiRow}>
          {emojiList.slice(0, 6).map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.emojiBtn}
              onPress={() => handleEmoji(emoji)}
            >
              <Text style={styles.emojiChar}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor="#5a5a7a"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              maxLength={100}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
              <Send size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[styles.bubbleWrap, { transform: [{ translateY: pan }] }]}
    >
      <TouchableOpacity style={styles.bubbleBtn} onPress={handleOpen} activeOpacity={0.8}>
        <MessageCircle size={24} color="#ffffff" />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubbleWrap: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    zIndex: 999,
  },
  bubbleBtn: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fbbf24',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#0a0a0f',
  },
  badgeText: { color: '#000000', fontSize: 10, fontWeight: '900' },
  panel: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    width: 280,
    maxHeight: 400,
    backgroundColor: 'rgba(20, 20, 30, 0.98)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 999,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  panelTitle: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  closeBtn: { padding: 4 },
  messages: { maxHeight: 220, paddingHorizontal: 10 },
  messagesContent: { paddingVertical: 8 },
  emptyText: { fontSize: 12, color: '#5a5a7a', textAlign: 'center', paddingVertical: 20 },
  bubble: { padding: 8, borderRadius: 10, marginBottom: 6, maxWidth: '85%' },
  bubbleMine: { backgroundColor: 'rgba(233, 69, 96, 0.2)', alignSelf: 'flex-end' },
  bubbleTheirs: { backgroundColor: 'rgba(255,255,255,0.06)', alignSelf: 'flex-start' },
  bubbleName: { fontSize: 9, color: '#8a8a9a', fontWeight: '700', marginBottom: 2 },
  bubbleText: { fontSize: 13, color: '#ffffff' },
  bubbleTime: { fontSize: 8, color: '#5a5a7a', marginTop: 2, textAlign: 'right' },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  emojiBtn: { padding: 4, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.04)' },
  emojiChar: { fontSize: 18 },
  inputRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 13,
  },
  sendBtn: {
    backgroundColor: '#e94560',
    borderRadius: 10,
    width: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
});