import { addDays, daysBetween } from '../domain/dates';
import type { Department, Employee, ISODate, OnboardingTask, TaskKind } from '../domain/types';
import { createRng } from './rng';

type Rng = () => number;

const MALE_NAMES = ['Алексей', 'Дмитрий', 'Иван', 'Максим', 'Сергей', 'Андрей', 'Павел', 'Егор', 'Кирилл', 'Роман', 'Артём', 'Никита'];
const FEMALE_NAMES = ['Анна', 'Мария', 'Елена', 'Ольга', 'Наталья', 'Ксения', 'Дарья', 'Татьяна', 'Юлия', 'Виктория', 'Алина', 'Ирина'];
// [male form, female form]; the combinations are random and fictional.
const SURNAMES: Array<[string, string]> = [
  ['Иванов', 'Иванова'], ['Смирнов', 'Смирнова'], ['Кузнецов', 'Кузнецова'], ['Попов', 'Попова'],
  ['Васильев', 'Васильева'], ['Петров', 'Петрова'], ['Соколов', 'Соколова'], ['Михайлов', 'Михайлова'],
  ['Новиков', 'Новикова'], ['Фёдоров', 'Фёдорова'], ['Морозов', 'Морозова'], ['Волков', 'Волкова'],
  ['Алексеев', 'Алексеева'], ['Лебедев', 'Лебедева'], ['Семёнов', 'Семёнова'], ['Егоров', 'Егорова'],
  ['Павлов', 'Павлова'], ['Козлов', 'Козлова'], ['Степанов', 'Степанова'], ['Николаев', 'Николаева'],
];

const POSITIONS: Record<Department, string[]> = {
  warehouse: ['Кладовщик', 'Комплектовщик заказов', 'Грузчик-экспедитор'],
  store: ['Продавец-консультант', 'Кассир', 'Старший продавец'],
  sales: ['Менеджер по оптовым продажам', 'Менеджер по работе с клиентами'],
  office: ['Бухгалтер', 'Специалист по закупкам', 'Администратор'],
};

const LOCATIONS: Record<Department, string[]> = {
  warehouse: ['Склад «Северный»', 'Склад «Южный»'],
  store: ['Магазин «Центр»', 'Магазин «Арена»', 'Магазин «Парк»', 'Магазин «Река»'],
  sales: ['Отдел продаж'],
  office: ['Главный офис'],
};

const LEAVE_REASONS = [
  'По собственному желанию: не устроил график',
  'По собственному желанию: нагрузка выше ожидаемой',
  'Нашёл другую работу',
  'Не прошёл испытательный срок',
  'Переезд в другой город',
];

interface TemplateTask {
  kind: TaskKind;
  title: string;
  dueDay: number;
  responsible: OnboardingTask['responsible'];
  departments?: Department[];
}

const TEMPLATE: TemplateTask[] = [
  { kind: 'docs', title: 'Оформить документы и пропуск', dueDay: 1, responsible: 'hr' },
  { kind: 'safety', title: 'Пройти инструктаж по технике безопасности', dueDay: 2, responsible: 'manager', departments: ['warehouse', 'store'] },
  { kind: 'mentor_meeting', title: 'Первая встреча с наставником', dueDay: 5, responsible: 'mentor' },
  { kind: 'training', title: 'Пройти обучение по рабочим процессам', dueDay: 10, responsible: 'manager' },
  { kind: 'checkin', title: 'Разговор руководителя: как проходит адаптация', dueDay: 14, responsible: 'manager' },
  { kind: 'feedback', title: 'Обратная связь HR: первый месяц', dueDay: 30, responsible: 'hr' },
  { kind: 'checkin', title: 'Разговор руководителя: итоги второго месяца', dueDay: 60, responsible: 'manager' },
  { kind: 'feedback', title: 'Итоговая встреча HR: три месяца', dueDay: 90, responsible: 'hr' },
];

const pick = <T>(rnd: Rng, list: T[]): T => list[Math.floor(rnd() * list.length)] as T;

function personName(rnd: Rng): string {
  const female = rnd() < 0.5;
  const [male, fem] = pick(rnd, SURNAMES);
  return `${female ? fem : male} ${pick(rnd, female ? FEMALE_NAMES : MALE_NAMES)}`;
}

/** Draws names until one is unused, so two employees never share a full name. */
function uniquePersonName(rnd: Rng, used: Set<string>): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    const name = personName(rnd);
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  throw new Error('Name pool exhausted: too many employees requested');
}

function pickDepartment(rnd: Rng): Department {
  const r = rnd();
  if (r < 0.3) return 'warehouse';
  if (r < 0.65) return 'store';
  if (r < 0.8) return 'sales';
  return 'office';
}

/**
 * Hidden engagement in [0, 1] drives both task completion and leaving:
 * the demo is a plausible illustration, not evidence about real people.
 */
function planLeaveTenure(rnd: Rng, engagement: number): number | undefined {
  if (engagement < 0.145) return rnd() < 0.8 ? 10 + Math.floor(rnd() * 76) : undefined;
  const p = engagement < 0.5 ? 0.7 : 0.3;
  return rnd() < p ? 91 + Math.floor(rnd() * 130) : undefined;
}

function buildTasks(
  rnd: Rng,
  id: string,
  department: Department,
  hireDate: ISODate,
  endDay: number,
  lastDate: ISODate,
  engagement: number,
): OnboardingTask[] {
  const pDone = Math.min(0.97, 0.15 + 0.95 * engagement);
  return TEMPLATE.filter((t) => !t.departments || t.departments.includes(department)).map(
    (t, i) => {
      const base: OnboardingTask = {
        id: `${id}-T${i + 1}`,
        kind: t.kind,
        title: t.title,
        dueDay: t.dueDay,
        responsible: t.responsible,
        status: 'open',
      };
      if (t.dueDay >= endDay || rnd() >= pDone) return base;
      const lag = Math.floor(rnd() * (engagement < 0.5 ? 8 : 3));
      let completedOn = addDays(hireDate, t.dueDay + lag);
      if (daysBetween(completedOn, lastDate) < 0) completedOn = lastDate;
      return { ...base, status: 'done', completedOn };
    },
  );
}

export function generateEmployees(seed: number, asOf: ISODate, count = 120): Employee[] {
  const rnd = createRng(seed);
  const employees: Employee[] = [];
  const usedNames = new Set<string>();
  for (let i = 0; i < count; i++) {
    const id = `E-${String(i + 1).padStart(3, '0')}`;
    const daysSinceHire = Math.floor(rnd() * 365);
    const hireDate = addDays(asOf, -daysSinceHire);
    const department = pickDepartment(rnd);
    const engagement = rnd();
    const leaveTenure = planLeaveTenure(rnd, engagement);
    const left = leaveTenure !== undefined && leaveTenure <= daysSinceHire;
    const endDay = left ? (leaveTenure as number) : daysSinceHire;
    const leaveDate = left ? addDays(hireDate, leaveTenure as number) : undefined;
    const employee: Employee = {
      id,
      fullName: uniquePersonName(rnd, usedNames),
      position: pick(rnd, POSITIONS[department]),
      department,
      location: pick(rnd, LOCATIONS[department]),
      hireDate,
      managerName: personName(rnd),
      mentorName: personName(rnd),
      status: left ? 'left' : 'active',
      tasks: buildTasks(rnd, id, department, hireDate, endDay, leaveDate ?? asOf, engagement),
    };
    if (left && leaveDate) {
      employee.leaveDate = leaveDate;
      employee.leaveReason = pick(rnd, LEAVE_REASONS);
    }
    employees.push(employee);
  }
  return employees;
}
