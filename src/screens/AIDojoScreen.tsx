import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Lock, Check, Swords, Trophy } from 'lucide-react-native';
import { useAvatarStore } from '../store/avatarStore';
import { startMenuMusic } from '../services/audio';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';

interface Master {
  id: string;
  name: string;
  emoji: string;
  rating: number;
  tagline: string;
  rewardXP: number;
  rewardRating: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  color: string;
}

const MASTERS: Master[] = [
  { id: 'rookie', name: 'Rookie', emoji: '😊', rating: 400, tagline: 'Everyone starts somewhere.', rewardXP: 10, rewardRating: 5, difficulty: 'easy', color: '#4ade80' },
  { id: 'tactician', name: 'Tactician', emoji: '🤔', rating: 800, tagline: 'I see your patterns.', rewardXP: 25, rewardRating: 10, difficulty: 'medium', color: '#4facfe' },
  { id: 'hunter', name: 'Hunter', emoji: '😤', rating: 1400, tagline: 'I know what you will do.', rewardXP: 50, rewardRating: 20, difficulty: 'hard', color: '#e94560' },
  { id: 'grandmaster', name: 'Grandmaster', emoji: '🧠', rating: 2000, tagline: 'Defeat Hunter to face me.', rewardXP: 100, rewardRating: 50, difficulty: 'expert', color: '#a78bfa' },
];

export default function AIDojoScreen() {
  const navigation = useNavigation<any>();
  const { getSelectedAvatar } = useAvatarStore();
  const avatar = getSelectedAvatar();

  useEffect(() => {
    startMenuMusic();
  }, []);

  const defeated = avatar?.defeatedMasters || [];

  const isUnlocked = (index: number): boolean => {
    if (index === 0) return true;
    return defeated.includes(MASTERS[index - 1].id);
  };

  const handleChallenge = (master: Master) => {
    if (!avatar) {
      navigation.navigate('Profile');
      return;
    }
    navigation.navigate('DojoMatch', { masterId: master.id });
  };

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ChevronLeft size={26} color="#e94560" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🥋 AI Dojo</Text>
          <View style={styles.placeholder} />
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          <View style={styles.introCard}>
            <Text style={styles.introTitle}>Face the Masters</Text>
            <Text style={styles.introSubtitle}>
              Defeat each master to unlock the next and earn rare titles.
            </Text>
          </View>

          <View style={styles.progressCard}>
            <Trophy size={20} color="#fbbf24" />
            <Text style={styles.progressText}>
              {defeated.length} / {MASTERS.length} Defeated
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(defeated.length / MASTERS.length) * 100}%` }]} />
            </View>
          </View>

          {MASTERS.map((master, index) => {
            const unlocked = isUnlocked(index);
            const completed = defeated.includes(master.id);

            return (
              <View
                key={master.id}
                style={[
                  styles.masterCard,
                  !unlocked && styles.masterCardLocked,
                  completed && styles.masterCardCompleted,
                ]}
              >
                <View style={[styles.masterEmojiWrap, { backgroundColor: master.color + '20' }]}>
                  <Text style={styles.masterEmoji}>{master.emoji}</Text>
                </View>

                <View style={styles.masterInfo}>
                  <Text style={[styles.masterName, !unlocked && styles.textLocked]}>
                    {master.name}
                  </Text>
                  <Text style={styles.masterRating}>Rating: {master.rating}</Text>
                  <Text style={styles.masterTagline}>"{master.tagline}"</Text>
                  <View style={styles.rewardRow}>
                    <Text style={styles.rewardText}>+{master.rewardXP} XP</Text>
                    <Text style={styles.rewardDot}>•</Text>
                    <Text style={styles.rewardText}>+{master.rewardRating} Rating</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.challengeButton,
                    completed && styles.challengeButtonDone,
                    !unlocked && styles.challengeButtonLocked,
                  ]}
                  onPress={() => handleChallenge(master)}
                  disabled={!unlocked}
                >
                  {completed ? (
                    <Check size={18} color="#4ade80" />
                  ) : unlocked ? (
                    <Swords size={18} color="#ffffff" />
                  ) : (
                    <Lock size={18} color="#5a5a7a" />
                  )}
                </TouchableOpacity>
              </View>
            );
          })}

          {defeated.length === MASTERS.length && (
            <View style={styles.championCard}>
              <Text style={styles.championEmoji}>🏆</Text>
              <Text style={styles.championTitle}>Dojo Master</Text>
              <Text style={styles.championText}>
                You've defeated all masters. Legend status unlocked.
              </Text>
            </View>
          )}
        </ScreenScroll>
      </SafeAreaView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  backButton: { padding: 6 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  placeholder: { width: 36 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 60 },
  introCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  introTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  introSubtitle: { fontSize: 13, color: '#5a5a7a', lineHeight: 18 },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  progressText: { flex: 1, fontSize: 14, color: '#ffffff', fontWeight: '600' },
  progressBar: { width: 80, height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fbbf24', borderRadius: 3 },
  masterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  masterCardLocked: { opacity: 0.5 },
  masterCardCompleted: { borderColor: 'rgba(74, 222, 128, 0.3)', backgroundColor: 'rgba(74, 222, 128, 0.03)' },
  masterEmojiWrap: { width: 56, height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  masterEmoji: { fontSize: 28 },
  masterInfo: { flex: 1 },
  masterName: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  textLocked: { color: '#5a5a7a' },
  masterRating: { fontSize: 12, color: '#5a5a7a', marginTop: 2 },
  masterTagline: { fontSize: 11, color: '#3a3a4a', fontStyle: 'italic', marginTop: 2 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  rewardText: { fontSize: 11, color: '#fbbf24', fontWeight: '600' },
  rewardDot: { fontSize: 11, color: '#3a3a4a' },
  challengeButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#e94560', justifyContent: 'center', alignItems: 'center' },
  challengeButtonDone: { backgroundColor: 'rgba(74, 222, 128, 0.15)' },
  challengeButtonLocked: { backgroundColor: 'rgba(255,255,255,0.03)' },
  championCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 16,
    padding: 24,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  championEmoji: { fontSize: 48, marginBottom: 8 },
  championTitle: { fontSize: 20, fontWeight: '700', color: '#fbbf24', marginBottom: 4 },
  championText: { fontSize: 13, color: '#5a5a7a', textAlign: 'center' },
});