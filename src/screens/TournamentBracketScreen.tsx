// src/screens/TournamentBracketScreen.tsx
//
// RPS Arena — tournament bracket.
//
// Chat 11e — Active window removed.
//   The Active window was causing state divergence (matched players
//   were on the match screen when the window closed, and got
//   eliminated) and never synced its countdown reliably. Removed in
//   favor of a state-driven flow:
//
//     - Round starts: server pairs, creates rooms, emits matchAssigned
//       to matched players immediately. BYE player advances silently.
//     - Matched players navigate to the match screen.
//     - BYE player stays on the bracket and sees the live scoreboard
//       strip updating as the other match progresses.
//     - Matches resolve. roundComplete fires. Next round begins.
//     - Disconnect handling is the only presence check.
//
//   Removed: Active button, Active countdown bar, "You're Active"
//   confirmation, pressActive emit, activeSet state, activeSecondsLeft
//   state, onActiveWindowUpdate / onPlayerActive / onPlayerInactive
//   subscriptions.
//
// Kept: live scoreboard strip, reconnect safety net, "3 players"
//   header label, host "Begin Round X" button, chat panel.
//
// APK: platform-agnostic.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Play, Trophy } from 'lucide-react-native';
import ScreenContainer from '../components/ScreenContainer';
import BracketSquare, { BracketSquareState } from '../components/BracketSquare';
import BracketConnectorColumn from '../components/BracketConnector';
import TournamentChatPanel from '../components/TournamentChatPanel';
import LiveScoreboardStrip, {
  ScoreEntry,
} from '../components/LiveScoreboardStrip';
import { startGameMusic, stopMusic, playSound } from '../services/audio';
import {
  connectToServer,
  getSocket,
  getTournamentFromServer,
  beginNextRoundOnServer,
  onTournamentState,
  onTournamentScoresUpdate,
  onRoundStarted,
  onHostChanged,
  onRoundComplete,
  onTournamentComplete,
  onMatchAssigned,
  onTournamentError,
  type Tournament,
  type TournamentScoresPayload,
  type RoundStartedPayload,
} from '../services/multiplayer';
import { getAccessToken } from '../services/supabase';
import { useUserStore } from '../store/userStore';

interface ChatMessage {
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

const SQUARE_W = 140;
const SQUARE_H = 46;
const SQUARE_V_GAP = 14;
const SOURCE_PITCH = SQUARE_H + SQUARE_V_GAP;
const COLUMN_GAP = 36;
const BRACKET_PAD_TOP = 8;
const BRACKET_PAD_LEFT = 12;

export default function TournamentBracketScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const tournamentId: string = route.params?.tournamentId || '';
  const code: string = route.params?.code || '';

  const { identity } = useUserStore();
  const myUserId = identity?.userId || '';
  const myPlayerName = identity?.username || 'Player';
  const mySocketIdRef = useRef<string>('');

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [startingNext, setStartingNext] = useState(false);
  const [banner, setBanner] = useState<string>('');
  const [scoresByMatch, setScoresByMatch] = useState<TournamentScoresPayload>({});
  const lastRoundRef = useRef<number>(0);

  const isHost = tournament?.hostId === myUserId;
  const isLive = tournament?.status === 'live';
  const currentRound = tournament?.currentRound ?? 0;
  const currentRoundObj =
    tournament?.rounds && tournament.rounds.length > 0
      ? tournament.rounds[tournament.rounds.length - 1]
      : null;

