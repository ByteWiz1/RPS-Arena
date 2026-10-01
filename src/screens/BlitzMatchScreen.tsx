// src/screens/BlitzMatchScreen.tsx
//
// RPS Arena — Chat 11a (AI Training redesign).
//
// ONE screen, TEN Blitz variants. Reads `BlitzVariantConfig` from
// BlitzRules.ts and adapts its behavior accordingly.
//
// Variant behaviors implemented here:
//   - sprint            : first-to-3, standard flow
//   - pressure          : timed match, higher score wins at zero
//   - sudden-death      : single round, then result
//   - streak-break      : 5s per-round timer, auto-loss on stall
//   - duel              : move auto-commits every 3s
//   - sequence-recall   : shows a 3-move sequence; user counters
//   - countdown-mirror  : AI plays user's own N-back move (aiOverride)
//   - roulette          : random highlighted move per round, +2 if matched
//   - betrayal          : AI reveals its pick 0.5–1.5s before user commits
//   - two-faced         : AI flips 2 weights every 3 rounds
//
// On match end, hands off to TrainingResult with the collected stats
// and the variant id. TrainingResult does the shift + persist.
//
// Constraints honored:
//   - ScreenContainer / ScreenScroll untouched
//   - AVATAR_ROUND_DELAY not referenced
//   - No auth, notification, achievement, or Dojo changes
//   - Full file rewrite
//   - All timers typed with ReturnType<typeof setInterval | setTimeout>
//   - All `ai.` accesses are behind null guards

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, X, Eye, Zap } from 'lucide-react-native';
import { useAvatarStore } from '../store/avatarStore';
import { useSettingsStore } from '../store/settingsStore';
import {
  ALL_MOVES,
  MOVE_ICONS,
  MOVE_NAMES,
  Move,
  getWinner,
} from '../engine/GameEngine';
import { AdaptiveAI } from '../engine/AIEngine';
import {
  startGameMusic,
  stopMusic,
  playSound,
} from '../services/audio';
import {
  BlitzVariantId,
  BlitzVariantConfig,
  getBlitzConfig,
  withPressureDuration,
  betrayalRevealWindowMs,
  flipTwoFacedPersonality,
  randomMove,
} from '../engine/BlitzRules';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import RecentMovesTrail from '../components/RecentMovesTrail';

const AI_THINK_DELAY = 350;
const RESULT_HOLD_DELAY = 1200;
const MAX_RECENT = 5;

type RoundWinner = 'player' | 'ai' | 'tie';

