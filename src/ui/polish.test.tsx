import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEMO_AS_OF, DEMO_EMPLOYEES } from '../data/demo';
import { buildBitrixTask } from '../domain/bitrix';
import { addDays } from '../domain/dates';
import { evaluateRisk } from '../domain/rules';
import { makeEmployee, makeTask } from '../test/factories';
import { App } from './App';
import { BitrixModal } from './BitrixModal';

const ASOF = '2026-11-11';

beforeEach(() => {
  window.location.hash = '';
});

function modalFor() {
  const employee = makeEmployee({ fullName: 'Тестов Тест', hireDate: addDays(ASOF, -20) });
  return buildBitrixTask(employee, evaluateRisk(employee, ASOF), ASOF);
}

describe('Bitrix24 dialog behaviour', () => {
  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    render(<BitrixModal payload={modalFor()} onClose={() => {}} />);
    const copy = screen.getByRole('button', { name: 'Скопировать' });
    const close = screen.getByRole('button', { name: 'Закрыть' });
    expect(document.activeElement).toBe(close);
    await userEvent.tab();
    expect(document.activeElement).toBe(copy);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(close);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(copy);
  });

  it('closes only when both press and release happen on the backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(<BitrixModal payload={modalFor()} onClose={onClose} />);
    const backdrop = container.querySelector('.modal-backdrop') as HTMLElement;
    const dialog = screen.getByRole('dialog');

    // drag-select inside the dialog and release over the backdrop: must stay open
    fireEvent.mouseDown(dialog);
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('card and dialog focus', () => {
  it('returns focus to the "create task" button when the dialog closes', async () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    const firstRow = within(screen.getByRole('table')).getAllByRole('row')[1] as HTMLElement;
    await userEvent.click(within(firstRow).getByRole('button'));
    const trigger = await screen.findByRole('button', { name: 'Создать задачу в Битрикс24' });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('page title', () => {
  it('names the open card and goes back to the board title', async () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    const boardTitle = document.title;
    expect(boardTitle).toBe('Адаптация новичков: доска риска');
    const firstRow = within(screen.getByRole('table')).getAllByRole('row')[1] as HTMLElement;
    const name = within(firstRow).getByRole('button').textContent as string;
    await userEvent.click(within(firstRow).getByRole('button'));
    await screen.findByRole('heading', { level: 2, name });
    expect(document.title).toBe(`${name} · Адаптация новичков`);
    await userEvent.click(screen.getByRole('button', { name: /К списку/ }));
    await screen.findByRole('table');
    expect(document.title).toBe(boardTitle);
  });
});

describe('leavers chart', () => {
  const leaver = (department: 'warehouse' | 'store', tenure: number) =>
    makeEmployee({
      department,
      hireDate: '2026-01-01',
      status: 'left',
      leaveDate: addDays('2026-01-01', tenure),
    });
  // one task somewhere: a dataset without any onboarding tasks shows the history view instead
  const FIXTURE = [leaver('warehouse', 10), leaver('store', 40), leaver('store', 100)];
  FIXTURE[0] = { ...FIXTURE[0]!, tasks: [makeTask()] };
  const bars = () =>
    within(screen.getByRole('figure'))
      .getAllByRole('listitem')
      .map((li) => li.textContent);

  it('follows the department filter', async () => {
    render(<App employees={FIXTURE} asOf={ASOF} />);
    expect(bars()).toEqual(['0-141', '15-300', '31-601', '61-900', '91+1']);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Подразделение' }), 'warehouse');
    expect(bars()).toEqual(['0-141', '15-300', '31-600', '61-900', '91+0']);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Подразделение' }), 'store');
    expect(bars()).toEqual(['0-140', '15-300', '31-601', '61-900', '91+1']);
  });
});
