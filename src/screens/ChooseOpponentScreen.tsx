import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Zap, Target, TrendingUp, Brain } from 'lucide-react-native';
import SpaceBackground from '../components/SpaceBackground';
import FloatingPanel from '../components/FloatingPanel';
import { SPACE_ACCENTS, COSMIC_THEME } from '../theme/spaceColors';
import { startMenuMusic } from '../services/audio';
import { AIDifficulty } from '../engine/AIEngine';

interface DifficultyOption {
  id: AIDifficulty;
  name: string;
  emoji: string;
  description: string;
  rating: string;
  icon: any;
  color: string;
  gradientStart: string;
  gradientEnd: string;
  base: string;
  glow: string;
  text: string;
  nebula: [string, string, string];
}

const DIFFICULTIES: DifficultyOption[] = [
  {
    id: 'easy',
    name: 'Easy',
    emoji: '😊',
    description: 'Plays randomly · No learning',
    rating: '400',
    icon: Zap,
    color: '#4ade80',
    gradientStart: '#0a3a2a',
    gradientEnd: '#051a10',
    base: '#0a1a14',
    glow: '#4ade80',
    text: '#ffffff',
    nebula: ['#4ade80', '#4facfe', '#a78bfa'],
  },
  {
    id: 'medium',
    name: 'Medium',
    emoji: '🤔',
    description: 'Learns basic patterns',
    rating: '800',
    icon: Target,
    color: '#4facfe',
    gradientStart: '#0f2a4a',
    gradientEnd: '#051020',
    base: '#0a1525',
    glow: '#4facfe',
    text: '#ffffff',
    nebula: ['#4facfe', '#a78bfa', '#4ade80'],
  },
  {
    id: 'hard',
    name: 'Hard',
    emoji: '😤',
    description: 'Strong pattern recognition',
    rating: '1400',
    icon: TrendingUp,
    color: '#e94560',
    gradientStart: '#4a0e1a',
    gradientEnd: '#1a0510',
    base: '#1a0a0f',
    glow: '#e94560',
    text: '#ffffff',
    nebula: ['#e94560', '#a78bfa', '#4facfe'],
  },
  {
    id: 'expert',
    name: 'Expert',
    emoji: '🧠',
    description: 'Full adaptive AI',
    rating: '2000',
    icon: Brain,
    color: '#a78bfa',
    gradientStart: '#2a1050',
    gradientEnd: '#0a0515',
    base: '#150a20',
    glow: '#a78bfa',
    text: '#ffffff',
    nebula: ['#a78bfa', '#4facfe', '#f472b6'],
  },
];

export default function ChooseOpponentScreen() {
  const navigation = useNavigation<any>();

  useEffect(() => {
    startMenuMusic();
  }, []);

  const handleSelect = (difficulty: AIDifficulty) => {
    navigation.navigate('Game', { mode: 'pvc', difficulty });
  };

  return (
    <View style={styles.container}>
      <SpaceBackground nebulaColors={['#a78bfa', '#4facfe', '#e94560']} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
          >
            <ChevronLeft size={24} color="#e94560" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Choose Opponent</Text>
            <Text style={styles.subtitle}>Select difficulty</Text>
          </View>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.grid}>
          {DIFFICULTIES.map((diff, index) => {
            const Icon = diff.icon;
            return (
              <FloatingPanel
                key={diff.id}
                accent={{
                  name: diff.name,
                  base: diff.base,
                  gradientStart: diff.gradientStart,
                  gradientEnd: diff.gradientEnd,
                  glow: diff.glow,
                  text: diff.text,
                  nebula: diff.nebula,
                }}
                icon={<Icon size={22} color={diff.glow} />}
                title={`${diff.emoji}  ${diff.name}`}
                subtitle={`${diff.description} · ⭐ ${diff.rating}`}
                index={index}
                onPress={() => handleSelect(diff.id)}
              />
            );
          })}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COSMIC_THEME.background,
    ...(Platform.OS === 'web' ? { height: '100vh' as any } : {}),
  },
  safeArea: {
    flex: 1,
    ...(Platform.OS === 'web' ? { height: '100%' as any } : {}),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerBtn: {
    padding: 6,
    width: 36,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(167, 139, 250, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 10,
    color: '#a78bfa',
    marginTop: 1,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
 grid: {
  flex: 1,
  paddingHorizontal: 16,
  paddingTop: 8,
  paddingBottom: 8,
  gap: 8,
  justifyContent: 'center',
},
});