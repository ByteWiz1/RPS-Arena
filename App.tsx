import React, { useEffect } from 'react';
import { StatusBar, StyleSheet, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import UsernameScreen from './src/screens/UsernameScreen';
import { useSettingsStore } from './src/store/settingsStore';
import { useAvatarStore } from './src/store/avatarStore';
import { usePremiumStore } from './src/store/premiumStore';
import { useUserStore } from './src/store/userStore';
import { useOnlineStore } from './src/store/onlineStore';
import { startMenuMusic } from './src/services/audio';
import { connectToServer, getSocket } from './src/services/multiplayer';

export default function App() {
  const { loadSettings, loaded } = useSettingsStore();
  const { loadAvatars } = useAvatarStore();
  const { loadPremium } = usePremiumStore();
  const { loadUser, loaded: userLoaded, isNewUser, identity } = useUserStore();
  const { setUsers, setCount } = useOnlineStore();

  useEffect(() => {
    loadSettings();
    loadAvatars();
    loadPremium();
    loadUser();
  }, []);

  useEffect(() => {
    if (loaded) {
      startMenuMusic();
    }
  }, [loaded]);

  useEffect(() => {
    if (userLoaded && identity) {
      console.log('[APP] Connecting with identity:', identity.username);
      connectToServer(identity).catch((e) => {
        console.log('[APP] Connect error:', e);
      });
    }
  }, [userLoaded, identity]);

  useEffect(() => {
    if (!userLoaded || !identity) return;

    const interval = setInterval(() => {
      const socket = getSocket();
      if (!socket) return;

      const handleOnlineUsers = (data: any) => {
        if (data.users) setUsers(data.users);
      };
      const handleOnlineCount = (data: any) => {
        if (typeof data.count === 'number') setCount(data.count);
      };

      socket.on('onlineUsers', handleOnlineUsers);
      socket.on('onlineCount', handleOnlineCount);

      if (socket.connected) {
        socket.emit('getOnlineUsers');
      }

      clearInterval(interval);
    }, 500);

    return () => clearInterval(interval);
  }, [userLoaded, identity]);

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
          {!ready ? null : isNewUser ? <UsernameScreen /> : <AppNavigator />}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    ...(Platform.OS === 'web' ? { height: '100vh' as any, width: '100vw' as any } : {}),
  },
});