import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  LogIn,
  Search,
  UserPlus,
  Circle,
  Copy,
  Check,
  Loader,
} from 'lucide-react-native';
import { connectToServer, getSocket } from '../services/multiplayer';
import { startGameMusic, stopMusic } from '../services/audio';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import OnlineUsersList from '../components/OnlineUsersList';
import { useOnlineStore } from '../store/onlineStore';
import { useBattleStore } from '../store/battleStore';
import { useUserStore } from '../store/userStore';

type Mode = 'main' | 'host' | 'join';

const win = globalThis as any;

export default function OnlineLobbyScreen() {
  const navigation = useNavigation<any>();
  const battleMode = useBattleStore((s) => s.mode);
  const { users, count } = useOnlineStore();
  const { identity } = useUserStore();

  // Prefilled, read-only username
  const playerName = identity?.username || 'Player';
  const playerUserId = identity?.userId || '';

  const [mode, setMode] = useState<Mode>('main');
  const [createCode, setCreateCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [hostCode, setHostCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [serverError, setServerError] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [recentOpponents, setRecentOpponents] = useState<any[]>([]);
  const [inviteStatus, setInviteStatus] = useState<string>('');
  const [pendingInviteId, setPendingInviteId] = useState<string | null>(null);

  useEffect(() => {
    console.log('[LOBBY] battleMode from store:', battleMode);
    console.log('[LOBBY] identity:', playerName, playerUserId);
  }, [battleMode, playerName, playerUserId]);

  useEffect(() => {
    startGameMusic();
    setupListeners();
    // Force refresh online list + count on mount
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('getOnlineUsers');
      socket.emit('getOnlineCount');
    }
    return () => {
      stopMusic();
      teardownListeners();
    };
  }, []);

  const setupListeners = () => {
    const socket = getSocket();
    if (!socket) {
      // Socket not ready yet — retry shortly
      setTimeout(setupListeners, 500);
      return;
    }

    socket.on('inviteDeclined', () => {
      setInviteStatus('Player declined your invite');
      setPendingInviteId(null);
      setTimeout(() => setInviteStatus(''), 3000);
    });
    socket.on('inviteExpired', () => {
      setInviteStatus('Invite expired');
      setPendingInviteId(null);
      setTimeout(() => setInviteStatus(''), 3000);
    });
    socket.on('inviteSent', () => {
      setPendingInviteId(null);
    });
    socket.on('searchResult', (data: any) => {
      setSearching(false);
      setSearchResult(data);
    });
    socket.on('recentOpponents', (data: any) => setRecentOpponents(data));
    socket.on('hostCode', (data: any) => {
      if (data.code) setHostCode(data.code);
    });

    if (socket.connected) {
      socket.emit('getOnlineUsers');
      socket.emit('getOnlineCount');
    }
  };

  const teardownListeners = () => {
    const socket = getSocket();
    if (!socket) return;
    socket.off('inviteDeclined');
    socket.off('inviteExpired');
    socket.off('inviteSent');
    socket.off('searchResult');
    socket.off('recentOpponents');
    socket.off('hostCode');
  };

  const ensureConnected = async (): Promise<boolean> => {
    try {
      const socket = await connectToServer(identity);
      return !!socket;
    } catch {
      return false;
    }
  };

  // ─── HOST A MATCH ───
  const handleHost = async () => {
    setServerError('');
    setIsConnecting(true);
    const connected = await ensureConnected();
    if (!connected) {
      setServerError('Could not connect to server');
      setIsConnecting(false);
      return;
    }
    setupListeners();

    const socket = getSocket();
    if (!socket) {
      setIsConnecting(false);
      return;
    }

    socket.once('roomCreated', (data: any) => {
      setHostCode(data.code);
      setIsConnecting(false);
      setMode('host');
    });

    socket.once('error', (data: any) => {
      setIsConnecting(false);
      setServerError(data.message || 'Could not create room');
    });

    socket.emit('createRoom', { name: playerName, battleMode });
  };

  // ─── JOIN A MATCH (wait for invite) ───
  const handleJoinAsPlayer = async () => {
    setServerError('');
    setIsConnecting(true);
    const connected = await ensureConnected();
    if (!connected) {
      setServerError('Could not connect to server');
      setIsConnecting(false);
      return;
    }
    setupListeners();
    setMode('join');
    setIsConnecting(false);
    const socket = getSocket();
    if (socket) {
      socket.emit('getRecentOpponents');
      socket.emit('getOnlineUsers');
      socket.emit('getOnlineCount');
    }
  };

  // ─── SEARCH PLAYER ───
  const handleSearchPlayer = () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResult(null);
    const socket = getSocket();
    if (socket) socket.emit('searchPlayer', { username: searchQuery.trim() });
  };

  // ─── INVITE ───
  const handleSendInvite = (targetId: string, targetName: string) => {
    const socket = getSocket();
    if (!socket) return;
    setPendingInviteId(targetId);
    socket.emit('sendInvite', { targetId, battleMode });
    setInviteStatus(`Invite sent to ${targetName}...`);
    setTimeout(() => {
      setInviteStatus('');
      setPendingInviteId(null);
    }, 3000);
  };

  const handleCopyCode = () => {
    if (!hostCode) return;
    if (Platform.OS === 'web' && win.navigator?.clipboard) {
      win.navigator.clipboard.writeText(hostCode);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── CREATE ROOM WITH CUSTOM CODE ───
  const handleCreateRoomWithCode = async () => {
    setCodeError(false);
    setServerError('');
    if (createCode.length !== 4) {
      setCodeError(true);
      return;
    }
    setIsConnecting(true);
    const connected = await ensureConnected();
    if (!connected) {
      setServerError('Could not connect to server');
      setIsConnecting(false);
      return;
    }
    const socket = getSocket();
    if (!socket) {
      setIsConnecting(false);
      return;
    }
    socket.once('roomCreated', (data: any) => {
      setIsConnecting(false);
      navigation.navigate('OnlineGame', {
        roomCode: data.code,
        playerId: data.playerId,
        playerName: data.playerName,
        isHost: true,
      });
    });
    socket.once('error', (data: any) => {
      setIsConnecting(false);
      setServerError(data.message);
    });
    socket.emit('createRoom', {
      name: playerName,
      customCode: createCode.toUpperCase(),
      battleMode,
    });
  };

  // ─── JOIN WITH CODE ───
  const handleJoinByCode = async () => {
    setCodeError(false);
    setServerError('');
    if (joinCode.length !== 4) {
      setCodeError(true);
      return;
    }
    setIsConnecting(true);
    const connected = await ensureConnected();
    if (!connected) {
      setServerError('Could not connect to server');
      setIsConnecting(false);
      return;
    }
    const socket = getSocket();
    if (!socket) {
      setIsConnecting(false);
      return;
    }
    socket.once('playerJoined', (data: any) => {
      setIsConnecting(false);
      navigation.navigate('OnlineGame', {
        roomCode: joinCode.toUpperCase(),
        playerId: data.playerId,
        playerName: data.playerName,
        isHost: false,
      });
    });
    socket.once('error', (data: any) => {
      setIsConnecting(false);
      setServerError(data.message);
    });
    socket.emit('joinRoom', {
      code: joinCode.toUpperCase(),
      name: playerName,
    });
  };

  const renderMain = () => (
    <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
      <View style={styles.onlineBadge}>
        <Circle size={8} color="#4ade80" fill="#4ade80" />
        <Text style={styles.onlineText}>{count} online now</Text>
      </View>

      <View style={styles.identityCard}>
        <Text style={styles.identityLabel}>Playing as</Text>
        <Text style={styles.identityName}>{playerName}</Text>
      </View>

      <TouchableOpacity
        style={styles.primaryAction}
        onPress={handleHost}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <UserPlus size={20} color="#ffffff" />
            <Text style={styles.primaryActionText}>Host a Match</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryAction}
        onPress={handleJoinAsPlayer}
        disabled={isConnecting}
      >
        <Search size={20} color="#4facfe" />
        <Text style={styles.secondaryActionText}>Join a Match</Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>
          ONLINE PLAYERS ({users.filter((u) => u.userId !== playerUserId).length})
        </Text>
        <View style={styles.dividerLine} />
      </View>

      <OnlineUsersList
        onInvite={handleSendInvite}
        pendingInviteId={pendingInviteId}
        selfUserId={playerUserId}
      />

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR JOIN WITH CODE</Text>
        <View style={styles.dividerLine} />
      </View>

      <TextInput
        style={[styles.codeInput, codeError && styles.inputError]}
        placeholder="ABCD"
        placeholderTextColor="#3a3a4a"
        value={joinCode}
        onChangeText={(text) => {
          setJoinCode(text.toUpperCase());
          if (codeError) setCodeError(false);
        }}
        maxLength={4}
        autoCapitalize="characters"
      />
      {codeError && <Text style={styles.errorText}>⚠️ Enter a 4-character code</Text>}

      <TouchableOpacity
        style={styles.codeButton}
        onPress={handleJoinByCode}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <LogIn size={20} color="#ffffff" />
            <Text style={styles.codeButtonText}>Join with Code</Text>
          </>
        )}
      </TouchableOpacity>

      {serverError ? (
        <View style={styles.serverErrorBox}>
          <Text style={styles.serverErrorText}>⚠️ {serverError}</Text>
        </View>
      ) : null}
    </ScreenScroll>
  );

  const renderHost = () => (
    <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
      <View style={styles.hostHeader}>
        <Text style={styles.hostLabel}>You are hosting as</Text>
        <Text style={styles.hostName}>{playerName}</Text>
        {battleMode === 'avatar' && (
          <Text style={styles.modeTag}>🤖 Avatar Arena</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>YOUR ROOM CODE</Text>

      <View style={styles.codeDisplayCard}>
        <Text style={styles.codeDisplay}>{hostCode || '----'}</Text>
        <TouchableOpacity style={styles.copyBtn} onPress={handleCopyCode}>
          {copied ? (
            <Check size={16} color="#4ade80" />
          ) : (
            <Copy size={16} color="#ffffff" />
          )}
          <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.codeHint}>
        Share this code or invite from the list below
      </Text>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>INVITE BY NAME</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Enter username"
          placeholderTextColor="#5a5a7a"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          maxLength={15}
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearchPlayer}
          disabled={searching}
        >
          {searching ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Search size={18} color="#ffffff" />
          )}
        </TouchableOpacity>
      </View>

      {searchResult?.found && (
        <View style={styles.searchResultCard}>
          <View style={styles.resultLeft}>
            <Text style={styles.resultName}>{searchResult.player.name}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.inviteButton,
              (searchResult.player.status !== 'online' ||
                pendingInviteId === searchResult.player.id) &&
                styles.inviteButtonDisabled,
            ]}
            onPress={() =>
              handleSendInvite(searchResult.player.id, searchResult.player.name)
            }
            disabled={
              searchResult.player.status !== 'online' ||
              pendingInviteId === searchResult.player.id
            }
          >
            {pendingInviteId === searchResult.player.id ? (
              <ActivityIndicator color="#000000" size="small" />
            ) : (
              <Text style={styles.inviteButtonText}>Invite</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {inviteStatus ? (
        <View style={styles.inviteStatusBox}>
          <ActivityIndicator color="#fbbf24" size="small" />
          <Text style={styles.inviteStatusText}>{inviteStatus}</Text>
        </View>
      ) : null}

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>
          ONLINE PLAYERS ({users.filter((u) => u.userId !== playerUserId).length})
        </Text>
        <View style={styles.dividerLine} />
      </View>

      <OnlineUsersList
        onInvite={handleSendInvite}
        pendingInviteId={pendingInviteId}
        selfUserId={playerUserId}
      />
    </ScreenScroll>
  );

  const renderJoin = () => (
    <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
      <View style={styles.hostHeader}>
        <Text style={styles.hostLabel}>Joining as</Text>
        <Text style={styles.hostName}>{playerName}</Text>
        {battleMode === 'avatar' && (
          <Text style={styles.modeTag}>🤖 Avatar Arena</Text>
        )}
      </View>

      <View style={styles.waitingBox}>
        <ActivityIndicator color="#4facfe" size="large" />
        <Text style={styles.waitingTitle}>Waiting for invite...</Text>
        <Text style={styles.waitingText}>
          You'll get a notification when someone invites you
        </Text>
      </View>

      <Text style={styles.sectionTitle}>OR ENTER A ROOM CODE</Text>

      <TextInput
        style={[styles.codeInput, codeError && styles.inputError]}
        placeholder="ABCD"
        placeholderTextColor="#3a3a4a"
        value={joinCode}
        onChangeText={(text) => {
          setJoinCode(text.toUpperCase());
          if (codeError) setCodeError(false);
        }}
        maxLength={4}
        autoCapitalize="characters"
      />
      {codeError && <Text style={styles.errorText}>⚠️ Enter a 4-character code</Text>}

      <TouchableOpacity
        style={styles.codeButton}
        onPress={handleJoinByCode}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <LogIn size={20} color="#ffffff" />
            <Text style={styles.codeButtonText}>Join with Code</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>
          ONLINE PLAYERS ({users.filter((u) => u.userId !== playerUserId).length})
        </Text>
        <View style={styles.dividerLine} />
      </View>

      <OnlineUsersList
        onInvite={handleSendInvite}
        pendingInviteId={pendingInviteId}
        selfUserId={playerUserId}
      />
    </ScreenScroll>
  );

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
          >
            <ChevronLeft size={24} color="#e94560" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {battleMode === 'avatar' ? '🤖 Avatar Arena' : '🌐 Human vs Human'}
          </Text>
          <View style={styles.headerBtn} />
        </View>

        {mode === 'main' && renderMain()}
        {mode === 'host' && renderHost()}
        {mode === 'join' && renderJoin()}
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
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  onlineText: { fontSize: 11, color: '#4ade80', fontWeight: '700' },
  identityCard: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(233, 69, 96, 0.08)',
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.2)',
  },
  identityLabel: {
    fontSize: 10,
    color: '#8a8a9a',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  identityName: { fontSize: 20, fontWeight: '900', color: '#ffffff', marginTop: 4 },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e94560',
    padding: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  primaryActionText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(79, 172, 254, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.3)',
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  secondaryActionText: { color: '#4facfe', fontSize: 15, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  dividerText: { color: '#5a5a7a', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  codeInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
    inputError: {
    borderColor: '#f87171',
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    marginBottom: 10,
    marginLeft: 4,
    fontWeight: '600',
  },
  codeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4facfe',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  codeButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  serverErrorBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  serverErrorText: { color: '#f87171', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  hostHeader: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(233, 69, 96, 0.08)',
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.2)',
  },
  hostLabel: {
    fontSize: 10,
    color: '#8a8a9a',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  hostName: { fontSize: 22, fontWeight: '900', color: '#ffffff', marginTop: 4 },
  modeTag: { fontSize: 12, color: '#a78bfa', marginTop: 6, fontWeight: '700' },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5a5a7a',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchButton: {
    width: 48,
    backgroundColor: '#e94560',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  resultLeft: { flex: 1 },
  resultName: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  inviteButton: {
    backgroundColor: '#4ade80',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 70,
    alignItems: 'center',
  },
  inviteButtonDisabled: { backgroundColor: 'rgba(255,255,255,0.05)', opacity: 0.5 },
  inviteButtonText: { color: '#000000', fontSize: 12, fontWeight: '900' },
  inviteStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
    marginBottom: 8,
  },
  inviteStatusText: { color: '#fbbf24', fontSize: 12, fontWeight: '700' },
  waitingBox: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  waitingTitle: { fontSize: 18, fontWeight: '800', color: '#4facfe', marginTop: 10 },
  waitingText: {
    fontSize: 12,
    color: '#8a8a9a',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  codeDisplayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(79, 172, 254, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.3)',
    marginBottom: 8,
  },
  codeDisplay: {
    fontSize: 36,
    fontWeight: '900',
    color: '#4facfe',
    letterSpacing: 8,
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
  codeHint: {
    fontSize: 11,
    color: '#8a8a9a',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
});