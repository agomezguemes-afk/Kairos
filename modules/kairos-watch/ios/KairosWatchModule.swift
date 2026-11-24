// Phone side of WatchConnectivity. Sessions logged on the wrist can arrive
// before JS is listening (or with the app closed), so they are kept in
// UserDefaults until JS has stored them and acknowledges each one by id.

import ExpoModulesCore
import HealthKit
import WatchConnectivity

final class WatchLink: NSObject, WCSessionDelegate {
  static let shared = WatchLink()

  var onSession: (() -> Void)?
  var onLive: ((String) -> Void)?
  var onState: (([String: Bool]) -> Void)?

  private let pendingKey = "kairos.watch.pending"
  private let lock = NSLock()

  func activate() {
    guard WCSession.isSupported() else { return }
    let s = WCSession.default
    if s.delegate == nil { s.delegate = self }
    if s.activationState != .activated { s.activate() }
  }

  func state() -> [String: Bool] {
    guard WCSession.isSupported() else {
      return ["supported": false, "activated": false, "paired": false, "installed": false, "reachable": false]
    }
    let s = WCSession.default
    let on = s.activationState == .activated
    return [
      "supported": true,
      "activated": on,
      "paired": on && s.isPaired,
      "installed": on && s.isWatchAppInstalled,
      "reachable": on && s.isReachable,
    ]
  }

  func updatePlan(_ json: String) throws {
    let s = WCSession.default
    guard WCSession.isSupported(), s.activationState == .activated else {
      throw WatchError.notActivated
    }
    // Unpaired or no watch app: nothing to deliver to, and not an error.
    guard s.isPaired, s.isWatchAppInstalled else { return }
    try s.updateApplicationContext(["plan": json])
  }

  func send(command json: String) -> Bool {
    let s = WCSession.default
    guard WCSession.isSupported(), s.activationState == .activated, s.isReachable else {
      return false
    }
    s.sendMessage(["cmd": json], replyHandler: nil) { error in
      NSLog("[kairos] watch command not delivered: %@", error.localizedDescription)
    }
    return true
  }

  // MARK: Pending sessions

  func pending() -> [String] {
    lock.lock()
    defer { lock.unlock() }
    return Array(stored().values)
  }

  func ack(_ ids: [String]) {
    lock.lock()
    var all = stored()
    ids.forEach { all.removeValue(forKey: $0) }
    UserDefaults.standard.set(all, forKey: pendingKey)
    lock.unlock()
  }

  private func stored() -> [String: String] {
    UserDefaults.standard.dictionary(forKey: pendingKey) as? [String: String] ?? [:]
  }

  private func keep(_ json: String) {
    // Keyed by the session id so a retried transfer can't land twice.
    guard
      let data = json.data(using: .utf8),
      let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let id = obj["id"] as? String, !id.isEmpty
    else {
      NSLog("[kairos] dropping a watch session without an id")
      return
    }
    lock.lock()
    var all = stored()
    all[id] = json
    UserDefaults.standard.set(all, forKey: pendingKey)
    lock.unlock()
  }

  // MARK: WCSessionDelegate

  func session(
    _ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if let error { NSLog("[kairos] WCSession activation failed: %@", error.localizedDescription) }
    onState?(state())
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    // Switching to another paired watch: reactivate for the new one.
    WCSession.default.activate()
  }

  func sessionWatchStateDidChange(_ session: WCSession) { onState?(state()) }
  func sessionReachabilityDidChange(_ session: WCSession) { onState?(state()) }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    guard let json = userInfo["session"] as? String else { return }
    keep(json)
    onSession?()
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    if let json = message["live"] as? String { onLive?(json) }
  }
}

enum WatchError: Error, CustomStringConvertible {
  case notActivated
  var description: String { "WatchConnectivity is not active yet" }
}

public class KairosWatchModule: Module {
  private let health = HKHealthStore()

  public func definition() -> ModuleDefinition {
    Name("KairosWatch")

    Events("onSession", "onLive", "onState")

    OnCreate {
      let link = WatchLink.shared
      link.onSession = { [weak self] in self?.sendEvent("onSession", [:]) }
      link.onLive = { [weak self] json in self?.sendEvent("onLive", ["json": json]) }
      link.onState = { [weak self] state in self?.sendEvent("onState", state) }
      link.activate()
    }

    Function("getState") { WatchLink.shared.state() }

    Function("updatePlan") { (json: String) in
      try WatchLink.shared.updatePlan(json)
    }

    Function("pendingSessions") { WatchLink.shared.pending() }

    Function("ackSessions") { (ids: [String]) in
      WatchLink.shared.ack(ids)
    }

    Function("sendCommand") { (json: String) -> Bool in
      WatchLink.shared.send(command: json)
    }

    // Launches the watch app straight into a workout; it then streams heart
    // rate back over sendMessage while the phone logs the session.
    AsyncFunction("startWatchWorkout") { (activityType: Int, outdoor: Bool, promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.reject("E_HEALTH", "Health is not available on this device")
        return
      }
      let c = HKWorkoutConfiguration()
      c.activityType = HKWorkoutActivityType(rawValue: UInt(max(0, activityType))) ?? .other
      c.locationType = outdoor ? .outdoor : .indoor
      self.health.startWatchApp(with: c) { ok, error in
        if let error {
          promise.reject("E_WATCH", error.localizedDescription)
        } else {
          promise.resolve(ok)
        }
      }
    }
  }
}
