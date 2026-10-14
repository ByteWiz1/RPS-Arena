declare module 'react-native-sprites' {
  import { Component } from 'react';
  import { ImageSourcePropType, ViewStyle, StyleProp } from 'react-native';

  export interface SpritesMethods {
    play: (options: {
      type: string;
      fps?: number;
      loop?: boolean;
      onFinish?: () => void;
      onStart?: () => void;
    }) => void;
    stop: () => void;
    reset: () => void;
  }

  export interface SpritesProps {
    source: ImageSourcePropType;
    columns: number;
    rows: number;
    animations: Record<
      string,
      { row: number; startFrame: number; endFrame: number }
    >;
    style?: StyleProp<ViewStyle>;
    ref?: React.Ref<SpritesMethods>;
  }

  export default class Sprites extends Component<SpritesProps> {}
}