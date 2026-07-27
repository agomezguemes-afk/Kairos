// Expo module bridging the workout Live Activity.
//
// start/update/end are called from the RN workout flow. Widget App Intents
// (LiveActivityIntent runs IN the app process on iOS 17+) enqueue the tap in
// UserDefaults and post `KairosLiveActivityWidgetAction` on NotificationCenter;
// we drain that queue and forward each tap to JS as `onWidgetAction`.
//
// Why a queue and not a bare notification: iOS may LAUNCH the app in the
// background to run the intent. The notification would then fire before the JS
// runtime has any listener, and the tap — the user's "HECHO" — would vanish.
// The queue survives that: we flush it the moment JS starts observing.

import ExpoModulesCore

#if canImport(ActivityKit)
import ActivityKit
#endif

// Contract shared with WorkoutActivityIntents.swift. NOT a shared symbol on
// purpose: that file is compiled into the app target + the widget extension,
// while this one is compiled into the KairosLiveActivity pod — three separate
// Swift modules. They agree on a notification name and a UserDefaults key, the
// same way WorkoutActivityAttributes agrees by shape rather than by linkage.
private let kairosWidgetActionNotification = Notification.Name("KairosLiveActivityWidgetAction")
private let kairosPendingActionsKey = "kairos.liveActivity.pendingActions"

public class KairosLiveActivityModule: Module {
  private var observer: NSObjectProtocol?
  private var isObservedByJS = false

  public func definition() -> ModuleDefinition {
    Name("KairosLiveActivity")

    Events("onWidgetAction")

    OnCreate {
      self.observer = NotificationCenter.default.addObserver(
        forName: kairosWidgetActionNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        // The notification is a "wake up, there's something queued" ping; the
        // queue is the single source of truth so a tap is delivered exactly
        // once whether or not JS was listening when it happened.
        self?.flushPendingActions()
      }
    }

    OnStartObserving {
      self.isObservedByJS = true
      self.flushPendingActions()
    }

    OnStopObserving {
      self.isObservedByJS = false
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
        _ = try Activity.request(
          attributes: attributes,
          content: Self.content(from: state),
          pushType: nil
        )
      }
      #endif
    }

    AsyncFunction("updateActivity") { (state: [String: Any?]) in
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        let content = Self.content(from: state)
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

  /// Drain the durable queue written by the App Intents and hand each tap to JS.
  /// No-op while JS has no listener — the taps stay queued for the next launch.
  ///
  /// The intents run in THIS process (LiveActivityIntent), so `.standard` is the
  /// same defaults store they wrote to; no App Group entitlement is needed.
  private func flushPendingActions() {
    guard isObservedByJS else { return }
    let defaults = UserDefaults.standard
    guard
      let queued = defaults.array(forKey: kairosPendingActionsKey) as? [[String: Any]],
      !queued.isEmpty
    else { return }
    // Clear BEFORE dispatching: a tap must be delivered exactly once, and a
    // crash mid-dispatch is better than a set logged twice.
    defaults.removeObject(forKey: kairosPendingActionsKey)

    for tap in queued {
      guard let action = tap["action"] as? String else { continue }
      var payload: [String: Any] = ["action": action]
      if let ts = tap["ts"] as? Double { payload["ts"] = ts }
      sendEvent("onWidgetAction", payload)
    }
  }

  #if canImport(ActivityKit)
  @available(iOS 16.2, *)
  private static func content(
    from state: [String: Any?]
  ) -> ActivityContent<WorkoutActivityAttributes.ContentState> {
    let contentState = Self.contentState(from: state)
    // Rest end = the moment the displayed data stops being true. Handing it to
    // ActivityKit as `staleDate` makes the system re-render the widget exactly
    // then, so the countdown flips to the next set's target with the app
    // suspended and no JS running.
    return ActivityContent(state: contentState, staleDate: contentState.restEndsAt)
  }

  @available(iOS 16.2, *)
  private static func contentState(
    from state: [String: Any?]
  ) -> WorkoutActivityAttributes.ContentState {
    let phase = WorkoutActivityAttributes.Phase(
      rawValue: state["phase"] as? String ?? "set"
    ) ?? .set

    return WorkoutActivityAttributes.ContentState(
      exerciseName: state["exerciseName"] as? String ?? "",
      targetLine: state["targetLine"] as? String,
      setIndex: state["setIndex"] as? Int ?? 1,
      setTotal: state["setTotal"] as? Int ?? 1,
      restStartedAt: Self.date(from: state["restStartedAt"] ?? nil),
      restEndsAt: Self.date(from: state["restEndsAt"] ?? nil),
      nextUp: state["nextUp"] as? String,
      phase: phase
    )
  }

  /// Epoch milliseconds (JS `Date.now()`) → Date. Nil/0/negative = absent.
  private static func date(from value: Any?) -> Date? {
    guard let ms = (value as? NSNumber)?.doubleValue, ms > 0 else { return nil }
    return Date(timeIntervalSince1970: ms / 1000.0)
  }
  #endif
}
