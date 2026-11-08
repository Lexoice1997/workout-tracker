// apps/web/src/features/export-data/model/export.ts — сборка JSON/CSV, чистые функции
export interface ExportSet {
  readonly exercise: string;
  readonly weightKg: number;
  readonly reps: readonly number[];
  readonly repMin: number;
  readonly repMax: number;
}

export interface ExportWorkout {
  readonly date: string;
  readonly day: string;
  readonly isDeload: boolean;
  readonly cardioMin: number | null;
  readonly note: string | null;
  readonly finishedAt: string | null;
  readonly sets: readonly ExportSet[];
}

export interface ExportBundle {
  readonly app: 'workout-tracker';
  readonly version: 1;
  readonly exportedAt: string;
  readonly workouts: readonly ExportWorkout[];
  readonly bodyMetrics: readonly Record<string, unknown>[];
  readonly goals: readonly Record<string, unknown>[];
  readonly program: unknown;
}

const HEADER = ['date', 'day', 'deload', 'exercise', 'weight_kg', 'sets', 'reps', 'rep_min', 'rep_max', 'cardio_min', 'note'];

/** RFC 4180 + защита от формул: «=СУММ(…)» в заметке не выполнится при открытии в таблице */
export function csvCell(v: string | number | boolean | null): string {
  if (v === null) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Строка на упражнение тренировки; тренировка без подходов — одна строка с пустым упражнением */
export function toCsv(workouts: readonly ExportWorkout[]): string {
  const rows = workouts.flatMap((w) => {
    const base = (s: ExportSet | null) => [
      w.date, w.day, w.isDeload, s?.exercise ?? null, s?.weightKg ?? null, s?.reps.length ?? null,
      s ? s.reps.join(' ') : null, s?.repMin ?? null, s?.repMax ?? null, w.cardioMin, w.note,
    ];
    return w.sets.length ? w.sets.map(base) : [base(null)];
  });
  // BOM: Excel без него открывает UTF-8 кракозябрами; Google Sheets его просто игнорирует
  return '﻿' + [HEADER, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export const exportFileName = (ext: 'json' | 'csv', today: string) => `workout-tracker-${today}.${ext}`;
