import React from 'react';
import type { ExpoEmbeddedPhotoPickerProps } from './ExpoEmbeddedPhotoPicker.types';

/**
 * Fallback for non-Android platforms (iOS, Web).
 * Embedded Photo Picker is an Android-exclusive API (API 34+ / U Extensions 15+).
 */
export default function ExpoEmbeddedPhotoPickerView(_props: ExpoEmbeddedPhotoPickerProps) {
  return null;
}
