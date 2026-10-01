// src/components/LiveScoreboardStrip.tsx
//
// RPS Arena — live scoreboard strip for tournament matches.
//
// STEP 10 spec:
//   On the match screen, above the move area:
//     - Horizontal scrollable strip
//     - Each entry: two player names + current score + a colored
//       dot matching each player's bracket color
//     - Fed by tournamentScoresUpdate broadcasts
//     - Tapping an entry → no-op for now
//
// The strip is intentionally read-only. It never mutates state and
// never navigates. The only interaction is the horizontal scroll.
//
// Owns no socket or store. The parent screen subscribes to
// onTournamentScoresUpdate and passes the latest payload down.

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

export interface ScoreEntry {
  matchId: string;
  p1UserId: string;
  p2UserId: string;
  p1Name: string;
  p2Name: string;
  p1Score: number;
  p2Score: number;
  p1Color: string | null;
  p2Color: string | null;
  status: 'pending' | 'active' | 'complete';
  winnerUserId?: string | null;
}

interface Props {
  entries: ScoreEntry[];
  // The current user's userId so their own match can be highlighted.
  currentUserId?: string | null;
  // The matchId of the current match, so it can be visually marked.
  currentMatchId?: string | null;
  // Optional label rendered at the left of the strip.
  title?: string;
}

export default function LiveScoreboardStrip({
  entries,
  currentUserId = null,
  currentMatchId = null,
  title = 'Live scores',
}: Props) {
  if (!entries || entries.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {entries.map((e) => {
          const isMine =
            currentUserId != null &&
            (e.p1UserId === currentUserId || e.p2UserId === currentUserId);
          const isCurrent = currentMatchId != null && e.matchId === currentMatchId;

          return (
            <TouchableOpacity
              key={e.matchId}
              activeOpacity={1}
              // Tapping is a no-op for now (STEP 10: future = match detail).
              onPress={() => {}}
              style={[
                styles.card,
                isCurrent && styles.cardCurrent,
                isMine && !isCurrent && styles.cardMine,
                e.status === 'complete' && styles.cardComplete,
              ]}
            >
              <View style={styles.row}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: e.p1Color || '#666' },
                  ]}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.name,
                    e.winnerUserId === e.p1UserId && styles.nameWinner,
                  ]}
                >
                  {e.p1Name}
                </Text>
                <Text style={styles.score}>{e.p1Score}</Text>
              </View>

              <View style={styles.row}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: e.p2Color || '#666' },
                  ]}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.name,
                    e.winnerUserId === e.p2UserId && styles.nameWinner,
                  ]}
                >
                  {e.p2Name}
                </Text>
                <Text style={styles.score}>{e.p2Score}</Text>
              </View>

              {e.status === 'complete' ? (
                <Text style={styles.statusComplete}>✓</Text>
              ) : e.status === 'active' ? (
                <Text style={styles.statusActive}>live</Text>
              ) : (
                <Text style={styles.statusPending}>—</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 10,
    color: '#5a5a7a',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  scrollContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  card: {
    minWidth: 132,
    maxWidth: 180,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardCurrent: {
    borderColor: 'rgba(233,69,96,0.6)',
    backgroundColor: 'rgba(233,69,96,0.08)',
  },
  cardMine: {
    borderColor: 'rgba(251,191,36,0.5)',
    backgroundColor: 'rgba(251,191,36,0.06)',
  },
  cardComplete: {
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  name: {
    flex: 1,
    fontSize: 11,
    color: '#c4c4d4',
    fontWeight: '700',
  },
  nameWinner: {
    color: '#fbbf24',
  },
  score: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    minWidth: 16,
    textAlign: 'right',
  },
  statusComplete: {
    marginTop: 4,
    fontSize: 9,
    color: '#4ade80',
    fontWeight: '900',
    textAlign: 'right',
  },
  statusActive: {
    marginTop: 4,
    fontSize: 9,
    color: '#e94560',
    fontWeight: '900',
    textAlign: 'right',
    letterSpacing: 0.6,
  },
  statusPending: {
    marginTop: 4,
    fontSize: 9,
    color: '#5a5a7a',
    fontWeight: '900',
    textAlign: 'right',
  },
});