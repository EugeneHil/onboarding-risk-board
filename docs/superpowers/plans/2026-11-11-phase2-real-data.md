# Phase 2: Real-Data Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline, TDD). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the board usable on the company's own data on day one, and make its one unverified assumption explicit: (a) state the data assumption and the minimal data contract, (b) import a hire/leaver table (and optional onboarding tasks) in the browser, (c) show empirical attrition analytics (Kaplan-Meier survival, early-exit rates by group), (d) prove accessibility with axe-core.

**Architecture:** New pure modules `src/import/*` (table parsing, row mapping with per-row issues) and `src/domain/attrition.ts` (survival, early-exit rates, history board). The UI keeps one dataset in `App` state (demo by default, replaced by an import) and gains two hash routes: `#/analytics` and `#/import`. Everything stays client-side; files never leave the browser.

**Tech Stack:** unchanged, plus `axe-core` (dev only).

**Spec:** the chat discussion (approved by the user: items 1, 2, 4 of the extra-mile proposal; item 3, a backtest, only if time remains) and `2026-11-11-onboarding-risk-board.md` (phase 1 plan, which this extends).

## Global Constraints

- Same as phase 1: English in the repo (exception: `REPORT.md` bilingual), Russian UI text, no new runtime dependencies, UTC `YYYY-MM-DD` dates, no `new Date()` for "today" in domain code (the as-of date is always an input).
- Imported files are parsed in the browser only; no network calls. The UI says so.
- A bad row never crashes the import: it is skipped and reported with its row number and a Russian message. A completely unusable file yields an error message, not an exception.
- Statistics are honest: early-exit rates use only complete cohorts (hired at least 90 days before the as-of date); the survival curve treats active employees as censored; groups with fewer than 10 hires are labelled "мало данных".
- Without onboarding tasks in the dataset, rule-based risk is not shown (it would invent "no mentor meeting" for everyone). The board then shows a history-based view and says why.
- Hard stop for new work: 18:30 local time. Then verification, deploy, report.

## Review Focus

- CSV exported from Russian Excel: `;` delimiter, UTF-8 BOM, `DD.MM.YYYY` dates, quoted cells with `;` and doubled quotes, CRLF line endings, a trailing empty line.
- A leaver whose leave date is before the hire date, a hire date after the as-of date, missing hire date, duplicate ids: reported rows, import continues.
- Kaplan-Meier with ties, with everyone still active (curve stays at 1, no divide by zero), and with an empty list.
- A cohort smaller than 10 hires shows "мало данных" instead of a confident percentage; zero eligible hires shows a dash, not `NaN%`.
- A tasks file referring to an unknown employee id, or with a due date before the hire date.

## File Structure

```
src/import/table.ts       parseTable(text): { rows, error? }  (CSV/JSON, delimiter sniffing)
src/import/fields.ts      header aliases, date and department normalisation helpers
src/import/people.ts      importPeople(rows, asOf), importTasks(rows, employees)
src/domain/attrition.ts   survivalCurve, earlyExitRates, buildHistoryBoard
src/ui/Nav.tsx, AnalyticsScreen.tsx, SurvivalChart.tsx, ImportScreen.tsx, HistoryBoard.tsx
public/samples/people.csv, tasks.csv     downloadable templates (semicolon CSV, Russian headers, DD.MM.YYYY)
docs/data-contract.md     what to export from Bitrix24, field aliases
```

---

### Task 1: State the assumption and the data contract

**Files:** Create `docs/data-contract.md`; Modify `README.md`, `REPORT.md`, `src/ui/App.tsx` (footer note).

- [ ] **Step 1:** Write `docs/data-contract.md` (English): the assumption (the company says hiring and dismissal run as Bitrix24 tasks; an onboarding checklist is NOT confirmed), the minimal people table (name, position, department, hire date; leave date and reason for leavers), the optional tasks table, accepted headers (English and Russian), accepted date formats, and how to obtain them from `tasks.task.list`.
- [ ] **Step 2:** `README.md`: add "Assumption" and link the contract. `REPORT.md`: name the assumption in item 2 and item 6 (RU and EN), without changing the item count.
- [ ] **Step 3:** `App.tsx`: a short footer under the board: "Допущение: у вас есть цепочка задач адаптации в Битрикс24. Если нет, откройте «Свои данные»." Test (in `src/ui/BoardTable.test.tsx`): the footer text is present. RED first.
- [ ] **Step 4:** `npm test` green.

### Task 2: Free-text departments

**Files:** Modify `src/domain/types.ts`, `src/ui/labels.ts`, `src/ui/App.tsx`, `src/ui/BoardTable.tsx`, `src/ui/EmployeeCard.tsx`; Test: `src/ui/labels.test.ts`.

**Interfaces:** Produces `type Department = string`; `departmentLabel(d: string): string` (known demo keys `warehouse|store|sales|office` map to Russian labels, anything else is shown as is); `departmentsOf(employees: Employee[]): string[]` (sorted distinct values).

