import { useMemo } from 'react';
import { earlyExitRates, survivalAt, survivalCurve, type ExitRate } from '../domain/attrition';
import type { Employee, ISODate } from '../domain/types';
import { departmentLabel } from './labels';
import { SurvivalChart } from './SurvivalChart';

const pct = (v: number) => `${Math.round(v * 100)}%`;

function RateCell({ r }: { r: ExitRate }) {
  if (r.rate === undefined) return <span>—</span>;
  if (r.fewData) return <span className="few">мало данных</span>;
  return <span>{pct(r.rate)}</span>;
}

function RateTable({
  name,
  head,
  rates,
  label,
}: {
  name: string;
  head: string;
  rates: ExitRate[];
  label: (key: string) => string;
}) {
  return (
    <table className="rates" aria-label={name}>
      <thead>
        <tr>
          <th scope="col">{head}</th>
          <th scope="col">Принято (полные 90 дней)</th>
          <th scope="col">Ушли до 90-го дня</th>
          <th scope="col">Доля</th>
        </tr>
      </thead>
      <tbody>
        {rates.map((r) => (
          <tr key={r.key}>
            <th scope="row">{label(r.key)}</th>
            <td>{r.hires}</td>
            <td>{r.leftEarly}</td>
            <td>
              <RateCell r={r} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AnalyticsScreen({ employees, asOf }: { employees: Employee[]; asOf: ISODate }) {
  const curve = useMemo(() => survivalCurve(employees, asOf), [employees, asOf]);
  const total = useMemo(() => earlyExitRates(employees, asOf, () => 'all')[0], [employees, asOf]);
  const byDepartment = useMemo(
    () => earlyExitRates(employees, asOf, (e) => e.department),
    [employees, asOf],
  );
  const byPosition = useMemo(
    () => earlyExitRates(employees, asOf, (e) => e.position),
    [employees, asOf],
  );
  const leavers = employees.filter((e) => e.status === 'left').length;
  const empty = employees.length === 0;

  return (
    <div>
      <header>
        <h1>Аналитика ухода новичков</h1>
        <p className="lead">
          Что показывают прошлые приёмы и увольнения: когда и где люди уходят чаще всего.
        </p>
      </header>
      <section className="tiles facts" aria-label="Главные цифры">
        <div className="fact">
          <strong>{employees.length}</strong>
          <span>принято всего</span>
        </div>
        <div className="fact">
          <strong>{leavers}</strong>
          <span>уволено</span>
        </div>
        <div className="fact">
          <strong>{empty ? '—' : pct(survivalAt(curve, 90))}</strong>
          <span>остаются после 90 дней (оценка)</span>
        </div>
        <div className="fact">
          <strong>{total?.rate === undefined ? '—' : pct(total.rate)}</strong>
          <span>ушли до 90-го дня среди принятых 90+ дней назад</span>
        </div>
      </section>
      <section className="chart-block">
        <h2>Сколько новичков остаётся</h2>
        <SurvivalChart curve={curve} />
        <p className="footnote">По горизонтали дни работы, по вертикали доля оставшихся.</p>
      </section>
      <section>
        <h2>Ранний уход по подразделениям</h2>
        <RateTable
          name="Ранний уход по подразделениям"
          head="Подразделение"
          rates={byDepartment}
          label={departmentLabel}
        />
      </section>
      <section>
        <h2>Ранний уход по должностям</h2>
        <RateTable
          name="Ранний уход по должностям"
          head="Должность"
          rates={byPosition}
          label={(k) => k || 'Не указано'}
        />
      </section>
      <p className="footnote">
        Метод: кривая строится по Каплану — Мейеру, действующие сотрудники учитываются как ещё
        работающие. Доли раннего ухода считаются только по полным когортам: только те, кто принят
        не позднее чем за 90 дней до даты данных. Группы меньше 10 человек помечены «мало
        данных» — по ним выводов делать нельзя.
      </p>
    </div>
  );
}
