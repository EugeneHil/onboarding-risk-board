import type { BoardRow } from '../domain/types';
import { departmentLabel, LEVEL_LABEL } from './labels';

interface BoardTableProps {
  rows: BoardRow[];
  onOpen: (id: string) => void;
}

export function BoardTable({ rows, onOpen }: BoardTableProps) {
  if (rows.length === 0) {
    return <p className="empty">Никого не найдено</p>;
  }
  return (
    <div className="table-wrap">
      <table className="board" aria-label="Доска риска">
        <thead>
          <tr>
            <th scope="col">Сотрудник</th>
            <th scope="col">Подразделение</th>
            <th scope="col">День</th>
            <th scope="col">Риск</th>
            <th scope="col">Причины</th>
            <th scope="col">Что сделать</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ employee, risk }) => (
            <tr key={employee.id} onClick={() => onOpen(employee.id)} className="row">
              <td>
                <button type="button" className="link">
                  {employee.fullName}
                </button>
                <div className="muted">{employee.position}</div>
              </td>
              <td>
                {departmentLabel(employee.department)}
                <div className="muted">{employee.location}</div>
              </td>
              <td>{risk.tenureDay} из 90</td>
              <td>
                <span className={`badge badge-${risk.level}`}>
                  {LEVEL_LABEL[risk.level]} · {risk.score}
                </span>
              </td>
              <td>
                {risk.reasons.length === 0 ? (
                  <span className="muted">Нет</span>
                ) : (
                  <ul className="reasons">
                    {risk.reasons.slice(0, 2).map((r) => (
                      <li key={r.code}>{r.text}</li>
                    ))}
                  </ul>
                )}
              </td>
              <td>{risk.nextAction}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
