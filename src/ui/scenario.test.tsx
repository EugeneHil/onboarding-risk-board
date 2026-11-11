import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEMO_AS_OF, DEMO_EMPLOYEES } from '../data/demo';
import { makeTask } from '../test/factories';
import { App } from './App';
import { taskState, Timeline } from './Timeline';

beforeEach(() => {
  window.location.hash = '';
});

describe('main scenario: board -> card -> Bitrix24 task -> back', () => {
  it('walks the whole path', async () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    const firstRow = within(screen.getByRole('table')).getAllByRole('row')[1] as HTMLElement;
    const name = (within(firstRow).getByRole('button') as HTMLElement).textContent as string;

    await userEvent.click(within(firstRow).getByRole('button'));

    expect(await screen.findByRole('heading', { level: 1, name })).toBeInTheDocument();
    const reasons = screen.getByRole('region', { name: 'Причины риска' });
    expect(within(reasons).getAllByRole('listitem').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('region', { name: 'Что сделать' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Создать задачу в Битрикс24' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('tasks.task.add');
    expect(dialog).toHaveTextContent(name);

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /К списку/ }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('shows a not-found view with a way back for an unknown id', async () => {
    window.location.hash = '#/employee/does-not-exist';
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    expect(
      await screen.findByRole('heading', { level: 1, name: /Сотрудник не найден/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/первых 90 дней/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /К списку/ })).toBeInTheDocument();
  });

  it('scrolls to the top and focuses the heading when a card opens', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    const firstRow = within(screen.getByRole('table')).getAllByRole('row')[1] as HTMLElement;
    await userEvent.click(within(firstRow).getByRole('button'));
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(document.activeElement).toBe(heading);
    scrollTo.mockRestore();
  });
});

describe('taskState', () => {
  it('classifies done, overdue and upcoming tasks', () => {
    expect(taskState(makeTask({ dueDay: 3, status: 'done', completedOn: '2026-11-01' }), 20)).toBe('done');
    expect(taskState(makeTask({ dueDay: 3 }), 20)).toBe('overdue');
    expect(taskState(makeTask({ dueDay: 20 }), 20)).toBe('upcoming');
    expect(taskState(makeTask({ dueDay: 30 }), 20)).toBe('upcoming');
  });
});

describe('Timeline', () => {
  it('labels every task with its state in text, not only by colour', () => {
    const tasks = [
      makeTask({ title: 'Первая', dueDay: 1, status: 'done', completedOn: '2026-11-02' }),
      makeTask({ title: 'Вторая', dueDay: 5 }),
      makeTask({ title: 'Третья', dueDay: 60 }),
    ];
    render(<Timeline tasks={tasks} tenureDay={20} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText(/Первая.*Выполнено/)).toBeInTheDocument();
    expect(screen.getByText(/Вторая.*Просрочено/)).toBeInTheDocument();
    expect(screen.getByText(/Третья.*Впереди/)).toBeInTheDocument();
  });
});
