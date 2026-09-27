import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Move, MOVE_ICONS } from '../engine/GameEngine';

interface Props {
  // Newest-first ordering (index 0 = most recent)
  moves: Move[];
  slots?: number;
  accentColor?: string;
  size?: number;
}

export default function RecentMovesTrail({
  moves,
  slots = 5,
  accentColor = '#e94560',
  size = 28,
}: Props) {
  // Newest-first array, capped at `slots`
  const trail = (moves || []).slice(0, slots);

  // The most recent move — used to animate the newest slot
  const latest = trail[0];

  // Animated scale for the newest slot (pulse on change)
  const pulse = useRef(new Animated.Value(1)).current;
  const lastRef = useRef<string | null>(null);

  useEffect(() => {
    const key = latest || null;
    if (key && key !== lastRef.current) {
      lastRef.current = key;
      pulse.setValue(0.6);
      Animated.spring(pulse, {
        toValue: 1,
        useNativeDriver: true,
        damping: 8,
        stiffness: 200,
      }).start();
    }
  }, [latest, pulse]);

  return (
    <View style={styles.row}>
      {Array.from({ length: slots }).map((_, index) => {
        const move = trail[index];
        const isFilled = !!move;
        const isNewest = index === 0 && isFilled;

        return (
          <View
            key={index}
            style={[
              styles.slot,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: isFilled ? 'transparent' : 'rgba(255,255,255,0.08)',
                backgroundColor: isFilled
                  ? 'rgba(255,255,255,0.06)'
                  : 'transparent',
              },
            ]}
          >
            {isFilled ? (
              <Animated.Text
                style={[
                  styles.icon,
                  {
                    fontSize: size * 0.55,
                    transform: [{ scale: isNewest ? pulse : 1 }],
                  },
                ]}
              >
                {MOVE_ICONS[move as Move]}
              </Animated.Text>
            ) : (
              <View style={styles.emptyDot} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  icon: {
    textAlign: 'center',
  },
  emptyDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});