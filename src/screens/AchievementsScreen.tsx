// src/screens/AchievementsScreen.tsx
//
// RPS Arena — AchievementsScreen (Chat 7, roadmap item #4).
//
// Full 25-badge grid, grouped by category. Locked badges are dimmed
// (grey icon, muted text); unlocked badges are full-colour with the
// icon and the unlock date.
//
// Header shows "X / 25 unlocked" plus a progress bar.
//
// Data comes from achievementStore (catalog + unlockedIds). Both are
// pulled from the server on mount; the catalog is a one-time fetch,
// unlocks refresh every focus.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, RefreshCw } from 'lucide-react-native';

import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import { useAchievementStore } from '../store/achievementStore';
import { AchievementCatalogEntry } from '../services/multiplayer';
import { startMenuMusic } from '../services/audio';

// Order the categories the way the task lists them. Any catalog entry
// with an unknown category falls into "Other" at the end.
const CATEGORY_ORDER: { key: string; label: string }[] = [
  { key: 'progression', label: 'Progression' },
  { key: 'streaks', label: 'Streaks' },
  { key: 'mode', label: 'Mode Mastery' },
  { key: 'dojo', label: 'Dojo Specials' },
  { key: 'volume', label: 'Volume' },
  { key: 'social', label: 'Social' },
];

function formatUnlockedAt(ts: number): string {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function AchievementsScreen() {
  const navigation = useNavigation<any>();

  const {
    catalog,
    unlockedIds,
    catalogLoaded,
    unlockedLoaded,
    loadCatalog,
    loadUnlocked,
  } = useAchievementStore();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    startMenuMusic();
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadCatalog(), loadUnlocked()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadCatalog, loadUnlocked]);

  // Initial load.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch unlocks on focus (e.g. after a match that just unlocked one).
  useFocusEffect(
    useCallback(() => {
      loadUnlocked();
    }, [loadUnlocked])
  );

  const total = catalog.length || 25;
  const unlockedCount = catalog.length
    ? catalog.reduce((n, a) => (unlockedIds[a.id] ? n + 1 : n), 0)
    : Object.keys(unlockedIds).length;
  const progress = total > 0 ? unlockedCount / total : 0;

  const showLoading = !catalogLoaded && !refreshing;

  // Bucket catalog entries by category, preserving catalog order within
  // each bucket.
  const grouped: Record<string, AchievementCatalogEntry[]> = {};
  for (const entry of catalog) {
    const key = entry.category || 'other';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  }

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* ─── HEADER ─── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ChevronLeft size={26} color="#e94560" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Achievements</Text>
          <TouchableOpacity
            style={styles.refreshIconButton}
            onPress={refresh}
            disabled={refreshing}
          >
            <RefreshCw
              size={18}
              color={refreshing ? '#3a3a4a' : '#8a8a9a'}
            />
          </TouchableOpacity>
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={120}>
          {/* ─── SUMMARY ─── */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Unlocked</Text>
            <Text style={styles.summaryValue}>
              {unlockedCount}
              <Text style={styles.summaryTotal}> / {total}</Text>
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(progress * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.summaryHint}>
              {unlockedCount === total
                ? 'All achievements unlocked 🎉'
                : `${total - unlockedCount} remaining`}
            </Text>
          </View>

          {/* ─── LIST ─── */}
          {showLoading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color="#e94560" />
              <Text style={styles.loadingText}>Loading achievements…</Text>
            </View>
          ) : catalog.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyEmoji}>🏆</Text>
              <Text style={styles.emptyTitle}>No achievements loaded</Text>
              <Text style={styles.emptyText}>
                Check your connection and pull to refresh.
              </Text>
            </View>
          ) : (
            <>
              {CATEGORY_ORDER.map((cat) => {
                const entries = grouped[cat.key];
                if (!entries || entries.length === 0) return null;
                return (
                  <View key={cat.key} style={styles.categoryBlock}>
                    <Text style={styles.categoryLabel}>{cat.label}</Text>
                    {entries.map((entry) => (
                      <AchievementRow
                        key={entry.id}
                        entry={entry}
                        unlockedAt={unlockedIds[entry.id]}
                      />
                    ))}
                  </View>
                );
              })}

              {/* Catch-all for any category not in CATEGORY_ORDER. */}
              {Object.keys(grouped)
                .filter((k) => !CATEGORY_ORDER.some((c) => c.key === k))
                .map((k) => (
                  <View key={k} style={styles.categoryBlock}>
                    <Text style={styles.categoryLabel}>
                      {k.charAt(0).toUpperCase() + k.slice(1)}
                    </Text>
                    {grouped[k].map((entry) => (
                      <AchievementRow
                        key={entry.id}
                        entry={entry}
                        unlockedAt={unlockedIds[entry.id]}
                      />
                    ))}
                  </View>
                ))}
            </>
          )}
        </ScreenScroll>
      </SafeAreaView>
    </ScreenContainer>
  );
}

