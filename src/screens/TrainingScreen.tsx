import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Play, Brain } from 'lucide-react-native';
import { useAvatarStore } from '../store/avatarStore';

export default function TrainingScreen() {
  const navigation = useNavigation<any>();
  const { getSelectedAvatar } = useAvatarStore();
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState(0);

  const selectedAvatar = getSelectedAvatar();

  const startTraining = () => {
    setIsTraining(true);
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 15;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setIsTraining(false);
      }
      setProgress(Math.min(p, 100));
    }, 300);
  };

  const resetTraining = () => {
    setProgress(0);
    setIsTraining(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={28} color="#e94560" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🧠 Training</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {selectedAvatar ? (
          <>
            <View style={styles.avatarCard}>
              <Text style={styles.avatarEmoji}>🤖</Text>
              <Text style={styles.avatarName}>{selectedAvatar.name}</Text>
              <Text style={styles.avatarLevel}>Level {selectedAvatar.level}</Text>
              <Text style={styles.avatarXp}>{selectedAvatar.xp} XP</Text>
            </View>

            <View style={styles.trainingCard}>
              <Text style={styles.trainingTitle}>Training Session</Text>
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {isTraining ? `Training... ${Math.round(progress)}%` :
                  progress === 100 ? '✅ Training Complete!' :
                    'Ready to train your AI'}
              </Text>
              <TouchableOpacity
                style={[styles.trainButton, isTraining && styles.trainButtonDisabled]}
                onPress={progress === 100 ? resetTraining : startTraining}
                disabled={isTraining}
              >
                <Play size={20} color="#ffffff" />
                <Text style={styles.trainButtonText}>
                  {progress === 100 ? 'Reset Training' : 'Start Training'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.statsTitle}>AI Performance</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{selectedAvatar.wins}</Text>
                  <Text style={styles.statLabel}>Wins</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{selectedAvatar.losses}</Text>
                  <Text style={styles.statLabel}>Losses</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {selectedAvatar.wins + selectedAvatar.losses > 0
                      ? Math.round((selectedAvatar.wins / (selectedAvatar.wins + selectedAvatar.losses)) * 100)
                      : 0}%
                  </Text>
                  <Text style={styles.statLabel}>Win Rate</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{selectedAvatar.rating}</Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Brain size={48} color="#5a5a7a" />
            <Text style={styles.emptyTitle}>No Avatar Selected</Text>
            <Text style={styles.emptyText}>Create an avatar first to start training</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => navigation.navigate('Profile')}
            >
              <Text style={styles.createButtonText}>Go to Avatars</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff' },
  placeholder: { width: 44 },
  content: { padding: 16, paddingBottom: 40 },
  avatarCard: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  avatarEmoji: { fontSize: 48, marginBottom: 8 },
  avatarName: { fontSize: 18, fontWeight: '600', color: '#ffffff' },
  avatarLevel: { fontSize: 14, color: '#e94560', marginTop: 2 },
  avatarXp: { fontSize: 12, color: '#5a5a7a', marginTop: 2 },
  trainingCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  trainingTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff', marginBottom: 12 },
  progressContainer: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressBar: { height: '100%', backgroundColor: '#e94560', borderRadius: 4 },
  progressText: { fontSize: 14, color: '#5a5a7a', marginBottom: 12 },
  trainButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#e94560', padding: 12, borderRadius: 8 },
  trainButtonDisabled: { opacity: 0.5 },
  trainButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  statsCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  statsTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff', marginBottom: 12 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#ffffff' },
  statLabel: { fontSize: 12, color: '#5a5a7a', marginTop: 2 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff', marginTop: 12 },
  emptyText: { fontSize: 14, color: '#5a5a7a', marginTop: 4, marginBottom: 24 },
  createButton: { backgroundColor: '#e94560', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 },
  createButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});