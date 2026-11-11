import { importPeople, importTasks, inferTaskKind } from './people';
import { parseDate } from './fields';

const ASOF = '2026-11-11';

describe('parseDate', () => {
  it('accepts ISO, Russian and ISO datetime formats', () => {
    expect(parseDate('2026-10-05')).toBe('2026-10-05');
    expect(parseDate('05.10.2026')).toBe('2026-10-05');
    expect(parseDate(' 5.10.2026 ')).toBe('2026-10-05');
    expect(parseDate('2026-10-05T18:00:00+03:00')).toBe('2026-10-05');
  });

  it('rejects impossible and malformed dates', () => {
    expect(parseDate('31.02.2026')).toBeUndefined();
    expect(parseDate('2026-13-01')).toBeUndefined();
    expect(parseDate('вчера')).toBeUndefined();
    expect(parseDate('')).toBeUndefined();
  });
});

describe('importPeople', () => {
  it('maps Russian headers and DD.MM.YYYY dates to employees', () => {
    const { employees, issues } = importPeople(
      [
        {
          'ФИО': 'Иванов Иван',
          'Должность': 'Кладовщик',
          'Подразделение': 'Склад',
          'Дата приёма': '01.09.2026',
          'Руководитель': 'Сидоров С.',
          'Наставник': 'Петров П.',
          'Табельный номер': 'A-7',
        },
      ],
      ASOF,
    );
    expect(issues).toEqual([]);
    expect(employees).toHaveLength(1);
    expect(employees[0]).toMatchObject({
      id: 'A-7',
      fullName: 'Иванов Иван',
      position: 'Кладовщик',
      department: 'Склад',
      hireDate: '2026-09-01',
      managerName: 'Сидоров С.',
      mentorName: 'Петров П.',
      status: 'active',
      tasks: [],
    });
  });

  it('marks an employee as left only when a valid leave date exists', () => {
    const { employees } = importPeople(
      [
        { name: 'A', hire_date: '2026-01-10', leave_date: '2026-02-20', leave_reason: 'сам' },
        { name: 'B', hire_date: '2026-01-10', leave_date: '' },
      ],
      ASOF,
    );
    expect(employees[0]).toMatchObject({ status: 'left', leaveDate: '2026-02-20', leaveReason: 'сам' });
    expect(employees[1]?.status).toBe('active');
    expect(employees[1]?.leaveDate).toBeUndefined();
  });

  it('generates ids R-001, R-002 for rows without an id', () => {
    const { employees } = importPeople(
      [
        { name: 'A', hire_date: '2026-01-10' },
        { name: 'B', hire_date: '2026-01-11' },
      ],
      ASOF,
    );
    expect(employees.map((e) => e.id)).toEqual(['R-001', 'R-002']);
  });

  it('skips a row without a name or hire date and reports its row number', () => {
    const { employees, issues } = importPeople(
      [
        { name: 'A', hire_date: '2026-01-10' },
        { name: '', hire_date: '2026-01-10' },
        { name: 'C', hire_date: '' },
        { name: 'D', hire_date: 'не дата' },
      ],
      ASOF,
    );
    expect(employees).toHaveLength(1);
    expect(issues.map((i) => i.row)).toEqual([2, 3, 4]);
    expect(issues.every((i) => i.message.length > 0)).toBe(true);
  });

  it('skips a leaver whose leave date is before the hire date', () => {
    const { employees, issues } = importPeople(
      [{ name: 'A', hire_date: '2026-03-10', leave_date: '2026-03-01' }],
      ASOF,
    );
    expect(employees).toEqual([]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.row).toBe(1);
  });

  it('skips a hire after the as-of date', () => {
    const { employees, issues } = importPeople([{ name: 'A', hire_date: '2026-12-01' }], ASOF);
    expect(employees).toEqual([]);
    expect(issues).toHaveLength(1);
  });

  it('skips a duplicate id and keeps the first', () => {
    const { employees, issues } = importPeople(
      [
        { id: 'X', name: 'A', hire_date: '2026-01-10' },
        { id: 'X', name: 'B', hire_date: '2026-01-11' },
      ],
      ASOF,
    );
    expect(employees.map((e) => e.fullName)).toEqual(['A']);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.row).toBe(2);
  });

  it('reports one issue and no employees when a required column is missing', () => {
    const { employees, issues } = importPeople([{ name: 'A' }, { name: 'B' }], ASOF);
    expect(employees).toEqual([]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toMatch(/дата приёма/i);
  });

  it('defaults a missing department to an empty string and a missing position to a dash', () => {
    const { employees } = importPeople([{ name: 'A', hire_date: '2026-01-10' }], ASOF);
    expect(employees[0]?.department).toBe('');
    expect(employees[0]?.position).toBe('—');
  });
});

