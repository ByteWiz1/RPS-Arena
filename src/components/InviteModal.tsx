import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';
import { Check, X, Swords } from 'lucide-react-native';

interface Props {
  visible: boolean;
  fromName: string;
  onAccept: () => void;
  onDecline: () => void;
}

export default function InviteModal({ visible, fromName, onAccept, onDecline }: Props) {
  const [scale] = useState(new Animated.Value(0));
  const [secondsLeft, setSecondsLeft] = useState(300);

  useEffect(() => {
    if (visible) {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 12,
      }).start();

      setSecondsLeft(300);
      const interval = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(interval);
            return 0;
          }
          return s - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    } else {
      scale.setValue(0);
    }
  }, [visible]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <View style={styles.iconWrap}>
            <Swords size={36} color="#e94560" />
          </View>

          <Text style={styles.title}>MATCH INVITE</Text>

          <Text style={styles.fromLabel}>FROM</Text>
          <Text style={styles.fromName}>{fromName}</Text>

          <Text style={styles.message}>
            is inviting you to a Rock Paper Scissors match!
          </Text>

          <Text style={styles.timerText}>
            Auto-declines in {formatTime(secondsLeft)}
          </Text>

          <View style={styles.buttonsRow}>
            <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
              <X size={18} color="#f87171" />
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
              <Check size={18} color="#ffffff" />
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#14141e',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.3)',
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
    fontSize: 14,
    fontWeight: '900',
    color: '#e94560',
    letterSpacing: 3,
    marginBottom: 16,
  },
  fromLabel: {
    fontSize: 10,
    color: '#5a5a7a',
    letterSpacing: 2,
    fontWeight: '700',
  },
  fromName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 4,
    marginBottom: 12,
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
  declineText: {
    color: '#f87171',
    fontSize: 14,
    fontWeight: '700',
  },
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
  acceptText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});