// src/screens/TrainingResultScreen.tsx
//
// RPS Arena — Chat 11a (AI Training redesign).
//
// Post-match analysis. Handles BOTH:
//   - Sparring Match (Chat 10 first-to-3)
//   - Any of the 10 Blitz variants (Chat 11a)
//
// Reads params:
//   avatarId          — which avatar was trained
//   before            — personality snapshot at match start
//   stats             — win rates, diversity, rounds, scores
//   modeLabel?        — "Sprint" / "Betrayal" / etc.
//   shiftWeight?      — variant-specific weight (Betrayal 1.5×)
//   intensityOverride? — variant-specific intensity (Sprint 0.7×)
//
// Uses the redesigned computeShift from TrainingShift.ts:
//   - small magnitudes (0.015–0.03)
//   - tradeoffs (paired axes)
//   - decay (unused axes drift toward 0.5)
//   - diminishing returns near extremes
//   - ±20% jitter
//   - intensity scaling
//
// Persists via the EXISTING avatarStore.updateAvatarPersonality —
// which writes through the verified updateAvatar socket path.
//
// Constraints honored:
//   - ScreenContainer / ScreenScroll untouched
//   - Full file rewrite
//   - No auth, notification, achievement, Dojo, or server changes

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ChevronLeft,
  RotateCcw,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react-native';
import { useAvatarStore } from '../store/avatarStore';
import {
  AvatarPersonality,
  getPersonalityDescription,
} from '../engine/AvatarEngine';
import {
  computeShift,
  computeShiftWithIntensity,
  ShiftResult,
  MatchStats,
} from '../engine/TrainingShift';
import { startMenuMusic } from '../services/audio';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import PersonalityChart from '../components/PersonalityChart';

interface RouteStats extends MatchStats {
  myScore: number;
  aiScore: number;
  matchWinner: 'player' | 'ai' | 'tie' | null;
}

