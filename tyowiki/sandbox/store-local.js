'use strict';
// Datakerros SANDBOX-VERSIOLLE: ei palvelinta, kaikki selaimessa.
// - Rakenteinen data (kohteet, sivut, huomiot, liitteiden tiedot) localStorageen
// - Tiedostojen sisältö (blobit) IndexedDB:hen
// Tarjoaa saman `Store`-rajapinnan kuin store-api.js, joten app.js on identtinen.
// TARKOITUS: ulkoasun hiominen ja demo ilman asennusta. Data on vain tässä
// selaimessa; tyhjennä selaimen tallennustila nollataksesi.

const LS_KEY = 'tyowiki_sandbox_v1';

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
  if (DB) return;
  DB = { seq: 0, categories: [], pages: [], notes: [], attachments: [] };
  const linja1 = { id: nextId(), name: 'Tuotantolinja 1', sort_order: 1 };
  const pakkaamo = { id: nextId(), name: 'Pakkaamo', sort_order: 2 };
  const yleiset = { id: nextId(), name: 'Yleiset ohjeet', sort_order: 3 };
  DB.categories.push(linja1, pakkaamo, yleiset);

  const p1 = mkPage(linja1.id, 'Linjan käynnistys aamuvuorossa', `# Linjan käynnistys

## Ennen käynnistystä
- Tarkista että hätäseis-painikkeet ovat vapautettuina
- Varmista suojaovien lukitus
- Tarkista voiteluöljyn taso

## Käynnistysjärjestys
1. Kytke pääkytkin päälle
2. Odota että ohjausjärjestelmä latautuu (n. 2 min)
3. Käynnistä kuljetin **vihreästä** painikkeesta
4. Nosta nopeus vähitellen tavoitearvoon

> Huom! Jos merkkivalo vilkkuu punaisena, katso vikaohje ennen jatkamista.`, 'Matti');

  mkPage(linja1.id, 'Häiriötilanteen kuittaus', `# Häiriön kuittaus

- Paina **RESET** ohjauspaneelista
- Tarkista näytöltä vikakoodi
- Yleisimmät koodit:
  - E01 = paperitukos
  - E02 = ylikuumeneminen
  - E05 = anturihäiriö`, 'Matti');

  mkPage(pakkaamo.id, 'Pakkauskoneen puhdistus', `# Pakkauskoneen puhdistus (vuoron lopussa)

1. Pysäytä kone ja katkaise virta
2. Poista pakkausmateriaalin jäänteet
3. Pyyhi pinnat elintarvikehyväksytyllä puhdistusaineella
4. Kirjaa puhdistus lokiin`, 'Liisa');

  // Esimerkkiliite, jonka sisällöstä haku löytää osumia (snippet).
  const sampleText = 'Turvaohje: käytä aina suojalaseja ja kuulosuojaimia linjalla. '
    + 'Hätäseis-painike sijaitsee ohjauspaneelin vasemmassa reunassa. '
    + 'Kuittaa häiriö vasta kun alue on tyhjä ja turvallinen.';
  const att = {
    id: nextId(), page_id: p1.id, original_name: 'Linjan_turvaohje.pdf',
    mimetype: 'application/pdf', size: sampleText.length,
    uploaded_at: nowISO(), uploaded_by: 'Matti', text_content: sampleText,
  };
  DB.attachments.push(att);
  await putBlob(att.id, new Blob([sampleText], { type: 'application/pdf' }));

  mkNote(linja1.id, 'Matti', 'Linja 1 pyöri hyvin koko aamuvuoron. Öljynpaine hieman koholla iltapäivällä, seurataan.');
  mkNote(pakkaamo.id, 'Liisa', 'Pakkauskone jumitti kahdesti klo 14 aikaan. Puhdistettu ja kuitattu. Huoltopyyntö tehty.');
  mkNote(null, 'Liisa', 'Yleinen: varaosavarastosta loppui teippirulla. Tilaus lähtenyt.');
  save(DB);
}

function mkPage(catId, title, content, by) {
  const p = { id: nextId(), category_id: catId, title, content, updated_at: nowISO(), updated_by: by || '' };
  DB.pages.push(p); return p;
}
function mkNote(catId, author, content) {
  DB.notes.push({ id: nextId(), category_id: catId, author: author || '', content, created_at: nowISO() });
}

// ---------- Hakuapurit (samat kuin palvelimen logiikka) ----------
function includesCI(hay, q) { return (hay || '').toLowerCase().includes(q.toLowerCase()); }
function makeSnippet(text, q) {
  if (!text) return '';
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return '';
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + q.length + 60);
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
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
    async get(id) {
      await ready; id = Number(id);
      const p = DB.pages.find((x) => x.id === id);
      if (!p) throw new Error('Sivua ei löydy');
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
      const p = mkPage(data.category_id ? Number(data.category_id) : null, (data.title || '').trim(), data.content || '', (data.author || '').trim());
      save(DB); return clone(p);
    },
    async update(id, data) {
      await ready; id = Number(id);
      const p = DB.pages.find((x) => x.id === id);
      if (!p) throw new Error('Sivua ei löydy');
      p.title = (data.title || '').trim();
      p.content = data.content || '';
      p.category_id = data.category_id ? Number(data.category_id) : null;
      p.updated_at = nowISO(); p.updated_by = (data.author || '').trim();
      save(DB); return clone(p);
    },
    async remove(id) { await ready; await removePageInternal(Number(id)); save(DB); return { ok: true }; },
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
    if (!q) return { pages: [], notes: [], files: [] };
    const pages = DB.pages.filter((p) => includesCI(p.title, q) || includesCI(p.content, q))
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((p) => ({ id: p.id, title: p.title, category_id: p.category_id, category_name: catName(p.category_id) }));
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
    return { pages, notes, files };
  },
};

async function removePageInternal(id) {
  const atts = DB.attachments.filter((a) => a.page_id === id);
  for (const a of atts) await delBlob(a.id);
  DB.attachments = DB.attachments.filter((a) => a.page_id !== id);
  DB.pages = DB.pages.filter((p) => p.id !== id);
}
