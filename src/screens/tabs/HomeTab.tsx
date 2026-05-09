// src/screens/tabs/HomeTab.tsx
// HomeTab is now a thin wrapper around TodayPlanner. The previous "command
// centre" content (greeting, suggested block, mission progress, stats row)
// is fully superseded by the planner — the planner owns header, calendar,
// day card, and Kai signal.

import React from 'react';
import TodayPlanner from '../../features/planner/TodayPlanner';

export default function HomeTab() {
  return <TodayPlanner />;
}
