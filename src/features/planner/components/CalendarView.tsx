// src/features/planner/components/CalendarView.tsx
// Persistent month grid — no toggle, no spring. The week strip used to live
// behind a segmented control; we kept that file for later but only the
// month grid is rendered today (calmer, less chrome, more breathing room
// for the day card that lives below).

import React from 'react';
import MonthGrid from './MonthGrid';
import type { ISODate } from '../../../types/schedule';

interface Props {
  selectedDate: ISODate;
  onSelect: (d: ISODate) => void;
}

export default function CalendarView({ selectedDate, onSelect }: Props) {
  return <MonthGrid selectedDate={selectedDate} onSelect={onSelect} />;
}
