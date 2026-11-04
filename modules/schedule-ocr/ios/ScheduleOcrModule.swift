import ExpoModulesCore
import Vision

public class ScheduleOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ScheduleOcr")
    AsyncFunction("recognize") { (uri: String) -> [[String: Any]] in
      guard let url = URL(string: uri), url.isFileURL else {
        throw Exception(name: "InvalidImage", description: "Only a local image is accepted.")
      }
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.recognitionLanguages = ["fr-FR", "en-US"]
      request.usesLanguageCorrection = false
      // URL-based Vision handler reads image orientation metadata.
      try VNImageRequestHandler(url: url, options: [:]).perform([request])
      return (request.results ?? []).compactMap { observation -> [String: Any]? in
        guard let text = observation.topCandidates(1).first?.string else { return nil }
        let box = observation.boundingBox
        // Vision uses a bottom-left origin; the shared row assembler uses top-left.
        return ["text": text, "x": box.minX, "y": 1 - box.maxY,
                "width": box.width, "height": box.height]
      }
    }
  }
}
