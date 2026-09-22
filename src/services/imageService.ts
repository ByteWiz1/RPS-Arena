import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export interface PickedImage {
  uri: string;
  wasCancelled: boolean;
}

export async function pickFromCamera(): Promise<PickedImage> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return { uri: '', wasCancelled: true };
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      cameraType: ImagePicker.CameraType.front,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { uri: '', wasCancelled: true };
    }

    return { uri: result.assets[0].uri, wasCancelled: false };
  } catch (error) {
    console.log('Camera error:', error);
    return { uri: '', wasCancelled: true };
  }
}

export async function pickFromGallery(): Promise<PickedImage> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return { uri: '', wasCancelled: true };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { uri: '', wasCancelled: true };
    }

    return { uri: result.assets[0].uri, wasCancelled: false };
  } catch (error) {
    console.log('Gallery error:', error);
    return { uri: '', wasCancelled: true };
  }
}

export async function compressImageToBase64(
  sourceUri: string
): Promise<string | null> {
  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: 200, height: 200 } }],
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    if (!manipulated.base64) {
      return null;
    }

    return `data:image/jpeg;base64,${manipulated.base64}`;
  } catch (error) {
    console.log('Compress error:', error);
    return null;
  }
}