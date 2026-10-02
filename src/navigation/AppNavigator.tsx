// src/navigation/AppNavigator.tsx
//
// RPS Arena — navigation.
//
// Chat 9   — register auth screens (Login, SignupLink, ForgotPassword,
//            ResetPassword).
// Chat 10  — register AI Training screens.
// Chat 11a — register Blitz Match.
// Chat 11  — register Tournament screens + AuthGate for gated routes.
// Chat 12a — onboarding lived outside the navigator (render-swap).
// Chat 12b — onboarding became a route, but the navigator key was
//            derived from `hasSession` — which flips as soon as a
//            silent anon session is created during Sign Up / Guest.
//            That broke the flow: the navigator remounted mid-onboarding.
// Chat 12b (fix):
//   - The navigator key and initial route are now derived from
//     `isOnboarded` (and `pendingConfirmation`), NOT `hasSession`.
//
//     Key logic (see below):
//       isOnboarded === false, pendingConfirmation === false
//         → key 'onboarding', initialRoute 'Onboarding'
//       isOnboarded === false, pendingConfirmation === true
//         → key 'verify',     initialRoute 'VerifyEmail'
//       isOnboarded === true
//         → key 'app',        initialRoute 'Home'
//
//   - Register VerifyEmail (Chat 12b new screen).
//   - Register Onboarding as before, but it's now the initial route
//     only when not onboarded and not pending confirmation.
//   - navigationRef is imported from ./navigationRef (already done in
//     Chat 12b; no cycle).
//   - AuthGate is unchanged. It still redirects guests to Login for
//     gated routes. It's only ever evaluated for users with a session.
//
// APK: platform-agnostic. No web-only APIs used.