  // ─── Connect + listeners ───
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const setup = async (): Promise<(() => void) | undefined> => {
      console.log(
        '[TOURNAMENT BRACKET] mount | id:', tournamentId, '| code:', code,
        '| myUserId:', myUserId,
        '| socket connected:', !!getSocket()?.connected
      );

      if (!getSocket()?.connected) {
        try {
          await connectToServer(getAccessToken);
          console.log('[TOURNAMENT BRACKET] connected | socket:', getSocket()?.id);
        } catch (e: any) {
          console.log('[TOURNAMENT BRACKET] connect failed:', e?.message || e);
          if (!cancelled) setBanner('Could not connect to server');
          return undefined;
        }
      }

      const socket = getSocket();
      if (!socket || cancelled) return undefined;

      mySocketIdRef.current = socket.id || '';

      getTournamentFromServer({ tournamentId }).then((t) => {
        if (cancelled) return;
        if (t) {
          console.log(
            '[TOURNAMENT BRACKET] initial state | status:', t.status,
            '| round:', t.currentRound,
            '| players:', t.players.length
          );
          applyState(t);
        } else {
          console.log('[TOURNAMENT BRACKET] initial state NULL');
        }
      });

      const offState = onTournamentState((t) => {
        if (cancelled) return;
        if (t.id !== tournamentId) return;
        applyState(t);
      });

      const offScores = onTournamentScoresUpdate((payload) => {
        if (cancelled) return;
        setScoresByMatch(payload);
      });

            const offStarted = onRoundStarted((payload: RoundStartedPayload) => {
        if (cancelled) return;
        console.log(
          '[TOURNAMENT BRACKET] roundStarted | round:', payload.roundNumber,
          '| matches:', payload.matches?.length ?? 0,
          '| bye:', payload.bye
        );
        lastRoundRef.current = payload.roundNumber;
        setBanner(`Round ${payload.roundNumber} started`);
        setTimeout(() => setBanner(''), 3000);

        // Fresh state fetch at the top of every round. Ensures the
        // strip and bracket reflect the current round even if a
        // broadcast was missed (this is the round-1 BYE strip fix).
        getTournamentFromServer({ tournamentId }).then((t) => {
          if (cancelled || !t) return;
          applyState(t);
        });
      });

      const offHost = onHostChanged((data) => {
        if (cancelled) return;
        console.log('[TOURNAMENT BRACKET] hostChanged | newHost:', data.newHostId);
        setBanner('Host changed');
        setTimeout(() => setBanner(''), 2500);
      });

      const offRoundComplete = onRoundComplete((data) => {
        if (cancelled) return;
        console.log(
          '[TOURNAMENT BRACKET] roundComplete | round:', data.roundNumber,
          '| winners:', data.winners?.length ?? 0,
          '| nextRound:', data.nextRound
        );
        setBanner(
          data.nextRound
            ? `Round ${data.roundNumber} complete — next round soon`
            : `Round ${data.roundNumber} complete`
        );
        setTimeout(() => setBanner(''), 3500);
      });

      const offComplete = onTournamentComplete((data) => {
        if (cancelled) return;
        console.log(
          '[TOURNAMENT BRACKET] tournamentComplete | winner:', data.winnerId
        );
        navigation.replace('TournamentChampion', {
          tournamentId,
          winnerId: data.winnerId || '',
        });
      });

      const offMatch = onMatchAssigned((data) => {
        if (cancelled) return;
        console.log(
          '[TOURNAMENT BRACKET] matchAssigned | match:', data.matchId,
          '| room:', data.roomCode,
          '| opponent:', data.opponentUserId
        );
        navigation.navigate('TournamentMatch', {
          tournamentId,
          matchId: data.matchId,
          roomCode: data.roomCode,
          opponentUserId: data.opponentUserId,
        });
      });

      const offError = onTournamentError((err) => {
        if (cancelled) return;
        if (err.action === 'beginRound') {
          console.log('[TOURNAMENT BRACKET] server error:', err.action, err.message);
          setBanner(err.message);
          setTimeout(() => setBanner(''), 3500);
          setStartingNext(false);
        }
      });

      // Reconnect safety net.
      const onReconnect = () => {
        if (cancelled) return;
        console.log('[TOURNAMENT BRACKET] socket reconnected — re-fetching state');
        getTournamentFromServer({ tournamentId }).then((t) => {
          if (cancelled || !t) return;
          applyState(t);
        });
      };
      socket.on('connect', onReconnect);

      const onMessage = (msg: ChatMessage) => {
        setMessages((prev) => [...prev, msg]);
      };
      socket.on('newMessage', onMessage);

      return () => {
        offState();
        offScores();
        offStarted();
        offHost();
        offRoundComplete();
        offComplete();
        offMatch();
        offError();
        socket.off('connect', onReconnect);
        socket.off('newMessage', onMessage);
      };
    };

