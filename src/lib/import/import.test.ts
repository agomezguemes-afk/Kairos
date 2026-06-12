import { describe, it, expect } from 'vitest';

import { parseCsv, csvToRecords } from './csv';
import { parseStrongCsv, parseStrongDuration } from './strongCsv';
import { parseHevyCsv, parseHevyDate } from './hevyCsv';
import { parseWorkoutCsv, ImportFormatError, buildPreview } from './index';
import { toHistoryEntries, IMPORTED_BLOCK_ID } from './toHistory';

// ── Fixtures ────────────────────────────────────────────────────────────────

const STRONG_FIXTURE = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2024-03-04 18:02:11,Push Day,1h 10m,Bench Press (Barbell),W1,40,10,,,,,
2024-03-04 18:02:11,Push Day,1h 10m,Bench Press (Barbell),1,80,8,,,,,8
2024-03-04 18:02:11,Push Day,1h 10m,Bench Press (Barbell),2,80,7,,,"slow eccentric",,8.5
2024-03-04 18:02:11,Push Day,1h 10m,"Press, Overhead (Barbell)",1,50,6,,,,,9
2024-03-06 07:15:00,Leg Day,45m,Squat (Barbell),1,100,5,,,,,
2024-03-06 07:15:00,Leg Day,45m,Running,1,,,5.2,1800,,,
`;

const HEVY_FIXTURE = `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe
"Upper A","29 Jul 2024, 17:01","29 Jul 2024, 18:05",,Bench Press (Barbell),,,0,warmup,40,12,,,
"Upper A","29 Jul 2024, 17:01","29 Jul 2024, 18:05",,Bench Press (Barbell),,,1,normal,82.5,8,,,8
"Upper A","29 Jul 2024, 17:01","29 Jul 2024, 18:05",,"Row, Bent Over",,,0,normal,70,10,,,
"Run","2024-08-01 08:00:00","2024-08-01 08:40:00",,Running,,,0,normal,,,6.1,2400,
`;

// ── CSV core ────────────────────────────────────────────────────────────────

describe('parseCsv', () => {
  it('parses quoted fields with commas and escaped quotes', () => {
    const rows = parseCsv('a,"b,c","say ""hi"""\n1,2,3');
    expect(rows).toEqual([
      ['a', 'b,c', 'say "hi"'],
      ['1', '2', '3'],
    ]);
  });

  it('handles CRLF and embedded newlines in quotes', () => {
    const rows = parseCsv('a,b\r\n"multi\nline",2\r\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['multi\nline', '2'],
    ]);
  });

  it('csvToRecords keys by trimmed header', () => {
    const { records } = csvToRecords(' a , b \n1,2');
    expect(records[0]).toEqual({ a: '1', b: '2' });
  });
});

// ── Strong ──────────────────────────────────────────────────────────────────

describe('parseStrongCsv', () => {
  const result = parseStrongCsv(STRONG_FIXTURE);

  it('groups rows into workouts by date+name', () => {
    expect(result.workouts).toHaveLength(2);
    expect(result.workouts.map((w) => w.name)).toEqual(['Push Day', 'Leg Day']);
  });

  it('parses duration into endedAt', () => {
    const push = result.workouts[0];
    expect(push.endedAt! - push.startedAt).toBe((60 + 10) * 60 * 1000);
  });

  it('keeps set order, warmup flag and RPE', () => {
    const bench = result.workouts[0].exercises[0];
    expect(bench.name).toBe('Bench Press (Barbell)');
    expect(bench.sets).toHaveLength(3);
    expect(bench.sets[0].isWarmup).toBe(true);
    expect(bench.sets[1]).toMatchObject({ weight: 80, reps: 8, rpe: 8 });
    expect(bench.sets[2].rpe).toBe(8.5);
  });

  it('handles quoted exercise names with commas', () => {
    expect(result.workouts[0].exercises[1].name).toBe('Press, Overhead (Barbell)');
  });

  it('captures cardio distance/seconds', () => {
    const run = result.workouts[1].exercises.find((e) => e.name === 'Running')!;
    expect(run.sets[0]).toMatchObject({ distanceKm: 5.2, durationSec: 1800 });
  });

  it('parseStrongDuration variants', () => {
    expect(parseStrongDuration('1h 10m')).toBe(4200);
    expect(parseStrongDuration('45m')).toBe(2700);
    expect(parseStrongDuration('2h')).toBe(7200);
    expect(parseStrongDuration('70')).toBe(4200);
    expect(parseStrongDuration('')).toBeNull();
  });

  it('warns on unparseable dates instead of throwing', () => {
    const bad = parseStrongCsv(
      'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps\nnot-a-date,X,,Bench,1,50,5\n',
    );
    expect(bad.workouts).toHaveLength(0);
    expect(bad.warnings.length).toBe(1);
  });
});

// ── Hevy ────────────────────────────────────────────────────────────────────

describe('parseHevyCsv', () => {
  const result = parseHevyCsv(HEVY_FIXTURE);

  it('groups by title+start_time and parses both date formats', () => {
    expect(result.workouts).toHaveLength(2);
    expect(result.workouts[0].name).toBe('Upper A');
    expect(result.workouts[1].name).toBe('Run');
  });

  it('parses app-style dates', () => {
    const d = new Date(parseHevyDate('29 Jul 2024, 17:01')!);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([
      2024, 6, 29, 17, 1,
    ]);
  });

  it('parses ISO-style dates', () => {
    const d = new Date(parseHevyDate('2024-08-01 08:00:00')!);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2024, 7, 1]);
  });

  it('maps warmup set_type and rpe', () => {
    const bench = result.workouts[0].exercises[0];
    expect(bench.sets[0].isWarmup).toBe(true);
    expect(bench.sets[1]).toMatchObject({ weight: 82.5, reps: 8, rpe: 8 });
  });

  it('end_time drives duration', () => {
    const upper = result.workouts[0];
    expect(upper.endedAt! - upper.startedAt).toBe(64 * 60 * 1000);
  });
});

// ── Detection ───────────────────────────────────────────────────────────────

describe('parseWorkoutCsv detection', () => {
  it('routes Strong and Hevy by header', () => {
    expect(parseWorkoutCsv(STRONG_FIXTURE).format).toBe('strong');
    expect(parseWorkoutCsv(HEVY_FIXTURE).format).toBe('hevy');
  });

  it('throws ImportFormatError on unknown CSVs', () => {
    expect(() => parseWorkoutCsv('foo,bar\n1,2')).toThrow(ImportFormatError);
  });
});

// ── Preview + history mapping ───────────────────────────────────────────────

describe('buildPreview', () => {
  it('counts workouts, unique exercises, sets and range', () => {
    const preview = buildPreview(parseStrongCsv(STRONG_FIXTURE));
    expect(preview.workoutCount).toBe(2);
    expect(preview.exerciseCount).toBe(4);
    expect(preview.setCount).toBe(6);
    expect(preview.dateRange!.from).toBeLessThan(preview.dateRange!.to);
  });
});

describe('toHistoryEntries', () => {
  const entries = toHistoryEntries(parseStrongCsv(STRONG_FIXTURE).workouts);

  it('maps workouts onto WorkoutHistoryEntry with volume math', () => {
    const push = entries[0];
    expect(push.blockId).toBe(IMPORTED_BLOCK_ID);
    expect(push.blockName).toBe('Push Day');
    expect(push.setCount).toBe(4);
    // 40×10 + 80×8 + 80×7 + 50×6 = 400+640+560+300
    expect(push.totalVolume).toBe(1900);
    expect(push.durationSec).toBe(4200);
  });

  it('namespaces exerciseId by normalized name for correlation', () => {
    const bench = entries[0].exercises[0];
    expect(bench.exerciseId).toBe('import_bench_press_(barbell)');
    expect(bench.maxWeight).toBe(80);
    expect(bench.performedSets![0].kind).toBe('warmup');
  });

  it('falls back to startedAt when endedAt missing', () => {
    const noEnd = toHistoryEntries([{ name: 'X', startedAt: 1000, endedAt: null, exercises: [] }]);
    expect(noEnd[0].durationSec).toBe(0);
    expect(noEnd[0].endedAt).toBe(1000);
  });
});
