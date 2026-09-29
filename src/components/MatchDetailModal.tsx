import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { X, Bot, Users, Swords, User } from 'lucide-react-native';

import { MatchRecord as ServerMatchRecord } from '../services/multiplayer';

interface Props {
  visible: boolean;
  match: ServerMatchRecord | null;
  onClose: () => void;
}

/**
 * MatchDetailModal — Feature B (Chat 8)
 *
 * Absolute-overlay modal (matching the Avatar-create modal pattern already
 * used in ProfileScreen) that shows full details of a single match history
 * record from the server.
 *
 * Data shape (from services/multiplayer.ts):
 *   { mode, opponent, opponentId, result, myScore, theirScore,
 *     p1Ties, p2Ties, rounds, timestamp }
 *
 * Known gaps (logged for the debug pass, not fixed here):
 * - MatchRecord has NO opponent avatar/emoji field. We fall back to a
 *   mode-derived icon: human → Users, avatar → Bot, dojo → Swords,
 *   unknown → User.
 * - p1Ties / p2Ties semantics (which side is "me") are not exposed on the
 *   record. We show `myScore – theirScore` for W-L and display a single
 *   tie count only when p1Ties === p2Ties; otherwise we show both as
 *   "p1/p2" to avoid guessing wrong.
 * - No Rematch button. There is no exported online-presence helper in
 *   multiplayer.ts, and adding one would require touching files outside
 *   this chat's scope. Deferred.
 */
export default function MatchDetailModal({ visible, match, onClose }: Props) {
  if (!visible || !match) return null;

  const mode = (match.mode || '').toLowerCase();
  const isHuman = mode === 'human' || mode === 'pvp' || mode === 'online';
  const isAvatar = mode === 'avatar';
  const isDojo = mode === 'dojo';

  const modeLabel = isHuman
    ? 'Human vs Human'
    : isAvatar
    ? 'Avatar Arena'
    : isDojo
    ? 'AI Dojo'
    : match.mode || 'Match';

  const ModeIcon = isHuman
    ? Users
    : isAvatar
    ? Bot
    : isDojo
    ? Swords
    : User;

  const isWin = match.result === 'win';
  const resultColor = isWin ? '#4ade80' : '#f87171';
  const resultLabel = isWin ? 'WIN' : 'LOSS';

  const formattedDate = formatTimestamp(match.timestamp);

  // Tie display strategy (see header note).
  const tiesMatch = match.p1Ties === match.p2Ties;
  const tieDisplay = tiesMatch
    ? String(match.p1Ties)
    : `${match.p1Ties}/${match.p2Ties}`;

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Match Details</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeIcon}
            activeOpacity={0.7}
            accessibilityLabel="Close match details"
          >
            <X size={18} color="#8a8a9a" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Result badge */}
          <View
            style={[
              styles.resultBadge,
              { backgroundColor: resultColor + '22', borderColor: resultColor + '66' },
            ]}
          >
            <Text style={[styles.resultBadgeText, { color: resultColor }]}>
              {resultLabel}
            </Text>
          </View>

          {/* Opponent block */}
          <View style={styles.opponentRow}>
            <View style={styles.opponentIconWrap}>
              <ModeIcon size={22} color="#a78bfa" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.opponentName} numberOfLines={1}>
                {match.opponent || 'Unknown opponent'}
              </Text>
              <Text style={styles.opponentMeta} numberOfLines={1}>
                {modeLabel}
              </Text>
            </View>
          </View>

          {/* Score block */}
          <View style={styles.scoreBlock}>
            <View style={styles.scoreSide}>
              <Text style={[styles.scoreValue, { color: '#4ade80' }]}>
                {match.myScore}
              </Text>
              <Text style={styles.scoreLabel}>YOU</Text>
            </View>
            <Text style={styles.scoreDash}>–</Text>
            <View style={styles.scoreSide}>
              <Text style={[styles.scoreValue, { color: '#f87171' }]}>
                {match.theirScore}
              </Text>
              <Text style={styles.scoreLabel}>THEM</Text>
            </View>
          </View>

          {/* Detail rows */}
          <View style={styles.detailsBlock}>
            <DetailRow label="Mode" value={modeLabel} />
            <DetailRow label="Rounds" value={String(match.rounds ?? 0)} />
            <DetailRow label="Ties" value={tieDisplay} />
            <DetailRow label="Played" value={formattedDate} />
          </View>
        </ScrollView>

        {/* Footer */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          activeOpacity={0.85}
        >
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------ */

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function formatTimestamp(ts: number): string {
  if (!ts || !isFinite(ts)) return '—';
  try {
    const d = new Date(ts);
    // Match ProfileScreen's history row tone: short + readable.
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/* ------------------------------------------------------------ */

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 100,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: '#14141e',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.25)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  closeIcon: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },

  // Result badge
  resultBadge: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 18,
  },
  resultBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  // Opponent
  opponentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(167,139,250,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.18)',
    marginBottom: 16,
  },
  opponentIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167,139,250,0.12)',
  },
  opponentName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  opponentMeta: {
    fontSize: 11,
    color: '#8a8a9a',
    marginTop: 2,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  // Score
  scoreBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingVertical: 8,
    marginBottom: 16,
  },
  scoreSide: {
    alignItems: 'center',
    minWidth: 64,
  },
  scoreValue: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  scoreLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8a8a9a',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  scoreDash: {
    fontSize: 24,
    fontWeight: '800',
    color: '#3a3a4a',
  },

  // Details
  detailsBlock: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#8a8a9a',
    fontWeight: '600',
  },
  detailValue: {
    flexShrink: 1,
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
    textAlign: 'right',
  },

  // Footer
  closeButton: {
    marginHorizontal: 18,
    marginTop: 4,
    marginBottom: 16,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#e94560',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});