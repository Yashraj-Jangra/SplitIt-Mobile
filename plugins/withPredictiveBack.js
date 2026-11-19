const { withAndroidManifest, withGradleProperties, withMainActivity } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to:
 * 1. Enable Android 14+ / Android 15 Predictive Back gestures by setting android:enableOnBackInvokedCallback="true"
 * 2. Enforce android.enableMinifyInReleaseBuilds=false to protect JNI reflection, Hermes, and TurboModules from R8 stripping
 * 3. Ensure MainActivity.kt implements OnBackPressedCallback with real-time BackEventCompat progress tracking
 */
const withPredictiveBack = (config) => {
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (application) {
      if (!application.$) {
        application.$ = {};
      }
      application.$['android:enableOnBackInvokedCallback'] = 'true';
    }
    return config;
  });

  config = withGradleProperties(config, (config) => {
    const properties = config.modResults;
    const minifyProp = properties.find((p) => p.type === 'property' && p.key === 'android.enableMinifyInReleaseBuilds');
    if (minifyProp) {
      minifyProp.value = 'false';
    } else {
      properties.push({
        type: 'property',
        key: 'android.enableMinifyInReleaseBuilds',
        value: 'false',
      });
    }
    return config;
  });

  config = withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('setupPredictiveBack')) {
      const importsToAdd = [
        'import android.graphics.Outline',
        'import android.view.View',
        'import android.view.ViewOutlineProvider',
        'import android.view.animation.DecelerateInterpolator',
        'import androidx.activity.BackEventCompat',
        'import androidx.activity.OnBackPressedCallback',
      ];
      for (const imp of importsToAdd) {
        if (!contents.includes(imp)) {
          contents = contents.replace(/(package\s+[\w.]+)/, (match) => `${match}\n${imp}`);
        }
      }

      if (contents.includes('super.onCreate(') && !contents.includes('setupPredictiveBack()')) {
        contents = contents.replace(/(super\.onCreate\([^)]*\))/, (match) => `${match}\n    setupPredictiveBack()`);
      }

      const methodCode = `
  /**
   * Sets up Android 14+ / Android 15 Predictive Back progress tracking.
   * Tracks user swipe gestures interactively: scaling, corner-rounding, and translating
   * the screen smoothly 1:1 with finger progress across the halfway mark before popping.
   */
  private fun setupPredictiveBack() {
    val callback = object : OnBackPressedCallback(true) {
      private var isTracking = false
      private var activeEdge: Int = BackEventCompat.EDGE_LEFT

      private fun getTargetView(): View? {
        return findViewById(android.R.id.content) ?: window.decorView
      }

      override fun handleOnBackStarted(backEvent: BackEventCompat) {
        super.handleOnBackStarted(backEvent)
        activeEdge = backEvent.swipeEdge
        isTracking = true
        val target = getTargetView() ?: return

        target.pivotX = if (activeEdge == BackEventCompat.EDGE_LEFT) target.width.toFloat() else 0f
        target.pivotY = target.height.toFloat() / 2f
        target.clipToOutline = true
        target.outlineProvider = object : ViewOutlineProvider() {
          override fun getOutline(view: View, outline: Outline) {
            val density = resources.displayMetrics.density
            outline.setRoundRect(0, 0, view.width, view.height, 24f * density)
          }
        }
      }

      override fun handleOnBackProgressed(backEvent: BackEventCompat) {
        super.handleOnBackProgressed(backEvent)
        val target = getTargetView() ?: return
        val progress = backEvent.progress

        // Fluid interactive scaling (1.0 -> 0.90) and corner rounding
        val scale = 1f - (0.10f * progress)
        target.scaleX = scale
        target.scaleY = scale

        // Interactive translation tracking swipe progress (up to 42% screen width)
        val maxShift = target.width * 0.42f
        val shift = if (activeEdge == BackEventCompat.EDGE_LEFT) {
          progress * maxShift
        } else {
          -progress * maxShift
        }
        target.translationX = shift
      }

      override fun handleOnBackPressed() {
        val target = getTargetView()
        if (target != null && isTracking) {
          val width = target.width.toFloat()
          val exitShift = if (activeEdge == BackEventCompat.EDGE_LEFT) width else -width

          target.animate()
            .translationX(exitShift)
            .alpha(0.6f)
            .setDuration(160)
            .setInterpolator(DecelerateInterpolator(1.5f))
            .withEndAction {
              target.translationX = 0f
              target.translationY = 0f
              target.scaleX = 1f
              target.scaleY = 1f
              target.alpha = 1f
              target.clipToOutline = false
              isTracking = false

              // Dispatch actual back navigation to React Native / Activity dispatcher
              isEnabled = false
              onBackPressedDispatcher.onBackPressed()
              isEnabled = true
            }
            .start()
        } else {
          isEnabled = false
          onBackPressedDispatcher.onBackPressed()
          isEnabled = true
        }
      }

      override fun handleOnBackCancelled() {
        super.handleOnBackCancelled()
        val target = getTargetView() ?: return
        isTracking = false
        target.animate()
          .translationX(0f)
          .translationY(0f)
          .scaleX(1f)
          .scaleY(1f)
          .alpha(1f)
          .setDuration(220)
          .setInterpolator(DecelerateInterpolator(1.8f))
          .withEndAction {
            target.clipToOutline = false
          }
          .start()
      }
    }

    onBackPressedDispatcher.addCallback(this, callback)
  }
`;
      const lastBraceIdx = contents.lastIndexOf('}');
      if (lastBraceIdx !== -1) {
        contents = contents.slice(0, lastBraceIdx) + methodCode + contents.slice(lastBraceIdx);
      }
    }

    config.modResults.contents = contents;
    return config;
  });

  return config;
};

module.exports = withPredictiveBack;
