import { useMemo, useRef, useState } from 'react';
import type { Employee, ISODate } from '../domain/types';
import { importPeople, importTasks, latestDate, type ImportIssue } from '../import/people';
import { decodeText } from '../import/decode';
import { parseTable, type ParsedTable } from '../import/table';

export interface Dataset {
  employees: Employee[];
  asOf: ISODate;
  source: 'demo' | 'import';
}

interface Props {
  source: Dataset['source'];
  onUse: (dataset: Dataset) => void;
  onReset: () => void;
}

function readText(file: File): Promise<string> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer().then(decodeText);
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function IssueList({ issues }: { issues: ImportIssue[] }) {
  if (issues.length === 0) return null;
  const shown = issues.slice(0, 5);
  return (
    <ul className="issues">
      {shown.map((i, k) => (
        <li key={k}>{i.row > 0 ? `Строка ${i.row}: ${i.message}` : i.message}</li>
      ))}
      {issues.length > shown.length && <li>…и ещё {issues.length - shown.length}</li>}
    </ul>
  );
}

const count = (issues: ImportIssue[]) => issues.filter((i) => i.row > 0 && !i.kept).length;

export function ImportScreen({ source, onUse, onReset }: Props) {
  const [people, setPeople] = useState<ParsedTable | undefined>();
  const [tasks, setTasks] = useState<ParsedTable | undefined>();
  const [asOf, setAsOf] = useState<ISODate>('');
  const [readErrors, setReadErrors] = useState<{ people?: string; tasks?: string }>({});
  // Latest request per file slot: a slow earlier read must not overwrite a later choice.
  const latest = useRef({ people: 0, tasks: 0 });

  async function load(
    file: File | undefined,
    slot: 'people' | 'tasks',
    set: (t: ParsedTable | undefined) => void,
  ) {
    const mine = ++latest.current[slot];
    const fresh = () => latest.current[slot] === mine;
    const setError = (message?: string) =>
      setReadErrors((prev) => ({ ...prev, [slot]: message }));
    if (!file) {
      set(undefined);
      return setError(undefined);
    }
    try {
      const table = parseTable(await readText(file));
      if (!fresh()) return;
      set(table);
      if (slot === 'people') {
        const newest = latestDate(table.rows);
        const today = new Date().toISOString().slice(0, 10);
        // never default to a future date: planned leave dates must not move "today"
        setAsOf(newest ? (newest < today ? newest : today) : '');
      }
      setError(undefined);
    } catch {
      if (!fresh()) return;
      set(undefined);
      setError('Не удалось прочитать файл');
    }
  }

  const peopleResult = useMemo(
    () => (people && !people.error && asOf ? importPeople(people.rows, asOf, people.sourceRows) : undefined),
    [people, asOf],
  );
  const tasksResult = useMemo(
    () =>
      peopleResult && tasks && !tasks.error
        ? importTasks(tasks.rows, peopleResult.employees, tasks.sourceRows)
        : undefined,
    [peopleResult, tasks],
  );

  const employees = tasksResult?.employees ?? peopleResult?.employees ?? [];
  const canUse = employees.length > 0;
  // The reasons a people file produces nothing must reach the screen, not vanish.
  const fileIssue =
    people && !people.error ? importPeople(people.rows, '9999-12-31').issues.find((i) => i.row === 0) : undefined;
  const error =
    readErrors.people ??
    people?.error ??
    fileIssue?.message ??
    (people && !asOf ? 'Не удалось прочитать ни одной даты приёма или увольнения' : undefined);

  return (
    <div>
      <header>
        <h1>Свои данные</h1>
        <p className="lead">
          Загрузите выгрузку приёмов и увольнений (CSV или JSON), при желании ещё и задачи
          адаптации. Файлы обрабатываются только в браузере и никуда не отправляются.
        </p>
      </header>
      <section className="import-form">
        <label>
          Таблица сотрудников (обязательно)
          <input
            type="file"
            accept=".csv,.tsv,.txt,.json,text/csv,application/json,text/plain"
            onChange={(e) => {
              void load(e.target.files?.[0], 'people', setPeople);
              e.target.value = '';
            }}
          />
        </label>
        <label>
          Задачи адаптации (необязательно)
          <input
            type="file"
            accept=".csv,.tsv,.txt,.json,text/csv,application/json,text/plain"
            onChange={(e) => {
              void load(e.target.files?.[0], 'tasks', setTasks);
              e.target.value = '';
            }}
          />
        </label>
        <label>
          Данные на дату
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </label>
        <p className="footnote">
          Шаблоны: <a href="./samples/people.csv" download>people.csv</a>,{' '}
          <a href="./samples/tasks.csv" download>tasks.csv</a>. Какие колонки понимает приложение —
          в docs/data-contract.md.
        </p>
      </section>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {(readErrors.tasks ?? tasks?.error) && (
        <p role="alert" className="error">
          Файл задач: {readErrors.tasks ?? tasks?.error}
        </p>
      )}
      {peopleResult && (
        <section aria-label="Результат импорта">
          <p>
            <strong>Импортировано: {peopleResult.employees.length}</strong>
          </p>
          <p>Пропущено: {count(peopleResult.issues)}</p>
          <IssueList issues={peopleResult.issues} />
        </section>
      )}
      {tasksResult && (
        <section aria-label="Результат импорта задач">
          <p>
            Задачи: импортировано {tasksResult.employees.reduce((n, e) => n + e.tasks.length, 0)},
            пропущено {count(tasksResult.issues)}
          </p>
          <IssueList issues={tasksResult.issues} />
        </section>
      )}
      <div className="actions">
        <button
          type="button"
          disabled={!canUse}
          onClick={() => onUse({ employees, asOf, source: 'import' })}
        >
          Использовать эти данные
        </button>
        {source === 'import' && (
          <button type="button" onClick={onReset}>
            Вернуться к демо
          </button>
        )}
      </div>
    </div>
  );
}
