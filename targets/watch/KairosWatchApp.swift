import HealthKit
import SwiftUI
import WatchKit

final class AppDelegate: NSObject, WKApplicationDelegate {
  func applicationDidFinishLaunching() {
    Task { @MainActor in PhoneLink.shared.activate() }
  }

  /** The phone's live session asked for the watch's heart rate (startWatchApp). */
  func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
    Task { @MainActor in
      PhoneLink.shared.activate()
      let w = WorkoutManager.shared
      if let hrMax = PhoneLink.shared.plan?.hrMax, hrMax > 0 { w.hrMax = hrMax }
      await w.start(workoutConfiguration, mode: .sensor, externalId: nil)
    }
  }

  func handleActiveWorkoutRecovery() {
    Task { @MainActor in WorkoutManager.shared.recover() }
  }
}

@main
struct KairosWatchApp: App {
  @WKApplicationDelegateAdaptor(AppDelegate.self) private var delegate
  @StateObject private var link = PhoneLink.shared
  @StateObject private var workout = WorkoutManager.shared

  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(link)
        .environmentObject(workout)
        .tint(.accentColor)
    }
  }
}

/** Home, a session being logged, or sensor mode for the phone. */
struct RootView: View {
  @EnvironmentObject private var link: PhoneLink
  @EnvironmentObject private var workout: WorkoutManager
  @State private var logger: SessionLogger?

  var body: some View {
    Group {
      if workout.mode == .sensor && workout.phase != .idle {
        SensorView()
      } else if let logger {
        WorkoutView(logger: logger) { self.logger = nil }
      } else {
        HomeView { session in start(session) }
      }
    }
    .onAppear {
      link.onCommand = { cmd in
        guard cmd.kind == "end", workout.mode == .sensor else { return }
        Task { _ = await workout.end(save: cmd.save) }
      }
      // A workout recovered after a crash brings its sets back too.
      if logger == nil, workout.phase != .idle, workout.mode == .logging {
        logger = SessionLogger.restore()
      }
    }
    .onChange(of: workout.phase) { _, phase in
      if logger == nil, phase != .idle, workout.mode == .logging {
        logger = SessionLogger.restore()
      }
    }
  }

  private func start(_ session: WatchSession?) {
    let l = SessionLogger(session: session)
    logger = l
    if let hrMax = link.plan?.hrMax, hrMax > 0 { workout.hrMax = hrMax }
    Task {
      await workout.start(
        WorkoutManager.configuration(sport: l.sport), mode: .logging, externalId: l.id)
      if workout.phase == .idle {
        // Health refused or the session failed: nothing to log against.
        SessionLogger.clear()
        logger = nil
      }
    }
  }
}