    setup().then((fn) => {
      if (cancelled) {
        if (typeof fn === 'function') fn();
        return;
      }
      if (typeof fn === 'function') cleanup = fn;
    });

    return () => {
      cancelled = true;
      console.log('[TOURNAMENT BRACKET] unmount');
      if (cleanup) cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  // ─── Audio ───
  useEffect(() => {
    startGameMusic();
    return () => {
      stopMusic();
    };
  }, []);

  const applyState = (t: Tournament) => {
    if (t.currentRound !== lastRoundRef.current) {
      console.log(
        '[TOURNAMENT BRACKET] applyState — round change:',
        lastRoundRef.current, '→', t.currentRound
      );
      lastRoundRef.current = t.currentRound;
    }
    setTournament(t);
  };

    // ─── State-driven champion navigation ───
  // If the tournament finishes, go to the champion screen. This
  // fires even if tournamentComplete was dropped or arrived during
  // a navigation race.
  useEffect(() => {
    if (!tournament) return;
    if (tournament.status !== 'finished') return;
    console.log(
      '[TOURNAMENT BRACKET] status finished → navigating to champion'
    );
    navigation.replace('TournamentChampion', {
      tournamentId,
      winnerId: tournament.winnerId || '',
    });
  }, [tournament?.status, tournament?.winnerId, tournamentId, navigation]);

  const handleBeginNextRound = useCallback(() => {
    if (!isHost || !tournamentId) return;
    console.log('[TOURNAMENT BRACKET] beginNextRound | id:', tournamentId);
    setStartingNext(true);
    playSound('click');
    beginNextRoundOnServer(tournamentId);
    setTimeout(() => setStartingNext(false), 3000);
  }, [isHost, tournamentId]);

  const handleLeave = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

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

  const resolveSquareState = (
    userId: string,
    isBye: boolean
  ): BracketSquareState => {
    if (isBye) return 'bye';
    if (tournament && !tournament.players.includes(userId)) {
      return 'eliminated';
    }
    return 'inactive';
  };

  const isCurrentPlayerSquare = (userId: string) => userId === myUserId;

  const meInTournament = !!tournament && tournament.players.includes(myUserId);

  // ─── Live scoreboard entries ───
    const buildScoreEntries = useCallback((): ScoreEntry[] => {
    if (!tournament || !tournament.rounds?.length) return [];
    const lastRound = tournament.rounds[tournament.rounds.length - 1];
    if (!lastRound || !lastRound.matches?.length) return [];

    const entries: ScoreEntry[] = [];
    for (const m of lastRound.matches) {
      // Prefer live scores from the tournamentScoresUpdate event; fall
      // back to the state snapshot. Without this, the strip only
      // updates on tournamentState broadcasts (which are less frequent
      // than score updates during a match).
      const live = scoresByMatch[m.matchId];
      const p1Score = live?.scores?.p1 ?? m.scores?.p1 ?? 0;
      const p2Score = live?.scores?.p2 ?? m.scores?.p2 ?? 0;
      const status = live?.status ?? m.status;

      entries.push({
        matchId: m.matchId,
        p1UserId: m.p1,
        p2UserId: m.p2,
        p1Name: displayName(m.p1),
        p2Name: displayName(m.p2),
        p1Score,
        p2Score,
        p1Color: tournament.colorMap?.[m.p1] || null,
        p2Color: tournament.colorMap?.[m.p2] || null,
        status,
        winnerUserId: m.winner || null,
      });
    }
    return entries;
  }, [tournament, displayName, scoresByMatch]);
  // Am I currently in an active match this round? If so, the match
  // screen will navigate us there, and this screen shouldn't show the
  // strip.
  const myMatchThisRound = (() => {
    if (!currentRoundObj || !myUserId) return null;
    for (const m of currentRoundObj.matches) {
      if (m.p1 === myUserId || m.p2 === myUserId) return m;
    }
    return null;
  })();
  const myMatchIsActive =
    myMatchThisRound != null && myMatchThisRound.status !== 'complete';
  const showLiveStrip =
    isLive && !myMatchIsActive && (currentRoundObj?.matches?.length ?? 0) > 0;

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleLeave} style={styles.headerBtn}>
            <ChevronLeft size={26} color="#e94560" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>🏆 Bracket</Text>
                        <Text style={styles.headerSubtitle}>
              {tournament
                ? `Round ${currentRound || '—'} · ${tournament.players.length} players · First to ${tournament.winTarget}`
                : 'Loading…'}
            </Text>
          </View>
          <View style={styles.headerBtn} />
        </View>

