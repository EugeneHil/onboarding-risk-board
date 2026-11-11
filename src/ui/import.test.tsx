import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEMO_AS_OF, DEMO_EMPLOYEES } from '../data/demo';
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
    expect(screen.getByText(/Строка 4:.*нет ФИО/)).toBeTruthy();
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

    const table = await screen.findByRole('table');
    expect(within(table).getByText(/Иванов Иван/)).toBeTruthy();
    expect(screen.queryByText(/нет задач адаптации/)).toBeNull();
    expect(screen.getAllByText(/Высокий|Средний|Низкий/).length).toBeGreaterThan(0);
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
