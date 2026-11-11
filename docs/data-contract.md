# Data contract

## The assumption

The company states that **hiring and dismissal run as Bitrix24 tasks**. The rule-based risk score additionally needs an **onboarding task chain** per newcomer (mentor meeting, manager check-ins, HR feedback, ...). Whether such a chain exists in Bitrix24 is **not confirmed**. The app therefore works at two levels:

| Level | You have | The app can show |
|---|---|---|
| 1. People only | name, position, department, hire date, leave date and reason | attrition analytics (survival curve, early-exit rates by department and position) and a history-based list of current newcomers |
| 2. People + onboarding tasks | level 1 plus the task chain with due and completion dates | everything above plus rule-based risk, reasons, timeline and the recommended action |

## People table (required)

CSV (`;`, `,` or tab separated, UTF-8, BOM tolerated) or JSON (an array of objects). One row per employee, including leavers.

| Meaning | Accepted headers (case-insensitive) | Required |
|---|---|---|
| Full name | `full_name`, `name`, `фио`, `сотрудник` | yes |
| Hire date | `hire_date`, `hired`, `дата приёма`, `дата приема`, `принят` | yes |
| Position | `position`, `должность` | no |
| Department | `department`, `подразделение`, `отдел` | no (shown as "Не указано") |
| Leave date | `leave_date`, `fired`, `дата увольнения`, `уволен` | for leavers |
| Leave reason | `leave_reason`, `причина увольнения`, `причина` | no |
| Id | `id`, `табельный номер`, `employee_id` | no (generated) |
| Manager / mentor | `manager`, `руководитель` / `mentor`, `наставник` | no |

Dates: `YYYY-MM-DD`, `DD.MM.YYYY` (optionally with a time, as Excel writes it) or an ISO datetime; the date part is used. A leave date later than the "data as of" date is treated as a planned leave: the person is counted as still working and the row is reported as a note. Files saved by Russian Excel as "CSV (разделители — точка с запятой)" (windows-1251) are decoded automatically.

## Onboarding tasks table (optional)

Rule-based risk is computed only for people who have at least one task in this table, and it assumes that **their whole chain is in the file**: a missing mentor meeting counts as "not held". People without any task are listed separately, ranked by the early-exit rate of their department.

| Meaning | Accepted headers | Required |
|---|---|---|
| Employee | `employee_id` or `табельный номер` (matches the people table `id`), or `full_name`/`фио` (matched ignoring case and е/ё; a bare `id` column is ignored because it is usually the task's own id) | yes |
| Title | `title`, `название`, `задача` | yes |
| Due | `due_day` (days after hire) or `due_date` | yes |
| Done on | `completed_on`, `дата выполнения` (empty means still open) | no |
| Kind | `kind` (`docs`, `safety`, `mentor_meeting`, `training`, `checkin`, `feedback`); inferred from the title if absent | no |

## Getting it out of Bitrix24

`tasks.task.list` returns tasks with `title`, `createdDate`, `closedDate`, `responsibleId`, `deadline`. Typical mapping: the "hire" task closed date is the hire date, the "dismissal" task closed date is the leave date, onboarding tasks keep their own `deadline` and `closedDate`. Employee names and departments come from `user.get`. The app does **not** read the raw `tasks.task.list` response: its field names (`deadline`, `closedDate`, `responsibleId`) are not mapped, and a task's own `id` is not an employee id. Convert it to the tables above (a plain CSV or a JSON array with the listed column names); a JSON array of such objects, or an object with the array under any single key, is accepted.

## Privacy

Files are read and processed in the browser only; nothing is uploaded. Use pseudonymised names for a first trial if in doubt.
