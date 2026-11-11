import type { Department, RiskLevel, TaskKind } from '../domain/types';

export const DEPARTMENT_LABEL: Record<Department, string> = {
  warehouse: 'Склад',
  store: 'Магазин',
  sales: 'Отдел продаж',
  office: 'Офис',
};

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
