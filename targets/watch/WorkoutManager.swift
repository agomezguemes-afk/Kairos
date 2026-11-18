// One HKWorkoutSession at a time. It keeps the app running with the wrist
// down, reads heart rate, energy and distance live, and saves the workout to
// Health so it closes the rings. Two modes:
//   .logging — the session is logged on the wrist (sets, rest, RPE).
//   .sensor  — the phone started us (startWatchApp) and logs the session;
//              the watch only measures and streams heart rate.

import Foundation
import HealthKit

@MainActor
final class WorkoutManager: NSObject, ObservableObject {
  static let shared = WorkoutManager()

  enum Mode: Equatable { case logging, sensor }
  enum Phase: Equatable { case idle, starting, running, paused, ending }

  @Published private(set) var phase: Phase = .idle
  @Published private(set) var mode: Mode = .logging
  @Published private(set) var heartRate: Double = 0
  @Published private(set) var energyKcal: Double = 0
  @Published private(set) var distanceKm: Double = 0
  @Published private(set) var startDate: Date?
  @Published var error: String?

  /** Max HR the zones are computed against; the phone sends the learned one. */
  var hrMax: Double = 190
  private(set) var zoneSeconds: [Double] = [0, 0, 0, 0, 0]

  let store = HKHealthStore()
  private var session: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?
  private var lastHr: (value: Double, at: Date)?
  private var ending: CheckedContinuation<HKWorkout?, Never>?
  private var saveOnEnd = true
  private var externalId: String?

  private static let hrUnit = HKUnit.count().unitDivided(by: .minute())

  // MARK: Authorization

  func authorize() async -> Bool {
    guard HKHealthStore.isHealthDataAvailable() else { return false }
    let read: Set<HKObjectType> = [
      HKQuantityType(.heartRate),
      HKQuantityType(.activeEnergyBurned),
      HKQuantityType(.distanceWalkingRunning),
      HKQuantityType(.distanceCycling),
      HKQuantityType(.distanceSwimming),
      HKObjectType.workoutType(),
    ]
    let share: Set<HKSampleType> = [HKObjectType.workoutType()]
    do {
      try await store.requestAuthorization(toShare: share, read: read)
      return true
    } catch {
      self.error = "Salud no dio permiso: \(error.localizedDescription)"
      return false
    }
  }

  // MARK: Lifecycle

  static func configuration(sport: String) -> HKWorkoutConfiguration {
    let c = HKWorkoutConfiguration()
    c.activityType = activityType(sport)
    switch sport {
    case "running", "cycling", "hiking", "football", "tennis", "padel":
      c.locationType = .outdoor
    case "swimming":
      c.locationType = .indoor
      c.swimmingLocationType = .pool
      c.lapLength = HKQuantity(unit: .meter(), doubleValue: 25)
    default:
      c.locationType = .indoor
    }
    return c
  }

  /** Same raw values as ACTIVITY_BY_SPORT in src/lib/health/appleHealth.ts. */
  static func activityType(_ sport: String) -> HKWorkoutActivityType {
    let raw: UInt = [
      "strength": 50, "running": 37, "cycling": 13, "swimming": 46, "hiking": 24,
      "football": 41, "basketball": 6, "tennis": 48, "padel": 79, "climbing": 9,
    ][sport] ?? 3000
    return HKWorkoutActivityType(rawValue: raw) ?? .other
  }

  func start(_ configuration: HKWorkoutConfiguration, mode: Mode, externalId: String?) async {
    guard phase == .idle else { return }
    phase = .starting
    error = nil
    guard await authorize() else {
      phase = .idle
      return
    }
    do {
      let session = try HKWorkoutSession(healthStore: store, configuration: configuration)
      let builder = session.associatedWorkoutBuilder()
      builder.dataSource = HKLiveWorkoutDataSource(
        healthStore: store, workoutConfiguration: configuration)
      session.delegate = self
      builder.delegate = self
      self.session = session
      self.builder = builder
      self.mode = mode
      self.externalId = externalId
      resetStats()
      let now = Date()
      startDate = now
      session.startActivity(with: now)
      try await builder.beginCollection(at: now)
      phase = .running
    } catch {
      self.error = "No se pudo empezar el entreno: \(error.localizedDescription)"
      session = nil
      builder = nil
      phase = .idle
    }
  }

  func pause() { session?.pause() }
  func resume() { session?.resume() }

  /** Ends the session; with `save` the workout lands in Health and is returned. */
  func end(save: Bool) async -> HKWorkout? {
    guard let session, phase != .ending else { return nil }
    phase = .ending
    saveOnEnd = save
    return await withCheckedContinuation { cont in
      ending = cont
      session.end()
    }
  }

