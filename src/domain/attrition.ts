import { daysBetween } from './dates';
import { RISK_WINDOW_DAYS } from './rules';
import type { Employee, ISODate } from './types';

export interface SurvivalPoint {
  day: number;
  survival: number;
  atRisk: number;
}

/** Minimum number of eligible hires before a rate is shown as a percentage. */
export const MIN_COHORT = 10;

interface Observation {
  tenure: number;
  left: boolean;
}

function observe(e: Employee, asOf: ISODate): Observation | undefined {
  if (daysBetween(e.hireDate, asOf) < 0) return undefined;
  if (e.status === 'left' && e.leaveDate) {
    return { tenure: daysBetween(e.hireDate, e.leaveDate), left: true };
  }
  return { tenure: daysBetween(e.hireDate, asOf), left: false };
}

/**
 * Kaplan-Meier estimate of staying with the company, one point per day 0..horizon.
 * Leavers are events at their tenure; active employees are censored at their tenure.
 */
export function survivalCurve(employees: Employee[], asOf: ISODate, horizon = 180): SurvivalPoint[] {
  const obs = employees.map((e) => observe(e, asOf)).filter((o): o is Observation => o !== undefined);
  const events = new Array<number>(horizon + 1).fill(0);
  const atRiskAt = new Array<number>(horizon + 1).fill(0);
  for (const o of obs) {
    // at risk on every day up to and including its tenure
    for (let d = 0; d <= Math.min(o.tenure, horizon); d += 1) atRiskAt[d] = (atRiskAt[d] ?? 0) + 1;
    if (o.left && o.tenure >= 0 && o.tenure <= horizon) events[o.tenure] = (events[o.tenure] ?? 0) + 1;
  }
  const curve: SurvivalPoint[] = [];
  let survival = 1;
  for (let day = 0; day <= horizon; day += 1) {
    const atRisk = atRiskAt[day] ?? 0;
    const died = events[day] ?? 0;
    if (atRisk > 0 && died > 0) survival *= 1 - died / atRisk;
    curve.push({ day, survival, atRisk });
  }
  return curve;
}

/** Survival on a given day; days outside the curve are clamped. */
export function survivalAt(curve: SurvivalPoint[], day: number): number {
  const last = curve[curve.length - 1];
  if (!last) return 1;
  if (day <= 0) return curve[0]?.survival ?? 1;
  return (curve[Math.min(day, last.day)] ?? last).survival;
}

/** Survival on a day, or undefined when nobody is left under observation then (nothing to estimate). */
export function survivalKnownAt(curve: SurvivalPoint[], day: number): number | undefined {
  const last = curve[curve.length - 1];
  if (!last) return undefined;
  const point = curve[Math.min(Math.max(day, 0), last.day)];
  return point && point.atRisk > 0 ? point.survival : undefined;
}

export interface ExitRate {
  key: string;
  hires: number;
  leftEarly: number;
  rate: number | undefined;
  fewData: boolean;
}

/**
 * Share of hires who left within `window` days, per group. Only hires made at least
 * `window` days before `asOf` count, so young cohorts do not look better than they are.
 */
export function earlyExitRates(
  employees: Employee[],
  asOf: ISODate,
  keyOf: (e: Employee) => string,
  window = 90,
): ExitRate[] {
  const groups = new Map<string, { hires: number; leftEarly: number }>();
  for (const e of employees) {
    const key = keyOf(e);
    const g = groups.get(key) ?? { hires: 0, leftEarly: 0 };
    groups.set(key, g);
    if (daysBetween(e.hireDate, asOf) < window) continue;
    g.hires += 1;
    if (e.status === 'left' && e.leaveDate && daysBetween(e.hireDate, e.leaveDate) <= window) g.leftEarly += 1;
  }
  return [...groups.entries()]
    .map(([key, g]): ExitRate => ({
      key,
      hires: g.hires,
      leftEarly: g.leftEarly,
      rate: g.hires === 0 ? undefined : g.leftEarly / g.hires,
      fewData: g.hires < MIN_COHORT,
    }))
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
}

export interface HistoryRow {
  employee: Employee;
  tenureDay: number;
  groupRate: number | undefined;
  fewData: boolean;
}

/** Active newcomers (days 0..90) ranked by the historical early-exit rate of their department. */
export function buildHistoryBoard(employees: Employee[], asOf: ISODate): HistoryRow[] {
  const rates = new Map(earlyExitRates(employees, asOf, (e) => e.department).map((r) => [r.key, r]));
  return employees
    .filter((e) => e.status === 'active')
    .map((employee) => ({ employee, tenureDay: daysBetween(employee.hireDate, asOf) }))
    .filter((r) => r.tenureDay >= 0 && r.tenureDay <= RISK_WINDOW_DAYS)
    .map((r) => {
      const g = rates.get(r.employee.department);
      return { ...r, groupRate: g?.rate, fewData: g?.fewData ?? true };
    })
    .sort(
      (a, b) =>
        Number(a.fewData) - Number(b.fewData) || // small groups: no confident ranking, listed after
        (a.fewData ? 0 : (b.groupRate ?? -1) - (a.groupRate ?? -1)) ||
        a.tenureDay - b.tenureDay,
    );
}
