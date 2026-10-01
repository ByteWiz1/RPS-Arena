// src/navigation/AppNavigator.tsx
//
// RPS Arena — navigation.
//
// Chat 9  — register auth screens (Login, SignupLink, ForgotPassword,
//           ResetPassword).
// Chat 10 — register AI Training screens:
//   TrainingMatch  — 5-round training session vs own avatar's AI
//   TrainingResult — post-match personality shift + chart
// Chat 11a — register Blitz Match:
//   BlitzMatch — 10-variant Blitz training mode. Handles Sprint,
//                Learn Under Pressure, Sudden Death, Streak Break,
//                Duel, Sequence Recall, Countdown Mirror, Roulette,
//                Betrayal, Two-Faced — all in one screen.
// Chat 11 — register Tournament screens:
//   TournamentEntry    — type selection (Human vs Human / Avatar vs Avatar)
//   TournamentConfig   — host configuration form (STEP 4 options)
//   TournamentLobby    — share code + joined list + Start button
//   TournamentJoin     — join by code or share link
//   TournamentBracket  — full bracket + Active system
//   TournamentMatch    — a real match within a tournament
//   TournamentChampion — champion reveal + rewards
//
// Chat 11 — Registration gate:
//   Anything that writes to the server requires a registered account.
//   Guests hitting a gated route are redirected to Login with a
//   returnTo that carries them back after sign-in. Gated routes:
//     OnlineMode, OnlineLobby, OnlineGame,
//     TournamentEntry, TournamentConfig, TournamentLobby,
//     TournamentJoin, TournamentBracket, TournamentMatch,
//     TournamentChampion.
//   Ungated (offline-safe): Home, Game, AIDojo, DojoMatch,
//     Training, TrainingMatch, TrainingResult, BlitzMatch,
//     Settings, AISettings, AvatarImage, Notifications, Premium,
//     Profile, Leaderboard, Achievements, and all auth screens.
//
//   Login and SignupLink now accept optional returnTo / returnParams
//   so a guest routed here from a deep link or a gated route lands
//   back where they were headed. TournamentJoin accepts an optional
//   code so a share link can pre-fill and auto-submit.
//
// APK: platform-agnostic. No web-only APIs used.

import React, { useEffect } from 'react';
import {
  NavigationContainer,
  createNavigationContainerRef,
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

import { useUserStore } from '../store/userStore';

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

  // Chat 9 + Chat 11 — auth screens with optional return path
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

  // Chat 10 — AI training
  TrainingMatch: {
    avatarId: string;
    target?: number; // Endurance mode when target > 3
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

  // Chat 11a — Blitz
  BlitzMatch: {
    avatarId: string;
    variant: BlitzVariantId;
    durationSec?: number; // pressure only
  };

  // Chat 11 — Tournament Mode
  TournamentEntry: undefined;
  TournamentConfig: { type: 'human' | 'avatar' };
  TournamentLobby: {
    tournamentId: string;
    code: string;
    isHost: boolean;
  };
  // Chat 11 — accepts an optional code from a deep link or Login return.
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

export const navigationRef =
  createNavigationContainerRef<RootStackParamList>();

// ────────────────────────────────────────────────────────────
// AuthGate
//
// Wraps a screen so guests are redirected to Login with a returnTo
// that carries them back after sign-in. Registered users see the
// screen unchanged.
//
// The check is intentionally non-blocking: the wrapped component is
// rendered immediately, and if the user is a guest, a redirect is
// queued via useEffect. This avoids a flash of the Login screen
// during the auth bootstrap where isAnonymous might briefly be true.
// ────────────────────────────────────────────────────────────
function AuthGate({ component: Component, ...rest }: any) {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isAnonymous, authReady } = useUserStore();

  useEffect(() => {
    // Wait for auth to be ready before deciding. During boot,
    // authReady is false and isAnonymous defaults to true.
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
    // Render nothing while auth boot is resolving.
    return null;
  }

  if (isAnonymous) {
    // The redirect effect above will fire shortly. Render nothing to
    // avoid flashing the wrapped screen.
    return null;
  }

  return <Component {...rest} />;
}

export default function AppNavigator() {
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#0a0a0f' },
        }}
      >
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