import React, { useEffect } from 'react';
import {
  NavigationContainer,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import HomeScreen from '../screens/HomeScreen';
import GameScreen from '../screens/GameScreen';
import OnlineLobbyScreen from '../screens/OnlineLobbyScreen';
import OnlineGameScreen from '../screens/OnlineGameScreen';
import ProfileScreen from '../screens/ProfileScreen';
import TrainingScreen from '../screens/TrainingScreen';
import AIDojoScreen from '../screens/AIDojoScreen';
import DojoMatchScreen from '../screens/DojoMatchScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import PremiumScreen from '../screens/PremiumScreen';
import AcceptedScreen from '../screens/AcceptedScreen';
import ChooseOpponentScreen from '../screens/ChooseOpponentScreen';
import AISettingsScreen from '../screens/AISettingsScreen';
import AvatarImageScreen from '../screens/AvatarImageScreen';
import OnlineModeScreen from '../screens/OnlineModeScreen';
import NotificationsScreen from '../screens/notificationsScreen';
import AchievementsScreen from '../screens/AchievementsScreen';

// Chat 9 — auth screens
import LoginScreen from '../screens/LoginScreen';
import SignupLinkScreen from '../screens/SignupLinkScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';

// Chat 12b — onboarding + email verification
import OnboardingScreen from '../screens/OnboardingScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';

// Chat 10 — AI training screens
import TrainingMatchScreen from '../screens/TrainingMatchScreen';
import TrainingResultScreen from '../screens/TrainingResultScreen';

// Chat 11a — Blitz Match (10 variants in one screen)
import BlitzMatchScreen from '../screens/BlitzMatchScreen';

// Chat 11 — Tournament Mode
import TournamentEntryScreen from '../screens/TournamentEntryScreen';
import TournamentConfigScreen from '../screens/TournamentConfigScreen';
import TournamentLobbyScreen from '../screens/TournamentLobbyScreen';
import TournamentJoinScreen from '../screens/TournamentJoinScreen';
import TournamentBracketScreen from '../screens/TournamentBracketScreen';
import TournamentMatchScreen from '../screens/TournamentMatchScreen';
import TournamentChampionScreen from '../screens/TournamentChampionScreen';

// Shared navigation ref (moved out of this file to break an import
// cycle with LoginScreen).
import { navigationRef } from './navigationRef';

import { useUserStore } from '../store/userStore';

// Re-export so existing importers of `{ navigationRef }` from this
// module keep working.
export { navigationRef };

// Chat 11a — variant id type (mirrors BlitzRules.ts)
type BlitzVariantId =
  | 'sprint'
  | 'pressure'
  | 'sudden-death'
  | 'streak-break'
  | 'duel'
  | 'sequence-recall'
  | 'countdown-mirror'
  | 'roulette'
  | 'betrayal'
  | 'two-faced';

export type RootStackParamList = {
  Onboarding: undefined;
  VerifyEmail: undefined;

  Home: undefined;
  Game: { mode?: string; training?: boolean } | undefined;
  OnlineMode: undefined;
  OnlineLobby: undefined;
  OnlineGame: {
    roomCode: string;
    playerId: string;
    playerName: string;
    opponentName?: string;
    battleMode: 'human' | 'avatar';
    isHost?: boolean;
    fromInvite?: boolean;
    fromRoomReady?: boolean;
  };
  Profile: undefined;
  Training: undefined;
  AIDojo: undefined;
  DojoMatch: any;
  Settings: undefined;
  Leaderboard: undefined;
  Premium: undefined;
  Accepted: any;
  ChooseOpponent: undefined;
  AISettings: undefined;
  AvatarImage: any;
  Notifications: undefined;
  Achievements: undefined;

  Login:
    | {
        returnTo?: keyof RootStackParamList;
        returnParams?: any;
      }
    | undefined;
  SignupLink:
    | {
        returnTo?: keyof RootStackParamList;
        returnParams?: any;
      }
    | undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;

  TrainingMatch: {
    avatarId: string;
    target?: number;
  };
  TrainingResult: {
    avatarId: string;
    before: {
      aggression: number;
      memory: number;
      randomness: number;
      defense: number;
    };
    modeLabel?: string;
    shiftWeight?: number;
    intensityOverride?: number;
    backToBlitz?: boolean;
    variant?: BlitzVariantId;
    durationSec?: number;
    stats: {
      userWinRate: number;
      aiWinRate: number;
      tieRate: number;
      userMoveDiversity: number;
      roundsPlayed: number;
      myScore: number;
      aiScore: number;
      matchWinner: 'player' | 'ai' | 'tie' | null;
    };
  };

  BlitzMatch: {
    avatarId: string;
    variant: BlitzVariantId;
    durationSec?: number;
  };

  TournamentEntry: undefined;
  TournamentConfig: { type: 'human' | 'avatar' };
  TournamentLobby: {
    tournamentId: string;
    code: string;
    isHost: boolean;
  };
  TournamentJoin: { code?: string } | undefined;
  TournamentBracket: {
    tournamentId: string;
    code?: string;
  };
  TournamentMatch: {
    tournamentId: string;
    matchId: string;
    roomCode: string;
    opponentUserId: string;
  };
  TournamentChampion: {
    tournamentId: string;
    winnerId?: string;
  };
};

const Stack = createStackNavigator<RootStackParamList>();

// ────────────────────────────────────────────────────────────
// AuthGate
//
// Wraps a screen so guests are redirected to Login with a returnTo
// that carries them back after sign-in. Registered users see the
// screen unchanged.
//
// Unchanged from Chat 11. The onboarding gate sits above it via
// the navigator's initial route — AuthGate is only evaluated for
// sessions that are already past onboarding.
// ────────────────────────────────────────────────────────────
function AuthGate({ component: Component, ...rest }: any) {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isAnonymous, authReady } = useUserStore();

  useEffect(() => {
    if (!authReady) return;

    if (isAnonymous) {
      console.log(
        '[AUTH GATE] guest → Login | returnTo:',
        route.name,
        '| params:',
        route.params
      );
      (navigation.replace as any)('Login', {
        returnTo: route.name,
        returnParams: route.params,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, isAnonymous, route.name]);

  if (!authReady) {
    return null;
  }

  if (isAnonymous) {
    return null;
  }

  return <Component {...rest} />;
}

export default function AppNavigator() {
  // Chat 12b (fix) — dynamic initial route.
  //
  // Derived from `isOnboarded` and `pendingConfirmation`, NOT from
  // `hasSession`. Silent anon sessions created during Sign Up /
  // Continue as Guest flip hasSession true immediately, but they do
  // NOT flip isOnboarded. That is the bug this fixes.
  //
  // The `key` on Stack.Navigator forces a full remount when the
  // gate state changes, so the new initialRouteName takes effect.
  const isOnboarded = useUserStore((s) => s.isOnboarded);
  const pendingConfirmation = useUserStore((s) => s.pendingConfirmation);

  let initialRouteName: keyof RootStackParamList = 'Onboarding';
  let navigatorKey = 'onboarding';

  if (isOnboarded) {
    initialRouteName = 'Home';
    navigatorKey = 'app';
  } else if (pendingConfirmation) {
    initialRouteName = 'VerifyEmail';
    navigatorKey = 'verify';
  }

  console.log(
    '[NAV] rendering navigator',
    '| isOnboarded:', isOnboarded,
    '| pendingConfirmation:', pendingConfirmation,
    '| initialRoute:', initialRouteName,
    '| key:', navigatorKey
  );

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        key={navigatorKey}
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#0a0a0f' },
        }}
      >
        {/* ─── Onboarding flow ─── */}
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />

        {/* ─── Ungated — offline-safe ─── */}
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Game" component={GameScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Training" component={TrainingScreen} />
        <Stack.Screen name="AIDojo" component={AIDojoScreen} />
        <Stack.Screen name="DojoMatch" component={DojoMatchScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
        <Stack.Screen name="Premium" component={PremiumScreen} />
        <Stack.Screen name="Accepted" component={AcceptedScreen} />
        <Stack.Screen name="ChooseOpponent" component={ChooseOpponentScreen} />
        <Stack.Screen name="AISettings" component={AISettingsScreen} />
        <Stack.Screen name="AvatarImage" component={AvatarImageScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Achievements" component={AchievementsScreen} />

        {/* ─── Auth screens — always accessible ─── */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignupLink" component={SignupLinkScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />

        {/* ─── Ungated offline game screens ─── */}
        <Stack.Screen name="TrainingMatch" component={TrainingMatchScreen} />
        <Stack.Screen name="TrainingResult" component={TrainingResultScreen} />
        <Stack.Screen name="BlitzMatch" component={BlitzMatchScreen} />

        {/* ─── GATED — require a registered account ─── */}
        <Stack.Screen
          name="OnlineMode"
          children={(props) => (
            <AuthGate {...props} component={OnlineModeScreen} />
          )}
        />
        <Stack.Screen
          name="OnlineLobby"
          children={(props) => (
            <AuthGate {...props} component={OnlineLobbyScreen} />
          )}
        />
        <Stack.Screen
          name="OnlineGame"
          children={(props) => (
            <AuthGate {...props} component={OnlineGameScreen} />
          )}
        />
        <Stack.Screen
          name="TournamentEntry"
          children={(props) => (
            <AuthGate {...props} component={TournamentEntryScreen} />
          )}
        />
        <Stack.Screen
          name="TournamentConfig"
          children={(props) => (
            <AuthGate {...props} component={TournamentConfigScreen} />
          )}
        />
        <Stack.Screen
          name="TournamentLobby"
          children={(props) => (
            <AuthGate {...props} component={TournamentLobbyScreen} />
          )}
        />
        <Stack.Screen
          name="TournamentJoin"
          children={(props) => (
            <AuthGate {...props} component={TournamentJoinScreen} />
          )}
        />
        <Stack.Screen
          name="TournamentBracket"
          children={(props) => (
            <AuthGate {...props} component={TournamentBracketScreen} />
          )}
        />
        <Stack.Screen
          name="TournamentMatch"
          children={(props) => (
            <AuthGate {...props} component={TournamentMatchScreen} />
          )}
        />
        <Stack.Screen
          name="TournamentChampion"
          children={(props) => (
            <AuthGate {...props} component={TournamentChampionScreen} />
          )}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
// src/navigation/AppNavigator.tsx