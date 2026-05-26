module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // babel-preset-expo enables Expo Router's transform automatically in SDK 55
      // (expo-router/babel was REMOVED in SDK 50 — do not add it).
      // jsxImportSource: 'nativewind' enables NativeWind's className -> style transform.
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // No Reanimated/worklets: its native module mismatches the Expo Go binary on
    // SDK 55 (TurboModule init error). Animations use RN's core Animated API instead.
  };
};
