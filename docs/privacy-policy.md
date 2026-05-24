# Kairos — Privacy Policy

_Last updated: 2026-05-24_

Kairos ("the app", "we", "us") is a personal training operating system
built and maintained by Álvaro Gómez Güemes. This document explains what
data the app collects, where it lives, and what you can do about it.

## Tl;dr

- All your data stays **on your device** by default.
- We do **not** sell, share, or upload your training data to any server
  we control.
- The app does not contain third-party advertising SDKs or analytics
  trackers.

## Data the app stores locally

The following information is stored in your device's local storage
(AsyncStorage / on-device SQLite via Zustand persistence):

| Category                  | Examples                                                  |
| ------------------------- | --------------------------------------------------------- |
| Training blocks           | Names, exercises, sets, notes, rest seconds, history      |
| Schedule                  | One-time and recurring assignments, completions, skips    |
| Onboarding profile        | Display name, primary goal, fitness level, weekly target  |
| Body metrics (optional)   | Body weight (only if you set it manually)                 |
| Preferences               | Theme preference, tour completion, notifications opt-in   |

You can delete all of this at any time via _Profile → Reiniciar
onboarding_, or by uninstalling the app.

## Data the app may write to Apple Health

If you grant HealthKit permission, Kairos writes completed workouts as
HKWorkout samples (duration, active energy burned, exercise type). It
does **not** read your existing HealthKit data. You can revoke this
permission at any time in Settings → Health → Apps.

## Notifications

If you enable notifications, the app schedules **local** notifications
on your device for session reminders and gap nudges. No notification
content leaves the device — there is no push server.

## Third-party services

Currently: none. If this changes (e.g., to add iCloud sync or AI-powered
features that require a remote model), this policy will be updated and
the relevant feature will be opt-in.

## Children

Kairos is not directed at children under 13. We do not knowingly collect
data from children under 13.

## Contact

Questions or concerns: **agomezguemes@gmail.com**

## Changes to this policy

If a future version of the app changes the data flow described above,
this file will be updated and a summary of the change will be presented
in the in-app changelog.
