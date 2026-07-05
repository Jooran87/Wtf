// Selaintestit sandbox-versiolle (Chromium + playwright-core).
// Kokoaa ensin yhden tiedoston sandboxin ja ajaa sen selaimessa.
// Jos Chromiumia ei löydy, testit OHITETAAN (exit 0) – rajapintatestit
// kattavat silloin logiikan. Selaimen polun voi antaa: CHROMIUM_PATH=...
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function findChromium() {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  try {
    const { chromium } = require('playwright-core');
    const p = chromium.executablePath();
    if (p && fs.existsSync(p)) return p;
  } catch (_) {}
  const guesses = [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ];
  return guesses.find((g) => fs.existsSync(g)) || null;
}

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('OK   ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' – ' + extra : '')); }
};

async function main() {
  const exe = findChromium();
  if (!exe) {
    console.log('OHITETAAN selaintestit: Chromiumia ei löytynyt (aseta CHROMIUM_PATH).');
    process.exit(0);
  }
  let chromium;
  try { ({ chromium } = require('playwright-core')); }
  catch (_) {
    console.log('OHITETAAN selaintestit: playwright-core puuttuu (npm install).');
    process.exit(0);
  }

  execSync('node sandbox/build-single.js', { cwd: ROOT, stdio: 'ignore' });
  const fileUrl = 'file://' + path.join(ROOT, 'sandbox', 'tyowiki-sandbox.html');

  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());

  try {
    await page.goto(fileUrl);
    await page.evaluate(() => {
      localStorage.clear();
      return new Promise((r) => {
        const d = indexedDB.deleteDatabase('tyowiki_sandbox_files');
        d.onsuccess = r; d.onerror = r; d.onblocked = r;
      });
    });
    await page.reload();
    await page.waitForTimeout(900);

    // Peruskäynnistys
    const cats = await page.$$eval('#categoryList .cat-btn .cat-name', (els) => els.map((e) => e.textContent));
    ok('sovellus käynnistyy, kategoriat näkyvät', cats.length === 5, JSON.stringify(cats));
    ok('kategoriakortit etusivulla', (await page.$$('.cat-card')).length === 5);

    // XSS: hyökkäävä otsikko näkyy tekstinä eikä suoritu
    await page.fill('#authorInput', 'Testaaja');
    await page.click('text=Kipa');
    await page.waitForTimeout(300);
    await page.click('#newPageBtn');
    await page.waitForTimeout(300);
    await page.fill('#titleInput', '<img src=x onerror=alert(1)> XSS');
    await page.fill('#contentInput', '# Otsikko\n\n**lihava**');
    await page.click('#saveBtn');
    await page.waitForTimeout(600);
    ok('XSS-otsikko renderöityy tekstinä', (await page.$eval('h2', (e) => e.textContent)).includes('<img'));
    ok('ei injektoituja elementtejä', (await page.$$('#content img')).length === 0);

    // Erikoismerkit haussa
    for (const q of ['(test', 'a+b', '**']) {
      await page.fill('#searchInput', q);
      await page.press('#searchInput', 'Enter');
      await page.waitForTimeout(200);
    }
    ok('erikoismerkkihaut eivät kaada', errors.length === 0, errors.join(','));

    // Poistetut kohteet käsitellään siististi
    const base = page.url().split('#')[0];
    await page.goto(base + '#/sivu/99999'); await page.waitForTimeout(400);
    ok('poistettu sivu -> virheviesti', (await page.$eval('#content', (e) => e.textContent)).includes('Sivua ei löydy'));
    await page.goto(base + '#/kohde/99999'); await page.waitForTimeout(400);
    ok('poistettu kategoria -> viesti', (await page.$eval('#content', (e) => e.textContent)).includes('Kategoriaa ei löydy'));

    // Navigaatiosweep
    for (const r of ['#/', '#/tiedotteet', '#/vuoroloki', '#/termipankki', '#/linkit', '#/haku?q=ISM']) {
      await page.goto(base + r); await page.waitForTimeout(200);
    }
    ok('navigaatiosweep ilman JS-virheitä', errors.length === 0, errors.join(','));

    // Teema vaihtuu ja säilyy
    await page.goto(base + '#/'); await page.waitForTimeout(400);
    await page.click('#themeToggle'); await page.waitForTimeout(200);
    ok('tumma tila kytkeytyy', await page.evaluate(() => document.documentElement.dataset.theme === 'dark'));
    await page.reload(); await page.waitForTimeout(700);
    ok('teema säilyy uudelleenlatauksessa', await page.evaluate(() => document.documentElement.dataset.theme === 'dark'));

    // Esikatselu muokkauksessa
    await page.click('text=Häiriötilanteet'); await page.waitForTimeout(300);
    await page.click('text=Sähkökatko kohteessa'); await page.waitForTimeout(400);
    await page.click('#editBtn'); await page.waitForTimeout(300);
    await page.click('#previewToggle'); await page.waitForTimeout(200);
    ok('Markdown-esikatselu renderöi', (await page.$eval('#previewBox h1', (e) => e.textContent)).includes('Sähkökatko'));

    // Kuvan lisäys artikkeliin: 📷-nappi -> liite:ID tekstiin -> renderöityy img-elementiksi
    await page.goto(base + '#/'); await page.waitForTimeout(400);
    await page.click('text=Kipa'); await page.waitForTimeout(300);
    await page.click('text=Kipa – kohteen yleisohje'); await page.waitForTimeout(400);
    await page.click('#editBtn'); await page.waitForTimeout(300);
    const pngBuf = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await page.setInputFiles('#imgFileInput', { name: 'ruutukaappaus.png', mimeType: 'image/png', buffer: pngBuf });
    await page.waitForTimeout(600);
    const taValue = await page.$eval('#contentInput', (e) => e.value);
    ok('kuvaviittaus lisättiin tekstiin', taValue.includes('![kuva](liite:'));
    await page.click('#saveBtn'); await page.waitForTimeout(600);
    const imgSrc = await page.$eval('.doc img.doc-img', (e) => e.getAttribute('src')).catch(() => null);
    ok('kuva renderöityy artikkelissa', !!imgSrc && imgSrc.indexOf('blob:') === 0, imgSrc);

    ok('ei JS-virheitä koko ajossa', errors.length === 0, errors.join(','));
  } finally {
    await browser.close();
  }

  console.log(`\nSelaintestit: ${pass} OK, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('Testiajo kaatui:', e); process.exit(1); });
