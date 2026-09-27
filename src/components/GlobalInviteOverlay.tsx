import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Swords, X, Check } from 'lucide-react-native';
import { getSocket } from '../services/multiplayer';
import { useBattleStore } from '../store/battleStore';
import { navigationRef } from '../navigation/AppNavigator';
import { useUserStore } from '../store/userStore';

interface IncomingInvite {
  inviteId: string;
  fromName: string;
  fromId: string;
  battleMode: 'human' | 'avatar';
}

export default function GlobalInviteOverlay() {
  const [invite, setInvite] = useState<IncomingInvite | null>(null);
  const [countdown, setCountdown] = useState(300);
  const [scale] = useState(new Animated.Value(0));
  const [response, setResponse] = useState<'accepted' | 'declined' | null>(null);

  // "sent" = we're the inviter, waiting for their response
  const [sentState, setSentState] = useState<{
    toName: string;
    status: 'pending' | 'accepted' | 'declined';
  } | null>(null);

  const { setMode } = useBattleStore();
  const { identity } = useUserStore();

  // ─────────────────────────────────────────────
  // SOCKET LISTENERS
  // ─────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      console.log('[OVERLAY] No socket yet');
      return;
    }

    console.log('[OVERLAY] Attached. socket:', socket.id, 'connected:', socket.connected);

    // ─── We are the INVITEE — an invite arrived ───
    const handleInviteReceived = (data: any) => {
      console.log('[OVERLAY] Invite received:', data);
      setInvite({
        inviteId: data.inviteId,
        fromName: data.fromName,
        fromId: data.fromId,
        battleMode: data.battleMode === 'avatar' ? 'avatar' : 'human',
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

    // ─── We are the INVITER — they accepted ───
    const handleInviteAccepted = (data: any) => {
      console.log('[OVERLAY] Invite accepted:', data);

      // Only show the inviter-side UI. The invitee navigates via roomReady
      // from App.tsx, so the overlay shouldn't double-handle it.
      // We detect "am I the inviter?" by comparing identity to the payload.
      // Server sends playerId = the receiver's socket id for the receiver's event,
      // and the sender's socket id for the sender's event. So we compare names.
      const myName = identity?.username;
      const isInviterSide = myName && data.opponentName === myName;

      if (isInviterSide) {
        console.log('[OVERLAY] We are inviter — showing MATCH STARTING');
        setSentState({
          toName: data.opponentName,
          status: 'accepted',
        });
      }
      // Invitee side does nothing here — App.tsx handles roomReady navigation
    };

    // ─── We are the INVITER — they declined ───
    const handleInviteDeclined = (data: any) => {
      console.log('[OVERLAY] Invite declined:', data);
      setSentState((prev) =>
        prev ? { ...prev, status: 'declined' } : null
      );
      // Auto-dismiss the declined toast after 2.5s
      setTimeout(() => setSentState(null), 2500);
    };

    const handleInviteExpired = () => {
      console.log('[OVERLAY] Invite expired');
      dismiss();
      setSentState(null);
    };

    socket.on('inviteReceived', handleInviteReceived);
    socket.on('inviteAccepted', handleInviteAccepted);
    socket.on('inviteDeclined', handleInviteDeclined);
    socket.on('inviteExpired', handleInviteExpired);

    return () => {
      socket.off('inviteReceived', handleInviteReceived);
      socket.off('inviteAccepted', handleInviteAccepted);
      socket.off('inviteDeclined', handleInviteDeclined);
      socket.off('inviteExpired', handleInviteExpired);
    };
  }, [identity?.username, scale]);

  // ─────────────────────────────────────────────
  // COUNTDOWN (invitee side)
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // ACCEPT / DECLINE (invitee side)
  // ─────────────────────────────────────────────
  const handleAccept = () => {
    if (!invite) return;
    console.log('[OVERLAY] Accepting invite');
    setResponse('accepted');

    // Store the mode so screens can read it as a fallback
    setMode(invite.battleMode);

    const socket = getSocket();
    if (socket) {
      socket.emit('respondToInvite', {
        inviteId: invite.inviteId,
        accepted: true,
      });
    }

    // Navigation happens from App.tsx when `roomReady` arrives.
    // Do not navigate here — avoids double-nav.
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

  // ─────────────────────────────────────────────
  // RENDER — INVITER SIDE (waiting / accepted / declined)
  // ─────────────────────────────────────────────
  if (sentState) {
    return (
      <Animated.View
        style={[styles.overlay, { transform: [{ scale }], opacity: scale }]}
        pointerEvents="box-none"
      >
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Swords size={32} color="#e94560" />
          </View>

          {sentState.status === 'accepted' && (
            <>
              <Text style={styles.title}>MATCH STARTING</Text>
              <Text style={styles.subtitle}>
                {sentState.toName} accepted — entering room...
              </Text>
              <View style={styles.spinner}>
                <Text style={styles.spinnerText}>⏳</Text>
              </View>
            </>
          )}

          {sentState.status === 'declined' && (
            <>
              <Text style={styles.title}>DECLINED</Text>
              <Text style={styles.subtitle}>
                {sentState.toName} declined your invite
              </Text>
            </>
          )}

          {sentState.status === 'pending' && (
            <>
              <Text style={styles.title}>INVITE SENT</Text>
              <Text style={styles.subtitle}>Waiting for {sentState.toName}...</Text>
              <View style={styles.spinner}>
                <Text style={styles.spinnerText}>⏳</Text>
              </View>
            </>
          )}
        </View>
      </Animated.View>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER — INVITEE SIDE (invite popup)
  // ─────────────────────────────────────────────
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
              is inviting you to a{' '}
              {invite.battleMode === 'avatar'
                ? 'Avatar Arena battle'
                : 'Rock Paper Scissors match'}
              !
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
    textAlign: 'center',
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