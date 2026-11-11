import { useEffect, useMemo, useRef, useState } from 'react';
import { buildBitrixTask } from '../domain/bitrix';
import { formatRu } from '../domain/dates';
import { evaluateRisk } from '../domain/rules';
import type { Employee, ISODate } from '../domain/types';
import { BitrixModal } from './BitrixModal';
import { departmentLabel, LEVEL_LABEL, TASK_KIND_LABEL } from './labels';
import { STATE_LABEL, taskState, Timeline } from './Timeline';

interface EmployeeCardProps {
  employee: Employee;
  asOf: ISODate;
  onBack: () => void;
}

export function EmployeeCard({ employee, asOf, onBack }: EmployeeCardProps) {
  const [showModal, setShowModal] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Opening a card from the middle of a long list must start at the top, with focus on the name.
  useEffect(() => {
    window.scrollTo(0, 0);
    headingRef.current?.focus();
  }, [employee.id]);
  const risk = useMemo(() => evaluateRisk(employee, asOf), [employee, asOf]);
  const payload = useMemo(() => buildBitrixTask(employee, risk, asOf), [employee, risk, asOf]);
  const tasks = [...employee.tasks].sort((a, b) => a.dueDay - b.dueDay);

  return (
    <article className="card">
      <button type="button" className="back" onClick={onBack}>
        ← К списку
      </button>
      <header className="card-head">
        <h1 ref={headingRef} tabIndex={-1}>
          {employee.fullName}
        </h1>
        <span className={`badge badge-${risk.level}`}>
          {LEVEL_LABEL[risk.level]} · {risk.score}
        </span>
      </header>
      <p className="muted">
        {employee.position}, {departmentLabel(employee.department)}, {employee.location}. Принят{' '}
        {formatRu(employee.hireDate)}, день {risk.tenureDay} из 90. Руководитель:{' '}
        {employee.managerName}. Наставник: {employee.mentorName ?? 'не назначен'}.
      </p>

      <div className="card-grid">
        <section aria-label="Причины риска" className="panel">
          <h2>Причины риска</h2>
          {risk.reasons.length === 0 ? (
            <p className="muted">Причин для беспокойства нет.</p>
          ) : (
            <ul>
              {risk.reasons.map((r) => (
                <li key={r.code}>
                  {r.text} <span className="muted">(+{r.points})</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-label="Что сделать" className="panel">
          <h2>Что сделать</h2>
          <p>{risk.nextAction}</p>
          <button
            type="button"
            className="primary"
            ref={triggerRef}
            onClick={() => setShowModal(true)}
          >
            Создать задачу в Битрикс24
          </button>
        </section>
      </div>

      <section aria-label="Первые 90 дней" className="panel">
        <h2>Первые 90 дней</h2>
        <Timeline tasks={tasks} tenureDay={risk.tenureDay} />
      </section>

      <section aria-label="Задачи адаптации" className="panel">
        <h2>Задачи адаптации</h2>
        <div className="table-wrap" role="region" aria-label="Список задач адаптации" tabIndex={0}>
          <table className="board">
            <thead>
              <tr>
                <th scope="col">День</th>
                <th scope="col">Задача</th>
                <th scope="col">Тип</th>
                <th scope="col">Статус</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const state = taskState(t, risk.tenureDay);
                return (
                  <tr key={t.id}>
                    <td>{t.dueDay}</td>
                    <td>{t.title}</td>
                    <td>{TASK_KIND_LABEL[t.kind]}</td>
                    <td>
                      <span className={`state state-${state}`}>{STATE_LABEL[state]}</span>
                      {t.completedOn ? (
                        <span className="muted"> {formatRu(t.completedOn)}</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showModal ? (
        <BitrixModal
          payload={payload}
          onClose={() => {
            setShowModal(false);
            triggerRef.current?.focus();
          }}
        />
      ) : null}
    </article>
  );
}
