module.exports = function (api) {
  api.cache(true);
  return {
    // zustand v5 middleware reads import.meta.env; web bundles are classic
    // scripts, so it must be transformed or the app dies on load.
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    plugins: [
      // react-native-worklets/plugin must be last (Reanimated 4 delegates to worklets)
      'react-native-worklets/plugin',
    ],
  };
};
