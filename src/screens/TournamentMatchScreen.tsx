// src/screens/TournamentMatchScreen.tsx
//
// RPS Arena — tournament match.
//
// Chat 11d fixes:
//   - triggerMatchEnd no longer blocks navigation. Two separate refs:
//     navigatedAwayRef (celebration + overlay guard) and
//     navigationScheduledRef (idempotent navigation scheduler).
//     Previously a single ref meant a second call would set the ref
//     and skip navigation, leaving the screen frozen on the overlay
//     while the celebration audio played.
//   - Fallback navigation 5s after triggerMatchEnd as a safety net.
//   - Subscribes to onRoundComplete: if the round ends while this
//     screen is still mounted, navigate back to the bracket.
//   - Reconnect safety net: on socket 'connect', re-fetch tournament
//     state and re-emit createRoom so the socket rejoins the room.
//   - makeMove emit log for debugging stuck screens.
//
// APK: platform-agnostic.

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, LogOut } from 'lucide-react-native';
import {
  getSocket,
  connectToServer,
  onTournamentState,
  onTournamentScoresUpdate,
  onMatchCancelled,
  onTournamentError,
  onRoundComplete,
  getTournamentFromServer,
  type Tournament,
  type TournamentScoresPayload,
} from '../services/multiplayer';
import { getAccessToken } from '../services/supabase';
import { useSettingsStore } from '../store/settingsStore';
import { useAvatarStore } from '../store/avatarStore';
import { useUserStore } from '../store/userStore';
import { ALL_MOVES, MOVE_ICONS, MOVE_NAMES, Move } from '../engine/GameEngine';
import {
  startGameMusic,
  stopMusic,
  playSound,
  playCelebrationSequence,
  stopCelebration,
} from '../services/audio';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import RecentMovesTrail from '../components/RecentMovesTrail';
import LiveScoreboardStrip, {
  ScoreEntry,
} from '../components/LiveScoreboardStrip';
import TournamentChatPanel from '../components/TournamentChatPanel';
import { showAlert } from '../utils/alert';

interface ChatMessage {
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

const DEFAULT_WIN_TARGET = 30;

export default function TournamentMatchScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const params = route.params || {};
  const tournamentId: string = params.tournamentId || '';
  const matchId: string = params.matchId || '';
  const roomCode: string = params.roomCode || '';
  const initialOpponentUserId: string = params.opponentUserId || '';

  const { identity } = useUserStore();
  const myUserId = identity?.userId || '';
  const myPlayerName = identity?.username || 'Player';

  const { vibrationEnabled } = useSettingsStore();
  const { getSelectedAvatar } = useAvatarStore();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [winTarget, setWinTarget] = useState<number>(DEFAULT_WIN_TARGET);

  const [myMove, setMyMove] = useState<Move | null>(null);
  const [opponentMove, setOpponentMove] = useState<Move | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [myTies, setMyTies] = useState(0);
  const [opponentTies, setOpponentTies] = useState(0);
  const [round, setRound] = useState(0);
  const [winner, setWinner] = useState<'win' | 'lose' | 'tie' | null>(null);
  const [opponentName, setOpponentName] = useState<string>('Opponent');
  const [waiting, setWaiting] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [disconnected, setDisconnected] = useState(false);
  const [matchOver, setMatchOver] = useState(false);
  const [iWonMatch, setIWonMatch] = useState(false);
  const [scoresByMatch, setScoresByMatch] = useState<TournamentScoresPayload>({});
  const [errorBanner, setErrorBanner] = useState<string>('');

  const [myRecentMoves, setMyRecentMoves] = useState<Move[]>([]);
  const [opponentRecentMoves, setOpponentRecentMoves] = useState<Move[]>([]);
  const opponentSocketIdRef = useRef<string | null>(null);
  const mySocketIdRef = useRef<string>('');

  // Two separate guards:
  //   navigatedAwayRef — set once when the celebration/overlay starts,
  //     prevents it from firing twice.
  //   navigationScheduledRef — set once when we schedule navigation,
  //     prevents double-scheduling. Navigation itself always fires.
  const navigatedAwayRef = useRef(false);
  const navigationScheduledRef = useRef(false);

  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAvatarMode = tournament?.type === 'avatar';

