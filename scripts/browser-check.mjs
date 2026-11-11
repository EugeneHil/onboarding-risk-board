// End-to-end check of the production build in a real Chrome.
//
//   npm run build && npm run preview        (in one terminal)
//   npm run check:browser                   (in another)
//
// Env: BASE_URL (default http://localhost:4173/), CHROME_PATH (default: macOS Google Chrome),
//      SHOT_DIR (optional: where to save screenshots).
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
check('first row is high risk', all[0].includes('Высокий'));
await shot(page, '01-board');

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
check('card opens for the clicked row', (await page.$eval('article.card h2', (e) => e.textContent)) === lastName, lastName);
check('card opens scrolled to the top', (await page.evaluate(() => window.scrollY)) === 0);
check('focus moves to the card heading', await page.evaluate(() => document.activeElement?.tagName === 'H2'));
check('card url is a hash route', page.url().includes('#/employee/'), page.url());
const cardUrl = page.url();

await page.goto(BASE, { waitUntil: 'networkidle0' });
const name = await page.$eval('table.board tbody tr:first-child button.link', (b) => b.textContent);
await page.click('table.board tbody tr:first-child');
await page.waitForSelector('article.card');
check('card lists reasons', (await page.$$eval('section[aria-label="Причины риска"] li', (l) => l.length)) >= 1);
check('timeline rendered', (await page.$$eval('.timeline .marker', (m) => m.length)) >= 6);
await shot(page, '02-card', { fullPage: true });

await clickButton('Создать задачу в Битрикс24');
await page.waitForSelector('[role=dialog]');
const dlg = await page.$eval('[role=dialog]', (e) => e.textContent);
check('modal shows the tasks.task.add payload', dlg.includes('tasks.task.add') && dlg.includes(name));
await shot(page, '03-modal');
await page.keyboard.press('Escape');
check('Escape closes the modal', (await page.$('[role=dialog]')) === null);

await clickButton('К списку', false);
await page.waitForSelector('table.board');
check('back returns to the board', (await rowTexts()).length === all.length);

await page.goto(cardUrl, { waitUntil: 'networkidle0' });
await page.reload({ waitUntil: 'networkidle0' });
check('deep link survives reload', (await page.$('article.card')) !== null);
await page.goto(BASE + '#/employee/nope', { waitUntil: 'networkidle0' });
check('unknown id shows not found', (await page.$eval('.empty h2', (e) => e.textContent)) === 'Сотрудник не найден');

await page.setViewport({ width: 390, height: 844, isMobile: true });
await page.goto(BASE, { waitUntil: 'networkidle0' });
check('mobile board: no horizontal page scroll', (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
await shot(page, '04-mobile');
await page.click('table.board tbody tr:first-child');
await page.waitForSelector('article.card');
check('mobile card: no horizontal page scroll', (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
await shot(page, '05-mobile-card');

check('no console errors, warnings, failed or 4xx requests', problems.length === 0, problems.join(' | '));
await browser.close();

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
