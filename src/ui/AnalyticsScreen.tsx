import { useMemo } from "react";
import { backtest } from "../domain/backtest";
import {
  earlyExitRates,
  survivalAt,
  survivalCurve,
  type ExitRate,
} from "../domain/attrition";
import type { Employee, ISODate } from "../domain/types";
import { departmentLabel } from "./labels";
import { SurvivalChart } from "./SurvivalChart";

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

const CUT_DAY = 20;

export function AnalyticsScreen({
  employees,
  asOf,
  synthetic = false,
}: {
  employees: Employee[];
  asOf: ISODate;
  synthetic?: boolean;
}) {
  const curve = useMemo(
    () => survivalCurve(employees, asOf),
    [employees, asOf],
  );
  const total = useMemo(
    () => earlyExitRates(employees, asOf, () => "all")[0],
    [employees, asOf],
  );
  const byDepartment = useMemo(
    () => earlyExitRates(employees, asOf, (e) => e.department),
    [employees, asOf],
  );
  const byPosition = useMemo(
    () => earlyExitRates(employees, asOf, (e) => e.position),
    [employees, asOf],
  );
  const hasTasks = useMemo(
    () => employees.some((e) => e.tasks.length > 0),
    [employees],
  );
  const test = useMemo(
    () => (hasTasks ? backtest(employees, asOf, CUT_DAY) : undefined),
    [employees, asOf, hasTasks],
  );
  const leavers = employees.filter((e) => e.status === "left").length;
  const empty = employees.length === 0;

  return (
    <div>
      <header>
        <h1>Аналитика ухода новичков</h1>
        <p className="lead">
          Что показывают прошлые приёмы и увольнения: когда и где люди уходят
          чаще всего.
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
          <strong>{empty ? "—" : pct(survivalAt(curve, 90))}</strong>
          <span>остаются после 90 дней (оценка)</span>
        </div>
        <div className="fact">
          <strong>{total?.rate === undefined ? "—" : pct(total.rate)}</strong>
          <span>ушли до 90-го дня среди принятых 90+ дней назад</span>
        </div>
      </section>
      <section className="chart-block">
        <h2>Сколько новичков остаётся</h2>
        <SurvivalChart curve={curve} />
        <p className="footnote">
          По горизонтали дни работы, по вертикали доля оставшихся.
        </p>
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
          label={(k) => k || "Не указано"}
        />
      </section>
      {test && (
        <section aria-label="Проверка правил на истории">
          <h2>Проверка правил на истории</h2>
          <p>
            Как если бы правила риска смотрели на каждого на {CUT_DAY}-й день
            работы: кого из тех, кто потом ушёл или остался, они бы отметили
            средним или высоким риском.
          </p>
          <table className="rates" aria-label="Доля отмеченных правилами">
            <thead>
              <tr>
                <th scope="col">Группа</th>
                <th scope="col">Человек</th>
                <th scope="col">Отмечены правилами</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Ушедшие до 90-го дня</th>
                <td>{test.earlyLeavers.n}</td>
                <td>
                  {test.flaggedShareLeavers === undefined
                    ? "—"
                    : pct(test.flaggedShareLeavers)}
                </td>
              </tr>
              <tr>
                <th scope="row">Остались</th>
                <td>{test.stayers.n}</td>
                <td>
                  {test.flaggedShareStayers === undefined
                    ? "—"
                    : pct(test.flaggedShareStayers)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="footnote">
            {synthetic
              ? "Проверка круговая: демо-данные выдуманы так, что выполнение задач и уход связаны, поэтому результат показывает лишь, что механизм работает, а не что правила хороши."
              : "Веса правил не подбирались под эти данные, поэтому это честная первая проверка гипотез. Она учитывает только людей с задачами адаптации и принятых не менее 90 дней назад."}
          </p>
        </section>
      )}
      <p className="footnote">
        Метод: кривая строится по Каплану — Мейеру, действующие сотрудники
        учитываются как ещё работающие. Доли раннего ухода считаются только по
        полным когортам: только те, кто принят не позднее чем за 90 дней до даты
        данных. Группы меньше 10 человек помечены «мало данных» — по ним выводов
        делать нельзя.
      </p>
    </div>
  );
}
