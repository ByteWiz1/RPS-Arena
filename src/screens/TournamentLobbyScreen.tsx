// src/screens/TournamentLobbyScreen.tsx
//
// RPS Arena — tournament lobby.
//
// Chat 11d fixes:
//   - Reconnect safety net: on socket 'connect', re-fetch tournament
//     state. The server joins the socket to the tournament room inside
//     getTournament, so broadcasts (state updates, host changes,
//     tournamentStarted) resume reaching this screen after a reconnect.
//
// Cleanup pattern (applies to all tournament screens):
//   `setup` is an async function that returns its cleanup function.
//   It must be typed `Promise<(() => void) | undefined>` and must
//   return `undefined` on the branches that bail early (connect
//   failure, cancelled before listeners attach). The `.then()`
//   callback checks `cancelled` first — if the component unmounted
//   while `setup` was still resolving, we run cleanup immediately.
//   Otherwise we stash it and let the outer `useEffect` cleanup run it
//   on the next unmount.
//
// APK: platform-agnostic.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ChevronLeft,
  Copy,
  Check,
  Play,
  Crown,
} from 'lucide-react-native';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import TournamentChatPanel from '../components/TournamentChatPanel';
import { startGameMusic, stopMusic, playSound } from '../services/audio';
import {
  connectToServer,
  getSocket,
  startTournamentOnServer,
  leaveTournamentOnServer,
  getTournamentFromServer,
  onTournamentState,
  onTournamentStarted,
  onHostChanged,
  onTournamentError,
  type Tournament,
} from '../services/multiplayer';
import { getAccessToken } from '../services/supabase';
import { useUserStore } from '../store/userStore';

const win = globalThis as any;

interface ChatMessage {
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

export default function TournamentLobbyScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const tournamentId: string = route.params?.tournamentId || '';
  const code: string = route.params?.code || '';

  const { identity } = useUserStore();
  const myUserId = identity?.userId || '';
  const myPlayerName = identity?.username || 'Player';
  const mySocketIdRef = useRef<string>('');

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const isHost = tournament?.hostId === myUserId;
  const joinedCount = tournament?.players?.length ?? 0;
  const maxPlayers = tournament?.maxPlayers ?? 32;
  const canStart = joinedCount >= 2;

