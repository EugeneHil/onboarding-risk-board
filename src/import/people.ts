import { daysBetween } from '../domain/dates';
import type { Employee, ISODate, OnboardingTask, TaskKind } from '../domain/types';
import {
  hasColumn,
  normName,
  parseDate,
  PEOPLE_ALIASES as P,
  pick,
  TASK_ALIASES as T,
  type Row,
} from './fields';

export interface ImportIssue {
  /** 1-based data row number (the header is not counted). */
  row: number;
  message: string;
  /** The row was kept (with a correction), not skipped. */
  kept?: boolean;
}

export interface PeopleResult {
  employees: Employee[];
  issues: ImportIssue[];
}

export function importPeople(rows: Row[], asOf: ISODate): PeopleResult {
  const employees: Employee[] = [];
  const issues: ImportIssue[] = [];
  const missing: string[] = [];
  if (!hasColumn(rows, P.name)) missing.push('ФИО');
  if (!hasColumn(rows, P.hire)) missing.push('дата приёма');
  if (missing.length > 0) {
    return {
      employees,
      issues: [{ row: 0, message: `Не найдена обязательная колонка: ${missing.join(', ')}` }],
    };
  }

  const seen = new Set<string>();
  let generated = 0;
  rows.forEach((row, i) => {
    const n = i + 1;
    const fullName = pick(row, P.name);
    if (fullName === '') return void issues.push({ row: n, message: 'нет ФИО' });
    const hireRaw = pick(row, P.hire);
    const hireDate = parseDate(hireRaw);
    if (!hireDate) {
      return void issues.push({
        row: n,
        message: `не удалось прочитать дату приёма «${hireRaw}»`,
      });
    }
    if (hireDate > asOf) {
      return void issues.push({ row: n, message: 'дата приёма позже текущей даты' });
    }
    const leaveRaw = pick(row, P.leave);
    const leaveDate = leaveRaw === '' ? undefined : parseDate(leaveRaw);
    if (leaveRaw !== '' && !leaveDate) {
      return void issues.push({
        row: n,
        message: `не удалось прочитать дату увольнения «${leaveRaw}»`,
      });
    }
    if (leaveDate && leaveDate < hireDate) {
      return void issues.push({ row: n, message: 'увольнение раньше приёма' });
    }
    let keptNote: string | undefined;
    let leave = leaveDate;
    if (leave && leave > asOf) {
      keptNote = 'увольнение позже даты данных: считается работающим';
      leave = undefined;
    }
    const explicitId = pick(row, P.id);
    if (explicitId !== '' && seen.has(explicitId)) {
      return void issues.push({ row: n, message: `повторяющийся id «${explicitId}»` });
    }
    let id = explicitId;
    if (id === '') {
      do {
        generated += 1;
        id = `R-${String(generated).padStart(3, '0')}`;
      } while (seen.has(id));
    }
    seen.add(id);
    const mentor = pick(row, P.mentor);
    const reason = pick(row, P.reason);
    employees.push({
      id,
      fullName,
      position: pick(row, P.position) || '—',
      department: pick(row, P.department),
      location: '',
      hireDate,
      managerName: pick(row, P.manager),
      ...(mentor ? { mentorName: mentor } : {}),
      status: leave ? 'left' : 'active',
      ...(leave ? { leaveDate: leave } : {}),
      ...(leave && reason ? { leaveReason: reason } : {}),
      tasks: [],
    });
    if (keptNote) issues.push({ row: n, message: keptNote, kept: true });
  });
  return { employees, issues };
}

const KIND_RULES: Array<[RegExp, TaskKind]> = [
  [/наставник/i, 'mentor_meeting'],
  [/инструктаж|безопасн/i, 'safety'],
  [/документ|оформл/i, 'docs'],
  [/обучен/i, 'training'],
  [/обратн|feedback/i, 'feedback'],
  [/разговор|встреч|чекин|чек-ин|check/i, 'checkin'],
];

const KINDS: TaskKind[] = ['docs', 'safety', 'mentor_meeting', 'training', 'checkin', 'feedback', 'other'];

export function inferTaskKind(title: string): TaskKind {
  return KIND_RULES.find(([re]) => re.test(title))?.[1] ?? 'other';
}

function responsibleFor(kind: TaskKind): OnboardingTask['responsible'] {
  if (kind === 'mentor_meeting') return 'mentor';
  if (kind === 'checkin') return 'manager';
  return 'hr';
}

export function importTasks(rows: Row[], employees: Employee[]): PeopleResult {
  const issues: ImportIssue[] = [];
  const copies = employees.map((e) => ({ ...e, tasks: [...e.tasks] }));
  const hasWho = hasColumn(rows, T.id) || hasColumn(rows, T.name);
  const hasDue = hasColumn(rows, T.dueDay) || hasColumn(rows, T.dueDate);
  if (!hasWho || !hasColumn(rows, T.title) || !hasDue) {
    return {
      employees: copies,
      issues: [
        {
          row: 0,
          message: 'В файле задач нужны колонки: employee_id или ФИО, название, срок (due_day или due_date)',
        },
      ],
    };
  }
  const byId = new Map(copies.map((e) => [e.id, e]));
  const byName = new Map(copies.map((e) => [normName(e.fullName), e]));
  let counter = 0;
  rows.forEach((row, i) => {
    const n = i + 1;
    const id = pick(row, T.id);
    const name = pick(row, T.name);
    const owner = (id !== '' ? byId.get(id) : undefined) ?? (name !== '' ? byName.get(normName(name)) : undefined);
    if (!owner) {
      return void issues.push({ row: n, message: `сотрудник «${id || name}» не найден` });
    }
    const title = pick(row, T.title);
    if (title === '') return void issues.push({ row: n, message: 'нет названия' });

    let dueDay: number | undefined;
    const dayRaw = pick(row, T.dueDay);
    if (dayRaw !== '' && /^\d+$/.test(dayRaw)) {
      dueDay = Number(dayRaw);
    } else {
      const due = parseDate(pick(row, T.dueDate));
      if (!due) return void issues.push({ row: n, message: 'не указан или не читается срок' });
      dueDay = daysBetween(owner.hireDate, due);
      if (dueDay < 0) {
        return void issues.push({ row: n, message: 'срок раньше даты приёма' });
      }
    }
    const doneRaw = pick(row, T.done);
    const completedOn = doneRaw === '' ? undefined : parseDate(doneRaw);
    if (doneRaw !== '' && !completedOn) {
      return void issues.push({ row: n, message: `не читается дата выполнения «${doneRaw}»` });
    }
    const kindRaw = pick(row, T.kind) as TaskKind;
    const kind = KINDS.includes(kindRaw) ? kindRaw : inferTaskKind(title);
    counter += 1;
    owner.tasks.push({
      id: `imp-${counter}`,
      kind,
      title,
      dueDay,
      status: completedOn ? 'done' : 'open',
      ...(completedOn ? { completedOn } : {}),
      responsible: responsibleFor(kind),
    });
  });
  return { employees: copies, issues };
}

/** Latest hire or leave date found in the rows: a sensible default for "data as of". */
export function latestDate(rows: Row[]): ISODate | undefined {
  let latest: ISODate | undefined;
  for (const row of rows) {
    for (const aliases of [P.hire, P.leave]) {
      const d = parseDate(pick(row, aliases));
      if (d && (!latest || d > latest)) latest = d;
    }
  }
  return latest;
}
