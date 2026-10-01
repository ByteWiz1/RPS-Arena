// src/screens/TournamentMatchScreen.tsx
//
// RPS Arena — tournament match.
//
// Bug-fix pass changes:
//   B6   unmount does NOT emit leaveRoom — that would remove the user
//        from the tournament on every navigation. Only leaveMatchScreen
//        is emitted (presence status reset).
//   B12  opponentTimedOut handles both win and loss.
//   B21  does not send winTarget in createRoom — server is authority.
//   B22  opponent name read from tournament.usernames.
//   new  listens for matchCancelled (walkover/elimination path) and
//        navigates back to the bracket.

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

  const [myRecentMoves, setMyRecentMoves] = useState<Move[]>([]);
  const [opponentRecentMoves, setOpponentRecentMoves] = useState<Move[]>([]);
  const opponentSocketIdRef = useRef<string | null>(null);
  const mySocketIdRef = useRef<string>('');
  const navigatedAwayRef = useRef(false);

  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAvatarMode = tournament?.type === 'avatar';

  const buildPersonalityPayload = () => {
    const avatar = getSelectedAvatar();
    return avatar?.personality ?? 'adaptive';
  };

  // ─── Mount: enterMatchScreen + createRoom (after state arrives) ───
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      if (!getSocket()?.connected) {
        try {
          await connectToServer(getAccessToken);
        } catch {
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

      console.log(
        '[TOURNAMENT MATCH] Mounting — tournament', tournamentId,
        'match', matchId, 'room', roomCode, 'as', myUserId
      );

      socket.emit('enterMatchScreen', { roomCode });

      // Pull initial tournament state first. This gives us the
      // authoritative winTarget and usernames before we send
      // createRoom.
      const t = await getTournamentFromServer({ tournamentId });
      if (cancelled) return;
      if (t) {
        setTournament(t);
        if (typeof t.winTarget === 'number') setWinTarget(t.winTarget);
        // B22: seed opponent name from usernames map.
        if (initialOpponentUserId && t.usernames?.[initialOpponentUserId]) {
          setOpponentName(t.usernames[initialOpponentUserId]);
        }
      }

      // Now emit createRoom. B21: no winTarget in the payload.
      socket.emit('createRoom', {
        name: myPlayerName,
        battleMode: isAvatarMode ? 'avatar' : 'human',
        avatarPersonality: isAvatarMode ? buildPersonalityPayload() : null,
        tournamentId,
        tournamentMatchId: matchId,
        roomCode,
      });
    };

    setup();

    return () => {
      cancelled = true;
      console.log('[TOURNAMENT MATCH] Unmounting — emitting leaveMatchScreen only');
      const s = getSocket();
      if (s) {
        // B6: do NOT emit leaveRoom here. Only reset presence.
        s.emit('leaveMatchScreen', { roomCode });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, tournamentId, matchId]);

  // ─── Audio ───
  useEffect(() => {
    startGameMusic();
    return () => {
      stopMusic();
      stopCelebration();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

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
      if (typeof t.winTarget === 'number') setWinTarget(t.winTarget);
      // B22: refresh opponent name if it arrives late.
      if (initialOpponentUserId && t.usernames?.[initialOpponentUserId]) {
        setOpponentName(t.usernames[initialOpponentUserId]);
      }
    });
    const offScores = onTournamentScoresUpdate((payload) => {
      setScoresByMatch(payload);
    });
    return () => {
      offState();
      offScores();
    };
  }, [tournamentId, initialOpponentUserId]);

  // ─── Room subscriptions ───
  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      showAlert('Error', 'Not connected to server');
      navigation.goBack();
      return;
    }

    socket.on('playerJoined', (data: any) => {
      setWaiting(false);
      const opponent = data.players.find((p: any) => p.id !== mySocketIdRef.current);
      if (opponent) {
        setOpponentName(opponent.name);
        opponentSocketIdRef.current = opponent.id;
      }
    });

    socket.on('roomState', (data: any) => {
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
      if (typeof data.winTarget === 'number') setWinTarget(data.winTarget);
      if (data.recentMoves) applyRecentMoves(data.recentMoves);
    });

    socket.on('roomReady', (data: any) => {
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
      if (typeof data.winTarget === 'number') setWinTarget(data.winTarget);

      if (data.recentMoves) applyRecentMoves(data.recentMoves);

      if (data.matchOver && data.matchWinner) {
        const iWon = data.matchWinner === mySockId;
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
      setDisconnected(true);
    });

    // B12: both win and loss paths route back to the bracket.
    socket.on('opponentTimedOut', (data: any) => {
      setDisconnected(false);
      if (countdownRef.current) clearInterval(countdownRef.current);
      const iWon = data.winnerId === mySocketIdRef.current;
      triggerMatchEnd(iWon);
    });

    // New: tournament engine cancelled the match (walkover / active
    // elimination). Navigate away regardless of winner.
    socket.on('matchCancelled', (data: any) => {
      setDisconnected(false);
      if (countdownRef.current) clearInterval(countdownRef.current);
      const iWon = data.winnerSocketId === mySocketIdRef.current;
      triggerMatchEnd(iWon);
    });

    socket.on('playerLeft', () => {
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
      socket.off('matchCancelled');
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

  const triggerMatchEnd = async (iWon: boolean) => {
    if (navigatedAwayRef.current) return;
    navigatedAwayRef.current = true;

    setMatchOver(true);
    setIWonMatch(iWon);
    stopMusic();
    try {
      await playCelebrationSequence(iWon);
    } catch {}

    setTimeout(() => {
      navigation.replace('TournamentBracket', { tournamentId });
    }, 1800);
  };

  const handleMove = (move: Move) => {
    if (isAvatarMode) return;
    if (myMove || matchOver) return;
    const socket = getSocket();
    if (!socket) return;
    setMyMove(move);
    playSound('click');
    if (vibrationEnabled) Vibration.vibrate(10);
    socket.emit('makeMove', { move });
  };

  const handleLeave = () => {
    if (navigatedAwayRef.current) return;
    navigatedAwayRef.current = true;
    stopCelebration();
    navigation.replace('TournamentBracket', { tournamentId });
  };

  const getResultText = () => {
    if (winner === 'win') return '🎉 You Win!';
    if (winner === 'lose') return '😢 You Lose';
    if (winner === 'tie') return '🤝 Tie!';
    return '';
  };

  // B22: resolve a display name for a userId.
  const displayName = (uid: string): string => {
    if (!uid) return 'Player';
    if (uid === myUserId) return myPlayerName;
    const fromMap = tournament?.usernames?.[uid];
    if (fromMap) return fromMap;
    const trimmed = uid.replace(/-/g, '');
    return 'Player ' + trimmed.slice(-6).toUpperCase();
  };

  const buildScoreEntries = (): ScoreEntry[] => {
    if (!tournament) return [];
    const entries: ScoreEntry[] = [];
    const roundEntries = Object.entries(scoresByMatch);

    for (const [mId, s] of roundEntries) {
      const p1Name = displayName(s.p1);
      const p2Name = displayName(s.p2);
      const p1Color = tournament.colorMap?.[s.p1] || null;
      const p2Color = tournament.colorMap?.[s.p2] || null;
      entries.push({
        matchId: mId,
        p1UserId: s.p1,
        p2UserId: s.p2,
        p1Name,
        p2Name,
        p1Score: s.scores?.p1 ?? 0,
        p2Score: s.scores?.p2 ?? 0,
        p1Color,
        p2Color,
        status: s.status,
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
                ? '🤖 Avatar vs Avatar'
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
              <Text style={styles.matchOverSub}>Returning to bracket…</Text>
            </View>
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
});