function AchievementRow({
  entry,
  unlockedAt,
}: {
  entry: AchievementCatalogEntry;
  unlockedAt?: number;
}) {
  const unlocked = typeof unlockedAt === 'number' && unlockedAt > 0;

  return (
    <View
      style={[styles.row, unlocked ? styles.rowUnlocked : styles.rowLocked]}
    >
      <View
        style={[
          styles.iconWrap,
          unlocked ? styles.iconWrapUnlocked : styles.iconWrapLocked,
        ]}
      >
        <Text style={[styles.icon, !unlocked && styles.iconLocked]}>
          {entry.icon || '🏆'}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.rowName,
            !unlocked && styles.rowNameLocked,
          ]}
          numberOfLines={1}
        >
          {entry.name}
        </Text>
        <Text
          style={[
            styles.rowDescription,
            !unlocked && styles.rowDescriptionLocked,
          ]}
          numberOfLines={2}
        >
          {entry.description}
        </Text>
        {unlocked && unlockedAt ? (
          <Text style={styles.rowDate}>
            Unlocked {formatUnlockedAt(unlockedAt)}
          </Text>
        ) : null}
      </View>

      {unlocked ? (
        <Text style={styles.checkmark}>✓</Text>
      ) : (
        <Text style={styles.lockEmoji}>🔒</Text>
      )}
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
  refreshIconButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 60,
  },

  // Summary card
  summaryCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(233,69,96,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(233,69,96,0.2)',
    marginBottom: 18,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#e94560',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryValue: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 4,
  },
  summaryTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8a8a9a',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e94560',
  },
  summaryHint: {
    fontSize: 11,
    color: '#8a8a9a',
    marginTop: 8,
  },

  // Category block
  categoryBlock: { marginBottom: 18 },
  categoryLabel: {
    fontSize: 12,
    color: '#5a5a7a',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Achievement row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  rowUnlocked: {
    backgroundColor: 'rgba(74,222,128,0.06)',
    borderColor: 'rgba(74,222,128,0.25)',
  },
  rowLocked: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(255,255,255,0.04)',
  },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUnlocked: { backgroundColor: 'rgba(74,222,128,0.12)' },
  iconWrapLocked: { backgroundColor: 'rgba(255,255,255,0.03)' },
  icon: { fontSize: 26 },
  iconLocked: { opacity: 0.25 },

  rowName: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  rowNameLocked: { color: '#5a5a7a' },
  rowDescription: { fontSize: 12, color: '#a8a8b8', marginTop: 2 },
  rowDescriptionLocked: { color: '#3a3a4a' },
  rowDate: { fontSize: 10, color: '#4ade80', marginTop: 4, fontWeight: '600' },

  checkmark: { fontSize: 18, color: '#4ade80', fontWeight: '800' },
  lockEmoji: { fontSize: 16, opacity: 0.4 },

  // Loading / empty
  loadingBlock: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  loadingText: { fontSize: 12, color: '#5a5a7a' },
  emptyBlock: { alignItems: 'center', paddingVertical: 50 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  emptyText: { fontSize: 13, color: '#5a5a7a' },
});