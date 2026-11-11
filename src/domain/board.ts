import { evaluateRisk, RISK_WINDOW_DAYS } from './rules';
import type { BoardRow, Employee, ISODate } from './types';

/** Active newcomers in their first 90 days, riskiest first. */
export function buildBoard(employees: Employee[], asOf: ISODate): BoardRow[] {
  return employees
    .filter((e) => e.status === 'active')
    .map((employee) => ({ employee, risk: evaluateRisk(employee, asOf) }))
    .filter((row) => row.risk.tenureDay >= 0 && row.risk.tenureDay <= RISK_WINDOW_DAYS)
    .sort((a, b) => b.risk.score - a.risk.score || a.risk.tenureDay - b.risk.tenureDay);
}
