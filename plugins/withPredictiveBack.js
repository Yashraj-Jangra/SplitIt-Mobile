const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to enable Android 14+ / Android 15 Predictive Back gestures
 * by setting android:enableOnBackInvokedCallback="true" on <application>
 */
const withPredictiveBack = (config) => {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (application) {
      if (!application.$) {
        application.$ = {};
      }
      application.$['android:enableOnBackInvokedCallback'] = 'true';
    }
    return config;
  });
};

module.exports = withPredictiveBack;
