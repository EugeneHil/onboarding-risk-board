import type { BoardRow } from '../domain/types';
import { departmentLabel, LEVEL_LABEL } from './labels';

const SEP = ';'; // semicolon: what Excel expects in Russian locales
const HEADER = ['Сотрудник', 'Должность', 'Подразделение', 'День', 'Риск', 'Балл', 'Причины', 'Что сделать'];

/** Text from an uploaded file must not run as a spreadsheet formula when the export is opened. */
function safe(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function cell(text: string): string {
  const value = safe(text);
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The board as a CSV for the "who to call" list (UTF-8 with BOM, ';' separated, CRLF lines). */
export function boardToCsv(rows: BoardRow[]): string {
  const lines = [HEADER.map(cell).join(SEP)];
  for (const { employee, risk } of rows) {
    lines.push(
      [
        employee.fullName,
        employee.position,
        departmentLabel(employee.department),
        String(risk.tenureDay),
        LEVEL_LABEL[risk.level],
        String(risk.score),
        risk.reasons.map((r) => r.text).join(' | '),
        risk.nextAction,
      ]
        .map(cell)
        .join(SEP),
    );
  }
  return '﻿' + lines.join('\r\n');
}
