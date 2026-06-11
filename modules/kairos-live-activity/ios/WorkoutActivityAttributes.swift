// Shared ActivityAttributes for the Kairos workout Live Activity.
//
// TARGET MEMBERSHIP MATTERS: this file is compiled into the app target via
// the KairosLiveActivity pod. The widget extension (targets/WorkoutActivity)
// must ALSO compile this exact file — add it to the extension's target
// membership in Xcode (or let @bacons/apple-targets pick it up via the
// config's `sources` glob). ActivityKit matches the activity to the widget
// UI by this type's name and the encoded shape of ContentState, so the two
// targets must agree byte-for-byte.

import Foundation

#if canImport(ActivityKit)
import ActivityKit

@available(iOS 16.2, *)
public struct WorkoutActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// Current exercise display name.
    public var exerciseName: String
    /// 1-based current set.
    public var setIndex: Int
    public var setTotal: Int
    /// Planned weight for the current set (kg). Nil = bodyweight / no target.
    public var targetWeight: Double?
    public var targetReps: Int?
    /// When the active rest finishes. Nil = lifting, not resting.
    public var restEndsAt: Date?

    public init(
      exerciseName: String,
      setIndex: Int,
      setTotal: Int,
      targetWeight: Double?,
      targetReps: Int?,
      restEndsAt: Date?
    ) {
      self.exerciseName = exerciseName
      self.setIndex = setIndex
      self.setTotal = setTotal
      self.targetWeight = targetWeight
      self.targetReps = targetReps
      self.restEndsAt = restEndsAt
    }
  }

  /// Immutable for the lifetime of the session.
  public var blockName: String

  public init(blockName: String) {
    self.blockName = blockName
  }
}
#endif
