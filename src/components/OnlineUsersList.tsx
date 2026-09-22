import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Circle, UserPlus } from 'lucide-react-native';
import { useOnlineStore } from '../store/onlineStore';
import { useUserStore } from '../store/userStore';

interface Props {
  onInvite: (targetSocketId: string, targetName: string) => void;
}

export default function OnlineUsersList({ onInvite }: Props) {
  const { users } = useOnlineStore();
  const { identity } = useUserStore();

  const others = users.filter((u) => u.userId !== identity?.userId);

  if (others.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>No one else is online right now</Text>
        <Text style={styles.emptyHint}>
          Invite friends to download the app!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {others.map((user) => {
        const isAvailable = user.status === 'online';
        return (
          <View key={user.userId} style={styles.row}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarEmoji}>{user.avatar}</Text>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      user.status === 'online'
                        ? '#4ade80'
                        : user.status === 'in-match'
                        ? '#fbbf24'
                        : '#5a5a7a',
                  },
                ]}
              />
            </View>

            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {user.name}
              </Text>
              <Text style={styles.status}>
                {user.status === 'online'
                  ? 'Available'
                  : user.status === 'in-match'
                  ? 'In a match'
                  : 'Offline'}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.inviteBtn,
                !isAvailable && styles.inviteBtnDisabled,
              ]}
              onPress={() => {
  console.log('[TAP INVITE]', user.name, user.socketId);
  onInvite(user.socketId, user.name);
}}
              disabled={!isAvailable}
            >
              <UserPlus
                size={14}
                color={isAvailable ? '#000000' : '#5a5a7a'}
              />
              <Text
                style={[
                  styles.inviteBtnText,
                  !isAvailable && styles.inviteBtnTextDisabled,
                ]}
              >
                Invite
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  avatarWrap: {
    position: 'relative',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 32,
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#0a0a0f',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  status: {
    fontSize: 11,
    color: '#8a8a9a',
    marginTop: 2,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#4ade80',
  },
  inviteBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  inviteBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
  },
  inviteBtnTextDisabled: {
    color: '#5a5a7a',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#8a8a9a',
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 11,
    color: '#5a5a7a',
    marginTop: 6,
    textAlign: 'center',
  },
});