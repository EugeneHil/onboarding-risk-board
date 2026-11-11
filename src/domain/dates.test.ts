import { addDays, daysBetween, formatRu } from './dates';

describe('daysBetween', () => {
  it('counts days inside a month', () => {
    expect(daysBetween('2026-11-01', '2026-11-11')).toBe(10);
  });

  it('crosses a leap-year February boundary', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
  });

  it('is negative when the target is earlier', () => {
    expect(daysBetween('2026-11-11', '2026-11-01')).toBe(-10);
  });
});

describe('addDays', () => {
  it('rolls over a month end', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });

  it('goes backwards across a month start', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('formatRu', () => {
  it('formats as dd.mm.yyyy', () => {
    expect(formatRu('2026-11-05')).toBe('05.11.2026');
  });
});