- [ ] **Step 1:** Write failing tests: `departmentLabel('warehouse') === 'Склад'`, `departmentLabel('Логистика') === 'Логистика'`, `departmentsOf` returns distinct sorted values.
- [ ] **Step 2:** Run, see RED. Implement; replace `DEPARTMENT_LABEL[...]` uses with `departmentLabel(...)`; the department filter options come from `departmentsOf(employees)` (labels via `departmentLabel`).
- [ ] **Step 3:** Whole suite green (existing tests must pass unchanged).

### Task 3: Table parser

**Files:** Create `src/import/table.ts`; Test: `src/import/table.test.ts`.

**Interfaces:** `parseTable(text: string): { rows: Array<Record<string, string>>; error?: string }`. Header names are returned as found (trimmed, BOM removed). JSON input: an array of objects (values stringified) or an object with an array under `items` or `result.tasks`.

- [ ] **Step 1:** Failing tests: `;`-delimited with BOM and CRLF; `,`-delimited; tab-delimited; quoted cell containing `;` and a doubled quote; trailing empty line ignored; empty text gives `error`; JSON array; JSON `{ "result": { "tasks": [...] } }`; ragged row (fewer cells) fills with empty strings.
- [ ] **Step 2:** RED, then implement a small state-machine CSV reader (no regex splitting) and delimiter sniffing on the header line (the most frequent of `;`, `,`, tab outside quotes).
- [ ] **Step 3:** Green.

### Task 4: Row mapping with per-row issues

**Files:** Create `src/import/fields.ts`, `src/import/people.ts`; Test: `src/import/people.test.ts`.

**Interfaces:**
- `interface ImportIssue { row: number; message: string }` (row is the 1-based data row number)
- `parseDate(s: string): ISODate | undefined` (`YYYY-MM-DD`, `DD.MM.YYYY`, ISO datetime; validates the calendar date)
- `importPeople(rows, asOf: ISODate): { employees: Employee[]; issues: ImportIssue[] }`
- `importTasks(rows, employees: Employee[]): { employees: Employee[]; issues: ImportIssue[] }` (returns new employee objects with tasks attached)
- `inferTaskKind(title: string): TaskKind` (keywords: наставник, инструктаж/безопасн, документ/оформл, обучен, разговор/встреч/чекин/check, обратн/feedback; fallback `'other'`); `TaskKind` gains `'other'`.
- Header aliases (case-insensitive): name = `full_name|name|фио|сотрудник`; position = `position|должность`; department = `department|подразделение|отдел`; hire = `hire_date|hired|дата приёма|дата приема|принят`; leave = `leave_date|fired|дата увольнения|уволен`; reason = `leave_reason|причина увольнения|причина`; id = `id|табельный номер|employee_id`; manager = `manager|руководитель`; mentor = `mentor|наставник`.

- [ ] **Step 1:** Failing tests: Russian headers and `DD.MM.YYYY` map to the right Employee fields; `status` is `'left'` iff a valid leave date exists; missing id gets `R-001`, `R-002`; row without name or hire date is skipped with an issue; leave before hire is skipped with an issue; hire after as-of is skipped with an issue; duplicate id is skipped with an issue; missing required column yields one issue and no employees. `importTasks`: attaches by id; unknown id gives an issue; `completed_on` present means done; `due_date` is converted to `dueDay` relative to the hire date, negative gives an issue; `inferTaskKind('Встреча с наставником')` is `mentor_meeting`.
- [ ] **Step 2:** RED, implement, green.

### Task 5: Attrition analytics

**Files:** Create `src/domain/attrition.ts`; Test: `src/domain/attrition.test.ts`.

