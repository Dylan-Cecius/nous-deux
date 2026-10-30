Pod::Spec.new do |s|
  s.name = 'ScheduleOcr'
  s.version = '1.0.0'
  s.summary = 'Local schedule text recognition for Nous Deux'
  s.description = 'Recognizes user-selected schedule images on device using Apple Vision.'
  s.license = { :type => 'Proprietary' }
  s.author = 'Nous Deux'
  s.homepage = 'https://github.com/Dylan-Cecius/nous-deux'
  s.source = { :git => 'https://github.com/Dylan-Cecius/nous-deux.git' }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision'
  s.source_files = '**/*.swift'
end
