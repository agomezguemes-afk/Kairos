// Kairos on the Apple Watch: a watchOS app embedded in the iPhone app
// (@bacons/apple-targets). Bundle id is the phone's plus ".watch", which is
// also how the phone recognises the workouts it writes to Health.
/** @type {import('@bacons/apple-targets/build/config').ConfigFunction} */
module.exports = () => ({
  type: 'watch',
  name: 'KairosWatch',
  displayName: 'Kairos',
  bundleIdentifier: '.watch',
  // watchOS 11 runs on every Apple Watch from Series 6 / SE 2 on.
  deploymentTarget: '11.0',
  icon: '../../assets/icon.png',
  frameworks: ['SwiftUI', 'HealthKit', 'WatchConnectivity'],
  colors: {
    $accent: '#C9A96E',
    kInk: '#F2F0EA',
    kMuted: '#A9A59B',
    kSurface: '#1A1A18',
    kAccentSoft: '#3A3222',
  },
  entitlements: {
    'com.apple.developer.healthkit': true,
    'com.apple.developer.healthkit.access': [],
  },
});
