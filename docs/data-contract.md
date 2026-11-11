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

Dates: `YYYY-MM-DD`, `DD.MM.YYYY` or an ISO datetime (the date part is used).

## Onboarding tasks table (optional)

| Meaning | Accepted headers | Required |
|---|---|---|
| Employee | `employee_id` (matches the people table `id`) or `full_name` | yes |
| Title | `title`, `название`, `задача` | yes |
| Due | `due_day` (days after hire) or `due_date` | yes |
| Done on | `completed_on`, `дата выполнения` (empty means still open) | no |
| Kind | `kind` (`docs`, `safety`, `mentor_meeting`, `training`, `checkin`, `feedback`); inferred from the title if absent | no |

## Getting it out of Bitrix24

`tasks.task.list` returns tasks with `title`, `createdDate`, `closedDate`, `responsibleId`, `deadline`. Typical mapping: the "hire" task closed date is the hire date, the "dismissal" task closed date is the leave date, onboarding tasks keep their own `deadline` and `closedDate`. Employee names and departments come from `user.get`. The app accepts the JSON response as is when the task list is under `result.tasks`, but a simple CSV built from these fields is the most reliable route.

## Privacy

Files are read and processed in the browser only; nothing is uploaded. Use pseudonymised names for a first trial if in doubt.
