// src/components/PersonalityChart.tsx
//
// RPS Arena — Chat 10 (AI Training UI).
//
// A compact four-axis radar chart for { aggression, memory, randomness,
// defense }. Pure React Native primitives (View + Text), no SVG deps,
// so it works on Expo web with zero new packages.
//
// Two modes:
//   - Single series: renders one polygon (current personality)
//   - Comparison: renders "before" (ghost) + "after" (filled) polygons
//     with per-axis delta arrows — used on TrainingResultScreen.
//
// Everything is drawn with absolutely-positioned rotated Views, which
// React Native + Expo web both support. No Canvas, no SVG.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface PersonalityWeights {
  aggression: number;
  memory: number;
  randomness: number;
  defense: number;
}

interface Props {
  // Primary series (rendered filled)
  values: PersonalityWeights;
  // Optional ghost series (rendered as an outline behind the primary)
  compareValues?: PersonalityWeights;
  // Chart size in px (square). Default 220.
  size?: number;
  // Accent color for the primary series. Default violet.
  accent?: string;
  // Accent color for the ghost series. Default slate.
  compareAccent?: string;
  // Show numeric values around the chart. Default true.
  showValues?: boolean;
  // Show per-axis delta arrows when compareValues present. Default true.
  showDeltas?: boolean;
}

// Axis order is fixed. Angles are measured from the top of the chart,
// clockwise: aggression = 12 o'clock, memory = 3 o'clock,
// randomness = 6 o'clock, defense = 9 o'clock.
const AXES: Array<{
  key: keyof PersonalityWeights;
  label: string;
  angleDeg: number;
}> = [
  { key: 'aggression', label: 'AGG', angleDeg: 0 },
  { key: 'memory', label: 'MEM', angleDeg: 90 },
  { key: 'randomness', label: 'RND', angleDeg: 180 },
  { key: 'defense', label: 'DEF', angleDeg: 270 },
];

const MIN_VALUE = 0.05;
const MAX_VALUE = 0.95;

// Convert a 0..1 value into a radius fraction for the chart.
// We anchor on [MIN_VALUE, MAX_VALUE] instead of [0, 1] because the
// training clamp never lets a weight outside that range — anchoring
// on the real domain makes small shifts visible.
function valueToFraction(v: number): number {
  const clamped = Math.max(MIN_VALUE, Math.min(MAX_VALUE, v));
  return (clamped - MIN_VALUE) / (MAX_VALUE - MIN_VALUE);
}

// Convert polar (angle from top, clockwise) into cartesian offsets
// from center. Returns { x, y } in px.
function polarToXY(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: Math.cos(rad) * radius,
    y: Math.sin(rad) * radius,
  };
}

// Build an array of N points around the axis grid — used for the
// outer ring and the mid-ring guide.
function ringPoints(radius: number): Array<{ x: number; y: number }> {
  return AXES.map((a) => polarToXY(a.angleDeg, radius));
}

// Draw a line segment between two absolute positions. React Native
// has no <line>, so we render a thin rotated View.
function Segment({
  x1,
  y1,
  x2,
  y2,
  color,
  width,
  centerX,
  centerY,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  centerX: number;
  centerY: number;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 0.5) return null;

  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: centerX + midX - length / 2,
        top: centerY + midY - width / 2,
        width: length,
        height: width,
        backgroundColor: color,
        transform: [{ rotate: `${angleDeg}deg` }],
      }}
    />
  );
}

