import { addDays } from './dates';
import { buildBoard } from './board';
import { makeEmployee } from '../test/factories';

const ASOF = '2026-11-11';
const hired = (n: number, id: string, over = {}) =>
  makeEmployee({ id, hireDate: addDays(ASOF, -n), ...over });

describe('buildBoard', () => {
  it('keeps tenure days 0 and 90, drops day 91, leavers and future hires', () => {
    const rows = buildBoard(
      [
        hired(0, 'd0'),
        hired(90, 'd90'),
        hired(91, 'd91'),
        hired(20, 'left', { status: 'left', leaveDate: addDays(ASOF, -1) }),
        makeEmployee({ id: 'future', hireDate: addDays(ASOF, 3) }),
      ],
      ASOF,
    );
    expect(rows.map((r) => r.employee.id).sort()).toEqual(['d0', 'd90']);
  });

  it('sorts by score descending, ties by tenure day ascending', () => {
    const rows = buildBoard(
      [hired(5, 'e5'), hired(90, 'e90'), hired(0, 'e0'), hired(20, 'e20')],
      ASOF,
    );
    expect(rows.map((r) => r.employee.id)).toEqual(['e20', 'e90', 'e0', 'e5']);
  });

  it('returns an empty board for no employees', () => {
    expect(buildBoard([], ASOF)).toEqual([]);
  });
});
