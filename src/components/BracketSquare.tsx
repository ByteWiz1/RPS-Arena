// src/components/BracketSquare.tsx
//
// RPS Arena — Tournament bracket square.
//
// STEP 9 visual spec:
//   inactive:   1px solid #333 border, #1a1a1e bg, #666 dimmed text
//   active:     2px solid PLAYER_COLOR border,
//               background rgba(PLAYER_COLOR, 0.15), #fff text
//   eliminated: same as inactive + strikethrough text
//   bye:        "BYE" label, uses bye player's assigned color
//
// The Active button is only visible on the current player's own
// square, only when the round is open, and only if that player has
// not already pressed Active this round. The 90s countdown ring
// (ActiveCountdown) renders next to the button.
//
// This component is pure presentation. It does not own socket or
// navigation state.

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import ActiveCountdown from './ActiveCountdown';

export type BracketSquareState = 'inactive' | 'active' | 'eliminated' | 'bye';

interface Props {
  // Player display name. For BYE squares, pass "BYE".
  name: string;

  // The player's assigned color from colorMap. May be null while
  // colorMap has not arrived yet (rare — the tournamentStarted event
  // precedes the first roundStarted).
  color: string | null;

  // Visual state.
  state: BracketSquareState;

  // Whether this square belongs to the current user.
  isMe?: boolean;

  // Active button controls (only rendered when all are provided).
  showActiveButton?: boolean;       // round is open AND isMe AND !alreadyActive
  activeSecondsLeft?: number;       // driven by activeWindowUpdate
  onPressActive?: () => void;
  alreadyActive?: boolean;          // I already pressed Active this round

  // Layout
  width?: number;
  height?: number;

  // Winner marker for completed matches.
  isWinner?: boolean;
}

export default function BracketSquare({
  name,
  color,
  state,
  isMe = false,
  showActiveButton = false,
  activeSecondsLeft = 0,
  onPressActive,
  alreadyActive = false,
  width = 140,
  height = 48,
  isWinner = false,
}: Props) {
  const isBye = state === 'bye';
  const isEliminated = state === 'eliminated';
  const isActive = state === 'active' && !isBye;

  const borderColor = isActive && color ? color : '#333';
  const borderWidth = isActive && color ? 2 : 1;
  const backgroundColor = isActive && color
    ? hexToRgba(color, 0.15)
    : '#1a1a1e';
  const textColor = isActive ? '#ffffff' : '#666';

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.square,
          {
            width,
            height,
            borderColor,
            borderWidth,
            backgroundColor,
          },
        ]}
      >
        <View style={styles.nameWrap}>
          <Text
            numberOfLines={1}
            style={[
              styles.name,
              { color: textColor },
              isEliminated && styles.nameStruck,
              isBye && styles.nameBye,
            ]}
          >
            {isBye ? 'BYE' : name}
          </Text>
          {isMe && !isBye ? (
            <Text style={[styles.meTag, { color: isActive ? '#ffffff' : '#888' }]}>
              you
            </Text>
          ) : null}
          {isWinner ? <Text style={styles.winnerTag}>★</Text> : null}
        </View>

        {showActiveButton && !alreadyActive ? (
          <View style={styles.activeWrap}>
            <TouchableOpacity
              style={[
                styles.activeBtn,
                { borderColor: color || '#e94560' },
              ]}
              onPress={onPressActive}
              activeOpacity={0.75}
            >
              <Text style={styles.activeBtnText}>Active</Text>
            </TouchableOpacity>
            <ActiveCountdown
              secondsLeft={activeSecondsLeft}
              totalSeconds={90}
              size={26}
              color={color || '#e94560'}
            />
          </View>
        ) : null}

        {alreadyActive ? (
          <View style={styles.activeWrap}>
            <View style={[styles.activeDot, { backgroundColor: color || '#4ade80' }]} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

// Convert "#RRGGBB" to "rgba(r,g,b,a)". Falls back to a neutral if
// the hex is malformed — better than crashing mid-render.
function hexToRgba(hex: string, alpha: number): string {
  if (typeof hex !== 'string') return `rgba(255,255,255,${alpha})`;
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => !Number.isFinite(n))) {
    return `rgba(255,255,255,${alpha})`;
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  square: {
    borderRadius: 8,
    paddingHorizontal: 8,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  nameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  name: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  nameStruck: {
    textDecorationLine: 'line-through',
  },
  nameBye: {
    letterSpacing: 2,
    fontWeight: '900',
  },
  meTag: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  winnerTag: {
    fontSize: 11,
    color: '#fbbf24',
    marginLeft: 2,
    fontWeight: '900',
  },
  activeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  activeBtn: {
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  activeBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});