import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ChevronLeft,
  Target,
  Brain,
  Dices,
  Shield,
  Save,
} from 'lucide-react-native';
import { useGameStore } from '../store/gameStore';
import { useAvatarStore } from '../store/avatarStore';
import { AIDifficulty, AIPersonality } from '../engine/AIEngine';
import {
  PERSONALITY_PRESETS,
  getPersonalityDescription,
} from '../engine/AvatarEngine';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import { showAlert } from '../utils/alert';

const DIFFICULTIES: { id: AIDifficulty; name: string; emoji: string; desc: string; color: string }[] = [
  { id: 'easy', name: 'Easy', emoji: '😊', desc: 'Random plays', color: '#4ade80' },
  { id: 'medium', name: 'Medium', emoji: '🤔', desc: 'Basic learning', color: '#4facfe' },
  { id: 'hard', name: 'Hard', emoji: '😤', desc: 'Pattern hunter', color: '#e94560' },
  { id: 'expert', name: 'Expert', emoji: '🧠', desc: 'Full adaptive', color: '#a78bfa' },
];

export default function AISettingsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { aiDifficulty, setAIDifficulty, setAIPersonality } = useGameStore();
  const { getSelectedAvatar, updateAvatarPersonality } = useAvatarStore();
  const avatar = getSelectedAvatar();

  const [difficulty, setDifficulty] = useState<AIDifficulty>(
    route.params?.currentDifficulty || aiDifficulty
  );
  const [personality, setPersonality] = useState<AIPersonality>(
    avatar?.personality || {
      aggression: 0.5,
      memory: 0.5,
      randomness: 0.5,
      defense: 0.5,
    }
  );
  const [hasChanges, setHasChanges] = useState(false);

  const handleDifficultyChange = (d: AIDifficulty) => {
    setDifficulty(d);
    setHasChanges(true);
  };

  const handleSliderChange = (key: keyof AIPersonality, value: number) => {
    setPersonality((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handlePreset = (presetName: string) => {
    const preset = PERSONALITY_PRESETS[presetName];
    if (!preset) return;
    setPersonality({ ...preset });
    setHasChanges(true);
  };

  const handleSave = () => {
    setAIDifficulty(difficulty);
    setAIPersonality(personality);

    if (avatar) updateAvatarPersonality(avatar.id, personality);

    setHasChanges(false);
    showAlert('Saved', 'AI settings updated');
    navigation.goBack();
  };

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <ChevronLeft size={24} color="#e94560" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>🧠 AI Settings</Text>
            <Text style={styles.subtitle}>Configure your opponent</Text>
          </View>
          <View style={styles.headerBtn} />
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          <Text style={styles.sectionTitle}>DIFFICULTY</Text>
          <View style={styles.difficultyGrid}>
            {DIFFICULTIES.map((d) => {
              const isActive = difficulty === d.id;
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    styles.diffCard,
                    isActive && { borderColor: d.color, backgroundColor: d.color + '15' },
                  ]}
                  onPress={() => handleDifficultyChange(d.id)}
                >
                  <Text style={styles.diffEmoji}>{d.emoji}</Text>
                  <Text style={[styles.diffName, isActive && { color: d.color }]}>
                    {d.name}
                  </Text>
                  <Text style={styles.diffDesc}>{d.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>PERSONALITY</Text>

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
            <Text style={styles.sliderHint}>Counters more when high</Text>
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
            <Text style={styles.sliderHint}>Remembers more of your patterns</Text>
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
            <Text style={styles.sliderHint}>Plays more unpredictably</Text>
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
            <Text style={styles.sliderHint}>Protects winning streaks</Text>
          </View>

          <Text style={styles.sectionTitle}>LIVE PREVIEW</Text>
          <View style={styles.previewCard}>
            <Text style={styles.previewText}>{getPersonalityDescription(personality)}</Text>
          </View>

          <Text style={styles.sectionTitle}>QUICK PRESETS</Text>
          <View style={styles.presetsRow}>
            {Object.keys(PERSONALITY_PRESETS).map((presetName) => (
              <TouchableOpacity
                key={presetName}
                style={styles.presetBtn}
                onPress={() => handlePreset(presetName)}
              >
                <Text style={styles.presetText}>
                  {presetName.charAt(0).toUpperCase() + presetName.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, !hasChanges && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!hasChanges}
          >
            <Save size={18} color="#ffffff" />
            <Text style={styles.saveBtnText}>
              {hasChanges ? 'Apply Settings' : 'No Changes'}
            </Text>
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerBtn: { padding: 6, width: 36 },
  headerCenter: { alignItems: 'center', flex: 1 },
  title: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  subtitle: {
    fontSize: 10,
    color: '#8a8a9a',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 60 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5a5a7a',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 12,
    marginBottom: 8,
  },
  difficultyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  diffCard: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  diffEmoji: { fontSize: 26, marginBottom: 4 },
  diffName: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  diffDesc: { fontSize: 10, color: '#8a8a9a', marginTop: 2, textAlign: 'center' },
  sliderCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  sliderHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sliderLabel: { flex: 1, fontSize: 14, color: '#ffffff', fontWeight: '600' },
  sliderValue: { fontSize: 13, color: '#8a8a9a', fontWeight: '700' },
  slider: { width: '100%', height: 32 },
  sliderHint: { fontSize: 10, color: '#3a3a4a', marginTop: 0 },
  previewCard: {
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.2)',
  },
  previewText: { fontSize: 13, color: '#ffffff', lineHeight: 18, fontStyle: 'italic' },
  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  presetText: { fontSize: 11, color: '#8a8a9a', fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e94560',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
  },
  saveBtnDisabled: { backgroundColor: 'rgba(74, 222, 128, 0.15)' },
  saveBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});