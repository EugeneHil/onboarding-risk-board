# Onboarding Risk Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static web board for HR and line managers that lists newcomers in their first 90 days, ranks them by early-attrition risk using transparent rules over Bitrix24-style onboarding tasks, and proposes the next action (including a ready Bitrix24 task payload).

**Architecture:** Pure TypeScript domain layer (dates, risk rules, board building, stats, Bitrix payload) fed by a deterministic synthetic data generator; a thin React UI on top with hash routing. No backend, no network calls; everything is bundled and served statically.

**Tech Stack:** Vite, React 18, TypeScript, Vitest, @testing-library/react, jsdom. GitHub Pages via GitHub Actions.

**Spec:** No separate design document: the user opted out of the brainstorming questions. The design is the agreed scope from the chat (risk board for HR, transparent rules, no ML, synthetic data, static deploy) and the task statement in `../../../../Тестовое задание.txt` (company context: ~400 staff, 100+ hires/year, one in three leavers quits before 3 months, hiring runs as Bitrix24 tasks).

## Global Constraints

- Project root is the repository root. Node >= 20. Runtime deps: `react`, `react-dom` only. No chart library, no CSS framework.
- Everything in the repo is English (code, comments, docs, commit messages), with one explicit exception approved by the user: the final report `REPORT.md` is bilingual (Russian first, English second), because the task statement addresses it to the company in Russian. User-facing UI text and the generated demo data (names, positions, task titles, reason texts, Bitrix payload text) are Russian.
- Dates are `YYYY-MM-DD` strings handled in UTC; no `new Date()` for "today". The as-of date is always a parameter; the demo uses `DEMO_AS_OF = '2026-11-11'`.
- Risk window is 0..90 tenure days inclusive (`RISK_WINDOW_DAYS = 90`). Thresholds: high >= 50, medium >= 25, else low. All rule numbers live in one `RULES` object in `src/domain/rules.ts`.
- Demo data is fictional: names come from random first/last name lists, no real people, no contacts. A "Демо-данные" banner is always visible.
- No ML and no claims of predictive accuracy anywhere in the UI or README.
- No `git init`, commit, push or Pages setup without the user's explicit OK; those happen in Task 8. Until then each task ends with a checkpoint (full test run) instead of a commit.
- Time box: the user's 4 hours started at "начато". Tasks 1-4 should be done within the first 80 minutes. If behind schedule, cut the tenure chart in Task 5 first, then the timeline in Task 6.

## Review Focus

- Employee hired on the as-of date (tenure day 0) with every task still ahead: no crash, no `NaN`, score 0, level `low`.
- Window edges: tenure day 90 stays on the board, day 91 and anyone with `status: 'left'` do not; a hire date in the future never appears. (Task 2)
- A task done late is not "overdue"; only open tasks past `dueDay` count, and the overdue points cap at 30. (Task 2)
- Filters or search matching nothing show an empty-state message; an unknown `#/employee/<id>` shows a "not found" view with a link back. (Tasks 5, 6)
- Case-insensitive Cyrillic search ("иванов" finds "Иванов"); a name with quotes or special characters survives in the Bitrix payload JSON. (Tasks 4, 5)

## File Structure

```
onboarding-risk-board/
  index.html, package.json, vite.config.ts, tsconfig.json, README.md
  .github/workflows/pages.yml
  src/
    domain/types.ts       shared types
    domain/dates.ts       daysBetween, addDays, formatRu
    domain/rules.ts       RULES, levelFor, evaluateRisk
    domain/board.ts       buildBoard
    domain/stats.ts       leaversByTenure, levelCounts
    domain/bitrix.ts      buildBitrixTask
    data/rng.ts           seeded PRNG
    data/generate.ts      generateEmployees
    data/demo.ts          DEMO_AS_OF, DEMO_EMPLOYEES
    test/factories.ts     makeEmployee, makeTask for tests
    ui/main.tsx, App.tsx, useHashRoute.ts, labels.ts, styles.css
    ui/Summary.tsx, BoardTable.tsx, EmployeeCard.tsx, Timeline.tsx, BitrixModal.tsx
    ui/*.test.tsx
```

---