  // ─── Connect + listeners ───
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const setup = async (): Promise<(() => void) | undefined> => {
      console.log(
        '[TOURNAMENT LOBBY] mount | id:', tournamentId, '| code:', code,
        '| socket connected:', !!getSocket()?.connected
      );

      if (!getSocket()?.connected) {
        try {
          await connectToServer(getAccessToken);
          console.log('[TOURNAMENT LOBBY] connected | socket:', getSocket()?.id);
        } catch (e: any) {
          console.log('[TOURNAMENT LOBBY] connect failed:', e?.message || e);
          if (!cancelled) setError('Could not connect to server');
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
            '[TOURNAMENT LOBBY] initial state | players:', t.players.length,
            '| hostId:', t.hostId, '| status:', t.status
          );
          setTournament(t);
        } else {
          console.log('[TOURNAMENT LOBBY] initial state NULL');
        }
      });

      const offState = onTournamentState((t) => {
        if (cancelled) return;
        if (t.id !== tournamentId) return;
        console.log(
          '[TOURNAMENT LOBBY] state update | players:', t.players.length,
          '| hostId:', t.hostId, '| status:', t.status
        );
        setTournament(t);
      });

      const offStarted = onTournamentStarted(() => {
        if (cancelled) return;
        console.log('[TOURNAMENT LOBBY] tournamentStarted — navigating to bracket');
        navigation.replace('TournamentBracket', { tournamentId, code });
      });

      const offHost = onHostChanged(() => {
        // state refresh arrives via onTournamentState
      });

      const offError = onTournamentError((err) => {
        if (cancelled) return;
        if (err.action === 'start') {
          console.log('[TOURNAMENT LOBBY] start error:', err.message);
          setError(err.message);
          setStarting(false);
        }
      });

      // Reconnect safety net: on reconnect, re-fetch state. Server
      // rejoins the socket to the tournament room inside getTournament.
      const onReconnect = () => {
        if (cancelled) return;
        console.log('[TOURNAMENT LOBBY] socket reconnected — re-fetching state');
        getTournamentFromServer({ tournamentId }).then((t) => {
          if (cancelled || !t) return;
          console.log(
            '[TOURNAMENT LOBBY] reconnected state | players:', t.players.length,
            '| status:', t.status
          );
          setTournament(t);
        });
      };
      socket.on('connect', onReconnect);

      const onMessage = (msg: ChatMessage) => {
        setMessages((prev) => [...prev, msg]);
      };
      socket.on('newMessage', onMessage);

      return () => {
        offState();
        offStarted();
        offHost();
        offError();
        socket.off('connect', onReconnect);
        socket.off('newMessage', onMessage);
      };
    };

    setup().then((fn) => {
      if (cancelled) {
        // The component unmounted while setup was still resolving.
        // Detach listeners now.
        if (typeof fn === 'function') fn();
        return;
      }
      if (typeof fn === 'function') cleanup = fn;
    });

    return () => {
      cancelled = true;
      console.log('[TOURNAMENT LOBBY] unmount');
      if (cleanup) cleanup();
    };
  }, [tournamentId, code, navigation]);

  // ─── Audio ───
  useEffect(() => {
    startGameMusic();
    return () => {
      stopMusic();
    };
  }, []);

  // ─── Leave on unmount if still in lobby ───
  useEffect(() => {
    return () => {
      const s = getSocket();
      if (!s) return;
      if (tournament?.status === 'lobby') {
        console.log('[TOURNAMENT LOBBY] leaving tournament (lobby status)');
        leaveTournamentOnServer(tournamentId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, tournament?.status]);

  const handleCopyCode = useCallback(() => {
    if (!code) return;
    if (Platform.OS === 'web' && win.navigator?.clipboard) {
      win.navigator.clipboard.writeText(code);
    }
    playSound('click');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }, [code]);

  const buildShareLink = useCallback(() => {
    if (Platform.OS === 'web' && win.location?.origin) {
      return `${win.location.origin}/?tournament=${code}`;
    }
    return `https://rps-arena.app/?tournament=${code}`;
  }, [code]);

  const handleCopyLink = useCallback(() => {
    const link = buildShareLink();
    if (Platform.OS === 'web' && win.navigator?.clipboard) {
      win.navigator.clipboard.writeText(link);
    }
    playSound('click');
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }, [buildShareLink]);

  const handleStart = useCallback(async () => {
    if (!isHost || starting) return;
    if (!canStart) {
      setError('Need at least 2 players to start');
      return;
    }
    setError('');
    setStarting(true);
    playSound('click');
    console.log(
      '[TOURNAMENT LOBBY] emitting startTournament | id:', tournamentId,
      '| players:', joinedCount
    );
    startTournamentOnServer(tournamentId);
    setTimeout(() => {
      setStarting(false);
    }, 5000);
  }, [isHost, starting, canStart, tournamentId, joinedCount]);

  const handleLeave = useCallback(() => {
    if (tournament?.status === 'lobby') {
      leaveTournamentOnServer(tournamentId);
    }
    navigation.goBack();
  }, [tournament?.status, tournamentId, navigation]);

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

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleLeave} style={styles.headerBtn}>
            <ChevronLeft size={26} color="#e94560" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🏆 Tournament Lobby</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          <View style={styles.hostHeader}>
            <Text style={styles.hostLabel}>
              {isHost ? 'You are hosting' : 'Joined as'}
            </Text>
            <Text style={styles.hostName}>{myPlayerName}</Text>
            <Text style={styles.modeTag}>
              {tournament?.type === 'avatar'
                ? '🤖 Avatar vs Avatar'
                : '🌐 Human vs Human'}
            </Text>
            {tournament?.name ? (
              <Text style={styles.tournamentName}>{tournament.name}</Text>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>TOURNAMENT CODE</Text>

          <View style={styles.codeDisplayCard}>
            <Text style={styles.codeDisplay}>{code || '------'}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopyCode}>
              {copiedCode ? (
                <Check size={16} color="#4ade80" />
              ) : (
                <Copy size={16} color="#ffffff" />
              )}
              <Text style={styles.copyBtnText}>
                {copiedCode ? 'Copied!' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.shareLinkBtn}
            onPress={handleCopyLink}
            activeOpacity={0.75}
          >
            {copiedLink ? (
              <Check size={16} color="#4ade80" />
            ) : (
              <Copy size={16} color="#4ade80" />
            )}
            <Text style={styles.shareLinkText}>
              {copiedLink ? 'Link copied!' : 'Copy share link'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.codeHint}>
            Share this code or link. It stops working the moment the
            tournament starts.
          </Text>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>
              PLAYERS ({joinedCount}/{maxPlayers})
            </Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.playersCard}>
            {(!tournament || tournament.players.length === 0) ? (
              <View style={styles.waitingBox}>
                <ActivityIndicator color="#e94560" size="small" />
                <Text style={styles.waitingText}>Loading players…</Text>
              </View>
            ) : (
              tournament.players.map((uid, idx) => {
                const isSelf = uid === myUserId;
                const isThisHost = uid === tournament.hostId;
                const color = tournament.colorMap?.[uid] || null;
                const label = displayName(uid);
                return (
                  <View key={uid + idx} style={styles.playerRow}>
                    <View
                      style={[
                        styles.playerDot,
                        { backgroundColor: color || '#5a5a7a' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.playerName,
                        isSelf && styles.playerNameSelf,
                      ]}
                      numberOfLines={1}
                    >
                      {label}
                      {isSelf ? ' (you)' : ''}
                    </Text>
                    {isThisHost ? (
                      <View style={styles.hostBadge}>
                        <Crown size={11} color="#facc15" />
                        <Text style={styles.hostBadgeText}>host</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          {isHost ? (
            <TouchableOpacity
              style={[
                styles.startBtn,
                (!canStart || starting) && styles.startBtnDisabled,
              ]}
              onPress={handleStart}
              disabled={!canStart || starting}
              activeOpacity={0.85}
            >
              {starting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Play size={20} color="#ffffff" />
                  <Text style={styles.startBtnText}>Start Tournament</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.waitingForHostBox}>
              <ActivityIndicator color="#4facfe" size="small" />
              <Text style={styles.waitingForHostText}>
                Waiting for host to start…
              </Text>
            </View>
          )}

          {!canStart && isHost ? (
            <Text style={styles.hintBelowBtn}>
              At least 2 players are needed to start.
            </Text>
          ) : null}
        </ScreenScroll>

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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  hostHeader: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(250, 204, 21, 0.06)',
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.18)',
  },
  hostLabel: {
    fontSize: 10,
    color: '#8a8a9a',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  hostName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 4,
  },
  modeTag: {
    fontSize: 12,
    color: '#facc15',
    marginTop: 6,
    fontWeight: '700',
  },
  tournamentName: {
    fontSize: 13,
    color: '#8a8a9a',
    marginTop: 6,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5a5a7a',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  codeDisplayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(250, 204, 21, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.3)',
    marginBottom: 8,
  },
  codeDisplay: {
    fontSize: 32,
    fontWeight: '900',
    color: '#facc15',
    letterSpacing: 6,
    flex: 1,
    textAlign: 'center',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  copyBtnText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },
  shareLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.25)',
    marginBottom: 8,
  },
  shareLinkText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '700',
  },
  codeHint: {
    fontSize: 11,
    color: '#8a8a9a',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
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
  playersCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  playerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  playerName: {
    flex: 1,
    fontSize: 13,
    color: '#c4c4d4',
    fontWeight: '700',
  },
  playerNameSelf: {
    color: '#ffffff',
  },
  hostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
  },
  hostBadgeText: {
    fontSize: 10,
    color: '#facc15',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  waitingBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  waitingText: {
    fontSize: 12,
    color: '#8a8a9a',
  },
  errorBox: {
    marginTop: 4,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e94560',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  startBtnDisabled: {
    opacity: 0.5,
  },
  startBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  waitingForHostBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(79, 172, 254, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.25)',
    marginTop: 4,
  },
  waitingForHostText: {
    color: '#4facfe',
    fontSize: 13,
    fontWeight: '700',
  },
  hintBelowBtn: {
    fontSize: 11,
    color: '#8a8a9a',
    textAlign: 'center',
    marginTop: 8,
  },
});