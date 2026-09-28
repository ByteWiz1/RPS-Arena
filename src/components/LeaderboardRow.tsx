import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LeaderboardEntry } from '../services/multiplayer';

type SubTab = 'wins' | 'winRate' | 'streak';

interface Props {
  rank: number;
  entry: LeaderboardEntry;
  subTab: SubTab;
  isMe: boolean;
}

function primaryStat(entry: LeaderboardEntry, subTab: SubTab): string {
  if (subTab === 'wins') return `${entry.wins}W`;
  if (subTab === 'winRate')
    return `${Math.round((entry.winRate || 0) * 100)}%`;
  return `${entry.bestStreak} 🔥`;
}

function secondaryStats(entry: LeaderboardEntry): string {
  return `${entry.wins}W ${entry.losses}L ${entry.ties}T • ${entry.total} played`;
}

export default function LeaderboardRow({ rank, entry, subTab, isMe }: Props) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  return (
    <View style={[styles.row, isMe && styles.rowMe]}>
      <View style={styles.rankWrap}>
        {medal ? (
          <Text style={styles.medal}>{medal}</Text>
        ) : (
          <Text style={styles.rank}>#{rank}</Text>
        )}
      </View>

      <Text style={styles.avatar}>{entry.avatar || '🤖'}</Text>

      <View style={{ flex: 1 }}>
        <Text style={styles.username} numberOfLines={1}>
          {entry.username}
          {isMe ? ' (you)' : ''}
        </Text>
        <Text style={styles.secondary} numberOfLines={1}>
          {secondaryStats(entry)}
        </Text>
      </View>

      <Text style={styles.primary}>{primaryStat(entry, subTab)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  rowMe: {
    backgroundColor: 'rgba(79,172,254,0.1)',
    borderColor: 'rgba(79,172,254,0.45)',
  },
  rankWrap: { width: 32, alignItems: 'center' },
  rank: { fontSize: 12, fontWeight: '700', color: '#8a8a9a' },
  medal: { fontSize: 18 },
  avatar: { fontSize: 22 },
  username: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  secondary: { fontSize: 11, color: '#5a5a7a', marginTop: 2 },
  primary: { fontSize: 14, fontWeight: '800', color: '#fbbf24' },
});