import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useNavigation,
  useFocusEffect,
  useRoute,
} from '@react-navigation/native';
import {
  ChevronLeft,
  Plus,
  Trash2,
  BarChart3,
  History as HistoryIcon,
  Bot,
  Trophy,
  RefreshCw,
  Award,
  ChevronRight,
} from 'lucide-react-native';

import { useAvatarStore } from '../store/avatarStore';
import { useUserStore } from '../store/userStore';
import { getRatingTier } from '../engine/AvatarEngine';
import { startMenuMusic } from '../services/audio';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import { showAlert } from '../utils/alert';
import { useAchievementStore } from '../store/achievementStore';
import MatchDetailModal from '../components/MatchDetailModal';

import {
  getPlayerStatsFromServer,
  getMatchHistoryFromServer,
  getLeaderboardFromServer,
  onPlayerStatsUpdate,
  PlayerStats,
  EMPTY_PLAYER_STATS,
  MatchRecord as ServerMatchRecord,
  Leaderboard,
  LeaderboardEntry,
  EMPTY_LEADERBOARD,
} from '../services/multiplayer';

import StatCard from '../components/StatCard';
import MatchHistoryRow from '../components/MatchHistoryRow';
import LeaderboardRow from '../components/LeaderboardRow';

type TabKey = 'stats' | 'history' | 'avatars' | 'leaderboard' | 'achievements';
type LeaderboardSubTab = 'wins' | 'winRate' | 'streak';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'stats', label: 'Stats' },
  { key: 'history', label: 'History' },
  { key: 'avatars', label: 'Avatars' },
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'achievements', label: 'Awards' },
];

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // Feature A (Chat 8) — HomeStatsCard navigates here with
  // { initialTab: 'stats' }. Default remains 'stats' so existing
  // navigation (from anywhere else) is unchanged.
  const initialTab: TabKey =
    route?.params?.initialTab &&
    TABS.some((t) => t.key === route.params.initialTab)
      ? (route.params.initialTab as TabKey)
      : 'stats';

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // If the screen is already mounted and something re-navigates with a new
  // initialTab param, honor it. No-op when the param is absent (the common
  // case for back-navigation).
  useEffect(() => {
    const p = route?.params?.initialTab;
    if (p && TABS.some((t) => t.key === p)) {
      setActiveTab(p as TabKey);
    }
  }, [route?.params?.initialTab]);

  useEffect(() => {
    startMenuMusic();
  }, []);

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
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        {/* ─── TAB BAR ─── */}
        <View style={styles.tabBar}>
          {TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setActiveTab(t.key)}
                style={[styles.tabPill, active && styles.tabPillActive]}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.tabPillText, active && styles.tabPillTextActive]}
                  numberOfLines={1}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── TAB CONTENT ─── */}
        {activeTab === 'stats' && <StatsTab />}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'avatars' && <AvatarsTab />}
        {activeTab === 'leaderboard' && <LeaderboardTab />}
        {activeTab === 'achievements' && <AchievementsTab />}
      </SafeAreaView>
    </ScreenContainer>
  );
}

/* ============================================================
 * TAB 1 — STATS
 * ============================================================ */
