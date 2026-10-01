// src/screens/TrainingScreen.tsx
//
// RPS Arena — Training Lab.
//
// Chat 9-era: manual tuner — four sliders + presets.
// Chat 10:    "Train by Playing" section (avatar list).
// Chat 11a:   Blitz grid (10 variants) + Endurance card + Pressure
//             duration modal.
//
// FIX (Chat 11a follow-up): the Blitz and Endurance cards were
// calling `avatar!.id`, which crashes when `avatar` is null. That
// happens when the user has avatars but none is marked selected
// (server sync lag, or a deleted-and-not-yet-reselected state).
//
// Fix: derive a non-null `avatar` by falling back to `avatars[0]`
// when `getSelectedAvatar()` returns null but `avatars.length > 0`.
// All downstream code uses `avatar` without `!`.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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
  Play,
  Sparkles,
  Clock,
  Flame,
} from 'lucide-react-native';
import { useAvatarStore } from '../store/avatarStore';
import {
  AvatarPersonality,
  PERSONALITY_PRESETS,
  getPersonalityDescription,
} from '../engine/AvatarEngine';
import {
  BLITZ_VARIANTS,
  BLITZ_VARIANT_ORDER,
  describeEndCondition,
  PRESSURE_MIN_SEC,
  PRESSURE_MAX_SEC,
  PRESSURE_DEFAULT_SEC,
  PRESSURE_PRESETS,
} from '../engine/BlitzRules';
import type { BlitzVariantId } from '../engine/BlitzTypes';
import { startMenuMusic } from '../services/audio';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import { showAlert } from '../utils/alert';

const ENDURANCE_ROUNDS = 30;

