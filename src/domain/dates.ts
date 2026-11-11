import type { ISODate } from './types';

const MS_PER_DAY = 86_400_000;

function toUtcMs(date: ISODate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y as number, (m as number) - 1, d as number);
}

function fromUtcMs(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

export function addDays(date: ISODate, n: number): ISODate {
  return fromUtcMs(toUtcMs(date) + n * MS_PER_DAY);
}

/** '2026-11-05' -> '05.11.2026' */
export function formatRu(date: ISODate): string {
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y}`;
}
