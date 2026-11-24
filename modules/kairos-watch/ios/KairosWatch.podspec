Pod::Spec.new do |s|
  s.name           = 'KairosWatch'
  s.version        = '1.0.0'
  s.summary        = 'WatchConnectivity bridge between Kairos and its Apple Watch app'
  s.description    = 'Sends the plan to the watch, receives sessions logged on the wrist and live heart rate.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'WatchConnectivity', 'HealthKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files   = "**/*.{h,m,swift}"
end
