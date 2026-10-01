// src/components/TournamentChatPanel.tsx
//
// RPS Arena — chat + emoji wrapper for tournament screens.
//
// STEP 11 spec:
//   - Visible on lobby, bracket, and match screens
//   - Chat scoped to the tournament (tournamentId as channel)
//   - Emoji reactions use the same floating animation from
//     OnlineGameScreen
//   - Messages persisted for the duration of the tournament only
//     (server-side; this component owns the local render array)
//
// IMPORTANT: ChatBubble is NOT modified. This component:
//   1. Renders the floating-emoji Animated layer (copied verbatim
//      from OnlineGameScreen so the animation matches exactly).
//   2. Renders <ChatBubble ... /> with the same five props.
//   3. Detects emoji-only messages with the same regex and spawns
//      the floating animation client-side.
//   4. Attaches tournamentId to every sendMessage emit so the
//      server routes to io.to('tournament:' + id).
//
// Messages are owned by the parent screen and passed in — this
// keeps a single source of truth per screen, matching how
// OnlineGameScreen owns messages and passes them to ChatBubble.

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
import ChatBubble from './ChatBubble';
import { getSocket } from '../services/multiplayer';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface TournamentChatMessage {
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

interface Props {
  tournamentId: string;
  messages: TournamentChatMessage[];
  // The current user's socketId (used by ChatBubble for bubble alignment).
  myPlayerId: string;
  // The current user's display name (used when echoing their own send).
  myPlayerName: string;
  // Optional title — defaults to 'Chat' which matches ChatBubble's
  // own panel title. Kept for future per-screen labelling.
  title?: string;
}

// Same emoji list as OnlineGameScreen. ChatBubble slices to 6.
const EMOJI_LIST = ['👍', '😂', '🔥', '😎', '🤝', '😤', '💀', '🎉'];

// Same emoji-only regex used by OnlineGameScreen.
const EMOJI_ONLY_RE = /^\p{Emoji}+$/u;

export default function TournamentChatPanel({
  tournamentId,
  messages,
  myPlayerId,
  myPlayerName,
  title,
}: Props) {
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);

  const spawnFloatingEmoji = useCallback(
    (emoji: string, senderName: string) => {
      const id =
        Date.now().toString() + Math.random().toString(36).substring(2, 6);
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
    },
    []
  );

  const handleSendMessage = useCallback(
    (text: string) => {
      const socket = getSocket();
      if (!socket?.connected) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      if (EMOJI_ONLY_RE.test(trimmed)) {
        spawnFloatingEmoji(trimmed, myPlayerName);
      }

      socket.emit('sendMessage', { text: trimmed, tournamentId });
    },
    [tournamentId, myPlayerName, spawnFloatingEmoji]
  );

  const handleEmoji = useCallback(
    (emoji: string) => {
      const socket = getSocket();
      if (!socket?.connected) return;

      spawnFloatingEmoji(emoji, myPlayerName);
      socket.emit('sendMessage', { text: emoji, tournamentId });
    },
    [tournamentId, myPlayerName, spawnFloatingEmoji]
  );

  return (
    <>
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
                {
                  left: item.x,
                  transform: [{ translateY }, { scale }],
                  opacity,
                },
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

      <ChatBubble
        messages={messages}
        myPlayerId={myPlayerId}
        emojiList={EMOJI_LIST}
        onSendMessage={handleSendMessage}
        onSendEmoji={handleEmoji}
      />
    </>
  );
}

const styles = StyleSheet.create({
  floatingLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 500,
  },
  floatingEmoji: {
    position: 'absolute',
    bottom: 120,
    alignItems: 'center',
  },
  floatingEmojiText: {
    fontSize: 48,
  },
  floatingEmojiName: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
});