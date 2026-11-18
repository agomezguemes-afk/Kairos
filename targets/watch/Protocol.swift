// Mirror of src/lib/watch/protocol.ts. Change both together and bump `version`.
// Numbers are Double because JSON has no integers and the phone validates ranges.

import Foundation

enum KairosProtocol {
  static let version = 1

  static let iso: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
  }()
}

// MARK: Phone → watch

struct WatchSet: Codable, Hashable {
  var reps: Double?
  var loadKg: Double?
  var durationSec: Double?
  var distanceKm: Double?
}

struct WatchMovement: Codable, Hashable, Identifiable {
  var id: String
  var name: String
  var kind: String
  var cue: String
  var restSec: Double
  var stepKg: Double
  var rir: Double?
  var repsMin: Double?
  var repsMax: Double?
  var zone: Double?
  var workSec: Double?
  var sets: [WatchSet]
}

struct WatchSession: Codable, Hashable, Identifiable {
  var id: String
  var title: String
  var sport: String
  var durationMin: Double
  var light: Bool
  var note: String?
  var movements: [WatchMovement]
}

struct WatchPlan: Codable, Hashable {
  var v: Int
  var generatedAt: String
  var nextId: String?
  var band: String?
  var hrMax: Double
  var sessions: [WatchSession]
}

struct WatchCommand: Codable {
  var v: Int
  var kind: String
  var save: Bool
}

// MARK: Watch → phone

struct ResultSet: Codable, Hashable {
  var reps: Double?
  var loadKg: Double?
  var rir: Double?
  var durationSec: Double?
  var distanceKm: Double?
  var completed: Bool
}

struct ResultMovement: Codable, Hashable {
  var id: String
  var sets: [ResultSet]
}

struct WatchResult: Codable {
  var v: Int = KairosProtocol.version
  var id: String
  var draftSessionId: String?
  var title: String
  var sport: String
  var startedAt: String
  var endedAt: String
  var rpe: Double
  var workoutUuid: String?
  var hrAvg: Double?
  var hrMax: Double?
  var zoneSeconds: [Double]?
  var energyKcal: Double?
  var distanceKm: Double?
  var movements: [ResultMovement]
}

struct WatchLive: Codable {
  var v: Int = KairosProtocol.version
  var hr: Double
  /** Epoch ms. */
  var at: Double
}

extension Encodable {
  func jsonString() -> String? {
    guard let data = try? JSONEncoder().encode(self) else { return nil }
    return String(data: data, encoding: .utf8)
  }
}

func decodeJSON<T: Decodable>(_ type: T.Type, _ json: String) -> T? {
  guard let data = json.data(using: .utf8) else { return nil }
  do {
    return try JSONDecoder().decode(type, from: data)
  } catch {
    print("[kairos] could not decode \(T.self): \(error)")
    return nil
  }
}
