module.exports = function (api) {
  api.cache(true);
  return {
    // zustand's ESM middleware reads `import.meta.env`, which is a syntax
    // error in Metro's non-module web bundle unless Babel polyfills it.
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    plugins: [
      // react-native-worklets/plugin must be last (Reanimated 4 delegates to worklets)
      'react-native-worklets/plugin',
    ],
  };
};
