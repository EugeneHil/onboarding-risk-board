import { useEffect, useMemo, useState } from 'react';
import { buildHistoryBoard } from '../domain/attrition';
import { buildBoard } from '../domain/board';
import { formatRu } from '../domain/dates';
import { leaversByTenure } from '../domain/stats';
import type { Employee, ISODate, RiskLevel } from '../domain/types';
import { BoardTable } from './BoardTable';
import { boardToCsv } from './exportCsv';
import { downloadText } from './download';
import { EmployeeCard } from './EmployeeCard';
import { departmentLabel, departmentsOf } from './labels';
import { AnalyticsScreen } from './AnalyticsScreen';
import { Nav } from './Nav';
import { HistoryBoard } from './HistoryBoard';
import { ImportScreen, type Dataset } from './ImportScreen';
import { Summary } from './Summary';
import { useHashRoute } from './useHashRoute';

export interface AppProps {
  employees: Employee[];
  asOf: ISODate;
}

const BOARD_TITLE = 'Адаптация новичков: доска риска';
const SUFFIX = 'Адаптация новичков';

// '' means "all", so people without a department get their own option value.
const NO_DEPARTMENT = '\u0000none';

const norm = (s: string) => s.toLocaleLowerCase('ru').replace(/ё/g, 'е');

export function App({ employees: demoEmployees, asOf: demoAsOf }: AppProps) {
  const { route, navigate } = useHashRoute();
  const [dataset, setDataset] = useState<Dataset>({
    employees: demoEmployees,
    asOf: demoAsOf,
    source: 'demo',
  });
  const { employees, asOf, source } = dataset;
  // Rule-based risk only for people who have onboarding tasks; the rest would get an invented
  // "no mentor meeting". They are listed by their department's history instead.
  const withTasks = useMemo(() => employees.filter((e) => e.tasks.length > 0), [employees]);
  const hasTasks = withTasks.length > 0;
  const history = useMemo(
    () =>
      buildHistoryBoard(
        employees.filter((e) => e.tasks.length === 0),
        asOf,
      ),
    [employees, asOf],
  );

  const useDataset = (d: Dataset) => {
    setDataset(d);
    setDepartment('');
    setLevel(null);
    setQuery('');
    navigate('#/');
  };
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState<RiskLevel | null>(null);
  const [query, setQuery] = useState('');
  const deptValue = department === NO_DEPARTMENT ? '' : department;

  const board = useMemo(() => buildBoard(withTasks, asOf), [withTasks, asOf]);
  const departments = useMemo(() => departmentsOf(employees), [employees]);
  const leavers = useMemo(
    () =>
      leaversByTenure(
        department === '' ? employees : employees.filter((e) => e.department === deptValue),
      ),
    [employees, department, deptValue],
  );
  const openRow = route.name === 'employee' ? board.find((r) => r.employee.id === route.id) : undefined;
  const openName = openRow?.employee.fullName;

  useEffect(() => {
    if (route.name === 'analytics') document.title = `Аналитика ухода · ${SUFFIX}`;
    else if (route.name === 'import') document.title = `Свои данные · ${SUFFIX}`;
    else document.title = openName ? `${openName} · ${SUFFIX}` : BOARD_TITLE;
  }, [route.name, openName]);

  const scoped = board.filter(
    ({ employee }) =>
      (department === '' || employee.department === deptValue) &&
      (query.trim() === '' ||
        norm(`${employee.fullName} ${employee.position}`).includes(norm(query.trim()))),
  );
  const visible = level ? scoped.filter((r) => r.risk.level === level) : scoped;

  const banner = (
    <div className="banner" role="note">
      {source === 'demo'
        ? `Демо-данные: все люди выдуманные. Данные на ${formatRu(asOf)}.`
        : `Загруженные данные: обработаны в вашем браузере. Данные на ${formatRu(asOf)}.`}
    </div>
  );

  if (route.name === 'analytics') {
    return (
      <main className="app">
        {banner}
        <Nav active="analytics" />
        <AnalyticsScreen employees={employees} asOf={asOf} synthetic={source === 'demo'} />
      </main>
    );
  }

  if (route.name === 'import') {
    return (
      <main className="app">
        {banner}
        <Nav active="import" />
        <ImportScreen
          source={source}
          onUse={useDataset}
          onReset={() => useDataset({ employees: demoEmployees, asOf: demoAsOf, source: 'demo' })}
        />
      </main>
    );
  }

  if (route.name === 'employee') {
    const row = openRow;
    return (
      <main className="app">
        {banner}
        {row ? (
          <EmployeeCard employee={row.employee} asOf={asOf} onBack={() => navigate('#/')} />
        ) : (
          <div className="empty">
            <h1>Сотрудник не найден</h1>
            <p>
              Его нет на доске: возможно, он уже вышел за пределы первых 90 дней, уволился или
              ссылка устарела.
            </p>
            <a href="#/">← К списку</a>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="app">
      {banner}
      <Nav active="board" />
      <header>
        <h1>Новички: кто в зоне риска</h1>
        <p className="lead">
          Первые 90 дней в компании. Список строится по задачам адаптации, правила риска простые и
          прозрачные: у каждого балла есть причина.
        </p>
      </header>
      {!hasTasks ? (
        <HistoryBoard rows={history} />
      ) : (
        <>
      <Summary rows={scoped} leavers={leavers} activeLevel={level} onLevel={setLevel} />
      <div className="filters">
        <label>
          Подразделение
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">Все</option>
            {departments.map((d) => (
              <option key={d} value={d === '' ? NO_DEPARTMENT : d}>
                {departmentLabel(d)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Поиск
          <input
            type="search"
            value={query}
            placeholder="Фамилия или должность"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {visible.length > 0 && (
          <button type="button" className="secondary" onClick={() => downloadText('onboarding-risk-board.csv', boardToCsv(visible))}>
            Скачать список (CSV)
          </button>
        )}
      </div>
      <BoardTable rows={visible} onOpen={(id) => navigate(`#/employee/${encodeURIComponent(id)}`)} />
          {history.length > 0 && <HistoryBoard rows={history} />}
        </>
      )}
      <p className="footnote">
        Допущение: в Битрикс24 есть цепочка задач адаптации (встреча с наставником, разговор
        руководителя и т. д.). В задании сказано только про задачи приёма и увольнения, поэтому
        это нужно проверить на ваших данных.
      </p>
    </main>
  );
}
