'use strict';
// Datakerros SANDBOX-VERSIOLLE: ei palvelinta, kaikki selaimessa.
// - Rakenteinen data (kohteet, sivut, huomiot, liitteiden tiedot) localStorageen
// - Tiedostojen sisältö (blobit) IndexedDB:hen
// Tarjoaa saman `Store`-rajapinnan kuin store-api.js, joten app.js on identtinen.
// TARKOITUS: ulkoasun hiominen ja demo ilman asennusta. Data on vain tässä
// selaimessa; tyhjennä selaimen tallennustila nollataksesi.

const LS_KEY = 'tyowiki_sandbox_v5';

// ---------- localStorage-malli ----------
function load() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch (_) { return null; }
}
function save(db) { localStorage.setItem(LS_KEY, JSON.stringify(db)); }
let DB = load();

const nowISO = () => new Date().toISOString();
function nextId() { DB.seq += 1; return DB.seq; }
function catName(id) { const c = DB.categories.find((x) => x.id === id); return c ? c.name : null; }
function clone(x) { return JSON.parse(JSON.stringify(x)); }

// ---------- IndexedDB blobit ----------
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('tyowiki_sandbox_files', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function putBlob(id, blob) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(blob, id);
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  });
}
async function getBlobUrl(id) {
  const db = await idb();
  const blob = await new Promise((res, rej) => {
    const tx = db.transaction('files', 'readonly');
    const rq = tx.objectStore('files').get(id);
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  });
  return blob ? URL.createObjectURL(blob) : '#';
}
async function delBlob(id) {
  const db = await idb();
  return new Promise((res) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').delete(id);
    tx.oncomplete = () => res();
  });
}

// ---------- Sallitut tiedostotyypit (kuten palvelimessa) ----------
const ALLOWED = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const MAX_SIZE = 50 * 1024 * 1024;

// ---------- Alustus + esimerkkidata ----------
const ready = ensureSeeded();

