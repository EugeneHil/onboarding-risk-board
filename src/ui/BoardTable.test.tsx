import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEMO_AS_OF, DEMO_EMPLOYEES } from '../data/demo';
import { addDays } from '../domain/dates';
import { makeEmployee, makeTask } from '../test/factories';
import { App } from './App';

const ASOF = '2026-11-11';
const hired = (n: number) => addDays(ASOF, -n);

const FIXTURE = [
  makeEmployee({ id: 'a', fullName: 'Иванов Иван', department: 'warehouse', hireDate: hired(20) }),
  makeEmployee({ id: 'b', fullName: 'Петров Пётр', department: 'store', hireDate: hired(40) }),
  makeEmployee({ id: 'c', fullName: 'Сидорова Анна', department: 'store', hireDate: hired(3) }),
  makeEmployee({
    id: 'd',
    fullName: 'Козлов Олег',
    department: 'warehouse',
    hireDate: hired(30),
    tasks: [makeTask({ dueDay: 2 })],
  }),
];

const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

beforeEach(() => {
  window.location.hash = '';
});

describe('board screen', () => {
  it('lists the riskiest newcomer first', () => {
    render(<App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />);
    expect(bodyRows()[0]).toHaveTextContent('Высокий');
  });

  it('states the data assumption under the board', () => {
    render(<App employees={FIXTURE} asOf={ASOF} />);
    expect(screen.getByText(/Допущение/)).toBeInTheDocument();
  });

  it('always shows the demo-data banner', () => {
    render(<App employees={FIXTURE} asOf={ASOF} />);
    expect(screen.getByText(/Демо-данные/)).toBeInTheDocument();
  });

  it('searches names case-insensitively in Cyrillic', async () => {
    render(<App employees={FIXTURE} asOf={ASOF} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Поиск' }), 'иванов');
    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0]).toHaveTextContent('Иванов Иван');
  });

  it('treats "е" and "ё" as the same letter in search', async () => {
    const withYo = [
      makeEmployee({ id: 'y', fullName: 'Семёнова Анна', hireDate: hired(20) }),
      makeEmployee({ id: 'z', fullName: 'Петров Пётр', hireDate: hired(20) }),
    ];
    render(<App employees={withYo} asOf={ASOF} />);
    const box = screen.getByRole('searchbox', { name: 'Поиск' });
    await userEvent.type(box, 'семенова');
    expect(bodyRows()).toHaveLength(1);
    await userEvent.clear(box);
    await userEvent.type(box, 'петров петр');
    expect(bodyRows()).toHaveLength(1);
    await userEvent.clear(box);
    await userEvent.type(box, 'семёнова');
    expect(bodyRows()).toHaveLength(1);
  });

  it('shows an empty state when nothing matches', async () => {
    render(<App employees={FIXTURE} asOf={ASOF} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Поиск' }), 'zzz');
    expect(screen.getByText('Никого не найдено')).toBeInTheDocument();
  });

  it('filters by department', async () => {
    render(<App employees={FIXTURE} asOf={ASOF} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Подразделение' }), 'warehouse');
    expect(bodyRows()).toHaveLength(2);
    bodyRows().forEach((r) => expect(r).toHaveTextContent('Склад'));
  });

  it('toggles the risk-level filter from the summary tiles', async () => {
    render(<App employees={FIXTURE} asOf={ASOF} />);
    const all = bodyRows().length;
    const tile = screen.getByRole('button', { name: /Высокий/ });
    await userEvent.click(tile);
    expect(bodyRows().length).toBeLessThan(all);
    bodyRows().forEach((r) => expect(r).toHaveTextContent('Высокий'));
    await userEvent.click(tile);
    expect(bodyRows()).toHaveLength(all);
  });
});
