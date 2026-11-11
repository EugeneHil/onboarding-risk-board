import { makeEmployee, makeTask } from '../test/factories';
import { addDays } from './dates';
import { backtest } from './backtest';
import type { Employee } from './types';

const ASOF = '2026-11-11';
const hiredAgo = 200;
const hire = addDays(ASOF, -hiredAgo);
const at = (day: number) => addDays(hire, day);

/** Chain with a mentor meeting (due day 7) and a manager check-in (due day 14). */
const chain = (mentorDoneDay?: number, checkinDoneDay?: number) => [
  makeTask({
    kind: 'mentor_meeting',
    dueDay: 7,
    ...(mentorDoneDay === undefined
      ? {}
      : { status: 'done' as const, completedOn: at(mentorDoneDay) }),
  }),
  makeTask({
    kind: 'checkin',
    dueDay: 14,
    ...(checkinDoneDay === undefined
      ? {}
      : { status: 'done' as const, completedOn: at(checkinDoneDay) }),
  }),
];

const person = (over: Partial<Employee>) => makeEmployee({ hireDate: hire, tasks: chain(5, 12), ...over });
const leaver = (tenure: number, over: Partial<Employee> = {}) =>
  person({ status: 'left', leaveDate: at(tenure), ...over });

describe('backtest', () => {
  it('compares the flagged share among early leavers and among stayers at the cut day', () => {
    const people = [
      leaver(40, { tasks: chain() }), // nothing done by day 20: flagged, left early
      leaver(60, { tasks: chain(5, 12) }), // on track, left early: not flagged
      person({ tasks: chain(5, 12) }), // stayer on track
      person({ tasks: chain() }), // stayer with nothing done: flagged
      person({ tasks: chain(5, 12) }),
    ];
    const r = backtest(people, ASOF, 20);
    expect(r.cutDay).toBe(20);
    expect(r.earlyLeavers).toEqual({ n: 2, flagged: 1 });
    expect(r.stayers).toEqual({ n: 3, flagged: 1 });
    expect(r.flaggedShareLeavers).toBeCloseTo(0.5, 10);
    expect(r.flaggedShareStayers).toBeCloseTo(1 / 3, 10);
  });

  it('counts a task as done only if it was completed by the cut day', () => {
    // mentor meeting done on day 25 and check-in on day 30: both late for a cut at day 20
    const late = person({ tasks: chain(25, 30) });
    const r = backtest([late], ASOF, 20);
    expect(r.stayers).toEqual({ n: 1, flagged: 1 });
    // the same person judged at day 40 is fine
    expect(backtest([late], ASOF, 40).stayers).toEqual({ n: 1, flagged: 0 });
  });

  it('skips people who had already left before the cut day', () => {
    const r = backtest([leaver(10, { tasks: chain() }), leaver(30, { tasks: chain() })], ASOF, 20);
    expect(r.earlyLeavers.n).toBe(1);
  });

  it('skips cohorts younger than 90 days, people without tasks and future hires', () => {
    const people = [
      person({ hireDate: addDays(ASOF, -50), tasks: chain() }),
      person({ tasks: [] }),
      person({ hireDate: addDays(ASOF, 3), tasks: chain() }),
    ];
    const r = backtest(people, ASOF, 20);
    expect(r.earlyLeavers.n + r.stayers.n).toBe(0);
    expect(r.flaggedShareLeavers).toBeUndefined();
    expect(r.flaggedShareStayers).toBeUndefined();
  });

  it('treats someone who left after day 90 as a stayer', () => {
    const r = backtest([leaver(120, { tasks: chain() })], ASOF, 20);
    expect(r.stayers).toEqual({ n: 1, flagged: 1 });
    expect(r.earlyLeavers.n).toBe(0);
  });

  it('does not mutate the employees', () => {
    const p = person({ tasks: chain(25, 30) });
    backtest([p], ASOF, 20);
    expect(p.tasks.every((t) => t.status === 'done')).toBe(true);
  });

  it('handles an empty list', () => {
    expect(backtest([], ASOF, 20).stayers).toEqual({ n: 0, flagged: 0 });
  });
});