async function ensureSeeded() {
  if (DB) { migrateExisting(); return; }
  DB = { seq: 0, categories: [], pages: [], notes: [], attachments: [], contacts: [], revisions: [], announcements: [] };
  const kipa = { id: nextId(), name: 'Kipa', sort_order: 1 };
  const halytyskeskus = { id: nextId(), name: 'Hälytyskeskus', sort_order: 2 };
  const hairiot = { id: nextId(), name: 'Häiriötilanteet', sort_order: 3 };
  const ism = { id: nextId(), name: 'ISM-ohjeet', sort_order: 4 };
  DB.categories.push(kipa, halytyskeskus, hairiot, ism);

  mkPage(kipa.id, 'Kipa – kohteen yleisohje', `# Kipa – kohteen yleisohje

## Kohteen perustiedot
- Tarkista kohdekortti ja yhteyshenkilöt järjestelmästä
- Huomioi kohteen aukioloajat ja kulkureitit

## Kiinteistöhoidon tehtävät
1. Kierrokset sovitun ohjelman mukaan
2. Kirjaa havainnot ja poikkeamat järjestelmään
3. Ilmoita kiireelliset viat välittömästi päivystykseen

> Päivitä tämä ohje kohteen todellisilla tiedoilla.`, 'Anna', 'Kipa, kiinteistöhoito, kohdekortti');

  const p1 = mkPage(halytyskeskus.id, 'Hälytyksen vastaanotto ja luokittelu', `# Hälytyksen vastaanotto ja luokittelu

## Vastaanotto
1. Kuittaa saapuva hälytys järjestelmästä
2. Tarkista kohteen tiedot ja hälytystyyppi
3. Tarkista mahdolliset toimintaohjeet kohteelle

## Luokittelu
- **A – kiireellinen:** henkilö- tai paloturvallisuus vaarassa → toimi välittömästi
- **B – kiireellinen tekninen:** murtoilmaisu, laiterikko
- **C – ei-kiireellinen:** tekninen ilmoitus, huoltotarve

> Kirjaa kaikki toimenpiteet järjestelmään reaaliaikaisesti.`, 'Anna', 'hälytys, luokittelu, vastaanotto');

  mkPage(halytyskeskus.id, 'Paloilmoitinhälytyksen toimintaohje', `# Paloilmoitinhälytys

1. Vastaanota ja kuittaa hälytys
2. Soita kohteen yhteyshenkilölle ja varmista tilanne
3. Jos tulipaloa ei voida sulkea pois, **hälytä 112**
4. Ilmoita vartijalle / kohteen edustajalle
5. Kirjaa tapahtuma ja toimenpiteet lokiin

> Älä koskaan kuittaa paloilmoitusta vääräksi ilman kohteen varmistusta.`, 'Anna', 'paloilmoitin, palohälytys, 112');

  mkPage(hairiot.id, 'Järjestelmäkatkos – varamenettely', `# Järjestelmäkatkos

Jos hälytystenkäsittelyjärjestelmä ei ole käytettävissä:

1. Siirry **manuaaliseen lokiin** (paperilomake / varakone)
2. Ilmoita katkoksesta tekniselle tuelle ja vuoroesihenkilölle
3. Kirjaa kaikki hälytykset käsin aikaleimoineen
4. Kun järjestelmä palautuu, vie manuaaliset kirjaukset järjestelmään`, 'Jukka', 'katkos, varamenettely, manuaalinen loki');

  mkPage(hairiot.id, 'Sähkökatko kohteessa', `# Sähkökatko kohteessa

1. Varmista laajuus: yksi kohde vai laajempi alue (sähköyhtiön häiriökartta)
2. Tarkista varavoiman/UPS:ien toiminta kriittisissä kohteissa
3. Ilmoita kohteen yhteyshenkilölle ja kirjaa tapahtuma
4. Sähköjen palauduttua varmista järjestelmien normaali tila`, 'Jukka', 'sähkökatko, varavoima, UPS');

  const pIsm = mkPage(ism.id, 'ISM – toimintakäsikirjan periaatteet', `# ISM-ohjeet

## Tarkoitus
ISM-ohjeet kokoavat toimintajärjestelmän mukaiset menettelyt.

## Periaatteet
- Noudata aina uusinta ohjeversiota – tarkista päivityspäivämäärä
- Poikkeamat kirjataan ja käsitellään sovitun menettelyn mukaan
- Ohjeiden muutosehdotukset esihenkilölle

> Lisää tähän kategoriaan viralliset ISM-dokumentit liitteinä.`, 'Anna', 'ISM, toimintajärjestelmä, laatu, käsikirja');

  // Esimerkkiliite, jonka sisällöstä haku löytää osumia (snippet).
  const sampleText = 'Toimintaohje: paloilmoitinhälytyksessä varmista aina kohteen '
    + 'tilanne yhteyshenkilöltä ennen kuittausta. Epäselvässä tilanteessa hälytä 112. '
    + 'Kirjaa kaikki toimenpiteet ja aikaleimat lokiin.';
  const att = {
    id: nextId(), page_id: p1.id, original_name: 'Paloilmoitin_toimintaohje.pdf',
    mimetype: 'application/pdf', size: sampleText.length,
    uploaded_at: nowISO(), uploaded_by: 'Anna', text_content: sampleText,
  };
  DB.attachments.push(att);
  await putBlob(att.id, new Blob([sampleText], { type: 'application/pdf' }));

  // Toinen esimerkkiliite ISM-sivulle: haku "ISM" löytää myös tiedoston sisällöstä.
  const ismText = 'ISM-toimintakäsikirja, luku 4: poikkeamien käsittely. '
    + 'Kaikki ISM-ohjeiden vastaiset poikkeamat kirjataan ja raportoidaan '
    + 'laatuvastaavalle kuukausittain.';
  const att2 = {
    id: nextId(), page_id: pIsm.id, original_name: 'ISM_toimintakasikirja_luku4.pdf',
    mimetype: 'application/pdf', size: ismText.length,
    uploaded_at: nowISO(), uploaded_by: 'Anna', text_content: ismText,
  };
  DB.attachments.push(att2);
  await putBlob(att2.id, new Blob([ismText], { type: 'application/pdf' }));

  mkNote(halytyskeskus.id, 'Anna', 'Aamuvuoro rauhallinen. Kohteessa 4021 toistuva tekninen ilmoitus – huolto tilattu.');
  mkNote(kipa.id, 'Jukka', 'Kipa: kohteen 5510 ulko-oven lukitus temppuili, huoltopyyntö tehty.');
  mkNote(null, 'Anna', 'Yleinen: uudet ISM-ohjeet päivitetty järjestelmään.');

  // Esimerkkinä katselukertoja, jotta "Suosituimmat ohjeet" näkyy heti.
  DB.pages[0].views = 34; DB.pages[1].views = 58; DB.pages[2].views = 41;
  DB.pages[3].views = 29; DB.pages[4].views = 18; DB.pages[5].views = 22;

  DB.contacts = defaultContacts();

  // Esimerkkitiedotteet: yksi kiinnitetty, yksi tavallinen.
  DB.announcements.push(
    { id: nextId(), title: 'Uusi työohje-wiki käytössä', content: 'Tervetuloa! Ohjeet, tiedotteet ja vuoroloki löytyvät jatkossa täältä. Palaute esihenkilölle.', pinned: 1, created_at: nowISO(), created_by: 'Anna', updated_at: nowISO() },
    { id: nextId(), title: 'Kohteen 4021 huoltokatko 12.7.', content: 'Paloilmoitinjärjestelmä huollossa klo 8–14. Hälytykset kohteesta ohjautuvat varajärjestelmään.', pinned: 0, created_at: nowISO(), created_by: 'Jukka', updated_at: nowISO() }
  );

  save(DB);
}