  const buildPersonalityPayload = () => {
    const avatar = getSelectedAvatar();
    return avatar?.personality ?? 'adaptive';
  };

    const navigateBack = () => {
    console.log('[TOURNAMENT MATCH] navigating back to bracket');
    try {
      navigation.replace('TournamentBracket', { tournamentId });
      console.log('[TOURNAMENT MATCH] replace dispatched');
    } catch (e: any) {
      console.log('[TOURNAMENT MATCH] navigate back threw:', e?.message || e);
    }
  };

  // ─── Mount ───
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      console.log(
        '[TOURNAMENT MATCH] mount | tournament:', tournamentId,
        '| match:', matchId, '| room:', roomCode,
        '| opponent:', initialOpponentUserId,
        '| myUserId:', myUserId,
        '| initial winTarget:', winTarget
      );

      if (!getSocket()?.connected) {
        try {
          await connectToServer(getAccessToken);
          console.log('[TOURNAMENT MATCH] connected | socket:', getSocket()?.id);
        } catch (e: any) {
          console.log('[TOURNAMENT MATCH] connect failed:', e?.message || e);
          if (!cancelled) {
            showAlert('Error', 'Could not connect to server');
            navigation.goBack();
          }
          return;
        }
      }

      const socket = getSocket();
      if (!socket || cancelled) return;

      mySocketIdRef.current = socket.id || '';

      socket.emit('enterMatchScreen', { roomCode });

      const emitCreateRoom = () => {
        console.log(
          '[TOURNAMENT MATCH] emitting createRoom | room:', roomCode,
          '| tournamentId:', tournamentId,
          '| matchId:', matchId,
          '| battleMode:', isAvatarMode ? 'avatar' : 'human'
        );
        socket.emit('createRoom', {
          name: myPlayerName,
          battleMode: isAvatarMode ? 'avatar' : 'human',
          avatarPersonality: isAvatarMode ? buildPersonalityPayload() : null,
          tournamentId,
          tournamentMatchId: matchId,
          roomCode,
        });
      };

      emitCreateRoom();

      getTournamentFromServer({ tournamentId }).then((t) => {
        if (cancelled) return;
        if (t) {
          console.log(
            '[TOURNAMENT MATCH] initial state | winTarget:', t.winTarget,
            '| type:', t.type,
            '| round:', t.currentRound,
            '| status:', t.status
          );
          setTournament(t);
          if (typeof t.winTarget === 'number') setWinTarget(t.winTarget);
          if (initialOpponentUserId && t.usernames?.[initialOpponentUserId]) {
            setOpponentName(t.usernames[initialOpponentUserId]);
          }
        } else {
          console.log('[TOURNAMENT MATCH] initial state NULL — using default winTarget', DEFAULT_WIN_TARGET);
        }
      });

      // Reconnect safety net: if the socket reconnects mid-match, we
      // need to rejoin the room and re-sync state.
      const onReconnect = () => {
        if (cancelled) return;
        console.log('[TOURNAMENT MATCH] socket reconnected — re-joining room');
        mySocketIdRef.current = getSocket()?.id || '';
        emitCreateRoom();
        getTournamentFromServer({ tournamentId }).then((t) => {
          if (cancelled || !t) return;
          setTournament(t);
          if (typeof t.winTarget === 'number') setWinTarget(t.winTarget);
        });
      };
      socket.on('connect', onReconnect);

