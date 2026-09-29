// src/navigation/AppNavigator.tsx
//
// RPS Arena — navigation (Chat 9 — register auth screens).
//
// Chat 9 adds four screens:
//   Login            — email + password sign-in (new device)
//   SignupLink       — link email + password to anonymous account
//   ForgotPassword   — request reset link
//   ResetPassword    — set new password after recovery
//
// All other screens are registered exactly as before.

import React from 'react';
import {
  NavigationContainer,
  createNavigationContainerRef,
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

// Chat 9 — new screens
import LoginScreen from '../screens/LoginScreen';
import SignupLinkScreen from '../screens/SignupLinkScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';

export type RootStackParamList = {
  Home: undefined;
  Game: { mode?: string } | undefined;
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

  // Chat 9
  Login: undefined;
  SignupLink: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export const navigationRef =
  createNavigationContainerRef<RootStackParamList>();

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
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Game" component={GameScreen} />
        <Stack.Screen name="OnlineMode" component={OnlineModeScreen} />
        <Stack.Screen name="OnlineLobby" component={OnlineLobbyScreen} />
        <Stack.Screen name="OnlineGame" component={OnlineGameScreen} />
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

        {/* Chat 9 — auth screens */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignupLink" component={SignupLinkScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}