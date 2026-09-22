import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  Target,
  Brain,
  Dices,
  Shield,
  Save,
  RotateCcw,
  Swords,
  Zap,
  BarChart3,
} from 'lucide-react-native';
import { useAvatarStore } from '../store/avatarStore';
import {
  AvatarPersonality,
  PERSONALITY_PRESETS,
  getPersonalityDescription,
} from '../engine/AvatarEngine';
import { startMenuMusic } from '../services/audio';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import { showAlert } from '../utils/alert';

export default function TrainingScreen() {
  const navigation = useNavigation<any>();
  const { getSelectedAvatar, updateAvatarPersonality } = useAvatarStore();
  const avatar = getSelectedAvatar();

  const [personality, setPersonality] = useState<AvatarPersonality>(
    avatar?.personality || {
      aggression: 0.5,
      memory: 0.5,
      randomness: 0.5,
      defense: 0.5,
    }
  );

  const [activePreset, setActivePreset] = useState<string>('custom');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    startMenuMusic();
  }, []);

  useEffect(() => {
    if (avatar) setPersonality(avatar.personality);
  }, [avatar?.id]);

  const handleSliderChange = (key: keyof AvatarPersonality, value: number) => {
    setPersonality((prev) => ({ ...prev, [key]: value }));
    setActivePreset('custom');
    setHasChanges(true);
  };

  const handlePreset = (presetName: string) => {
    const preset = PERSONALITY_PRESETS[presetName];
    if (!preset) return;
    setPersonality({ ...preset });
    setActivePreset(presetName);
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!avatar) {
      showAlert('No Avatar', 'Create an avatar first');
      return;
    }
    updateAvatarPersonality(avatar.id, personality);
    setHasChanges(false);
    showAlert('Saved', 'Your AI has been tuned!');
  };

  const handleReset = () => {
    if (!avatar) return;
    setPersonality(avatar.personality);
    setActivePreset('custom');
    setHasChanges(false);
  };

  if (!avatar) {
    return (
      <ScreenContainer>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <ChevronLeft size={26} color="#e94560" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>🧪 Training Lab</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.emptyContainer}>
            <Brain size={64} color="#5a5a7a" />
            <Text style={styles.emptyTitle}>No Avatar Selected</Text>
            <Text style={styles.emptyText}>Create an avatar first to tune your AI</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('Profile')}
            >
              <Text style={styles.emptyButtonText}>Go to Avatars</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ChevronLeft size={26} color="#e94560" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🧪 Training Lab</Text>
          <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
            <RotateCcw size={20} color="#5a5a7a" />
          </TouchableOpacity>
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          <View style={styles.avatarHeader}>
            <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
            <View style={styles.avatarInfo}>
              <Text style={styles.avatarName}>{avatar.name}</Text>
              <Text style={styles.avatarLevel}>Level {avatar.level}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Tune Your AI's Brain</Text>

          <View style={styles.sliderCard}>
            <View style={styles.sliderHeader}>
              <Target size={16} color="#e94560" />
              <Text style={styles.sliderLabel}>Aggression</Text>
              <Text style={styles.sliderValue}>{Math.round(personality.aggression * 100)}%</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={personality.aggression}
              onValueChange={(v) => handleSliderChange('aggression', v)}
              minimumTrackTintColor="#e94560"
              maximumTrackTintColor="rgba(255,255,255,0.1)"
              thumbTintColor="#e94560"
            />
            <Text style={styles.sliderHint}>How often it counters your moves</Text>
          </View>

          <View style={styles.sliderCard}>
            <View style={styles.sliderHeader}>
              <Brain size={16} color="#4facfe" />
              <Text style={styles.sliderLabel}>Memory</Text>
              <Text style={styles.sliderValue}>{Math.round(personality.memory * 100)}%</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={personality.memory}
              onValueChange={(v) => handleSliderChange('memory', v)}
              minimumTrackTintColor="#4facfe"
              maximumTrackTintColor="rgba(255,255,255,0.1)"
              thumbTintColor="#4facfe"
            />
            <Text style={styles.sliderHint}>How far back it remembers your patterns</Text>
          </View>

          <View style={styles.sliderCard}>
            <View style={styles.sliderHeader}>
              <Dices size={16} color="#a78bfa" />
              <Text style={styles.sliderLabel}>Randomness</Text>
              <Text style={styles.sliderValue}>{Math.round(personality.randomness * 100)}%</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={personality.randomness}
              onValueChange={(v) => handleSliderChange('randomness', v)}
              minimumTrackTintColor="#a78bfa"
              maximumTrackTintColor="rgba(255,255,255,0.1)"
              thumbTintColor="#a78bfa"
            />
            <Text style={styles.sliderHint}>How unpredictable it plays</Text>
          </View>

          <View style={styles.sliderCard}>
            <View style={styles.sliderHeader}>
              <Shield size={16} color="#4ade80" />
              <Text style={styles.sliderLabel}>Defense</Text>
              <Text style={styles.sliderValue}>{Math.round(personality.defense * 100)}%</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={personality.defense}
              onValueChange={(v) => handleSliderChange('defense', v)}
              minimumTrackTintColor="#4ade80"
              maximumTrackTintColor="rgba(255,255,255,0.1)"
              thumbTintColor="#4ade80"
            />
            <Text style={styles.sliderHint}>How much it protects win streaks</Text>
          </View>

          <Text style={styles.sectionTitle}>Live Preview</Text>
          <View style={styles.previewCard}>
            <Text style={styles.previewText}>{getPersonalityDescription(personality)}</Text>
          </View>

          <Text style={styles.sectionTitle}>Quick Presets</Text>
          <View style={styles.presetsGrid}>
            {Object.keys(PERSONALITY_PRESETS).map((presetName) => (
              <TouchableOpacity
                key={presetName}
                style={[
                  styles.presetButton,
                  activePreset === presetName && styles.presetButtonActive,
                ]}
                onPress={() => handlePreset(presetName)}
              >
                <Text
                  style={[
                    styles.presetText,
                    activePreset === presetName && styles.presetTextActive,
                  ]}
                >
                  {presetName.charAt(0).toUpperCase() + presetName.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!hasChanges}
          >
            <Save size={20} color="#ffffff" />
            <Text style={styles.saveButtonText}>
              {hasChanges ? 'Save Preset' : 'Saved'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Simulations</Text>

          <TouchableOpacity
            style={styles.simulationCard}
            onPress={() => navigation.navigate('Game', { mode: 'pvc', training: true })}
          >
            <View style={[styles.simIcon, { backgroundColor: 'rgba(233, 69, 96, 0.15)' }]}>
              <Swords size={24} color="#e94560" />
            </View>
            <View style={styles.simContent}>
              <Text style={styles.simTitle}>Sparring Match</Text>
              <Text style={styles.simSubtitle}>Fight your own avatar • +15 XP</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.simulationCard}
            onPress={() => showAlert('Coming Soon', 'Blitz Test arrives in the next update')}
          >
            <View style={[styles.simIcon, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
              <Zap size={24} color="#fbbf24" />
            </View>
            <View style={styles.simContent}>
              <Text style={styles.simTitle}>Blitz Test</Text>
              <Text style={styles.simSubtitle}>5 rapid rounds • +25 XP</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.simulationCard}
            onPress={() => showAlert('Coming Soon', 'Pattern Drill arrives in the next update')}
          >
            <View style={[styles.simIcon, { backgroundColor: 'rgba(79, 172, 254, 0.15)' }]}>
              <BarChart3 size={24} color="#4facfe" />
            </View>
            <View style={styles.simContent}>
              <Text style={styles.simTitle}>Pattern Drill</Text>
              <Text style={styles.simSubtitle}>Analyze your playstyle • Insights</Text>
            </View>
          </TouchableOpacity>
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
  resetButton: { padding: 6 },
  placeholder: { width: 36 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 60 },
  avatarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  avatarEmoji: { fontSize: 40 },
  avatarInfo: { flex: 1 },
  avatarName: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  avatarLevel: { fontSize: 13, color: '#e94560', marginTop: 2 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5a5a7a',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 8,
    marginBottom: 10,
  },
  sliderCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  sliderHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  sliderLabel: { flex: 1, fontSize: 15, color: '#ffffff', fontWeight: '500' },
  sliderValue: { fontSize: 14, color: '#5a5a7a', fontWeight: '600' },
  slider: { width: '100%', height: 36 },
  sliderHint: { fontSize: 11, color: '#3a3a4a', marginTop: 2 },
  previewCard: {
    backgroundColor: 'rgba(233, 69, 96, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.2)',
  },
  previewText: { fontSize: 14, color: '#ffffff', lineHeight: 20, fontStyle: 'italic' },
  presetsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  presetButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  presetButtonActive: { backgroundColor: 'rgba(233, 69, 96, 0.15)', borderColor: '#e94560' },
  presetText: { fontSize: 13, color: '#5a5a7a', fontWeight: '500' },
  presetTextActive: { color: '#e94560' },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e94560',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  saveButtonDisabled: { backgroundColor: 'rgba(74, 222, 128, 0.2)' },
  saveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  simulationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  simIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  simContent: { flex: 1 },
  simTitle: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  simSubtitle: { fontSize: 12, color: '#5a5a7a', marginTop: 2 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
  emptyText: { fontSize: 14, color: '#5a5a7a', textAlign: 'center', marginBottom: 8 },
  emptyButton: { backgroundColor: '#e94560', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
});