function StatsTab() {
  const { identity, loaded: userLoaded } = useUserStore();
  const { getSelectedAvatar, loaded: avatarLoaded } = useAvatarStore();

  const [stats, setStats] = useState<PlayerStats>({ ...EMPTY_PLAYER_STATS });
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setRefreshing(true);
    try {
      const s = await getPlayerStatsFromServer();
      setStats(s);
    } catch {
      // service never rejects, but be defensive
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
    }
  }, []);

  // Initial fetch + focus refetch (covers reconnect cases where
  // onPlayerStatsUpdate's socket was null at subscribe time).
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  // Live push subscription.
  useEffect(() => {
    const unsub = onPlayerStatsUpdate((s) => {
      if (s) setStats(s);
    });
    return unsub;
  }, []);

  const avatar = getSelectedAvatar();
  const tier = avatar ? getRatingTier(avatar.rating) : null;

  const winRate =
    stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : null;

  const showHeader = userLoaded && avatarLoaded;

  return (
    <ScreenScroll contentStyle={styles.scrollContent} headerHeight={120}>
      {/* Identity header */}
      {showHeader && (
        <View style={styles.identityRow}>
          <View style={styles.identityAvatarWrap}>
            {avatar?.image?.type === 'custom' ? (
              <Image
                source={{ uri: avatar.image.value }}
                style={styles.identityAvatarImage}
              />
            ) : (
              <Text style={styles.identityAvatarEmoji}>
                {avatar?.emoji || '🤖'}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.identityName} numberOfLines={1}>
              {identity?.username || 'Guest'}
            </Text>
            {avatar ? (
              <Text style={[styles.identityTier, { color: tier?.color }]}>
                {tier?.emoji} {tier?.name} • {avatar.name}
              </Text>
            ) : (
              <Text style={styles.identityTierMuted}>No avatar selected</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.refreshIconButton}
            onPress={fetchStats}
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              color={refreshing ? '#3a3a4a' : '#8a8a9a'}
            />
          </TouchableOpacity>
        </View>
      )}

      {initialLoading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color="#e94560" />
          <Text style={styles.loadingText}>Loading stats…</Text>
        </View>
      ) : (
        <>
          {/* Big tiles */}
          <View style={styles.statGrid}>
            <StatCard
              label="Wins"
              value={stats.wins}
              accent="#4ade80"
            />
            <StatCard
              label="Losses"
              value={stats.losses}
              accent="#f87171"
            />
            <StatCard
              label="Win Rate"
              value={winRate === null ? '—' : `${winRate}%`}
              accent="#4facfe"
            />
            <StatCard
              label="Best Streak"
              value={stats.bestStreak}
              accent="#fbbf24"
            />
          </View>

          {/* Current streak */}
          <View style={styles.streakCard}>
            <Text style={styles.streakCardLabel}>Current Streak</Text>
            <Text style={styles.streakCardValue}>
              {stats.currentStreak}
              {stats.currentStreak >= 3 ? ' 🔥' : ''}
            </Text>
            <Text style={styles.streakCardHint}>
              {stats.currentStreak === 0
                ? 'Win a match to start a streak'
                : stats.currentStreak >= 3
                ? 'On fire!'
                : 'Keep it going'}
            </Text>
          </View>

          {/* Per-mode breakdown */}
          <Text style={styles.sectionLabel}>By Mode</Text>

          <ModeBreakdownCard
            title="Human vs Human"
            accent="#4facfe"
            wins={stats.humanWins}
            losses={stats.humanLosses}
            ties={stats.humanTies}
          />
          <ModeBreakdownCard
            title="Avatar Arena"
            accent="#a78bfa"
            wins={stats.avatarWins}
            losses={stats.avatarLosses}
            ties={stats.avatarTies}
          />
          <ModeBreakdownCard
            title="AI Dojo"
            accent="#fbbf24"
            wins={stats.dojoWins}
            losses={stats.dojoLosses}
            ties={stats.dojoTies}
          />

          {/* Totals footnote */}
          <Text style={styles.footnote}>
            {stats.total} total matches • {stats.ties} ties
          </Text>
        </>
      )}
    </ScreenScroll>
  );
}

