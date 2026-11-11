import { addDays } from './dates';
import type { Employee, ISODate, RiskResult } from './types';

/** Placeholder: in a real install this is the HR user's Bitrix24 id. */
export const PLACEHOLDER_RESPONSIBLE_ID = 1001;

export interface BitrixTaskPayload {
  method: 'tasks.task.add';
  fields: {
    TITLE: string;
    DESCRIPTION: string;
    RESPONSIBLE_ID: number;
    DEADLINE: string;
    PRIORITY: '1' | '2';
  };
}

/** Shape of a Bitrix24 `tasks.task.add` call. It is only displayed, never sent. */
export function buildBitrixTask(
  employee: Employee,
  risk: RiskResult,
  asOf: ISODate,
): BitrixTaskPayload {
  const reasons = risk.reasons.map((r) => `- ${r.text}`).join('\n');
  const description = [
    `Новичок: ${employee.fullName}, ${employee.position}, ${employee.location}.`,
    `День адаптации: ${risk.tenureDay}.`,
    reasons ? `Причины:\n${reasons}` : 'Причин для беспокойства нет.',
    `Что сделать: ${risk.nextAction}`,
  ].join('\n');
  return {
    method: 'tasks.task.add',
    fields: {
      TITLE: `Связаться с новичком: ${employee.fullName}`,
      DESCRIPTION: description,
      RESPONSIBLE_ID: PLACEHOLDER_RESPONSIBLE_ID,
      DEADLINE: `${addDays(asOf, 2)}T18:00:00+03:00`,
      PRIORITY: risk.level === 'high' ? '2' : '1',
    },
  };
}
