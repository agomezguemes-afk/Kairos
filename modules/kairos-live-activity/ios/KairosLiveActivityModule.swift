// Expo module bridging the workout Live Activity.
//
// start/update/end are called from the RN workout flow. Widget App Intents
// (LiveActivityIntent runs IN the app process on iOS 17+) post
// `kairosWidgetAction` on NotificationCenter; we forward it to JS as the
// `onWidgetAction` event.

import ExpoModulesCore

#if canImport(ActivityKit)
import ActivityKit
#endif

let kairosWidgetActionNotification = Notification.Name("KairosLiveActivityWidgetAction")

public class KairosLiveActivityModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("KairosLiveActivity")

    Events("onWidgetAction")

    OnCreate {
      self.observer = NotificationCenter.default.addObserver(
        forName: kairosWidgetActionNotification,
        object: nil,
        queue: .main
      ) { [weak self] note in
        guard let action = note.userInfo?["action"] as? String else { return }
        self?.sendEvent("onWidgetAction", ["action": action])
      }
    }

    OnDestroy {
      if let observer = self.observer {
        NotificationCenter.default.removeObserver(observer)
      }
    }

    Function("isSupported") { () -> Bool in
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      #endif
      return false
    }

    AsyncFunction("startActivity") { (state: [String: Any?]) in
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        // One workout = one activity. End strays from a previous session
        // (e.g. after a crash) before starting fresh.
        for activity in Activity<WorkoutActivityAttributes>.activities {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
        let attributes = WorkoutActivityAttributes(
          blockName: state["blockName"] as? String ?? "Entrenamiento"
        )
        let content = ActivityContent(
          state: Self.contentState(from: state),
          staleDate: nil
        )
        _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
      }
      #endif
    }

    AsyncFunction("updateActivity") { (state: [String: Any?]) in
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        let content = ActivityContent(
          state: Self.contentState(from: state),
          staleDate: nil
        )
        for activity in Activity<WorkoutActivityAttributes>.activities {
          await activity.update(content)
        }
      }
      #endif
    }

    AsyncFunction("endActivity") {
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        for activity in Activity<WorkoutActivityAttributes>.activities {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
      #endif
    }
  }

  #if canImport(ActivityKit)
  @available(iOS 16.2, *)
  private static func contentState(
    from state: [String: Any?]
  ) -> WorkoutActivityAttributes.ContentState {
    var restEndsAt: Date?
    if let ms = state["restEndsAt"] as? Double, ms > 0 {
      restEndsAt = Date(timeIntervalSince1970: ms / 1000.0)
    }
    return WorkoutActivityAttributes.ContentState(
      exerciseName: state["exerciseName"] as? String ?? "",
      setIndex: state["setIndex"] as? Int ?? 1,
      setTotal: state["setTotal"] as? Int ?? 1,
      targetWeight: state["targetWeight"] as? Double,
      targetReps: state["targetReps"] as? Int,
      restEndsAt: restEndsAt
    )
  }
  #endif
}
