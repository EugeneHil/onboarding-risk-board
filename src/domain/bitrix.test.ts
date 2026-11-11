import { buildBitrixTask } from './bitrix';
import { evaluateRisk } from './rules';
import { makeEmployee, makeTask } from '../test/factories';

const ASOF = '2026-11-11';

function highRisk(name = 'Иванов Иван') {
  const employee = makeEmployee({
    fullName: name,
    hireDate: '2026-10-01',
    tasks: [makeTask({ dueDay: 2 }), makeTask({ kind: 'mentor_meeting', dueDay: 5 })],
  });
  return { employee, risk: evaluateRisk(employee, ASOF) };
}

describe('buildBitrixTask', () => {
  it('targets tasks.task.add with a deadline two days out at 18:00 Moscow time', () => {
    const { employee, risk } = highRisk();
    const p = buildBitrixTask(employee, risk, ASOF);
    expect(p.method).toBe('tasks.task.add');
    expect(p.fields.DEADLINE).toBe('2026-11-13T18:00:00+03:00');
  });

  it('uses high priority for a high-risk newcomer and normal otherwise', () => {
    const { employee, risk } = highRisk();
    expect(risk.level).toBe('high');
    expect(buildBitrixTask(employee, risk, ASOF).fields.PRIORITY).toBe('2');
    const calm = makeEmployee({ hireDate: ASOF });
    expect(buildBitrixTask(calm, evaluateRisk(calm, ASOF), ASOF).fields.PRIORITY).toBe('1');
  });

  it('puts the name, reasons and next action into the task', () => {
    const { employee, risk } = highRisk();
    const f = buildBitrixTask(employee, risk, ASOF).fields;
    expect(f.TITLE).toBe('Связаться с новичком: Иванов Иван');
    expect(f.DESCRIPTION).toContain(risk.reasons[0]!.text);
    expect(f.DESCRIPTION).toContain(risk.nextAction);
  });

  it('survives JSON round-trip for names with quotes', () => {
    const { employee, risk } = highRisk('Иван "Ваня" Петров');
    const payload = buildBitrixTask(employee, risk, ASOF);
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
    expect(payload.fields.TITLE).toContain('"Ваня"');
  });
});
