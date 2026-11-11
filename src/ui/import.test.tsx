import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEMO_AS_OF, DEMO_EMPLOYEES } from '../data/demo';
import { addDays } from '../domain/dates';
import { makeEmployee, makeTask } from '../test/factories';
import { App } from './App';

const PEOPLE = [
  'ФИО;Должность;Подразделение;Дата приёма;Дата увольнения',
  'Иванов Иван;Кладовщик;Склад;01.10.2026;',
  'Петрова Анна;Кассир;Магазин;20.10.2026;',
  'Сидоров Олег;Кладовщик;Склад;01.03.2026;15.04.2026',
].join('\r\n');

const PEOPLE_WITH_BAD_ROW = `${PEOPLE}\r\n;Кассир;Магазин;05.11.2026;`;

const TASKS = [
  'ФИО;Название;due_day;completed_on',
  'Иванов Иван;Встреча с наставником;7;',
  'Иванов Иван;Оформление документов;3;03.10.2026',
].join('\r\n');

const csv = (name: string, text: string) => new File([text], name, { type: 'text/csv' });

beforeEach(() => {
  window.location.hash = '#/import';
});

async function uploadPeople(text = PEOPLE) {
  await userEvent.upload(screen.getByLabelText(/Таблица сотрудников/), csv('people.csv', text));
}

async function uploadTasks(text = TASKS) {
  await userEvent.upload(screen.getByLabelText(/Задачи адаптации/), csv('tasks.csv', text));
}

describe('import screen', () => {
  it('says that files are processed in the browser only', () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    expect(screen.getByText(/только в браузере/)).toBeTruthy();
  });

  it('reads a semicolon CSV with Russian headers and reports the imported count', async () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    await uploadPeople();
    expect(await screen.findByText('Импортировано: 3')).toBeTruthy();
    expect(screen.getByText('Пропущено: 0')).toBeTruthy();
  });

  it('proposes the latest date found in the file as the as-of date', async () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    await uploadPeople();
    await screen.findByText('Импортировано: 3');
    expect((screen.getByLabelText(/Данные на дату/) as HTMLInputElement).value).toBe('2026-10-20');
  });

  it('reports a skipped row with its number and reason, and keeps the rest', async () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    await uploadPeople(PEOPLE_WITH_BAD_ROW);
    expect(await screen.findByText('Импортировано: 3')).toBeTruthy();
    expect(screen.getByText('Пропущено: 1')).toBeTruthy();
    expect(screen.getByText(/Строка 5:.*нет ФИО/)).toBeTruthy();
  });

  it('shows an error instead of crashing on an unusable file', async () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    await uploadPeople('{"broken": ');
    expect((await screen.findByRole('alert')).textContent).toMatch(/JSON/);
    expect(screen.getByRole('button', { name: 'Использовать эти данные' }).hasAttribute('disabled')).toBe(true);
  });
});

describe('using imported data', () => {
  it('without tasks, shows the history view with an explanation and no risk levels', async () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    await uploadPeople();
    await screen.findByText('Импортировано: 3');
    await userEvent.click(screen.getByRole('button', { name: 'Использовать эти данные' }));

    expect(await screen.findByText(/Иванов Иван/)).toBeTruthy();
    expect(screen.getByText(/нет задач адаптации/)).toBeTruthy();
    expect(screen.queryByText('Высокий')).toBeNull();
    expect(screen.queryByText('Средний')).toBeNull();
    expect(screen.queryByText(/Демо-данные/)).toBeNull();
    expect(screen.getByText(/Загруженные данные/)).toBeTruthy();
  });

  it('with a tasks file, shows the rule-based board with risk levels', async () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    await uploadPeople();
    await uploadTasks();
    await screen.findByText(/Задачи: импортировано 2/);
    await userEvent.click(screen.getByRole('button', { name: 'Использовать эти данные' }));

    const table = await screen.findByRole('table', { name: 'Доска риска' });
    expect(within(table).getByText(/Иванов Иван/)).toBeTruthy();
    expect(within(table).getAllByText(/Высокий|Средний|Низкий/).length).toBeGreaterThan(0);
    // the other imported person has no tasks: no risk for them, listed by department history
    expect(within(table).queryByText(/Петрова Анна/)).toBeNull();
    expect(screen.getByText(/нет задач адаптации/)).toBeTruthy();
  });

  it('reports a task for an unknown employee', async () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    await uploadPeople();
    await uploadTasks('ФИО;Название;due_day\nНе Существует;Документы;1');
    expect(await screen.findByText(/не найден/)).toBeTruthy();
  });

  it('"Вернуться к демо" restores the demo board and banner', async () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    await uploadPeople();
    await screen.findByText('Импортировано: 3');
    await userEvent.click(screen.getByRole('button', { name: 'Использовать эти данные' }));
    await screen.findByText(/Загруженные данные/);

    window.location.hash = '#/import';
    await userEvent.click(await screen.findByRole('button', { name: 'Вернуться к демо' }));
    expect(await screen.findByText(/Демо-данные/)).toBeTruthy();
    expect(screen.queryByText(/Загруженные данные/)).toBeNull();
    expect(await screen.findByRole('table')).toBeTruthy();
  });

  it('analytics reflects the imported dataset', async () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    await uploadPeople();
    await screen.findByText('Импортировано: 3');
    await userEvent.click(screen.getByRole('button', { name: 'Использовать эти данные' }));
    await userEvent.click(await screen.findByRole('link', { name: 'Аналитика' }));
    const table = await screen.findByRole('table', { name: /подразделени/i });
    expect(within(table).getByText('Склад')).toBeTruthy();
    expect(within(table).queryByText('Магазин')).toBeTruthy();
  });
});

