import { useMemo } from 'react';
import { backtest } from '../domain/backtest';
import {
  earlyExitRates,
  leaveReasonBreakdown,
  MIN_COHORT,
  survivalCurve,
  survivalKnownAt,
  type ExitRate,
} from '../domain/attrition';
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

function ReasonTable({
  reasons,
  synthetic,
}: {
  reasons: ReturnType<typeof leaveReasonBreakdown>;
  synthetic: boolean;
}) {
  const given = reasons.leavers - reasons.unspecified;
  const showShares = given >= MIN_COHORT;
  return (
    <>
      {synthetic && (
        <p className="footnote">
          Демо: причины выбраны случайно генератором, это не вывод о том, почему уходят.
        </p>
      )}
      <table className="rates" aria-label="Причины ухода">
        <thead>
          <tr>
            <th scope="col">Причина</th>
            <th scope="col">Ушли</th>
            {showShares && <th scope="col">Доля</th>}
            <th scope="col">Из них до 90-го дня</th>
          </tr>
        </thead>
        <tbody>
          {reasons.rows.map((r) => (
            <tr key={r.reason}>
              <th scope="row">{r.reason}</th>
              <td>{r.all}</td>
              {showShares && <td>{pct(r.all / given)}</td>}
              <td>{r.early}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="footnote">
        {showShares
          ? 'Доля считается среди ушедших, указавших причину. '
          : `Мало данных: меньше ${MIN_COHORT} ушедших с указанной причиной, доли не считаем. `}
        {reasons.unspecified > 0 && `Без указания причины: ${reasons.unspecified}. `}
        Причины сравниваются как написано в данных (без учёта регистра); свести их к категориям лучше
        вместе с HR на ваших данных.
      </p>
    </>
  );
}

const CUT_DAYS = [7, 14, 20, 30];
const THRESHOLDS = [
  { id: 'medium' as const, label: 'средний или высокий' },
  { id: 'high' as const, label: 'только высокий' },
];

const cell = (share: number | undefined, n: number) =>
  share === undefined ? '—' : `${pct(share)} из ${n}`;

function difference(leavers: number | undefined, stayers: number | undefined): string {
  if (leavers === undefined || stayers === undefined) return '—';
  const pp = Math.round((leavers - stayers) * 100);
  return `${pp > 0 ? '+' : ''}${pp} п.п.`;
}

export function AnalyticsScreen({
  employees,
  asOf,
  synthetic = false,
}: {
  employees: Employee[];
  asOf: ISODate;
  synthetic?: boolean;
}) {
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
  const hasTasks = useMemo(() => employees.some((e) => e.tasks.length > 0), [employees]);
  const tests = useMemo(
    () =>
      hasTasks
        ? CUT_DAYS.flatMap((day) =>
            THRESHOLDS.map((t) => ({
              day,
              threshold: t,
              result: backtest(employees, asOf, day, t.id),
            })),
          )
        : undefined,
    [employees, asOf, hasTasks],
  );
  const reasons = useMemo(() => leaveReasonBreakdown(employees), [employees]);
  const leavers = reasons.leavers;
  const survival90 = survivalKnownAt(curve, 90);

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
          <strong>{survival90 === undefined ? '—' : pct(survival90)}</strong>
          <span>
            {survival90 === undefined
              ? 'остаются после 90 дней: пока нет данных'
              : 'остаются после 90 дней (оценка)'}
          </span>
        </div>
        <div className="fact">
          <strong>{total?.rate === undefined || total.fewData ? '—' : pct(total.rate)}</strong>
          <span>
            {total?.fewData
              ? 'ушли до 90-го дня: мало данных (меньше 10 принятых 90+ дней назад)'
              : 'ушли до 90-го дня среди принятых 90+ дней назад'}
          </span>
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
      <section aria-label="Причины ухода">
        <h2>Причины ухода</h2>
        {reasons.rows.length === 0 ? (
          <p>В этих данных причины увольнения не указаны (колонка «Причина увольнения»).</p>
        ) : (
          <ReasonTable reasons={reasons} synthetic={synthetic} />
        )}
      </section>
      {tests && (
        <section aria-label="Проверка правил на истории">
          <h2>Проверка правил на истории</h2>
          <p>
            Как если бы правила риска смотрели на каждого на 7-й, 14-й, 20-й и 30-й день работы:
            кого из тех, кто потом ушёл до 90-го дня или остался, они бы отметили. Важна разница:
            если она около нуля или отрицательная, правила на этот день не отличают будущих ушедших
            от остальных.
          </p>
          <div
            className="table-wrap"
            role="region"
            aria-label="Таблица проверки правил"
            tabIndex={0}
          >
            <table className="rates" aria-label="Доля отмеченных правилами">
              <thead>
                <tr>
                  <th scope="col">Срез</th>
                  <th scope="col">Отмечен, если риск</th>
                  <th scope="col">Ушедшие до 90-го дня</th>
                  <th scope="col">Остались</th>
                  <th scope="col">Разница</th>
                </tr>
              </thead>
              <tbody>
                {tests.map(({ day, threshold, result }) => (
                  <tr key={`${day}-${threshold.id}`}>
                    {threshold.id === 'medium' ? (
                      <th scope="row" rowSpan={THRESHOLDS.length}>
                        {day}-й день
                      </th>
                    ) : null}
                    <td>{threshold.label}</td>
                    <td>{cell(result.flaggedShareLeavers, result.earlyLeavers.n)}</td>
                    <td>{cell(result.flaggedShareStayers, result.stayers.n)}</td>
                    <td>{difference(result.flaggedShareLeavers, result.flaggedShareStayers)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="footnote">
            {synthetic
              ? 'Проверка круговая: демо-данные выдуманы так, что выполнение задач и уход связаны, поэтому результат показывает лишь, что механизм работает, а не что правила хороши.'
              : 'Веса правил не подбирались под эти данные, поэтому это честная первая проверка гипотез. Она учитывает только людей с задачами адаптации и принятых не менее 90 дней назад.'}
          </p>
        </section>
      )}
      <p className="footnote">
        Метод: кривая строится по Каплану — Мейеру, действующие сотрудники учитываются как ещё
        работающие. Доли раннего ухода считаются только по полным когортам: только те, кто принят не
        позднее чем за 90 дней до даты данных. Группы меньше 10 человек помечены «мало данных» — по
        ним выводов делать нельзя.
      </p>
    </div>
  );
}
