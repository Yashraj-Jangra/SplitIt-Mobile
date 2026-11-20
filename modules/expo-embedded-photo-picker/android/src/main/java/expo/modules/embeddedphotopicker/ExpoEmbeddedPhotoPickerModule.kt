package expo.modules.embeddedphotopicker

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoEmbeddedPhotoPickerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoEmbeddedPhotoPicker")

    Function("isSupported") {
      EmbeddedPhotoPickerSupport.isSupported()
    }

    View(ExpoEmbeddedPhotoPickerView::class) {
      Events("onUriPermissionGranted", "onUriPermissionRevoked", "onSelectionComplete")

      Prop("maxSelectionLimit") { view: ExpoEmbeddedPhotoPickerView, limit: Int? ->
        limit?.let { view.updateMaxSelectionLimit(it) }
      }

      Prop("orderedSelection") { view: ExpoEmbeddedPhotoPickerView, ordered: Boolean? ->
        ordered?.let { view.updateOrderedSelection(it) }
      }

      Prop("accentColor") { view: ExpoEmbeddedPhotoPickerView, color: String? ->
        view.updateAccentColor(color)
      }

      Prop("expanded") { view: ExpoEmbeddedPhotoPickerView, expanded: Boolean? ->
        expanded?.let { view.updateExpandedState(it) }
      }

      AsyncFunction("setExpanded") { view: ExpoEmbeddedPhotoPickerView, expanded: Boolean ->
        view.updateExpandedState(expanded)
      }
    }
  }
}