export default function TrainingResultScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const avatarId: string | undefined = route.params?.avatarId;
  const before: AvatarPersonality | undefined = route.params?.before;
  const stats: RouteStats | undefined = route.params?.stats;
  const modeLabel: string | undefined = route.params?.modeLabel;
  const shiftWeight: number = route.params?.shiftWeight ?? 1.0;
  const intensityOverride: number | undefined =
    route.params?.intensityOverride;

  const { avatars, updateAvatarPersonality } = useAvatarStore();
  const avatar = avatars.find((a) => a.id === avatarId) || null;

  const [persisted, setPersisted] = useState(false);

  // ── Compute the shift exactly once ──
  const shift: ShiftResult = useMemo(() => {
    if (!before || !stats) {
      const fallback: AvatarPersonality =
        avatar?.personality || {
          aggression: 0.5,
          memory: 0.5,
          randomness: 0.5,
          defense: 0.5,
        };
      return {
        before: fallback,
        after: fallback,
        delta: {
          aggression: 0,
          memory: 0,
          randomness: 0,
          defense: 0,
        },
        notes: ['No match data — showing current personality'],
        totalDelta: 0,
        intensity: 1.0,
      };
    }
    // Prefer variant-specific intensity override if provided.
    const base =
      typeof intensityOverride === 'number'
        ? computeShiftWithIntensity(before, stats, intensityOverride)
        : computeShift(before, stats);

    // Apply variant shift weight (multiplies the delta, not the final
    // value). Weight > 1 amplifies, weight < 1 damps.
    if (shiftWeight !== 1.0) {
      const weightedDelta: AvatarPersonality = {
        aggression: base.delta.aggression * shiftWeight,
        memory: base.delta.memory * shiftWeight,
        randomness: base.delta.randomness * shiftWeight,
        defense: base.delta.defense * shiftWeight,
      };
      const reapply = (v: number, d: number) =>
        Math.max(0.05, Math.min(0.95, v + d));
      const afterWeighted: AvatarPersonality = {
        aggression: reapply(before.aggression, weightedDelta.aggression),
        memory: reapply(before.memory, weightedDelta.memory),
        randomness: reapply(before.randomness, weightedDelta.randomness),
        defense: reapply(before.defense, weightedDelta.defense),
      };
      return {
        ...base,
        after: afterWeighted,
        delta: weightedDelta,
        totalDelta:
          Math.abs(weightedDelta.aggression) +
          Math.abs(weightedDelta.memory) +
          Math.abs(weightedDelta.randomness) +
          Math.abs(weightedDelta.defense),
      };
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    startMenuMusic();
  }, []);

  // ── Persist once ──
  useEffect(() => {
    if (persisted) return;
    if (!avatarId) {
      setPersisted(true);
      return;
    }
    if (shift.totalDelta < 0.002) {
      setPersisted(true);
      return;
    }
    updateAvatarPersonality(avatarId, shift.after);
    setPersisted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarId]);

  const handleTrainAgain = () => {
    if (!avatarId) {
      navigation.navigate('Training');
      return;
    }
    // Route back to whichever mode just ran
    const back = route.params?.backToBlitz
      ? 'BlitzMatch'
      : 'TrainingMatch';
    navigation.replace(back, {
      avatarId,
      variant: route.params?.variant,
      durationSec: route.params?.durationSec,
    });
  };

  const handleBackToLab = () => {
    navigation.navigate('Training');
  };

  // ── Guard: no avatar ──
  if (!avatar) {
    return (
      <ScreenContainer>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBackToLab}
              style={styles.headerBtn}
            >
              <ChevronLeft size={24} color="#e94560" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Training Result</Text>
            <View style={styles.headerBtn} />
          </View>
          <View style={styles.center}>
            <Text style={styles.emptyText}>Avatar not found</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={handleBackToLab}
            >
              <Text style={styles.emptyBtnText}>Back to Lab</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ScreenContainer>
    );
  }

  const beforeSafe: AvatarPersonality = before || shift.before;
  const noChange = shift.totalDelta < 0.002;

  // Hero copy varies by mode
  const heroTitle = noChange
    ? 'Balanced match — no strong shift'
    : modeLabel
    ? `${modeLabel} — your AI adapted`
    : 'Your AI learned from this match';

  const heroSubtitle = stats
    ? `${stats.myScore}–${stats.aiScore} · ${stats.roundsPlayed} rounds`
    : 'no match data';

  // Intensity badge copy
  const intensityLabel = (() => {
    const i = shift.intensity;
    if (i < 0.6) return 'Light session';
    if (i < 1.0) return 'Short session';
    if (i < 1.3) return 'Standard session';
    return 'Deep session';
  })();

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBackToLab}
            style={styles.headerBtn}
          >
            <ChevronLeft size={24} color="#e94560" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Training Result</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          {/* ── Hero ── */}
          <View style={styles.heroCard}>
            <View style={styles.heroIconWrap}>
              <Sparkles size={28} color="#a78bfa" />
            </View>
            <Text style={styles.heroTitle}>{heroTitle}</Text>
            <Text style={styles.heroSubtitle}>
              {avatar.name} · {heroSubtitle}
            </Text>
            {modeLabel && (
              <View style={styles.intensityBadge}>
                <Text style={styles.intensityBadgeText}>
                  {intensityLabel}
                </Text>
              </View>
            )}
          </View>

          {/* ── Chart ── */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Personality Shift</Text>
            <Text style={styles.chartLegend}>
              <Text style={styles.legendGhost}>◯ before</Text>
              {'   '}
              <Text style={styles.legendFilled}>● after</Text>
            </Text>
            <PersonalityChart
              values={shift.after}
              compareValues={beforeSafe}
              size={260}
              accent="#a78bfa"
              compareAccent="rgba(255,255,255,0.35)"
            />
          </View>

          {/* ── Weight table ── */}
          <Text style={styles.sectionTitle}>Weight Changes</Text>
          <View style={styles.tableCard}>
            <AxisRow
              label="Aggression"
              color="#e94560"
              beforeVal={beforeSafe.aggression}
              afterVal={shift.after.aggression}
            />
            <AxisRow
              label="Memory"
              color="#4facfe"
              beforeVal={beforeSafe.memory}
              afterVal={shift.after.memory}
            />
            <AxisRow
              label="Randomness"
              color="#a78bfa"
              beforeVal={beforeSafe.randomness}
              afterVal={shift.after.randomness}
            />
            <AxisRow
              label="Defense"
              color="#4ade80"
              beforeVal={beforeSafe.defense}
              afterVal={shift.after.defense}
            />
          </View>

          {/* ── Notes / rules fired ── */}
          <Text style={styles.sectionTitle}>What Your AI Noticed</Text>
          <View style={styles.rulesCard}>
            {shift.notes.map((rule, i) => (
              <View key={i} style={styles.ruleRow}>
                <Text style={styles.ruleBullet}>▸</Text>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </View>

          {/* ── Plain summary ── */}
          <Text style={styles.sectionTitle}>New Personality</Text>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>
              {getPersonalityDescription(shift.after)}
            </Text>
          </View>

          {/* ── Actions ── */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleTrainAgain}
              activeOpacity={0.7}
            >
              <RotateCcw size={18} color="#ffffff" />
              <Text style={styles.primaryBtnText}>Train Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleBackToLab}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryBtnText}>Back to Lab</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.persistNote}>
            {persisted ? '✓ Personality saved to your AI' : 'Saving…'}
          </Text>
        </ScreenScroll>
      </SafeAreaView>
    </ScreenContainer>
  );
}

