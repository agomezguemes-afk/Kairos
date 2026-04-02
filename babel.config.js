module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-worklets/plugin must be last (Reanimated 4 delegates to worklets)
      'react-native-worklets/plugin',
    ],
  };
};