// Oletusyhteystiedot (esimerkkidata + migraatio vanhaan dataan).
function defaultContacts() {
  return [
    { id: nextId(), label: 'Tekninen tuki (24/7)', phone: '040 123 4567', note: 'järjestelmä- ja laitehäiriöt', sort_order: 1 },
    { id: nextId(), label: 'Vuoroesihenkilö', phone: '040 234 5678', note: 'ympäri vuorokauden', sort_order: 2 },
    { id: nextId(), label: 'Kiinteistöpäivystys', phone: '040 345 6789', note: 'kiinteistöjen viat ja huolto', sort_order: 3 },
    { id: nextId(), label: 'Hätäkeskus', phone: '112', note: 'henkeä uhkaavat tilanteet', sort_order: 4 },
  ];
}

// Täydentää vanhat tallennukset uusilla kentillä ilman datan menetystä.
function migrateExisting() {
  let changed = false;
  if (!DB.contacts) { DB.contacts = defaultContacts(); changed = true; }
  if (!DB.revisions) { DB.revisions = []; changed = true; }
  if (!DB.announcements) { DB.announcements = []; changed = true; }
  DB.pages.forEach((p) => {
    if (typeof p.views !== 'number') { p.views = 0; changed = true; }
    if (typeof p.keywords !== 'string') { p.keywords = ''; changed = true; }
  });
  if (changed) save(DB);
}

function mkPage(catId, title, content, by, keywords) {
  const p = { id: nextId(), category_id: catId, title, content, keywords: keywords || '', updated_at: nowISO(), updated_by: by || '', views: 0 };
  DB.pages.push(p); return p;
}
function mkNote(catId, author, content) {
  DB.notes.push({ id: nextId(), category_id: catId, author: author || '', content, created_at: nowISO() });
}