### Task 1: Scaffold, shared types, date helpers

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/domain/types.ts`, `src/domain/dates.ts`, `src/test/factories.ts`
- Test: `src/domain/dates.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `type ISODate = string`
  - `type Department = 'warehouse' | 'store' | 'sales' | 'office'`
  - `type TaskKind = 'docs' | 'safety' | 'mentor_meeting' | 'training' | 'checkin' | 'feedback'`
  - `interface OnboardingTask { id: string; kind: TaskKind; title: string; dueDay: number; status: 'done' | 'open'; completedOn?: ISODate; responsible: 'hr' | 'manager' | 'mentor' }`
  - `interface Employee { id: string; fullName: string; position: string; department: Department; location: string; hireDate: ISODate; managerName: string; mentorName?: string; status: 'active' | 'left'; leaveDate?: ISODate; leaveReason?: string; tasks: OnboardingTask[] }`
  - `type RiskLevel = 'high' | 'medium' | 'low'`
  - `type RuleCode = 'overdue_tasks' | 'no_mentor_meeting' | 'no_two_week_checkin' | 'stalled'`
  - `interface RiskReason { code: RuleCode; text: string; points: number }`
  - `interface RiskResult { score: number; level: RiskLevel; reasons: RiskReason[]; nextAction: string; tenureDay: number }`
  - `interface BoardRow { employee: Employee; risk: RiskResult }`
- Produces (`dates.ts`): `daysBetween(from: ISODate, to: ISODate): number`, `addDays(date: ISODate, n: number): ISODate`, `formatRu(date: ISODate): string` (`'2026-11-05'` -> `'05.11.2026'`).
- Produces (`factories.ts`): `makeTask(over?: Partial<OnboardingTask>): OnboardingTask`, `makeEmployee(over?: Partial<Employee>): Employee` with neutral defaults (active, hired `2026-10-22`, no tasks).

- [ ] **Step 1: Write failing tests** in `dates.test.ts`: `daysBetween('2026-11-01','2026-11-11') === 10`; across a month and a leap boundary (`'2028-02-28'` to `'2028-03-01'` is 2); negative when `to < from`; `addDays('2026-11-30', 1) === '2026-12-01'`; `addDays('2026-03-01', -1) === '2026-02-28'`; `formatRu('2026-11-05') === '05.11.2026'`.
- [ ] **Step 2: Scaffold** the Vite React-TS project by hand (no generator): scripts `dev`, `build` (`tsc --noEmit && vite build`), `preview`, `test` (`vitest run`). `vite.config.ts` sets `base: './'` and Vitest `environment: 'jsdom'`, `globals: true`. Strict TS.
- [ ] **Step 3: Run** `npm install && npx vitest run src/domain/dates.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 4: Implement** `dates.ts` with UTC math (`Date.UTC` on parsed parts, divide by 86_400_000), plus `types.ts` and `factories.ts`.
- [ ] **Step 5: Run** `npx vitest run`. Expected: PASS.
- [ ] **Step 6: Checkpoint:** `npm test` green, `npx tsc --noEmit` clean.

### Task 2: Risk rules and board

**Files:**
- Create: `src/domain/rules.ts`, `src/domain/board.ts`
- Test: `src/domain/rules.test.ts`, `src/domain/board.test.ts`

**Interfaces:**
- Consumes: types and `daysBetween`/`addDays`; `makeEmployee`/`makeTask`.
- Produces (`rules.ts`):
  - `RISK_WINDOW_DAYS = 90`
  - `RULES`: `{ overdue: { perTask: 10, cap: 30 }, noMentorMeeting: { afterDay: 7, points: 25 }, noTwoWeekCheckin: { afterDay: 16, points: 20 }, stalled: { idleDays: 14, points: 15 }, thresholds: { high: 50, medium: 25 } }`
  - `ACTIONS: Record<RuleCode, string>` (Russian recommended action per rule, e.g. no mentor meeting -> arrange a meeting with a mentor this week)
  - `levelFor(score: number): RiskLevel`
  - `evaluateRisk(employee: Employee, asOf: ISODate, rules = RULES): RiskResult`
- Produces (`board.ts`): `buildBoard(employees: Employee[], asOf: ISODate): BoardRow[]`

Rule semantics: a task is overdue when `status === 'open'` and `tenureDay > dueDay`. `no_mentor_meeting` fires when `tenureDay > afterDay` and no `mentor_meeting` task is done. `no_two_week_checkin` fires when `tenureDay > afterDay` and the `checkin` task with `dueDay <= 14` is not done. `stalled` fires when at least one task is overdue and no task was completed in the last `idleDays` days. `nextAction` is the `ACTIONS` text of the highest-points reason, or a "no action needed" text when there are none. Reasons are sorted by points descending, each with Russian `text` including concrete numbers (for example "Просрочено задач: 3").

- [ ] **Step 1: Write failing tests** (as-of `2026-11-11`):
  - hired `2026-11-11`, all tasks open with `dueDay >= 1` -> `score 0`, `level 'low'`, `reasons []`, `tenureDay 0`.
  - hired 20 days ago, open `mentor_meeting` (due day 5) -> reasons contain `no_mentor_meeting` and `overdue_tasks`; `nextAction === ACTIONS.no_mentor_meeting`.
  - task `dueDay 1`, done with `completedOn` = hire + 5 -> no `overdue_tasks` reason.
  - five overdue open tasks -> the `overdue_tasks` reason has `points === 30`.
  - `levelFor(50) === 'high'`, `levelFor(49) === 'medium'`, `levelFor(25) === 'medium'`, `levelFor(24) === 'low'`.
  - board: active employees at tenure 0 and 90 are included, tenure 91, `status: 'left'` and a future hire date are excluded; rows sorted by `risk.score` descending, ties by `tenureDay` ascending.
- [ ] **Step 2: Run** `npx vitest run src/domain/rules.test.ts src/domain/board.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `evaluateRisk` and `buildBoard` as specified. `evaluateRisk` never divides and never reads the clock.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Checkpoint:** `npm test` green.

