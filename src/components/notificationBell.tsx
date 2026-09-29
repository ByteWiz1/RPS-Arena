import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bell } from 'lucide-react-native';
import { useNotificationStore } from '../store/notificationStore';

/**
 * Bell icon for a screen header. Subscribes only to `unreadCount`
 * (a stable number) so the host screen does NOT re-render when
 * notifications arrive — only the bell does.
 *
 * Renders:
 *   - translucent button matching the app's header-button styling
 *   - a red badge in the top-right corner when unreadCount > 0
 *   - "9+" if the count exceeds 9
 */
export default function NotificationBell() {
  const navigation = useNavigation<any>();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);
  const showBadge = unreadCount > 0;

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => navigation.navigate('Notifications')}
      accessibilityRole="button"
      accessibilityLabel={
        showBadge
          ? `Notifications, ${unreadCount} unread`
          : 'Notifications'
      }
    >
      <Bell size={20} color="#8a8a9a" />
      {showBadge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText} numberOfLines={1}>
            {badgeLabel}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    // Anchor for the absolutely-positioned badge.
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: '#e94560',
    borderWidth: 1.5,
    borderColor: '#0a0a0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 11,
  },
});