import React from 'react';
import { View, StyleSheet } from 'react-native';
import SpriteSheetPlayer from './SpriteSheetPlayer';
import { CharacterDef, BattleAnimation } from '../data/characters';

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
  const def = character.animations[animation];
  if (!def) return null;

  return (
    <View
      style={[
        styles.wrap,
        {
          transform: facing === 'left' ? [{ scaleX: -1 }] : undefined,
        },
      ]}
    >
      <SpriteSheetPlayer
        source={character.sheet}
        columns={character.columns}
        rows={character.rows}
        frameWidth={character.frameWidth}
        frameHeight={character.frameHeight}
        animation={def}
        onFinish={def.loop ? undefined : onAnimationEnd}
        size={size}
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