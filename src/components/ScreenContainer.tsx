import React from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  backgroundColor?: string;
}

export default function ScreenContainer({
  children,
  style,
  backgroundColor = '#0a0a0f',
}: Props) {
  return (
    <View
      style={[
        styles.container,
        { backgroundColor },
        Platform.OS === 'web' ? styles.webContainer : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webContainer: {
    height: '100vh' as any,
    width: '100vw' as any,
  },
});