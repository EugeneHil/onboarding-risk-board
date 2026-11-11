import peopleCsv from '../../public/samples/people.csv?raw';
import tasksCsv from '../../public/samples/tasks.csv?raw';
import { importPeople, importTasks, latestDate } from './people';
import { parseTable } from './table';


describe('downloadable sample files', () => {
  it('import without a single issue and link tasks to people', () => {
    const people = parseTable(peopleCsv);
    const tasks = parseTable(tasksCsv);
    expect(people.error).toBeUndefined();
    expect(tasks.error).toBeUndefined();
    const asOf = latestDate(people.rows)!;
    const p = importPeople(people.rows, asOf);
    expect(p.issues).toEqual([]);
    expect(p.employees).toHaveLength(12);
    const t = importTasks(tasks.rows, p.employees);
    expect(t.issues).toEqual([]);
    expect(t.employees.reduce((n, e) => n + e.tasks.length, 0)).toBe(20);
  });
});
