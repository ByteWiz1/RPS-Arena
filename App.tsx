import React, { useEffect, useRef } from 'react';
import { StatusBar, StyleSheet, Platform, View } from 'react-native';
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
import { connectToServer, getSocket } from './src/services/multiplayer';

export default function App() {
  const { loadSettings, loaded } = useSettingsStore();
  const { loadAvatars } = useAvatarStore();
  const { loadPremium } = usePremiumStore();
  const { loadUser, loaded: userLoaded, isNewUser, identity } = useUserStore();
  const { setUsers, setCount } = useOnlineStore();
  const { setMode } = useBattleStore();

  const handledRoomRef = useRef<string | null>(null);

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

  // ─── SOCKET: connect as soon as identity exists ───
  useEffect(() => {
    if (userLoaded && identity) {
      console.log('[APP] Connecting with identity:', identity.username);
      connectToServer(identity).catch((e) => {
        console.log('[APP] Connect error:', e);
      });
    }
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

        const myName = identity.username;
        const me = players.find((p: any) => p.name === myName);
        const opponent = players.find((p: any) => p.name !== myName);

        if (!me) {
          console.log('[APP] Could not find self in players list:', players, 'myName:', myName);
          handledRoomRef.current = null;
          return;
        }

        const navigate = () => {
          if (!navigationRef.isReady()) return false;
          navigationRef.navigate('OnlineGame', {
            roomCode,
            playerId: me.id,
            playerName: myName,
            opponentName: opponent?.name || 'Opponent',
            battleMode: safeMode,
            fromRoomReady: true,
          });
          return true;
        };

        if (!navigate()) {
          console.log('[APP] navigationRef not ready — retry in 300ms');
          handledRoomRef.current = null;
          setTimeout(() => {
            handledRoomRef.current = data.roomCode;
            navigate();
          }, 300);
        }
      };

      const handleInviteDeclined = (data: any) => {
        console.log('[APP] Invite declined by', data.byName);
      };

      socket.on('roomReady', handleRoomReady);
      socket.on('inviteDeclined', handleInviteDeclined);

      cleanup = () => {
        socket.off('roomReady', handleRoomReady);
        socket.off('inviteDeclined', handleInviteDeclined);
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    ...(Platform.OS === 'web'
      ? { height: '100vh' as any, width: '100vw' as any }
      : {}),
  },
});