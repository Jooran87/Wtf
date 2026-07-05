// Rajapintatestit: käynnistää palvelimen väliaikaisella datahakemistolla
// (TYOWIKI_DATA_DIR), joten oikea kanta ei koskaan muutu. Aja: npm test
'use strict';
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.TEST_PORT || 4979;
const B = `http://localhost:${PORT}`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tyowiki-test-'));

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('OK   ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' – ' + extra : '')); }
}

const J = { 'Content-Type': 'application/json' };
const jget = (url) => fetch(B + url).then((r) => r.json());
const jsend = (method, url, body) =>
  fetch(B + url, { method, headers: J, body: JSON.stringify(body) }).then((r) => r.json());
const status = (method, url, body) =>
  fetch(B + url, { method, headers: body ? J : undefined, body: body ? JSON.stringify(body) : undefined })
    .then((r) => r.status);

async function main() {
  // Siemen + palvelin eristettyyn hakemistoon
  const env = { ...process.env, TYOWIKI_DATA_DIR: TMP, PORT: String(PORT) };
  spawnSync(process.execPath, ['seed.js'], { cwd: ROOT, env });
  const server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: 'ignore' });
  try {
    // Odota käynnistymistä
    let up = false;
    for (let i = 0; i < 50 && !up; i++) {
      try { await fetch(B + '/api/categories'); up = true; }
      catch (_) { await new Promise((r) => setTimeout(r, 200)); }
    }
    if (!up) throw new Error('Palvelin ei käynnistynyt');

    // --- Kategoriat ---
    const cats = await jget('/api/categories');
    ok('seed-kategoriat ikoneineen', cats.length === 5 && cats[0].icon === '🎓', JSON.stringify(cats[0]));
    ok('kategorioiden artikkelimäärät', cats.every((c) => typeof c.page_count === 'number'));
    const newCat = await jsend('POST', '/api/categories', { name: 'Testikategoria', icon: '🧰' });
    ok('kategorian luonti', newCat.id > 0 && newCat.icon === '🧰');
    const renamed = await jsend('PUT', `/api/categories/${newCat.id}`, { name: 'Testi2', icon: '🔧' });
    ok('kategorian muokkaus', renamed.name === 'Testi2' && renamed.icon === '🔧');
    ok('tyhjä nimi hylätään (400)', await status('POST', '/api/categories', { name: '' }) === 400);

    // --- Järjestyksen muokkaus ---
    const catsOrig = await jget('/api/categories');
    const revIds = catsOrig.map((c) => c.id).reverse();
    await jsend('POST', '/api/categories/reorder', { ids: revIds });
    const afterReorder = await jget('/api/categories');
    ok('kategorioiden uudelleenjärjestys', afterReorder[0].id === revIds[0]);
    await jsend('POST', '/api/categories/reorder', { ids: catsOrig.map((c) => c.id) }); // palautus
    ok('reorder ilman ids-listaa (400)', await status('POST', '/api/pages/reorder', {}) === 400);
    const perehPages = await jget('/api/pages?category_id=1');
    await jsend('POST', '/api/pages/reorder', { ids: perehPages.map((p) => p.id).reverse() });
    const perehAfter = await jget('/api/pages?category_id=1');
    ok('ohjeiden järjestys kategorian sisällä', perehAfter[0].id === perehPages[perehPages.length - 1].id);

    // --- Sivut ---
    const page = await jsend('POST', '/api/pages', {
      title: '<script>alert(1)</script>', content: 'Testi **sisältö** erikoissanaXYZ',
      keywords: 'avainsanaQ', category_id: newCat.id, author: 'Testaaja',
    });
    ok('sivun luonti', page.id > 0);
    ok('XSS-otsikko tallentuu raakatekstinä', page.title === '<script>alert(1)</script>');
    ok('olematon sivu (404)', await status('GET', '/api/pages/99999') === 404);
    ok('tyhjä otsikko hylätään (400)', await status('POST', '/api/pages', { title: ' ' }) === 400);

    // Katselulaskuri vain track-parametrilla
    const before = (await jget(`/api/pages/${page.id}`)).views;
    await jget(`/api/pages/${page.id}?track=1`);
    const after = (await jget(`/api/pages/${page.id}`)).views;
    ok('katselu kasvaa vain trackilla', after === before + 1);

    // Vahvistus
    const verified = await jsend('POST', `/api/pages/${page.id}/verify`, { author: 'Testaaja' });
    ok('ajantasaisuusvahvistus', !!verified.verified_at && verified.verified_by === 'Testaaja');

    // Versiokatto: 35 muokkausta -> 30 versiota, sisältö säilyy
    for (let i = 1; i <= 35; i++) {
      await jsend('PUT', `/api/pages/${page.id}`, {
        title: 'Versio ' + i, content: 'sisältö ' + i, keywords: '', category_id: newCat.id, author: 'T',
      });
    }
    const revs = await jget(`/api/pages/${page.id}/revisions`);
    ok('versiokatto 30/sivu', revs.length === 30, revs.length);
    const oldest = await jget(`/api/revisions/${revs[revs.length - 1].id}`);
    ok('vanhan version sisältö tallella', oldest.content.startsWith('sisältö'));
    ok('olematon versio (404)', await status('GET', '/api/revisions/99999') === 404);

    // --- Liitteet: lataus, tyyppiraja, siivous ---
    const fd = new FormData();
    fd.append('files', new Blob(['%PDF-1.4 testidata'], { type: 'application/pdf' }), 'testi.pdf');
    fd.append('author', 'Testaaja');
    const up1 = await fetch(`${B}/api/pages/${page.id}/attachments`, { method: 'POST', body: fd }).then((r) => r.json());
    ok('PDF-liitteen lataus', up1.ok === true && up1.count === 1);
    const fd2 = new FormData();
    fd2.append('files', new Blob(['pelkkää tekstiä'], { type: 'text/plain' }), 'kielletty.txt');
    const up2 = await fetch(`${B}/api/pages/${page.id}/attachments`, { method: 'POST', body: fd2 }).then((r) => r.json());
    ok('kielletty tiedostotyyppi torjutaan', !!up2.error);
    ok('liite levyllä', fs.readdirSync(path.join(TMP, 'uploads')).length === 1);
    await fetch(`${B}/api/pages/${page.id}`, { method: 'DELETE' });
    ok('sivun poisto siivoaa liitteet levyltä', fs.readdirSync(path.join(TMP, 'uploads')).length === 0);
    ok('sivun poisto siivoaa versiot', (await jget(`/api/pages/${page.id}/revisions`)).length === 0);

    // --- Tiedotteet ---
    const ann = await jsend('POST', '/api/announcements', { title: 'Testitiedote', content: 'Sisältö', author: 'T' });
    await jsend('PUT', `/api/announcements/${ann.id}`, { pinned: true });
    const anns = await jget('/api/announcements');
    ok('kiinnitetty tiedote nousee kärkeen', anns[0].title === 'Testitiedote' && anns[0].pinned === 1);
    ok('osittainen päivitys säilyttää otsikon', anns[0].content === 'Sisältö');
    await fetch(`${B}/api/announcements/${ann.id}`, { method: 'DELETE' });

    // --- Termit ---
    const term = await jsend('POST', '/api/terms', { term: 'Öljytesti', definition: 'aakkostustesti', author: 'T' });
    const terms = await jget('/api/terms');
    ok('termi aakkostuu suomeksi (Ö viimeisenä)', terms[terms.length - 1].term === 'Öljytesti');
    await fetch(`${B}/api/terms/${term.id}`, { method: 'DELETE' });

    // --- Linkit ---
    const link = await jsend('POST', '/api/links', { label: 'Testilinkki', url: 'testi.fi/sivu' });
    ok('URL-normalisointi lisää https://', link.url === 'https://testi.fi/sivu');
    await fetch(`${B}/api/links/${link.id}`, { method: 'DELETE' });

    // --- Vuoroloki ---
    const note = await jsend('POST', '/api/shift-notes', { content: 'Testihuomio', author: 'T', category_id: 1 });
    ok('vuorohuomion luonti', note.id > 0);
    ok('limit-parametri kestää roskan', await status('GET', '/api/shift-notes?limit=99999') === 200);
    await fetch(`${B}/api/shift-notes/${note.id}`, { method: 'DELETE' });

    // --- Haku ---
    const s1 = await jget('/api/search?q=' + encodeURIComponent('erikoissanaXYZ'));
    ok('haku palauttaa kaikki 6 osiota', Object.keys(s1).length === 6, Object.keys(s1).join(','));
    const s2 = await jget('/api/search?q=' + encodeURIComponent('ISM'));
    ok('haku löytää artikkelin (ISM)', s2.pages.some((p) => p.title.includes('ISM')));
    ok('artikkelilla ote osumakohdasta', s2.pages.every((p) => 'snippet' in p));
    const s3 = await jget('/api/search?q=laatu');
    ok('avainsanaosuma ilman tekstiosumaa', s3.pages.some((p) => (p.snippet || '').startsWith('Avainsanat:')));
    const empty = await jget('/api/search?q=');
    ok('tyhjä haku palauttaa tyhjät osiot', Object.keys(empty).length === 6 && empty.pages.length === 0);

    // --- Offline ---
    const offRes = await fetch(B + '/offline');
    const off = await offRes.text();
    ok('offline sisältää ohjeet ja numerot', off.includes('Vikailmoitus IT-tukeen') && off.includes('tel:0401234567'));
    const dl = await fetch(B + '/offline?download=1');
    ok('offline-lataus attachmenttina', (dl.headers.get('content-disposition') || '').includes('tyowiki-offline.html'));
  } finally {
    server.kill();
    fs.rmSync(TMP, { recursive: true, force: true });
  }

  console.log(`\nRajapintatestit: ${pass} OK, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('Testiajo kaatui:', e); process.exit(1); });