describe('inferTaskKind', () => {
  it('recognises task kinds by Russian and English keywords', () => {
    expect(inferTaskKind('Встреча с наставником')).toBe('mentor_meeting');
    expect(inferTaskKind('Инструктаж по технике безопасности')).toBe('safety');
    expect(inferTaskKind('Оформление документов')).toBe('docs');
    expect(inferTaskKind('Обучение работе с кассой')).toBe('training');
    expect(inferTaskKind('Разговор с руководителем')).toBe('checkin');
    expect(inferTaskKind('Check-in на 2 неделе')).toBe('checkin');
    expect(inferTaskKind('Обратная связь от HR')).toBe('feedback');
  });

  it('falls back to other', () => {
    expect(inferTaskKind('Получить пропуск')).toBe('other');
  });
});

describe('importTasks', () => {
  const people = () =>
    importPeople(
      [
        { id: 'A', name: 'Анна Первая', hire_date: '2026-10-01' },
        { id: 'B', name: 'Борис Второй', hire_date: '2026-10-05' },
      ],
      ASOF,
    ).employees;

  it('attaches tasks by id; completed_on present means done', () => {
    const { employees, issues } = importTasks(
      [
        { employee_id: 'A', title: 'Встреча с наставником', due_date: '08.10.2026', completed_on: '07.10.2026' },
        { employee_id: 'A', title: 'Получить пропуск', due_date: '2026-10-03', completed_on: '' },
      ],
      people(),
    );
    expect(issues).toEqual([]);
    const a = employees.find((e) => e.id === 'A')!;
    expect(a.tasks).toHaveLength(2);
    expect(a.tasks[0]).toMatchObject({
      kind: 'mentor_meeting',
      dueDay: 7,
      status: 'done',
      completedOn: '2026-10-07',
    });
    expect(a.tasks[1]).toMatchObject({ kind: 'other', dueDay: 2, status: 'open' });
    expect(a.tasks[1]?.completedOn).toBeUndefined();
    expect(employees.find((e) => e.id === 'B')?.tasks).toEqual([]);
  });

  it('does not mutate the input employees', () => {
    const input = people();
    importTasks([{ employee_id: 'A', title: 'x', due_day: '3' }], input);
    expect(input[0]?.tasks).toEqual([]);
  });

  it('reports a task for an unknown employee id', () => {
    const { employees, issues } = importTasks(
      [{ employee_id: 'ZZ', title: 'Документы', due_day: '1' }],
      people(),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.row).toBe(1);
    expect(employees.every((e) => e.tasks.length === 0)).toBe(true);
  });

  it('matches by full name when there is no id column', () => {
    const { employees, issues } = importTasks(
      [{ ФИО: 'борис второй', 'Название': 'Документы', due_day: '1' }],
      people(),
    );
    expect(issues).toEqual([]);
    expect(employees.find((e) => e.id === 'B')?.tasks).toHaveLength(1);
  });

  it('accepts due_day directly and rejects a due date before the hire date', () => {
    const { employees, issues } = importTasks(
      [
        { employee_id: 'A', title: 'ok', due_day: '5' },
        { employee_id: 'A', title: 'early', due_date: '2026-09-20' },
      ],
      people(),
    );
    expect(employees.find((e) => e.id === 'A')?.tasks.map((t) => t.dueDay)).toEqual([5]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.row).toBe(2);
  });

  it('uses an explicit kind when given and reports rows without title or due date', () => {
    const { employees, issues } = importTasks(
      [
        { employee_id: 'A', title: 'Что-то', kind: 'safety', due_day: '1' },
        { employee_id: 'A', title: '', due_day: '1' },
        { employee_id: 'A', title: 'Без срока' },
      ],
      people(),
    );
    expect(employees.find((e) => e.id === 'A')?.tasks[0]?.kind).toBe('safety');
    expect(issues.map((i) => i.row)).toEqual([2, 3]);
  });

  it('reports one issue when required columns are missing', () => {
    const { issues } = importTasks([{ foo: 'bar' }], people());
    expect(issues).toHaveLength(1);
  });
});
