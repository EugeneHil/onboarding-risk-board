import { makeEmployee } from '../test/factories';
import { addDays } from './dates';
import { buildHistoryBoard, earlyExitRates, survivalAt, survivalCurve, survivalKnownAt } from './attrition';
import type { Employee } from './types';

const ASOF = '2026-11-11';

/** Active employee with the given tenure on ASOF. */
const active = (tenure: number, over: Partial<Employee> = {}) =>
  makeEmployee({ hireDate: addDays(ASOF, -tenure), ...over });

/** Leaver who worked `tenure` days, hired `hiredAgo` days before ASOF. */
const leaver = (tenure: number, hiredAgo: number, over: Partial<Employee> = {}) => {
  const hireDate = addDays(ASOF, -hiredAgo);
  return makeEmployee({
    hireDate,
    status: 'left',
    leaveDate: addDays(hireDate, tenure),
    ...over,
  });
};

describe('survivalCurve', () => {
  it('equals the hand-computed Kaplan-Meier product with a censored person in between', () => {
    const people = [
      leaver(10, 200),
      leaver(30, 200),
      active(20),
      ...Array.from({ length: 7 }, () => active(100)),
    ];
    const curve = survivalCurve(people, ASOF);
    expect(survivalAt(curve, 9)).toBe(1);
    expect(survivalAt(curve, 10)).toBeCloseTo(0.9, 10);
    expect(survivalAt(curve, 29)).toBeCloseTo(0.9, 10);
    // at day 30: 10 - exit(10) - censored(20) = 8 at risk, one exit
    expect(survivalAt(curve, 30)).toBeCloseTo(0.9 * (7 / 8), 10);
    expect(curve[10]?.atRisk).toBe(10);
    expect(curve[30]?.atRisk).toBe(8);
  });

  it('handles two exits on the same day as one step', () => {
    const people = [leaver(10, 200), leaver(10, 200), ...Array.from({ length: 8 }, () => active(100))];
    expect(survivalAt(survivalCurve(people, ASOF), 10)).toBeCloseTo(0.8, 10);
  });

  it('stays at 1 when everyone is still active', () => {
    const curve = survivalCurve([active(5), active(50), active(400)], ASOF);
    expect(curve).toHaveLength(181);
    expect(curve.every((p) => p.survival === 1)).toBe(true);
  });

  it('returns survival 1 and nobody at risk for an empty list', () => {
    const curve = survivalCurve([], ASOF);
    expect(curve.every((p) => p.survival === 1 && p.atRisk === 0)).toBe(true);
  });

  it('ignores a person hired after the as-of date', () => {
    const future = makeEmployee({ hireDate: addDays(ASOF, 5) });
    const curve = survivalCurve([future], ASOF);
    expect(curve[0]?.atRisk).toBe(0);
  });

  it('respects a custom horizon', () => {
    expect(survivalCurve([active(5)], ASOF, 30)).toHaveLength(31);
  });
});

describe('survivalAt', () => {
  it('clamps days outside the curve', () => {
    const curve = survivalCurve([leaver(10, 200), active(100)], ASOF, 30);
    expect(survivalAt(curve, -5)).toBe(1);
    expect(survivalAt(curve, 999)).toBe(curve[30]?.survival);
    expect(survivalAt([], 5)).toBe(1);
  });
});

describe('earlyExitRates', () => {
  const dept = (e: Employee) => e.department;

  it('counts only cohorts hired at least 90 days ago and flags small groups', () => {
    const people = [
      ...Array.from({ length: 10 }, (_, i) => (i < 4 ? leaver(40, 200, { department: 'store' }) : active(200, { department: 'store' }))),
      // too young to judge: hired 30 days ago
      active(30, { department: 'store' }),
      leaver(10, 60, { department: 'store' }),
      leaver(20, 150, { department: 'office' }),
    ];
    const rates = earlyExitRates(people, ASOF, dept);
    const store = rates.find((r) => r.key === 'store')!;
    expect(store).toMatchObject({ hires: 10, leftEarly: 4, rate: 0.4, fewData: false });
    const office = rates.find((r) => r.key === 'office')!;
    expect(office).toMatchObject({ hires: 1, leftEarly: 1, rate: 1, fewData: true });
  });

  it('does not count a leaver who stayed longer than the window as early', () => {
    const people = [leaver(91, 300), leaver(90, 300), active(300)];
    const [row] = earlyExitRates(people, ASOF, () => 'all');
    expect(row).toMatchObject({ hires: 3, leftEarly: 1 });
  });

  it('gives an undefined rate (not NaN) when no hire is old enough, sorted last', () => {
    const people = [active(10, { department: 'young' }), leaver(5, 200, { department: 'old' })];
    const rates = earlyExitRates(people, ASOF, dept);
    expect(rates.map((r) => r.key)).toEqual(['old', 'young']);
    expect(rates[1]).toMatchObject({ hires: 0, leftEarly: 0, rate: undefined, fewData: true });
  });

  it('sorts by rate descending', () => {
    const people = [
      leaver(10, 200, { department: 'a' }),
      active(200, { department: 'a' }),
      leaver(10, 200, { department: 'b' }),
    ];
    expect(earlyExitRates(people, ASOF, dept).map((r) => r.key)).toEqual(['b', 'a']);
  });

  it('returns nothing for an empty list', () => {
    expect(earlyExitRates([], ASOF, dept)).toEqual([]);
  });
});

describe('buildHistoryBoard', () => {
  it('lists only active employees in days 0..90 with their department rate, riskiest group first', () => {
    const risky = Array.from({ length: 10 }, (_, i) =>
      i < 5 ? leaver(20, 200, { department: 'store' }) : active(200, { department: 'store' }),
    );
    const calm = Array.from({ length: 10 }, () => active(200, { department: 'office' }));
    const newStore = active(40, { department: 'store', fullName: 'Новый Магазин' });
    const newOffice = active(3, { department: 'office', fullName: 'Новый Офис' });
    const old = active(120, { department: 'store' });
    const gone = leaver(10, 30, { department: 'store' });
    const future = makeEmployee({ hireDate: addDays(ASOF, 3), department: 'store' });

    const board = buildHistoryBoard([...risky, ...calm, newStore, newOffice, old, gone, future], ASOF);
    expect(board.map((r) => r.employee.fullName)).toEqual(['Новый Магазин', 'Новый Офис']);
    // store cohort: 10 hires + the 120-day employee (eligible too), 5 early exits
    expect(board[0]).toMatchObject({ tenureDay: 40, fewData: false });
    expect(board[0]?.groupRate).toBeCloseTo(5 / 11, 10);
    expect(board[1]).toMatchObject({ tenureDay: 3, groupRate: 0, fewData: false });
  });

  it('marks fewData and an undefined rate for a department without history, ties by tenure', () => {
    const a = active(50, { department: 'x', fullName: 'A' });
    const b = active(10, { department: 'x', fullName: 'B' });
    const board = buildHistoryBoard([a, b], ASOF);
    expect(board.map((r) => r.employee.fullName)).toEqual(['B', 'A']);
    expect(board[0]).toMatchObject({ groupRate: undefined, fewData: true });
  });
});

describe('survivalKnownAt', () => {
  it('is undefined on days where nobody is left at risk, a number otherwise', () => {
    const curve = survivalCurve([leaver(10, 200), active(40)], ASOF, 180);
    expect(survivalKnownAt(curve, 30)).toBeCloseTo(0.5, 10);
    expect(survivalKnownAt(curve, 90)).toBeUndefined();
    expect(survivalKnownAt([], 5)).toBeUndefined();
  });
});
