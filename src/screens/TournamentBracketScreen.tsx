// src/screens/TournamentBracketScreen.tsx
//
// RPS Arena — tournament bracket.
//
// Chat 11b (debug pass):
//   - Subscribes to onTournamentError and surfaces errors in the banner.
//   - [TOURNAMENT BRACKET] logs at each step: mount, connect, initial
//     state, every event received, local actions, state transitions.
//   - activeWindowUpdate is logged only every 10s to avoid spam.
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
import { startGameMusic, stopMusic, playSound } from '../services/audio';
import {
  connectToServer,
  getSocket,
  getTournamentFromServer,
  pressActiveOnServer,
  beginNextRoundOnServer,
  onTournamentState,
  onRoundStarted,
  onActiveWindowUpdate,
  onPlayerActive,
  onPlayerInactive,
  onHostChanged,
  onRoundComplete,
  onTournamentComplete,
  onMatchAssigned,
  onTournamentError,
  type Tournament,
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
  const [activeSecondsLeft, setActiveSecondsLeft] = useState(0);
  const [activeSet, setActiveSet] = useState<Set<string>>(new Set());
  const [eliminated, setEliminated] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [startingNext, setStartingNext] = useState(false);
  const [banner, setBanner] = useState<string>('');
  const lastRoundRef = useRef<number>(0);

  const isHost = tournament?.hostId === myUserId;
  const isLive = tournament?.status === 'live';
  const currentRound = tournament?.currentRound ?? 0;
  const currentRoundObj =
    tournament?.rounds && tournament.rounds.length > 0
      ? tournament.rounds[tournament.rounds.length - 1]
      : null;
  const activeWindowOpen =
    isLive && currentRoundObj?.status === 'active' && activeSecondsLeft > 0;

  // ─── Connect + listeners ───
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const setup = async () => {
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
          return;
        }
      }

      const socket = getSocket();
      if (!socket || cancelled) return;

      mySocketIdRef.current = socket.id || '';

      getTournamentFromServer({ tournamentId }).then((t) => {
        if (cancelled) return;
        if (t) {
          console.log(
            '[TOURNAMENT BRACKET] initial state | status:', t.status,
            '| round:', t.currentRound,
            '| players:', t.players.length,
            '| activeSet:', t.activeUserIds?.length ?? 0
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

      const offStarted = onRoundStarted((payload: RoundStartedPayload) => {
        if (cancelled) return;
        console.log(
          '[TOURNAMENT BRACKET] roundStarted | round:', payload.roundNumber,
          '| matches:', payload.matches?.length ?? 0,
          '| bye:', payload.bye
        );
        setActiveSet(new Set());
        setEliminated(new Set());
        lastRoundRef.current = payload.roundNumber;
        if (typeof payload.activeWindowMs === 'number') {
          setActiveSecondsLeft(Math.round(payload.activeWindowMs / 1000));
        }
        setBanner(`Round ${payload.roundNumber} — press Active`);
        setTimeout(() => setBanner(''), 4000);
      });

      const offTick = onActiveWindowUpdate((data) => {
        if (cancelled) return;
        // Log only every 10s to avoid console spam.
        if (data.secondsLeft % 10 === 0 || data.secondsLeft <= 5) {
          console.log('[TOURNAMENT BRACKET] tick | secondsLeft:', data.secondsLeft);
        }
        setActiveSecondsLeft(data.secondsLeft);
      });

      const offActive = onPlayerActive((data) => {
        if (cancelled) return;
        console.log('[TOURNAMENT BRACKET] playerActive | userId:', data.userId);
        setActiveSet((prev) => {
          const next = new Set(prev);
          next.add(data.userId);
          return next;
        });
      });

      const offInactive = onPlayerInactive((data) => {
        if (cancelled) return;
        console.log(
          '[TOURNAMENT BRACKET] playerInactive | userId:', data.userId,
          '| reason:', data.reason
        );
        setEliminated((prev) => {
          const next = new Set(prev);
          next.add(data.userId);
          return next;
        });
        setActiveSet((prev) => {
          const next = new Set(prev);
          next.delete(data.userId);
          return next;
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
        if (err.action === 'active' || err.action === 'beginRound') {
          console.log('[TOURNAMENT BRACKET] server error:', err.action, err.message);
          setBanner(err.message);
          setTimeout(() => setBanner(''), 3500);
          setStartingNext(false);
        }
      });

      const onMessage = (msg: ChatMessage) => {
        setMessages((prev) => [...prev, msg]);
      };
      socket.on('newMessage', onMessage);

      cleanup = () => {
        offState();
        offStarted();
        offTick();
        offActive();
        offInactive();
        offHost();
        offRoundComplete();
        offComplete();
        offMatch();
        offError();
        socket.off('newMessage', onMessage);
      };
    };

    setup();

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
        lastRoundRef.current, '→', t.currentRound,
        '| resetting eliminated'
      );
      lastRoundRef.current = t.currentRound;
      setEliminated(new Set());
    }
    setTournament(t);
    if (Array.isArray(t.activeUserIds)) {
      setActiveSet(new Set(t.activeUserIds));
    }
    if (typeof t.activeSecondsLeft === 'number') {
      setActiveSecondsLeft(t.activeSecondsLeft);
    }
  };

  const handlePressActive = useCallback(() => {
    if (!tournamentId) return;
    console.log('[TOURNAMENT BRACKET] pressActive | id:', tournamentId);
    playSound('click');
    pressActiveOnServer(tournamentId);
    setActiveSet((prev) => {
      const next = new Set(prev);
      next.add(myUserId);
      return next;
    });
  }, [tournamentId, myUserId]);

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

  // ─── Name resolution ───
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
    if (eliminated.has(userId)) return 'eliminated';
    if (activeSet.has(userId)) return 'active';
    if (tournament && !tournament.players.includes(userId)) {
      return 'eliminated';
    }
    return 'inactive';
  };

  const isCurrentPlayerSquare = (userId: string) => userId === myUserId;

  const showActiveButtonOnSquare = (userId: string): boolean => {
    if (userId !== myUserId) return false;
    if (!isLive) return false;
    if (!currentRoundObj || currentRoundObj.status !== 'active') return false;
    if (activeSecondsLeft <= 0) return false;
    return true;
  };

  const meInTournament = !!tournament && tournament.players.includes(myUserId);
  const iAlreadyActive = activeSet.has(myUserId);
  const showBigActiveButton =
    meInTournament && activeWindowOpen && !iAlreadyActive;

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
                ? `Round ${currentRound || '—'} · ${tournament.players.length} left`
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

        {activeWindowOpen ? (
          <View style={styles.activeBar}>
            <Text style={styles.activeBarText}>
              Active window · {activeSecondsLeft}s
            </Text>
            <Text style={styles.activeBarSub}>
              {activeSet.size}/{tournament?.players.length ?? 0} pressed Active
            </Text>
          </View>
        ) : null}

        {showBigActiveButton ? (
          <TouchableOpacity
            style={styles.bigActiveBtn}
            onPress={handlePressActive}
            activeOpacity={0.8}
          >
            <Text style={styles.bigActiveBtnText}>
              Press Active to stay in the round
            </Text>
          </TouchableOpacity>
        ) : null}

        {meInTournament && activeWindowOpen && iAlreadyActive ? (
          <View style={styles.activeConfirmedBox}>
            <Text style={styles.activeConfirmedText}>
              ✓ You're Active · waiting for others
            </Text>
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
                    showActiveButtonOnSquare,
                    activeSecondsLeft,
                    handlePressActive,
                    activeSet,
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
  showActiveButtonOnSquare: (userId: string) => boolean;
  activeSecondsLeft: number;
  handlePressActive: () => void;
  activeSet: Set<string>;
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
      roundStatus={t.rounds[0]?.status || 'pending'}
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
        roundStatus={round.status}
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
  roundStatus: 'pending' | 'active' | 'complete';
}

function BracketColumn({ slots, ctx, roundNumber, roundStatus }: ColumnProps) {
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
                showActiveButton={ctx.showActiveButtonOnSquare(slot.userId)}
                activeSecondsLeft={ctx.activeSecondsLeft}
                onPressActive={ctx.handlePressActive}
                alreadyActive={ctx.activeSet.has(slot.userId)}
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
  activeBar: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(233, 69, 96, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeBarText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  activeBarSub: { color: '#8a8a9a', fontSize: 11, fontWeight: '700' },
  bigActiveBtn: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#e94560',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigActiveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  activeConfirmedBox: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
    alignItems: 'center',
  },
  activeConfirmedText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '800',
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