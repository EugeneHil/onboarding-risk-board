# Onboarding Risk Board

A small static web app for HR and line managers of a sports-goods wholesale and retail company (~400 people, 100+ hires a year, onboarding and offboarding run as Bitrix24 tasks). About one in three leavers quits before the third month, so the app focuses on the first 90 days: **who among the newcomers needs a call today, and why**.

The report for the test task is in [REPORT.md](REPORT.md) (Russian and English).

## What it does

- **Board.** Active newcomers in their first 90 days, riskiest first. Summary tiles (click to filter by risk level), a chart of when people leave, department filter, search by name or position.
- **Card.** Risk score with the reasons behind it, the recommended next action, a 0 to 90 day timeline of onboarding tasks and the task table.
- **Bitrix24 task.** A button builds the `tasks.task.add` call for a check-in with the newcomer. It is only displayed (and can be copied), never sent: there is no Bitrix24 integration.

## Risk rules

The rules are plain and every point has a visible reason. All numbers live in `RULES` in `src/domain/rules.ts`. They are hypotheses, **not validated on real data**.

| Rule | Fires when | Points |
|---|---|---|
| Overdue tasks | an open onboarding task is past its due day | 10 per task, max 30 |
| No mentor meeting | after day 7 the mentor meeting is not done | 25 |
| No two-week check-in | after day 16 the manager check-in due by day 14 is not done | 20 |
| Stalled | tasks are overdue and nothing was completed in the last 14 days | 15 |

One missed task can score twice on purpose: an open mentor meeting or two-week check-in counts as overdue (10) and also fires its own rule (25 or 20), and both lines are shown. "Stalled" counts idle days from the hire date when nothing was ever completed.

Level: **high** from 50 points, **medium** from 25, otherwise **low**. There is no machine-learning model by design: with invented data it would only imitate prediction.

## Data

Everything is synthetic. `src/data/generate.ts` produces 120 fictional employees (seeded, deterministic) with Bitrix24-style onboarding tasks. A hidden "engagement" value drives both task completion and leaving, and the parameters are tuned so that about a third of leavers quit within 90 days, as the company described. This makes the demo plausible, **not evidence** about real people. Names are random combinations of common first names and surnames; no real person is represented. The demo "today" is fixed at 2026-11-11. The demo seed (22) was picked from seeds 1 to 40 for a balanced board (31 newcomers: 9 high, 8 medium, 14 low risk; 13 of 36 leavers left within 90 days); other seeds give shares between about 0.15 and 0.47.

## Run

```sh
npm install
npm run dev        # development server
npm test           # unit and UI tests (Vitest, jsdom)
npm run build      # type-check and build to dist/
npm run preview    # serve the production build
npm run check:browser   # 26 end-to-end checks in a real Chrome against the preview (needs Chrome; CHROME_PATH, BASE_URL optional)
```

Node 20 or newer. Deployment to GitHub Pages is in `.github/workflows/pages.yml` (tests, build, publish on push to `main`); the app uses relative asset paths and hash routing, so it works under a repository sub-path.

## Layout

```
src/domain/   dates, risk rules, board, stats, Bitrix24 payload (pure functions)
src/data/     seeded generator and the demo dataset
src/ui/       React screens: board, card, timeline, modal
docs/superpowers/plans/   the implementation plan this was built from
```

## Limits and next steps

- No real Bitrix24 integration (needs a webhook or an app and access to the real task data).
- Rule weights and thresholds are untested against real attrition; they need to be checked against the company's own history of leavers.
- No authentication or roles, no notifications.
- The Bitrix24 dialog has no focus trap and does not return focus to its button on close.
- Not tested in Safari or Firefox or with screen readers (risk is shown by text and shape as well as colour, but this was not verified with assistive technology).
