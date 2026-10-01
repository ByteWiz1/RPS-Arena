// src/components/BracketConnector.tsx
//
// RPS Arena — connector lines for the tournament bracket.
//
// Soccer/football bracket style. Draws the L-shaped and T-shaped
// junctions between round N squares and round N+1 squares using
// plain Views. No SVG, no new dependencies.
//
// How the layout works (STEP 9):
//   Rounds flow left -> right.
//   Squares in round N are spaced at y = 0, gap, 2*gap, 3*gap, ...
//   Squares in round N+1 are vertically centered between each PAIR
//   of round N squares (because two round N squares feed one round
//   N+1 square).
//
//   So for a round with N squares at pitch P, the next round has
//   ceil(N/2) squares at pitch 2P, offset by P/2 relative to the
//   previous round's top.
//
// BracketConnectorColumn takes:
//   - count       how many destination squares there are in round N+1
//   - squareH     height of each square (from BracketSquare)
//   - vGap        vertical gap between squares within a round
//   - hWidth      horizontal width of the connector column
//   - color       stroke color
//
// and draws one T-junction per destination square. Squares that are
// the "left" of a pair (feeding the destination) get a small vertical
// stub; squares that are the "right" of a pair do the same, and the
// horizontal bar joins them into the destination.

import React from 'react';
import { View, StyleSheet } from 'react-native';

interface ColumnProps {
  // Number of destination squares (in round N+1). Each destination
  // is fed by up to 2 source squares from round N.
  count: number;

  // Vertical pitch between source squares (round N).
  // Destination squares sit at pitch 2 * sourcePitch.
  sourcePitch: number;

  // Height of a source square.
  squareH: number;

  // Vertical gap between source squares. Should be sourcePitch - squareH.
  sourceGap: number;

  // Horizontal width of the connector column.
  hWidth?: number;

  // Line thickness.
  thickness?: number;

  // Stroke color.
  color?: string;
}

export function BracketConnectorColumn({
  count,
  sourcePitch,
  squareH,
  sourceGap,
  hWidth = 32,
  thickness = 1.5,
  color = 'rgba(255,255,255,0.18)',
}: ColumnProps) {
  if (count <= 0) return <View style={{ width: hWidth }} />;

  const destPitch = sourcePitch * 2;

  return (
    <View style={[styles.column, { width: hWidth, height: count * destPitch }]}>
      {Array.from({ length: count }).map((_, i) => {
        // Destination square i sits centered between source squares
        // 2i and 2i+1.
        //
        // Top of destination square i (in this column's coordinate
        // space, where y=0 is the top of source square 0):
        //   destTop = 2i * sourcePitch + sourcePitch / 2 - squareH / 2
        const destTop = i * destPitch + sourcePitch / 2 - squareH / 2;
        const destMidY = destTop + squareH / 2;

        // Top of source square 2i (in this column's coordinate space).
        const srcTopA = i * destPitch;
        const srcMidA = srcTopA + squareH / 2;

        // Top of source square 2i+1.
        const srcTopB = srcTopA + sourcePitch;
        const srcMidB = srcTopB + squareH / 2;

        // For the last destination when the source count is odd,
        // there is no second source square. The connector degenerates
        // into a straight horizontal line from the single source's
        // midpoint to the destination's left edge. (This happens when
        // round N had an odd number of players and round N+1 has
        // ceil(N/2) squares; the odd one out is fed by a BYE square
        // that we still draw a connector for.)
        const hasSecondSource = (2 * i + 1) < count * 2;

        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: hWidth,
              height: count * destPitch,
            }}
            pointerEvents="none"
          >
            {/* Horizontal from source A mid to column mid */}
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: srcMidA - thickness / 2,
                width: hWidth / 2,
                height: thickness,
                backgroundColor: color,
              }}
            />

            {/* Horizontal from source B mid to column mid */}
            {hasSecondSource ? (
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: srcMidB - thickness / 2,
                  width: hWidth / 2,
                  height: thickness,
                  backgroundColor: color,
                }}
              />
            ) : null}

            {/* Vertical bar joining the two source stubs */}
            {hasSecondSource ? (
              <View
                style={{
                  position: 'absolute',
                  left: hWidth / 2 - thickness / 2,
                  top: srcMidA,
                  width: thickness,
                  height: srcMidB - srcMidA,
                  backgroundColor: color,
                }}
              />
            ) : null}

            {/* Horizontal from column mid to destination left edge */}
            <View
              style={{
                position: 'absolute',
                left: hWidth / 2 - thickness / 2,
                top: destMidY - thickness / 2,
                width: hWidth / 2,
                height: thickness,
                backgroundColor: color,
              }}
            />
          </View>
        );
      })}
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// BracketConnector — a single L-junction primitive.
//
// Used internally by the column above. Exported for reuse if a
// future layout (e.g. a horizontal final) wants a one-off
// connector without the full column machinery.
// ────────────────────────────────────────────────────────────

interface ConnectorProps {
  width?: number;
  height?: number;
  thickness?: number;
  color?: string;
  // 'right' (default) draws a line down and to the right, 'left'
  // mirrors. Kept simple; the column does not use this shape.
  direction?: 'right' | 'left';
}

export function BracketConnector({
  width = 32,
  height = 24,
  thickness = 1.5,
  color = 'rgba(255,255,255,0.18)',
  direction = 'right',
}: ConnectorProps) {
  const isRight = direction === 'right';
  const hStyle = {
    position: 'absolute' as const,
    top: height / 2 - thickness / 2,
    width: width / 2,
    height: thickness,
    backgroundColor: color,
    left: isRight ? 0 : width / 2,
  };
  const vStyle = {
    position: 'absolute' as const,
    left: width / 2 - thickness / 2,
    top: 0,
    width: thickness,
    height: height / 2,
    backgroundColor: color,
  };
  return (
    <View style={{ width, height, position: 'relative' }}>
      <View style={vStyle} />
      <View style={hStyle} />
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    position: 'relative',
  },
});

export default BracketConnectorColumn;