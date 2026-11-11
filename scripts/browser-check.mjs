// End-to-end check of the production build in a real Chrome.
//
//   npm run build && npm run preview        (in one terminal)
//   npm run check:browser                   (in another)
//
// Env: BASE_URL (default http://localhost:4173/), CHROME_PATH (default: macOS Google Chrome),
//      SHOT_DIR (optional: where to save screenshots).
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOT_DIR = process.env.SHOT_DIR;

const results = [];
const check = (name, ok, extra = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
};
const shot = (page, name, opts = {}) =>
  SHOT_DIR ? page.screenshot({ path: `${SHOT_DIR}/${name}.png`, ...opts }) : undefined;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
const problems = [];
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && problems.push(`console.${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()}`));
page.on('response', (r) => r.status() >= 400 && problems.push(`http ${r.status()}: ${r.url()}`));

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SAMPLE = (name) => `${ROOT}public/samples/${name}`;
const AXE = `${ROOT}node_modules/axe-core/axe.min.js`;

// Zero axe-core violations (WCAG 2.x A/AA and best practices) on the current screen.
const axeClean = async (label) => {
  if (!(await page.evaluate(() => typeof window.axe !== 'undefined'))) await page.addScriptTag({ path: AXE });
  const { violations } = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
  check(`axe: ${label}`, violations.length === 0, violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target} ${v.nodes[0]?.any[0]?.message ?? ''}`).join(' | '));
};
const waitText = (text) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 5000 }, text);
const hasText = (text) => page.evaluate((t) => document.body.innerText.includes(t), text);

const rowTexts = () => page.$$eval('table.board tbody tr', (rs) => rs.map((r) => r.textContent ?? ''));
const clickButton = (text, exact = true) =>
  page.evaluate(
    (t, ex) =>
      [...document.querySelectorAll('button')]
        .find((b) => (ex ? b.textContent === t : b.textContent.includes(t)))
        ?.click(),
    text,
    exact,
  );
const clearSearch = () =>
  page.$eval('input[type=search]', (el) => {
    el.focus();
    el.select();
  }).then(() => page.keyboard.press('Backspace'));

await page.setViewport({ width: 1280, height: 900 });
await page.goto(BASE, { waitUntil: 'networkidle0' });

check('banner says demo data', (await page.$eval('.banner', (e) => e.textContent)).includes('Демо-данные'));
check('title is the H1', (await page.$eval('h1', (e) => e.textContent)) === 'Новички: кто в зоне риска');
const all = await rowTexts();
check('board has rows', all.length >= 20, `rows=${all.length}`);
// The CSV export hands the visible rows to the browser as a Blob download; read the Blob instead of a file.
const csvText = await page.evaluate(async () => {
  let blob;
  const original = URL.createObjectURL;
  URL.createObjectURL = (b) => ((blob = b), original.call(URL, b));
  const button = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Скачать список'));
  button?.click();
  URL.createObjectURL = original;
  if (!blob) return { text: '', bom: false };
  const head = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
  return { text: await blob.text(), bom: head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf };
});
// Blob.text() strips the UTF-8 BOM while decoding, so the BOM is checked on the raw bytes above.
const csvLines = csvText.text.split('\r\n');
check('csv export: BOM, header and one line per visible row', csvText.bom && csvText.text.startsWith('Сотрудник;') && csvLines.length === all.length + 1, `lines=${csvLines.length}`);
// Print layout: controls disappear, the table is not clipped, the page is light even in a dark scheme.
const viewport = page.viewport();
await page.setViewport({ width: 720, height: 1000 }); // about the width of an A4 page
await page.emulateMediaType('print');
const printed = await page.evaluate(() => {
  const hidden = (sel) => [...document.querySelectorAll(sel)].every((e) => getComputedStyle(e).display === 'none');
  const wrap = document.querySelector('.table-wrap');
  return {
    chrome: hidden('nav.nav') && hidden('.filters'),
    clipped: wrap.scrollWidth > wrap.clientWidth,
    pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
});
await page.emulateMediaType('screen');
await page.setViewport(viewport);
check('print: nav and filters are hidden', printed.chrome);
check('print: the board table is not clipped', !printed.clipped && !printed.pageOverflow, JSON.stringify(printed));
check('first row is high risk', all[0].includes('Высокий'));
await shot(page, '01-board');
await axeClean('board');

await page.evaluate(() => [...document.querySelectorAll('button.tile')].find((b) => b.textContent.includes('Высокий')).click());
const high = await rowTexts();
check('high tile filters', high.length > 0 && high.length < all.length && high.every((t) => t.includes('Высокий')), `rows=${high.length}`);
await page.evaluate(() => [...document.querySelectorAll('button.tile')].find((b) => b.textContent.includes('Высокий')).click());
check('tile toggles back', (await rowTexts()).length === all.length);

await page.select('select', 'warehouse');
const wh = await rowTexts();
check('department filter', wh.length > 0 && wh.every((t) => t.includes('Склад')), `rows=${wh.length}`);
await page.select('select', '');

// Cyrillic search: lower case and "е" for "ё".
const yoName = (await page.$$eval('table.board tbody tr button.link', (bs) => bs.map((b) => b.textContent))).find((n) => n.includes('ё'));
check('demo data has a name with "ё"', !!yoName, yoName ?? '');
if (yoName) {
  const typed = yoName.split(' ')[0].toLowerCase().replace(/ё/g, 'е');
  await page.type('input[type=search]', typed);
  const found = await rowTexts();
  check('search finds "ё" names typed with "е"', found.length > 0 && found.every((t) => t.toLowerCase().replace(/ё/g, 'е').includes(typed)), `query=${typed}, rows=${found.length}`);
  await clearSearch();
}
await page.type('input[type=search]', 'zzzz');
check('empty state', (await page.$eval('.empty', (e) => e.textContent)) === 'Никого не найдено');
await clearSearch();
check('clearing search restores rows', (await rowTexts()).length === all.length);

// Card from the bottom of the list must open at the top.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
check('page was scrolled down before opening', (await page.evaluate(() => window.scrollY)) > 300);
const lastName = await page.$eval('table.board tbody tr:last-child button.link', (b) => b.textContent);
await page.click('table.board tbody tr:last-child');
await page.waitForSelector('article.card');
check('card opens for the clicked row', (await page.$eval('article.card h1', (e) => e.textContent)) === lastName, lastName);
check('card opens scrolled to the top', (await page.evaluate(() => window.scrollY)) === 0);
check('focus moves to the card heading', await page.evaluate(() => document.activeElement?.tagName === 'H1'));
check('card url is a hash route', page.url().includes('#/employee/'), page.url());
const cardUrl = page.url();

await page.goto(BASE, { waitUntil: 'networkidle0' });
const name = await page.$eval('table.board tbody tr:first-child button.link', (b) => b.textContent);
await page.click('table.board tbody tr:first-child');
await page.waitForSelector('article.card');
check('page title names the open card', (await page.title()) === `${name} · Адаптация новичков`, await page.title());
check('card lists reasons', (await page.$$eval('section[aria-label="Причины риска"] li', (l) => l.length)) >= 1);
check('timeline rendered', (await page.$$eval('.timeline .marker', (m) => m.length)) >= 6);
await shot(page, '02-card', { fullPage: true });
await axeClean('card');
await page.click('section[aria-label="Причины риска"] details.why summary');
check('card: a reason opens its rule', await page.$eval('section[aria-label="Причины риска"] details.why', (d) => d.open && d.textContent.includes('баллов')));
await axeClean('card (reason explained)');

await clickButton('Создать задачу в Битрикс24');
await page.waitForSelector('[role=dialog]');
const dlg = await page.$eval('[role=dialog]', (e) => e.textContent);
check('modal shows the tasks.task.add payload', dlg.includes('tasks.task.add') && dlg.includes(name));
await shot(page, '03-modal');
await page.keyboard.press('Escape');
check('Escape closes the modal', (await page.$('[role=dialog]')) === null);
check('focus returns to the create-task button', await page.evaluate(() => document.activeElement?.textContent === 'Создать задачу в Битрикс24'));

await clickButton('К списку', false);
await page.waitForSelector('table.board');
check('back returns to the board', (await rowTexts()).length === all.length);

await page.goto(cardUrl, { waitUntil: 'networkidle0' });
await page.reload({ waitUntil: 'networkidle0' });
check('deep link survives reload', (await page.$('article.card')) !== null);
await page.goto(BASE + '#/employee/nope', { waitUntil: 'networkidle0' });
check('unknown id shows not found', (await page.$eval('.empty h1', (e) => e.textContent)) === 'Сотрудник не найден');

// Analytics on the demo data.
await page.goto(BASE + '#/analytics', { waitUntil: 'networkidle0' });
check('analytics: title', (await page.title()) === 'Аналитика ухода · Адаптация новичков', await page.title());
check('analytics: survival chart has a label with day 90', (await page.$eval('svg[role=img]', (e) => e.getAttribute('aria-label'))).includes('90-й день'));
check('analytics: department, position, leave-reason and backtest tables', (await page.$$('table.rates')).length === 4);
check('analytics: demo leave reasons are labelled as random', await page.$eval('section[aria-label="Причины ухода"]', (e) => e.textContent.includes('выбраны случайно') && e.querySelectorAll('tbody tr').length >= 3));
const bt = await page.$$eval('table[aria-label="Доля отмеченных правилами"] tbody tr', (rs) => rs.map((r) => r.textContent));
check('analytics: backtest has 4 cut days x 2 thresholds and is labelled circular on the demo', bt.length === 8 && (await hasText('Проверка круговая')), bt.join(' | '));
check('analytics: no NaN anywhere', !(await hasText('NaN')));
await shot(page, '06-analytics', { fullPage: true });
await axeClean('analytics');

// Import path end to end with the downloadable samples.
await page.goto(BASE + '#/import', { waitUntil: 'networkidle0' });
await page.reload({ waitUntil: 'networkidle0' });
check('import: says files stay in the browser', await hasText('только в браузере'));
await axeClean('import (empty)');
// Form layout: three fields in one row, each label above its control (not glued to it), all fields aligned.
const layout = await page.evaluate(() => {
  const fields = [...document.querySelectorAll('.import-form label')].map((l) => {
    const control = l.querySelector('input').getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(l.firstChild);
    const text = range.getBoundingClientRect();
    return { top: control.top, left: control.left, labelAbove: text.bottom <= control.top + 1 };
  });
  return { n: fields.length, sameRow: fields.every((f) => Math.abs(f.top - fields[0].top) <= 2), labelsAbove: fields.every((f) => f.labelAbove) };
});
check('import form: labels sit above their controls', layout.n === 3 && layout.labelsAbove, JSON.stringify(layout));
check('import form: the three fields share one row', layout.sameRow, JSON.stringify(layout));
const inputs = await page.$$('input[type=file]');
await inputs[0].uploadFile(SAMPLE('people.csv'));
await waitText('Импортировано: 12');
check('import: 12 people, 0 skipped', (await hasText('Пропущено: 0')));
await axeClean('import (people loaded)');
await shot(page, '07-import');
await page.$eval('.actions button', (b) => b.click());
await page.waitForSelector('section[aria-label="Новички по истории подразделений"]');
check('people only: banner says uploaded data', (await page.$eval('.banner', (e) => e.textContent)).includes('Загруженные данные'));
check('people only: explains why there is no risk', await hasText('нет задач адаптации'));
check('people only: no risk badges', !(await hasText('Высокий')) && !(await hasText('Средний')));
await axeClean('history board');
await shot(page, '08-history', { fullPage: true });

await page.reload({ waitUntil: 'networkidle0' });
await page.goto(BASE + '#/import', { waitUntil: 'networkidle0' });
const inputs2 = await page.$$('input[type=file]');
await inputs2[0].uploadFile(SAMPLE('people.csv'));
await waitText('Импортировано: 12');
await inputs2[1].uploadFile(SAMPLE('tasks.csv'));
await waitText('Задачи: импортировано 20');
check('import: tasks linked, none skipped', await hasText('пропущено 0'));
await page.$eval('.actions button', (b) => b.click());
await page.waitForSelector('table.board');
const imported = await rowTexts();
check('people + tasks: rule-based board with risk levels', imported.length > 0 && imported.some((t) => /Высокий|Средний|Низкий/.test(t)), `rows=${imported.length}`);
await axeClean('imported board');
await page.click('.nav a[href="#/analytics"]');
await page.waitForSelector('section[aria-label="Причины ухода"]'); // a table.rates may still belong to the previous screen
check('analytics follows the imported data', await hasText('Магазин'));
check('analytics: imported leave reasons shown, small sample says so', await page.$eval('section[aria-label="Причины ухода"]', (e) => e.textContent.includes('по собственному желанию') && e.textContent.includes('Мало данных')));
await axeClean('analytics (imported)');
await page.goto(BASE + '#/import', { waitUntil: 'networkidle0' });
await clickButton('Вернуться к демо');
await page.waitForSelector('table.board');
check('reset returns to the demo', (await page.$eval('.banner', (e) => e.textContent)).includes('Демо-данные'));

// The main screens again in both colour schemes (the axe checks above ran in Chrome's default scheme).
for (const scheme of ['light', 'dark']) {
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  for (const hash of ['#/', '#/analytics', '#/import']) {
    await page.goto(BASE + hash, { waitUntil: 'networkidle0' });
    await page.reload({ waitUntil: 'networkidle0' });
    await axeClean(`${hash} in ${scheme} scheme`);
  }
}

await page.setViewport({ width: 390, height: 844, isMobile: true });
await page.goto(BASE, { waitUntil: 'networkidle0' });
check('mobile board: no horizontal page scroll', (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
await shot(page, '04-mobile');
await axeClean('mobile board');
await page.click('table.board tbody tr:first-child');
await page.waitForSelector('article.card');
check('mobile card: no horizontal page scroll', (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
await shot(page, '05-mobile-card');
await axeClean('mobile card');
for (const [hash, label] of [['#/analytics', 'analytics'], ['#/import', 'import']]) {
  await page.goto(BASE + hash, { waitUntil: 'networkidle0' });
  check(`mobile ${label}: no horizontal page scroll`, (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
  await axeClean(`mobile ${label}`);
}

check('no console errors, warnings, failed or 4xx requests', problems.length === 0, problems.join(' | '));
await browser.close();

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
