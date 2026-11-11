import type { Employee, RiskLevel, TaskKind } from '../domain/types';

const DEPARTMENT_LABEL: Record<string, string> = {
  warehouse: 'Склад',
  store: 'Магазин',
  sales: 'Отдел продаж',
  office: 'Офис',
};

/** Known demo keys get a Russian label; anything else is shown as written. */
export function departmentLabel(department: string): string {
  if (department.trim() === '') return 'Не указано';
  return DEPARTMENT_LABEL[department] ?? department;
}

/** Distinct departments of the dataset, sorted by their displayed label. */
export function departmentsOf(employees: Employee[]): string[] {
  return [...new Set(employees.map((e) => e.department))].sort((a, b) =>
    departmentLabel(a).localeCompare(departmentLabel(b), 'ru'),
  );
}

export const LEVEL_LABEL: Record<RiskLevel, string> = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  docs: 'Документы',
  safety: 'Техника безопасности',
  mentor_meeting: 'Наставник',
  training: 'Обучение',
  checkin: 'Разговор с руководителем',
  feedback: 'Обратная связь HR',
};
