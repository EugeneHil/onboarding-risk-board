import type { Employee, ISODate } from '../domain/types';
import { generateEmployees } from './generate';

/** Fixed "today" of the demo so the data is reproducible. */
export const DEMO_AS_OF: ISODate = '2026-11-11';

export const DEMO_EMPLOYEES: Employee[] = generateEmployees(22, DEMO_AS_OF);
