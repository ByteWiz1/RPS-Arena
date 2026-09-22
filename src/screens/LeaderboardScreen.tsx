import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Trophy, Swords, Medal, TrendingUp } from 'lucide-react-native';
import { useAvatarStore } from '../store/avatarStore';
import { getRatingTier } from '../engine/AvatarEngine';
import { startMenuMusic } from '../services/audio';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';

type Tab = 'leaderboard' | 'history';

export default function LeaderboardScreen() {
  const navigation = useNavigation<any>();
  const { avatars, getRecentMatches } = useAvatarStore();
  const [tab, setTab] = useState<Tab>('leaderboard');

  useEffect(() => {
    startMenuMusic();
  }, []);

  const sortedAvatars = [...avatars].sort((a, b) => b.rating - a.rating);
  const recentMatches = getRecentMatches(30);

  const formatTime = (ts: number) => {
    const now = Date.now();
    const diffMin = Math.floor((now - ts) / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <ChevronLeft size={24} color="#e94560" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>🏆 Rankings</Text>
            <Text style={styles.headerSubtitle}>Leaderboard & History</Text>
          </View>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'leaderboard' && styles.tabBtnActive]}
            onPress={() => setTab('leaderboard')}
          >
            <Trophy size={16} color={tab === 'leaderboard' ? '#fbbf24' : '#5a5a7a'} />
            <Text style={[styles.tabText, tab === 'leaderboard' && styles.tabTextActive]}>
              Leaderboard
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'history' && styles.tabBtnActive]}
            onPress={() => setTab('history')}
          >
            <Swords size={16} color={tab === 'history' ? '#e94560' : '#5a5a7a'} />
            <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>
              History
            </Text>
          </TouchableOpacity>
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={130}>
          {tab === 'leaderboard' ? (
            <>
              {sortedAvatars.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Trophy size={48} color="#3a3a4a" />
                  <Text style={styles.emptyTitle}>No Avatars Yet</Text>
                  <Text style={styles.emptyText}>
                    Create your first avatar to appear on the leaderboard
                  </Text>
                </View>
              ) : (
                sortedAvatars.map((avatar, index) => {
                  const tier = getRatingTier(avatar.rating);
                  const totalGames = avatar.wins + avatar.losses + avatar.ties;
                  const winRate = totalGames > 0 ? Math.round((avatar.wins / totalGames) * 100) : 0;

                  return (
                    <View
                      key={avatar.id}
                      style={[
                        styles.avatarRow,
                        index === 0 && styles.avatarRowGold,
                        index === 1 && styles.avatarRowSilver,
                        index === 2 && styles.avatarRowBronze,
                      ]}
                    >
                      <View style={styles.rankBox}>
                        <Text style={styles.rankText}>#{index + 1}</Text>
                        {index === 0 && <Medal size={16} color="#fbbf24" />}
                        {index === 1 && <Medal size={16} color="#c0c0c0" />}
                        {index === 2 && <Medal size={16} color="#cd7f32" />}
                      </View>

                      <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>

                      <View style={styles.avatarInfo}>
                        <Text style={styles.avatarName} numberOfLines={1}>{avatar.name}</Text>
                        <Text style={[styles.avatarTier, { color: tier.color }]}>
                          {tier.emoji} {tier.name}
                        </Text>
                        <Text style={styles.avatarStats}>
                          L{avatar.level} · {avatar.wins}W {avatar.losses}L {avatar.ties}T · {winRate}%
                        </Text>
                      </View>

                      <View style={styles.ratingBox}>
                        <Text style={[styles.ratingValue, { color: tier.color }]}>
                          {avatar.rating}
                        </Text>
                        {avatar.winStreak >= 3 && (
                          <View style={styles.streakBadge}>
                            <TrendingUp size={10} color="#fbbf24" />
                            <Text style={styles.streakText}>{avatar.winStreak}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </>
          ) : (
            <>
              {recentMatches.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Swords size={48} color="#3a3a4a" />
                  <Text style={styles.emptyTitle}>No Matches Yet</Text>
                  <Text style={styles.emptyText}>
                    Play a game to see your match history here
                  </Text>
                </View>
              ) : (
                recentMatches.map((match) => {
                  const avatar = avatars.find((a) => a.id === match.avatarId);
                  const modeLabel = {
                    pvc: '🤖 AI',
                    pvp: '👥 Local',
                    online: '🌐 Online',
                    dojo: '🥋 Dojo',
                  }[match.mode];

                  return (
                    <View
                      key={match.id}
                      style={[
                        styles.matchRow,
                        match.result === 'win' && styles.matchWin,
                        match.result === 'lose' && styles.matchLose,
                        match.result === 'tie' && styles.matchTie,
                      ]}
                    >
                      <View style={styles.matchLeft}>
                        <Text style={styles.matchEmoji}>
                          {match.result === 'win' ? '🎉' : match.result === 'lose' ? '😢' : '🤝'}
                        </Text>
                        <View style={styles.matchInfo}>
                          <Text style={styles.matchOpponent} numberOfLines={1}>
                            vs {match.opponentName}
                          </Text>
                          <Text style={styles.matchMeta}>
                            {modeLabel} · {avatar?.emoji} {avatar?.name || 'Unknown'} ·{' '}
                            {formatTime(match.timestamp)}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.matchScore,
                          match.result === 'win' && styles.matchScoreWin,
                          match.result === 'lose' && styles.matchScoreLose,
                          match.result === 'tie' && styles.matchScoreTie,
                        ]}
                      >
                        {match.myScore}-{match.opponentScore}
                      </Text>
                    </View>
                  );
                })
              )}
            </>
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerBtn: { padding: 6, width: 36 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#ffffff' },
  headerSubtitle: {
    fontSize: 10,
    color: '#a78bfa',
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  tabBar: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  tabBtnActive: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5a5a7a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabTextActive: { color: '#ffffff' },
  scrollContent: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 40, gap: 6 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff', marginTop: 8 },
  emptyText: { fontSize: 12, color: '#5a5a7a', textAlign: 'center', paddingHorizontal: 40 },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    gap: 10,
  },
  avatarRowGold: { borderColor: 'rgba(251, 191, 36, 0.4)', backgroundColor: 'rgba(251, 191, 36, 0.06)' },
  avatarRowSilver: { borderColor: 'rgba(192, 192, 192, 0.3)', backgroundColor: 'rgba(192, 192, 192, 0.04)' },
  avatarRowBronze: { borderColor: 'rgba(205, 127, 50, 0.3)', backgroundColor: 'rgba(205, 127, 50, 0.04)' },
  rankBox: { width: 32, alignItems: 'center', gap: 2 },
  rankText: { fontSize: 13, fontWeight: '800', color: '#8a8a9a' },
  avatarEmoji: { fontSize: 28 },
  avatarInfo: { flex: 1 },
  avatarName: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  avatarTier: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  avatarStats: { fontSize: 10, color: '#5a5a7a', marginTop: 2 },
  ratingBox: { alignItems: 'flex-end', gap: 3 },
  ratingValue: { fontSize: 18, fontWeight: '800' },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
  },
  streakText: { fontSize: 10, fontWeight: '800', color: '#fbbf24' },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  matchWin: { borderColor: 'rgba(74, 222, 128, 0.25)', backgroundColor: 'rgba(74, 222, 128, 0.04)' },
  matchLose: { borderColor: 'rgba(248, 113, 113, 0.25)', backgroundColor: 'rgba(248, 113, 113, 0.04)' },
  matchTie: { borderColor: 'rgba(251, 191, 36, 0.25)', backgroundColor: 'rgba(251, 191, 36, 0.04)' },
  matchLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  matchEmoji: { fontSize: 22 },
  matchInfo: { flex: 1 },
  matchOpponent: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  matchMeta: { fontSize: 10, color: '#5a5a7a', marginTop: 2 },
  matchScore: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
  matchScoreWin: { color: '#4ade80' },
  matchScoreLose: { color: '#f87171' },
  matchScoreTie: { color: '#fbbf24' },
});