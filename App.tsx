import React, { useEffect, useRef } from 'react';
import { StatusBar, StyleSheet, Platform, View, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator, { navigationRef } from './src/navigation/AppNavigator';
import UsernameScreen from './src/screens/UsernameScreen';
import GlobalInviteOverlay from './src/components/GlobalInviteOverlay';
import { useSettingsStore } from './src/store/settingsStore';
import { useAvatarStore } from './src/store/avatarStore';
import { usePremiumStore } from './src/store/premiumStore';
import { useUserStore } from './src/store/userStore';
import { useOnlineStore } from './src/store/onlineStore';
import { useBattleStore } from './src/store/battleStore';
import { startMenuMusic } from './src/services/audio';
import {
  getSocket,
  registerOrRestoreIdentity,
} from './src/services/multiplayer';
import { clearIdentity, saveIdentity } from './src/services/identity';

export default function App() {
  const { loadSettings, loaded } = useSettingsStore();
  const { loadAvatars } = useAvatarStore();
  const { loadPremium } = usePremiumStore();
  const { loadUser, loaded: userLoaded, isNewUser, identity } = useUserStore();
  const { setUsers, setCount } = useOnlineStore();
  const { setMode } = useBattleStore();

  // Track the roomCode we've already navigated into.
  // Cleared when we leave OnlineGame so the next room can navigate.
  const handledRoomRef = useRef<string | null>(null);
  const lastRouteRef = useRef<string | null>(null);
  // Prevent double-running the identity handshake in React strict mode.
  const identityHandshakeRef = useRef(false);

  // ─── BOOT: load all stores ───
  useEffect(() => {
    loadSettings();
    loadAvatars();
    loadPremium();
    loadUser();
  }, []);

  // ─── MUSIC: start once settings loaded ───
  useEffect(() => {
    if (loaded) {
      startMenuMusic();
    }
  }, [loaded]);

  // ─── IDENTITY HANDSHAKE ───
  // Runs as soon as userStore has loaded. Sends whatever we have locally
  // (token + username + avatar, OR just username+avatar for a fresh shell)
  // and persists the server-issued credentials.
  //
  // We intentionally do NOT gate on `identity` being truthy: UsernameScreen
  // creates a shell identity before this runs, and we need the handshake
  // to fire once that shell exists.
  useEffect(() => {
    if (!userLoaded) return;
    if (!identity) return;
    if (!identity.username) return; // nothing to send yet
    if (identityHandshakeRef.current) return;

    // If we already have a server-issued token AND userId, and the store's
    // identity matches storage, we still want to run the handshake so the
    // server can re-bind this socket (session replacement, presence, etc.).
    identityHandshakeRef.current = true;

    console.log('[APP] Identity handshake — token:', identity.token ? 'yes' : 'no');

    registerOrRestoreIdentity(identity)
      .then(async (serverIdentity) => {
        console.log('[APP] identityRegistered:', serverIdentity.userId);

        // Persist server-issued credentials to storage, then re-hydrate
        // the userStore so the rest of the app sees the real userId.
        const merged = {
          ...identity,
          userId: serverIdentity.userId,
          token: serverIdentity.token,
          username: serverIdentity.username,
          avatar: serverIdentity.avatar,
        };
        await saveIdentity(merged);

        // Re-load the store from storage. This is the safest path when we
        // don't know the store's setter API.
        await loadUser();
      })
      .catch((e) => {
        console.log('[APP] Identity handshake failed:', e?.message || e);
        identityHandshakeRef.current = false;
      });
  }, [userLoaded, identity, loadUser]);

  // ─── SESSION REPLACED ───
  // Another tab/device logged in as this same userId. Server is about to
  // kill this socket. Wipe local identity and bounce back to UsernameScreen.
  useEffect(() => {
    if (!userLoaded || !identity) return;

    let cleanup: (() => void) | null = null;

    const attach = () => {
      const socket = getSocket();
      if (!socket) return false;

      const handleSessionReplaced = async () => {
        console.log('[APP] sessionReplaced — you logged in elsewhere');
        try {
          await clearIdentity();
        } catch {}
        // Re-hydrate store → isNewUser becomes true → UsernameScreen renders.
        try {
          await loadUser();
        } catch {}
        identityHandshakeRef.current = false;
        showSessionReplacedAlert();
      };

      socket.on('sessionReplaced', handleSessionReplaced);
      cleanup = () => {
        socket.off('sessionReplaced', handleSessionReplaced);
      };
      return true;
    };

    if (attach()) {
      return () => {
        if (cleanup) cleanup();
      };
    }

    const interval = setInterval(() => {
      if (attach()) clearInterval(interval);
    }, 500);

    return () => {
      clearInterval(interval);
      if (cleanup) cleanup();
    };
  }, [userLoaded, identity, loadUser]);

  // ─── Reset handledRoom when leaving OnlineGame ───
  useEffect(() => {
    if (!userLoaded || !identity) return;

    let cleanup: (() => void) | null = null;

    const attach = () => {
      const nav = navigationRef;
      if (!nav) return false;

      const unsubscribe = nav.addListener('state', () => {
        try {
          const currentRoute = nav.getCurrentRoute();
          const routeName = currentRoute?.name || null;
          const roomCode = (currentRoute?.params as any)?.roomCode || null;

          if (
            lastRouteRef.current === 'OnlineGame' &&
            routeName !== 'OnlineGame'
          ) {
            console.log('[APP] Left OnlineGame — clearing handledRoomRef');
            handledRoomRef.current = null;
          }

          lastRouteRef.current = routeName;
          // Silence unused warning
          void roomCode;
        } catch (e) {
          // navigationRef not ready
        }
      });

      cleanup = () => unsubscribe();
      return true;
    };

    if (attach()) {
      return () => {
        if (cleanup) cleanup();
      };
    }

    const interval = setInterval(() => {
      if (attach()) clearInterval(interval);
    }, 500);

    return () => {
      clearInterval(interval);
      if (cleanup) cleanup();
    };
  }, [userLoaded, identity]);

  // ─── ONLINE USERS: listen + pull on mount/reconnect ───
  useEffect(() => {
    if (!userLoaded || !identity) return;

    let cleanup: (() => void) | null = null;

    const attach = () => {
      const socket = getSocket();
      if (!socket) return false;

      const handleOnlineUsers = (data: any) => {
        if (data.users) setUsers(data.users);
      };
      const handleOnlineCount = (data: any) => {
        if (typeof data.count === 'number') setCount(data.count);
      };
      const handleConnect = () => {
        socket.emit('getOnlineUsers');
        socket.emit('getOnlineCount');
      };

      socket.on('onlineUsers', handleOnlineUsers);
      socket.on('onlineCount', handleOnlineCount);
      socket.on('connect', handleConnect);

      if (socket.connected) {
        socket.emit('getOnlineUsers');
        socket.emit('getOnlineCount');
      }

      cleanup = () => {
        socket.off('onlineUsers', handleOnlineUsers);
        socket.off('onlineCount', handleOnlineCount);
        socket.off('connect', handleConnect);
      };
      return true;
    };

    if (attach()) {
      return () => {
        if (cleanup) cleanup();
      };
    }

    const interval = setInterval(() => {
      if (attach()) clearInterval(interval);
    }, 500);

    return () => {
      clearInterval(interval);
      if (cleanup) cleanup();
    };
  }, [userLoaded, identity, setUsers, setCount]);

  // ─── ROOM READY: single source of truth for entering OnlineGame ───
  useEffect(() => {
    if (!userLoaded || !identity) return;

    let cleanup: (() => void) | null = null;

    const attach = () => {
      const socket = getSocket();
      if (!socket) return false;

      const handleRoomReady = (data: any) => {
        console.log('[APP] roomReady received:', data);

        if (handledRoomRef.current === data.roomCode) {
          console.log('[APP] Already handled room', data.roomCode, '— skipping');
          return;
        }
        handledRoomRef.current = data.roomCode;

        const { roomCode, battleMode, players } = data;
        const safeMode: 'human' | 'avatar' =
          battleMode === 'avatar' ? 'avatar' : 'human';
        setMode(safeMode);

        // Prefer matching by userId (server-authoritative). Fall back to
        // name match for safety.
        const myUserId = identity.userId;
        const myName = identity.username;
        const me =
          (myUserId && players.find((p: any) => p.userId && p.userId === myUserId)) ||
          players.find((p: any) => p.name === myName);
        const opponent = players.find((p: any) => p.id !== me?.id);

        if (!me) {
          console.log('[APP] Could not find self in players list:', players, 'myUserId:', myUserId, 'myName:', myName);
          handledRoomRef.current = null;
          return;
        }

        const doNavigate = () => {
          if (!navigationRef.isReady()) return false;
          navigationRef.navigate('OnlineGame', {
            roomCode,
            playerId: me.id,
            playerName: me.name || myName,
            opponentName: opponent?.name || 'Opponent',
            battleMode: safeMode,
            fromRoomReady: true,
          });
          return true;
        };

        if (!doNavigate()) {
          console.log('[APP] navigationRef not ready — retry in 300ms');
          handledRoomRef.current = null;
          setTimeout(() => {
            handledRoomRef.current = data.roomCode;
            doNavigate();
          }, 300);
        }
      };

      socket.on('roomReady', handleRoomReady);

      cleanup = () => {
        socket.off('roomReady', handleRoomReady);
      };
      return true;
    };

    if (attach()) {
      return () => {
        if (cleanup) cleanup();
      };
    }

    const interval = setInterval(() => {
      if (attach()) clearInterval(interval);
    }, 500);

    return () => {
      clearInterval(interval);
      if (cleanup) cleanup();
    };
  }, [userLoaded, identity, setMode]);

  useEffect(() => {
    handledRoomRef.current = null;
    lastRouteRef.current = null;
  }, [identity?.userId]);

  // ─── WEB: full-height CSS injection ───
  useEffect(() => {
    if (Platform.OS === 'web') {
      const doc = (globalThis as any).document;
      if (doc && !doc.getElementById('rps-web-fixes')) {
        const style = doc.createElement('style');
        style.id = 'rps-web-fixes';
        style.innerHTML = `
          html, body, #root {
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background-color: #0a0a0f !important;
          }
          #root > div {
            height: 100% !important;
            width: 100% !important;
          }
        `;
        doc.head.appendChild(style);
      }
    }
  }, []);

  const ready = loaded && userLoaded;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />
        <View style={styles.root}>
          {!ready ? null : isNewUser ? (
            <UsernameScreen />
          ) : (
            <>
              <AppNavigator />
              <GlobalInviteOverlay />
            </>
          )}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// ─── sessionReplaced alert (web + native safe) ───
function showSessionReplacedAlert() {
  const title = 'Signed in elsewhere';
  const message =
    'Your account was opened in another tab or device. This session has been closed.';

  if (Platform.OS === 'web') {
    try {
      // eslint-disable-next-line no-alert
      (globalThis as any).alert?.(`${title}\n\n${message}`);
    } catch {}
  } else {
    try {
      Alert.alert(title, message);
    } catch {}
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    ...(Platform.OS === 'web'
      ? { height: '100vh' as any, width: '100vw' as any }
      : {}),
  },
});