**Interfaces:**
- `interface SurvivalPoint { day: number; survival: number; atRisk: number }`
- `survivalCurve(employees: Employee[], asOf: ISODate, horizon = 180): SurvivalPoint[]` (Kaplan-Meier, one point per day 0..horizon; leavers are events at their tenure, active employees are censored at their tenure)
- `survivalAt(curve: SurvivalPoint[], day: number): number`
- `interface ExitRate { key: string; hires: number; leftEarly: number; rate: number | undefined; fewData: boolean }`
- `earlyExitRates(employees, asOf, keyOf: (e: Employee) => string, window = 90): ExitRate[]` (only employees hired at least `window` days before `asOf`; `rate` is `undefined` when there are no eligible hires; `fewData` when `hires < 10`; sorted by rate descending, undefined last)
- `interface HistoryRow { employee: Employee; tenureDay: number; groupRate: number | undefined; fewData: boolean }`
- `buildHistoryBoard(employees, asOf): HistoryRow[]` (active, tenure 0..90, rate of the employee's department; sorted by rate descending then tenure ascending)

- [ ] **Step 1:** Failing tests: curve with 10 people and 2 known exits equals the hand-computed product; ties on one day; everyone active gives survival 1 for all days; empty list gives survival 1 and `atRisk` 0; a person hired after the as-of date is ignored; `earlyExitRates` excludes cohorts younger than 90 days, flags `fewData`, gives `rate undefined` for zero eligible; history board excludes leavers and day 91+.
- [ ] **Step 2:** RED, implement, green.

### Task 6: Navigation and analytics screen

**Files:** Create `src/ui/Nav.tsx`, `src/ui/AnalyticsScreen.tsx`, `src/ui/SurvivalChart.tsx`; Modify `src/ui/useHashRoute.ts`, `src/ui/App.tsx`; Test: `src/ui/analytics.test.tsx`.

**Interfaces:** `Route` gains `{ name: 'analytics' }` and `{ name: 'import' }` (hashes `#/analytics`, `#/import`). `<Nav active={'board'|'analytics'|'import'} />` renders links. `<SurvivalChart curve={SurvivalPoint[]} />` is an inline SVG (role `img`, with an `aria-label` that states survival at day 30, 90 and 180). The analytics screen shows: headline numbers (hires, leavers, survival at day 90 and the share who left before day 90 among complete cohorts), the survival chart, and early-exit tables by department and by position, with "мало данных" labels and a footer explaining the method (Kaplan-Meier, complete cohorts only).

- [ ] **Step 1:** Failing tests: `parseHash('#/analytics')` and `parseHash('#/import')`; analytics screen on the demo data shows the survival chart with a label containing "90", a department table whose first row has the highest rate, and the "мало данных" label for a fixture group of 3 hires; a dash instead of `NaN` for a group with no eligible hires.
- [ ] **Step 2:** RED, implement, green. Page titles: "Аналитика ухода · Адаптация новичков" and "Свои данные · Адаптация новичков".

### Task 7: Import screen, dataset state, history board

**Files:** Create `src/ui/ImportScreen.tsx`, `src/ui/HistoryBoard.tsx`; Modify `src/ui/App.tsx`; Test: `src/ui/import.test.tsx`.

**Interfaces:** `App` keeps `dataset: { employees: Employee[]; asOf: ISODate; source: 'demo' | 'import' }` in state, initialised from props. `<ImportScreen onUse={(d) => void} onReset={() => void} source={...} />` has two file inputs (people required, tasks optional), an as-of date input (default: the latest date found in the people file), a result summary (rows imported, rows skipped, the first 5 issues), a "Использовать эти данные" button and a "Вернуться к демо" button, and the sentence that files are processed in the browser only. Without tasks in the dataset the board renders `<HistoryBoard rows={...} />` with an explanation instead of risk levels; the banner says "Загруженные данные" instead of "Демо-данные" for an import.

- [ ] **Step 1:** Failing tests (jsdom, `File` objects with `.text()`): uploading a semicolon CSV with Russian headers shows "Импортировано: N"; a file with one bad row shows the skipped count and its issue; "Использовать" switches the app to the board of the imported people; without a tasks file the board shows the history view and the explanation (and no risk badges); with a tasks file it shows risk badges; "Вернуться к демо" restores the demo board; the banner text changes with the source.
- [ ] **Step 2:** RED, implement, green. Add `public/samples/people.csv` and `public/samples/tasks.csv` (semicolon, Russian headers, `DD.MM.YYYY`, 12 and 20 rows) and download links.

### Task 8: Accessibility proof, browser check, docs, deploy

**Files:** Modify `package.json` (dev dependency `axe-core`), `scripts/browser-check.mjs`, `README.md`, `REPORT.md`; fix whatever axe finds.

- [ ] **Step 1:** In `browser-check.mjs`, inject `node_modules/axe-core/axe.min.js` and assert zero violations on: board, card, analytics, import. Also check the import path end to end in Chrome using `public/samples` files (upload via `elementHandle.uploadFile`), the analytics screen, and the same checks on mobile width.
- [ ] **Step 2:** Run it, fix real violations in CSS or markup (do not disable rules), rerun until clean; if a violation is a false positive, record it in the ledger with the reason.
- [ ] **Step 3:** Update README (import, analytics, data contract) and REPORT (RU and EN, counts from real runs, honest limits: analytics on the demo is synthetic; real value needs their data).
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit`, `npm run build`, browser check locally, then commit, push, wait for the Pages deploy, run the browser check against the live URL.

### Task 9 (only if time remains before 18:30): Backtest of the rules

- [ ] `backtest(employees, asOf, cutDay)` evaluates each employee as of `hireDate + cutDay` (tasks counted done only if `completedOn` is not later than the cut) among those with tenure above `cutDay`, and reports flagged share among eventual early leavers vs among stayers. UI block on the analytics screen labelled as circular on synthetic data. Same TDD cycle.

---

## Self-review notes

- Spec coverage: item 1 (Task 1), item 2 (Tasks 2-7), item 4 (Task 8), item 3 (Task 9, optional).
- Interfaces are defined where first produced; `Department` becomes `string` in Task 2 before the importer in Task 4 relies on it. `TaskKind` gains `'other'` in Task 4; `TASK_KIND_LABEL` must gain it there too (compile error otherwise).