// ---------- Hakuapurit (samat kuin palvelimen logiikka) ----------
function includesCI(hay, q) { return (hay || '').toLowerCase().includes(q.toLowerCase()); }
function makeSnippet(text, q) {
  if (!text) return '';
  const plain = text.replace(/[#*`>]/g, '').replace(/\s+/g, ' ').trim();
  const idx = plain.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return '';
  const start = Math.max(0, idx - 40);
  const end = Math.min(plain.length, idx + q.length + 60);
  return (start > 0 ? '…' : '') + plain.slice(start, end).trim() + (end < plain.length ? '…' : '');
}

// ---------- Store-rajapinta ----------
const Store = {
  mode: 'sandbox',

  categories: {
    async list() { await ready; return clone(DB.categories).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)); },
    async create(name) {
      await ready;
      const c = { id: nextId(), name: name.trim(), sort_order: (Math.max(0, ...DB.categories.map((x) => x.sort_order)) + 1) };
      DB.categories.push(c); save(DB); return clone(c);
    },
    async rename(id, name) {
      await ready; id = Number(id);
      const c = DB.categories.find((x) => x.id === id); if (c) c.name = name.trim();
      save(DB); return clone(c);
    },
    async remove(id) {
      await ready; id = Number(id);
      const pageIds = DB.pages.filter((p) => p.category_id === id).map((p) => p.id);
      for (const pid of pageIds) await removePageInternal(pid);
      DB.categories = DB.categories.filter((c) => c.id !== id);
      save(DB); return { ok: true };
    },
  },

  pages: {
    async list(categoryId) {
      await ready;
      let rows = DB.pages;
      if (categoryId) { categoryId = Number(categoryId); rows = rows.filter((p) => p.category_id === categoryId); }
      return clone(rows).sort((a, b) => a.title.localeCompare(b.title))
        .map(({ id, category_id, title, updated_at, updated_by }) => ({ id, category_id, title, updated_at, updated_by }));
    },
    async popular(limit = 10) {
      await ready;
      return clone(DB.pages).filter((p) => (p.views || 0) > 0)
        .sort((a, b) => b.views - a.views || a.title.localeCompare(b.title))
        .slice(0, limit)
        .map((p) => ({ id: p.id, title: p.title, category_id: p.category_id, views: p.views, category_name: catName(p.category_id) }));
    },
    async get(id, { track } = {}) {
      await ready; id = Number(id);
      const p = DB.pages.find((x) => x.id === id);
      if (!p) throw new Error('Sivua ei löydy');
      if (track) { p.views = (p.views || 0) + 1; save(DB); }
      const out = clone(p);
      out.attachments = [];
      for (const a of DB.attachments.filter((x) => x.page_id === id)) {
        out.attachments.push({
          id: a.id, original_name: a.original_name, mimetype: a.mimetype, size: a.size,
          uploaded_at: a.uploaded_at, uploaded_by: a.uploaded_by, url: await getBlobUrl(a.id),
        });
      }
      return out;
    },
    async create(data) {
      await ready;
      const p = mkPage(data.category_id ? Number(data.category_id) : null, (data.title || '').trim(), data.content || '', (data.author || '').trim(), (data.keywords || '').trim());
      save(DB); return clone(p);
    },
    async update(id, data) {
      await ready; id = Number(id);
      const p = DB.pages.find((x) => x.id === id);
      if (!p) throw new Error('Sivua ei löydy');
      // Versiohistoria: nykyinen versio talteen ennen päällekirjoitusta.
      DB.revisions.push({
        id: nextId(), page_id: p.id, title: p.title, content: p.content,
        keywords: p.keywords || '', category_id: p.category_id,
        saved_at: p.updated_at, saved_by: p.updated_by,
      });
      p.title = (data.title || '').trim();
      p.content = data.content || '';
      p.keywords = (data.keywords || '').trim();
      p.category_id = data.category_id ? Number(data.category_id) : null;
      p.updated_at = nowISO(); p.updated_by = (data.author || '').trim();
      save(DB); return clone(p);
    },
    async remove(id) { await ready; await removePageInternal(Number(id)); save(DB); return { ok: true }; },
    async revisions(id) {
      await ready; id = Number(id);
      return clone(DB.revisions.filter((r) => r.page_id === id))
        .sort((a, b) => b.id - a.id)
        .map(({ id: rid, page_id, title, saved_at, saved_by }) => ({ id: rid, page_id, title, saved_at, saved_by }));
    },
  },

  attachments: {
    async upload(pageId, files, author) {
      await ready; pageId = Number(pageId);
      if (!DB.pages.find((p) => p.id === pageId)) throw new Error('Sivua ei löydy');
      for (const f of files) {
        if (!ALLOWED.has(f.type)) throw new Error('Tiedostotyyppiä ei sallita: ' + (f.type || 'tuntematon'));
        if (f.size > MAX_SIZE) throw new Error('Tiedosto on liian suuri (max 50 Mt)');
      }
      for (const f of files) {
        const id = nextId();
        // Selaimessa ei louhita PDF/Office-tekstiä; text-tyypeistä luetaan sisältö.
        let text = '';
        if (f.type.startsWith('text/')) { try { text = await f.text(); } catch (_) {} }
        DB.attachments.push({
          id, page_id: pageId, original_name: f.name, mimetype: f.type,
          size: f.size, uploaded_at: nowISO(), uploaded_by: author || '', text_content: text,
        });
        await putBlob(id, f);
      }
      save(DB); return { ok: true, count: files.length };
    },
    async remove(id) {
      await ready; id = Number(id);
      DB.attachments = DB.attachments.filter((a) => a.id !== id);
      await delBlob(id); save(DB); return { ok: true };
    },
  },

  revisions: {
    async get(id) {
      await ready; id = Number(id);
      const r = DB.revisions.find((x) => x.id === id);
      if (!r) throw new Error('Versiota ei löydy');
      return clone(r);
    },
  },

  announcements: {
    async list(limit) {
      await ready;
      const rows = clone(DB.announcements)
        .sort((a, b) => (b.pinned - a.pinned) || b.created_at.localeCompare(a.created_at));
      return limit ? rows.slice(0, limit) : rows;
    },
    async create(data) {
      await ready;
      const title = (data.title || '').trim();
      if (!title) throw new Error('Otsikko puuttuu');
      const a = {
        id: nextId(), title, content: data.content || '', pinned: data.pinned ? 1 : 0,
        created_at: nowISO(), created_by: (data.author || '').trim(), updated_at: nowISO(),
      };
      DB.announcements.push(a); save(DB); return clone(a);
    },
    async update(id, data) {
      await ready; id = Number(id);
      const a = DB.announcements.find((x) => x.id === id);
      if (!a) throw new Error('Tiedotetta ei löydy');
      if (data.title !== undefined) {
        const t = (data.title || '').trim();
        if (!t) throw new Error('Otsikko puuttuu');
        a.title = t;
      }
      if (data.content !== undefined) a.content = data.content;
      if (data.pinned !== undefined) a.pinned = data.pinned ? 1 : 0;
      a.updated_at = nowISO();
      save(DB); return clone(a);
    },
    async remove(id) {
      await ready; id = Number(id);
      DB.announcements = DB.announcements.filter((a) => a.id !== id);
      save(DB); return { ok: true };
    },
  },

  contacts: {
    async list() { await ready; return clone(DB.contacts).sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)); },
    async create(data) {
      await ready;
      const c = { id: nextId(), label: (data.label || '').trim(), phone: (data.phone || '').trim(), note: (data.note || '').trim(),
        sort_order: (Math.max(0, ...DB.contacts.map((x) => x.sort_order)) + 1) };
      DB.contacts.push(c); save(DB); return clone(c);
    },
    async update(id, data) {
      await ready; id = Number(id);
      const c = DB.contacts.find((x) => x.id === id);
      if (c) { c.label = (data.label || '').trim(); c.phone = (data.phone || '').trim(); c.note = (data.note || '').trim(); }
      save(DB); return clone(c);
    },
    async remove(id) {
      await ready; id = Number(id);
      DB.contacts = DB.contacts.filter((c) => c.id !== id); save(DB); return { ok: true };
    },
  },

  notes: {
    async list({ categoryId, limit } = {}) {
      await ready;
      let rows = clone(DB.notes);
      if (categoryId) { categoryId = Number(categoryId); rows = rows.filter((n) => n.category_id === categoryId); }
      rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (limit) rows = rows.slice(0, limit);
      return rows.map((n) => ({ ...n, category_name: catName(n.category_id) }));
    },
    async create(data) {
      await ready;
      const n = { id: nextId(), category_id: data.category_id ? Number(data.category_id) : null, author: (data.author || '').trim(), content: (data.content || '').trim(), created_at: nowISO() };
      DB.notes.push(n); save(DB); return clone(n);
    },
    async remove(id) {
      await ready; id = Number(id);
      DB.notes = DB.notes.filter((n) => n.id !== id); save(DB); return { ok: true };
    },
  },

  async search(q) {
    await ready;
    q = (q || '').trim();
    if (!q) return { pages: [], notes: [], files: [], announcements: [] };
    const pages = DB.pages.filter((p) => includesCI(p.title, q) || includesCI(p.content, q) || includesCI(p.keywords, q))
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((p) => ({
        id: p.id, title: p.title, category_id: p.category_id, category_name: catName(p.category_id),
        snippet: makeSnippet(p.content, q)
          || (includesCI(p.keywords, q) ? 'Avainsanat: ' + p.keywords : ''),
      }));
    const notes = DB.notes.filter((n) => includesCI(n.content, q))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((n) => ({ ...clone(n), category_name: catName(n.category_id) }));
    const files = [];
    for (const a of DB.attachments.filter((x) => includesCI(x.original_name, q) || includesCI(x.text_content, q))) {
      const page = DB.pages.find((p) => p.id === a.page_id);
      files.push({
        id: a.id, original_name: a.original_name, mimetype: a.mimetype,
        page_id: a.page_id, page_title: page ? page.title : '',
        category_id: page ? page.category_id : null, category_name: page ? catName(page.category_id) : null,
        snippet: makeSnippet(a.text_content, q), url: await getBlobUrl(a.id),
      });
    }
    const announcements = clone(DB.announcements)
      .filter((a) => includesCI(a.title, q) || includesCI(a.content, q))
      .sort((a, b) => (b.pinned - a.pinned) || b.created_at.localeCompare(a.created_at))
      .map((a) => ({ ...a, snippet: makeSnippet(a.content, q) }));
    return { pages, notes, files, announcements };
  },
};

async function removePageInternal(id) {
  const atts = DB.attachments.filter((a) => a.page_id === id);
  for (const a of atts) await delBlob(a.id);
  DB.attachments = DB.attachments.filter((a) => a.page_id !== id);
  DB.revisions = DB.revisions.filter((r) => r.page_id !== id);
  DB.pages = DB.pages.filter((p) => p.id !== id);
}
