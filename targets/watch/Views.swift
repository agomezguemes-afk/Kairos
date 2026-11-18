// Watch surfaces. Built for a glance mid-set: one big number, one action.
// Colours come from the target's asset catalog (expo-target.config.js),
// the same night palette and gold as the phone.

import SwiftUI
import WatchKit

enum K {
  static let ink = Color("kInk")
  static let muted = Color("kMuted")
  static let surface = Color("kSurface")
  static let accentSoft = Color("kAccentSoft")
  static let zone: [Color] = [
    Color(red: 0.55, green: 0.62, blue: 0.70), Color(red: 0.36, green: 0.66, blue: 0.48),
    Color(red: 0.79, green: 0.66, blue: 0.43), Color(red: 0.88, green: 0.48, blue: 0.25),
    Color(red: 0.85, green: 0.27, blue: 0.22),
  ]

  static func big(_ size: CGFloat) -> Font {
    .system(size: size, weight: .heavy, design: .rounded).monospacedDigit()
  }
  static let label = Font.system(size: 11, weight: .bold).monospaced()
}

func fmtKg(_ kg: Double) -> String {
  kg.truncatingRemainder(dividingBy: 1) == 0
    ? String(Int(kg)) : String(format: "%.1f", kg).replacingOccurrences(of: ".", with: ",")
}

func fmtClock(_ seconds: TimeInterval) -> String {
  let s = max(0, Int(seconds))
  return s >= 3600
    ? String(format: "%d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    : String(format: "%d:%02d", s / 60, s % 60)
}

// MARK: Home

struct HomeView: View {
  @EnvironmentObject private var link: PhoneLink
  @EnvironmentObject private var workout: WorkoutManager
  let onStart: (WatchSession?) -> Void

  var body: some View {
    NavigationStack {
      List {
        if let plan = link.plan, !plan.sessions.isEmpty {
          ForEach(plan.sessions) { s in
            Button { onStart(s) } label: {
              SessionRow(session: s, today: s.id == plan.nextId, band: plan.band)
            }
            .listRowBackground(
              RoundedRectangle(cornerRadius: 14)
                .fill(s.id == plan.nextId ? Color.accentColor : K.surface))
          }
        } else {
          Text("Elige tus sesiones en Kairos, en el iPhone, y aparecerán aquí.")
            .font(.footnote)
            .foregroundStyle(K.muted)
            .listRowBackground(Color.clear)
        }
        Button { onStart(nil) } label: {
          Label("Entreno libre", systemImage: "figure.mixed.cardio")
        }
        if link.pendingResults > 0 {
          Text("\(link.pendingResults) sesión(es) esperando al iPhone")
            .font(.caption2)
            .foregroundStyle(K.muted)
            .listRowBackground(Color.clear)
        }
        if let error = workout.error {
          Text(error).font(.caption2).foregroundStyle(.red).listRowBackground(Color.clear)
        }
      }
      .navigationTitle("Kairos")
      .disabled(workout.phase == .starting)
    }
  }
}

private struct SessionRow: View {
  let session: WatchSession
  let today: Bool
  let band: String?

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      if today {
        Text(band == "easy" ? "HOY · SUAVE" : band == "rest" ? "HOY · OPCIONAL" : "HOY")
          .font(K.label)
      }
      Text(session.title.uppercased())
        .font(.system(size: 17, weight: .black))
        .lineLimit(2)
      Text("\(session.movements.count) ejercicios · \(Int(session.durationMin)) min")
        .font(.caption2)
        .opacity(0.8)
      if today, let note = session.note {
        Text(note).font(.caption2).lineLimit(3).opacity(0.9)
      }
    }
    .foregroundStyle(today ? Color.black : K.ink)
    .padding(.vertical, 6)
  }
}

// MARK: Workout

struct WorkoutView: View {
  @EnvironmentObject private var workout: WorkoutManager
  @EnvironmentObject private var link: PhoneLink
  @ObservedObject var logger: SessionLogger
  let onClose: () -> Void

  @State private var page = 1
  @State private var finishing = false

  var body: some View {
    if finishing {
      SummaryView(logger: logger, onClose: onClose)
    } else {
      TabView(selection: $page) {
        ControlsView { finishing = true }.tag(0)
        Group {
          if logger.movements.isEmpty {
            MetricsView(title: logger.title)
          } else {
            SetLoggerView(logger: logger)
          }
        }
        .tag(1)
        MetricsView(title: logger.title).tag(2)
      }
      .tabViewStyle(.page)
      .navigationBarBackButtonHidden(true)
      .onChange(of: logger.allDone) { _, done in
        if done && !logger.movements.isEmpty {
          WKInterfaceDevice.current().play(.notification)
          finishing = true
        }
      }
    }
  }
}

