import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import ScreenContainer from '../components/ScreenContainer';

export default function AcceptedScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const opponentName = route.params?.opponentName || 'Opponent';
  const roomCode = route.params?.roomCode;
  const playerId = route.params?.playerId;
  const playerName = route.params?.playerName;
  const [countdown, setCountdown] = useState(3);

  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 100 });

    const fadeTimer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 400 });
    }, 1500);

    const countdownTimer = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 0 : c - 1));
    }, 700);

    const navTimer = setTimeout(() => {
     navigation.replace('OnlineGame', {
      roomCode,
      playerId,
      playerName,
      opponentName,
      fromInvite: true,
    });
    }, 2600);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(navTimer);
      clearInterval(countdownTimer);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.content, animatedStyle]}>
          <Animated.View style={[styles.checkCircle, scaleStyle]}>
            <Check size={64} color="#4ade80" />
          </Animated.View>

          <Text style={styles.title}>ACCEPTED!</Text>
          <Text style={styles.matchup}>You vs {opponentName}</Text>

          <View style={styles.countdownCircle}>
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>

          <Text style={styles.subtitle}>Match starting...</Text>
        </Animated.View>
      </SafeAreaView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', gap: 16 },
  checkCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#4ade80',
  },
  title: { fontSize: 32, fontWeight: '900', color: '#4ade80', letterSpacing: 3, marginTop: 8 },
  matchup: { fontSize: 16, color: '#8a8a9a', fontWeight: '600' },
  countdownCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(233, 69, 96, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e94560',
    marginTop: 12,
  },
  countdownText: { fontSize: 40, fontWeight: '900', color: '#e94560' },
  subtitle: { fontSize: 13, color: '#5a5a7a', marginTop: 4 },
});