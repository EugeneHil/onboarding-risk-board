import { useMemo, useState } from 'react';
import { buildBoard } from '../domain/board';
import { formatRu } from '../domain/dates';
import { leaversByTenure } from '../domain/stats';
import type { Department, Employee, ISODate, RiskLevel } from '../domain/types';
import { BoardTable } from './BoardTable';
import { EmployeeCard } from './EmployeeCard';
import { DEPARTMENT_LABEL } from './labels';
import { Summary } from './Summary';
import { useHashRoute } from './useHashRoute';

export interface AppProps {
  employees: Employee[];
  asOf: ISODate;
}

const norm = (s: string) => s.toLocaleLowerCase('ru').replace(/ё/g, 'е');

export function App({ employees, asOf }: AppProps) {
  const { route, navigate } = useHashRoute();
  const [department, setDepartment] = useState<Department | ''>('');
  const [level, setLevel] = useState<RiskLevel | null>(null);
  const [query, setQuery] = useState('');

  const board = useMemo(() => buildBoard(employees, asOf), [employees, asOf]);
  const leavers = useMemo(() => leaversByTenure(employees), [employees]);

  const scoped = board.filter(
    ({ employee }) =>
      (department === '' || employee.department === department) &&
      (query.trim() === '' ||
        norm(`${employee.fullName} ${employee.position}`).includes(norm(query.trim()))),
  );
  const visible = level ? scoped.filter((r) => r.risk.level === level) : scoped;

  const banner = (
    <div className="banner" role="note">
      Демо-данные: все люди выдуманные. Данные на {formatRu(asOf)}.
    </div>
  );

  if (route.name === 'employee') {
    const row = board.find((r) => r.employee.id === route.id);
    return (
      <div className="app">
        {banner}
        {row ? (
          <EmployeeCard employee={row.employee} asOf={asOf} onBack={() => navigate('#/')} />
        ) : (
          <div className="empty">
            <h2>Сотрудник не найден</h2>
            <p>
              Его нет на доске: возможно, он уже вышел за пределы первых 90 дней, уволился или
              ссылка устарела.
            </p>
            <a href="#/">← К списку</a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      {banner}
      <header>
        <h1>Новички: кто в зоне риска</h1>
        <p className="lead">
          Первые 90 дней в компании. Список строится по задачам адаптации, правила риска простые и
          прозрачные: у каждого балла есть причина.
        </p>
      </header>
      <Summary rows={scoped} leavers={leavers} activeLevel={level} onLevel={setLevel} />
      <div className="filters">
        <label>
          Подразделение
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value as Department | '')}
          >
            <option value="">Все</option>
            {(Object.keys(DEPARTMENT_LABEL) as Department[]).map((d) => (
              <option key={d} value={d}>
                {DEPARTMENT_LABEL[d]}
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
      </div>
      <BoardTable rows={visible} onOpen={(id) => navigate(`#/employee/${encodeURIComponent(id)}`)} />
    </div>
  );
}
