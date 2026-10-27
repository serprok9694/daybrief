// https://docs.expo.dev/guides/monorepos/ and NativeWind v4 metro setup.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: './src/global.css',
  configPath: './tailwind.config.ts',
});
