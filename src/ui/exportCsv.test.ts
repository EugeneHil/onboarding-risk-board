import { addDays } from '../domain/dates';
import { buildBoard } from '../domain/board';
import { makeEmployee, makeTask } from '../test/factories';
import { boardToCsv } from './exportCsv';

const ASOF = '2026-11-11';
const hired = (n: number) => addDays(ASOF, -n);

const rowsFor = (...overrides: Parameters<typeof makeEmployee>[0][]) =>
  buildBoard(
    overrides.map((o) => makeEmployee({ hireDate: hired(30), tasks: [makeTask({ dueDay: 2 })], ...o })),
    ASOF,
  );

describe('boardToCsv', () => {
  it('starts with a BOM and a Russian header row so Excel opens it correctly', () => {
    const csv = boardToCsv([]);
    expect(csv.startsWith('﻿Сотрудник;Должность;Подразделение;День;Риск;Балл;Причины;Что сделать')).toBe(true);
  });

  it('writes one line per board row with level, score and ALL reasons', () => {
    const rows = rowsFor({ id: 'a', fullName: 'Козлов Олег', position: 'Кладовщик', department: 'warehouse' });
    const risk = rows[0]!.risk;
    const lines = boardToCsv(rows).split('\r\n');
    expect(lines).toHaveLength(2);
    const line = lines[1] ?? '';
    const cells = line.split(';');
    expect(cells[0]).toBe('Козлов Олег');
    expect(cells[1]).toBe('Кладовщик');
    expect(cells[2]).toBe('Склад');
    expect(cells[3]).toBe('30');
    expect(cells[5]).toBe(String(risk.score));
    expect(risk.reasons.length).toBeGreaterThan(0);
    for (const reason of risk.reasons) expect(line).toContain(reason.text);
  });

  it('quotes cells that contain the separator, quotes or line breaks', () => {
    const rows = rowsFor({ fullName: 'Иванов; "Ваня"\nИван' });
    const csv = boardToCsv(rows);
    expect(csv).toContain('"Иванов; ""Ваня""\nИван"');
  });

  it('neutralises spreadsheet formulas in text coming from an uploaded file', () => {
    const rows = rowsFor({ fullName: '=HYPERLINK("http://x")', position: '+1 call' });
    const csv = boardToCsv(rows);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+1 call");
    expect(csv).not.toMatch(/(^|;)=HYPERLINK/m);
  });
});