function ModeBreakdownCard({
  title,
  accent,
  wins,
  losses,
  ties,
}: {
  title: string;
  accent: string;
  wins: number;
  losses: number;
  ties: number;
}) {
  const total = wins + losses + ties;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null;
  return (
    <View style={styles.modeCard}>
      <View style={[styles.modeAccent, { backgroundColor: accent }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.modeTitle}>{title}</Text>
        <Text style={styles.modeLine}>
          <Text style={{ color: '#4ade80', fontWeight: '700' }}>{wins}W</Text>
          {'  '}
          <Text style={{ color: '#f87171', fontWeight: '700' }}>{losses}L</Text>
          {'  '}
          <Text style={{ color: '#fbbf24', fontWeight: '700' }}>{ties}T</Text>
        </Text>
      </View>
      <Text style={[styles.modeWinRate, { color: accent }]}>
        {winRate === null ? '—' : `${winRate}%`}
      </Text>
    </View>
  );
}

/* ============================================================
 * TAB 2 — HISTORY
 *
 * Feature B (Chat 8): each row is now wrapped in a TouchableOpacity
 * that opens MatchDetailModal with the tapped record.
 * ============================================================ */
function HistoryTab() {
  const [matches, setMatches] = useState<ServerMatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedMatch, setSelectedMatch] = useState<ServerMatchRecord | null>(
    null
  );

  const fetchHistory = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await getMatchHistoryFromServer();
      setMatches(Array.isArray(list) ? list.slice(0, 20) : []);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  const openDetail = (m: ServerMatchRecord) => setSelectedMatch(m);
  const closeDetail = () => setSelectedMatch(null);

  return (
    <>
      <ScreenScroll contentStyle={styles.scrollContent} headerHeight={120}>
        <View style={styles.tabSectionHeader}>
          <Text style={styles.tabSectionTitle}>Recent Matches</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={fetchHistory}
            disabled={refreshing}
            activeOpacity={0.8}
          >
            <RefreshCw
              size={14}
              color={refreshing ? '#3a3a4a' : '#8a8a9a'}
            />
            <Text style={styles.refreshButtonText}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color="#e94560" />
            <Text style={styles.loadingText}>Loading history…</Text>
          </View>
        ) : matches.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyEmoji}>📜</Text>
            <Text style={styles.emptyTitle}>No matches yet</Text>
            <Text style={styles.emptyText}>Play one!</Text>
          </View>
        ) : (
          matches.map((m, idx) => (
            <TouchableOpacity
              key={`${m.timestamp}-${idx}`}
              onPress={() => openDetail(m)}
              activeOpacity={0.75}
            >
              <MatchHistoryRow match={m} />
            </TouchableOpacity>
          ))
        )}
      </ScreenScroll>

      <MatchDetailModal
        visible={selectedMatch !== null}
        match={selectedMatch}
        onClose={closeDetail}
      />
    </>
  );
}

/* ============================================================
 * TAB 3 — AVATARS  (preserved from previous ProfileScreen)
 * ============================================================ */
