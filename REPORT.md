# Отчёт / Report

**Работающая версия / Live demo:** https://eugenehil.github.io/onboarding-risk-board/
**Код / Code:** https://github.com/EugeneHil/onboarding-risk-board

## Русский

1. **Как поняли слово и для кого.** «НОВИЧОК» — первые 90 дней сотрудника; для HR и руководителей: кому из новичков позвонить сегодня и почему.
2. **Что сделали.** Веб-приложение: доска риска ухода (4 прозрачных правила), карточка с вызовом `tasks.task.add` (только показ), загрузка выгрузки CSV/JSON и аналитика ухода. Данные выдуманные: 120 человек.
3. **От чего отказались.** ML-прогноз (на выдуманных данных это имитация), интеграция с Битрикс24, авторизация, уведомления: нужны ваши данные и доступ.
4. **Что проверили.** 169 автотестов; 69 проверок в Chrome (сценарий, импорт, телефон, axe), в том числе на живом сайте; 47 в Firefox; независимое ревью.
5. **Что не проверили.** Правила на реальных данных (бэктест на демо круговой); реальную выгрузку Битрикс24; Safari, скринридеры; в Firefox тёмную тему и телефон. Допущение: цепочка задач адаптации есть.
6. **Следующий шаг.** Загрузить выгрузку приёмов и увольнений за год (`docs/data-contract.md`), проверить правила и пороги, затем подключать Битрикс24.
7. **ИИ.** Сделано с Claude Code; выводов об эффективности правил не делаем.

## English

1. **How we read the word, and for whom.** "NOVICHOK" (newcomer) is the first 90 days of a hire; for HR and managers: which newcomer to call today, and why.
2. **What was built.** A web app: an attrition-risk board (4 plain rules), a card with a `tasks.task.add` call (displayed only), CSV/JSON upload and attrition analytics. Invented data: 120 people.
3. **What was dropped.** ML prediction (an imitation on invented data), Bitrix24 integration, authentication, notifications: they need your data and access.
4. **What was checked.** 169 automated tests; 69 checks in Chrome (scenario, import, phone, axe), also on the live site; 47 in Firefox; an independent review.
5. **What was not checked.** The rules on real data (the demo backtest is circular); a real Bitrix24 export; Safari, screen readers; in Firefox the dark scheme and phone. Assumption: an onboarding task chain exists.
6. **Next step.** Load a year of hires and leavers (`docs/data-contract.md`), test the rules and thresholds, then connect Bitrix24.
7. **AI.** Built with Claude Code; no conclusions about the effectiveness of the rules are made.
