// src/App.tsx
//
// RPS Arena — app root.
//
// Chat 9: bootstrap + socket + identity.
// Chat 11: deep links (web + APK) for tournament codes.
// Chat 12a: onboarding gate lived here as a render-swap.
// Chat 12b:
//   - The render-swap is GONE. Onboarding is now a registered route
//     in AppNavigator. This file no longer owns `authBranch`.
//   - Auto-login after email confirmation (Bug D): we subscribe to
//     `onAuthStateChange` BEFORE reading the existing session, so a
//     URL-fragment session that Supabase parses during mount is
//     caught and bootstrapped.
//   - Auto-navigate Home after sign-in/up (Bug E): the navigator's
//     `key` is derived from hasSession in AppNavigator; this file
//     just needs to make sure bootstrapAuth() flips hasSession.
//     No screen calls navigation.reset() anymore.
//
// Boot sequence:
//   1. Load local stores (settings, avatars, premium, notifications).
//   2. Read @rps_identity cache.
//      - If legacy token → connect socket → migrateLegacyToken
//        → supabase.auth.setSession() → continue.
//   3. Subscribe to onAuthStateChange (BEFORE reading session).
//   4. Read the existing session via getExistingSession().
//      - If none → authReady: true, hasSession: false.
//        AppNavigator's initial route is Onboarding.
//      - If present → load profiles, populate store, connect
//        socket, identify.
//   5. Auth-state listener handles SIGNED_IN (from email confirm or
//      session refresh) by re-running bootstrapAuth().
//
// Session replacement (Option X):
//   - Server sends sessionReplaced → we sign out locally + clear
//     identity cache + resetUser. hasSession flips false. The
//     navigator key changes; the navigator remounts on Onboarding.
//
// APK: Linking.getInitialURL() + Linking.addEventListener('url').

