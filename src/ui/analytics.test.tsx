import { render, screen, within } from '@testing-library/react';
import { DEMO_AS_OF, DEMO_EMPLOYEES } from '../data/demo';
import { addDays } from '../domain/dates';
import { earlyExitRates } from '../domain/attrition';
import { makeEmployee } from '../test/factories';
import { AnalyticsScreen } from './AnalyticsScreen';
import { App } from './App';
import { parseHash } from './useHashRoute';

const ASOF = '2026-11-11';

beforeEach(() => {
  window.location.hash = '';
});

describe('routes', () => {
  it('parses #/analytics and #/import', () => {
    expect(parseHash('#/analytics')).toEqual({ name: 'analytics' });
    expect(parseHash('#/import')).toEqual({ name: 'import' });
    expect(parseHash('#/')).toEqual({ name: 'board' });
  });
});

describe('AnalyticsScreen on the demo data', () => {
  it('shows the survival chart with its values for days 30, 90 and 180', () => {
    render(<AnalyticsScreen employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    const chart = screen.getByRole('img', { name: /90/ });
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/30/);
    expect(label).toMatch(/180/);
    expect(label).toMatch(/\d+%/);
  });

  it('lists departments with the highest early-exit rate first', () => {
    render(<AnalyticsScreen employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    const table = screen.getByRole('table', { name: /подразделени/i });
    const rows = within(table).getAllByRole('row').slice(1);
    const expected = earlyExitRates(DEMO_EMPLOYEES, DEMO_AS_OF, (e) => e.department).filter(
      (r) => r.hires > 0,
    )[0] as { rate: number };
    expect(rows.length).toBeGreaterThan(1);
    expect(within(rows[0] as HTMLElement).getByText(`${Math.round(expected.rate * 100)}%`)).toBeTruthy();
  });

  it('explains the method: Kaplan-Meier and complete cohorts only', () => {
    render(<AnalyticsScreen employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    expect(screen.getByText(/Каплан/i)).toBeTruthy();
    expect(screen.getByText(/полные когорты|только те, кто принят не позднее/i)).toBeTruthy();
  });
});

describe('AnalyticsScreen edge cases', () => {
  const old = (dept: string, left: boolean) =>
    makeEmployee({
      department: dept,
      hireDate: addDays(ASOF, -200),
      ...(left ? { status: 'left' as const, leaveDate: addDays(ASOF, -150) } : {}),
    });

  it('labels a group of fewer than 10 hires "мало данных" instead of a confident percentage', () => {
    const people = [old('tiny', true), old('tiny', false), old('tiny', false)];
    render(<AnalyticsScreen employees={people} asOf={ASOF} />);
    const table = screen.getByRole('table', { name: /подразделени/i });
    const row = within(table).getByText('tiny').closest('tr') as HTMLElement;
    expect(within(row).getByText(/мало данных/)).toBeTruthy();
  });

  it('shows a dash, never NaN, for a group with no eligible hires', () => {
    const people = [makeEmployee({ department: 'fresh', hireDate: addDays(ASOF, -5) }), old('x', false)];
    const { container } = render(<AnalyticsScreen employees={people} asOf={ASOF} />);
    const row = within(screen.getByRole('table', { name: /подразделени/i }))
      .getByText('fresh')
      .closest('tr') as HTMLElement;
    expect(within(row).getByText('—')).toBeTruthy();
    expect(container.textContent).not.toMatch(/NaN/);
  });

  it('does not crash on an empty dataset', () => {
    const { container } = render(<AnalyticsScreen employees={[]} asOf={ASOF} />);
    expect(container.textContent).not.toMatch(/NaN/);
  });
});

describe('AnalyticsScreen does not state numbers nobody observed', () => {
  const few = [
    makeEmployee({ hireDate: addDays(ASOF, -200), status: 'left' as const, leaveDate: addDays(ASOF, -170) }),
    makeEmployee({ hireDate: addDays(ASOF, -100) }),
    makeEmployee({ hireDate: addDays(ASOF, -45) }),
  ];

  it('shows a dash instead of 0% survival when nobody is observed at day 90', () => {
    render(<AnalyticsScreen employees={few} asOf={ASOF} />);
    const facts = screen.getByRole('region', { name: 'Главные цифры' });
    expect(facts.textContent).not.toMatch(/0%/);
    expect(facts.textContent).not.toMatch(/100%/);
  });

  it('says "нет данных" in the chart label for days beyond the observed period', () => {
    render(<AnalyticsScreen employees={few} asOf={ASOF} />);
    const label = screen.getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toMatch(/180-й день нет данных/);
  });

  it('does not show the early-exit headline for a cohort under 10 hires', () => {
    const { container } = render(<AnalyticsScreen employees={few} asOf={ASOF} />);
    const tile = container.querySelectorAll('.fact')[3] as HTMLElement;
    expect(tile.textContent).toMatch(/мало данных/);
  });
});

describe('rules backtest block', () => {
  it('shows both flagged shares for the demo and says the check is circular on synthetic data', () => {
    render(<AnalyticsScreen employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} synthetic />);
    const block = screen.getByRole('region', { name: /Проверка правил/ });
    expect(within(block).getByText(/Ушедшие до 90-го дня/)).toBeTruthy();
    expect(within(block).getByText(/Остались/)).toBeTruthy();
    expect(block.textContent).toMatch(/\d+%/);
    expect(block.textContent).toMatch(/круговая/);
    expect(block.textContent).not.toMatch(/NaN/);
  });

  it('does not call the check circular for imported data', () => {
    render(<AnalyticsScreen employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    const block = screen.getByRole('region', { name: /Проверка правил/ });
    expect(block.textContent).not.toMatch(/круговая/);
  });

  it('is hidden when the dataset has no onboarding tasks', () => {
    const people = [
      makeEmployee({ hireDate: addDays(ASOF, -200) }),
      makeEmployee({ hireDate: addDays(ASOF, -150) }),
    ];
    render(<AnalyticsScreen employees={people} asOf={ASOF} />);
    expect(screen.queryByRole('region', { name: /Проверка правил/ })).toBeNull();
  });
});

describe('App routing to analytics', () => {
  it('renders the analytics screen and page title for #/analytics', () => {
    window.location.hash = '#/analytics';
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    expect(screen.getByRole('heading', { name: /Аналитика ухода/ })).toBeTruthy();
    expect(document.title).toBe('Аналитика ухода · Адаптация новичков');
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: /Аналитика/ }).getAttribute('aria-current')).toBe('page');
  });

  it('shows navigation on the board with links to all three screens', () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    const nav = screen.getByRole('navigation');
    expect(within(nav).getAllByRole('link')).toHaveLength(3);
  });
});
