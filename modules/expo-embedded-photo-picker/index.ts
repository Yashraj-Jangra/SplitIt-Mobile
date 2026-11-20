import { Platform } from 'react-native';
import { requireNativeModule } from 'expo';
import ExpoEmbeddedPhotoPickerView from './src/ExpoEmbeddedPhotoPickerView';
import type {
  ExpoEmbeddedPhotoPickerProps,
  ExpoEmbeddedPhotoPickerModuleInterface,
  UriSelectionEvent,
  NativeUriSelectionPayload,
} from './src/ExpoEmbeddedPhotoPicker.types';

let nativeModule: ExpoEmbeddedPhotoPickerModuleInterface | null = null;

if (Platform.OS === 'android') {
  try {
    nativeModule = requireNativeModule<ExpoEmbeddedPhotoPickerModuleInterface>('ExpoEmbeddedPhotoPicker');
  } catch {
    nativeModule = null;
  }
}

/**
 * Checks whether the current device supports Android's Embedded Photo Picker.
 * Requires Android 14+ (API 34+) and SDK Extensions version 15+.
 * Returns false on iOS, Web, and unsupported Android versions.
 */
export function isEmbeddedPhotoPickerSupported(): boolean {
  if (Platform.OS !== 'android' || !nativeModule) {
    return false;
  }
  try {
    return !!nativeModule.isSupported();
  } catch {
    return false;
  }
}

export {
  ExpoEmbeddedPhotoPickerView as EmbeddedPhotoPickerView,
  ExpoEmbeddedPhotoPickerProps,
  UriSelectionEvent,
  NativeUriSelectionPayload,
};

export default ExpoEmbeddedPhotoPickerView;
