import { buildBoard } from '../domain/board';
import { daysBetween } from '../domain/dates';
import { DEMO_AS_OF, DEMO_EMPLOYEES } from './demo';
import { generateEmployees } from './generate';
import { createRng } from './rng';

describe('createRng', () => {
  it('is deterministic and stays in [0, 1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('generateEmployees', () => {
  it('is deterministic per seed and differs between seeds', () => {
    expect(generateEmployees(1, DEMO_AS_OF)).toEqual(generateEmployees(1, DEMO_AS_OF));
    expect(generateEmployees(1, DEMO_AS_OF)).not.toEqual(generateEmployees(2, DEMO_AS_OF));
  });

  it('produces 120 employees with unique ids, names and sane task days', () => {
    const list = generateEmployees(7, DEMO_AS_OF);
    expect(list).toHaveLength(120);
    expect(new Set(list.map((e) => e.id)).size).toBe(120);
    for (const e of list) {
      expect(e.fullName.trim().length).toBeGreaterThan(0);
      for (const t of e.tasks) expect(t.dueDay).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives every employee a distinct full name', () => {
    const names = DEMO_EMPLOYEES.map((e) => e.fullName);
    expect(new Set(names).size).toBe(names.length);
    const other = generateEmployees(7, DEMO_AS_OF).map((e) => e.fullName);
    expect(new Set(other).size).toBe(other.length);
  });

  it('keeps dates consistent', () => {
    for (const e of DEMO_EMPLOYEES) {
      expect(daysBetween(e.hireDate, DEMO_AS_OF)).toBeGreaterThanOrEqual(0);
      if (e.status === 'left') {
        expect(e.leaveDate).toBeDefined();
        expect(daysBetween(e.hireDate, e.leaveDate as string)).toBeGreaterThanOrEqual(0);
        expect(daysBetween(e.leaveDate as string, DEMO_AS_OF)).toBeGreaterThanOrEqual(0);
      }
      for (const t of e.tasks) {
        if (t.status === 'done') {
          expect(t.completedOn).toBeDefined();
          expect(daysBetween(e.hireDate, t.completedOn as string)).toBeGreaterThanOrEqual(0);
          expect(daysBetween(t.completedOn as string, DEMO_AS_OF)).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('has about one in three leavers quitting within 90 days', () => {
    const leavers = DEMO_EMPLOYEES.filter((e) => e.status === 'left');
    const early = leavers.filter(
      (e) => daysBetween(e.hireDate, e.leaveDate as string) <= 90,
    );
    const share = early.length / leavers.length;
    expect(share).toBeGreaterThanOrEqual(0.25);
    expect(share).toBeLessThanOrEqual(0.45);
  });

  it('yields a demo board with a useful spread of risk levels', () => {
    const rows = buildBoard(DEMO_EMPLOYEES, DEMO_AS_OF);
    expect(rows.length).toBeGreaterThanOrEqual(20);
    expect(rows.length).toBeLessThanOrEqual(45);
    for (const level of ['high', 'medium', 'low'] as const) {
      expect(rows.filter((r) => r.risk.level === level).length).toBeGreaterThanOrEqual(5);
    }
  });
});
