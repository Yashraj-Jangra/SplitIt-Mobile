const { withAndroidManifest, withGradleProperties } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to:
 * 1. Enable Android 14+ / Android 15 Predictive Back gestures by setting android:enableOnBackInvokedCallback="true"
 * 2. Enforce android.enableMinifyInReleaseBuilds=false to protect JNI reflection, Hermes, and TurboModules from R8 stripping
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

  return config;
};

module.exports = withPredictiveBack;
