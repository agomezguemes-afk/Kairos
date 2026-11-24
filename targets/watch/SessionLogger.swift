// The session as it is being logged on the wrist: one current movement, one
// current set, values prefilled from the plan, a rest timer between sets.
// Snapshotted after every change, so a crash or reboot mid-workout loses
// nothing (WorkoutManager.recover() brings the workout itself back).

import Foundation
import WatchKit

struct LoggedSet: Codable, Hashable {
  var reps: Double
  var loadKg: Double
  var durationSec: Double?
  var distanceKm: Double?
  var completed = false
}

struct LoggedMovement: Codable, Hashable, Identifiable {
  var id: String
  var name: String
  var kind: String
  var cue: String
  var restSec: Double
  var stepKg: Double
  var rir: Double?
  var sets: [LoggedSet]

  var isStrength: Bool { kind == "strength" }
  var nextSet: Int? { sets.firstIndex { !$0.completed } }
  var done: Bool { nextSet == nil }
}

private struct Snapshot: Codable {
  var id: String
  var draftSessionId: String?
  var title: String
  var sport: String
  var startedAt: Date
  var movements: [LoggedMovement]
  var index: Int
}

@MainActor
final class SessionLogger: ObservableObject {
  let id: String
  let draftSessionId: String?
  let title: String
  let sport: String
  let startedAt: Date

  @Published var movements: [LoggedMovement]
  @Published var index = 0
  @Published private(set) var restEndsAt: Date?
  @Published private(set) var movementStartedAt = Date()

  private var restTask: Task<Void, Never>?
  private static let key = "kairos.logger"

  static var hasSnapshot: Bool { UserDefaults.standard.data(forKey: key) != nil }

  init(session: WatchSession?) {
    id = UUID().uuidString
    draftSessionId = session?.id
    title = session?.title ?? "Entreno libre"
    sport = session?.sport ?? "general"
    startedAt = Date()
    movements = (session?.movements ?? []).map { m in
      LoggedMovement(
        id: m.id, name: m.name, kind: m.kind, cue: m.cue, restSec: m.restSec,
        stepKg: m.stepKg > 0 ? m.stepKg : 2.5, rir: m.rir,
        sets: m.sets.map {
          LoggedSet(
            reps: $0.reps ?? 0, loadKg: $0.loadKg ?? 0, durationSec: $0.durationSec,
            distanceKm: $0.distanceKm)
        })
    }
    save()
  }

  private init(_ s: Snapshot) {
    id = s.id
    draftSessionId = s.draftSessionId
    title = s.title
    sport = s.sport
    startedAt = s.startedAt
    movements = s.movements
    index = min(s.index, max(0, s.movements.count - 1))
  }

  static func restore() -> SessionLogger? {
    guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
    do {
      return SessionLogger(try JSONDecoder().decode(Snapshot.self, from: data))
    } catch {
      print("[kairos] dropping unreadable session snapshot: \(error)")
      clear()
      return nil
    }
  }

  static func clear() { UserDefaults.standard.removeObject(forKey: key) }

  var current: LoggedMovement? { movements.indices.contains(index) ? movements[index] : nil }
  var allDone: Bool { movements.allSatisfy(\.done) }
  var setsDone: Int { movements.reduce(0) { $0 + $1.sets.filter(\.completed).count } }
  var setsTotal: Int { movements.reduce(0) { $0 + $1.sets.count } }

  // MARK: Editing the current set

  func setReps(_ value: Double) { edit { $0.reps = max(0, value.rounded()) } }
  func setLoad(_ value: Double) { edit { $0.loadKg = max(0, value) } }

  private func edit(_ change: (inout LoggedSet) -> Void) {
    guard let m = current, let s = m.nextSet else { return }
    change(&movements[index].sets[s])
    save()
  }

