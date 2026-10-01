// src/components/ActiveCountdown.tsx
//
// RPS Arena — 90s Active countdown ring for tournament rounds.
//
// Renders a circular progress ring that depletes as secondsLeft
// falls from totalSeconds to 0, plus the numeric seconds inside.
//
// Implementation: two rotated half-circle overlays (the classic RN
// "pie trick"). No react-native-svg, no new dependencies.
//
// Props are deliberately minimal:
//   secondsLeft   — from activeWindowUpdate broadcasts
//   totalSeconds  — defaults to 90 (ACTIVE_WINDOW_MS / 1000)
//   size          — outer diameter in px
//   color         — ring color (defaults to the player's bracket color
//                   if the parent passes it, else the tournament red)
//
// The ring has three visual zones:
//   60s..90s → full ring, calm
//   30s..60s → ring is 1/3..2/3 depleted, still calm
//    0s..30s → ring is mostly depleted AND pulses (color shifts to
//              the tournament warning yellow) to signal urgency
//
// The numeric seconds sit in the middle and switch to the warning
// color in the last 30 seconds. The center is not tappable; the
// parent's Active button handles the press.

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

interface Props {
  secondsLeft: number;
  totalSeconds?: number;
  size?: number;
  color?: string;
  thickness?: number;
}

const URGENT_THRESHOLD_S = 30;

export default function ActiveCountdown({
  secondsLeft,
  totalSeconds = 90,
  size = 26,
  color = '#e94560',
  thickness = 3,
}: Props) {
  const safeTotal = totalSeconds > 0 ? totalSeconds : 90;
  const safeLeft = Math.max(0, Math.min(safeTotal, secondsLeft));
  const progress = safeLeft / safeTotal; // 1 → full, 0 → empty

  const isUrgent = safeLeft <= URGENT_THRESHOLD_S;

  // Pulse animation for the urgent zone.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isUrgent) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(1);
    };
  }, [isUrgent, pulse]);

  const ringColor = isUrgent ? '#fbbf24' : color;
  const radius = size / 2;

  // The pie trick: a full ring is drawn by two half-circle overlays
  // rotating on top of a base circle. As progress decreases, we
  // rotate the overlays further and shrink a masking quarter.
  //
  // Concretely:
  //   - Base: a solid circle of color (the "remaining" arc).
  //   - Mask: a full circle of the background color on top, with a
  //     quarter cut out via borderRadius + rotation.
  //
  // A simpler and more robust approach that works reliably in RN web
  // and native: draw the arc as a series of small rotated segments.
  // But that is heavy at 26px. Instead we use two stacked rotated
  // half-circles, which is the standard, minimal-dependency
  // technique.
  //
  // rotation: 0 → full ring visible; 180 → half; 360 → empty.
  const rotationDeg = (1 - progress) * 360;

  // First half-circle: 0..180 deg of arc, drawn when rotation < 180.
  // Second half-circle: 180..360 deg of arc, drawn when rotation >= 180.
  const firstHalfRotation = Math.min(rotationDeg, 180);
  const secondHalfRotation = Math.max(rotationDeg - 180, 0);

  // The base outer circle sits behind everything; the masked ring
  // is what the user sees.
  const halfW = size / 2;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* Base ring (the "empty" track) */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: thickness,
          borderColor: 'rgba(255,255,255,0.12)',
        }}
      />

      {/* Remaining arc — pie slice via two rotated halves. */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: radius,
          overflow: 'hidden',
        }}
      >
        {/* Left half (0..180 of remaining). Rotates from 0..180. */}
        <Animated.View
          style={{
            position: 'absolute',
            width: halfW,
            height: size,
            left: 0,
            top: 0,
            overflow: 'hidden',
            opacity: pulse,
          }}
        >
          <View
            style={{
              position: 'absolute',
              width: size,
              height: size,
              left: 0,
              top: 0,
              borderTopLeftRadius: radius,
              borderBottomLeftRadius: radius,
              backgroundColor: ringColor,
              transform: [{ rotate: `${firstHalfRotation}deg` }],
              transformOrigin: 'right center' as any,
            }}
          />
        </Animated.View>

        {/* Right half (180..360 of remaining). Rotates from 0..180. */}
        <Animated.View
          style={{
            position: 'absolute',
            width: halfW,
            height: size,
            left: halfW,
            top: 0,
            overflow: 'hidden',
            opacity: pulse,
          }}
        >
          <View
            style={{
              position: 'absolute',
              width: size,
              height: size,
              left: -halfW,
              top: 0,
              borderTopRightRadius: radius,
              borderBottomRightRadius: radius,
              backgroundColor: ringColor,
              transform: [{ rotate: `${secondHalfRotation}deg` }],
              transformOrigin: 'left center' as any,
            }}
          />
        </Animated.View>

        {/* Inner mask — carves the ring hole. */}
        <View
          style={{
            position: 'absolute',
            width: size - thickness * 2,
            height: size - thickness * 2,
            left: thickness,
            top: thickness,
            borderRadius: radius - thickness,
            backgroundColor: '#1a1a1e',
          }}
        />
      </View>

      {/* Seconds number in the center */}
      <Text
        style={[
          styles.seconds,
          {
            fontSize: Math.max(10, Math.round(size * 0.42)),
            color: isUrgent ? '#fbbf24' : '#ffffff',
          },
        ]}
      >
        {safeLeft}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  seconds: {
    fontWeight: '900',
    textAlign: 'center',
    includeFontPadding: false,
  },
});