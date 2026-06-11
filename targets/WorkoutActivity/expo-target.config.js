// Config for @bacons/apple-targets (optional path — see
// docs/LIVE_ACTIVITY_SETUP.md for the manual Xcode alternative).
// The plugin generates a widget-extension target from this folder during
// `npx expo prebuild`.

/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'widget',
  name: 'WorkoutActivity',
  deploymentTarget: '16.2',
  frameworks: ['SwiftUI', 'ActivityKit', 'WidgetKit', 'AppIntents'],
};
