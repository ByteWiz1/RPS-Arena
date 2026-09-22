import React from 'react';
import { ScrollView, Platform, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
  contentStyle?: any;
  headerHeight?: number;
  bottomPadding?: number;
}

export default function ScreenScroll({
  children,
  contentStyle,
  headerHeight = 110,
  bottomPadding = 40,
}: Props) {
  if (Platform.OS !== 'web') {
    return (
      <ScrollView
        style={styles.nativeScroll}
        contentContainerStyle={[
          styles.nativeContent,
          contentStyle,
          { paddingBottom: bottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  }

  const flatStyle = StyleSheet.flatten(contentStyle) || {};
  const paddingTop = flatStyle.paddingTop ?? flatStyle.padding ?? 0;
  const paddingBottom =
    flatStyle.paddingBottom ?? flatStyle.padding ?? bottomPadding;
  const paddingLeft =
    flatStyle.paddingLeft ??
    flatStyle.paddingHorizontal ??
    flatStyle.padding ??
    0;
  const paddingRight =
    flatStyle.paddingRight ??
    flatStyle.paddingHorizontal ??
    flatStyle.padding ??
    0;

  const innerStyle: any = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
  };

  if (flatStyle.gap !== undefined) innerStyle.gap = flatStyle.gap;

  return (
    <div
      style={{
        overflowY: 'auto',
        overflowX: 'hidden',
        height: `calc(100vh - ${headerHeight}px)`,
        width: '100%',
        boxSizing: 'border-box',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
        paddingTop: `${paddingTop}px`,
        paddingBottom: `${paddingBottom}px`,
        paddingLeft: `${paddingLeft}px`,
        paddingRight: `${paddingRight}px`,
      }}
      className="rps-hide-scroll"
    >
      <style>{`
        .rps-hide-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div style={innerStyle}>{children}</div>
    </div>
  );
}

const styles = StyleSheet.create({
  nativeScroll: { flex: 1 },
  nativeContent: { flexGrow: 1 },
});