export default function TrainingScreen() {
  const navigation = useNavigation<any>();
  const { avatars, getSelectedAvatar, updateAvatarPersonality } =
    useAvatarStore();

  // ── FIX: safe avatar resolution ──
  // Prefer the selected avatar. If none is selected but avatars exist,
  // fall back to the first one. This prevents `avatar!.id` from
  // crashing on the Blitz and Endurance cards.
  const selectedAvatar = getSelectedAvatar();
  const avatar = selectedAvatar || avatars[0] || null;

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

  const [pressurePickerOpen, setPressurePickerOpen] = useState(false);
  const [pressureDuration, setPressureDuration] = useState<number>(
    PRESSURE_DEFAULT_SEC
  );

  useEffect(() => {
    startMenuMusic();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (avatar) {
        setPersonality(avatar.personality);
        setActivePreset('custom');
        setHasChanges(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [avatar?.id, avatar?.personality])
  );

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

  // ── Training routes ──
  const handleStartTraining = (avatarId: string) => {
    navigation.navigate('TrainingMatch', { avatarId });
  };

  const handleStartEndurance = (avatarId: string) => {
    navigation.navigate('TrainingMatch', {
      avatarId,
      target: ENDURANCE_ROUNDS,
    });
  };

  const handleStartBlitz = (avatarId: string, variant: BlitzVariantId) => {
    if (variant === 'pressure') {
      setPressurePickerOpen(true);
      return;
    }
    navigation.navigate('BlitzMatch', { avatarId, variant });
  };

  const handleConfirmPressure = () => {
    if (!avatar) {
      setPressurePickerOpen(false);
      return;
    }
    setPressurePickerOpen(false);
    navigation.navigate('BlitzMatch', {
      avatarId: avatar.id,
      variant: 'pressure',
      durationSec: pressureDuration,
    });
  };

  // ── Empty state: no avatars at all ──
  if (avatars.length === 0) {
    return (
      <ScreenContainer>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <ChevronLeft size={26} color="#e94560" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>🧪 Training Lab</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.emptyContainer}>
            <Brain size={64} color="#5a5a7a" />
            <Text style={styles.emptyTitle}>No Avatar Yet</Text>
            <Text style={styles.emptyText}>
              Create an avatar first to tune your AI
            </Text>
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

  // ── Main render: avatars exist, `avatar` is now guaranteed non-null ──
  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ChevronLeft size={26} color="#e94560" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🧪 Training Lab</Text>
          <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
            <RotateCcw size={20} color="#5a5a7a" />
          </TouchableOpacity>
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          {/* ══════════════════════════════════════════════════
              Train by Playing
              ══════════════════════════════════════════════════ */}
          <View style={styles.trainByPlayHeader}>
            <Sparkles size={14} color="#a78bfa" />
            <Text style={styles.sectionTitleInline}>Train by Playing</Text>
          </View>
          <Text style={styles.sectionHelper}>
            Play a 5-round match against your own avatar. Its personality
            shifts based on how you played.
          </Text>

          <View style={styles.avatarList}>
            {avatars.map((a) => {
              const isSelected = a.id === avatar.id;
              return (
                <View
                  key={a.id}
                  style={[
                    styles.trainRow,
                    isSelected && styles.trainRowSelected,
                  ]}
                >
                  <View style={styles.trainRowLeft}>
                    <Text style={styles.trainRowEmoji}>{a.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.trainRowName} numberOfLines={1}>
                        {a.name}
                        {isSelected ? '  ✓' : ''}
                      </Text>
                      <View style={styles.miniPills}>
                        <MiniPill label="AGG" value={a.personality.aggression} />
                        <MiniPill label="MEM" value={a.personality.memory} />
                        <MiniPill
                          label="RND"
                          value={a.personality.randomness}
                        />
                        <MiniPill label="DEF" value={a.personality.defense} />
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.trainBtn}
                    onPress={() => handleStartTraining(a.id)}
                    activeOpacity={0.7}
                  >
                    <Play size={14} color="#ffffff" />
                    <Text style={styles.trainBtnText}>Train</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* ══════════════════════════════════════════════════
              Blitz Test grid
              ══════════════════════════════════════════════════ */}
          <View style={styles.divider} />

          <View style={styles.trainByPlayHeader}>
            <Zap size={14} color="#fbbf24" />
            <Text style={[styles.sectionTitleInline, { color: '#fbbf24' }]}>
              Blitz Test
            </Text>
          </View>
          <Text style={styles.sectionHelper}>
            Fast, high-intensity training modes. Each variant teaches your
            AI something different.
          </Text>

          <View style={styles.blitzGrid}>
            {BLITZ_VARIANT_ORDER.map((variantId) => {
              const cfg = BLITZ_VARIANTS[variantId];
              return (
                <TouchableOpacity
                  key={variantId}
                  style={styles.blitzCard}
                  onPress={() => handleStartBlitz(avatar.id, variantId)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.blitzIcon}>{cfg.icon}</Text>
                  <Text style={styles.blitzName} numberOfLines={1}>
                    {cfg.name}
                  </Text>
                  <Text style={styles.blitzTagline} numberOfLines={2}>
                    {cfg.tagline}
                  </Text>
                  <Text style={styles.blitzEnd}>
                    {describeEndCondition(cfg)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ══════════════════════════════════════════════════
              Endurance card
              ══════════════════════════════════════════════════ */}
          <View style={styles.divider} />

          <View style={styles.trainByPlayHeader}>
            <Clock size={14} color="#4facfe" />
            <Text style={[styles.sectionTitleInline, { color: '#4facfe' }]}>
              Long Session
            </Text>
          </View>
          <Text style={styles.sectionHelper}>
            Deep training. More rounds = more reliable personality shifts.
          </Text>

          <TouchableOpacity
            style={styles.enduranceCard}
            onPress={() => handleStartEndurance(avatar.id)}
            activeOpacity={0.7}
          >
            <View style={styles.enduranceIconWrap}>
              <Flame size={28} color="#4facfe" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.enduranceTitle}>Endurance</Text>
              <Text style={styles.enduranceSubtitle}>
                Play exactly {ENDURANCE_ROUNDS} rounds — the longest sample,
                the biggest shift
              </Text>
            </View>
            <Play size={18} color="#4facfe" />
          </TouchableOpacity>

          {/* ══════════════════════════════════════════════════
              Manual tuner
              ══════════════════════════════════════════════════ */}
          <View style={styles.divider} />

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
              <Text style={styles.sliderValue}>
                {Math.round(personality.aggression * 100)}%
              </Text>
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
            <Text style={styles.sliderHint}>
              How often it counters your moves
            </Text>
          </View>

          <View style={styles.sliderCard}>
            <View style={styles.sliderHeader}>
              <Brain size={16} color="#4facfe" />
              <Text style={styles.sliderLabel}>Memory</Text>
              <Text style={styles.sliderValue}>
                {Math.round(personality.memory * 100)}%
              </Text>
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
            <Text style={styles.sliderHint}>
              How far back it remembers your patterns
            </Text>
          </View>

          <View style={styles.sliderCard}>
            <View style={styles.sliderHeader}>
              <Dices size={16} color="#a78bfa" />
              <Text style={styles.sliderLabel}>Randomness</Text>
              <Text style={styles.sliderValue}>
                {Math.round(personality.randomness * 100)}%
              </Text>
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
              <Text style={styles.sliderValue}>
                {Math.round(personality.defense * 100)}%
              </Text>
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
            <Text style={styles.sliderHint}>
              How much it protects win streaks
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Live Preview</Text>
          <View style={styles.previewCard}>
            <Text style={styles.previewText}>
              {getPersonalityDescription(personality)}
            </Text>
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
            style={[
              styles.saveButton,
              !hasChanges && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!hasChanges}
          >
            <Save size={20} color="#ffffff" />
            <Text style={styles.saveButtonText}>
              {hasChanges ? 'Save Preset' : 'Saved'}
            </Text>
          </TouchableOpacity>

          {/* ══════════════════════════════════════════════════
              Simulations
              ══════════════════════════════════════════════════ */}
          <Text style={styles.sectionTitle}>Simulations</Text>

          <TouchableOpacity
            style={styles.simulationCard}
            onPress={() =>
              navigation.navigate('Game', { mode: 'pvc', training: true })
            }
          >
            <View
              style={[
                styles.simIcon,
                { backgroundColor: 'rgba(233, 69, 96, 0.15)' },
              ]}
            >
              <Swords size={24} color="#e94560" />
            </View>
            <View style={styles.simContent}>
              <Text style={styles.simTitle}>Sparring Match</Text>
              <Text style={styles.simSubtitle}>
                Quick PVC warm-up • no personality shift
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.simulationCard}
            onPress={() =>
              showAlert('Coming Soon', 'Pattern Drill arrives in the next update')
            }
          >
            <View
              style={[
                styles.simIcon,
                { backgroundColor: 'rgba(79, 172, 254, 0.15)' },
              ]}
            >
              <BarChart3 size={24} color="#4facfe" />
            </View>
            <View style={styles.simContent}>
              <Text style={styles.simTitle}>Pattern Drill</Text>
              <Text style={styles.simSubtitle}>
                Analyze your playstyle • Insights
              </Text>
            </View>
          </TouchableOpacity>
        </ScreenScroll>

        {/* ══════════════════════════════════════════════════
            Pressure duration picker modal
            ══════════════════════════════════════════════════ */}
        <Modal
          visible={pressurePickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setPressurePickerOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>⏱️ Learn Under Pressure</Text>
              <Text style={styles.modalHelper}>
                How long should the match run? Higher score wins when the
                timer hits zero.
              </Text>

              <View style={styles.pressureValueRow}>
                <Text style={styles.pressureValue}>{pressureDuration}s</Text>
              </View>

              <Slider
                style={styles.pressureSlider}
                minimumValue={PRESSURE_MIN_SEC}
                maximumValue={PRESSURE_MAX_SEC}
                step={1}
                value={pressureDuration}
                onValueChange={setPressureDuration}
                minimumTrackTintColor="#fbbf24"
                maximumTrackTintColor="rgba(255,255,255,0.1)"
                thumbTintColor="#fbbf24"
              />

              <View style={styles.pressurePresetRow}>
                {PRESSURE_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.pressurePresetChip,
                      pressureDuration === p &&
                        styles.pressurePresetChipActive,
                    ]}
                    onPress={() => setPressureDuration(p)}
                  >
                    <Text
                      style={[
                        styles.pressurePresetText,
                        pressureDuration === p &&
                          styles.pressurePresetTextActive,
                      ]}
                    >
                      {p}s
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setPressurePickerOpen(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={handleConfirmPressure}
                >
                  <Text style={styles.modalConfirmText}>Start</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ScreenContainer>
  );
}

function MiniPill({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.7 ? '#4ade80' : value <= 0.3 ? '#f87171' : '#8a8a9a';
  return (
    <View style={styles.miniPill}>
      <Text style={styles.miniPillLabel}>{label}</Text>
      <Text style={[styles.miniPillValue, { color: tone }]}>{pct}</Text>
    </View>
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

  trainByPlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitleInline: {
    fontSize: 12,
    fontWeight: '800',
    color: '#a78bfa',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  sectionHelper: {
    fontSize: 12,
    color: '#5a5a7a',
    lineHeight: 17,
    marginBottom: 12,
  },
  avatarList: { gap: 8, marginBottom: 8 },
  trainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  trainRowSelected: {
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  trainRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  trainRowEmoji: { fontSize: 26 },
  trainRowName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  miniPills: { flexDirection: 'row', gap: 6 },
  miniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  miniPillLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#5a5a7a',
    letterSpacing: 0.5,
  },
  miniPillValue: { fontSize: 9, fontWeight: '800' },
  trainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#a78bfa',
  },
  trainBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 20,
  },

  blitzGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  blitzCard: {
    width: '47.5%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.15)',
    gap: 4,
  },
  blitzIcon: { fontSize: 24, marginBottom: 2 },
  blitzName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  blitzTagline: {
    fontSize: 11,
    color: '#8a8a9a',
    lineHeight: 15,
    minHeight: 30,
  },
  blitzEnd: {
    fontSize: 9,
    color: '#fbbf24',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  enduranceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(79, 172, 254, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.25)',
  },
  enduranceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(79, 172, 254, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enduranceTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  enduranceSubtitle: {
    fontSize: 12,
    color: '#8a8a9a',
    marginTop: 4,
    lineHeight: 16,
  },

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
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
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
  previewText: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  presetButtonActive: {
    backgroundColor: 'rgba(233, 69, 96, 0.15)',
    borderColor: '#e94560',
  },
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
  simIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simContent: { flex: 1 },
  simTitle: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  simSubtitle: { fontSize: 12, color: '#5a5a7a', marginTop: 2 },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
  emptyText: {
    fontSize: 14,
    color: '#5a5a7a',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyButton: {
    backgroundColor: '#e94560',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#14141f',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
  },
  modalHelper: {
    fontSize: 12,
    color: '#8a8a9a',
    lineHeight: 17,
    marginBottom: 16,
  },
  pressureValueRow: { alignItems: 'center', marginBottom: 8 },
  pressureValue: {
    fontSize: 40,
    fontWeight: '800',
    color: '#fbbf24',
    letterSpacing: -1,
  },
  pressureSlider: { width: '100%', height: 36, marginBottom: 8 },
  pressurePresetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 18,
  },
  pressurePresetChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  pressurePresetChipActive: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderColor: '#fbbf24',
  },
  pressurePresetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8a8a9a',
  },
  pressurePresetTextActive: { color: '#fbbf24' },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  modalCancelText: { color: '#8a8a9a', fontSize: 14, fontWeight: '700' },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
  },
  modalConfirmText: { color: '#0a0a0f', fontSize: 14, fontWeight: '800' },
});