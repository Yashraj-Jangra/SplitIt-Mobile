import { type ViewStyle, type StyleProp } from 'react-native';

export interface UriSelectionEvent {
  uris: string[];
}

export interface NativeUriSelectionPayload {
  nativeEvent: UriSelectionEvent;
}

export interface ExpoEmbeddedPhotoPickerProps {
  /** Maximum number of photos/videos selectable. Default: 1 */
  maxSelectionLimit?: number;
  /** Whether selections should display numerical order badge. Default: false */
  orderedSelection?: boolean;
  /** Hex color string (e.g. '#6366f1') to match app accent */
  accentColor?: string;
  /** Bottom sheet expansion sync state */
  expanded?: boolean;
  /** Emitted when the user grants/selects media URIs */
  onUriPermissionGranted?: (event: NativeUriSelectionPayload) => void;
  /** Emitted when the user unselects/deselected media URIs */
  onUriPermissionRevoked?: (event: NativeUriSelectionPayload) => void;
  /** Emitted when the user taps Done or completes selection flow */
  onSelectionComplete?: () => void;
  style?: StyleProp<ViewStyle>;
}

export interface ExpoEmbeddedPhotoPickerModuleInterface {
  isSupported: () => boolean;
}