export default function PersonalityChart({
  values,
  compareValues,
  size = 220,
  accent = '#a78bfa',
  compareAccent = 'rgba(255,255,255,0.35)',
  showValues = true,
  showDeltas = true,
}: Props) {
  const centerX = size / 2;
  const centerY = size / 2;
  const maxRadius = size / 2 - 34; // leave room for axis labels

  // ── Guide rings ──
  const outerRing = ringPoints(maxRadius);
  const midRing = ringPoints(maxRadius * 0.5);

  // ── Primary series ──
  const primaryPts = AXES.map((a) => {
    const r = valueToFraction(values[a.key]) * maxRadius;
    const { x, y } = polarToXY(a.angleDeg, r);
    return { x, y, value: values[a.key] };
  });

  // ── Compare (ghost) series ──
  const comparePts = compareValues
    ? AXES.map((a) => {
        const r = valueToFraction(compareValues[a.key]) * maxRadius;
        const { x, y } = polarToXY(a.angleDeg, r);
        return { x, y, value: compareValues[a.key] };
      })
    : null;

  // Convert per-axis points into a closed polygon by drawing segments
  // between adjacent points, plus the closing segment.
  const drawPolygon = (
    pts: Array<{ x: number; y: number }>,
    color: string,
    width: number
  ) => {
    const nodes: React.ReactNode[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      nodes.push(
        <Segment
          key={`${color}-${i}`}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          color={color}
          width={width}
          centerX={centerX}
          centerY={centerY}
        />
      );
    }
    return nodes;
  };

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {/* Outer guide ring */}
      {drawPolygon(outerRing, 'rgba(255,255,255,0.10)', 1)}
      {/* Mid guide ring */}
      {drawPolygon(midRing, 'rgba(255,255,255,0.05)', 1)}

      {/* Axis spokes from center outward */}
      {AXES.map((a) => {
        const outer = polarToXY(a.angleDeg, maxRadius);
        return (
          <Segment
            key={`spoke-${a.key}`}
            x1={0}
            y1={0}
            x2={outer.x}
            y2={outer.y}
            color="rgba(255,255,255,0.08)"
            width={1}
            centerX={centerX}
            centerY={centerY}
          />
        );
      })}

      {/* Ghost (before) polygon */}
      {comparePts && drawPolygon(comparePts, compareAccent, 1.5)}

      {/* Primary (after) polygon */}
      {drawPolygon(primaryPts, accent, 2)}

      {/* Vertex dots for primary */}
      {primaryPts.map((p, i) => (
        <View
          key={`dot-${i}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: centerX + p.x - 3,
            top: centerY + p.y - 3,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: accent,
          }}
        />
      ))}

      {/* Vertex dots for ghost */}
      {comparePts &&
        comparePts.map((p, i) => (
          <View
            key={`ghostdot-${i}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: centerX + p.x - 2,
              top: centerY + p.y - 2,
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: compareAccent,
            }}
          />
        ))}

      {/* Axis labels + values */}
      {AXES.map((a) => {
        const labelR = maxRadius + 18;
        const { x, y } = polarToXY(a.angleDeg, labelR);
        const v = values[a.key];
        const ghost = compareValues?.[a.key];
        const delta = ghost !== undefined ? v - ghost : 0;

        return (
          <View
            key={`label-${a.key}`}
            pointerEvents="none"
            style={[
              styles.labelWrap,
              {
                left: centerX + x - 30,
                top: centerY + y - 14,
              },
            ]}
          >
            <Text style={styles.axisLabel}>{a.label}</Text>
            {showValues && (
              <Text style={[styles.axisValue, { color: accent }]}>
                {Math.round(v * 100)}
              </Text>
            )}
            {showDeltas && Math.abs(delta) >= 0.005 && (
              <Text
                style={[
                  styles.deltaValue,
                  { color: delta > 0 ? '#4ade80' : '#f87171' },
                ]}
              >
                {delta > 0 ? '▲' : '▼'}
                {Math.abs(Math.round(delta * 100))}
              </Text>
            )}
          </View>
        );
      })}

      {/* Center dot */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: centerX - 2,
          top: centerY - 2,
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: 'rgba(255,255,255,0.3)',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignSelf: 'center',
  },
  labelWrap: {
    position: 'absolute',
    width: 60,
    alignItems: 'center',
  },
  axisLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8a8a9a',
    letterSpacing: 0.5,
  },
  axisValue: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 1,
  },
  deltaValue: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 1,
  },
});