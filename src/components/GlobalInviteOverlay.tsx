import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { useBattleStore } from '../store/battleStore';
import { Swords, X, Check } from 'lucide-react-native';
import { getSocket } from '../services/multiplayer';

interface IncomingInvite {
  inviteId: string;
  fromName: string;
  fromId: string;
}

interface Props {
  onAccept?: (
    roomCode: string,
    playerId: string,
    opponentName: string,
    battleMode: string
  ) => void;
}

export default function GlobalInviteOverlay({ onAccept }: Props) {
  const [invite, setInvite] = useState<IncomingInvite | null>(null);
  const [countdown, setCountdown] = useState(300);
  const [scale] = useState(new Animated.Value(0));
  const setMode = useBattleStore((s) => s.setMode);
  const [response, setResponse] = useState<'accepted' | 'declined' | null>(null);

  useEffect(() => {
    const socket = getSocket();
    console.log('[OVERLAY] Mounting. Socket:', socket?.id, 'connected:', socket?.connected);

    if (!socket) {
      console.log('[OVERLAY] No socket available yet');
      return;
    }

    const handleInviteReceived = (data: any) => {
      console.log('[OVERLAY] Received invite:', data);
      setInvite({
        inviteId: data.inviteId,
        fromName: data.fromName,
        fromId: data.fromId,
      });
      setCountdown(300);
      setResponse(null);
      scale.setValue(0);
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 12,
        stiffness: 150,
      }).start();
    };

    const handleInviteAccepted = (data: any) => {
      console.log('[OVERLAY] Invite accepted:', data);
      const inviteMode = data.battleMode === 'avatar' ? 'avatar' : 'human';
  setMode(inviteMode);
      dismiss();
      if (onAccept) {
        onAccept(data.roomCode, data.playerId, data.opponentName, inviteMode);
      }
    };

    const handleInviteExpired = () => {
      console.log('[OVERLAY] Invite expired');
      dismiss();
    };

    socket.on('inviteReceived', handleInviteReceived);
    socket.on('inviteAccepted', handleInviteAccepted);
    socket.on('inviteExpired', handleInviteExpired);

    return () => {
      socket.off('inviteReceived', handleInviteReceived);
      socket.off('inviteAccepted', handleInviteAccepted);
      socket.off('inviteExpired', handleInviteExpired);
    };
  }, []);

  useEffect(() => {
    if (!invite || response) return;
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          dismiss();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [invite, response]);

  const dismiss = () => {
    Animated.timing(scale, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setInvite(null);
      setResponse(null);
    });
  };

  const handleAccept = () => {
    if (!invite) return;
    console.log('[OVERLAY] Accepting invite');
    setResponse('accepted');
    const socket = getSocket();
    if (socket) {
      socket.emit('respondToInvite', {
        inviteId: invite.inviteId,
        accepted: true,
      });
    }
  };

  const handleDecline = () => {
    if (!invite) return;
    console.log('[OVERLAY] Declining invite');
    setResponse('declined');
    const socket = getSocket();
    if (socket) {
      socket.emit('respondToInvite', {
        inviteId: invite.inviteId,
        accepted: false,
      });
    }
    setTimeout(dismiss, 400);
  };

  if (!invite) return null;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <Animated.View
      style={[styles.overlay, { transform: [{ scale }], opacity: scale }]}
      pointerEvents="box-none"
    >
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Swords size={32} color="#e94560" />
        </View>

        {response === 'accepted' ? (
          <>
            <Text style={styles.title}>MATCH STARTING</Text>
            <Text style={styles.subtitle}>Joining {invite.fromName}...</Text>
            <View style={styles.spinner}>
              <Text style={styles.spinnerText}>⏳</Text>
            </View>
          </>
        ) : response === 'declined' ? (
          <>
            <Text style={styles.title}>DECLINED</Text>
            <Text style={styles.subtitle}>Invite dismissed</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>MATCH INVITE</Text>
            <Text style={styles.fromLabel}>FROM</Text>
            <Text style={styles.fromName}>{invite.fromName}</Text>
            <Text style={styles.message}>
              is inviting you to a Rock Paper Scissors match!
            </Text>

            <Text style={styles.timerText}>
              Auto-declines in {formatTime(countdown)}
            </Text>

            <View style={styles.buttonsRow}>
              <TouchableOpacity style={styles.declineBtn} onPress={handleDecline}>
                <X size={18} color="#f87171" />
                <Text style={styles.declineText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
                <Check size={18} color="#ffffff" />
                <Text style={styles.acceptText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 9999,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#14141e',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(233, 69, 96, 0.3)',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.6,
          shadowRadius: 20,
          elevation: 20,
        }),
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(233, 69, 96, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(233, 69, 96, 0.4)',
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
    color: '#e94560',
    letterSpacing: 3,
    marginBottom: 12,
  },
  fromLabel: {
    fontSize: 10,
    color: '#5a5a7a',
    letterSpacing: 2,
    fontWeight: '700',
  },
  fromName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 4,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#8a8a9a',
    marginTop: 8,
  },
  message: {
    fontSize: 13,
    color: '#8a8a9a',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  timerText: {
    fontSize: 11,
    color: '#fbbf24',
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 16,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.25)',
  },
  declineText: { color: '#f87171', fontSize: 14, fontWeight: '700' },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#e94560',
  },
  acceptText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  spinner: {
    marginTop: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(233, 69, 96, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerText: { fontSize: 28 },
});