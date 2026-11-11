import type { Employee, OnboardingTask } from '../domain/types';

let counter = 0;

export function makeTask(over: Partial<OnboardingTask> = {}): OnboardingTask {
  counter += 1;
  return {
    id: `t${counter}`,
    kind: 'docs',
    title: 'Тестовая задача',
    dueDay: 1,
    status: 'open',
    responsible: 'hr',
    ...over,
  };
}

export function makeEmployee(over: Partial<Employee> = {}): Employee {
  counter += 1;
  return {
    id: `e${counter}`,
    fullName: 'Тестов Тест',
    position: 'Продавец-консультант',
    department: 'store',
    location: 'Магазин «Центр»',
    hireDate: '2026-10-22',
    managerName: 'Руководитель Тестовый',
    status: 'active',
    tasks: [],
    ...over,
  };
}
