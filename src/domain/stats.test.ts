import { addDays } from './dates';
import { levelCounts, leaversByTenure } from './stats';
import { evaluateRisk } from './rules';
import { makeEmployee } from '../test/factories';
import type { BoardRow } from './types';

const HIRE = '2026-01-01';
const left = (tenure: number) =>
  makeEmployee({ hireDate: HIRE, status: 'left', leaveDate: addDays(HIRE, tenure) });

describe('leaversByTenure', () => {
  it('puts boundary tenures into the right buckets', () => {
    const buckets = leaversByTenure([left(14), left(15), left(90), left(91)]);
    const byLabel = Object.fromEntries(buckets.map((b) => [b.label, b.count]));
    expect(byLabel).toEqual({ '0-14': 1, '15-30': 1, '31-60': 0, '61-90': 1, '91+': 1 });
  });

  it('ignores active employees', () => {
    const buckets = leaversByTenure([makeEmployee({ hireDate: HIRE })]);
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });

  it('always returns all five buckets in order', () => {
    expect(leaversByTenure([]).map((b) => b.label)).toEqual([
      '0-14',
      '15-30',
      '31-60',
      '61-90',
      '91+',
    ]);
  });
});

describe('levelCounts', () => {
  it('sums to the number of rows', () => {
    const asOf = '2026-11-11';
    const rows: BoardRow[] = [0, 5, 20, 40].map((d) => {
      const employee = makeEmployee({ hireDate: addDays(asOf, -d) });
      return { employee, risk: evaluateRisk(employee, asOf) };
    });
    const c = levelCounts(rows);
    expect(c.high + c.medium + c.low).toBe(rows.length);
  });

  it('returns zeros for an empty board', () => {
    expect(levelCounts([])).toEqual({ high: 0, medium: 0, low: 0 });
  });
});