describe('people without onboarding tasks', () => {
  const ASOF = '2026-11-11';
  const withTasks = makeEmployee({
    id: 'T1',
    fullName: 'Сзадачами Анна',
    hireDate: addDays(ASOF, -20),
    tasks: [makeTask({ kind: 'docs', dueDay: 3, status: 'open' })],
  });
  const without = makeEmployee({ id: 'N1', fullName: 'Безздач Борис', hireDate: addDays(ASOF, -10) });

  beforeEach(() => {
    window.location.hash = '';
  });

  it('gets no rule-based risk: listed in the history view, not on the risk board', () => {
    render(<App employees={[withTasks, without]} asOf={ASOF} />);
    const board = screen.getByRole('table', { name: /Доска риска/ });
    expect(within(board).getByText('Сзадачами Анна')).toBeTruthy();
    expect(within(board).queryByText('Безздач Борис')).toBeNull();
    expect(screen.getByText(/нет задач адаптации/)).toBeTruthy();
    expect(screen.getByText('Безздач Борис')).toBeTruthy();
  });

  it('has no risk card behind a direct link', () => {
    window.location.hash = '#/employee/N1';
    render(<App employees={[withTasks, without]} asOf={ASOF} />);
    expect(screen.getByRole('heading', { level: 1, name: /Сотрудник не найден/ })).toBeTruthy();
  });
});

describe('import problems that must be visible', () => {
  beforeEach(() => {
    window.location.hash = '#/import';
  });

  it('shows the missing-column message when the file has no readable hire date', async () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    await uploadPeople('ФИО;Должность\nИванов Иван;Кладовщик');
    expect((await screen.findByRole('alert')).textContent).toMatch(/дата приёма/i);
  });

  it('shows a message when no hire date can be read at all', async () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    await uploadPeople('ФИО;Дата приёма\nИванов Иван;вчера');
    expect((await screen.findByRole('alert')).textContent).toMatch(/дат/i);
  });

  it('never proposes a data date in the future', async () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    await uploadPeople('ФИО;Дата приёма;Дата увольнения\nИванов Иван;01.09.2026;01.01.2099');
    await screen.findByText(/Импортировано/);
    const value = (screen.getByLabelText(/Данные на дату/) as HTMLInputElement).value;
    expect(value <= new Date().toISOString().slice(0, 10)).toBe(true);
    expect(value).not.toBe('');
  });

  it('shows the imported dataset on the analytics screen (numbers that only the import has)', async () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    await uploadPeople();
    await screen.findByText('Импортировано: 3');
    await userEvent.click(screen.getByRole('button', { name: 'Использовать эти данные' }));
    await userEvent.click(await screen.findByRole('link', { name: 'Аналитика' }));
    const facts = await screen.findByRole('region', { name: 'Главные цифры' });
    expect(within(facts).getByText('3')).toBeTruthy(); // 3 hires, the demo has 120
    expect(screen.getByRole('table', { name: /должност/i }).textContent).toMatch(/Кассир/);
  });
});

describe('department filter with people without a department', () => {
  it('"Не указано" shows only them, not everyone', async () => {
    const ASOF2 = '2026-11-11';
    const mk = (name: string, department: string) =>
      makeEmployee({ fullName: name, department, hireDate: addDays(ASOF2, -20), tasks: [makeTask({ dueDay: 3 })] });
    window.location.hash = '';
    render(<App employees={[mk('Безотдела Иван', ''), mk('Складов Пётр', 'warehouse')]} asOf={ASOF2} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Подразделение' }), 'Не указано');
    const board = screen.getByRole('table', { name: 'Доска риска' });
    expect(within(board).getByText('Безотдела Иван')).toBeTruthy();
    expect(within(board).queryByText('Складов Пётр')).toBeNull();
  });
});

describe('overlapping file loads', () => {
  beforeEach(() => {
    window.location.hash = '#/import';
  });

  it('keeps the result of the file chosen last even if an earlier, slower file finishes after it', async () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    const slow = csv('slow.csv', 'ФИО;Дата приёма\nМедленный Иван;01.10.2026\nВторой Человек;02.10.2026');
    const bytes = new TextEncoder().encode('ФИО;Дата приёма\nМедленный Иван;01.10.2026\nВторой Человек;02.10.2026');
    Object.defineProperty(slow, 'arrayBuffer', {
      value: () => new Promise((r) => setTimeout(() => r(bytes.buffer), 150)),
    });
    const input = screen.getByLabelText(/Таблица сотрудников/);
    await userEvent.upload(input, slow);
    await userEvent.upload(input, csv('fast.csv', 'ФИО;Дата приёма\nБыстрый Пётр;03.10.2026'));
    await screen.findByText('Импортировано: 1');
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.getByText('Импортировано: 1')).toBeTruthy();
    expect(screen.queryByText('Импортировано: 2')).toBeNull();
  });
});
