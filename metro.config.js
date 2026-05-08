const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 'cjs' is required for @supabase/storage-js which ships dist/index.cjs
// 'mjs' is required for valibot 1.x which ships dist/index.mjs
config.resolver.sourceExts = ['js', 'jsx', 'json', 'ts', 'tsx', 'cjs', 'mjs'];
config.resolver.assetExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ttf', 'otf'];

module.exports = config;
