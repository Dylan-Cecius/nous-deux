package com.nousdeux.scheduleocr

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ScheduleOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ScheduleOcr")
    AsyncFunction("recognize") { source: String, promise: Promise ->
      val context = appContext.reactContext
      val uri = Uri.parse(source)
      if (context == null || uri.scheme !in listOf("file", "content")) {
        promise.reject("INVALID_IMAGE", "Only a local image is accepted.", null)
      } else {
        try {
          val image = InputImage.fromFilePath(context, uri)
          val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
          recognizer.process(image)
            .addOnSuccessListener { text ->
              promise.resolve(text.textBlocks.flatMap { block -> block.lines.map { line ->
                val box = line.boundingBox
                // Retain a missing geometry as plain text, never drop recognised content.
                if (box == null) line.text else mapOf(
                  "text" to line.text, "x" to box.left, "y" to box.top,
                  "width" to box.width(), "height" to box.height()
                )
              } })
            }
            .addOnFailureListener { promise.reject("OCR_FAILED", "Image recognition failed.", null) }
            .addOnCompleteListener { recognizer.close() }
        } catch (_: Exception) {
          promise.reject("INVALID_IMAGE", "Image could not be read.", null)
        }
      }
    }
  }
}
