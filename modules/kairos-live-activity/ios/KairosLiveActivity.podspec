Pod::Spec.new do |s|
  s.name           = 'KairosLiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'Live Activity bridge for Kairos workouts'
  s.description    = 'Starts/updates/ends the workout Live Activity and forwards widget App Intent actions to JS.'
  s.author         = 'Kairos'
  s.homepage       = 'https://kairos.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.license        = { :type => 'MIT' }

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,swift}'
end
