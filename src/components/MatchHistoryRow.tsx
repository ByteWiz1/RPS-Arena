import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MatchRecord } from '../services/multiplayer';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function modeLabel(mode: string): string {
  switch (mode) {
    case 'human':
      return 'Human';
    case 'avatar':
      return 'Avatar';
    case 'dojo':
      return 'Dojo';
    default:
      return mode;
  }
}

interface Props {
  match: MatchRecord;
}

export default function MatchHistoryRow({ match }: Props) {
  const [expanded, setExpanded] = useState(false);

  const isWin = match.result === 'win';
  const isLoss = match.result === 'loss';
  const isTie = !isWin && !isLoss && match.myScore === match.theirScore;

  const resultLabel = isWin ? 'WIN' : isLoss ? 'LOSS' : isTie ? 'TIE' : '—';
  const resultColor = isWin ? '#4ade80' : isLoss ? '#f87171' : '#fbbf24';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setExpanded((v) => !v)}
      style={[styles.row, { borderLeftColor: resultColor }]}
    >
      <View style={styles.rowTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.opponent} numberOfLines={1}>
            vs {match.opponent || 'Unknown'}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>{modeLabel(match.mode)}</Text>
            </View>
            <Text style={styles.timeAgo}>{timeAgo(match.timestamp)}</Text>
          </View>
        </View>
        <View style={styles.rightSide}>
          <Text style={[styles.result, { color: resultColor }]}>
            {resultLabel}
          </Text>
          <Text style={styles.score}>
            {match.myScore}–{match.theirScore}
          </Text>
        </View>
      </View>

      {expanded && (
        <View style={styles.detailBlock}>
          <Text style={styles.detailLine}>
            Rounds: {match.rounds} • Ties: {match.p1Ties}–{match.p2Ties}
          </Text>
          <Text style={styles.detailLine}>
            {new Date(match.timestamp).toLocaleString()}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderLeftWidth: 4,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  opponent: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a78bfa',
    textTransform: 'uppercase',
  },
  timeAgo: { fontSize: 10, color: '#5a5a7a' },
  rightSide: { alignItems: 'flex-end' },
  result: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  score: { fontSize: 11, color: '#8a8a9a', marginTop: 2 },
  detailBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  detailLine: { fontSize: 11, color: '#8a8a9a', marginTop: 2 },
});