  /**
   * Marks the current set done. A changed load or rep count carries to the
   * remaining sets: the next set is usually the same, and re-dialling it
   * would turn a one-tap log into three.
   */
  func completeSet() {
    guard let m = current, let s = m.nextSet else { return }
    var set = movements[index].sets[s]
    if !m.isStrength {
      let elapsed = Date().timeIntervalSince(movementStartedAt)
      if m.kind == "steady" || m.kind == "mobility" || m.kind == "skill", elapsed >= 60 {
        set.durationSec = elapsed.rounded()
      }
    }
    set.completed = true
    movements[index].sets[s] = set
    if m.isStrength {
      for later in (s + 1)..<movements[index].sets.count where !movements[index].sets[later].completed {
        movements[index].sets[later].reps = set.reps
        movements[index].sets[later].loadKg = set.loadKg
      }
    }
    WKInterfaceDevice.current().play(.success)
    if movements[index].done {
      skipRest()
      advance()
    } else if m.restSec > 0 {
      startRest(m.restSec)
    }
    save()
  }

  func select(_ i: Int) {
    guard movements.indices.contains(i) else { return }
    skipRest()
    index = i
    movementStartedAt = Date()
    save()
  }

  private func advance() {
    if let next = movements.indices.first(where: { $0 > index && !movements[$0].done })
      ?? movements.indices.first(where: { !movements[$0].done })
    {
      index = next
      movementStartedAt = Date()
    }
  }

  // MARK: Rest

  private func startRest(_ seconds: Double) {
    restTask?.cancel()
    let end = Date().addingTimeInterval(seconds)
    restEndsAt = end
    restTask = Task { [weak self] in
      try? await Task.sleep(nanoseconds: UInt64(max(0, seconds - 10) * 1_000_000_000))
      guard !Task.isCancelled else { return }
      if seconds > 20 { WKInterfaceDevice.current().play(.directionUp) }
      try? await Task.sleep(nanoseconds: UInt64(min(seconds, 10) * 1_000_000_000))
      guard !Task.isCancelled else { return }
      WKInterfaceDevice.current().play(.start)
      self?.restEndsAt = nil
      self?.movementStartedAt = Date()
    }
  }

  func skipRest() {
    restTask?.cancel()
    restTask = nil
    restEndsAt = nil
    movementStartedAt = Date()
  }

  // MARK: Result

  func result(rpe: Double, endedAt: Date, workoutUuid: String?, stats: WorkoutManager.Summary)
    -> WatchResult
  {
    WatchResult(
      id: id,
      draftSessionId: draftSessionId,
      title: title,
      sport: sport,
      startedAt: KairosProtocol.iso.string(from: startedAt),
      endedAt: KairosProtocol.iso.string(from: endedAt),
      rpe: rpe,
      workoutUuid: workoutUuid,
      hrAvg: stats.hrAvg,
      hrMax: stats.hrMax,
      zoneSeconds: stats.zoneSeconds.reduce(0, +) > 0 ? stats.zoneSeconds : nil,
      energyKcal: stats.energyKcal,
      distanceKm: stats.distanceKm,
      movements: movements.map { m in
        ResultMovement(
          id: m.id,
          sets: m.sets.filter(\.completed).map { s in
            ResultSet(
              reps: m.isStrength ? s.reps : nil,
              loadKg: m.isStrength ? s.loadKg : nil,
              rir: m.isStrength ? m.rir : nil,
              durationSec: m.isStrength ? nil : s.durationSec,
              distanceKm: m.isStrength ? nil : s.distanceKm,
              completed: true)
          })
      })
  }

  private func save() {
    let s = Snapshot(
      id: id, draftSessionId: draftSessionId, title: title, sport: sport,
      startedAt: startedAt, movements: movements, index: index)
    do {
      UserDefaults.standard.set(try JSONEncoder().encode(s), forKey: Self.key)
    } catch {
      print("[kairos] could not snapshot the session: \(error)")
    }
  }
}
