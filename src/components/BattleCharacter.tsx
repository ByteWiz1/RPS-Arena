import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Sprites, { type SpritesMethods } from 'react-native-sprites';
import {
  CharacterDef,
  BattleAnimation,
} from '../data/characters';

interface Props {
  character: CharacterDef;
  animation: BattleAnimation;
  facing?: 'left' | 'right';
  size?: number;
  onAnimationEnd?: () => void;
}

export default function BattleCharacter({
  character,
  animation,
  facing = 'right',
  size = 140,
  onAnimationEnd,
}: Props) {
  const spriteRef = useRef<SpritesMethods>(null);

  const scale = size / character.frameWidth;
  const displayWidth = character.frameWidth * scale;
  const displayHeight = character.frameHeight * scale;

  // Build the animation map once per character
  const animationMap = useRef(
    Object.fromEntries(
      Object.entries(character.animations).map(([name, def]) => [
        name,
        {
          row: def.row,
          startFrame: def.startFrame,
          endFrame: def.endFrame,
        },
      ])
    )
  ).current;

  useEffect(() => {
    const def = character.animations[animation];
    if (!def || !spriteRef.current) return;

    spriteRef.current.play({
      type: animation,
      fps: def.fps,
      loop: def.loop,
      onFinish: def.loop ? undefined : onAnimationEnd,
    });
  }, [animation, character, onAnimationEnd]);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: displayWidth,
          height: displayHeight,
          transform: facing === 'left' ? [{ scaleX: -1 }] : undefined,
        },
      ]}
    >
      <Sprites
        ref={spriteRef}
        source={character.sheet}
        columns={character.columns}
        rows={character.rows}
        animations={animationMap}
        style={{
          width: displayWidth,
          height: displayHeight,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});