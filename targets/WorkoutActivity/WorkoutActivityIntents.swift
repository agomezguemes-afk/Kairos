// App Intents for the workout Live Activity buttons (iOS 17+).
//
// TARGET MEMBERSHIP: compile this file into BOTH the app target and the
// widget extension. `LiveActivityIntent` performs IN THE APP PROCESS, which
// is what lets us reach the RN bridge: perform() posts a NotificationCenter
// notification that KairosLiveActivityModule observes and forwards to JS.

import AppIntents
import Foundation

@available(iOS 17.0, *)
struct CompleteSetIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Completar serie"
  static var description = IntentDescription("Marca la serie actual como completada.")
  // No UI, no app foregrounding — the whole point is logging without unlock.
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    NotificationCenter.default.post(
      name: Notification.Name("KairosLiveActivityWidgetAction"),
      object: nil,
      userInfo: ["action": "completeSet"]
    )
    return .result()
  }
}

@available(iOS 17.0, *)
struct ExtendRestIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Añadir 30 segundos"
  static var description = IntentDescription("Añade 30 segundos al descanso en curso.")
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    NotificationCenter.default.post(
      name: Notification.Name("KairosLiveActivityWidgetAction"),
      object: nil,
      userInfo: ["action": "extendRest"]
    )
    return .result()
  }
}
