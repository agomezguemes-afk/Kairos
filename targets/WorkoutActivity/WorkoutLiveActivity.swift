// Workout Live Activity UI — Lock Screen banner + Dynamic Island.
//
// Design notes (mirrors the in-app system):
//   • No continuous animation — Live Activities forbid it. The luxury is
//     typography: large tabular numerals, a single gold accent (#D4AF37),
//     generous spacing.
//   • Rest countdown uses Text(timerInterval:) so the system ticks the
//     numeral without waking the app.
//   • iOS 17 buttons use App Intents (CompleteSetIntent / ExtendRestIntent).

import ActivityKit
import SwiftUI
import WidgetKit

private let kairosGold = Color(red: 0.831, green: 0.686, blue: 0.216) // #D4AF37
private let kairosInk = Color(red: 0.102, green: 0.102, blue: 0.180) // #1A1A2E

@available(iOS 16.2, *)
struct WorkoutLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
      LockScreenView(context: context)
        .activityBackgroundTint(Color.white.opacity(0.92))
        .activitySystemActionForegroundColor(kairosInk)
    } dynamicIsland: { context in
      DynamicIsland {
        // ── Expanded ──────────────────────────────────────────────
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: 2) {
            Text(context.attributes.blockName.uppercased())
              .font(.caption2.weight(.semibold))
              .foregroundStyle(.secondary)
              .lineLimit(1)
            Text(context.state.exerciseName)
              .font(.headline)
              .lineLimit(1)
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          if let restEndsAt = context.state.restEndsAt, restEndsAt > .now {
            VStack(alignment: .trailing, spacing: 2) {
              Text("DESCANSO")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(kairosGold)
              Text(timerInterval: Date.now...restEndsAt, countsDown: true)
                .font(.title2.weight(.semibold).monospacedDigit())
                .frame(width: 64)
                .multilineTextAlignment(.trailing)
            }
          } else {
            SetCounter(state: context.state)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack(spacing: 12) {
            TargetLabel(state: context.state)
            Spacer()
            if #available(iOS 17.0, *) {
              if let restEndsAt = context.state.restEndsAt, restEndsAt > .now {
                Button(intent: ExtendRestIntent()) {
                  Text("+30 s")
                    .font(.callout.weight(.semibold))
                }
                .tint(kairosGold)
                .buttonStyle(.bordered)
              }
              Button(intent: CompleteSetIntent()) {
                Text("Completar serie")
                  .font(.callout.weight(.semibold))
              }
              .tint(kairosGold)
              .buttonStyle(.borderedProminent)
            }
          }
        }
      } compactLeading: {
        Image(systemName: "figure.strengthtraining.traditional")
          .foregroundStyle(kairosGold)
      } compactTrailing: {
        if let restEndsAt = context.state.restEndsAt, restEndsAt > .now {
          Text(timerInterval: Date.now...restEndsAt, countsDown: true)
            .font(.caption2.monospacedDigit())
            .frame(maxWidth: 44)
            .foregroundStyle(kairosGold)
        } else {
          Text("\(context.state.setIndex)/\(context.state.setTotal)")
            .font(.caption2.monospacedDigit())
            .foregroundStyle(kairosGold)
        }
      } minimal: {
        Image(systemName: "figure.strengthtraining.traditional")
          .foregroundStyle(kairosGold)
      }
      .keylineTint(kairosGold)
    }
  }
}

// ── Lock Screen ────────────────────────────────────────────────────────────

@available(iOS 16.2, *)
private struct LockScreenView: View {
  let context: ActivityViewContext<WorkoutActivityAttributes>

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .firstTextBaseline) {
        VStack(alignment: .leading, spacing: 2) {
          Text(context.attributes.blockName.uppercased())
            .font(.caption2.weight(.semibold))
            .tracking(1.2)
            .foregroundStyle(.secondary)
          Text(context.state.exerciseName)
            .font(.title3.weight(.semibold))
            .lineLimit(1)
        }
        Spacer()
        if let restEndsAt = context.state.restEndsAt, restEndsAt > .now {
          VStack(alignment: .trailing, spacing: 2) {
            Text("DESCANSO")
              .font(.caption2.weight(.semibold))
              .tracking(1.2)
              .foregroundStyle(kairosGold)
            Text(timerInterval: Date.now...restEndsAt, countsDown: true)
              .font(.title2.weight(.semibold).monospacedDigit())
              .frame(width: 72, alignment: .trailing)
          }
        } else {
          SetCounter(state: context.state)
        }
      }

      HStack {
        TargetLabel(state: context.state)
        Spacer()
        if #available(iOS 17.0, *) {
          if let restEndsAt = context.state.restEndsAt, restEndsAt > .now {
            Button(intent: ExtendRestIntent()) {
              Text("+30 s").font(.footnote.weight(.semibold))
            }
            .tint(kairosGold)
            .buttonStyle(.bordered)
          }
          Button(intent: CompleteSetIntent()) {
            Text("Completar serie").font(.footnote.weight(.semibold))
          }
          .tint(kairosGold)
          .buttonStyle(.borderedProminent)
        }
      }
    }
    .padding(16)
  }
}

// ── Shared fragments ───────────────────────────────────────────────────────

@available(iOS 16.2, *)
private struct SetCounter: View {
  let state: WorkoutActivityAttributes.ContentState

  var body: some View {
    VStack(alignment: .trailing, spacing: 2) {
      Text("SERIE")
        .font(.caption2.weight(.semibold))
        .tracking(1.2)
        .foregroundStyle(.secondary)
      Text("\(state.setIndex)/\(state.setTotal)")
        .font(.title2.weight(.semibold).monospacedDigit())
    }
  }
}

@available(iOS 16.2, *)
private struct TargetLabel: View {
  let state: WorkoutActivityAttributes.ContentState

  var body: some View {
    if let label = targetText {
      Text(label)
        .font(.callout.monospacedDigit())
        .foregroundStyle(.secondary)
    }
  }

  private var targetText: String? {
    var parts: [String] = []
    if let w = state.targetWeight {
      parts.append(w.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(w)) kg" : "\(w) kg")
    }
    if let r = state.targetReps {
      parts.append("× \(r)")
    }
    return parts.isEmpty ? nil : parts.joined(separator: " ")
  }
}

// ── Bundle entry point ─────────────────────────────────────────────────────

@main
struct WorkoutActivityBundle: WidgetBundle {
  var body: some Widget {
    if #available(iOS 16.2, *) {
      WorkoutLiveActivity()
    }
  }
}
