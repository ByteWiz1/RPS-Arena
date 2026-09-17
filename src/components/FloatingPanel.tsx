import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  SpaceAccent,
  COSMIC_THEME,
  getRandomOffset,
  getRandomDuration,
} from '../theme/spaceColors';

interface Props {
  accent: SpaceAccent;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  index: number;
  onPress: () => void;
  disabled?: boolean;
}

export default function FloatingPanel({
  accent,
  icon,
  title,
  subtitle,
  index,
  onPress,
  disabled = false,
}: Props) {
  const floatOffset = useSharedValue(0);
  const glowPulse = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const tiltValue = useSharedValue(0);

  const floatDuration = getRandomDuration(
    COSMIC_THEME.floatingDurationMin,
    COSMIC_THEME.floatingDurationMax
  );
  const glowDuration = getRandomDuration(
    COSMIC_THEME.glowPulseDurationMin,
    COSMIC_THEME.glowPulseDurationMax
  );
  const startDelay = index * 250 + getRandomOffset(300);

  useEffect(() => {
    floatOffset.value = withDelay(
      startDelay,
      withRepeat(
        withTiming(1, { duration: floatDuration, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      )
    );

    glowPulse.value = withDelay(
      startDelay,
      withRepeat(
        withTiming(1, { duration: glowDuration, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      )
    );

    tiltValue.value = withDelay(
      startDelay,
      withRepeat(
        withTiming(1, { duration: floatDuration * 1.3, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      )
    );
  }, []);

  const handlePressIn = () => {
    pressScale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    pressScale.value = withSequence(
      withSpring(1.02, { damping: 10, stiffness: 200 }),
      withSpring(1, { damping: 12, stiffness: 150 })
    );
  };

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(floatOffset.value, [0, 1], [-3, 3]);
    const rotate = interpolate(tiltValue.value, [0, 1], [-0.6, 0.6]);

    return {
      transform: [
        { translateY },
        { rotate: `${rotate}deg` },
        { scale: pressScale.value },
      ],
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    const opacity = interpolate(glowPulse.value, [0, 1], [0.1, 0.22]);
    const scale = interpolate(glowPulse.value, [0, 1], [0.97, 1.03]);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <Animated.View
        style={[styles.glowLayer, glowStyle, { backgroundColor: accent.glow }]}
      />

      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        disabled={disabled}
        style={styles.touchable}
      >
        <LinearGradient
          colors={[accent.gradientStart, accent.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.panel,
            { borderColor: accent.glow + '30' },
          ]}
        >
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: accent.glow + '18',
                borderColor: accent.glow + '40',
              },
            ]}
          >
            {icon}
          </View>

          <View style={styles.textWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>

          <View
            style={[
              styles.dot,
              {
                backgroundColor: accent.glow,
                shadowColor: accent.glow,
              },
            ]}
          />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    position: 'relative',
  },
  glowLayer: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 22,
    zIndex: 0,
  },
  touchable: {
    borderRadius: 16,
    zIndex: 1,
  },
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    backgroundColor: 'rgba(10, 10, 20, 0.75)',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    color: '#8a8a9a',
    marginTop: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    opacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
});