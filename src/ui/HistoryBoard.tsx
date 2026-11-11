import type { HistoryRow } from '../domain/attrition';
import { departmentLabel } from './labels';

function Rate({ row }: { row: HistoryRow }) {
  if (row.groupRate === undefined) return <>—</>;
  if (row.fewData) return <span className="few">мало данных</span>;
  return <>{Math.round(row.groupRate * 100)}%</>;
}

export function HistoryBoard({ rows }: { rows: HistoryRow[] }) {
  return (
    <section aria-label="Новички по истории подразделений">
      <p className="lead">
        Для этих сотрудников нет задач адаптации, поэтому уровень риска по правилам не считается:
        он выдумал бы «не было встречи с наставником». Вместо этого список упорядочен по
        тому, как часто в подразделении новички уходили в первые 90 дней. Загрузите ещё и файл
        задач, чтобы получить риск по каждому человеку.
      </p>
      {rows.length === 0 ? (
        <div className="empty">
          <p>На дату данных нет сотрудников в первых 90 днях работы.</p>
        </div>
      ) : (
        <table className="rates" aria-label="Новички и ранний уход в их подразделении">
          <thead>
            <tr>
              <th scope="col">Сотрудник</th>
              <th scope="col">Должность</th>
              <th scope="col">Подразделение</th>
              <th scope="col">День</th>
              <th scope="col">Ранний уход в подразделении</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employee.id}>
                <th scope="row">{r.employee.fullName}</th>
                <td>{r.employee.position}</td>
                <td>{departmentLabel(r.employee.department)}</td>
                <td>{r.tenureDay}</td>
                <td>
                  <Rate row={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
