import ExpoModulesCore
import Vision

public class ScheduleOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ScheduleOcr")
    AsyncFunction("recognize") { (uri: String) -> [String] in
      guard let url = URL(string: uri), url.isFileURL else {
        throw Exception(name: "InvalidImage", description: "Only a local image is accepted.")
      }
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.recognitionLanguages = ["fr-FR", "en-US"]
      request.usesLanguageCorrection = false
      // URL-based Vision handler reads image orientation metadata.
      try VNImageRequestHandler(url: url, options: [:]).perform([request])
      return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
    }
  }
}
