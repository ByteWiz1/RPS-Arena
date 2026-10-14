import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, View, StyleSheet, ImageSourcePropType } from 'react-native';

interface Props {
  source: ImageSourcePropType;
  columns: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
  animation: {
    row: number;
    startFrame: number;
    endFrame: number;
    loop: boolean;
    fps: number;
  };
  onFinish?: () => void;
  size?: number;
}

export default function SpriteSheetPlayer({
  source,
  columns,
  rows,
  frameWidth,
  frameHeight,
  animation,
  onFinish,
  size = 140,
}: Props) {
  const [frame, setFrame] = useState(animation.startFrame);
  const timerRef = useRef<any>(null);
  const scale = size / frameWidth;

  useEffect(() => {
    setFrame(animation.startFrame);
    const frameInterval = 1000 / animation.fps;
    const totalFrames = animation.endFrame - animation.startFrame + 1;
    let current = animation.startFrame;
    let count = 0;

    timerRef.current = setInterval(() => {
      count++;
      current = animation.startFrame + count;

      if (count >= totalFrames) {
        if (animation.loop) {
          count = 0;
          current = animation.startFrame;
        } else {
          clearInterval(timerRef.current);
          onFinish?.();
          return;
        }
      }
      setFrame(current);
    }, frameInterval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [animation, onFinish]);

  // Calculate crop position for the current frame
  const col = frame % columns;
  const row = Math.floor(frame / columns);

  return (
    <View
      style={{
        width: size,
        height: frameHeight * scale,
        overflow: 'hidden',
      }}
    >
      <Image
        source={source}
        style={{
          width: frameWidth * columns * scale,
          height: frameHeight * rows * scale,
          position: 'absolute',
          left: -col * frameWidth * scale,
          top: -row * frameHeight * scale,
        }}
        resizeMode="stretch"
      />
    </View>
  );
}