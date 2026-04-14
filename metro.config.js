const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 'cjs' is required for @supabase/storage-js which ships dist/index.cjs
config.resolver.sourceExts = ['js', 'jsx', 'json', 'ts', 'tsx', 'cjs'];
config.resolver.assetExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ttf', 'otf'];

module.exports = config;
