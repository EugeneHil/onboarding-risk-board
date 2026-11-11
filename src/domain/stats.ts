import { daysBetween } from './dates';
import type { BoardRow, Employee, RiskLevel } from './types';

export interface TenureBucket {
  label: string;
  from: number;
  to: number;
  count: number;
}

const BUCKETS: Array<Omit<TenureBucket, 'count'>> = [
  { label: '0-14', from: 0, to: 14 },
  { label: '15-30', from: 15, to: 30 },
  { label: '31-60', from: 31, to: 60 },
  { label: '61-90', from: 61, to: 90 },
  { label: '91+', from: 91, to: Infinity },
];

/** Leavers grouped by how many days they worked before leaving. */
export function leaversByTenure(employees: Employee[]): TenureBucket[] {
  const result = BUCKETS.map((b) => ({ ...b, count: 0 }));
  for (const e of employees) {
    if (e.status !== 'left' || !e.leaveDate) continue;
    const tenure = daysBetween(e.hireDate, e.leaveDate);
    const bucket = result.find((b) => tenure >= b.from && tenure <= b.to);
    if (bucket) bucket.count += 1;
  }
  return result;
}

export function levelCounts(rows: BoardRow[]): Record<RiskLevel, number> {
  const counts: Record<RiskLevel, number> = { high: 0, medium: 0, low: 0 };
  for (const row of rows) counts[row.risk.level] += 1;
  return counts;
}
