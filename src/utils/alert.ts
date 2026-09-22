import { Alert, Platform } from 'react-native';

const win = globalThis as any;

export function showAlert(
  title: string,
  message?: string,
  buttons?: {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }[]
) {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 1) {
      const confirmed = win.confirm(
        `${title}${message ? `\n\n${message}` : ''}`
      );
      if (confirmed) {
        const confirmButton = buttons.find((b) => b.style !== 'cancel');
        if (confirmButton?.onPress) confirmButton.onPress();
      } else {
        const cancelButton = buttons.find((b) => b.style === 'cancel');
        if (cancelButton?.onPress) cancelButton.onPress();
      }
    } else {
      win.alert(`${title}${message ? `\n\n${message}` : ''}`);
      if (buttons && buttons[0]?.onPress) buttons[0].onPress();
    }
  } else {
    Alert.alert(title, message, buttons);
  }
}