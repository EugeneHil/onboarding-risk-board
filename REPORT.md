# Отчёт / Report

**Работающая версия / Live demo:** https://eugenehil.github.io/onboarding-risk-board/
**Код / Code:** https://github.com/EugeneHil/onboarding-risk-board

## Русский

1. **Как поняли слово и для кого.** «НОВИЧОК» — первые 90 дней нового сотрудника (каждый третий ушедший не доработал до трёх месяцев). Для HR и руководителей: кому из новичков пора позвонить и почему.
2. **Что сделали.** Веб-приложение без бэкенда: доска новичков по риску ухода (4 простых правила, у каждого балла видна причина), карточка с таймлайном и готовым вызовом `tasks.task.add` (только показывается). Для ваших данных: загрузка выгрузки (CSV/JSON) в браузере и аналитика ухода (кривая Каплана — Мейера, ранний уход по подразделениям и должностям, бэктест правил).
3. **Данные.** Выдуманные, 120 человек, подогнаны под «каждый третий»; seed демо выбран из 40 ради ровной доски. Иллюстрация, не доказательство.
4. **От чего отказались.** ML-прогноз (на выдуманных данных это имитация), интеграция с Битрикс24, авторизация, уведомления: нужны ваши данные и доступ. Риск по правилам не показывается людям без задач адаптации, чтобы его не выдумывать.
5. **Что проверили и чем.** 169 автотестов; 69 проверок в настоящем Chrome (сценарий, импорт примеров, телефонная ширина, axe-core без нарушений, прогнаны и на опубликованном адресе); в Firefox 159 прошли 47 проверок сценария, импорта, аналитики и axe; независимое ревью, найденное исправлено с тестом.
6. **Что не проверили.** Правила на реальных данных: бэктест на демо круговой (на 20-й день «средний или высокий» отмечает 4 из 4 ушедших и 57% оставшихся, «только высокий» — 4 из 4 и 32%; пороги не подгонялись). Импорт на настоящей выгрузке Битрикс24, Safari, скринридеры; в Firefox не проверены тёмная схема и ширина телефона (puppeteer не умеет их эмулировать там). Допущение: что в Битрикс24 есть цепочка задач адаптации.
7. **Следующий шаг.** Загрузить выгрузку приёмов и увольнений за год (формат: `docs/data-contract.md`), проверить на ней правила и пороги, затем подключать Битрикс24.
8. **ИИ.** Сделано с помощью Claude Code (план, тесты, код); выводов об эффективности правил не делаем.

## English

1. **How we read the word, and for whom.** "NOVICHOK" (newcomer) is the first 90 days of a new hire (one in three leavers quits before month three). For HR and managers: which newcomer to call, and why.
2. **What was built.** A backend-free web app: a board of newcomers by attrition risk (4 plain rules, every point has a visible reason), a card with a timeline and a ready `tasks.task.add` call (displayed only). For your own data: in-browser upload of an export (CSV/JSON) and attrition analytics (Kaplan-Meier curve, early-exit rates by department and position, a backtest of the rules).
3. **Data.** Invented, 120 people, tuned to "one in three"; the demo seed was picked from 40 for a balanced board. An illustration, not evidence.
4. **What was dropped.** An ML prediction (an imitation on invented data), Bitrix24 integration, authentication, notifications: they need your data and access. Rule-based risk is not shown for people without onboarding tasks, so it is not invented.
5. **What was checked, and how.** 169 automated tests; 69 checks in a real Chrome (scenario, importing the samples, phone width, axe-core with zero violations, also run against the published URL); in Firefox 159, 47 checks of the scenario, import, analytics and axe passed; an independent review, its findings fixed test-first.
6. **What was not checked.** The rules on real data: the backtest on the demo is circular (at day 20 "medium or high" flags 4 of 4 leavers and 57% of stayers, "high only" 4 of 4 and 32%; thresholds were not tuned). Import on a real Bitrix24 export, Safari, screen readers; in Firefox the dark scheme and phone width (puppeteer cannot emulate them there). An assumption: that Bitrix24 has an onboarding task chain.
7. **Next step.** Load a year of hires and leavers (format: `docs/data-contract.md`), test the rules and thresholds on it, then connect Bitrix24.
8. **AI.** Built with Claude Code (plan, tests, code); no conclusions about the effectiveness of the rules are made.
