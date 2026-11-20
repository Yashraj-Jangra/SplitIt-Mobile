package expo.modules.embeddedphotopicker

import android.os.Build
import android.os.ext.SdkExtensions

object EmbeddedPhotoPickerSupport {
  /**
   * Runtime check ensuring device is running Android 14+ (API 34+)
   * and SDK Extensions version 15+ required for Embedded Photo Picker.
   */
  fun isSupported(): Boolean {
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE &&
      SdkExtensions.getExtensionVersion(Build.VERSION_CODES.UPSIDE_DOWN_CAKE) >= 15
  }
}