export default function BlitzMatchScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const avatarId: string | undefined = route.params?.avatarId;
  const variantId: BlitzVariantId = route.params?.variant || 'sprint';
  const requestedDurationSec: number | undefined = route.params?.durationSec;

  const { vibrationEnabled } = useSettingsStore();
  const { avatars } = useAvatarStore();
  const avatar = avatars.find((a) => a.id === avatarId) || null;

  // ── Resolve the variant config ──
  const cfg: BlitzVariantConfig = useMemo(() => {
    if (variantId === 'pressure' && requestedDurationSec) {
      return withPressureDuration(requestedDurationSec);
    }
    return getBlitzConfig(variantId);
  }, [variantId, requestedDurationSec]);

  // ── AI instance (personality may be mutated mid-match for Two-Faced) ──
  const [ai, setAi] = useState<AdaptiveAI | null>(() =>
    avatar
      ? new AdaptiveAI(avatar.name, 'medium', { ...avatar.personality })
      : null
  );

  // ── Match state ──
  const [myMove, setMyMove] = useState<Move | null>(null);
  const [aiMove, setAiMove] = useState<Move | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [myTies, setMyTies] = useState(0);
  const [aiTies, setAiTies] = useState(0);
  const [round, setRound] = useState(0);
  const [roundWinner, setRoundWinner] = useState<RoundWinner | null>(null);
  const [matchOver, setMatchOver] = useState(false);
  const [matchWinner, setMatchWinner] = useState<'player' | 'ai' | 'tie' | null>(
    null
  );

  const [myRecentMoves, setMyRecentMoves] = useState<Move[]>([]);
  const [aiRecentMoves, setAiRecentMoves] = useState<Move[]>([]);

  // ── Match-wide tracking (feeds TrainingShift) ──
  const [myMoveHistory, setMyMoveHistory] = useState<Move[]>([]);
  const [roundResults, setRoundResults] = useState<RoundWinner[]>([]);

  // ── Variant-specific state ──
  const [secondsLeft, setSecondsLeft] = useState<number>(
    cfg.endCondition.kind === 'timed' ? cfg.endCondition.durationSec : 0
  );
  const [roundSecondsLeft, setRoundSecondsLeft] = useState<number>(0);
  const [sequenceMoves, setSequenceMoves] = useState<Move[]>([]);
  const [sequencePhase, setSequencePhase] = useState<
    'idle' | 'showing' | 'answering'
  >('idle');
  const [mirrorOffset, setMirrorOffset] = useState(5);
  const [highlightedMove, setHighlightedMove] = useState<Move | null>(null);
  const [revealedAiMove, setRevealedAiMove] = useState<Move | null>(null);
  const [flipCount, setFlipCount] = useState(0);

  // ── Timer refs (typed portably for RN) ──
  const pressureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const duelFlipRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sequenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const betrayalRevealRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userCommittedRef = useRef(false);

  // ── Music + cleanup ──
  useEffect(() => {
    startGameMusic();
    return () => {
      stopMusic();
      clearAllTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sounds on round end ──
  useEffect(() => {
    if (!roundWinner) return;
    if (roundWinner === 'player') playSound('success');
    else if (roundWinner === 'ai') playSound('fail');
    else playSound('tie');
  }, [roundWinner]);

  // ── Push recent moves ──
  useEffect(() => {
    if (myMove && aiMove) {
      setMyRecentMoves((prev) => [myMove, ...prev].slice(0, MAX_RECENT));
      setAiRecentMoves((prev) => [aiMove, ...prev].slice(0, MAX_RECENT));
    }
  }, [myMove, aiMove]);

  // ══════════════════════════════════════════════════════════
  // VARIANT SETUP — runs once per round start
  // ══════════════════════════════════════════════════════════

  // Pressure: countdown the whole-match timer
  useEffect(() => {
    if (cfg.endCondition.kind !== 'timed') return;
    if (matchOver) return;

    pressureTimerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (pressureTimerRef.current) clearInterval(pressureTimerRef.current);
          resolveTimedMatch();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      if (pressureTimerRef.current) clearInterval(pressureTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.endCondition.kind, matchOver]);

  // Streak Break: per-round timer — auto-loss if user doesn't commit
  useEffect(() => {
    if (variantId !== 'streak-break') return;
    if (myMove || matchOver) return;
    if (!cfg.perRoundTimerMs) return;

    setRoundSecondsLeft(Math.ceil(cfg.perRoundTimerMs / 1000));
    roundTimerRef.current = setInterval(() => {
      setRoundSecondsLeft((s) => {
        if (s <= 1) {
          if (roundTimerRef.current) clearInterval(roundTimerRef.current);
          onUserStalled();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, variantId, myMove, matchOver]);

  // Duel: every 3s, if user hasn't committed, auto-commit a random move
  useEffect(() => {
    if (variantId !== 'duel') return;
    if (myMove || matchOver) return;
    if (!cfg.perRoundTimerMs) return;

    duelFlipRef.current = setInterval(() => {
      if (!userCommittedRef.current) {
        const auto = randomMove();
        playSound('click');
        handleMove(auto, true);
      }
    }, cfg.perRoundTimerMs);

    return () => {
      if (duelFlipRef.current) clearInterval(duelFlipRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, variantId, myMove, matchOver]);

  // Sequence Recall: show a 3-move sequence, then let the user answer
  useEffect(() => {
    if (variantId !== 'sequence-recall') return;
    if (myMove || matchOver) return;

    const seq: Move[] = [randomMove(), randomMove(), randomMove()];
    setSequenceMoves(seq);
    setSequencePhase('showing');

    sequenceTimerRef.current = setTimeout(() => {
      setSequencePhase('answering');
    }, 2500);

    return () => {
      if (sequenceTimerRef.current) clearTimeout(sequenceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, variantId, myMove, matchOver]);

  // Roulette: pick a highlighted move at the start of each round
  useEffect(() => {
    if (variantId !== 'roulette') return;
    if (myMove || matchOver) return;
    const m = ALL_MOVES[Math.floor(Math.random() * ALL_MOVES.length)];
    setHighlightedMove(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, variantId, myMove, matchOver]);

  // Two-Faced: every N rounds, silently flip two of the AI's weights
  useEffect(() => {
    if (variantId !== 'two-faced') return;
    if (!cfg.personalityFlipEveryRounds) return;
    if (!ai || !avatar) return;
    if (round === 0) return;
    if (round % cfg.personalityFlipEveryRounds !== 0) return;

    const flipped = flipTwoFacedPersonality(
      ai.personality,
      cfg.personalityFlipAmount || 0.15
    );
    ai.setPersonality(flipped);
    setFlipCount((c) => c + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, variantId]);

  // Countdown Mirror: update the displayed offset each round
  useEffect(() => {
    if (variantId !== 'countdown-mirror') return;
    setMirrorOffset(Math.min(5, Math.max(1, 5 - round + 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, variantId]);

  // ══════════════════════════════════════════════════════════
  // MATCH-END DETECTION
  // ══════════════════════════════════════════════════════════

  useEffect(() => {
    if (matchOver) return;
    if (cfg.endCondition.kind === 'first-to') {
      if (myScore >= cfg.endCondition.targetWins) {
        endMatch('player');
      } else if (aiScore >= cfg.endCondition.targetWins) {
        endMatch('ai');
      }
    } else if (cfg.endCondition.kind === 'sudden') {
      if (round >= 1 && roundWinner) {
        endMatch(
          roundWinner === 'player'
            ? 'player'
            : roundWinner === 'ai'
            ? 'ai'
            : 'tie'
        );
      }
    } else if (cfg.endCondition.kind === 'fixed') {
      if (round >= cfg.endCondition.fixedRounds) {
        if (myScore > aiScore) endMatch('player');
        else if (aiScore > myScore) endMatch('ai');
        else endMatch('tie');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myScore, aiScore, round, roundWinner, matchOver]);

  // Hand off to result screen once match is over
  useEffect(() => {
    if (!matchOver || !avatar) return;

    const t = setTimeout(() => {
      const totalRounds = roundResults.length || 1;
      const wins = roundResults.filter((r) => r === 'player').length;
      const ties = roundResults.filter((r) => r === 'tie').length;
      const userWinRate = wins / totalRounds;
      const tieRate = ties / totalRounds;
      const aiWinRate = Math.max(0, 1 - userWinRate - tieRate);

      const uniqueMoves = new Set(myMoveHistory).size;
      const userMoveDiversity =
        myMoveHistory.length > 0 ? uniqueMoves / myMoveHistory.length : 0;

      navigation.replace('TrainingResult', {
        avatarId: avatar.id,
        before: avatar.personality,
        modeLabel: cfg.name,
        shiftWeight: cfg.shiftWeight || 1.0,
        intensityOverride: cfg.intensityMultiplier,
        backToBlitz: true,
        variant: variantId,
        durationSec: requestedDurationSec,
        stats: {
          userWinRate,
          aiWinRate,
          tieRate,
          userMoveDiversity,
          roundsPlayed: totalRounds,
          myScore,
          aiScore,
          matchWinner,
        },
      });
    }, 900);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchOver]);

  // ══════════════════════════════════════════════════════════
  // ACTIONS
  // ══════════════════════════════════════════════════════════

  function handleMove(move: Move, isAuto = false) {
    if (myMove || matchOver) return;
    if (!ai) return;
    if (!isAuto) {
      playSound('click');
      if (vibrationEnabled) Vibration.vibrate(10);
    }
    userCommittedRef.current = true;

    setMyMove(move);
    setMyMoveHistory((prev) => [...prev, move]);
    ai.recordOpponentMove(move);

    // ── Betrayal: show the AI's pick early, then commit after the window ──
    if (variantId === 'betrayal') {
      const windowMs = betrayalRevealWindowMs(round + 1, false);
      const predicted = ai.makeMove();
      setRevealedAiMove(predicted);
      betrayalRevealRef.current = setTimeout(() => {
        commitAiMove(predicted);
      }, windowMs);
      return;
    }

    // ── Standard: AI responds after a think delay ──
    const aiInstance = ai;
    setTimeout(() => {
      let aiChoice: Move;
      if (cfg.aiOverride) {
        aiChoice = cfg.aiOverride(myMoveHistory, aiRecentMoves, aiInstance);
      } else {
        aiChoice = aiInstance.makeMove();
      }
      commitAiMove(aiChoice);
    }, AI_THINK_DELAY);
  }

  function commitAiMove(aiChoice: Move) {
    setAiMove(aiChoice);
    setTimeout(() => {
      if (!myMove) return;
      resolveRound(myMove, aiChoice);
    }, AI_THINK_DELAY);
  }

  function resolveRound(userMove: Move, aiChoice: Move) {
    if (!ai) return;
    const result = getWinner(userMove, aiChoice);
    const rw: RoundWinner =
      result === 'win' ? 'player' : result === 'lose' ? 'ai' : 'tie';
    setRoundWinner(rw);
    setRoundResults((prev) => [...prev, rw]);

    if (rw === 'player') {
      const inc = cfg.winScoreValue
        ? cfg.winScoreValue(userMove, highlightedMove)
        : 1;
      setMyScore((s) => s + inc);
      ai.recordResult('lose');
    } else if (rw === 'ai') {
      setAiScore((s) => s + 1);
      ai.recordResult('win');
    } else {
      setMyTies((t) => t + 1);
      setAiTies((t) => t + 1);
      ai.recordResult('tie');
    }
    setRound((r) => r + 1);

    setTimeout(() => {
      setMyMove(null);
      setAiMove(null);
      setRoundWinner(null);
      setRevealedAiMove(null);
      setHighlightedMove(null);
      setSequenceMoves([]);
      setSequencePhase('idle');
      userCommittedRef.current = false;
    }, RESULT_HOLD_DELAY);
  }

  function onUserStalled() {
    // Streak Break: user didn't commit in time. AI scores a point.
    setAiScore((s) => s + 1);
    setRoundResults((prev) => [...prev, 'ai']);
    setRound((r) => r + 1);
    playSound('fail');
  }

  function resolveTimedMatch() {
    // Pressure mode: timer hit 0. Higher score wins.
    if (myScore > aiScore) endMatch('player');
    else if (aiScore > myScore) endMatch('ai');
    else endMatch('tie');
  }

  function endMatch(winner: 'player' | 'ai' | 'tie') {
    if (matchOver) return;
    setMatchOver(true);
    setMatchWinner(winner);
    clearAllTimers();
    if (winner === 'player') playSound('success');
    else if (winner === 'ai') playSound('fail');
    else playSound('tie');
  }

  function clearAllTimers() {
    if (pressureTimerRef.current) clearInterval(pressureTimerRef.current);
    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    if (duelFlipRef.current) clearInterval(duelFlipRef.current);
    if (sequenceTimerRef.current) clearTimeout(sequenceTimerRef.current);
    if (betrayalRevealRef.current) clearTimeout(betrayalRevealRef.current);
    pressureTimerRef.current = null;
    roundTimerRef.current = null;
    duelFlipRef.current = null;
    sequenceTimerRef.current = null;
    betrayalRevealRef.current = null;
  }

  const handleQuit = () => navigation.goBack();

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  if (!avatar || !ai) {
    return (
      <ScreenContainer>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleQuit} style={styles.headerBtn}>
              <ChevronLeft size={24} color="#e94560" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Blitz</Text>
            <View style={styles.headerBtn} />
          </View>
          <View style={styles.center}>
            <Text style={styles.emptyText}>Avatar not found</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('Training')}
            >
              <Text style={styles.emptyBtnText}>Back to Lab</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ScreenContainer>
    );
  }

  const cfgEndLabel = (() => {
    if (cfg.endCondition.kind === 'first-to')
      return `First to ${cfg.endCondition.targetWins}`;
    if (cfg.endCondition.kind === 'timed') return `${secondsLeft}s left`;
    if (cfg.endCondition.kind === 'sudden') return 'One round';
    if (cfg.endCondition.kind === 'fixed')
      return `Round ${round}/${cfg.endCondition.fixedRounds}`;
    return '';
  })();

  const totalTimedSec =
    cfg.endCondition.kind === 'timed' ? cfg.endCondition.durationSec : 30;

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleQuit} style={styles.headerBtn}>
            <X size={22} color="#8a8a9a" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {cfg.icon} {cfg.name}
            </Text>
            <Text style={styles.headerSubtitle}>{cfgEndLabel}</Text>
          </View>
          <View style={styles.headerBtn} />
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          {/* ── Timer bar (Pressure) ── */}
          {cfg.endCondition.kind === 'timed' && (
            <View style={styles.timerBarWrap}>
              <View
                style={[
                  styles.timerBarFill,
                  {
                    width: `${(secondsLeft / totalTimedSec) * 100}%`,
                    backgroundColor: secondsLeft <= 10 ? '#f87171' : '#4facfe',
                  },
                ]}
              />
              <Text style={styles.timerBarText}>
                {secondsLeft}s · {myScore}–{aiScore}
              </Text>
            </View>
          )}

          {variantId === 'streak-break' && roundSecondsLeft > 0 && !myMove && (
            <View style={styles.warningBar}>
              <Zap size={14} color="#fbbf24" />
              <Text style={styles.warningText}>
                {roundSecondsLeft}s to commit or AI scores
              </Text>
            </View>
          )}

          {/* ── Score row ── */}
          <View style={styles.scoreRow}>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreName} numberOfLines={1}>
                You
              </Text>
              <Text style={styles.scoreValue}>{myScore}</Text>
              <Text style={styles.scoreTies}>{myTies} ties</Text>
              <RecentMovesTrail moves={myRecentMoves} slots={5} size={20} />
            </View>
            <View style={styles.scoreCenter}>
              <Text style={styles.scoreVs}>⚡</Text>
              <Text style={styles.scoreRound}>R{round}</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreName} numberOfLines={1}>
                {avatar.name}
              </Text>
              <Text style={styles.scoreValue}>{aiScore}</Text>
              <Text style={styles.scoreTies}>{aiTies} ties</Text>
              <RecentMovesTrail moves={aiRecentMoves} slots={5} size={20} />
            </View>
          </View>

          {/* ── Variant info line ── */}
          {(variantId === 'countdown-mirror' ||
            variantId === 'roulette' ||
            variantId === 'two-faced' ||
            variantId === 'sequence-recall') && (
            <View style={styles.infoCard}>
              {variantId === 'countdown-mirror' && (
                <Text style={styles.infoText}>
                  🪞 AI plays your move from {mirrorOffset} round
                  {mirrorOffset === 1 ? '' : 's'} ago
                </Text>
              )}
              {variantId === 'roulette' && highlightedMove && (
                <Text style={styles.infoText}>
                  🎰 Highlighted: {MOVE_ICONS[highlightedMove]} (
                  {MOVE_NAMES[highlightedMove]}) — win = +2 points
                </Text>
              )}
              {variantId === 'two-faced' && flipCount > 0 && (
                <Text style={styles.infoText}>
                  🎭 AI has shifted its style {flipCount}× this match
                </Text>
              )}
              {variantId === 'sequence-recall' &&
                sequencePhase === 'showing' &&
                sequenceMoves.length > 0 && (
                  <Text style={styles.infoText}>
                    🧠 Watch:{' '}
                    {sequenceMoves.map((m) => MOVE_ICONS[m]).join(' ')}
                  </Text>
                )}
              {variantId === 'sequence-recall' &&
                sequencePhase === 'answering' && (
                  <Text style={styles.infoText}>
                    Now counter the LAST move in the sequence
                  </Text>
                )}
            </View>
          )}

          {/* ── Move display ── */}
          <View style={styles.moveDisplay}>
            <View style={styles.moveItem}>
              <Text style={styles.moveLabel}>You</Text>
              <View style={styles.moveCircle}>
                <Text style={styles.moveIcon}>
                  {myMove ? MOVE_ICONS[myMove] : '❓'}
                </Text>
              </View>
            </View>
            <Text style={styles.moveVs}>⚡</Text>
            <View style={styles.moveItem}>
              <Text style={styles.moveLabel} numberOfLines={1}>
                {avatar.name}
              </Text>
              <View style={styles.moveCircle}>
                {revealedAiMove && !aiMove ? (
                  <Text style={[styles.moveIcon, styles.revealedIcon]}>
                    {MOVE_ICONS[revealedAiMove]}
                  </Text>
                ) : (
                  <Text style={styles.moveIcon}>
                    {aiMove ? MOVE_ICONS[aiMove] : '❓'}
                  </Text>
                )}
              </View>
              {revealedAiMove && !aiMove && (
                <View style={styles.revealedBadge}>
                  <Eye size={9} color="#fbbf24" />
                  <Text style={styles.revealedText}>revealed</Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Round result ── */}
          <View style={styles.resultWrapper}>
            {roundWinner && !matchOver && (
              <Text
                style={[
                  styles.resultText,
                  roundWinner === 'player'
                    ? styles.resultWin
                    : roundWinner === 'ai'
                    ? styles.resultLose
                    : styles.resultTie,
                ]}
              >
                {roundWinner === 'player'
                  ? '🎉 Round Won!'
                  : roundWinner === 'ai'
                  ? '😢 Round Lost'
                  : '🤝 Tie!'}
              </Text>
            )}
          </View>

          {/* ── Buttons / match over ── */}
          {matchOver ? (
            <View style={styles.matchOverArea}>
              <Text style={styles.matchOverEmoji}>
                {matchWinner === 'player'
                  ? '🏆'
                  : matchWinner === 'tie'
                  ? '🤝'
                  : '💀'}
              </Text>
              <Text
                style={[
                  styles.matchOverTitle,
                  matchWinner === 'player'
                    ? styles.matchOverWin
                    : matchWinner === 'tie'
                    ? styles.matchOverTie
                    : styles.matchOverLose,
                ]}
              >
                {matchWinner === 'player'
                  ? 'Victory!'
                  : matchWinner === 'tie'
                  ? 'Tie'
                  : 'Defeat'}
              </Text>
              <Text style={styles.matchOverNote}>
                Analyzing how you played…
              </Text>
            </View>
          ) : (
            <View style={styles.buttonsArea}>
              {!myMove && !roundWinner && (
                <View style={styles.moveButtons}>
                  {ALL_MOVES.map((move) => {
                    const isHighlighted =
                      variantId === 'roulette' && move === highlightedMove;
                    return (
                      <TouchableOpacity
                        key={move}
                        style={[
                          styles.moveButton,
                          isHighlighted && styles.moveButtonHighlighted,
                        ]}
                        onPress={() => handleMove(move)}
                        activeOpacity={0.6}
                      >
                        <Text style={styles.moveBtnIcon}>
                          {MOVE_ICONS[move]}
                        </Text>
                        <Text
                          style={[
                            styles.moveBtnName,
                            isHighlighted && styles.moveBtnNameHighlighted,
                          ]}
                        >
                          {MOVE_NAMES[move]}
                        </Text>
                        {isHighlighted && (
                          <Text style={styles.highlightBadge}>+2</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {myMove && !roundWinner && (
                <Text style={styles.waitingText}>
                  ⏳ {avatar.name} is thinking…
                </Text>
              )}
            </View>
          )}

          <View style={styles.hintWrap}>
            <Text style={styles.hintText}>{cfg.tagline}</Text>
          </View>
        </ScreenScroll>
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerBtn: { padding: 6, width: 32 },
  headerCenter: { alignItems: 'center', flex: 1, paddingHorizontal: 8 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  headerSubtitle: { fontSize: 10, color: '#5a5a7a', marginTop: 1 },
  scrollContent: { paddingBottom: 40 },

  timerBarWrap: {
    height: 32,
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  timerBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  timerBarText: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  warningBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  warningText: { fontSize: 12, color: '#fbbf24', fontWeight: '700' },

  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  scoreItem: { alignItems: 'center', flex: 1 },
  scoreName: {
    fontSize: 11,
    color: '#5a5a7a',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  scoreValue: { fontSize: 28, fontWeight: '800', color: '#ffffff', marginTop: 2 },
  scoreTies: { fontSize: 10, color: '#5a5a7a', marginTop: 1 },
  scoreCenter: { alignItems: 'center', paddingHorizontal: 8, paddingTop: 8 },
  scoreVs: { fontSize: 16, color: '#e94560' },
  scoreRound: { fontSize: 10, color: '#5a5a7a', marginTop: 2 },

  infoCard: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(167, 139, 250, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.25)',
  },
  infoText: { fontSize: 12, color: '#c0c0d0', fontWeight: '600' },

  moveDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  moveItem: { alignItems: 'center', flex: 1 },
  moveLabel: {
    fontSize: 10,
    color: '#5a5a7a',
    textTransform: 'uppercase',
    marginBottom: 6,
    fontWeight: '600',
  },
  moveCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  moveIcon: { fontSize: 32 },
  revealedIcon: { opacity: 0.7 },
  revealedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
  },
  revealedText: { fontSize: 8, color: '#fbbf24', fontWeight: '800' },
  moveVs: { fontSize: 18, color: '#5a5a7a', marginHorizontal: 6 },
  resultWrapper: { minHeight: 40, justifyContent: 'center' },
  resultText: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  resultWin: { color: '#4ade80' },
  resultLose: { color: '#f87171' },
  resultTie: { color: '#fbbf24' },
  buttonsArea: {
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 12,
  },
  moveButtons: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  moveButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    width: 80,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  moveButtonHighlighted: {
    backgroundColor: 'rgba(251, 191, 36, 0.10)',
    borderColor: '#fbbf24',
  },
  moveBtnIcon: { fontSize: 32, marginBottom: 2 },
  moveBtnName: {
    fontSize: 11,
    color: '#5a5a7a',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  moveBtnNameHighlighted: { color: '#fbbf24' },
  highlightBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    fontSize: 9,
    fontWeight: '900',
    color: '#0a0a0f',
    backgroundColor: '#fbbf24',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  waitingText: { fontSize: 14, color: '#5a5a7a', textAlign: 'center' },
  matchOverArea: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  matchOverEmoji: { fontSize: 56 },
  matchOverTitle: { fontSize: 30, fontWeight: '800' },
  matchOverWin: { color: '#4ade80' },
  matchOverLose: { color: '#f87171' },
  matchOverTie: { color: '#fbbf24' },
  matchOverNote: {
    fontSize: 12,
    color: '#5a5a7a',
    marginTop: 6,
    fontStyle: 'italic',
  },
  hintWrap: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  hintText: {
    fontSize: 10,
    color: '#3a3a4a',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: '#5a5a7a' },
  emptyBtn: {
    backgroundColor: '#a78bfa',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
});