      // Keep a handle so cleanup can remove it.
      (setup as any).__cleanup = () => {
        socket.off('connect', onReconnect);
      };
    };

    setup();

    return () => {
      cancelled = true;
      console.log('[TOURNAMENT MATCH] unmount');
      const s = getSocket();
      if (s) {
        s.emit('leaveMatchScreen', { roomCode });
      }
      const c = (setup as any).__cleanup;
      if (typeof c === 'function') c();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, tournamentId, matchId]);

  // ─── Audio ───
    // ─── Audio ───
  useEffect(() => {
    startGameMusic();
    return () => {
      stopMusic();
      // Do NOT stop the celebration on unmount — the sequence plays
      // to completion even after we navigate away.
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

    // ─── If the match is already complete, leave immediately ───
  // Handles the case where matchAssigned fires for a match that has
  // already resolved on the server (fast rounds, or a reconnect).
  useEffect(() => {
    if (!tournament) return;
    if (navigationScheduledRef.current) return;
    const lastRound = tournament.rounds?.[tournament.rounds.length - 1];
    if (!lastRound) return;
    const m = lastRound.matches.find((x) => x.matchId === matchId);
    if (!m) return;
    if (m.status === 'complete' || m.winner) {
      console.log('[TOURNAMENT MATCH] match already complete — leaving');
      scheduleNavigation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament, matchId]);

  // ─── Waiting timeout ───
  // If we've been waiting for the opponent for 20 seconds with no
  // other progress, surface a Leave Match button.
  const [stuckWaiting, setStuckWaiting] = useState(false);
  useEffect(() => {
    if (!waiting) {
      setStuckWaiting(false);
      return;
    }
    const t = setTimeout(() => setStuckWaiting(true), 20000);
    return () => clearTimeout(t);
  }, [waiting]);

  useEffect(() => {
    if (winner) {
      if (winner === 'win') playSound('success');
      else if (winner === 'lose') playSound('fail');
      else playSound('tie');
    }
  }, [winner]);

  // ─── Tournament subscriptions ───
  useEffect(() => {
    const offState = onTournamentState((t) => {
      if (t.id !== tournamentId) return;
      setTournament(t);
      if (typeof t.winTarget === 'number' && t.winTarget !== winTarget) {
        console.log(
          '[TOURNAMENT MATCH] winTarget update from state:',
          winTarget, '→', t.winTarget
        );
        setWinTarget(t.winTarget);
      }
      if (initialOpponentUserId && t.usernames?.[initialOpponentUserId]) {
        setOpponentName(t.usernames[initialOpponentUserId]);
      }
    });

    const offScores = onTournamentScoresUpdate((payload) => {
      setScoresByMatch(payload);
    });

    const offCancelled = onMatchCancelled((data) => {
      console.log(
        '[TOURNAMENT MATCH] matchCancelled | reason:', data.reason,
        '| winnerId:', data.winnerId,
        '| winnerSocketId:', data.winnerSocketId
      );
      const iWon = data.winnerSocketId === mySocketIdRef.current;
      triggerMatchEnd(iWon);
    });

    // If the round this match belongs to completes while we're still
    // mounted, navigate back to the bracket. Catches the case where
    // neither matchOver nor matchCancelled reached us.
    const offRoundComplete = onRoundComplete((data) => {
      console.log(
        '[TOURNAMENT MATCH] roundComplete | round:', data.roundNumber,
        '| nextRound:', data.nextRound
      );
      // We don't track which round our match belongs to on the client
      // directly, but any roundComplete for this tournament while we're
      // on the match screen means our match is done. Navigate back.
      if (navigationScheduledRef.current) return;
      console.log(
        '[TOURNAMENT MATCH] roundComplete → scheduling navigation back'
      );
      scheduleNavigation();
    });

    const offError = onTournamentError((err) => {
      console.log('[TOURNAMENT MATCH] server error:', err.action, err.message);
      setErrorBanner(err.message);
      setTimeout(() => setErrorBanner(''), 3500);
    });

    return () => {
      offState();
      offScores();
      offCancelled();
      offRoundComplete();
      offError();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, initialOpponentUserId, winTarget]);

  // ─── Room subscriptions ───
  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      showAlert('Error', 'Not connected to server');
      navigation.goBack();
      return;
    }

    socket.on('playerJoined', (data: any) => {
      console.log('[TOURNAMENT MATCH] playerJoined | players:', data.players?.length);
      setWaiting(false);
      const opponent = data.players.find((p: any) => p.id !== mySocketIdRef.current);
      if (opponent) {
        setOpponentName(opponent.name);
        opponentSocketIdRef.current = opponent.id;
      }
    });

    socket.on('roomState', (data: any) => {
      console.log(
        '[TOURNAMENT MATCH] roomState | winTarget:', data.winTarget,
        '| round:', data.round,
        '| players:', data.players?.length
      );
      setWaiting(false);
      const mySockId = mySocketIdRef.current;
      const opponent = data.players.find((p: any) => p.id !== mySockId);
      if (opponent) {
        setOpponentName(opponent.name);
        opponentSocketIdRef.current = opponent.id;
      }
      if (data.scores) {
        setMyScore(data.scores[mySockId] || 0);
        const oppSockId = Object.keys(data.scores).find((id) => id !== mySockId);
        setOpponentScore(oppSockId ? data.scores[oppSockId] : 0);
      }
      if (data.ties) {
        setMyTies(data.ties[mySockId] || 0);
        const oppSockId = Object.keys(data.ties).find((id) => id !== mySockId);
        setOpponentTies(oppSockId ? data.ties[oppSockId] : 0);
      }
      if (typeof data.round === 'number') setRound(data.round);
      if (typeof data.winTarget === 'number' && data.winTarget !== winTarget) {
        console.log(
          '[TOURNAMENT MATCH] winTarget update from roomState:',
          winTarget, '→', data.winTarget
        );
        setWinTarget(data.winTarget);
      }
      if (data.recentMoves) applyRecentMoves(data.recentMoves);
    });

    socket.on('roomReady', (data: any) => {
      console.log('[TOURNAMENT MATCH] roomReady | players:', data.players?.length);
      if (data.recentMoves) applyRecentMoves(data.recentMoves);
      if (data.players) {
        const opponent = data.players.find(
          (p: any) => p.id !== mySocketIdRef.current
        );
        if (opponent) {
          setOpponentName(opponent.name);
          opponentSocketIdRef.current = opponent.id;
        }
      }
    });

    socket.on('playerMoved', () => setWaiting(false));

    socket.on('newMessage', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('roundResult', (data: any) => {
      console.log(
        '[TOURNAMENT MATCH] roundResult | result:', data.result,
        '| round:', data.round,
        '| matchOver:', data.matchOver,
        '| matchWinner:', data.matchWinner,
        '| winTarget:', data.winTarget
      );
      setWaiting(false);

      const mySockId = mySocketIdRef.current;
      const myMoveValue = data.moves[mySockId];
      const oppSockId = Object.keys(data.moves).find((id) => id !== mySockId);
      const opponentMoveValue = oppSockId ? data.moves[oppSockId] : null;
      if (oppSockId) opponentSocketIdRef.current = oppSockId;

      setMyMove(myMoveValue);
      setOpponentMove(opponentMoveValue);

      const result = data.result;
      if (result === 'p1' || result === 'p2') {
        const iAmP1 = Object.keys(data.moves)[0] === mySockId;
        const iWon = (result === 'p1' && iAmP1) || (result === 'p2' && !iAmP1);
        setWinner(iWon ? 'win' : 'lose');
        if (vibrationEnabled && !isAvatarMode) {
          Vibration.vibrate(iWon ? [0, 200, 100, 200] : [0, 300]);
        }
      } else {
        setWinner('tie');
      }

      setMyScore(data.scores[mySockId] || 0);
      const oppSockId2 = Object.keys(data.scores).find((id) => id !== mySockId);
      setOpponentScore(oppSockId2 ? data.scores[oppSockId2] : 0);
      setMyTies(data.ties?.[mySockId] || 0);
      setOpponentTies(oppSockId2 ? data.ties?.[oppSockId2] || 0 : 0);
      if (typeof data.round === 'number') setRound(data.round);
      if (typeof data.winTarget === 'number' && data.winTarget !== winTarget) {
        console.log(
          '[TOURNAMENT MATCH] winTarget update from roundResult:',
          winTarget, '→', data.winTarget
        );
        setWinTarget(data.winTarget);
      }

      if (data.recentMoves) applyRecentMoves(data.recentMoves);

      if (data.matchOver && data.matchWinner) {
        const iWon = data.matchWinner === mySockId;
        console.log('[TOURNAMENT MATCH] match over | iWon:', iWon);
        setTimeout(() => triggerMatchEnd(iWon), 1200);
      } else {
        setTimeout(() => {
          setMyMove(null);
          setOpponentMove(null);
          setWinner(null);
        }, isAvatarMode ? 1200 : 2000);
      }
    });

    socket.on('gameReset', (data: any) => {
      console.log('[TOURNAMENT MATCH] gameReset');
      const mySockId = mySocketIdRef.current;
      setMyScore(data.scores?.[mySockId] || 0);
      setOpponentScore(0);
      setMyTies(0);
      setOpponentTies(0);
      setRound(0);
      setMyMove(null);
      setOpponentMove(null);
      setWinner(null);
      setMatchOver(false);
      setIWonMatch(false);
      stopCelebration();
      if (data.recentMoves) {
        applyRecentMoves(data.recentMoves);
      } else {
        setMyRecentMoves([]);
        setOpponentRecentMoves([]);
      }
    });

    socket.on('opponentDisconnected', () => {
      console.log('[TOURNAMENT MATCH] opponentDisconnected');
      setDisconnected(true);
      if (countdownRef.current) clearInterval(countdownRef.current);
    });

    socket.on('opponentTimedOut', (data: any) => {
      console.log(
        '[TOURNAMENT MATCH] opponentTimedOut | winnerId:', data.winnerId,
        '| mySocket:', mySocketIdRef.current
      );
      setDisconnected(false);
      if (countdownRef.current) clearInterval(countdownRef.current);
      const iWon = data.winnerId === mySocketIdRef.current;
      triggerMatchEnd(iWon);
    });

    socket.on('playerLeft', () => {
      console.log('[TOURNAMENT MATCH] playerLeft');
      showAlert('Opponent Left', 'Your opponent left the match', [
        { text: 'OK', onPress: () => handleLeave() },
      ]);
    });

    return () => {
      socket.off('playerJoined');
      socket.off('roomState');
      socket.off('roomReady');
      socket.off('playerMoved');
      socket.off('newMessage');
      socket.off('roundResult');
      socket.off('gameReset');
      socket.off('opponentDisconnected');
      socket.off('opponentTimedOut');
      socket.off('playerLeft');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAvatarMode, vibrationEnabled]);

  const applyRecentMoves = (payload: any) => {
    if (!payload) return;
    const mySockId = mySocketIdRef.current;
    const myList: Move[] = payload[mySockId] || [];
    const oppSockId =
      opponentSocketIdRef.current ||
      Object.keys(payload).find((id) => id !== mySockId) ||
      null;
    if (oppSockId) opponentSocketIdRef.current = oppSockId;
    const oppList: Move[] = oppSockId ? payload[oppSockId] || [] : [];

    setMyRecentMoves([...myList].reverse());
    setOpponentRecentMoves([...oppList].reverse());
  };

  // ─── Navigation scheduling ───
  // Idempotent: only fires once. Navigation itself always runs even
  // if navigatedAwayRef is already set from a previous triggerMatchEnd.
    const scheduleNavigation = (delayMs: number = 1800) => {
    if (navigationScheduledRef.current) {
      console.log('[TOURNAMENT MATCH] navigation already scheduled — skipping');
      return;
    }
    navigationScheduledRef.current = true;

    // Primary attempt.
    setTimeout(() => {
      console.log('[TOURNAMENT MATCH] navigate attempt 1');
      navigateBack();
    }, delayMs);

    // Fallback: if we're still mounted, navigate again.
    // navigation.replace to the same screen is a no-op if already done.
    setTimeout(() => {
      console.log('[TOURNAMENT MATCH] navigate attempt 2 (fallback)');
      navigateBack();
    }, delayMs + 3200);
  };

    const triggerMatchEnd = async (iWon: boolean) => {
    // Celebration / overlay only fires once.
    if (!navigatedAwayRef.current) {
      navigatedAwayRef.current = true;
      console.log('[TOURNAMENT MATCH] triggerMatchEnd | iWon:', iWon);
      setMatchOver(true);
      setIWonMatch(iWon);
      stopMusic();

      // playCelebrationSequence resolves immediately (the sequence
      // continues in the background). It calls onComplete when the
      // full sequence finishes. Navigate at that point so the music
      // plays uninterrupted.
      playCelebrationSequence(iWon, () => {
        console.log('[TOURNAMENT MATCH] celebration finished — navigating');
        scheduleNavigation(0);
      }).catch(() => {
        // Fallback: navigate immediately if the sequence fails.
        scheduleNavigation(0);
      });

      // Safety net in case onComplete never fires (rare).
      setTimeout(() => {
        if (navigationScheduledRef.current) return;
        console.log('[TOURNAMENT MATCH] celebration onComplete timeout — navigating');
        scheduleNavigation(0);
      }, 8000);

      return;
    }

    console.log(
      '[TOURNAMENT MATCH] triggerMatchEnd — celebration already fired, only scheduling navigation'
    );
    scheduleNavigation();
  };

  const handleMove = (move: Move) => {
    if (isAvatarMode) return;
    if (myMove || matchOver) return;
    const socket = getSocket();
    if (!socket) return;
    setMyMove(move);
    playSound('click');
    if (vibrationEnabled) Vibration.vibrate(10);
    console.log('[TOURNAMENT MATCH] makeMove emit | move:', move);
    socket.emit('makeMove', { move });
  };

  const handleLeave = () => {
    if (!navigatedAwayRef.current) {
      navigatedAwayRef.current = true;
      stopCelebration();
    }
    if (!navigationScheduledRef.current) {
      navigationScheduledRef.current = true;
      console.log('[TOURNAMENT MATCH] handleLeave — navigating back');
      navigateBack();
    }
  };

  const getResultText = () => {
    if (winner === 'win') return '🎉 You Win!';
    if (winner === 'lose') return '😢 You Lose';
    if (winner === 'tie') return '🤝 Tie!';
    return '';
  };

  const displayName = (uid: string): string => {
    if (!uid) return 'Player';
    if (uid === myUserId) return myPlayerName;
    const fromMap = tournament?.usernames?.[uid];
    if (fromMap) return fromMap;
    const trimmed = uid.replace(/-/g, '');
    return 'Player ' + trimmed.slice(-6).toUpperCase();
  };

  const buildScoreEntries = (): ScoreEntry[] => {
    if (!tournament || !tournament.rounds?.length) return [];
    const lastRound = tournament.rounds[tournament.rounds.length - 1];
    if (!lastRound || !lastRound.matches?.length) return [];
    const entries: ScoreEntry[] = [];
    for (const m of lastRound.matches) {
      entries.push({
        matchId: m.matchId,
        p1UserId: m.p1,
        p2UserId: m.p2,
        p1Name: displayName(m.p1),
        p2Name: displayName(m.p2),
        p1Score: m.scores?.p1 ?? 0,
        p2Score: m.scores?.p2 ?? 0,
        p1Color: tournament.colorMap?.[m.p1] || null,
        p2Color: tournament.colorMap?.[m.p2] || null,
        status: m.status,
        winnerUserId: m.winner || null,
      });
    }
    return entries;
  };

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleLeave} style={styles.headerBtn}>
            <ChevronLeft size={22} color="#e94560" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {tournament?.name || 'Tournament Match'}
            </Text>
                        <Text style={styles.headerSubtitle}>
              {isAvatarMode
                ? `🤖 Avatar Arena · First to ${winTarget}`
                : `First to ${winTarget} wins`}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLeave} style={styles.headerBtn}>
            <LogOut size={18} color="#8a8a9a" />
          </TouchableOpacity>
        </View>

        {disconnected ? (
          <View style={styles.disconnectBanner}>
            <Text style={styles.disconnectText}>
              ⚠️ Opponent disconnected · walkover
            </Text>
          </View>
        ) : null}

        {errorBanner ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ {errorBanner}</Text>
          </View>
        ) : null}

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          <LiveScoreboardStrip
            entries={buildScoreEntries()}
            currentUserId={myUserId}
            currentMatchId={matchId}
            title={`Round ${tournament?.currentRound || 1} scores`}
          />

          <View style={styles.scoreRow}>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreName} numberOfLines={1}>
                {myPlayerName}
              </Text>
              <Text
                style={[
                  styles.scoreValue,
                  myScore >= winTarget - 5 && styles.scoreNearWin,
                ]}
              >
                {myScore}
              </Text>
              <Text style={styles.scoreTies}>{myTies} ties</Text>
              <RecentMovesTrail moves={myRecentMoves} slots={5} size={22} />
            </View>
            <View style={styles.scoreCenter}>
              <Text style={styles.scoreVs}>⚡</Text>
              <Text style={styles.scoreRound}>R{round}</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreName} numberOfLines={1}>
                {opponentName}
              </Text>
              <Text
                style={[
                  styles.scoreValue,
                  opponentScore >= winTarget - 5 && styles.scoreNearWin,
                ]}
              >
                {opponentScore}
              </Text>
              <Text style={styles.scoreTies}>{opponentTies} ties</Text>
              <RecentMovesTrail moves={opponentRecentMoves} slots={5} size={22} />
            </View>
          </View>

          <View style={styles.moveDisplay}>
            <View style={styles.moveItem}>
              <Text style={styles.moveLabel}>
                {isAvatarMode ? '🤖 AI' : 'You'}
              </Text>
              <View style={styles.moveCircle}>
                <Text style={styles.moveIcon}>
                  {myMove ? MOVE_ICONS[myMove] : '❓'}
                </Text>
              </View>
            </View>
            <Text style={styles.moveVs}>⚡</Text>
            <View style={styles.moveItem}>
              <Text style={styles.moveLabel} numberOfLines={1}>
                {isAvatarMode ? '🤖 AI' : opponentName}
              </Text>
              <View style={styles.moveCircle}>
                <Text style={styles.moveIcon}>
                  {opponentMove ? MOVE_ICONS[opponentMove] : '❓'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.resultArea}>
            {winner && !matchOver && (
              <Text
                style={[
                  styles.resultText,
                  winner === 'win'
                    ? styles.resultWin
                    : winner === 'lose'
                    ? styles.resultLose
                    : styles.resultTie,
                ]}
              >
                {getResultText()}
              </Text>
            )}
          </View>

          {!matchOver && (
            <View style={styles.buttonsArea}>
              {isAvatarMode ? (
                <View style={styles.avatarWatchBox}>
                  <Text style={styles.avatarWatchText}>
                    🤖 Both AIs are playing…
                  </Text>
                  <Text style={styles.avatarWatchSubtext}>
                    Watch the bracket unfold
                  </Text>
                </View>
              ) : !myMove && !winner ? (
                <View style={styles.moveButtons}>
                  {ALL_MOVES.map((move) => (
                    <TouchableOpacity
                      key={move}
                      style={styles.moveButton}
                      onPress={() => handleMove(move)}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.moveBtnIcon}>{MOVE_ICONS[move]}</Text>
                      <Text style={styles.moveBtnName}>{MOVE_NAMES[move]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : myMove && !winner ? (
                <Text style={styles.waitingText}>⏳ Waiting for opponent…</Text>
              ) : null}
            </View>
          )}
        </ScreenScroll>

        {!matchOver && (
          <TournamentChatPanel
            tournamentId={tournamentId}
            messages={messages}
            myPlayerId={mySocketIdRef.current}
            myPlayerName={myPlayerName}
          />
        )}

                {matchOver && (
          <View style={styles.matchOverOverlay}>
            <View style={styles.matchOverContent}>
              <Text style={styles.matchOverEmoji}>{iWonMatch ? '🏆' : '💀'}</Text>
              <Text
                style={[
                  styles.matchOverTitle,
                  iWonMatch ? styles.matchOverWin : styles.matchOverLose,
                ]}
              >
                {iWonMatch ? 'YOU WIN!' : 'YOU LOSE'}
              </Text>
              <Text style={styles.matchOverScore}>
                {myScore} — {opponentScore}
              </Text>
              <Text style={styles.matchOverSub}>
                Returning to bracket…
              </Text>

              <TouchableOpacity
                style={styles.forceReturnBtn}
                onPress={() => {
                  console.log('[TOURNAMENT MATCH] user tapped Return to Bracket');
                  navigateBack();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.forceReturnBtnText}>
                  Return to Bracket
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {stuckWaiting && !matchOver && (
          <View style={styles.stuckBanner}>
            <Text style={styles.stuckBannerText}>
              Still waiting for opponent…
            </Text>
            <TouchableOpacity
              style={styles.leaveStuckBtn}
              onPress={() => {
                console.log('[TOURNAMENT MATCH] user tapped Leave Match');
                handleLeave();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.leaveStuckBtnText}>Leave Match</Text>
            </TouchableOpacity>
          </View>
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
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerBtn: { padding: 6 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  headerSubtitle: {
    fontSize: 10,
    color: '#fbbf24',
    marginTop: 1,
    fontWeight: '600',
  },
  disconnectBanner: {
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
  disconnectText: { fontSize: 12, color: '#fbbf24', fontWeight: '700' },
  errorBanner: {
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderColor: 'rgba(248, 113, 113, 0.4)',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginTop: 6,
    borderRadius: 10,
    alignItems: 'center',
  },
  errorBannerText: { fontSize: 12, color: '#f87171', fontWeight: '700' },
  scrollContent: { paddingBottom: 120 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  scoreItem: { alignItems: 'center', flex: 1 },
  scoreName: {
    fontSize: 10,
    color: '#5a5a7a',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  scoreValue: { fontSize: 26, fontWeight: '800', color: '#ffffff', marginTop: 2 },
  scoreNearWin: { color: '#fbbf24' },
  scoreTies: { fontSize: 10, color: '#5a5a7a', marginTop: 1 },
  scoreCenter: { alignItems: 'center', paddingHorizontal: 8, paddingTop: 8 },
  scoreVs: { fontSize: 16, color: '#e94560' },
  scoreRound: { fontSize: 10, color: '#5a5a7a', marginTop: 2 },
  moveDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  moveItem: { alignItems: 'center', flex: 1 },
  moveLabel: {
    fontSize: 10,
    color: '#5a5a7a',
    textTransform: 'uppercase',
    marginBottom: 4,
    fontWeight: '600',
  },
  moveCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  moveIcon: { fontSize: 28 },
  moveVs: { fontSize: 18, color: '#5a5a7a', marginHorizontal: 6 },
  resultArea: { alignItems: 'center', paddingVertical: 6, minHeight: 34 },
  resultText: { fontSize: 20, fontWeight: '800' },
  resultWin: { color: '#4ade80' },
  resultLose: { color: '#f87171' },
  resultTie: { color: '#fbbf24' },
  buttonsArea: {
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 12,
  },
  moveButtons: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  moveButton: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    width: 76,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  moveBtnIcon: { fontSize: 28, marginBottom: 2 },
  moveBtnName: {
    fontSize: 10,
    color: '#5a5a7a',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  waitingText: { fontSize: 13, color: '#5a5a7a', textAlign: 'center' },
  avatarWatchBox: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  avatarWatchText: {
    fontSize: 16,
    color: '#a78bfa',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  avatarWatchSubtext: { fontSize: 11, color: '#5a5a7a', fontWeight: '600' },
  matchOverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 15, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  matchOverContent: { alignItems: 'center', paddingHorizontal: 32, gap: 10 },
  matchOverEmoji: { fontSize: 72 },
  matchOverTitle: { fontSize: 42, fontWeight: '900', letterSpacing: 2 },
  matchOverWin: { color: '#4ade80' },
  matchOverLose: { color: '#f87171' },
  matchOverScore: {
    fontSize: 20,
    color: '#8a8a9a',
    fontWeight: '700',
    marginTop: 4,
  },
    matchOverSub: {
    fontSize: 12,
    color: '#5a5a7a',
    fontWeight: '700',
    marginTop: 12,
    letterSpacing: 0.5,
  },
  forceReturnBtn: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#e94560',
  },
  forceReturnBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  stuckBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 90,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    zIndex: 900,
  },
  stuckBannerText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  leaveStuckBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fbbf24',
  },
  leaveStuckBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
});