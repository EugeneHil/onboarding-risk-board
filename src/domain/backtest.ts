import { addDays, daysBetween } from './dates';
import { evaluateRisk } from './rules';
import type { Employee, ISODate, OnboardingTask } from './types';

export interface BacktestGroup {
  n: number;
  /** How many of them the rules rated medium or high on the cut day. */
  flagged: number;
}

export interface BacktestResult {
  cutDay: number;
  earlyLeavers: BacktestGroup;
  stayers: BacktestGroup;
  flaggedShareLeavers: number | undefined;
  flaggedShareStayers: number | undefined;
}

/** The task as it looked on the cut date: later completions are still open. */
function asOfCut(task: OnboardingTask, cutDate: ISODate): OnboardingTask {
  if (task.status === 'done' && task.completedOn && task.completedOn <= cutDate) return task;
  const { completedOn: _later, ...open } = task;
  return { ...open, status: 'open' };
}

/**
 * Replays the risk rules as of day `cutDay` of each employee and asks: did they flag the people
 * who then left within 90 days more often than the people who stayed? Only complete cohorts
 * (hired at least 90 days ago), only people with tasks, only those still employed on the cut day.
 * A completed task without a completion date counts as open: its timing is unknown.
 */
export function backtest(
  employees: Employee[],
  asOf: ISODate,
  cutDay: number,
  minLevel: 'medium' | 'high' = 'medium',
): BacktestResult {
  const earlyLeavers: BacktestGroup = { n: 0, flagged: 0 };
  const stayers: BacktestGroup = { n: 0, flagged: 0 };

  for (const e of employees) {
    if (e.tasks.length === 0) continue;
    if (daysBetween(e.hireDate, asOf) < 90) continue;
    const leftAt =
      e.status === 'left' && e.leaveDate ? daysBetween(e.hireDate, e.leaveDate) : undefined;
    if (leftAt !== undefined && leftAt <= cutDay) continue;

    const cutDate = addDays(e.hireDate, cutDay);
    const snapshot: Employee = {
      ...e,
      status: 'active',
      tasks: e.tasks.map((t) => asOfCut(t, cutDate)),
    };
    const level = evaluateRisk(snapshot, cutDate).level;
    const flagged = minLevel === 'high' ? level === 'high' : level !== 'low';
    const group = leftAt !== undefined && leftAt <= 90 ? earlyLeavers : stayers;
    group.n += 1;
    if (flagged) group.flagged += 1;
  }

  const share = (g: BacktestGroup) => (g.n === 0 ? undefined : g.flagged / g.n);
  return {
    cutDay,
    earlyLeavers,
    stayers,
    flaggedShareLeavers: share(earlyLeavers),
    flaggedShareStayers: share(stayers),
  };
}
