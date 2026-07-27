// Workout Live Activity UI — Lock Screen banner + Dynamic Island.
//
// This is the PRIMARY in-workout display (docs/INWORKOUT_GLANCE_MODE.md §5):
// the phone lies face-up on the bench and IS the scoreboard. So it renders the
// same four things the phone screen renders — exercise, the giant target, set
// N/M, and the rest countdown — plus the one-thumb HECHO, without unlocking.
//
// Design notes:
//   • Nothing is computed here. `targetLine` arrives pre-formatted from the JS
//     formatter (features/workout/scoreboard/format.ts) so running/mobility
//     sessions read correctly instead of collapsing to weight×reps.
//   • No continuous animation — Live Activities forbid it. The two exceptions
//     the system grants are exactly what a rest timer needs:
//     Text(timerInterval:) and ProgressView(timerInterval:), both ticked by the
//     OS with the app suspended and zero JS.
//   • `restInterval` turns nil on its own at rest end, and the module hands
//     ActivityKit `staleDate = restEndsAt`, so the surface flips from countdown
//     to "next set target + HECHO" by itself.
//   • Gold is the rest accent (Kai's colour). HECHO is ink — the same hierarchy
//     the phone uses, where gold is reserved for Kai and PRs.

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
              .minimumScaleFactor(0.8)
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          SetCounter(state: context.state)
        }
        DynamicIslandExpandedRegion(.bottom) {
          if let rest = context.state.restInterval {
            VStack(spacing: 6) {
              HStack(alignment: .firstTextBaseline) {
                Text(timerInterval: rest, countsDown: true)
                  .font(.system(size: 40, weight: .semibold, design: .rounded).monospacedDigit())
                  .foregroundStyle(kairosGold)
                  .frame(maxWidth: 132, alignment: .leading)
                Spacer(minLength: 8)
                RestButtons()
              }
              ProgressView(timerInterval: rest, countsDown: true) {
                EmptyView()
              } currentValueLabel: {
                EmptyView()
              }
              .progressViewStyle(.linear)
              .tint(kairosGold)
              NextUpLabel(state: context.state)
            }
          } else {
            HStack(alignment: .center, spacing: 10) {
              VStack(alignment: .leading, spacing: 2) {
                TargetLine(state: context.state, size: 34)
                NextUpLabel(state: context.state)
              }
              Spacer(minLength: 8)
              DoneButton()
            }
          }
        }
      } compactLeading: {
        Image(systemName: "figure.strengthtraining.traditional")
          .foregroundStyle(kairosGold)
      } compactTrailing: {
        if let rest = context.state.restInterval {
          Text(timerInterval: rest, countsDown: true)
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

  private var state: WorkoutActivityAttributes.ContentState { context.state }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      // Eyebrow: block · set counter. Always present, so the glance always
      // answers "where am I in the session".
      HStack {
        Text(eyebrow)
          .font(.caption2.weight(.semibold))
          .tracking(1.2)
          .foregroundStyle(state.isResting ? kairosGold : .secondary)
          .lineLimit(1)
        Spacer()
        Text("SERIE \(state.setIndex)/\(state.setTotal)")
          .font(.caption2.weight(.semibold).monospacedDigit())
          .tracking(1.2)
          .foregroundStyle(.secondary)
      }

      if let rest = state.restInterval {
        // Rest IS the state (§"Estados del marcador"): countdown dominates,
        // the ring/bar ticks natively, controls stay one thumb away.
        HStack(alignment: .center, spacing: 12) {
          Text(timerInterval: rest, countsDown: true)
            .font(.system(size: 46, weight: .semibold, design: .rounded).monospacedDigit())
            .foregroundStyle(kairosInk)
            .frame(maxWidth: 150, alignment: .leading)
          Spacer(minLength: 0)
          RestButtons()
        }
        ProgressView(timerInterval: rest, countsDown: true) {
          EmptyView()
        } currentValueLabel: {
          EmptyView()
        }
        .progressViewStyle(.linear)
        .tint(kairosGold)
      } else {
        Text(state.exerciseName)
          .font(.title3.weight(.semibold))
          .foregroundStyle(kairosInk)
          .lineLimit(1)
          .minimumScaleFactor(0.7)

        HStack(alignment: .center, spacing: 12) {
          TargetLine(state: state, size: 40)
          Spacer(minLength: 0)
          DoneButton()
        }
      }

      NextUpLabel(state: state)
    }
    .padding(16)
  }

  private var eyebrow: String {
    if state.isResting { return "DESCANSO" }
    if state.phase == .change { return "SIGUIENTE EJERCICIO" }
    return context.attributes.blockName.uppercased()
  }
}

// ── Shared fragments ───────────────────────────────────────────────────────

@available(iOS 16.2, *)
private struct SetCounter: View {
  let state: WorkoutActivityAttributes.ContentState

  // Always the set fraction: "where am I in this exercise" is the one fact that
  // is true in every phase. The rest state announces itself with the gold
  // countdown, not by relabelling this.
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

/// The giant target — the one thing that must be legible from two metres.
@available(iOS 16.2, *)
private struct TargetLine: View {
  let state: WorkoutActivityAttributes.ContentState
  let size: CGFloat

  var body: some View {
    Text(state.targetLine ?? "Sin objetivo")
      .font(
        .system(size: state.targetLine == nil ? size * 0.5 : size, weight: .semibold, design: .rounded)
          .monospacedDigit()
      )
      .foregroundStyle(state.targetLine == nil ? Color.secondary : kairosInk)
      .lineLimit(1)
      .minimumScaleFactor(0.5)
  }
}

@available(iOS 16.2, *)
private struct NextUpLabel: View {
  let state: WorkoutActivityAttributes.ContentState

  var body: some View {
    if let next = state.nextUp {
      Text("Siguiente · \(next)")
        .font(.caption2)
        .foregroundStyle(.secondary)
        .lineLimit(1)
    }
  }
}

/// HECHO — the one-thumb action, sized so a shaking post-set thumb can't miss.
@available(iOS 16.2, *)
private struct DoneButton: View {
  var body: some View {
    if #available(iOS 17.0, *) {
      Button(intent: CompleteSetIntent()) {
        Text("HECHO")
          .font(.callout.weight(.bold))
          .tracking(1.0)
          .padding(.horizontal, 6)
      }
      .tint(kairosInk)
      .buttonStyle(.borderedProminent)
      .controlSize(.large)
    }
  }
}

@available(iOS 16.2, *)
private struct RestButtons: View {
  var body: some View {
    if #available(iOS 17.0, *) {
      HStack(spacing: 8) {
        Button(intent: ExtendRestIntent()) {
          Text("+30 s").font(.footnote.weight(.semibold))
        }
        .tint(kairosGold)
        .buttonStyle(.bordered)

        Button(intent: SkipRestIntent()) {
          Text("Saltar").font(.footnote.weight(.semibold))
        }
        .tint(kairosInk)
        .buttonStyle(.borderedProminent)
      }
    }
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