  /** After a crash or reboot mid-workout, watchOS hands the session back. */
  func recover() {
    store.recoverActiveWorkoutSession { session, error in
      Task { @MainActor in
        if let error { print("[kairos] workout recovery failed: \(error.localizedDescription)") }
        guard let session else { return }
        self.session = session
        self.builder = session.associatedWorkoutBuilder()
        session.delegate = self
        self.builder?.delegate = self
        self.startDate = session.startDate ?? Date()
        self.mode = SessionLogger.hasSnapshot ? .logging : .sensor
        self.phase = session.state == .paused ? .paused : .running
      }
    }
  }

  // MARK: Stats

  struct Summary {
    var hrAvg: Double?
    var hrMax: Double?
    var zoneSeconds: [Double]
    var energyKcal: Double?
    var distanceKm: Double?
  }

  func summary(of workout: HKWorkout?) -> Summary {
    let hr = workout?.statistics(for: HKQuantityType(.heartRate))
      ?? builder?.statistics(for: HKQuantityType(.heartRate))
    let avg = hr?.averageQuantity()?.doubleValue(for: Self.hrUnit)
    let max = hr?.maximumQuantity()?.doubleValue(for: Self.hrUnit)
    let valid: (Double?) -> Double? = { v in v.flatMap { (25...240).contains($0) ? $0 : nil } }
    return Summary(
      hrAvg: valid(avg),
      hrMax: valid(max),
      zoneSeconds: zoneSeconds.map { $0.rounded() },
      energyKcal: energyKcal > 0 ? energyKcal.rounded() : nil,
      distanceKm: distanceKm > 0.01 ? (distanceKm * 100).rounded() / 100 : nil
    )
  }

  private func resetStats() {
    heartRate = 0
    energyKcal = 0
    distanceKm = 0
    zoneSeconds = [0, 0, 0, 0, 0]
    lastHr = nil
  }

  /** Same zone edges as hrZone() in src/lib/adaptive/metrics.ts. */
  private func zoneIndex(_ hr: Double) -> Int {
    let pct = hr / hrMax
    if pct < 0.6 { return 0 }
    if pct < 0.7 { return 1 }
    if pct < 0.8 { return 2 }
    if pct < 0.9 { return 3 }
    return 4
  }

  fileprivate func ingestHeartRate(_ hr: Double, at date: Date) {
    guard (25...240).contains(hr) else { return }
    if let last = lastHr, phase == .running {
      let dt = date.timeIntervalSince(last.at)
      // A long gap is the watch losing skin contact, not time in a zone.
      if dt > 0 && dt <= 15 { zoneSeconds[zoneIndex(last.value)] += dt }
    }
    lastHr = (hr, date)
    heartRate = hr
    if mode == .sensor { PhoneLink.shared.sendLive(hr: hr) }
  }

  fileprivate func update(_ statistics: HKStatistics) {
    switch statistics.quantityType {
    case HKQuantityType(.heartRate):
      if let q = statistics.mostRecentQuantity() {
        ingestHeartRate(q.doubleValue(for: Self.hrUnit), at: Date())
      }
    case HKQuantityType(.activeEnergyBurned):
      energyKcal = statistics.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? energyKcal
    case HKQuantityType(.distanceWalkingRunning), HKQuantityType(.distanceCycling),
      HKQuantityType(.distanceSwimming):
      distanceKm =
        statistics.sumQuantity()?.doubleValue(for: .meterUnit(with: .kilo)) ?? distanceKm
    default:
      break
    }
  }

  fileprivate func finish(at date: Date) async {
    guard let builder else {
      resolve(nil)
      return
    }
    var workout: HKWorkout?
    do {
      try await builder.endCollection(at: date)
      if saveOnEnd {
        if let externalId {
          try await builder.addMetadata([HKMetadataKeyExternalUUID: externalId])
        }
        workout = try await builder.finishWorkout()
      } else {
        builder.discardWorkout()
      }
    } catch {
      self.error = "El entreno no se guardó en Salud: \(error.localizedDescription)"
    }
    resolve(workout)
  }

  private func resolve(_ workout: HKWorkout?) {
    session = nil
    builder = nil
    phase = .idle
    let cont = ending
    ending = nil
    cont?.resume(returning: workout)
  }
}

extension WorkoutManager: HKWorkoutSessionDelegate {
  nonisolated func workoutSession(
    _ workoutSession: HKWorkoutSession,
    didChangeTo toState: HKWorkoutSessionState,
    from fromState: HKWorkoutSessionState,
    date: Date
  ) {
    Task { @MainActor in
      switch toState {
      case .running: if self.phase != .ending { self.phase = .running }
      case .paused: self.phase = .paused
      case .ended: await self.finish(at: date)
      default: break
      }
    }
  }

  nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error)
  {
    Task { @MainActor in
      self.error = "El entreno se interrumpió: \(error.localizedDescription)"
    }
  }
}

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
  nonisolated func workoutBuilder(
    _ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>
  ) {
    let stats = collectedTypes.compactMap { type -> HKStatistics? in
      guard let q = type as? HKQuantityType else { return nil }
      return workoutBuilder.statistics(for: q)
    }
    Task { @MainActor in stats.forEach(self.update) }
  }

  nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}
}
