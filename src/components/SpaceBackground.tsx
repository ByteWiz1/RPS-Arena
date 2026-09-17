import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { COSMIC_THEME, NEBULA_BLUR } from '../theme/spaceColors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  layer: 'near' | 'mid' | 'far';
}

interface Props {
  nebulaColors?: [string, string, string];
  starCount?: number;
}

function createStars(count: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const rand = Math.random();
    let layer: 'near' | 'mid' | 'far';
    let size: number;
    let duration: number;

    if (rand < 0.15) {
      layer = 'near';
      size = 3 + Math.random() * 2;
      duration = 12000 + Math.random() * 4000;
    } else if (rand < 0.5) {
      layer = 'mid';
      size = 2 + Math.random() * 1.5;
      duration = 18000 + Math.random() * 5000;
    } else {
      layer = 'far';
      size = 1 + Math.random() * 1;
      duration = 25000 + Math.random() * 8000;
    }

    stars.push({
      id: i,
      x: Math.random() * SCREEN_W,
      y: Math.random() * SCREEN_H,
      size,
      duration,
      delay: Math.random() * 2000,
      layer,
    });
  }
  return stars;
}

function StarDot({ star }: { star: Star }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      star.delay,
      withRepeat(
        withTiming(1, { duration: star.duration, easing: Easing.linear }),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      [0, 0.1, 0.5, 0.9, 1],
      [0, 1, 1, 0.3, 0]
    );

    const translateY = interpolate(
      progress.value,
      [0, 1],
      [-20, 40]
    );

    const translateX = interpolate(
      progress.value,
      [0, 1],
      [0, star.layer === 'near' ? 10 : star.layer === 'mid' ? 5 : 2]
    );

    const scale = interpolate(
      progress.value,
      [0, 0.5, 1],
      [0.5, 1.2, 0.5]
    );

    return {
      opacity,
      transform: [{ translateY }, { translateX }, { scale }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.star,
        {
          left: star.x,
          top: star.y,
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
        },
        animatedStyle,
      ]}
    />
  );
}

function NebulaCloud({
  color,
  size,
  x,
  y,
  duration,
}: {
  color: string;
  size: number;
  x: number;
  y: number;
  duration: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      [0, 0.5, 1],
      [COSMIC_THEME.nebulaOpacity * 0.5, COSMIC_THEME.nebulaOpacity, COSMIC_THEME.nebulaOpacity * 0.5]
    );

    const scale = interpolate(
      progress.value,
      [0, 0.5, 1],
      [0.9, 1.1, 0.9]
    );

    const translateX = interpolate(
      progress.value,
      [0, 1],
      [-15, 15]
    );

    const translateY = interpolate(
      progress.value,
      [0, 1],
      [-10, 10]
    );

    return {
      opacity,
      transform: [{ scale }, { translateX }, { translateY }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.nebula,
        {
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function SpaceBackground({
  nebulaColors,
  starCount = COSMIC_THEME.starCount,
}: Props) {
  const colors = nebulaColors || ['#a78bfa', '#4facfe', '#f472b6'];
  const stars = useMemo(() => createStars(starCount), [starCount]);

  return (
    <View style={styles.container} pointerEvents="none">
      <LinearGradient
        colors={[COSMIC_THEME.background, '#0a0515', COSMIC_THEME.background]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.nebulaLayer}>
        <NebulaCloud
          color={colors[0]}
          size={SCREEN_W * 0.9}
          x={-SCREEN_W * 0.3}
          y={-SCREEN_H * 0.15}
          duration={12000}
        />
        <NebulaCloud
          color={colors[1]}
          size={SCREEN_W * 1.1}
          x={SCREEN_W * 0.4}
          y={SCREEN_H * 0.3}
          duration={15000}
        />
        <NebulaCloud
          color={colors[2]}
          size={SCREEN_W * 0.8}
          x={SCREEN_W * 0.1}
          y={SCREEN_H * 0.6}
          duration={18000}
        />
      </View>

      <View style={styles.starLayer}>
        {stars.map((star) => (
          <StarDot key={star.id} star={star} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COSMIC_THEME.background,
    overflow: 'hidden',
  },
  nebulaLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  nebula: {
    position: 'absolute',
    opacity: 0.12,
  },
  starLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
});