// ────────────────────────────────────────────────────────────
// AxisRow
// ────────────────────────────────────────────────────────────
function AxisRow({
  label,
  color,
  beforeVal,
  afterVal,
}: {
  label: string;
  color: string;
  beforeVal: number;
  afterVal: number;
}) {
  const delta = afterVal - beforeVal;
  const beforePct = Math.round(beforeVal * 100);
  const afterPct = Math.round(afterVal * 100);
  const deltaPct = Math.round(Math.abs(delta) * 100);

  const showDelta = Math.abs(delta) >= 0.005;
  const isUp = delta > 0;

  return (
    <View style={styles.axisRow}>
      <View style={[styles.axisDot, { backgroundColor: color }]} />
      <Text style={styles.axisLabel}>{label}</Text>
      <View style={styles.axisValues}>
        <Text style={styles.axisBefore}>{beforePct}</Text>
        <Text style={styles.axisArrow}>→</Text>
        <Text style={[styles.axisAfter, { color }]}>{afterPct}</Text>
        {showDelta ? (
          <View
            style={[
              styles.deltaBadge,
              {
                backgroundColor: isUp
                  ? 'rgba(74, 222, 128, 0.12)'
                  : 'rgba(248, 113, 113, 0.12)',
              },
            ]}
          >
            {isUp ? (
              <ArrowUp size={10} color="#4ade80" />
            ) : (
              <ArrowDown size={10} color="#f87171" />
            )}
            <Text
              style={[
                styles.deltaText,
                { color: isUp ? '#4ade80' : '#f87171' },
              ]}
            >
              {deltaPct}
            </Text>
          </View>
        ) : (
          <View style={styles.deltaBadgeNeutral}>
            <Minus size={10} color="#5a5a7a" />
          </View>
        )}
      </View>
    </View>
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
  headerBtn: { padding: 6, width: 32 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 60 },

  heroCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(167, 139, 250, 0.10)',
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.25)',
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(167, 139, 250, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#a78bfa',
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '600',
  },
  intensityBadge: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(167, 139, 250, 0.20)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
  },
  intensityBadgeText: {
    fontSize: 10,
    color: '#c0c0d0',
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  chartCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  chartTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8a8a9a',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  chartLegend: {
    fontSize: 10,
    color: '#5a5a7a',
    marginBottom: 12,
    fontWeight: '600',
  },
  legendGhost: { color: 'rgba(255,255,255,0.55)' },
  legendFilled: { color: '#a78bfa' },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5a5a7a',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 4,
    marginBottom: 10,
  },

  tableCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    paddingVertical: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  axisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  axisDot: { width: 8, height: 8, borderRadius: 4 },
  axisLabel: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  axisValues: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  axisBefore: {
    fontSize: 13,
    color: '#5a5a7a',
    fontWeight: '700',
    width: 28,
    textAlign: 'right',
  },
  axisArrow: { fontSize: 11, color: '#3a3a4a' },
  axisAfter: { fontSize: 14, fontWeight: '800', width: 28 },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 34,
    justifyContent: 'center',
  },
  deltaBadgeNeutral: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deltaText: { fontSize: 10, fontWeight: '800' },

  rulesCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    gap: 8,
  },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  ruleBullet: { fontSize: 12, color: '#a78bfa', marginTop: 1 },
  ruleText: {
    flex: 1,
    fontSize: 13,
    color: '#c0c0d0',
    lineHeight: 18,
  },

  summaryCard: {
    backgroundColor: 'rgba(233, 69, 96, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.2)',
  },
  summaryText: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 20,
    fontStyle: 'italic',
  },

  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#a78bfa',
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 14,
    borderRadius: 12,
  },
  secondaryBtnText: { color: '#c0c0d0', fontSize: 15, fontWeight: '700' },

  persistNote: {
    fontSize: 11,
    color: '#5a5a7a',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 6,
  },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: '#5a5a7a' },
  emptyBtn: {
    backgroundColor: '#a78bfa',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
});