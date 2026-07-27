// App Intents for the workout Live Activity buttons (iOS 17+).
//
// TARGET MEMBERSHIP: compile this file into BOTH the app target and the widget
// extension. `LiveActivityIntent` performs IN THE APP PROCESS, which is what
// lets us reach the RN bridge without opening the app — the whole point of the
// mandate (docs/INWORKOUT_GLANCE_MODE.md §5): advance the session without
// unlocking the phone.
//
// Dispatch is two-channel, and the queue is the source of truth:
//   1. UserDefaults queue — durable. iOS may LAUNCH the app in the background
//      to run the intent; the RN runtime then has no listener yet (or no store
//      hydrated), and a bare notification would be lost. The queue survives
//      until KairosLiveActivityModule flushes it (OnStartObserving).
//   2. NotificationCenter ping — liveness. When the app is already running,
//      this wakes the module to drain the queue immediately (~instant).
//
// `.standard` defaults are correct precisely BECAUSE this runs in the app
// process. If any of these ever becomes a plain AppIntent (widget process), the
// queue must move to an App Group container.

import AppIntents
import Foundation

private let kairosWidgetActionNotification = Notification.Name("KairosLiveActivityWidgetAction")
private let kairosPendingActionsKey = "kairos.liveActivity.pendingActions"

@available(iOS 17.0, *)
private func dispatchWidgetAction(_ action: String) {
  let defaults = UserDefaults.standard
  var queue = defaults.array(forKey: kairosPendingActionsKey) as? [[String: Any]] ?? []
  // Property-list types only (String/Double) — this dictionary is persisted.
  queue.append([
    "action": action,
    "ts": Date().timeIntervalSince1970 * 1000.0,
  ])
  defaults.set(queue, forKey: kairosPendingActionsKey)

  NotificationCenter.default.post(
    name: kairosWidgetActionNotification,
    object: nil,
    userInfo: ["action": action]
  )
}

/// HECHO — the one-thumb action. Logs the current set with the values the Live
/// Activity is already showing (the progression's suggestion), so confirming is
/// a single tap on the lock screen.
@available(iOS 17.0, *)
struct CompleteSetIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Completar serie"
  static var description = IntentDescription("Marca la serie actual como completada.")
  // No UI, no app foregrounding — the whole point is logging without unlock.
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    dispatchWidgetAction("completeSet")
    return .result()
  }
}

@available(iOS 17.0, *)
struct ExtendRestIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Añadir 30 segundos"
  static var description = IntentDescription("Añade 30 segundos al descanso en curso.")
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    dispatchWidgetAction("extendRest")
    return .result()
  }
}

@available(iOS 17.0, *)
struct SkipRestIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Saltar descanso"
  static var description = IntentDescription("Termina el descanso y pasa a la siguiente serie.")
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    dispatchWidgetAction("skipRest")
    return .result()
  }
}
