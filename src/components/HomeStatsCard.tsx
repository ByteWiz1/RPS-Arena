import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ChevronRight, TrendingUp } from 'lucide-react-native';

import {
  getPlayerStatsFromServer,
  onPlayerStatsUpdate,
  PlayerStats,
  EMPTY_PLAYER_STATS,
} from '../services/multiplayer';

interface Props {
  /** Optional accent color for the card border/glow. Defaults to violet. */
  accent?: string;
}

/**
 * HomeStatsCard — Feature A (Chat 8)
 *
 * Compact 4-tile stats card for HomeScreen sourced from the server-side
 * playerStats via getPlayerStatsFromServer() + onPlayerStatsUpdate().
 *
 * Tiles: Wins | Win Rate | Streak | Best Streak
 * Tap → Profile → Stats tab (via route param `initialTab: 'stats'`).
 * Empty state (total === 0): "No matches yet — play one!" + Play button.
 *
 * Notes:
 * - getPlayerStatsFromServer() never rejects; on timeout/offline it resolves
 *   EMPTY_PLAYER_STATS. So "empty" is stats.total === 0, not an error path.
 * - onPlayerStatsUpdate() returns a no-op unsubscribe if the socket was null
 *   at subscribe time. We mirror ProfileScreen's pattern: subscribe on mount
 *   AND refetch on focus, so a reconnect during app life still refreshes.
 */
export default function HomeStatsCard({ accent = '#a78bfa' }: Props) {
  const navigation = useNavigation<any>();

  const [stats, setStats] = useState<PlayerStats>({ ...EMPTY_PLAYER_STATS });
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const s = await getPlayerStatsFromServer();
      setStats(s);
    } catch {
      // service never rejects, but be defensive
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  useEffect(() => {
    const unsub = onPlayerStatsUpdate((s) => {
      if (s) setStats(s);
    });
    return unsub;
  }, []);

  const goToStats = () => {
    navigation.navigate('Profile', { initialTab: 'stats' });
  };

  const goToPlay = () => {
    navigation.navigate('ChooseOpponent');
  };

  const winRate =
    stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : null;

  const isEmpty = !initialLoading && stats.total === 0;

  return (
    <View style={[styles.card, { borderColor: accent + '33' }]}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <TrendingUp size={14} color={accent} />
          <Text style={styles.headerLabel}>Your Stats</Text>
        </View>
        <TouchableOpacity
          onPress={goToStats}
          style={styles.headerLink}
          activeOpacity={0.7}
        >
          <Text style={[styles.headerLinkText, { color: accent }]}>
            View full stats
          </Text>
          <ChevronRight size={13} color={accent} />
        </TouchableOpacity>
      </View>

      {initialLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={accent} size="small" />
          <Text style={styles.loadingText}>Loading stats…</Text>
        </View>
      ) : isEmpty ? (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>No matches yet — play one!</Text>
          <TouchableOpacity
            style={[styles.playButton, { backgroundColor: accent }]}
            onPress={goToPlay}
            activeOpacity={0.85}
          >
            <Text style={styles.playButtonText}>Play</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.tilesRow}
          onPress={goToStats}
          activeOpacity={0.85}
        >
          <StatTile label="Wins" value={stats.wins} accent="#4ade80" />
          <TileDivider />
          <StatTile
            label="Win Rate"
            value={winRate === null ? '—' : `${winRate}%`}
            accent="#4facfe"
          />
          <TileDivider />
          <StatTile
            label="Streak"
            value={stats.currentStreak}
            accent="#e94560"
            suffix={stats.currentStreak >= 3 ? ' 🔥' : ''}
          />
          <TileDivider />
          <StatTile label="Best" value={stats.bestStreak} accent="#fbbf24" />
        </TouchableOpacity>
      )}
    </View>
  );
}

function StatTile({
  label,
  value,
  accent,
  suffix = '',
}: {
  label: string;
  value: number | string;
  accent: string;
  suffix?: string;
}) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileValue, { color: accent }]} numberOfLines={1}>
        {value}
        {suffix}
      </Text>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function TileDivider() {
  return <View style={styles.tileDivider} />;
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(167, 139, 250, 0.06)',
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  headerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerLinkText: {
    fontSize: 11,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  loadingText: {
    fontSize: 11,
    color: '#8a8a9a',
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 10,
  },
  emptyText: {
    flex: 1,
    fontSize: 12,
    color: '#a8a8b8',
    fontStyle: 'italic',
  },
  playButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  playButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.4,
  },
  tilesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tileValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  tileLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8a8a9a',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tileDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});