import React, { useEffect, useRef } from 'react';
import {
  StatusBar,
  StyleSheet,
  Platform,
  View,
  Alert,
  Linking,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator, { navigationRef } from './src/navigation/AppNavigator';
import GlobalInviteOverlay from './src/components/GlobalInviteOverlay';
import { useSettingsStore } from './src/store/settingsStore';
import { useAvatarStore } from './src/store/avatarStore';
import { usePremiumStore } from './src/store/premiumStore';
import { useUserStore } from './src/store/userStore';
import { useOnlineStore } from './src/store/onlineStore';
import { useBattleStore } from './src/store/battleStore';
import { useNotificationStore } from './src/store/notificationStore';
import { useAchievementStore } from './src/store/achievementStore';
import { startMenuMusic } from './src/services/audio';
import {
  connectToServer,
  getSocket,
  identifyOnServer,
  migrateLegacyTokenOnServer,
} from './src/services/multiplayer';
import {
  loadIdentity,
  isLegacyIdentity,
  clearIdentity,
  updateIdentity,
} from './src/services/identity';
import {
  supabase,
  getExistingSession,
  getAccessToken,
  fetchProfile,
  signOutLocal,
  onAuthStateChange,
} from './src/services/supabase';

export default function App() {
  const { loadSettings, loaded } = useSettingsStore();
  const { loadPremium } = usePremiumStore();
  const {
    setAuthReady,
    setFromSession,
    setFromProfile,
    setFromIdentify,
    resetUser,
    clearUser,
  } = useUserStore();
  const { setUsers, setCount } = useOnlineStore();
  const { setMode } = useBattleStore();
  const { loadNotifications, addNotification } = useNotificationStore();
  const { handleUnlock } = useAchievementStore();

  const handledRoomRef = useRef<string | null>(null);
  const lastRouteRef = useRef<string | null>(null);
  const notifiedRoomsRef = useRef<Set<string>>(new Set());
  const avatarUnsubRef = useRef<(() => void) | null>(null);

  // Prevents double-boot in React strict mode.
  const bootRef = useRef(false);
  // Prevents double-identify on a single connect.
  const identifiedRef = useRef(false);
  // Prevents the deep-link effect from firing more than once per launch.
  const deepLinkHandledRef = useRef(false);
  // Chat 12b (Bug D) — dedupes the auth-state subscription so we do
  // not double-bootstrap when SIGNED_IN fires in quick succession
  // (Supabase can fire INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED
  // in one URL-fragment parse).
  const lastHandledSessionRef = useRef<string | null>(null);

  // Ref to hold the current user's identity object for effect deps.
  const { identity, authReady } = useUserStore();

  // ─── BOOT: load all local stores ───
  useEffect(() => {
    loadSettings();
    loadPremium();
    loadNotifications();
  }, []);

  // ─── MUSIC ───
  useEffect(() => {
    if (loaded) {
      startMenuMusic();
    }
  }, [loaded]);

  // ─── AUTH BOOT ───
  //
  // Chat 12b (Bug D): the onAuthStateChange subscription is set up
  // INSIDE this effect, BEFORE the getExistingSession() call. That
  // ordering matters: when the user lands on the site from an email
  // confirmation link, Supabase parses the URL fragment during
  // module init and can fire SIGNED_IN before React mounts. If we
  // subscribe after reading, we miss it.
  //
  // The listener:
  //   - On SIGNED_IN with a session different from what we last
  //     handled → call bootstrapAuth(). That repopulates the store
  //     and flips hasSession → the navigator remounts on Home.
  //   - On SIGNED_OUT → resetUser(). hasSession flips false →
  //     navigator remounts on Onboarding.
  //   - PASSWORD_RECOVERY is already handled by a separate effect
  //     below; we ignore it here.
  //
  // Runs once.
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;

    let authSub: any = null;

    // Subscribe FIRST — before any await — so we catch fragment
    // sessions that Supabase resolves during mount.
    try {
      authSub = onAuthStateChange(async (event, session) => {
        try {
          if (event === 'SIGNED_IN' && session?.user) {
            const uid = session.user.id;
            // Dedupe: if we already bootstrapped this uid via the
            // boot path or a previous SIGNED_IN, skip.
            if (lastHandledSessionRef.current === uid) {
              return;
            }
            // If the store already has this uid as an active
            // session, skip. This handles the case where boot ran
            // first and then Supabase re-fires SIGNED_IN on token
            // refresh.
            const currentUid = useUserStore.getState().userId;
            if (currentUid === uid) {
              lastHandledSessionRef.current = uid;
              return;
            }
            console.log(
              '[APP] onAuthStateChange SIGNED_IN — bootstrapping store | uid:', uid
            );
            lastHandledSessionRef.current = uid;

            try {
              await useUserStore.getState().bootstrapAuth();
            } catch (e: any) {
              console.log(
                '[APP] bootstrapAuth from SIGNED_IN failed:',
                e?.message || e
              );
              return;
            }

            // Connect socket + identify, same as the cold-boot path.
            try {
              await connectToServer(getAccessToken);
            } catch (e: any) {
              console.log(
                '[APP] connectToServer from SIGNED_IN failed:',
                e?.message || e
              );
            }

            try {
              const fresh = useUserStore.getState();
              const reg = await identifyOnServer({
                username: fresh.username || undefined,
                avatar: fresh.avatar || undefined,
              });
              identifiedRef.current = true;
              setFromIdentify({
                username: reg.username,
                avatar: reg.avatar,
                isPremium: reg.isPremium,
                premiumSince: reg.premiumSince || null,
                email: reg.email || null,
                isGuest: reg.isGuest,
              });

              // Avatars: attach listener + sync, same as boot.
              try {
                if (avatarUnsubRef.current) {
                  try { avatarUnsubRef.current(); } catch {}
                  avatarUnsubRef.current = null;
                }
                avatarUnsubRef.current =
                  useAvatarStore.getState().attachServerListener();
              } catch (e: any) {
                console.log('[APP] avatar listener (auth) failed:', e?.message || e);
              }
              try {
                await useAvatarStore.getState().syncFromServer();
              } catch (e: any) {
                console.log('[APP] avatar sync (auth) failed:', e?.message || e);
              }
            } catch (e: any) {
              console.log(
                '[APP] identify from SIGNED_IN failed:',
                e?.message || e
              );
            }
            return;
          }

          if (event === 'SIGNED_OUT') {
            console.log('[APP] onAuthStateChange SIGNED_OUT — resetting store');
            lastHandledSessionRef.current = null;
            resetUser();
            return;
          }
          // INITIAL_SESSION, TOKEN_REFRESHED, USER_UPDATED, and
          // PASSWORD_RECOVERY: no action here.
        } catch (e: any) {
          console.log('[APP] onAuthStateChange handler error:', e?.message || e);
        }
      });
    } catch (e: any) {
      console.log('[APP] onAuthStateChange subscribe failed:', e?.message || e);
    }

    (async () => {
      try {
        // 1. Legacy migration path.
        const cached = await loadIdentity();
        if (isLegacyIdentity(cached) && cached?.token) {
          console.log('[APP] Legacy identity detected — migrating');

          await new Promise<void>((resolve, reject) => {
            const s = require('socket.io-client').io(
              'https://rps-arena-server-2mxh.onrender.com',
              {
                transports: ['websocket'],
                reconnection: false,
                auth: { legacyToken: cached.token },
              }
            );
            s.on('connect', () => {
              s.emit('migrateLegacyToken', { token: cached!.token });
            });
            s.once('legacyMigrationResult', (result: any) => {
              try { s.disconnect(); } catch {}
              if (
                result?.success &&
                result.access_token &&
                result.refresh_token
              ) {
                supabase.auth
                  .setSession({
                    access_token: result.access_token,
                    refresh_token: result.refresh_token,
                  })
                  .then(() => resolve())
                  .catch(reject);
              } else {
                reject(
                  new Error(result?.message || 'Legacy migration failed')
                );
              }
            });
            setTimeout(
              () => reject(new Error('Legacy migration timeout')),
              20000
            );
          });

          await updateIdentity({ token: undefined });
          console.log('[APP] Legacy migration complete');
        }

        // 2. Read the existing session.
        //
        // By this point Supabase has parsed any URL fragment (it
        // does that on client init, before our code runs). If the
        // fragment contained a valid session, getExistingSession()
        // returns it, and the boot path populates the store. If
        // Supabase parsed the fragment but our SIGNED_IN handler
        // already fired and bootstrapped the store, getExistingSession
        // returns the same session and the boot path here is a
        // no-op-ish duplicate — bootstrapAuth is idempotent.
        const session = await getExistingSession();

        if (!session) {
          console.log('[APP] No session — Onboarding will render');
          setAuthReady(true);
          return;
        }

        // 3. Load profile.
        const profile = await fetchProfile();

        // 4. Populate userStore.
        const u = session.user;
        const meta: any = u.user_metadata || {};
        const jwtSaysAnon = !u.email || meta.is_anonymous === true;
        const isGuest =
          profile && typeof profile.is_guest === 'boolean'
            ? profile.is_guest
            : jwtSaysAnon;

        const username =
          profile?.username || meta.username || 'Player';
        const avatar = profile?.avatar || meta.avatar || '🤖';
        const email = profile?.email || u.email || null;

        setFromSession({
          userId: u.id,
          email,
          isAnonymous: jwtSaysAnon,
        });
        setFromProfile({
          username,
          avatar,
          isPremium: !!profile?.is_premium,
          premiumSince: profile?.premium_since || null,
        });
        setFromIdentify({
          email,
          isGuest,
        });

        // Mark this uid so the SIGNED_IN dedupe does not re-run
        // the whole bootstrap for the same user.
        lastHandledSessionRef.current = u.id;

        // 5. Connect socket with JWT callback.
        await connectToServer(getAccessToken);

        // 6. Identify (ensures public.users row, registers presence).
        try {
          const reg = await identifyOnServer({ username, avatar });
          identifiedRef.current = true;
          setFromIdentify({
            username: reg.username,
            avatar: reg.avatar,
            isPremium: reg.isPremium,
            premiumSince: reg.premiumSince || null,
            email: reg.email || null,
            isGuest: reg.isGuest,
          });

          // 6a. Subscribe to server-pushed avatar updates BEFORE
          // syncing, so any in-flight pushes don't get dropped.
          try {
            if (avatarUnsubRef.current) {
              try { avatarUnsubRef.current(); } catch {}
              avatarUnsubRef.current = null;
            }
            avatarUnsubRef.current =
              useAvatarStore.getState().attachServerListener();
          } catch (e: any) {
            console.log('[APP] avatar listener failed:', e?.message || e);
          }

          // 6b. Sync avatars from server (initial load).
          try {
            await useAvatarStore.getState().syncFromServer();
          } catch (e: any) {
            console.log('[APP] avatar sync failed:', e?.message || e);
          }
        } catch (e: any) {
          console.log('[APP] identify failed:', e?.message || e);
        }

        setAuthReady(true);
      } catch (e: any) {
        console.error('[APP] Boot failed:', e?.message || e);
        setAuthReady(true);
      }
    })();

    return () => {
      try {
        authSub?.data?.subscription?.unsubscribe?.();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── RE-IDENTIFY ON RECONNECT ───
  useEffect(() => {
    if (!authReady) return;
    if (!identity) return;

    let cleanup: (() => void) | null = null;

    const attach = () => {
      const socket = getSocket();
      if (!socket) return false;

      const onConnect = () => {
        identifyOnServer({
          username: identity.username || undefined,
          avatar: identity.avatar || undefined,
        })
          .then((reg) => {
            setFromIdentify({
              username: reg.username,
              avatar: reg.avatar,
              isPremium: reg.isPremium,
              premiumSince: reg.premiumSince || null,
              email: reg.email || null,
              isGuest: reg.isGuest,
            });
          })
          .catch((e) => {
            console.log('[APP] Re-identify failed:', e?.message || e);
          });
      };

      socket.on('connect', onConnect);
      cleanup = () => socket.off('connect', onConnect);
      return true;
    };

    if (attach()) {
      return () => cleanup?.();
    }

    const interval = setInterval(() => {
      if (attach()) clearInterval(interval);
    }, 500);

    return () => {
      clearInterval(interval);
      cleanup?.();
    };
  }, [authReady, identity, setFromIdentify]);

  // ─── SESSION REPLACED (Option X) ───
  useEffect(() => {
    if (!authReady || !identity) return;

    let cleanup: (() => void) | null = null;

    const attach = () => {
      const socket = getSocket();
      if (!socket) return false;

      const handleSessionReplaced = async () => {
        console.log('[APP] sessionReplaced — signed in elsewhere');
        try {
          await signOutLocal();
        } catch {}
        try {
          await clearIdentity();
        } catch {}
        resetUser();
        lastHandledSessionRef.current = null;
        showSessionReplacedAlert();
        // hasSession is now false. AppNavigator's key changes;
        // navigator remounts on Onboarding.
      };

      socket.on('sessionReplaced', handleSessionReplaced);
      cleanup = () => {
        socket.off('sessionReplaced', handleSessionReplaced);
      };
      return true;
    };

    if (attach()) {
      return () => cleanup?.();
    }

    const interval = setInterval(() => {
      if (attach()) clearInterval(interval);
    }, 500);

    return () => {
      clearInterval(interval);
      cleanup?.();
    };
  }, [authReady, identity, resetUser]);

  // ─── Reset handledRoom when leaving OnlineGame ───
  useEffect(() => {
    if (!authReady || !identity) return;

    let cleanup: (() => void) | null = null;

    const attach = () => {
      const nav = navigationRef;
      if (!nav) return false;

      const unsubscribe = nav.addListener('state', () => {
        try {
          const currentRoute = nav.getCurrentRoute();
          const routeName = currentRoute?.name || null;

          if (
            lastRouteRef.current === 'OnlineGame' &&
            routeName !== 'OnlineGame'
          ) {
            console.log('[APP] Left OnlineGame — clearing handledRoomRef');
            handledRoomRef.current = null;
          }

          lastRouteRef.current = routeName;
        } catch {}
      });

      cleanup = () => unsubscribe();
      return true;
    };

    if (attach()) {
      return () => cleanup?.();
    }

    const interval = setInterval(() => {
      if (attach()) clearInterval(interval);
    }, 500);

    return () => {
      clearInterval(interval);
      cleanup?.();
    };
  }, [authReady, identity]);

  // ─── ONLINE USERS ───
  useEffect(() => {
    if (!authReady || !identity) return;

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
      return () => cleanup?.();
    }

    const interval = setInterval(() => {
      if (attach()) clearInterval(interval);
    }, 500);

    return () => {
      clearInterval(interval);
      cleanup?.();
    };
  }, [authReady, identity, setUsers, setCount]);

  // ─── ROOM READY: navigate into OnlineGame ───
  useEffect(() => {
    if (!authReady || !identity) return;

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

        const myUserId = identity.userId;
        const myName = identity.username;
        const me =
          (myUserId &&
            players.find((p: any) => p.userId && p.userId === myUserId)) ||
          players.find((p: any) => p.name === myName);
        const opponent = players.find((p: any) => p.id !== me?.id);

        if (!me) {
          console.log(
            '[APP] Could not find self in players list:',
            players,
            'myUserId:',
            myUserId,
            'myName:',
            myName
          );
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
      return () => cleanup?.();
    }

    const interval = setInterval(() => {
      if (attach()) clearInterval(interval);
    }, 500);

    return () => {
      clearInterval(interval);
      cleanup?.();
    };
  }, [authReady, identity, setMode]);

  // ─── NOTIFICATIONS: invite + roomReady ───
  useEffect(() => {
    if (!authReady || !identity) return;

    let cleanup: (() => void) | null = null;

    const attach = () => {
      const socket = getSocket();
      if (!socket) return false;

      const myUsername = identity.username;

      const handleInviteReceived = (data: any) => {
        const fromName = data?.fromName || 'Someone';
        addNotification({
          type: 'invite_received',
          title: 'New invite',
          body: `${fromName} invited you to play`,
        });
      };

      const handleInviteAccepted = (data: any) => {
        const opponentName = data?.opponentName;
        const acceptedByName = data?.playerName || 'Your opponent';
        if (opponentName && myUsername && opponentName === myUsername) {
          return;
        }
        addNotification({
          type: 'invite_accepted',
          title: 'Invite accepted',
          body: `${acceptedByName} accepted your invite`,
        });
      };

      const handleInviteDeclined = (data: any) => {
        const byName = data?.byName || 'Your opponent';
        addNotification({
          type: 'invite_declined',
          title: 'Invite declined',
          body: `${byName} declined your invite`,
        });
      };

      const handleRoomReadyNotify = (data: any) => {
        const roomCode = data?.roomCode;
        if (!roomCode) return;
        if (notifiedRoomsRef.current.has(roomCode)) return;
        notifiedRoomsRef.current.add(roomCode);

        const players: any[] = Array.isArray(data?.players) ? data.players : [];
        const myUserId = identity.userId;
        const me =
          (myUserId &&
            players.find((p: any) => p.userId && p.userId === myUserId)) ||
          players.find((p: any) => p.name === myUsername);
        const opponent = players.find((p: any) => p.id !== me?.id) || null;
        const opponentName = opponent?.name || 'your opponent';

        addNotification({
          type: 'match_starting',
          title: 'Match starting',
          body: `Match starting vs ${opponentName}`,
        });
      };

      socket.on('inviteReceived', handleInviteReceived);
      socket.on('inviteAccepted', handleInviteAccepted);
      socket.on('inviteDeclined', handleInviteDeclined);
      socket.on('roomReady', handleRoomReadyNotify);

      cleanup = () => {
        socket.off('inviteReceived', handleInviteReceived);
        socket.off('inviteAccepted', handleInviteAccepted);
        socket.off('inviteDeclined', handleInviteDeclined);
        socket.off('roomReady', handleRoomReadyNotify);
      };
      return true;
    };

    if (attach()) {
      return () => cleanup?.();
    }

    const interval = setInterval(() => {
      if (attach()) clearInterval(interval);
    }, 500);

    return () => {
      clearInterval(interval);
      cleanup?.();
    };
  }, [authReady, identity, addNotification]);

  // ─── ACHIEVEMENTS ───
  useEffect(() => {
    if (!authReady || !identity) return;

    let cleanup: (() => void) | null = null;

    const attach = () => {
      const socket = getSocket();
      if (!socket) return false;

      const handleAchievementUnlocked = (data: any) => {
        const id = data?.id;
        if (!id) return;

        const name = data?.name || id;
        const description =
          data?.description || 'You unlocked an achievement!';

        addNotification({
          type: 'achievement',
          title: `Achievement: ${name}`,
          body: description,
        });

        handleUnlock({
          id,
          name,
          description,
          icon: data?.icon,
          category: data?.category,
        });
      };

      socket.on('achievementUnlocked', handleAchievementUnlocked);

      cleanup = () => {
        socket.off('achievementUnlocked', handleAchievementUnlocked);
      };
      return true;
    };

    if (attach()) {
      return () => cleanup?.();
    }

    const interval = setInterval(() => {
      if (attach()) clearInterval(interval);
    }, 500);

    return () => {
      clearInterval(interval);
      cleanup?.();
    };
  }, [authReady, identity, addNotification, handleUnlock]);

  // ─── Reset route refs when userId changes ───
  useEffect(() => {
    handledRoomRef.current = null;
    lastRouteRef.current = null;
    identifiedRef.current = false;
  }, [identity?.userId]);

  // ─── PASSWORD RECOVERY (web) ───
  useEffect(() => {
    const sub = onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('[APP] PASSWORD_RECOVERY — navigating to ResetPassword');
        setTimeout(() => {
          if (navigationRef.isReady()) {
            navigationRef.navigate('ResetPassword' as never);
          }
        }, 200);
      }
    });
    return () => {
      sub?.data?.subscription?.unsubscribe?.();
    };
  }, []);

  // ─── DEEP LINK (web + APK) ───
  useEffect(() => {
    if (!authReady || !identity) return;
    if (deepLinkHandledRef.current) return;
    deepLinkHandledRef.current = true;

    const readCode = async (): Promise<string | null> => {
      try {
        if (Platform.OS === 'web') {
          const search = (globalThis as any)?.location?.search || '';
          const m = String(search).match(/[?&]tournament=([A-Z0-9]{6})/i);
          return m ? m[1].toUpperCase() : null;
        }
        const initial = await Linking.getInitialURL();
        if (!initial) return null;
        const raw = String(initial);
        const m =
          raw.match(/[?&]tournament=([A-Z0-9]{6})/i) ||
          raw.match(/\/join\/([A-Z0-9]{6})/i);
        return m ? m[1].toUpperCase() : null;
      } catch {
        return null;
      }
    };

    const navigateWithCode = (code: string) => {
      const isGuest = useUserStore.getState().isAnonymous;
      if (isGuest) {
        console.log('[APP] Deep link — guest, routing via Login:', code);
        (navigationRef.navigate as any)(
          'Login',
          { returnTo: 'TournamentJoin', returnParams: { code } }
        );
      } else {
        console.log('[APP] Deep link — registered, routing to Join:', code);
        (navigationRef.navigate as any)('TournamentJoin', { code });
      }
    };

    (async () => {
      const code = await readCode();
      if (!code) return;

      const tryNavigate = (attempt = 0) => {
        if (!navigationRef.isReady()) {
          if (attempt > 20) return;
          setTimeout(() => tryNavigate(attempt + 1), 100);
          return;
        }
        navigateWithCode(code);
      };

      tryNavigate();
    })();
  }, [authReady, identity]);

  // ─── DEEP LINK: runtime (APK) ───
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const sub = Linking.addEventListener('url', (event) => {
      try {
        const raw = String(event?.url || '');
        const m =
          raw.match(/[?&]tournament=([A-Z0-9]{6})/i) ||
          raw.match(/\/join\/([A-Z0-9]{6})/i);
        if (!m) return;
        const code = m[1].toUpperCase();
        if (!navigationRef.isReady()) return;

        const isGuest = useUserStore.getState().isAnonymous;
        if (isGuest) {
          (navigationRef.navigate as any)(
            'Login',
            { returnTo: 'TournamentJoin', returnParams: { code } }
          );
        } else {
          (navigationRef.navigate as any)('TournamentJoin', { code });
        }
      } catch {}
    });

    return () => sub?.remove?.();
  }, []);

  // Cleanup avatar subscription on unmount.
  useEffect(() => {
    return () => {
      if (avatarUnsubRef.current) {
        try { avatarUnsubRef.current(); } catch {}
        avatarUnsubRef.current = null;
      }
    };
  }, []);

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

  const ready = loaded && authReady;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />
        <View style={styles.root}>
          {!ready ? null : (
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

function showSessionReplacedAlert() {
  const title = 'Signed in elsewhere';
  const message =
    'Your account was opened in another tab or device. Sign in again to continue.';

  if (Platform.OS === 'web') {
    try {
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