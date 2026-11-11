import { parseTable } from './table';

describe('parseTable (delimited)', () => {
  it('reads a semicolon CSV with BOM and CRLF line endings', () => {
    const t = parseTable('﻿ФИО;Должность\r\nИванов Иван;Кладовщик\r\nПетрова Анна;Кассир\r\n');
    expect(t.error).toBeUndefined();
    expect(t.rows).toEqual([
      { ФИО: 'Иванов Иван', Должность: 'Кладовщик' },
      { ФИО: 'Петрова Анна', Должность: 'Кассир' },
    ]);
  });

  it('reads comma- and tab-separated files', () => {
    expect(parseTable('name,position\nA,B').rows).toEqual([{ name: 'A', position: 'B' }]);
    expect(parseTable('name\tposition\nA\tB').rows).toEqual([{ name: 'A', position: 'B' }]);
  });

  it('handles quoted cells with the delimiter, doubled quotes and line breaks', () => {
    const t = parseTable('name;note\n"Иванов; Иван";"он сказал ""привет"""\n"Мульти";"строка1\nстрока2"');
    expect(t.rows).toEqual([
      { name: 'Иванов; Иван', note: 'он сказал "привет"' },
      { name: 'Мульти', note: 'строка1\nстрока2' },
    ]);
  });

  it('ignores blank lines and trims headers', () => {
    const t = parseTable(' name ; position \n\nA;B\n   \n');
    expect(t.rows).toEqual([{ name: 'A', position: 'B' }]);
  });

  it('fills missing cells of a short row with empty strings', () => {
    expect(parseTable('a;b;c\n1;2').rows).toEqual([{ a: '1', b: '2', c: '' }]);
  });

  it('reports an error for empty text and for a header without data', () => {
    expect(parseTable('').error).toBeDefined();
    expect(parseTable('   \n ').error).toBeDefined();
    expect(parseTable('name;position\n').error).toMatch(/нет строк/i);
  });
});

describe('parseTable (JSON)', () => {
  it('reads an array of objects and stringifies values', () => {
    const t = parseTable('[{"name":"A","hired":"2026-01-01","id":7}]');
    expect(t.rows).toEqual([{ name: 'A', hired: '2026-01-01', id: '7' }]);
  });

  it('finds the list inside a Bitrix24 style response', () => {
    const t = parseTable('{"result":{"tasks":[{"title":"X"}]}}');
    expect(t.rows).toEqual([{ title: 'X' }]);
    expect(parseTable('{"items":[{"title":"Y"}]}').rows).toEqual([{ title: 'Y' }]);
  });

  it('reports broken JSON and JSON without a list', () => {
    expect(parseTable('[{"name":').error).toMatch(/JSON/);
    expect(parseTable('{"a":1}').error).toMatch(/список/i);
  });
});

describe('parseTable unclosed quote', () => {
  it('reports an error instead of silently merging the rest of the file into one cell', () => {
    const t = parseTable('name;note\nA;"unclosed\nB;ok');
    expect(t.error).toMatch(/кавыч/);
    expect(t.rows).toEqual([]);
  });
});
