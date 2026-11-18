// WatchConnectivity on the wrist. The plan arrives as application context
// (latest state only, delivered even while the watch app is closed) and is
// cached so the watch works with the phone out of range. Finished sessions
// go back with transferUserInfo, which the system queues until delivered.

import Foundation
import WatchConnectivity

@MainActor
final class PhoneLink: NSObject, ObservableObject {
  static let shared = PhoneLink()

  @Published private(set) var plan: WatchPlan?
  @Published private(set) var reachable = false
  /** Sessions handed to the system that it has not confirmed yet. */
  @Published private(set) var pendingResults = 0

  var onCommand: ((WatchCommand) -> Void)?

  private let planKey = "kairos.plan"
  private var lastLiveAt = Date.distantPast

  override private init() {
    super.init()
    if let cached = UserDefaults.standard.string(forKey: planKey) {
      plan = decodeJSON(WatchPlan.self, cached)
    }
  }

  func activate() {
    guard WCSession.isSupported() else { return }
    let s = WCSession.default
    if s.delegate == nil { s.delegate = self }
    if s.activationState != .activated { s.activate() }
  }

  func send(_ result: WatchResult) {
    guard let json = result.jsonString() else { return }
    let s = WCSession.default
    guard s.activationState == .activated else {
      // Activation is async; the transfer must not be lost, so retry shortly.
      activate()
      Task { @MainActor [weak self] in
        try? await Task.sleep(nanoseconds: 2_000_000_000)
        self?.send(result)
      }
      return
    }
    s.transferUserInfo(["session": json])
    pendingResults = s.outstandingUserInfoTransfers.count
  }

  /** Live heart rate for the phone's session screen, at most every 2 s. */
  func sendLive(hr: Double) {
    let s = WCSession.default
    guard s.activationState == .activated, s.isReachable, hr > 0 else { return }
    let now = Date()
    guard now.timeIntervalSince(lastLiveAt) >= 2 else { return }
    lastLiveAt = now
    guard let json = WatchLive(hr: hr, at: now.timeIntervalSince1970 * 1000).jsonString() else {
      return
    }
    s.sendMessage(["live": json], replyHandler: nil) { error in
      // Dropped samples are fine: the next one is two seconds away.
      print("[kairos] live HR not delivered: \(error.localizedDescription)")
    }
  }

  fileprivate func apply(planJSON: String) {
    guard let p = decodeJSON(WatchPlan.self, planJSON) else { return }
    guard p.v <= KairosProtocol.version else {
      print("[kairos] plan v\(p.v) is newer than this watch app; update Kairos")
      return
    }
    plan = p
    UserDefaults.standard.set(planJSON, forKey: planKey)
  }

  fileprivate func apply(commandJSON: String) {
    guard let c = decodeJSON(WatchCommand.self, commandJSON) else { return }
    onCommand?(c)
  }

  fileprivate func refresh(_ s: WCSession) {
    reachable = s.isReachable
    pendingResults = s.outstandingUserInfoTransfers.count
  }
}

extension PhoneLink: WCSessionDelegate {
  nonisolated func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if let error { print("[kairos] WCSession activation failed: \(error.localizedDescription)") }
    let plan = session.receivedApplicationContext["plan"] as? String
    Task { @MainActor in
      if let plan { self.apply(planJSON: plan) }
      self.refresh(session)
    }
  }

  nonisolated func session(
    _ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]
  ) {
    guard let plan = applicationContext["plan"] as? String else { return }
    Task { @MainActor in self.apply(planJSON: plan) }
  }

  nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    guard let cmd = message["cmd"] as? String else { return }
    Task { @MainActor in self.apply(commandJSON: cmd) }
  }

  nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
    Task { @MainActor in self.refresh(session) }
  }

  nonisolated func session(
    _ session: WCSession, didFinish userInfoTransfer: WCSessionUserInfoTransfer, error: Error?
  ) {
    // A failed transfer is gone from the queue: send it again, or the
    // session would only exist on the wrist.
    let retry = error == nil ? nil : userInfoTransfer.userInfo["session"] as? String
    if let error { print("[kairos] session transfer failed, retrying: \(error.localizedDescription)") }
    Task { @MainActor in
      if let retry {
        DispatchQueue.main.asyncAfter(deadline: .now() + 30) {
          WCSession.default.transferUserInfo(["session": retry])
        }
      }
      self.refresh(session)
    }
  }
}
