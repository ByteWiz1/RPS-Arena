// src/screens/TournamentChampionScreen.tsx
//
// RPS Arena — tournament champion reveal.
//
// Chat 11b (debug pass):
//   - Subscribes to onTournamentError (defensive).
//   - [TOURNAMENT CHAMPION] logs: mount, connect, state fetch,
//     winnerId source, avatar refresh, reward rows.
//
// APK: platform-agnostic.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Trophy, Home, Star } from 'lucide-react-native';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import {
  getSocket,
  connectToServer,
  getTournamentFromServer,
  onTournamentState,
  onAvatarsUpdate,
  onTournamentError,
  type Tournament,
} from '../services/multiplayer';
import { getAccessToken } from '../services/supabase';
import { stopMusic, playCelebrationSequence } from '../services/audio';
import { useUserStore } from '../store/userStore';
import { useAvatarStore } from '../store/avatarStore';

interface RewardRow {
  userId: string;
  label: string;
  ratingDelta: number;
  xpDelta: number;
  title: string | null;
  isChampion: boolean;
  isRunnerUp: boolean;
  isSemifinalist: boolean;
  isSelf: boolean;
}

export default function TournamentChampionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const tournamentId: string = route.params?.tournamentId || '';
  const winnerIdFromRoute: string = route.params?.winnerId || '';

  const { identity } = useUserStore();
  const myUserId = identity?.userId || '';
  const myPlayerName = identity?.username || 'Player';

  const syncFromServer = useAvatarStore((s) => s.syncFromServer);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  const winnerId = tournament?.winnerId || winnerIdFromRoute || null;
  const isMeChampion = !!winnerId && winnerId === myUserId;
  const hasChampion = !!winnerId;

  // ─── Connect + fetch final state ───
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const setup = async () => {
      console.log(
        '[TOURNAMENT CHAMPION] mount | id:', tournamentId,
        '| route winnerId:', winnerIdFromRoute || '(none)',
        '| myUserId:', myUserId,
        '| socket connected:', !!getSocket()?.connected
      );

      if (!getSocket()?.connected) {
        try {
          await connectToServer(getAccessToken);
          console.log('[TOURNAMENT CHAMPION] connected | socket:', getSocket()?.id);
        } catch (e: any) {
          console.log('[TOURNAMENT CHAMPION] connect failed:', e?.message || e);
          if (!cancelled) setLoading(false);
          return;
        }
      }

      const socket = getSocket();
      if (!socket || cancelled) return;

      const t = await getTournamentFromServer({ tournamentId });
      if (cancelled) return;
      if (t) {
        console.log(
          '[TOURNAMENT CHAMPION] state fetched | status:', t.status,
          '| winnerId:', t.winnerId || '(none)',
          '| players:', t.players.length,
          '| rounds:', t.rounds.length
        );
        setTournament(t);
      } else {
        console.log('[TOURNAMENT CHAMPION] state fetched NULL — falling back to route param');
      }
      setLoading(false);

      const offState = onTournamentState((next) => {
        if (cancelled) return;
        if (next.id === tournamentId) {
          console.log(
            '[TOURNAMENT CHAMPION] state update | winnerId:',
            next.winnerId || '(none)'
          );
          setTournament(next);
        }
      });

      const offAvatars = onAvatarsUpdate(() => {
        if (cancelled) return;
        console.log('[TOURNAMENT CHAMPION] avatars update — syncing store');
        syncFromServer().catch(() => {});
      });

      const offError = onTournamentError((err) => {
        if (cancelled) return;
        console.log('[TOURNAMENT CHAMPION] server error:', err.action, err.message);
      });

      cleanup = () => {
        offState();
        offAvatars();
        offError();
      };
    };

    setup();

    return () => {
      cancelled = true;
      console.log('[TOURNAMENT CHAMPION] unmount');
      if (cleanup) cleanup();
    };
  }, [tournamentId, syncFromServer, winnerIdFromRoute, myUserId]);

  // ─── Audio ───
  useEffect(() => {
    stopMusic();
    const iWon = !!winnerIdFromRoute && winnerIdFromRoute === myUserId;
    console.log('[TOURNAMENT CHAMPION] playing celebration | iWon:', iWon);
    playCelebrationSequence(iWon).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Log winnerId source once it's stable ───
  useEffect(() => {
    if (loading) return;
    const source = tournament?.winnerId
      ? 'state'
      : winnerIdFromRoute
      ? 'route'
      : 'none';
    console.log(
      '[TOURNAMENT CHAMPION] winnerId resolved | value:', winnerId || '(none)',
      '| source:', source,
      '| hasChampion:', hasChampion
    );
  }, [loading, tournament?.winnerId, winnerIdFromRoute, winnerId, hasChampion]);

  const displayName = useCallback(
    (uid: string): string => {
      if (!uid) return 'Player';
      if (uid === myUserId) return myPlayerName;
      const fromMap = tournament?.usernames?.[uid];
      if (fromMap) return fromMap;
      const trimmed = uid.replace(/-/g, '');
      return 'Player ' + trimmed.slice(-6).toUpperCase();
    },
    [tournament, myUserId, myPlayerName]
  );

  const buildRewardRows = useCallback((): RewardRow[] => {
    if (!tournament) return [];

    const rounds = tournament.rounds || [];
    const semiSet = new Set<string>();
    if (rounds.length >= 2) {
      const semiRound = rounds[rounds.length - 2];
      for (const m of semiRound.matches) {
        if (m.p1) semiSet.add(m.p1);
        if (m.p2) semiSet.add(m.p2);
      }
    }

    let runnerUpId: string | null = null;
    const finalRound = rounds[rounds.length - 1];
    if (finalRound && winnerId) {
      for (const m of finalRound.matches) {
        if (m.p1 === winnerId && m.p2) runnerUpId = m.p2;
        else if (m.p2 === winnerId && m.p1) runnerUpId = m.p1;
      }
    }

    const allUsers = new Set<string>();
    Object.keys(tournament.colorMap || {}).forEach((uid) => allUsers.add(uid));
    (tournament.players || []).forEach((uid) => allUsers.add(uid));
    for (const r of rounds) {
      for (const m of r.matches) {
        if (m.p1) allUsers.add(m.p1);
        if (m.p2) allUsers.add(m.p2);
      }
      if (r.bye) allUsers.add(r.bye);
    }

    const rows: RewardRow[] = [];
    for (const uid of allUsers) {
      const isChampion = uid === winnerId;
      const isRunnerUp = !isChampion && uid === runnerUpId;
      const isSemifinalist =
        !isChampion && !isRunnerUp && semiSet.has(uid);

      let ratingDelta = 0;
      let xpDelta = 50;
      let title: string | null = null;

      if (isSemifinalist) {
        ratingDelta += 10;
        xpDelta += 100;
      }
      if (isRunnerUp) {
        ratingDelta += 25;
        xpDelta += 250;
      }
      if (isChampion) {
        ratingDelta += 50;
        xpDelta += 500;
        title = 'Tournament Champion';
      }

      rows.push({
        userId: uid,
        label: displayName(uid),
        ratingDelta,
        xpDelta,
        title,
        isChampion,
        isRunnerUp,
        isSemifinalist,
        isSelf: uid === myUserId,
      });
    }

    const tier = (r: RewardRow) =>
      r.isChampion ? 0 : r.isRunnerUp ? 1 : r.isSemifinalist ? 2 : 3;
    rows.sort((a, b) => {
      const ta = tier(a);
      const tb = tier(b);
      if (ta !== tb) return ta - tb;
      if (a.isSelf && !b.isSelf) return -1;
      if (b.isSelf && !a.isSelf) return 1;
      return a.label.localeCompare(b.label);
    });

    return rows;
  }, [tournament, winnerId, myUserId, displayName]);

  const handleHome = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  }, [navigation]);

  const handleViewBracket = useCallback(() => {
    navigation.replace('TournamentBracket', { tournamentId });
  }, [navigation, tournamentId]);

  const rewardRows = buildRewardRows();
  const winnerRow = rewardRows.find((r) => r.isChampion) || null;
  const myRow = rewardRows.find((r) => r.isSelf) || null;

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <View style={styles.headerBtn} />
          <Text style={styles.headerTitle}>🏆 Champion</Text>
          <View style={styles.headerBtn} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#fbbf24" size="large" />
            <Text style={styles.loadingText}>Loading results…</Text>
          </View>
        ) : (
          <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
            <View style={styles.heroWrap}>
              <View style={styles.trophyCircle}>
                <Trophy size={64} color="#fbbf24" />
              </View>
              {hasChampion ? (
                <>
                  <Text style={styles.heroLabel}>
                    {isMeChampion ? 'You are the champion!' : 'Champion'}
                  </Text>
                  <Text style={styles.heroName}>
                    {winnerRow?.label || displayName(winnerId || '')}
                  </Text>
                  {isMeChampion ? (
                    <Text style={styles.heroSub}>
                      You won the tournament and unlocked a new title.
                    </Text>
                  ) : (
                    <Text style={styles.heroSub}>
                      Well played. Better luck next time.
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.heroLabel}>No champion</Text>
                  <Text style={styles.heroName}>—</Text>
                  <Text style={styles.heroSub}>
                    All players left or were eliminated before the final.
                  </Text>
                </>
              )}
            </View>

            {winnerRow ? (
              <View style={styles.champCard}>
                <Text style={styles.champCardTitle}>Champion rewards</Text>
                <View style={styles.rewardLine}>
                  <Text style={styles.rewardLabel}>Rating</Text>
                  <Text style={styles.rewardValue}>
                    +{winnerRow.ratingDelta}
                  </Text>
                </View>
                <View style={styles.rewardLine}>
                  <Text style={styles.rewardLabel}>XP</Text>
                  <Text style={styles.rewardValue}>+{winnerRow.xpDelta}</Text>
                </View>
                {winnerRow.title ? (
                  <View style={styles.rewardLine}>
                    <Text style={styles.rewardLabel}>Title</Text>
                    <View style={styles.titlePill}>
                      <Star size={12} color="#fbbf24" />
                      <Text style={styles.titlePillText}>
                        {winnerRow.title}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {myRow && !myRow.isChampion ? (
              <View style={styles.myCard}>
                <Text style={styles.myCardTitle}>Your rewards</Text>
                <View style={styles.rewardLine}>
                  <Text style={styles.rewardLabel}>Rating</Text>
                  <Text style={styles.rewardValue}>
                    +{myRow.ratingDelta}
                  </Text>
                </View>
                <View style={styles.rewardLine}>
                  <Text style={styles.rewardLabel}>XP</Text>
                  <Text style={styles.rewardValue}>+{myRow.xpDelta}</Text>
                </View>
                <Text style={styles.myCardSub}>
                  {myRow.isRunnerUp
                    ? 'Runner-up'
                    : myRow.isSemifinalist
                    ? 'Semifinalist'
                    : 'Participant'}
                </Text>
              </View>
            ) : null}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ALL PARTICIPANTS</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.rowsCard}>
              {rewardRows.length === 0 ? (
                <Text style={styles.emptyText}>
                  No participant data available.
                </Text>
              ) : (
                rewardRows.map((r) => (
                  <View
                    key={r.userId}
                    style={[
                      styles.participantRow,
                      r.isChampion && styles.participantRowChampion,
                      r.isSelf && styles.participantRowSelf,
                    ]}
                  >
                    <View style={styles.participantLeft}>
                      {r.isChampion ? (
                        <Trophy size={14} color="#fbbf24" />
                      ) : r.isRunnerUp ? (
                        <Star size={12} color="#c4b5fd" />
                      ) : (
                        <View style={styles.dot} />
                      )}
                      <Text
                        style={[
                          styles.participantName,
                          r.isSelf && styles.participantNameSelf,
                        ]}
                        numberOfLines={1}
                      >
                        {r.label}
                        {r.isSelf ? ' (you)' : ''}
                      </Text>
                    </View>
                    <View style={styles.participantRight}>
                      {r.ratingDelta > 0 ? (
                        <Text style={styles.participantDelta}>
                          +{r.ratingDelta} rating
                        </Text>
                      ) : null}
                      <Text style={styles.participantXP}>
                        +{r.xpDelta} XP
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={styles.actionsWrap}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleHome}
                activeOpacity={0.85}
              >
                <Home size={18} color="#ffffff" />
                <Text style={styles.primaryBtnText}>Back to Home</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleViewBracket}
                activeOpacity={0.85}
              >
                <Trophy size={16} color="#fbbf24" />
                <Text style={styles.secondaryBtnText}>View Final Bracket</Text>
              </TouchableOpacity>
            </View>
          </ScreenScroll>
        )}
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
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff' },

  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { color: '#8a8a9a', fontSize: 12, fontWeight: '600' },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },

  heroWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  trophyCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(251, 191, 36, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroLabel: {
    fontSize: 11,
    color: '#5a5a7a',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  heroName: {
    fontSize: 30,
    color: '#ffffff',
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  heroSub: {
    fontSize: 12,
    color: '#8a8a9a',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },

  champCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.28)',
    gap: 10,
  },
  champCardTitle: {
    fontSize: 12,
    color: '#fbbf24',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  myCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(79, 172, 254, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.24)',
    gap: 10,
  },
  myCardTitle: {
    fontSize: 12,
    color: '#4facfe',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  myCardSub: {
    fontSize: 11,
    color: '#8a8a9a',
    fontWeight: '700',
    marginTop: 4,
  },
  rewardLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rewardLabel: {
    fontSize: 12,
    color: '#c4c4d4',
    fontWeight: '700',
  },
  rewardValue: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '900',
  },
  titlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
  },
  titlePillText: {
    fontSize: 11,
    color: '#fbbf24',
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dividerText: {
    color: '#5a5a7a',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },

  rowsCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  emptyText: {
    fontSize: 12,
    color: '#5a5a7a',
    textAlign: 'center',
    paddingVertical: 20,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  participantRowChampion: {
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
  },
  participantRowSelf: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  participantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginLeft: 2,
  },
  participantName: {
    fontSize: 13,
    color: '#c4c4d4',
    fontWeight: '700',
    flexShrink: 1,
  },
  participantNameSelf: {
    color: '#ffffff',
  },
  participantRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  participantDelta: {
    fontSize: 11,
    color: '#fbbf24',
    fontWeight: '800',
  },
  participantXP: {
    fontSize: 11,
    color: '#8a8a9a',
    fontWeight: '700',
  },

  actionsWrap: {
    gap: 10,
    marginTop: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e94560',
    paddingVertical: 16,
    borderRadius: 14,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.28)',
  },
  secondaryBtnText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});