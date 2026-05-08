Pod::Spec.new do |s|
  s.name           = 'ExpoAudioRoute'
  s.version        = '0.1.0'
  s.summary        = 'Expo module for detecting audio output route (headphones, bluetooth, speaker)'
  s.description    = 'Detects the current audio output route and emits events when it changes'
  s.author         = ''
  s.homepage       = 'https://github.com/example/expo-audio-route'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
