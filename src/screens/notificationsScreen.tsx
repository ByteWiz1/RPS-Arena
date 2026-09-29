import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  Trash2,
  Swords,
  UserPlus,
  UserCheck,
  UserX,
  Info,
} from 'lucide-react-native';
import SpaceBackground from '../components/SpaceBackground';
import ScreenContainer from '../components/ScreenContainer';
import {
  useNotificationStore,
  AppNotification,
  NotificationType,
} from '../store/notificationStore';

/** Per-type icon + accent color. */
function typeVisual(type: NotificationType): {
  Icon: any;
  color: string;
} {
  switch (type) {
    case 'invite_received':
      return { Icon: UserPlus, color: '#4facfe' };
    case 'invite_accepted':
      return { Icon: UserCheck, color: '#4ade80' };
    case 'invite_declined':
      return { Icon: UserX, color: '#f87171' };
    case 'match_starting':
      return { Icon: Swords, color: '#fbbf24' };
    case 'info':
    default:
      return { Icon: Info, color: '#a78bfa' };
  }
}

/** "just now" / "5m ago" / "2h ago" / "3d ago". */
function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const clearAll = useNotificationStore((s) => s.clearAll);

  const handlePressItem = (n: AppNotification) => {
    if (!n.read) markAsRead(n.id);

    // Optional deep-link action. Cast through `any` because action.screen is
    // a free-form string (see PROJECT_STATE known issues — typing deferred).
    if (n.action?.screen) {
      try {
        navigation.navigate(n.action.screen, n.action.params);
      } catch (e) {
        console.log('[Notifications] action navigate failed:', e);
      }
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const { Icon, color } = typeVisual(item.type);
    return (
      <TouchableOpacity
        style={[styles.row, !item.read && styles.rowUnread]}
        onPress={() => handlePressItem(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { borderColor: color }]}>
          <Icon size={18} color={color} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.rowText} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={styles.rowTime}>{relativeTime(item.timestamp)}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const empty = (
    <View style={styles.emptyWrap}>
      <Bell size={42} color="#3a3a4a" />
      <Text style={styles.emptyTitle}>No notifications yet</Text>
      <Text style={styles.emptySub}>
        Invites and match updates will show up here.
      </Text>
    </View>
  );

  return (
    <ScreenContainer>
      <SpaceBackground nebulaColors={['#4facfe', '#a78bfa', '#e94560']} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={20} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={styles.headerSub}>
                {unreadCount} unread
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.headerBtn}
            onPress={markAllAsRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck
              size={20}
              color={unreadCount === 0 ? '#3a3a4a' : '#4ade80'}
            />
          </TouchableOpacity>
        </View>

        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            notifications.length === 0
              ? styles.listEmptyContent
              : styles.listContent
          }
          ListEmptyComponent={empty}
          showsVerticalScrollIndicator={false}
        />

        {notifications.length > 0 && (
          <TouchableOpacity
            style={styles.clearBar}
            onPress={clearAll}
            activeOpacity={0.8}
          >
            <Trash2 size={14} color="#f87171" />
            <Text style={styles.clearText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    height: 70,
  },
  headerBtn: {
    padding: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minWidth: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 10,
    color: '#a78bfa',
    marginTop: 1,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 90,
    gap: 8,
  },
  listEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  rowUnread: {
    backgroundColor: 'rgba(167, 139, 250, 0.10)',
    borderColor: 'rgba(167, 139, 250, 0.28)',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  rowBody: { flex: 1 },
  rowTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 2,
  },
  rowText: {
    fontSize: 12,
    color: '#c8c8d8',
    lineHeight: 16,
  },
  rowTime: {
    fontSize: 10,
    color: '#6a6a8a',
    marginTop: 4,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e94560',
    marginTop: 6,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8a8a9a',
    marginTop: 6,
  },
  emptySub: {
    fontSize: 12,
    color: '#5a5a7a',
    textAlign: 'center',
    lineHeight: 17,
  },
  clearBar: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  clearText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f87171',
  },
});