function AvatarsTab() {
  const navigation = useNavigation<any>();
  const {
    avatars,
    selectedAvatarId,
    createNewAvatar,
    selectAvatar,
    deleteAvatar,
  } = useAvatarStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreateAvatar = () => {
    if (!newName.trim()) {
      showAlert('Error', 'Please enter a name');
      return;
    }
    createNewAvatar(newName.trim());
    setNewName('');
    setShowCreate(false);
  };

  const handleDeleteAvatar = (id: string) => {
    showAlert('Delete Avatar', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteAvatar(id),
      },
    ]);
  };

  return (
    <>
      <ScreenScroll contentStyle={styles.scrollContent} headerHeight={120}>
        <View style={styles.tabSectionHeader}>
          <Text style={styles.tabSectionTitle}>My Avatars</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => setShowCreate(true)}
            activeOpacity={0.8}
          >
            <Plus size={14} color="#e94560" />
            <Text style={[styles.refreshButtonText, { color: '#e94560' }]}>
              New
            </Text>
          </TouchableOpacity>
        </View>

        {avatars.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyEmoji}>🤖</Text>
            <Text style={styles.emptyTitle}>No Avatars Yet</Text>
            <Text style={styles.emptyText}>Create your first AI champion</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => setShowCreate(true)}
            >
              <Text style={styles.createButtonText}>Create Avatar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          avatars.map((avatar) => {
            const tier = getRatingTier(avatar.rating);
            return (
              <TouchableOpacity
                key={avatar.id}
                style={[
                  styles.avatarCard,
                  selectedAvatarId === avatar.id && styles.avatarCardSelected,
                ]}
                onPress={() => selectAvatar(avatar.id)}
              >
                <View style={styles.avatarInfo}>
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate('AvatarImage', {
                        avatarId: avatar.id,
                      })
                    }
                    style={styles.avatarImageWrap}
                  >
                    {avatar.image?.type === 'custom' ? (
                      <Image
                        source={{ uri: avatar.image.value }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
                    )}
                    <View style={styles.avatarEditBadge}>
                      <Text style={styles.avatarEditIcon}>✎</Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.avatarDetails}>
                    <Text style={styles.avatarName}>{avatar.name}</Text>
                    <Text style={styles.avatarStats}>
                      Level {avatar.level} • {avatar.wins}W {avatar.losses}L{' '}
                      {avatar.ties}T
                    </Text>
                    <Text style={[styles.avatarRating, { color: tier.color }]}>
                      {tier.emoji} {tier.name} • {avatar.rating}
                    </Text>
                    {avatar.bestStreak >= 3 && (
                      <Text style={styles.avatarStreak}>
                        🔥 Best: {avatar.bestStreak}W streak
                      </Text>
                    )}
                  </View>
                </View>
                {selectedAvatarId === avatar.id && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedText}>Selected</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteAvatar(avatar.id)}
                >
                  <Trash2 size={20} color="#f87171" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </ScreenScroll>

      {showCreate && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Avatar</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter avatar name"
              placeholderTextColor="#5a5a7a"
              value={newName}
              onChangeText={setNewName}
              autoFocus
              maxLength={15}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowCreate(false);
                  setNewName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleCreateAvatar}
              >
                <Text style={styles.confirmButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

/* ============================================================
 * TAB 4 — LEADERBOARD
 * ============================================================ */
function LeaderboardTab() {
  const { identity } = useUserStore();
  const [board, setBoard] = useState<Leaderboard>({ ...EMPTY_LEADERBOARD });
  const [subTab, setSubTab] = useState<LeaderboardSubTab>('wins');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    setRefreshing(true);
    try {
      const b = await getLeaderboardFromServer();
      setBoard({
        topByWins: b?.topByWins || [],
        topByWinRate: b?.topByWinRate || [],
        topByStreak: b?.topByStreak || [],
      });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useFocusEffect(
    useCallback(() => {
      fetchLeaderboard();
    }, [fetchLeaderboard])
  );

  const myUserId = identity?.userId;

  const rows: LeaderboardEntry[] = useMemo(() => {
    const list =
      subTab === 'wins'
        ? board.topByWins
        : subTab === 'winRate'
        ? board.topByWinRate
        : board.topByStreak;
    return (list || []).slice(0, 20);
  }, [board, subTab]);

  return (
    <ScreenScroll contentStyle={styles.scrollContent} headerHeight={120}>
      {/* Sub-tabs */}
      <View style={styles.subTabBar}>
        {(
          [
            { key: 'wins', label: 'Wins' },
            { key: 'winRate', label: 'Win Rate' },
            { key: 'streak', label: 'Streak' },
          ] as { key: LeaderboardSubTab; label: string }[]
        ).map((s) => {
          const active = subTab === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              onPress={() => setSubTab(s.key)}
              style={[styles.subTab, active && styles.subTabActive]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.subTabText,
                  active && styles.subTabTextActive,
                ]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.tabSectionHeader}>
        <Text style={styles.tabSectionTitle}>
          Top {subTab === 'wins' ? 'by Wins' : subTab === 'winRate' ? 'by Win Rate' : 'by Streak'}
        </Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={fetchLeaderboard}
          disabled={refreshing}
          activeOpacity={0.8}
        >
          <RefreshCw
            size={14}
            color={refreshing ? '#3a3a4a' : '#8a8a9a'}
          />
          <Text style={styles.refreshButtonText}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color="#e94560" />
          <Text style={styles.loadingText}>Loading leaderboard…</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyEmoji}>🏆</Text>
          <Text style={styles.emptyTitle}>Leaderboard is empty</Text>
          <Text style={styles.emptyText}>
            Play matches to appear here
          </Text>
        </View>
      ) : (
        rows.map((entry, idx) => (
          <LeaderboardRow
            key={`${entry.userId}-${idx}`}
            rank={idx + 1}
            entry={entry}
            subTab={subTab}
            isMe={!!myUserId && entry.userId === myUserId}
          />
        ))
      )}
    </ScreenScroll>
  );
}

/* ============================================================
 * TAB 5 — ACHIEVEMENTS
 *
 * Compact summary of progress toward the 25 achievements. The full
 * badge grid lives on AchievementsScreen (registered in AppNavigator);
 * this tab shows the count, a progress bar, the most recent unlocks,
 * and a "View All Achievements" button that navigates there.
 * ============================================================ */
function AchievementsTab() {
  const navigation = useNavigation<any>();
  const {
    catalog,
    unlockedIds,
    catalogLoaded,
    loadCatalog,
    loadUnlocked,
  } = useAchievementStore();

  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadCatalog(), loadUnlocked()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadCatalog, loadUnlocked]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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

  // Most recent unlocks, newest first.
  const recentUnlocks = useMemo(() => {
    if (!catalog.length) return [];
    return catalog
      .filter((a) => !!unlockedIds[a.id])
      .sort((a, b) => (unlockedIds[b.id] || 0) - (unlockedIds[a.id] || 0))
      .slice(0, 3);
  }, [catalog, unlockedIds]);

  return (
    <ScreenScroll contentStyle={styles.scrollContent} headerHeight={120}>
      {/* Progress card */}
      <View style={styles.achievementsCard}>
        <View style={styles.achievementsCardHeader}>
          <Award size={20} color="#e94560" />
          <Text style={styles.achievementsCardLabel}>Progress</Text>
          <TouchableOpacity
            style={styles.refreshIconButton}
            onPress={fetchAll}
            disabled={refreshing}
          >
            <RefreshCw
              size={14}
              color={refreshing ? '#3a3a4a' : '#8a8a9a'}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.achievementsCount}>
          {unlockedCount}
          <Text style={styles.achievementsCountTotal}> / {total}</Text>
        </Text>

        <View style={styles.achievementsProgressTrack}>
          <View
            style={[
              styles.achievementsProgressFill,
              { width: `${Math.round(progress * 100)}%` },
            ]}
          />
        </View>

        <Text style={styles.achievementsHint}>
          {!catalogLoaded
            ? 'Loading…'
            : unlockedCount === 0
            ? 'Win your first match to unlock your first badge'
            : unlockedCount === total
            ? 'All achievements unlocked 🎉'
            : `${total - unlockedCount} remaining`}
        </Text>
      </View>

      {/* Recent unlocks */}
      {recentUnlocks.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Recent Unlocks</Text>
          {recentUnlocks.map((a) => (
            <View key={a.id} style={styles.recentUnlockRow}>
              <Text style={styles.recentUnlockIcon}>{a.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.recentUnlockName} numberOfLines={1}>
                  {a.name}
                </Text>
                <Text style={styles.recentUnlockDesc} numberOfLines={1}>
                  {a.description}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* View all button */}
      <TouchableOpacity
        style={styles.viewAllButton}
        onPress={() => navigation.navigate('Achievements')}
        activeOpacity={0.8}
      >
        <Text style={styles.viewAllButtonText}>View All Achievements</Text>
        <ChevronRight size={18} color="#ffffff" />
      </TouchableOpacity>
    </ScreenScroll>
  );
}

/* ============================================================
 * STYLES
 * ============================================================ */
const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  // Header
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
  headerPlaceholder: { width: 38 },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 6,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillActive: {
    backgroundColor: 'rgba(233,69,96,0.12)',
    borderColor: 'rgba(233,69,96,0.5)',
  },
  tabPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8a8a9a',
  },
  tabPillTextActive: { color: '#e94560' },

  // Scroll content
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 60,
  },

  // Identity header (Stats tab)
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(167,139,250,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.18)',
  },
  identityAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityAvatarImage: { width: 44, height: 44, borderRadius: 22 },
  identityAvatarEmoji: { fontSize: 34 },
  identityName: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  identityTier: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  identityTierMuted: { fontSize: 11, color: '#5a5a7a', marginTop: 2 },
  refreshIconButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  // Stat grid
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },

  // Streak card
  streakCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.2)',
    marginBottom: 18,
  },
  streakCardLabel: {
    fontSize: 11,
    color: '#fbbf24',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  streakCardValue: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 4,
  },
  streakCardHint: {
    fontSize: 11,
    color: '#8a8a9a',
    marginTop: 4,
  },

  // Section label
  sectionLabel: {
    fontSize: 12,
    color: '#5a5a7a',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Mode breakdown
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 10,
    gap: 12,
  },
  modeAccent: { width: 4, height: 36, borderRadius: 2 },
  modeTitle: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  modeLine: { fontSize: 12, color: '#8a8a9a', marginTop: 4 },
  modeWinRate: { fontSize: 15, fontWeight: '800' },

  // Footnote
  footnote: {
    textAlign: 'center',
    fontSize: 11,
    color: '#5a5a7a',
    marginTop: 14,
  },

  // Tab section headers (used by History / Avatars / Leaderboard)
  tabSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tabSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  refreshButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8a8a9a',
  },

  // Loading / empty
  loadingBlock: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  loadingText: { fontSize: 12, color: '#5a5a7a' },
  emptyBlock: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#5a5a7a', marginBottom: 18 },

  // Avatars tab (preserved from old ProfileScreen)
  createButton: {
    backgroundColor: '#e94560',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarCardSelected: {
    borderColor: '#e94560',
    backgroundColor: 'rgba(233, 69, 96, 0.05)',
  },
  avatarInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  avatarImageWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  avatarEmoji: { fontSize: 40 },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#e94560',
    borderRadius: 8,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditIcon: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  avatarDetails: { flex: 1 },
  avatarName: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  avatarStats: { fontSize: 12, color: '#5a5a7a', marginTop: 2 },
  avatarRating: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  avatarStreak: {
    fontSize: 11,
    color: '#fbbf24',
    fontWeight: '700',
    marginTop: 2,
  },
  selectedBadge: {
    backgroundColor: '#e94560',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  selectedText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  deleteButton: { padding: 8 },

  // Create-avatar modal (preserved)
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#14141e',
    borderRadius: 24,
    padding: 24,
    width: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalButton: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: 'rgba(255,255,255,0.05)' },
  confirmButton: { backgroundColor: '#e94560' },
  cancelButtonText: { color: '#5a5a7a', fontSize: 16, fontWeight: '600' },
  confirmButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },

  // Leaderboard sub-tabs
  subTabBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  subTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  subTabActive: {
    backgroundColor: 'rgba(79,172,254,0.12)',
    borderColor: 'rgba(79,172,254,0.5)',
  },
  subTabText: { fontSize: 11, fontWeight: '700', color: '#8a8a9a' },
  subTabTextActive: { color: '#4facfe' },

  // ─── Achievements tab (Chat 7) ───
  achievementsCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(233,69,96,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(233,69,96,0.2)',
    marginBottom: 18,
  },
  achievementsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  achievementsCardLabel: {
    flex: 1,
    fontSize: 11,
    color: '#e94560',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  achievementsCount: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 8,
  },
  achievementsCountTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8a8a9a',
  },
  achievementsProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 12,
    overflow: 'hidden',
  },
  achievementsProgressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e94560',
  },
  achievementsHint: {
    fontSize: 11,
    color: '#8a8a9a',
    marginTop: 8,
  },
  recentUnlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(74,222,128,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.25)',
    marginBottom: 8,
    gap: 12,
  },
  recentUnlockIcon: { fontSize: 26 },
  recentUnlockName: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  recentUnlockDesc: { fontSize: 12, color: '#a8a8b8', marginTop: 2 },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#e94560',
    marginTop: 16,
  },
  viewAllButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});