import { addDays } from '../domain/dates';
import type { ISODate } from '../domain/types';

export type Row = Record<string, string>;

export const PEOPLE_ALIASES = {
  name: ['full_name', 'name', 'фио', 'сотрудник'],
  position: ['position', 'должность'],
  department: ['department', 'подразделение', 'отдел'],
  hire: ['hire_date', 'hired', 'дата приёма', 'дата приема', 'принят'],
  leave: ['leave_date', 'fired', 'дата увольнения', 'уволен'],
  reason: ['leave_reason', 'причина увольнения', 'причина'],
  id: ['id', 'табельный номер', 'employee_id'],
  manager: ['manager', 'руководитель'],
  mentor: ['mentor', 'наставник'],
} as const;

export const TASK_ALIASES = {
  id: ['employee_id', 'id', 'табельный номер'],
  name: ['full_name', 'name', 'фио', 'сотрудник'],
  title: ['title', 'название', 'задача'],
  dueDay: ['due_day', 'срок (дней)'],
  dueDate: ['due_date', 'срок', 'дедлайн'],
  done: ['completed_on', 'дата выполнения'],
  kind: ['kind', 'тип'],
} as const;

function norm(key: string): string {
  return key.trim().toLowerCase().replace(/ё/g, 'е');
}

/** Name comparison that ignores case, spacing and е/ё. */
export function normName(s: string): string {
  return norm(s).replace(/\s+/g, ' ');
}

/** True when any row has a column matching one of the aliases. */
export function hasColumn(rows: Row[], aliases: readonly string[]): boolean {
  const wanted = aliases.map(norm);
  return rows.some((row) => Object.keys(row).some((k) => wanted.includes(norm(k))));
}

/** Trimmed value of the first matching alias column in a row ('' when absent). */
export function pick(row: Row, aliases: readonly string[]): string {
  const wanted = aliases.map(norm);
  const entries = Object.entries(row);
  for (const alias of wanted) {
    const hit = entries.find(([k]) => norm(k) === alias);
    if (hit && hit[1].trim() !== '') return hit[1].trim();
  }
  return '';
}

function validIso(y: number, m: number, d: number): ISODate | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // Round-trip rejects 31.02 and the like.
  return addDays(iso, 0) === iso ? iso : undefined;
}

/** `YYYY-MM-DD`, `DD.MM.YYYY` or an ISO datetime; undefined when not a real calendar date. */
export function parseDate(s: string): ISODate | undefined {
  const t = s.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(t);
  if (m) return validIso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (m) return validIso(Number(m[3]), Number(m[2]), Number(m[1]));
  return undefined;
}