### Task 3: Synthetic data generator

**Files:**
- Create: `src/data/rng.ts`, `src/data/generate.ts`, `src/data/demo.ts`
- Test: `src/data/generate.test.ts`

**Interfaces:**
- Consumes: types, `addDays`, `daysBetween`, `evaluateRisk`/`buildBoard` (tests only).
- Produces: `createRng(seed: number): () => number` (mulberry32, values in `[0,1)`); `generateEmployees(seed: number, asOf: ISODate, count = 120): Employee[]`; `DEMO_AS_OF = '2026-11-11'`; `DEMO_EMPLOYEES: Employee[]` (`generateEmployees(20261111, DEMO_AS_OF)`).

Generation model: hire dates spread across the 365 days before `asOf`; each employee gets a hidden engagement value in `[0,1]` that drives (a) probability of completing each due task and with what lag, and (b) probability of leaving, with low engagement leaving early (tenure 10..85 days) and high engagement leaving rarely and late. Standard task template: docs d1 (hr), safety d2 (warehouse and store only), mentor_meeting d5 (mentor), training d10, checkin d14 (manager), feedback d30 (hr), checkin d60 (manager), feedback d90 (hr). Task titles, positions, locations, names are Russian. Tune parameters until the tests below pass; do not loosen the tests.

