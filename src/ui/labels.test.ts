import { makeEmployee } from '../test/factories';
import { departmentLabel, departmentsOf } from './labels';

describe('departmentLabel', () => {
  it('translates the known demo keys', () => {
    expect(departmentLabel('warehouse')).toBe('Склад');
    expect(departmentLabel('store')).toBe('Магазин');
  });

  it('shows any other department as it is written', () => {
    expect(departmentLabel('Логистика')).toBe('Логистика');
  });

  it('shows a placeholder for an empty department', () => {
    expect(departmentLabel('')).toBe('Не указано');
  });
});

describe('departmentsOf', () => {
  it('returns distinct values sorted by their label', () => {
    const list = [
      makeEmployee({ department: 'store' }),
      makeEmployee({ department: 'Логистика' }),
      makeEmployee({ department: 'store' }),
      makeEmployee({ department: 'warehouse' }),
    ];
    expect(departmentsOf(list)).toEqual(['Логистика', 'store', 'warehouse']);
  });
});
