// Shared ActivityAttributes for the Kairos workout Live Activity.
//
// TARGET MEMBERSHIP MATTERS: this file is compiled into the app target via
// the KairosLiveActivity pod. The widget extension (targets/WorkoutActivity)
// must ALSO compile this exact file — add it to the extension's target
// membership in Xcode (or let @bacons/apple-targets pick it up via the
// config's `sources` glob). ActivityKit matches the activity to the widget
// UI by this type's name and the encoded shape of ContentState, so the two
// targets must agree byte-for-byte.
//
// The state is a MIRROR of the JS scoreboard payload (src/lib/liveActivity/
// payload.ts). Deliberately dumb: no weight/reps, no units, no formatting —
// `targetLine` arrives pre-composed by the same formatter the phone screen
// uses, so running/mobility/hybrid sessions render as correctly as strength.

import Foundation

#if canImport(ActivityKit)
import ActivityKit

@available(iOS 16.2, *)
public struct WorkoutActivityAttributes: ActivityAttributes {
  /// Scoreboard state, mirrored from features/workout/scoreboard/machine.ts.
  public enum Phase: String, Codable, Hashable {
    case set
    case rest
    case change
  }

  public struct ContentState: Codable, Hashable {
    /// Current exercise display name.
    public var exerciseName: String
    /// The giant line: "60 kg × 6", "5 km · 5:30 min/km". Nil = no target.
    public var targetLine: String?
    /// 1-based current set.
    public var setIndex: Int
    public var setTotal: Int
    /// Rest window. Both nil unless a rest is actually running — the pair lets
    /// ProgressView(timerInterval:) draw the bar without JS ticking it.
    public var restStartedAt: Date?
    public var restEndsAt: Date?
    /// "Siguiente" peek: next exercise, or the upcoming set during rest.
    public var nextUp: String?
    public var phase: Phase

    public init(
      exerciseName: String,
      targetLine: String?,
      setIndex: Int,
      setTotal: Int,
      restStartedAt: Date?,
      restEndsAt: Date?,
      nextUp: String?,
      phase: Phase
    ) {
      self.exerciseName = exerciseName
      self.targetLine = targetLine
      self.setIndex = setIndex
      self.setTotal = setTotal
      self.restStartedAt = restStartedAt
      self.restEndsAt = restEndsAt
      self.nextUp = nextUp
      self.phase = phase
    }

    /// The rest window, when one is running and still in the future. Everything
    /// in the UI keys off this: `nil` means "lifting", and it turns nil on its
    /// own the moment the countdown expires — no JS round-trip required.
    public var restInterval: ClosedRange<Date>? {
      guard let start = restStartedAt, let end = restEndsAt, end > .now, start < end else {
        return nil
      }
      return start...end
    }

    public var isResting: Bool { restInterval != nil }
  }

  /// Immutable for the lifetime of the session.
  public var blockName: String

  public init(blockName: String) {
    self.blockName = blockName
  }
}
#endif
