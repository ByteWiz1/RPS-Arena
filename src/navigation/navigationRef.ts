// src/navigation/navigationRef.ts
//
// RPS Arena — navigation container ref (Chat 12b, new).
//
// WHY THIS FILE EXISTS:
//
// AppNavigator.tsx imports LoginScreen (to register the route).
// LoginScreen needs `navigationRef` (to navigate after the navigator
// remounts when hasSession flips on sign-in).
//
// If navigationRef lived in AppNavigator.tsx, that would create a
// cycle: AppNavigator → LoginScreen → AppNavigator. ES modules
// nominally handle that with live bindings, but Metro's CommonJS
// interop has historically been unreliable about `export const` live
// bindings — it can hand back `undefined` to the earlier evaluator.
// That is a subtle, hard-to-reproduce bug.
//
// Pulling navigationRef into its own dependency-free module breaks
// the cycle cleanly:
//
//   AppNavigator.tsx ──imports──> navigationRef.ts
//   LoginScreen.tsx  ──imports──> navigationRef.ts
//   AppNavigator.tsx ──imports──> LoginScreen.tsx
//
// No cycle. navigationRef is fully initialized the moment any
// importer reads it, because this module has no dependencies that
// could delay its evaluation.
//
// The `RootStackParamList` import below is TYPE-ONLY. It is fully
// erased by TypeScript at compile time and produces no runtime
// import. That keeps this module dependency-free at runtime.

import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './AppNavigator';

export const navigationRef =
  createNavigationContainerRef<RootStackParamList>();