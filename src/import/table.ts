export interface ParsedTable {
  rows: Array<Record<string, string>>;
  /** Spreadsheet row of each data row (header = row 1, blank lines counted); absent for JSON. */
  sourceRows?: number[];
  error?: string;
}

const NO_ROWS = 'В файле нет строк с данными';

/** Reads CSV (`;`, `,` or tab) or JSON into rows of strings. Never throws. */
export function parseTable(text: string): ParsedTable {
  const src = text.replace(/^﻿/, '');
  const trimmed = src.trim();
  if (trimmed === '') return { rows: [], error: 'Файл пустой' };
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return parseJson(trimmed);
  return parseDelimited(src);
}

function parseJson(text: string): ParsedTable {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { rows: [], error: 'Не удалось разобрать JSON: проверьте файл' };
  }
  const list = findList(value);
  if (!list) return { rows: [], error: 'В JSON не найден список записей' };
  const rows = list
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => {
      const row: Record<string, string> = {};
      for (const [key, v] of Object.entries(item)) {
        row[key] = v === null || v === undefined || typeof v === 'object' ? '' : String(v);
      }
      return row;
    });
  return rows.length > 0 ? { rows } : { rows: [], error: NO_ROWS };
}

function findList(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'object' || value === null) return undefined;
  const obj = value as Record<string, unknown>;
  const result = obj.result;
  const candidates: unknown[] = [
    obj.items,
    result,
    typeof result === 'object' && result !== null ? (result as Record<string, unknown>).tasks : undefined,
    typeof result === 'object' && result !== null ? (result as Record<string, unknown>).items : undefined,
  ];
  return candidates.find((c): c is unknown[] => Array.isArray(c));
}

function sniffDelimiter(text: string): string {
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === '\n' || ch === '\r')) break;
    else if (!inQuotes && ch in counts) counts[ch] = (counts[ch] ?? 0) + 1;
  }
  const best = (['\t', ';', ','] as const).reduce((a, b) => ((counts[b] ?? 0) > (counts[a] ?? 0) ? b : a));
  return (counts[best] ?? 0) > 0 ? best : ',';
}

function splitRecords(text: string, delimiter: string): { records: string[][]; unclosed: boolean } {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = '';
  let inQuotes = false;
  const endCell = () => {
    record.push(cell);
    cell = '';
  };
  const endRecord = () => {
    endCell();
    records.push(record);
    record = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      endCell();
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      endRecord();
    } else if (ch === '\n') {
      endRecord();
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || record.length > 0) endRecord();
  return { records, unclosed: inQuotes };
}

function parseDelimited(text: string): ParsedTable {
  const split = splitRecords(text, sniffDelimiter(text));
  if (split.unclosed) {
    return { rows: [], error: 'В файле есть незакрытая кавычка: проверьте ячейки с текстом в кавычках' };
  }
  const numbered = split.records
    .map((record, i) => ({ record, spreadsheetRow: i + 1 }))
    .filter(({ record }) => record.some((c) => c.trim() !== ''));
  const header = numbered[0]?.record.map((h) => h.trim());
  if (!header) return { rows: [], error: 'Файл пустой' };
  const body = numbered.slice(1);
  const rows = body.map(({ record }) => {
    const row: Record<string, string> = {};
    header.forEach((name, i) => {
      if (name !== '') row[name] = record[i] ?? '';
    });
    return row;
  });
  return rows.length > 0
    ? { rows, sourceRows: body.map((b) => b.spreadsheetRow) }
    : { rows: [], error: NO_ROWS };
}
