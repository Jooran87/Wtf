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
  // Dialogien käsittely on ohjattavissa testeittäin (osa testeistä haluaa
  // nimenomaan perua vahvistuksen). dialogCount kertoo kysyttiinkö mitään.
  let dialogAction = 'accept';
  let dialogCount = 0;
  page.on('dialog', (d) => { dialogCount++; return dialogAction === 'dismiss' ? d.dismiss() : d.accept(); });

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

    // Alakategoriat: sisennetyt alakategoriat sivupalkissa (myös useampi taso)
    const subs = await page.$$eval('#categoryList .cat-btn.subcat .cat-name', (els) => els.map((e) => e.textContent.trim()));
    ok('alakategoriat näkyvät sivupalkissa', subs.length >= 2 && subs.some((s) => s.includes('Asiakas A')), JSON.stringify(subs));
    ok('kolmas taso näkyy sivupalkissa (DSC)', subs.some((s) => s.includes('DSC')), JSON.stringify(subs));

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
    // Kolmas taso: luo alakategoria juuri luodun alakategorian (Asiakas C) alle
    await page.click('#newSubBtn'); await page.waitForTimeout(200);
    await page.fill('#subCatName', 'Kerros 3');
    await page.click('#subCatSave'); await page.waitForTimeout(500);
    const crumb3 = await page.$eval('.crumbs', (e) => e.textContent);
    ok('kolmannen tason murupolku (Kipa › Asiakas C › Kerros 3)',
      crumb3.includes('Kipa') && crumb3.includes('Asiakas C') && crumb3.includes('Kerros 3'), crumb3);

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
    // Kategoriakuvakkeet ovat siistejä SVG-viivakuvakkeita (ei emojia)
    ok('kategoriakuvakkeet ovat SVG sivupalkissa', (await page.$$('#categoryList .cat-ico svg.ic')).length >= 5);
    ok('kategoriakuvakkeet ovat SVG korteissa', (await page.$$('.cat-card .cc-ico svg.ic')).length >= 5);
    // Kuvakevalitsimella luotu kategoria saa valitun SVG-kuvakkeen
    await page.click('#addCategoryBtn'); await page.waitForTimeout(200);
    await page.fill('#newCatName', 'Turvakategoria');
    await page.click('#newCatIcon .ic-opt[data-i="svg:shield"]'); await page.waitForTimeout(150);
    await page.click('#newCatSave'); await page.waitForTimeout(500);
    ok('uuden kategorian kuvake renderöityy SVG:nä',
      (await page.$$('#categoryList .cat-btn .cat-ico svg.ic')).length >= 6);

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

    // Kuvagalleria + lightbox: Kipa-ohjeeseen ladattu kuva (imgFileInput-testi)
    await page.goto(base + '#/'); await page.waitForTimeout(300);
    await page.click('#categoryList >> text=Kipa'); await page.waitForTimeout(300);
    await page.click('text=Kipa – kohteen yleisohje'); await page.waitForTimeout(500);
    ok('kuvaliite näkyy galleriana', (await page.$$('.att-thumb')).length >= 1);
    await page.click('.att-thumb'); await page.waitForTimeout(400);
    ok('lightbox avautuu kuvasta', await page.isVisible('.lightbox.open'));
    ok('lightboxissa on kuva', (await page.$$('.lightbox .lb-img')).length === 1);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    ok('lightbox sulkeutuu Esc:llä', !(await page.isVisible('.lightbox.open')));

    // Tärkeät numerot: oma sivu navigaatiossa + etusivun vieritettävä lista
    await page.goto(base + '#/'); await page.waitForTimeout(400);
    const cs = await page.$eval('.contact-scroll', (el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
    ok('etusivun numerolista on vieritettävä (7 numeroa)', cs.sh > cs.ch, JSON.stringify(cs));
    await page.click('.nav-link[data-nav="contacts"]'); await page.waitForTimeout(400);
    ok('Tärkeät numerot -sivu avautuu navigaatiosta',
      (await page.$eval('#content', (e) => e.textContent)).includes('Yhteystiedot (7)'));
    await page.click('#addContactBtn'); await page.waitForTimeout(200);
    await page.fill('#cfLabel', 'Testinumero Oy');
    await page.fill('#cfPhone', '040 999 8877');
    await page.click('#cfSave'); await page.waitForTimeout(500);
    const cTxt = await page.$eval('#content', (e) => e.textContent);
    ok('yhteystieto lisätään numerosivulta', cTxt.includes('Testinumero Oy') && cTxt.includes('Yhteystiedot (8)'));

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
    // Vuorohuomiot-laatikko näyttää monta kirjausta ja vierii
    const ns = await page.$eval('.notes-scroll', (el) => ({ sh: el.scrollHeight, ch: el.clientHeight, n: el.querySelectorAll('.note').length }));
    ok('etusivun vuorohuomiot vierittyvät (monta kirjausta)', ns.n >= 6 && ns.sh > ns.ch, JSON.stringify(ns));

    // Oikean reunan vuoroloki-palsta leveällä näytöllä (>= 1400 px)
    const wide = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    wide.on('pageerror', (e) => errors.push('wide: ' + e.message));
    await wide.goto(fileUrl + '#/termipankki'); await wide.waitForTimeout(900);
    const railText = await wide.$eval('#rail', (e) => e.textContent).catch(() => '');
    ok('vuoroloki-palsta näkyy leveällä näytöllä', railText.includes('Vuoroloki'));
    const rs = await wide.$eval('.rail-scroll', (el) => ({ sh: el.scrollHeight, ch: el.clientHeight, n: el.querySelectorAll('.rail-note').length }));
    ok('reunapalstan loki vierittyy (monta kirjausta)', rs.n >= 6 && rs.sh > rs.ch, JSON.stringify(rs));
    await wide.fill('#railNoteText', 'Huomio reunapalstasta');
    await wide.click('#railNoteAdd'); await wide.waitForTimeout(500);
    ok('huomio tallentuu reunapalstasta',
      (await wide.$eval('#rail', (e) => e.textContent)).includes('Huomio reunapalstasta'));
    await wide.goto(fileUrl + '#/'); await wide.waitForTimeout(500);
    ok('etusivulla reunapalsta on tyhjä (ei tuplasisältöä)',
      (await wide.$eval('#rail', (e) => e.innerHTML.trim())) === '');
    await wide.close();

    // Puhelimen alapalkki: näkyy kapealla näytöllä ja navigoi
    const mob = await browser.newPage({ viewport: { width: 390, height: 800 } });
    mob.on('pageerror', (e) => errors.push('mob: ' + e.message));
    await mob.goto(fileUrl); await mob.waitForTimeout(800);
    ok('alapalkki näkyy puhelimessa', await mob.isVisible('#bottomNav'));
    ok('alapalkissa 5 kohtaa', (await mob.$$('.bn-item')).length === 5);
    await mob.click('.bn-item[data-bnav="shiftlog"]'); await mob.waitForTimeout(400);
    ok('alapalkista siirrytään vuorolokiin', /#\/vuoroloki/.test(mob.url()), mob.url());
    ok('alapalkin aktiivinen kohta korostuu',
      (await mob.$$('.bn-item.active[data-bnav="shiftlog"]')).length === 1);
    await mob.close();

    // ===== Regressiotestit korjatuille bugeille =====

    // 1) Tallentamattomat muutokset: varoitus myös wikin sisäisestä siirtymisestä
    //    + keskeneräinen teksti jää luonnokseksi talteen.
    await page.evaluate(() => { location.hash = '#/uusi'; });
    await page.waitForTimeout(500);
    await page.fill('#titleInput', 'Luonnostesti');
    await page.fill('#contentInput', 'KESKENERÄINEN');
    await page.waitForTimeout(250);
    dialogAction = 'dismiss'; dialogCount = 0;
    await page.click('.cat-btn'); await page.waitForTimeout(500);
    ok('tallentamattomista muutoksista varoitetaan wikin sisällä', dialogCount === 1, 'dialogeja=' + dialogCount);
    ok('peruutus jättää muokkausnäkymän auki', await page.isVisible('#contentInput'));
    dialogAction = 'accept';
    await page.click('.cat-btn'); await page.waitForTimeout(600);
    ok('hyväksyntä päästää pois muokkauksesta', (await page.$('#contentInput')) === null);
    await page.evaluate(() => { location.hash = '#/uusi'; });
    await page.waitForTimeout(500);
    ok('tallentamaton luonnos tarjotaan palautettavaksi', await page.isVisible('#draftNote'));
    await page.click('#draftRestore'); await page.waitForTimeout(300);
    ok('luonnos palautuu sisällöllään',
      (await page.$eval('#contentInput', (e) => e.value)) === 'KESKENERÄINEN');
    await page.click('#draftDiscard').catch(() => {});
    await page.evaluate(() => {
      Object.keys(localStorage).filter((k) => k.indexOf('tyowiki_draft_') === 0)
        .forEach((k) => localStorage.removeItem(k));
      location.hash = '#/';
    });
    await page.waitForTimeout(400);

    // 2) Lukijaroolilta piilotetaan KAIKKI kirjoitustoiminnot (myös
    //    ＋Alakategoria ja tiedote-/termi-/linkkilomakkeet).
    await page.evaluate(() => { document.documentElement.dataset.vrole = 'viewer'; location.hash = '#/kohde/2'; });
    await page.waitForTimeout(500);
    ok('lukija ei näe ＋Alakategoria-nappia', !(await page.isVisible('#newSubBtn')));
    ok('lukija ei näe Uusi ohje -nappia', !(await page.isVisible('#newPageBtn')));
    await page.evaluate(() => { location.hash = '#/tiedotteet'; }); await page.waitForTimeout(450);
    ok('lukija ei näe tiedotelomaketta', !(await page.isVisible('#annSaveBtn')));
    await page.evaluate(() => { location.hash = '#/termipankki'; }); await page.waitForTimeout(450);
    ok('lukija ei näe termilomaketta', !(await page.isVisible('#termSaveBtn')));
    await page.evaluate(() => { location.hash = '#/linkit'; }); await page.waitForTimeout(450);
    ok('lukija ei näe linkkilomaketta', !(await page.isVisible('#linkSaveBtn')));
    await page.evaluate(() => { document.documentElement.removeAttribute('data-vrole'); location.hash = '#/tiedotteet'; });
    await page.waitForTimeout(450);
    ok('muokkaajalle lomake näkyy normaalisti', await page.isVisible('#annSaveBtn'));

    // 3) Kirjautumisruudulla ei näytetä sovelluksen kehystä.
    await page.evaluate(() => { document.documentElement.dataset.auth = 'out'; });
    await page.waitForTimeout(200);
    ok('kirjautumisruudulla sivupalkki piilossa', !(await page.isVisible('.sidebar')));
    ok('kirjautumisruudulla yläpalkki piilossa', !(await page.isVisible('.topbar')));
    ok('kirjautumisruudulla reunapalsta piilossa', !(await page.isVisible('.rail')));
    await page.evaluate(() => { document.documentElement.removeAttribute('data-auth'); });
    await page.waitForTimeout(200);

    // 4) Hakukorostus ei riko HTML-entiteettejä (&, lainausmerkit).
    const hl = await page.evaluate(() => {
      const txt = (s, q) => { const d = document.createElement('div'); d.innerHTML = highlight(s, q); return d.textContent; };
      return { amp: txt('Palmia & Kipa', 'amp'), quot: txt('sana "lainaus"', 'quot') };
    });
    ok('hakukorostus ei riko &-merkkiä', hl.amp === 'Palmia & Kipa', hl.amp);
    ok('hakukorostus ei riko lainausmerkkejä', hl.quot === 'sana "lainaus"', hl.quot);
    const marked = await page.evaluate(() => {
      const d = document.createElement('div'); d.innerHTML = highlight('lampun vaihto', 'amp');
      return d.querySelectorAll('mark').length;
    });
    ok('hakukorostus korostaa yhä oikeat osumat', marked === 1, 'mark=' + marked);

    // 5) Kategoriattoman ohjeen poisto palaa etusivulle (ei #/kohde/null).
    await page.evaluate(async () => {
      const p = await Store.pages.create({ title: 'Kategoriaton', content: 'x', category_id: null, keywords: '' });
      location.hash = '#/sivu/' + p.id;
    });
    await page.waitForTimeout(600);
    dialogAction = 'accept';
    await page.click('#delBtn'); await page.waitForTimeout(700);
    const afterDel = await page.evaluate(() => ({
      hash: location.hash, virhe: document.body.innerText.indexOf('Kategoriaa ei löydy') >= 0,
    }));
    ok('kategoriattoman ohjeen poisto vie etusivulle',
      (afterDel.hash === '#/' || afterDel.hash === '') && !afterDel.virhe, JSON.stringify(afterDel));

    // 6) Hakukentän ohjeteksti kertoo että haku löytää myös tiedostot –
    //    sama teksti sekä sandboxissa että palvelinversiossa (public/index.html).
    const phSandbox = await page.$eval('#searchInput', (e) => e.placeholder);
    const phServer = (fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8')
      .match(/id="searchInput"[^>]*placeholder="([^"]*)"/) || [])[1] || '';
    ok('hakukentän ohjeteksti mainitsee tiedostot', phSandbox.indexOf('tiedosto') >= 0, phSandbox);
    ok('hakukentän ohjeteksti sama palvelinversiossa', phServer === phSandbox, phServer);

    ok('ei JS-virheitä koko ajossa', errors.length === 0, errors.join(','));
  } finally {
    await browser.close();
  }

  console.log(`\nSelaintestit: ${pass} OK, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('Testiajo kaatui:', e); process.exit(1); });