- [ ] **Step 1: Write failing tests:**
  - same seed -> deep-equal output; different seed -> different output.
  - 120 employees, unique ids, every `fullName` non-empty, no task with a negative `dueDay`.
  - invariants: a `left` employee has `leaveDate` between `hireDate` and `asOf`; a `done` task has `completedOn`; no `completedOn` after `asOf`.
  - share of leavers with tenure <= 90 days is within `[0.25, 0.45]` (the company's "every third").
  - `buildBoard(DEMO_EMPLOYEES, DEMO_AS_OF)` has between 20 and 45 rows, and at least 5 rows for each of `high`, `medium`, `low`.
- [ ] **Step 2: Run** `npx vitest run src/data`. Expected: FAIL.
- [ ] **Step 3: Implement** `rng.ts`, `generate.ts` and `demo.ts` as described.
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS (tune the model, not the tests).
- [ ] **Step 5: Checkpoint:** `npm test` green.

### Task 4: Stats and Bitrix payload

**Files:**
- Create: `src/domain/stats.ts`, `src/domain/bitrix.ts`
- Test: `src/domain/stats.test.ts`, `src/domain/bitrix.test.ts`

**Interfaces:**
- Consumes: types, `addDays`, `daysBetween`, `formatRu`.
- Produces:
  - `interface TenureBucket { label: string; from: number; to: number; count: number }`
  - `leaversByTenure(employees: Employee[]): TenureBucket[]` with buckets `0-14`, `15-30`, `31-60`, `61-90`, `91+` (tenure = `daysBetween(hireDate, leaveDate)`), counting only `status: 'left'`.
  - `levelCounts(rows: BoardRow[]): Record<RiskLevel, number>`
  - `interface BitrixTaskPayload { method: 'tasks.task.add'; fields: { TITLE: string; DESCRIPTION: string; RESPONSIBLE_ID: number; DEADLINE: string; PRIORITY: '1' | '2' } }`
  - `buildBitrixTask(employee: Employee, risk: RiskResult, asOf: ISODate): BitrixTaskPayload`: `TITLE` is `Связаться с новичком: <fullName>`, `DESCRIPTION` lists the risk reasons and the next action, `RESPONSIBLE_ID` is the constant `PLACEHOLDER_RESPONSIBLE_ID = 1001` (documented as a placeholder), `DEADLINE` is `addDays(asOf, 2)` at `18:00:00+03:00`, `PRIORITY` is `'2'` for high else `'1'`.

- [ ] **Step 1: Write failing tests:** buckets: leavers at tenure 14, 15, 90, 91 land in `0-14`, `15-30`, `61-90`, `91+`; active employees are not counted; `levelCounts` sums to the row count. Payload: `DEADLINE === '2026-11-13T18:00:00+03:00'` for as-of `2026-11-11`; `PRIORITY` `'2'` for high; a name with quotes (`Иван "Ваня" Петров`) survives `JSON.parse(JSON.stringify(payload))` unchanged.
- [ ] **Step 2: Run** `npx vitest run src/domain/stats.test.ts src/domain/bitrix.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both modules.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Checkpoint:** `npm test` green. Milestone: domain complete; check elapsed time against the 80-minute box.

### Task 5: Board screen (summary, filters, table)

**Files:**
- Create: `src/ui/main.tsx`, `src/ui/App.tsx`, `src/ui/useHashRoute.ts`, `src/ui/labels.ts`, `src/ui/Summary.tsx`, `src/ui/BoardTable.tsx`, `src/ui/styles.css`
- Test: `src/ui/BoardTable.test.tsx`

**Interfaces:**
- Consumes: `DEMO_EMPLOYEES`, `DEMO_AS_OF`, `buildBoard`, `levelCounts`, `leaversByTenure`, `formatRu`.
- Produces:
  - `useHashRoute(): { route: { name: 'board' } | { name: 'employee'; id: string }; navigate: (hash: string) => void }` (hash forms `#/` and `#/employee/<id>`).
  - `labels.ts`: Russian labels for departments, risk levels and task kinds.
  - `<App employees={Employee[]} asOf={ISODate} />` (props so tests can inject data).
  - `<BoardTable rows={BoardRow[]} onOpen={(id: string) => void} />`
  - `<Summary rows={BoardRow[]} leavers={TenureBucket[]} activeLevel={RiskLevel | null} onLevel={(l: RiskLevel | null) => void} />`

Screen: demo banner (with the as-of date), three clickable level tiles (count each, click toggles the level filter), a plain CSS bar chart of leavers by tenure bucket (cut first if behind schedule), filters for department and free-text search over `fullName` and `position`, then the table. Columns: name, position and department, "День N из 90", risk badge with score, the top two reasons, next action. Risk is never conveyed by colour alone (badge carries text).

- [ ] **Step 1: Write failing tests** in `BoardTable.test.tsx` rendering `<App>` with `DEMO_EMPLOYEES`: the first body row is a `high` risk row; searching `иванов` in lower case shows only matching rows (use a fixture with a known "Иванов"); a search with no matches shows the text "Никого не найдено"; clicking the `high` tile shows only high rows and clicking it again restores all.
- [ ] **Step 2: Run** `npx vitest run src/ui`. Expected: FAIL.
- [ ] **Step 3: Implement** the components and styles. Case-insensitive match via `toLocaleLowerCase('ru')`.
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS. Then `npm run dev` and eyeball the page once.
- [ ] **Step 5: Checkpoint:** `npm test` and `npx tsc --noEmit` clean.

### Task 6: Newcomer card and Bitrix modal (main scenario)

**Files:**
- Create: `src/ui/EmployeeCard.tsx`, `src/ui/Timeline.tsx`, `src/ui/BitrixModal.tsx`
- Modify: `src/ui/App.tsx` (route to the card)
- Test: `src/ui/scenario.test.tsx`

**Interfaces:**
- Consumes: `evaluateRisk`, `buildBitrixTask`, `RiskResult`, `formatRu`, `useHashRoute`.
- Produces:
  - `<EmployeeCard employee={Employee} asOf={ISODate} onBack={() => void} />`
  - `<Timeline tasks={OnboardingTask[]} tenureDay={number} />`: a 0..90 day axis with a marker for today and one marker per task, state shown by shape and text label (done / overdue / upcoming), not colour alone.
  - `<BitrixModal payload={BitrixTaskPayload} onClose={() => void} />`: `role="dialog"`, pretty-printed JSON, a "Скопировать" button that guards `navigator.clipboard` (falls back to selecting the text), closes on Escape and on the close button.

Card content: header (name, position, department, hire date, mentor, manager), risk badge with score, the reasons list with points, the recommended action, the timeline, the task table, and the "Создать задачу в Битрикс24" button. Unknown id -> "Сотрудник не найден" with a link back to the board.

- [ ] **Step 1: Write failing scenario test** in `scenario.test.tsx` (the main scenario, end to end in jsdom): render `<App>` with `DEMO_EMPLOYEES`; click the first board row; assert the card shows at least one reason and a recommended action; click "Создать задачу в Битрикс24"; assert a dialog contains `tasks.task.add` and the employee's name; press Escape and assert the dialog is gone; click back and assert the board is shown again. Add: navigating to `#/employee/does-not-exist` renders "Сотрудник не найден".
- [ ] **Step 2: Run** `npx vitest run src/ui/scenario.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the components and the route.
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Checkpoint:** `npm test` and `npx tsc --noEmit` clean.

### Task 7: Real-browser check and build

**Files:**
- Modify: whatever the check finds.

- [ ] **Step 1:** `npm run build`. Expected: succeeds, `dist/` produced, no TS errors.
- [ ] **Step 2:** `npm run preview`, open it with the browser tooling (load the `claude-in-chrome` or built-in browser skill first). Walk the main scenario: board loads, filter by a level, search, open a card, open the Bitrix modal, copy, close, go back. Check the browser console for errors and a phone-width viewport for horizontal scroll.
- [ ] **Step 3:** Fix any defect found, add a regression test when it is a logic bug, re-run `npm test`.
- [ ] **Step 4: Checkpoint:** record in a scratch note what was and was not checked in the real browser (it feeds the report).

### Task 8: Deploy, README, handoff

**Files:**
- Create: `.github/workflows/pages.yml`, `README.md`, `REPORT.md`, `.gitignore`

- [ ] **Step 1:** `pages.yml`: on push to `main` and manual dispatch; permissions `contents: read`, `pages: write`, `id-token: write`; job runs `npm ci`, `npm test`, `npm run build`, then `actions/upload-pages-artifact` (`dist`) and `actions/deploy-pages`.
- [ ] **Step 2:** `README.md` (English): what it is, the rules table copied from `RULES`, how to run and test, what is synthetic, limits (no real Bitrix24 integration, rules are hypotheses not validated on real data, no auth), next steps.
- [ ] **Step 3: Ask the user for explicit OK** to: `git init` and commit in `onboarding-risk-board/`, create the GitHub repo (public, needed for free Pages), push, and enable Pages with source "GitHub Actions". Do each only after the OK.
- [ ] **Step 4:** After the first Pages run, open the live URL and repeat the Task 7 walkthrough there. Expected: same behaviour as the preview.
- [ ] **Step 5:** Write `REPORT.md`: a Russian section followed by an English section with the same content, each at most 15 lines, covering how the word was understood and for whom, what was built, what was dropped and why, what was checked and with what, what was not checked, and the next step. Every claim must match what was actually run (Task 7 notes); no claim of predictive accuracy. Link it from the README.
- [ ] **Step 6:** Prepare for the user: the live URL and a 3-minute screen-recording script (board, filter, open a card, Bitrix payload).

---

## Self-review notes

- Spec coverage: board (T5), card + Bitrix payload (T6), transparent rules (T2), synthetic data matching the company's figures (T3), stats (T4), static deploy (T8), honest limits (README, report). No ML by design.
- Types are defined once in Task 1 and reused unchanged; `evaluateRisk`, `buildBoard`, `buildBitrixTask` signatures match their consumers.
- Review Focus lines are pinned: day 0 and window edges and late-done tasks in Task 2, Cyrillic search and empty state in Task 5, unknown id in Task 6, quoted names in Task 4.