private struct ControlsView: View {
  @EnvironmentObject private var workout: WorkoutManager
  let onFinish: () -> Void

  var body: some View {
    VStack(spacing: 10) {
      Button(action: onFinish) {
        Label("Terminar", systemImage: "flag.checkered").frame(maxWidth: .infinity)
      }
      .tint(.accentColor)
      Button {
        workout.phase == .paused ? workout.resume() : workout.pause()
      } label: {
        Label(
          workout.phase == .paused ? "Seguir" : "Pausa",
          systemImage: workout.phase == .paused ? "play.fill" : "pause.fill"
        )
        .frame(maxWidth: .infinity)
      }
    }
    .padding(.horizontal, 4)
  }
}

struct MetricsView: View {
  @EnvironmentObject private var workout: WorkoutManager
  let title: String

  var body: some View {
    TimelineView(.periodic(from: .now, by: 1)) { ctx in
      VStack(alignment: .leading, spacing: 2) {
        Text(title.uppercased()).font(K.label).foregroundStyle(K.muted).lineLimit(1)
        Text(fmtClock(ctx.date.timeIntervalSince(workout.startDate ?? ctx.date)))
          .font(K.big(30))
          .foregroundStyle(workout.phase == .paused ? K.muted : K.ink)
        HeartRateLine()
        Text("\(Int(workout.energyKcal)) kcal").font(.system(size: 16, weight: .semibold))
          .foregroundStyle(K.muted)
        if workout.distanceKm > 0.05 {
          Text(String(format: "%.2f km", workout.distanceKm))
            .font(.system(size: 16, weight: .semibold)).foregroundStyle(K.muted)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

private struct HeartRateLine: View {
  @EnvironmentObject private var workout: WorkoutManager

  var body: some View {
    let hr = workout.heartRate
    let z = hr > 0 ? min(4, max(0, Int(((hr / workout.hrMax) - 0.5) * 10))) : 0
    HStack(alignment: .firstTextBaseline, spacing: 4) {
      Text(hr > 0 ? String(Int(hr)) : "—").font(K.big(34))
      Image(systemName: "heart.fill").foregroundStyle(hr > 0 ? K.zone[z] : K.muted)
      if hr > 0 { Text("Z\(z + 1)").font(K.label).foregroundStyle(K.zone[z]) }
    }
  }
}

// MARK: Sets

struct SetLoggerView: View {
  @ObservedObject var logger: SessionLogger
  @State private var focus: Field = .load
  @State private var crown: Double = 0

  enum Field { case reps, load }

  var body: some View {
    if let m = logger.current {
      VStack(alignment: .leading, spacing: 4) {
        HStack {
          Text("\(logger.index + 1)/\(logger.movements.count)").font(K.label)
            .foregroundStyle(K.muted)
          Spacer()
          if let s = m.nextSet {
            Text("SERIE \(s + 1)/\(m.sets.count)").font(K.label).foregroundStyle(K.muted)
          }
        }
        Text(m.name).font(.system(size: 15, weight: .bold)).lineLimit(2)
        if let ends = logger.restEndsAt {
          RestView(ends: ends) { logger.skipRest() }
        } else if let s = m.nextSet {
          if m.isStrength {
            strengthEditor(m.sets[s], step: m.stepKg)
          } else {
            Text(targetLine(m, m.sets[s])).font(K.big(22)).foregroundStyle(K.ink)
            if !m.cue.isEmpty {
              Text(m.cue).font(.caption2).foregroundStyle(K.muted).lineLimit(2)
            }
          }
          Button(m.isStrength ? "Hecha" : "Hecho") { logger.completeSet() }
            .buttonStyle(.borderedProminent)
            .tint(.accentColor)
            .foregroundStyle(.black)
        }
      }
    }
  }

  @ViewBuilder
  private func strengthEditor(_ set: LoggedSet, step: Double) -> some View {
    HStack(spacing: 6) {
      valueBox(fmtKg(set.loadKg), unit: "kg", on: focus == .load) { select(.load, set) }
      valueBox(String(Int(set.reps)), unit: "rep", on: focus == .reps) { select(.reps, set) }
    }
    .focusable()
    .digitalCrownRotation(
      $crown, from: 0, through: focus == .load ? 500 : 100,
      by: focus == .load ? step : 1, sensitivity: .low,
      isContinuous: false, isHapticFeedbackEnabled: true
    )
    .onAppear { crown = focus == .load ? set.loadKg : set.reps }
    .onChange(of: crown) { _, v in
      focus == .load ? logger.setLoad(v) : logger.setReps(v)
    }
    .onChange(of: logger.current?.nextSet) { _, _ in
      if let m = logger.current, let s = m.nextSet {
        crown = focus == .load ? m.sets[s].loadKg : m.sets[s].reps
      }
    }
    .onChange(of: logger.index) { _, _ in
      if let m = logger.current, let s = m.nextSet {
        crown = focus == .load ? m.sets[s].loadKg : m.sets[s].reps
      }
    }
  }

  private func select(_ field: Field, _ set: LoggedSet) {
    focus = field
    crown = field == .load ? set.loadKg : set.reps
  }

  private func valueBox(_ value: String, unit: String, on: Bool, tap: @escaping () -> Void)
    -> some View
  {
    Button(action: tap) {
      VStack(spacing: 0) {
        Text(value).font(K.big(30)).lineLimit(1).minimumScaleFactor(0.6)
        Text(unit).font(K.label).foregroundStyle(on ? Color.black.opacity(0.7) : K.muted)
      }
      .frame(maxWidth: .infinity)
      .padding(.vertical, 4)
      .foregroundStyle(on ? Color.black : K.ink)
      .background(RoundedRectangle(cornerRadius: 10).fill(on ? K.ink : K.surface))
    }
    .buttonStyle(.plain)
    .accessibilityLabel("\(value) \(unit)")
  }

  private func targetLine(_ m: LoggedMovement, _ s: LoggedSet) -> String {
    if let d = s.durationSec, d > 0 {
      if let km = s.distanceKm, km > 0 { return "\(fmtClock(d)) · \(fmtKg(km)) km" }
      return fmtClock(d)
    }
    if let km = s.distanceKm, km > 0 { return "\(fmtKg(km)) km" }
    return m.name
  }
}

private struct RestView: View {
  let ends: Date
  let skip: () -> Void

  var body: some View {
    TimelineView(.periodic(from: .now, by: 1)) { ctx in
      VStack(alignment: .leading, spacing: 4) {
        Text("DESCANSO").font(K.label).foregroundStyle(Color.accentColor)
        Text(fmtClock(ends.timeIntervalSince(ctx.date).rounded(.up))).font(K.big(40))
        HeartRateLine()
        Button("Saltar", action: skip).font(.footnote)
      }
    }
  }
}

// MARK: Finish

struct SummaryView: View {
  @EnvironmentObject private var workout: WorkoutManager
  @EnvironmentObject private var link: PhoneLink
  @ObservedObject var logger: SessionLogger
  let onClose: () -> Void

  @State private var rpe: Double = 7
  @State private var saving = false

  private static let labels = [
    "Reposo", "Muy fácil", "Fácil", "Cómodo", "Algo exigente", "Exigente", "Duro",
    "Muy duro", "Durísimo", "Casi máximo", "Máximo",
  ]

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 6) {
        Text("¿CÓMO DE DURO?").font(K.label).foregroundStyle(K.muted)
        HStack(alignment: .firstTextBaseline) {
          Text(String(Int(rpe))).font(K.big(44))
          Text(Self.labels[Int(rpe)]).font(.system(size: 14, weight: .semibold))
        }
        .focusable()
        .digitalCrownRotation(
          $rpe, from: 1, through: 10, by: 1, sensitivity: .low, isContinuous: false,
          isHapticFeedbackEnabled: true)
        if !logger.movements.isEmpty {
          Text("\(logger.setsDone) de \(logger.setsTotal) series").font(.caption2)
            .foregroundStyle(K.muted)
        }
        Button {
          Task { await finish(save: true) }
        } label: {
          Text(saving ? "Guardando…" : "Guardar").frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .tint(.accentColor)
        .foregroundStyle(.black)
        .disabled(saving)
        Button("Descartar", role: .destructive) { Task { await finish(save: false) } }
          .disabled(saving)
      }
    }
  }

  private func finish(save: Bool) async {
    saving = true
    let endedAt = Date()
    let saved = await workout.end(save: save)
    if save {
      link.send(
        logger.result(
          rpe: rpe, endedAt: endedAt, workoutUuid: saved?.uuid.uuidString,
          stats: workout.summary(of: saved)))
      WKInterfaceDevice.current().play(.success)
    }
    SessionLogger.clear()
    onClose()
  }
}

// MARK: Sensor mode

struct SensorView: View {
  @EnvironmentObject private var workout: WorkoutManager
  @EnvironmentObject private var link: PhoneLink

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      MetricsView(title: "Sesión en el iPhone")
      Text(link.reachable ? "Enviando tu pulso al iPhone" : "Sin conexión con el iPhone")
        .font(.caption2)
        .foregroundStyle(link.reachable ? K.muted : .orange)
      Button("Terminar", role: .destructive) { Task { _ = await workout.end(save: true) } }
        .font(.footnote)
    }
  }
}
