import { addDays } from './dates';
import { ACTIONS, evaluateRisk, levelFor, RULES } from './rules';
import { makeEmployee, makeTask } from '../test/factories';

const ASOF = '2026-11-11';
const hiredDaysAgo = (n: number) => addDays(ASOF, -n);
const codes = (r: ReturnType<typeof evaluateRisk>) => r.reasons.map((x) => x.code);

describe('evaluateRisk', () => {
  it('gives a low score of 0 to someone hired today with everything still ahead', () => {
    const e = makeEmployee({
      hireDate: ASOF,
      tasks: [makeTask({ dueDay: 1 }), makeTask({ kind: 'mentor_meeting', dueDay: 5 })],
    });
    const r = evaluateRisk(e, ASOF);
    expect(r.tenureDay).toBe(0);
    expect(r.score).toBe(0);
    expect(r.level).toBe('low');
    expect(r.reasons).toEqual([]);
    expect(Number.isNaN(r.score)).toBe(false);
  });

  it('flags a missing mentor meeting and overdue tasks after the first week', () => {
    const hire = hiredDaysAgo(20);
    const e = makeEmployee({
      hireDate: hire,
      tasks: [
        makeTask({ dueDay: 1, status: 'done', completedOn: addDays(hire, 1) }),
        makeTask({ kind: 'mentor_meeting', dueDay: 5, responsible: 'mentor' }),
      ],
    });
    const r = evaluateRisk(e, ASOF);
    expect(codes(r)).toContain('no_mentor_meeting');
    expect(codes(r)).toContain('overdue_tasks');
    expect(r.nextAction).toBe(ACTIONS.no_mentor_meeting);
  });

  it('does not count a task completed late as overdue', () => {
    const hire = hiredDaysAgo(20);
    const e = makeEmployee({
      hireDate: hire,
      tasks: [makeTask({ dueDay: 1, status: 'done', completedOn: addDays(hire, 5) })],
    });
    expect(codes(evaluateRisk(e, ASOF))).not.toContain('overdue_tasks');
  });

  it('caps overdue points at 30', () => {
    const e = makeEmployee({
      hireDate: hiredDaysAgo(40),
      tasks: [1, 2, 3, 4, 5].map((d) => makeTask({ dueDay: d })),
    });
    const overdue = evaluateRisk(e, ASOF).reasons.find((x) => x.code === 'overdue_tasks');
    expect(overdue?.points).toBe(RULES.overdue.cap);
    expect(overdue?.points).toBe(30);
  });

  it('writes the overdue count into the reason text', () => {
    const e = makeEmployee({
      hireDate: hiredDaysAgo(10),
      tasks: [1, 2, 3].map((d) => makeTask({ dueDay: d })),
    });
    const overdue = evaluateRisk(e, ASOF).reasons.find((x) => x.code === 'overdue_tasks');
    expect(overdue?.text).toBe('Просрочено задач: 3');
  });

  it('is not stalled when something was completed in the last 14 days', () => {
    const e = makeEmployee({
      hireDate: hiredDaysAgo(30),
      tasks: [
        makeTask({ dueDay: 2 }),
        makeTask({ dueDay: 10, status: 'done', completedOn: addDays(ASOF, -3) }),
      ],
    });
    expect(codes(evaluateRisk(e, ASOF))).not.toContain('stalled');
  });

  it('is stalled when tasks are overdue and nothing was completed for over 14 days', () => {
    const e = makeEmployee({
      hireDate: hiredDaysAgo(30),
      tasks: [
        makeTask({ dueDay: 2 }),
        makeTask({ dueDay: 3, status: 'done', completedOn: addDays(ASOF, -20) }),
      ],
    });
    expect(codes(evaluateRisk(e, ASOF))).toContain('stalled');
  });

  it('does not call a two-day-old newcomer stalled', () => {
    const e = makeEmployee({ hireDate: hiredDaysAgo(2), tasks: [makeTask({ dueDay: 1 })] });
    const r = evaluateRisk(e, ASOF);
    expect(codes(r)).toEqual(['overdue_tasks']);
    expect(r.level).toBe('low');
  });

  it('is stalled when nothing was ever completed and the first 14 days are over', () => {
    const e = makeEmployee({ hireDate: hiredDaysAgo(20), tasks: [makeTask({ dueDay: 1 })] });
    expect(codes(evaluateRisk(e, ASOF))).toContain('stalled');
  });

  it('sorts reasons by points, highest first', () => {
    const e = makeEmployee({ hireDate: hiredDaysAgo(30), tasks: [makeTask({ dueDay: 2 })] });
    const pts = evaluateRisk(e, ASOF).reasons.map((x) => x.points);
    expect(pts).toEqual([...pts].sort((a, b) => b - a));
  });

  it('says no action is needed when there are no reasons', () => {
    const r = evaluateRisk(makeEmployee({ hireDate: ASOF }), ASOF);
    expect(r.nextAction).toMatch(/не требуется/);
  });
});

describe('levelFor', () => {
  it('applies the thresholds', () => {
    expect(levelFor(50)).toBe('high');
    expect(levelFor(49)).toBe('medium');
    expect(levelFor(25)).toBe('medium');
    expect(levelFor(24)).toBe('low');
  });
});
