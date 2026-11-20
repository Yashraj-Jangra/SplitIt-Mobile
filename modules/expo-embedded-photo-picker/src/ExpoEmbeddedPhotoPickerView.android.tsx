import React from 'react';
import { requireNativeView } from 'expo';
import type { ExpoEmbeddedPhotoPickerProps } from './ExpoEmbeddedPhotoPicker.types';

const NativeView = requireNativeView('ExpoEmbeddedPhotoPicker');

export default function ExpoEmbeddedPhotoPickerView(props: ExpoEmbeddedPhotoPickerProps) {
  return <NativeView {...props} />;
}