        {banner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{banner}</Text>
          </View>
        ) : null}

        {showLiveStrip ? (
          <View style={styles.liveStripWrap}>
            <LiveScoreboardStrip
              entries={buildScoreEntries()}
              currentUserId={myUserId}
              currentMatchId={null}
              title={`Round ${currentRound} — live scores`}
            />
          </View>
        ) : null}

        <View style={styles.bracketWrap}>
          {!tournament ? (
            <View style={styles.centerPad}>
              <ActivityIndicator color="#e94560" size="large" />
              <Text style={styles.loadingText}>Loading bracket…</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
              contentContainerStyle={styles.hScrollContent}
            >
              <ScrollView
                showsVerticalScrollIndicator
                contentContainerStyle={styles.vScrollContent}
              >
                <View style={styles.bracketRow}>
                  {renderRounds(tournament, {
                    resolveSquareState,
                    displayName,
                    isCurrentPlayerSquare,
                    myUserId,
                  })}
                </View>
              </ScrollView>
            </ScrollView>
          )}
        </View>

        {isHost && !tournament?.autoAdvance && isLive ? (
          <View style={styles.hostFooter}>
            <TouchableOpacity
              style={[
                styles.beginBtn,
                startingNext && styles.beginBtnDisabled,
              ]}
              onPress={handleBeginNextRound}
              disabled={startingNext}
              activeOpacity={0.85}
            >
              {startingNext ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Play size={18} color="#ffffff" />
                  <Text style={styles.beginBtnText}>
                    Begin Round {currentRound + 1}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <TournamentChatPanel
          tournamentId={tournamentId}
          messages={messages}
          myPlayerId={mySocketIdRef.current}
          myPlayerName={myPlayerName}
        />
      </SafeAreaView>
    </ScreenContainer>
  );
}

// ────────────────────────────────────────────────────────────
// renderRounds — build the horizontal column stack.
// ────────────────────────────────────────────────────────────
interface RenderCtx {
  resolveSquareState: (userId: string, isBye: boolean) => BracketSquareState;
  displayName: (uid: string) => string;
  isCurrentPlayerSquare: (userId: string) => boolean;
  myUserId: string;
}

function renderRounds(t: Tournament, ctx: RenderCtx) {
  const columns: React.ReactNode[] = [];

  const started = t.status !== 'lobby';

  let round1Slots: { userId: string; isBye: boolean; isWinner: boolean }[] = [];
  if (started && t.rounds.length > 0) {
    const r1 = t.rounds[0];
    for (const m of r1.matches) {
      round1Slots.push({
        userId: m.p1,
        isBye: false,
        isWinner: m.winner === m.p1,
      });
      round1Slots.push({
        userId: m.p2,
        isBye: false,
        isWinner: m.winner === m.p2,
      });
    }
    if (r1.bye) {
      round1Slots.push({ userId: r1.bye, isBye: true, isWinner: true });
    }
  } else {
    round1Slots = t.players.map((uid) => ({
      userId: uid,
      isBye: false,
      isWinner: false,
    }));
  }

  columns.push(
    <BracketColumn
      key="r1"
      slots={round1Slots}
      ctx={ctx}
      roundNumber={1}
    />
  );

  for (let i = 1; i < t.rounds.length; i++) {
    const prevRound = t.rounds[i - 1];
    const round = t.rounds[i];

    const prevSlots =
      (i === 1 ? round1Slots.length : prevRound.matches.length * 2 + (prevRound.bye ? 1 : 0));
    columns.push(
      <View
        key={`c-${i}`}
        style={{
          paddingTop: BRACKET_PAD_TOP + SOURCE_PITCH / 2 - SQUARE_H / 2,
        }}
      >
        <BracketConnectorColumn
          count={Math.ceil(prevSlots / 2)}
          sourcePitch={SOURCE_PITCH}
          squareH={SQUARE_H}
          sourceGap={SQUARE_V_GAP}
          hWidth={COLUMN_GAP}
        />
      </View>
    );

    const slots: { userId: string; isBye: boolean; isWinner: boolean }[] = [];
    for (const m of round.matches) {
      slots.push({
        userId: m.p1,
        isBye: false,
        isWinner: m.winner === m.p1,
      });
      slots.push({
        userId: m.p2,
        isBye: false,
        isWinner: m.winner === m.p2,
      });
    }
    if (round.bye) {
      slots.push({ userId: round.bye, isBye: true, isWinner: true });
    }

    columns.push(
      <BracketColumn
        key={`r-${round.roundNumber}`}
        slots={slots}
        ctx={ctx}
        roundNumber={round.roundNumber}
      />
    );
  }

  if (t.status === 'finished' && t.winnerId) {
    columns.push(
      <View
        key="champion"
        style={{
          justifyContent: 'center',
          paddingLeft: COLUMN_GAP,
          paddingTop: BRACKET_PAD_TOP,
        }}
      >
        <View style={styles.championSlot}>
          <Trophy size={18} color="#fbbf24" />
          <Text style={styles.championSlotName} numberOfLines={1}>
            {ctx.displayName(t.winnerId)}
          </Text>
        </View>
      </View>
    );
  }

  return columns;
}

interface ColumnProps {
  slots: { userId: string; isBye: boolean; isWinner: boolean }[];
  ctx: RenderCtx;
  roundNumber: number;
}

function BracketColumn({ slots, ctx, roundNumber }: ColumnProps) {
  return (
    <View
      style={{
        paddingTop: BRACKET_PAD_TOP,
        paddingLeft: BRACKET_PAD_LEFT,
        width: SQUARE_W + BRACKET_PAD_LEFT,
      }}
    >
      <Text style={styles.columnLabel}>Round {roundNumber}</Text>
      <View style={{ marginTop: 6 }}>
        {slots.map((slot, idx) => {
          const state = ctx.resolveSquareState(slot.userId, slot.isBye);
          return (
            <View
              key={slot.userId + '-' + idx}
              style={{ marginBottom: SQUARE_V_GAP }}
            >
              <BracketSquare
                name={slot.isBye ? 'BYE' : ctx.displayName(slot.userId)}
                color={null}
                state={state}
                isMe={ctx.isCurrentPlayerSquare(slot.userId)}
                width={SQUARE_W}
                height={SQUARE_H}
                isWinner={slot.isWinner}
              />
            </View>
          );
        })}
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
  headerBtn: { padding: 6, width: 36 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  headerSubtitle: {
    fontSize: 10,
    color: '#fbbf24',
    marginTop: 1,
    fontWeight: '600',
  },
  banner: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderColor: 'rgba(251, 191, 36, 0.4)',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginTop: 6,
    borderRadius: 10,
    alignItems: 'center',
  },
  bannerText: { fontSize: 12, color: '#fbbf24', fontWeight: '700' },
  liveStripWrap: {
    marginTop: 8,
  },
  bracketWrap: { flex: 1, marginTop: 8 },
  centerPad: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: { color: '#8a8a9a', fontSize: 12, fontWeight: '600' },
  hScrollContent: { paddingRight: 24 },
  vScrollContent: { paddingBottom: 160 },
  bracketRow: { flexDirection: 'row', alignItems: 'flex-start' },
  columnLabel: {
    fontSize: 10,
    color: '#5a5a7a',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    paddingHorizontal: 4,
  },
  championSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  championSlotName: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
  },
  hostFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    padding: 12,
  },
  beginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e94560',
    paddingVertical: 14,
    borderRadius: 12,
  },
  beginBtnDisabled: { opacity: 0.5 },
  beginBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});