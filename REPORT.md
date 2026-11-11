# Отчёт / Report

## Русский

1. **Как поняли слово и для кого.** «НОВИЧОК» мы поняли как первые 90 дней нового сотрудника: каждый третий ушедший не доработал до трёх месяцев. Делали для HR и линейных руководителей: каждый день видеть, кому из новичков пора позвонить и зачем.
2. **Что сделали.** Веб-приложение «Доска риска адаптации» без бэкенда: список новичков по задачам адаптации (в формате задач Битрикс24), отсортированный по риску ухода. Четыре простых правила, у каждого балла видна причина. Карточка с таймлайном 90 дней, рекомендованным действием и готовым вызовом `tasks.task.add` (только показывается).
3. **Данные.** Полностью выдуманные, 120 человек. Генератор настроен так, чтобы около трети ушедших уходили раньше 90 дней, как у вас; seed демо выбран из 40 ради ровной доски. Это иллюстрация, не доказательство.
4. **От чего отказались.** От ML-прогноза (на выдуманных данных это имитация), реальной интеграции с Битрикс24 (нужны доступ и ваши данные), авторизации, ролей, уведомлений. Выбрали один сценарий и довели его.
5. **Что проверили и чем.** 49 автотестов (правила и границы дней 0 и 90, генератор, основной сценарий «доска → карточка → задача → назад»). 26 проверок в настоящем Chrome (`npm run check:browser`): сценарий, фильтры, поиск, глубокая ссылка, консоль без ошибок, телефонная ширина. Дефекты, найденные браузером и независимым ревью, исправлены с тестом: карточка шире экрана на телефоне, 404 на иконку, «застой» у новичка на 2-й день, поиск не находил «ё» по «е», тёзки в демо, карточка открывалась не с начала страницы.
6. **Что не проверили.** Правила на реальных данных: это гипотезы, их веса не сверены с вашей историей увольнений. Работу с настоящими задачами Битрикс24. Safari, Firefox и скринридеры (в окне задачи нет ловушки фокуса). Большие объёмы данных. Один пропуск может дать двойной счёт (просрочка и своё правило), это задокументировано.
7. **Следующий шаг.** Подключить Битрикс24 (вебхук или REST), выгрузить историю приёмов и увольнений за год, проверить на ней правила и пороги, согласовать с HR, какие действия им реально доступны.
8. **ИИ.** Работа выполнена с помощью Claude Code (план, тесты, код). Выводов об эффективности правил не делаем.

## English

1. **How we read the word, and for whom.** "NOVICHOK" (newcomer) is read as the first 90 days of a new hire: one in three leavers quits before the third month. Built for HR and line managers, so every day they see which newcomer to call and why.
2. **What was built.** A backend-free web app, "Onboarding Risk Board": newcomers based on onboarding tasks (Bitrix24-style), sorted by attrition risk. Four plain rules, every point has a visible reason. A card with a 90-day timeline, a recommended action and a ready `tasks.task.add` call (displayed only).
3. **Data.** Fully invented, 120 people. The generator is tuned so that about a third of leavers leave within 90 days, as in your figures; the demo seed was picked from 40 for a balanced board. An illustration, not evidence.
4. **What was dropped.** An ML prediction (an imitation on invented data), a real Bitrix24 integration (needs access and your data), authentication, roles, notifications. One scenario was chosen and finished.
5. **What was checked, and how.** 49 automated tests (rules and the day 0 and 90 edges, the generator, the main scenario "board → card → task → back"). 26 checks in a real Chrome (`npm run check:browser`): the scenario, filters, search, deep link, a clean console, phone width. Defects found by the browser and by an independent review were fixed test-first: card wider than the phone screen, 404 for the icon, "stalled" flagged on day 2, search not matching "ё" for "е", duplicate names in the demo, card opening mid-page.
6. **What was not checked.** The rules on real data: they are hypotheses, not compared with your history of leavers. Work with real Bitrix24 tasks. Safari, Firefox and screen readers (the task dialog has no focus trap). Large data volumes. One miss can score twice (overdue plus its own rule); this is documented.
7. **Next step.** Connect Bitrix24 (webhook or REST), export a year of hires and leavers, test the rules and thresholds on it, and agree with HR which actions are really available to them.
8. **AI.** Done with Claude Code (plan, tests, code). No conclusions about the effectiveness of the rules are made.
