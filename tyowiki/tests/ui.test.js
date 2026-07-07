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
    const cats = await page.$$eval('#categoryList .cat-btn:not(.subcat) .cat-name', (els) => els.map((e) => e.textContent));
    ok('sovellus käynnistyy, pääkategoriat näkyvät', cats.length === 5, JSON.stringify(cats));
    ok('kategoriakortit etusivulla (vain pääkategoriat)', (await page.$$('.cat-card')).length === 5);

    // Alakategoriat: Kipan alla sisennetyt alakategoriat sivupalkissa
    const subs = await page.$$eval('#categoryList .cat-btn.subcat .cat-name', (els) => els.map((e) => e.textContent.trim()));
    ok('alakategoriat näkyvät sivupalkissa', subs.length === 2 && subs.some((s) => s.includes('Asiakas A')), JSON.stringify(subs));

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

    // Alakategoriat: Kipa-näkymässä alakategoriakortit, ja alakategorian
    // murupolku näyttää yläkategorian. Uuden alakategorian luonti UI:sta.
    await page.goto(base + '#/'); await page.waitForTimeout(400);
    await page.click('#categoryList >> text=Kipa'); await page.waitForTimeout(400);
    ok('yläkategoriassa näkyy alakategoriakortteja', (await page.$$('.cat-card')).length >= 2);
    await page.click('.cat-card >> text=Asiakas A'); await page.waitForTimeout(400);
    const crumbTxt = await page.$eval('.crumbs', (e) => e.textContent);
    ok('alakategorian murupolku näyttää yläkategorian', crumbTxt.includes('Kipa') && crumbTxt.includes('Asiakas A'), crumbTxt);
    // Luo uusi alakategoria Kipan alle napista
    await page.goto(base + '#/'); await page.waitForTimeout(300);
    await page.click('#categoryList >> text=Kipa'); await page.waitForTimeout(400);
    await page.click('#newSubBtn'); await page.waitForTimeout(200);
    await page.fill('#subCatName', 'Asiakas C – Testi');
    await page.click('#subCatSave'); await page.waitForTimeout(500);
    const crumb2 = await page.$eval('.crumbs', (e) => e.textContent);
    ok('uusi alakategoria luotu ja avattu', crumb2.includes('Kipa') && crumb2.includes('Asiakas C'), crumb2);
    ok('uusi alakategoria näkyy sivupalkissa',
      (await page.$$eval('#categoryList .cat-btn.subcat .cat-name', (els) => els.map((e) => e.textContent))).some((t) => t.includes('Asiakas C')));

    // Alakategorioiden piilotusnappi: piilottaa alakategoriat + näyttää merkin, muistetaan
    const subsBefore = (await page.$$('#categoryList .cat-btn.subcat')).length;
    await page.click('#toggleSubcatsBtn'); await page.waitForTimeout(200);
    ok('piilotusnappi piilottaa alakategoriat', (await page.$$('#categoryList .cat-btn.subcat')).length === 0 && subsBefore > 0);
    ok('piilotettuna näkyy määrämerkki', (await page.$$('.subs-chip')).length >= 1);
    await page.reload(); await page.waitForTimeout(900);
    ok('piilotusvalinta muistetaan latauksessa', (await page.$$('#categoryList .cat-btn.subcat')).length === 0);
    await page.click('#toggleSubcatsBtn'); await page.waitForTimeout(200);
    ok('napista alakategoriat takaisin näkyviin', (await page.$$('#categoryList .cat-btn.subcat')).length === subsBefore);

    // Väriaksentit: seed-kategorioilla on värillinen reuna sivupalkissa ja korteissa
    await page.goto(base + '#/'); await page.waitForTimeout(400);
    ok('kategorioilla väriaksentti sivupalkissa', (await page.$$('#categoryList .cat-btn.has-accent')).length >= 5);
    ok('väriaksentti korteissa etusivulla', (await page.$$('.cat-card.has-accent')).length >= 5);

    // Live-haku: pudotusvalikko näyttää osumat ja rivin klikkaus vie ohjeeseen
    await page.fill('#searchInput', 'palo'); await page.waitForTimeout(400);
    ok('live-haun pudotus näkyy', await page.isVisible('#searchDrop'));
    const sdItems = await page.$$eval('#searchDrop .sd-item .sd-label', (els) => els.map((e) => e.textContent));
    ok('live-haku löytää ohjeita', sdItems.some((t) => /palo/i.test(t)), JSON.stringify(sdItems));
    // Saavutettavuus: combobox-roolit ja aria-activedescendant nuolinäppäimellä
    ok('haku on combobox ja auki', await page.getAttribute('#searchInput', 'role') === 'combobox'
      && await page.getAttribute('#searchInput', 'aria-expanded') === 'true');
    ok('pudotus on listbox ja rivit optioita', await page.getAttribute('#searchDrop', 'role') === 'listbox'
      && (await page.$$('#searchDrop .sd-item[role="option"]')).length >= 1);
    await page.focus('#searchInput'); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(100);
    ok('aria-activedescendant seuraa valintaa', /sd-opt-\d+/.test(await page.getAttribute('#searchInput', 'aria-activedescendant') || ''));
    await page.click('#searchDrop .sd-item'); await page.waitForTimeout(400);
    ok('live-haun osumasta avautuu sivu', /#\/sivu\//.test(page.url()), page.url());

    // Saavutettavuus: näppäimistöfokus näkyy (focus-visible outline)
    await page.goto(base + '#/'); await page.waitForTimeout(300);
    await page.keyboard.press('Tab'); await page.waitForTimeout(100);
    const focusOutline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth);
    ok('näppäimistöfokus näkyy reunuksena', focusOutline === '2px', focusOutline);

    // Sisällysluettelo: monta otsikkoa -> TOC-kortti, jonka linkki vierittää
    await page.goto(base + '#/'); await page.waitForTimeout(300);
    await page.click('#categoryList >> text=Perehdytys'); await page.waitForTimeout(300);
    await page.click('text=Tervetuloa taloon'); await page.waitForTimeout(500);
    ok('sisällysluettelo näkyy pitkässä ohjeessa', await page.isVisible('.toc-card'));
    const tocLinks = await page.$$eval('.toc-card a', (els) => els.map((e) => e.textContent.trim()));
    ok('sisällysluettelossa otsikot', tocLinks.length >= 3 && tocLinks.some((t) => t.includes('Päivä 1')), JSON.stringify(tocLinks));
    ok('otsikoilla ankkuri-id', (await page.$$('.doc .doc-head[id]')).length >= 3);

    // Etusivun uusi järjestys: banneri, Viimeksi päivitetyt ja pikahuomio
    await page.goto(base + '#/'); await page.waitForTimeout(500);
    ok('kiinnitetty tiedote bannerina etusivulla',
      (await page.$eval('.pin-banner', (e) => e.textContent).catch(() => '')).includes('Uusi työohje-wiki'));
    ok('Viimeksi päivitetyt -lista etusivulla',
      (await page.$eval('#content', (e) => e.textContent)).includes('Viimeksi päivitetyt'));
    await page.fill('#homeNoteText', 'Pikahuomio etusivulta');
    await page.click('#homeNoteAdd'); await page.waitForTimeout(500);
    ok('pikahuomio tallentuu etusivulta',
      (await page.$eval('#content', (e) => e.textContent)).includes('Pikahuomio etusivulta'));

    // Oikean reunan vuoroloki-palsta leveällä näytöllä (>= 1400 px)
    const wide = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    wide.on('pageerror', (e) => errors.push('wide: ' + e.message));
    await wide.goto(fileUrl + '#/termipankki'); await wide.waitForTimeout(900);
    const railText = await wide.$eval('#rail', (e) => e.textContent).catch(() => '');
    ok('vuoroloki-palsta näkyy leveällä näytöllä', railText.includes('Vuoroloki'));
    await wide.fill('#railNoteText', 'Huomio reunapalstasta');
    await wide.click('#railNoteAdd'); await wide.waitForTimeout(500);
    ok('huomio tallentuu reunapalstasta',
      (await wide.$eval('#rail', (e) => e.textContent)).includes('Huomio reunapalstasta'));
    await wide.goto(fileUrl + '#/'); await wide.waitForTimeout(500);
    ok('etusivulla reunapalsta on tyhjä (ei tuplasisältöä)',
      (await wide.$eval('#rail', (e) => e.innerHTML.trim())) === '');
    await wide.close();

    ok('ei JS-virheitä koko ajossa', errors.length === 0, errors.join(','));
  } finally {
    await browser.close();
  }

  console.log(`\nSelaintestit: ${pass} OK, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('Testiajo kaatui:', e); process.exit(1); });
