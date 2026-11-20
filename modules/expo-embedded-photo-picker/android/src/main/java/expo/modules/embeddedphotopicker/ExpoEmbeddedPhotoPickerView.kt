@file:OptIn(androidx.photopicker.embedded.ExperimentalPhotoPickerApi::class)

package expo.modules.embeddedphotopicker

import android.content.Context
import android.graphics.Color
import android.net.Uri
import android.util.Log
import android.view.ViewGroup
import android.widget.photopicker.EmbeddedPhotoPickerFeatureInfo
import android.widget.photopicker.EmbeddedPhotoPickerSession
import androidx.annotation.OptIn
import androidx.photopicker.embedded.EmbeddedPhotoPickerView
import androidx.photopicker.embedded.ExperimentalPhotoPickerApi
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

@OptIn(ExperimentalPhotoPickerApi::class)
class ExpoEmbeddedPhotoPickerView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext) {

  private val TAG = "ExpoEmbeddedPhotoPicker"

  // Event dispatchers matching JavaScript callbacks
  private val onUriPermissionGranted by EventDispatcher<Map<String, Any>>()
  private val onUriPermissionRevoked by EventDispatcher<Map<String, Any>>()
  private val onSelectionComplete by EventDispatcher<Map<String, Any>>()

  // Internal configuration states
  private var maxSelectionLimit: Int = 1
  private var orderedSelection: Boolean = false
  private var accentColorLong: Long? = null
  private var isExpanded: Boolean = false

  private var embeddedView: EmbeddedPhotoPickerView? = null
  private var activeSession: EmbeddedPhotoPickerSession? = null

  init {
    if (EmbeddedPhotoPickerSupport.isSupported()) {
      try {
        val picker = EmbeddedPhotoPickerView(context)
        picker.layoutParams = LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT
        )

        picker.addEmbeddedPhotoPickerStateChangeListener(
          object : EmbeddedPhotoPickerView.EmbeddedPhotoPickerStateChangeListener {
            override fun onSessionOpened(newSession: EmbeddedPhotoPickerSession) {
              activeSession = newSession
              if (isExpanded) {
                try {
                  newSession.notifyPhotoPickerExpanded(true)
                } catch (e: Throwable) {
                  Log.w(TAG, "Failed to sync initial expanded state", e)
                }
              }
            }

            override fun onSessionError(throwable: Throwable) {
              Log.e(TAG, "Embedded photo picker session error", throwable)
            }

            override fun onUriPermissionGranted(uris: List<Uri>) {
              val uriStrings = uris.map { it.toString() }
              onUriPermissionGranted(mapOf("uris" to uriStrings))
            }

            override fun onUriPermissionRevoked(uris: List<Uri>) {
              val uriStrings = uris.map { it.toString() }
              onUriPermissionRevoked(mapOf("uris" to uriStrings))
            }

            override fun onSelectionComplete() {
              onSelectionComplete(emptyMap())
            }
          }
        )

        addView(picker)
        embeddedView = picker
        applyFeatureInfo()
      } catch (t: Throwable) {
        Log.e(TAG, "Failed to instantiate EmbeddedPhotoPickerView", t)
      }
    } else {
      Log.i(TAG, "EmbeddedPhotoPicker is not supported on this device/API level.")
    }
  }

  fun updateMaxSelectionLimit(limit: Int) {
    if (limit > 0 && limit != maxSelectionLimit) {
      maxSelectionLimit = limit
      applyFeatureInfo()
    }
  }

  fun updateOrderedSelection(ordered: Boolean) {
    if (ordered != orderedSelection) {
      orderedSelection = ordered
      applyFeatureInfo()
    }
  }

  fun updateAccentColor(colorStr: String?) {
    val parsedLong = if (!colorStr.isNullOrBlank()) {
      try {
        val colorInt = Color.parseColor(colorStr)
        colorInt.toLong() and 0xFFFFFFFFL
      } catch (_: Exception) {
        null
      }
    } else {
      null
    }

    if (parsedLong != accentColorLong) {
      accentColorLong = parsedLong
      applyFeatureInfo()
    }
  }

  fun updateExpandedState(expanded: Boolean) {
    isExpanded = expanded
    try {
      activeSession?.notifyPhotoPickerExpanded(expanded)
    } catch (e: Throwable) {
      Log.w(TAG, "Failed to notify photo picker expanded state: $expanded", e)
    }
  }

  private fun applyFeatureInfo() {
    val picker = embeddedView ?: return
    try {
      val builder = EmbeddedPhotoPickerFeatureInfo.Builder()
        .setMaxSelectionLimit(maxSelectionLimit)
        .setOrderedSelection(orderedSelection)
        .setMimeTypes(listOf("image/*"))

      accentColorLong?.let { color ->
        builder.setAccentColor(color)
      }

      picker.setEmbeddedPhotoPickerFeatureInfo(builder.build())
    } catch (e: Throwable) {
      Log.e(TAG, "Failed to apply EmbeddedPhotoPickerFeatureInfo", e)
    }
  }
}
