'use strict';
// Datakerros SANDBOX-VERSIOLLE: ei palvelinta, kaikki selaimessa.
// - Rakenteinen data (kohteet, sivut, huomiot, liitteiden tiedot) localStorageen
// - Tiedostojen sisältö (blobit) IndexedDB:hen
// Tarjoaa saman `Store`-rajapinnan kuin store-api.js, joten app.js on identtinen.
// TARKOITUS: ulkoasun hiominen ja demo ilman asennusta. Data on vain tässä
// selaimessa; tyhjennä selaimen tallennustila nollataksesi.

const LS_KEY = 'tyowiki_sandbox_v9';

// ---------- localStorage-malli ----------
function load() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch (_) { return null; }
}
function save(db) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(db)); }
  catch (e) { console.warn('Tallennus selaimeen ei onnistunut:', e); }
}
let DB = load();

const nowISO = () => new Date().toISOString();
function nextId() { DB.seq += 1; return DB.seq; }
function catName(id) { const c = DB.categories.find((x) => x.id === id); return c ? c.name : null; }
// Väri sallitaan vain heksana (#rrggbb), muuten tyhjä – sama sääntö kuin palvelimella.
function cleanColor(v) { v = String(v || '').trim().toLowerCase(); return /^#[0-9a-f]{6}$/.test(v) ? v : ''; }
function clone(x) { return JSON.parse(JSON.stringify(x)); }

// ---------- IndexedDB blobit ----------
// Osa selaimista (mm. Safari file://-tilassa) estää IndexedDB:n. Silloin
// liitteiden sisältö ei ole käytettävissä, mutta KAIKKI MUU toimii –
// virheet eivät saa kaataa sovellusta.
function idb() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open('tyowiki_sandbox_files', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
}
async function putBlob(id, blob) {
  try {
    const db = await idb();
    return await new Promise((res, rej) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put(blob, id);
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
  } catch (e) { console.warn('Liitteen tallennus ei onnistu tässä selaimessa:', e); }
}
// Muistin säästö: object-URL luodaan vain kerran per liite ja käytetään
// uudelleen (ilman välimuistia jokainen sivun avaus vuotaisi uuden URL:n).
const blobUrlCache = new Map();
async function getBlobUrl(id) {
  if (blobUrlCache.has(id)) return blobUrlCache.get(id);
  try {
    const db = await idb();
    const blob = await new Promise((res, rej) => {
      const tx = db.transaction('files', 'readonly');
      const rq = tx.objectStore('files').get(id);
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
    });
    const url = blob ? URL.createObjectURL(blob) : '#';
    blobUrlCache.set(id, url);
    return url;
  } catch (e) { return '#'; }
}
async function delBlob(id) {
  const cached = blobUrlCache.get(id);
  if (cached && cached !== '#') URL.revokeObjectURL(cached);
  blobUrlCache.delete(id);
  try {
    const db = await idb();
    return await new Promise((res) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').delete(id);
      tx.oncomplete = () => res();
    });
  } catch (e) { /* ei kriittinen */ }
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
  DB = { seq: 0, categories: [], pages: [], notes: [], attachments: [], contacts: [], revisions: [], announcements: [], terms: [], links: [] };
  const pereh = { id: nextId(), name: 'Perehdytys', icon: '🎓', color: '#7c3aed', sort_order: 0, parent_id: null };
  DB.categories.push(pereh);
  const kipa = { id: nextId(), name: 'Kipa', icon: '🏢', color: '#c2410c', sort_order: 1, parent_id: null };
  const halytyskeskus = { id: nextId(), name: 'Hälytyskeskus', icon: '🚨', color: '#9d174d', sort_order: 2, parent_id: null };
  const hairiot = { id: nextId(), name: 'Häiriötilanteet', icon: '⚡', color: '#b45309', sort_order: 3, parent_id: null };
  const ism = { id: nextId(), name: 'ISM-ohjeet', icon: '📘', color: '#0369a1', sort_order: 4, parent_id: null };
  DB.categories.push(kipa, halytyskeskus, hairiot, ism);
  // Esimerkki alakategorioista: Kipan alle asiakkuuksittain.
  const kipaAsA = { id: nextId(), name: 'Asiakas A – Toimistotalo', icon: '🏢', sort_order: 1, parent_id: kipa.id };
  const kipaAsB = { id: nextId(), name: 'Asiakas B – Kauppakeskus', icon: '🏬', sort_order: 2, parent_id: kipa.id };
  DB.categories.push(kipaAsA, kipaAsB);

  mkPage(pereh.id, 'Tervetuloa taloon – ensimmäinen työviikko', `# Tervetuloa taloon!

## Päivä 1
- Esittäytyminen ja tilat: työpisteet, tauko- ja sosiaalitilat
- Avaimet, kulkutunnisteet ja pysäköinti
- Tunnukset järjestelmiin (esihenkilö tilaa etukäteen)
- Tämä wiki: etusivu, haku, vuoroloki ja termipankki

## Viikko 1
- Vuorojen käytännöt: vuoronvaihdon rutiinit ja vuorolokin käyttö
- Hälytysten käsittelyn perusteet kokeneen työntekijän vierellä
- Tärkeimmät työohjeet: katso 🔥 Suosituimmat ohjeet etusivulta
- Kohteiden erityispiirteet oman vastuualueen osalta

## Muista
- **Termipankista** löydät talon lyhenteet ja käsitteet
- Kysy rohkeasti – jokainen on ollut uusi joskus

> Pohja: täydennä talon omilla tiedoilla.`, 'Anna', 'perehdytys, uusi työntekijä, ensimmäinen päivä');

  mkPage(pereh.id, 'Perehdytyksen tarkistuslista', `# Perehdytyksen tarkistuslista

Käy kohdat läpi perehdyttäjän kanssa ja kuittaa valmiit.

## Käytännön asiat
- Avaimet ja kulkutunnisteet luovutettu
- Tunnukset järjestelmiin toimivat
- Työvaatteet ja varusteet
- Pysäköinti ja kulkureitit

## Turvallisuus
- Hätäpoistumistiet ja kokoontumispaikka
- Ensiapuvälineet ja defibrillaattorin sijainti
- Toiminta uhkatilanteessa
- Läheltä piti -ilmoituksen tekeminen

## Työtehtävät
- Hälytyksen vastaanotto ja luokittelu (ohje wikissä)
- Paloilmoitinhälytyksen toimintaohje käyty läpi
- Vuorolokin käyttö
- Varamenettely järjestelmäkatkoksessa

## Hallinto
- Sairauspoissaolokäytäntö
- Vuoronvaihdot ja lomatoiveet
- Palkanmaksun perusteet

> Kuittaa valmis perehdytys esihenkilölle.`, 'Anna', 'perehdytys, tarkistuslista, checklist');

  mkPage(kipa.id, 'Kipa – kohteen yleisohje', `# Kipa – kohteen yleisohje

## Kohteen perustiedot
- Tarkista kohdekortti ja yhteyshenkilöt järjestelmästä
- Huomioi kohteen aukioloajat ja kulkureitit

## Kiinteistöhoidon tehtävät
1. Kierrokset sovitun ohjelman mukaan
2. Kirjaa havainnot ja poikkeamat järjestelmään
3. Ilmoita kiireelliset viat välittömästi päivystykseen

> Päivitä tämä ohje kohteen todellisilla tiedoilla.`, 'Anna', 'Kipa, kiinteistöhoito, kohdekortti');

  mkPage(kipaAsA.id, 'Asiakas A – kohdekohtaiset ohjeet', `# Asiakas A – Toimistotalo

## Kulku ja avaimet
- Pääovi avautuu kulkutunnisteella klo 6–20
- Huoltotila 1. kerroksessa, avain avainkaapista nro 12

## Erityispiirteet
- Paloilmoitinkeskus aulassa, koodi vartijalla
- Yöaikaan liiketunnistimet päällä 2.–5. kerroksessa

> Alakategoriaesimerkki: täydennä asiakkaan omilla tiedoilla.`, 'Anna', 'Kipa, asiakas A, toimistotalo');

  mkPage(kipaAsB.id, 'Asiakas B – kohdekohtaiset ohjeet', `# Asiakas B – Kauppakeskus

## Aukiolo ja kierrokset
- Kauppakeskus auki klo 8–21, huoltokierros klo 22
- Tavaraliikenne takapihan kautta

## Erityispiirteet
- Useita paloilmoitinryhmiä – tarkista ryhmänumero hälytyksestä
- Yhteyshenkilö: keskuksen huoltopäällikkö

> Alakategoriaesimerkki: täydennä asiakkaan omilla tiedoilla.`, 'Jukka', 'Kipa, asiakas B, kauppakeskus');

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

  mkPage(hairiot.id, 'Vikailmoituksen tekeminen IT-tukeen', `# Vikailmoitus IT-tukeen

## Ennen ilmoitusta
- Kokeile ensin: käynnistä ohjelma/laite uudelleen
- Katso onko tiedotteissa tietoa tunnetusta häiriöstä

## Ilmoituksen tekeminen
1. Soita **tekniseen tukeen 040 123 4567** (24/7)
2. Kerro: nimesi, työpiste, mikä laite/järjestelmä, mitä tapahtui ja milloin
3. Kerro näkyykö virheilmoitus – lue koodi sellaisenaan
4. Kirjaa saamasi tiketin numero vuorolokiin

## Kiireellisyys
- **Kriittinen** (hälytysjärjestelmä alhaalla): soita AINA, älä jätä vain viestiä
- Muut viat: voi ilmoittaa myös sähköpostilla

> Nettikatkoksen aikana: käytä puhelinta ja kirjaa tapahtumat käsin – vie ne järjestelmään kun yhteys palaa.`, 'Jukka', 'vikailmoitus, IT-tuki, tiketti, häiriö');

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
  const seedViews = [12, 9, 34, 58, 41, 29, 18, 25, 22];
  DB.pages.forEach((p, i) => { p.views = seedViews[i] || 0; });

  // Esimerkit ajantasaisuusvahvistuksesta: tuore, vanhentunut ja vahvistamaton.
  p1.verified_at = nowISO(); p1.verified_by = 'Anna';
  pIsm.verified_at = new Date(Date.now() - 210 * 86400000).toISOString(); pIsm.verified_by = 'Jukka';

  // Termipankin esimerkkitermit.
  const seedTerms = [
    ['Kipa', 'Asiakkuus, jolle tuotamme kiinteistöhoitoa. Kohdeohjeet omassa kategoriassaan.'],
    ['ISM', 'Toimintajärjestelmän mukaiset ohjeet ja menettelyt (toimintakäsikirja).'],
    ['Kohdekortti', 'Kohteen perustiedot: osoite, yhteyshenkilöt, hälytysjärjestelmä, erityispiirteet.'],
    ['A-luokan hälytys', 'Kiireellinen hälytys: henkilö- tai paloturvallisuus vaarassa – toimi välittömästi.'],
    ['Varamenettely', 'Toimintatapa kun normaali järjestelmä ei ole käytettävissä (esim. manuaalinen loki).'],
    ['UPS', 'Akkuvarmennus, joka pitää kriittiset laitteet käynnissä lyhyen sähkökatkon yli.'],
    ['Vuoroloki', 'Wikin osio, johon kirjataan vuoron aikaiset huomiot ja poikkeamat.'],
  ];
  for (const [term, definition] of seedTerms) {
    DB.terms.push({ id: nextId(), term, definition, updated_at: nowISO(), updated_by: 'Anna' });
  }

  DB.contacts = defaultContacts();

  // Esimerkkilinkit.
  const seedLinks = [
    ['Sähköyhtiön häiriökartta', 'https://www.example-sahko.fi/hairiokartta', 'sähkökatkojen laajuus ja arvioitu kesto'],
    ['Palmia intranet', 'https://intra.palmia.fi', 'sisäiset tiedotteet ja lomakkeet'],
    ['Työvuorojärjestelmä', 'https://vuorot.example.fi', 'vuorolistat ja vaihtopyynnöt'],
    ['Ilmatieteen laitos', 'https://www.ilmatieteenlaitos.fi', 'säävaroitukset ja ennusteet'],
  ];
  for (const [label, url, note] of seedLinks) {
    DB.links.push({ id: nextId(), label, url, note, sort_order: DB.links.length + 1 });
  }

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
    { id: nextId(), label: 'Vartiointiliike', phone: '040 456 7890', note: 'piirivartiointi ja hälytyskäynnit', sort_order: 5 },
    { id: nextId(), label: 'Sähköpäivystys', phone: '040 567 8901', note: 'sähköverkon viat', sort_order: 6 },
    { id: nextId(), label: 'Hissihuolto', phone: '0800 456 789', note: 'hissiviat ja jumitukset (24/7)', sort_order: 7 },
  ];
}

// Täydentää vanhat tallennukset uusilla kentillä ilman datan menetystä.
function migrateExisting() {
  let changed = false;
  if (!DB.contacts) { DB.contacts = defaultContacts(); changed = true; }
  if (!DB.revisions) { DB.revisions = []; changed = true; }
  if (!DB.announcements) { DB.announcements = []; changed = true; }
  if (!DB.terms) { DB.terms = []; changed = true; }
  if (!DB.links) { DB.links = []; changed = true; }
  DB.categories.forEach((c) => { if (typeof c.icon !== 'string') { c.icon = ''; changed = true; } });
  DB.categories.forEach((c) => { if (c.parent_id === undefined) { c.parent_id = null; changed = true; } });
  DB.categories.forEach((c) => { if (typeof c.color !== 'string') { c.color = ''; changed = true; } });
  DB.pages.forEach((p) => {
    if (typeof p.views !== 'number') { p.views = 0; changed = true; }
    if (typeof p.keywords !== 'string') { p.keywords = ''; changed = true; }
    if (p.verified_at === undefined) { p.verified_at = null; p.verified_by = ''; changed = true; }
    if (typeof p.sort_order !== 'number') { p.sort_order = 0; changed = true; }
  });
  if (changed) save(DB);
}

function mkPage(catId, title, content, by, keywords) {
  const p = { id: nextId(), category_id: catId, title, content, keywords: keywords || '', updated_at: nowISO(), updated_by: by || '', views: 0, verified_at: null, verified_by: '' };
  DB.pages.push(p); return p;
}
function mkNote(catId, author, content) {
  DB.notes.push({ id: nextId(), category_id: catId, author: author || '', content, created_at: nowISO() });
}

// ---------- Hakuapurit (samat kuin palvelimen logiikka) ----------
function includesCI(hay, q) { return (hay || '').toLowerCase().includes(q.toLowerCase()); }
// Järjestyksen tallennus: sort_order asetetaan annetun id-listan mukaan.
function applyReorder(arr, ids) {
  ids.forEach((id, i) => {
    const item = arr.find((x) => x.id === Number(id));
    if (item) item.sort_order = i + 1;
  });
}

function normalizeUrl(u) {
  u = (u || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}

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

  // Sandboxissa ei ole kirjautumista – app.js ohittaa auth-vaiheen.
  auth: null,

  categories: {
    async list() {
      await ready;
      return clone(DB.categories)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .map((c) => ({ ...c, parent_id: c.parent_id != null ? c.parent_id : null, color: c.color || '',
          page_count: DB.pages.filter((p) => p.category_id === c.id).length }));
    },
    async create(data) {
      await ready;
      const name = (data.name || '').trim();
      if (!name) throw new Error('Nimi puuttuu');
      const parentId = (data.parent_id != null && data.parent_id !== '') ? Number(data.parent_id) : null;
      if (parentId != null) {
        const parent = DB.categories.find((x) => x.id === parentId);
        if (!parent) throw new Error('Yläkategoriaa ei löydy');
        if (parent.parent_id != null) throw new Error('Alakategorialle ei voi luoda omaa alakategoriaa');
      }
      const siblings = DB.categories.filter((x) => (x.parent_id || null) === parentId);
      const c = { id: nextId(), name, icon: (data.icon || '').trim(), color: cleanColor(data.color), parent_id: parentId,
        sort_order: (Math.max(0, ...siblings.map((x) => x.sort_order)) + 1) };
      DB.categories.push(c); save(DB); return clone(c);
    },
    async update(id, data) {
      await ready; id = Number(id);
      const c = DB.categories.find((x) => x.id === id);
      if (!c) throw new Error('Kategoriaa ei löydy');
      const name = (data.name || '').trim();
      if (!name) throw new Error('Nimi puuttuu');
      if ('parent_id' in data) {
        const parentId = (data.parent_id != null && data.parent_id !== '') ? Number(data.parent_id) : null;
        if (parentId != null) {
          if (parentId === id) throw new Error('Kategoria ei voi olla oma yläkategoriansa');
          const parent = DB.categories.find((x) => x.id === parentId);
          if (!parent) throw new Error('Yläkategoriaa ei löydy');
          if (parent.parent_id != null) throw new Error('Alakategorialle ei voi luoda omaa alakategoriaa');
          if (DB.categories.some((x) => x.parent_id === id)) throw new Error('Kategorialla on alakategorioita – siirrä ne ensin');
        }
        c.parent_id = parentId;
      }
      if ('color' in data) c.color = cleanColor(data.color);
      c.name = name; c.icon = (data.icon || '').trim();
      save(DB); return clone(c);
    },
    async remove(id) {
      await ready; id = Number(id);
      const childIds = DB.categories.filter((c) => c.parent_id === id).map((c) => c.id);
      const allCatIds = [id, ...childIds];
      const pageIds = DB.pages.filter((p) => allCatIds.includes(p.category_id)).map((p) => p.id);
      for (const pid of pageIds) await removePageInternal(pid);
      DB.categories = DB.categories.filter((c) => !allCatIds.includes(c.id));
      save(DB); return { ok: true };
    },
    async reorder(ids) { await ready; applyReorder(DB.categories, ids); save(DB); return { ok: true }; },
  },

  pages: {
    async list(categoryId) {
      await ready;
      let rows = DB.pages;
      if (categoryId) {
        categoryId = Number(categoryId);
        rows = rows.filter((p) => p.category_id === categoryId);
        return clone(rows)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.title.localeCompare(b.title))
          .map(({ id, category_id, title, updated_at, updated_by }) => ({ id, category_id, title, updated_at, updated_by }));
      }
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
      // Tilankäytön rajaus (localStorage ~5 Mt): enintään 10 versiota per sivu.
      const mine = DB.revisions.filter((r) => r.page_id === p.id).sort((a, b) => b.id - a.id);
      if (mine.length > 10) {
        const keep = new Set(mine.slice(0, 10).map((r) => r.id));
        DB.revisions = DB.revisions.filter((r) => r.page_id !== p.id || keep.has(r.id));
      }
      p.title = (data.title || '').trim();
      p.content = data.content || '';
      p.keywords = (data.keywords || '').trim();
      p.category_id = data.category_id ? Number(data.category_id) : null;
      p.updated_at = nowISO(); p.updated_by = (data.author || '').trim();
      save(DB); return clone(p);
    },
    async remove(id) { await ready; await removePageInternal(Number(id)); save(DB); return { ok: true }; },
    async reorder(ids) { await ready; applyReorder(DB.pages, ids); save(DB); return { ok: true }; },
    async verify(id, byAuthor) {
      await ready; id = Number(id);
      const p = DB.pages.find((x) => x.id === id);
      if (!p) throw new Error('Sivua ei löydy');
      p.verified_at = nowISO(); p.verified_by = (byAuthor || '').trim();
      save(DB); return clone(p);
    },
    async revisions(id) {
      await ready; id = Number(id);
      return clone(DB.revisions.filter((r) => r.page_id === id))
        .sort((a, b) => b.id - a.id)
        .map(({ id: rid, page_id, title, saved_at, saved_by }) => ({ id: rid, page_id, title, saved_at, saved_by }));
    },
  },

  attachments: {
    async url(id) { await ready; return getBlobUrl(Number(id)); },
    async upload(pageId, files, author) {
      await ready; pageId = Number(pageId);
      if (!DB.pages.find((p) => p.id === pageId)) throw new Error('Sivua ei löydy');
      for (const f of files) {
        if (!ALLOWED.has(f.type)) throw new Error('Tiedostotyyppiä ei sallita: ' + (f.type || 'tuntematon'));
        if (f.size > MAX_SIZE) throw new Error('Tiedosto on liian suuri (max 50 Mt)');
      }
      const newIds = [];
      for (const f of files) {
        const id = nextId();
        newIds.push(id);
        // Selaimessa ei louhita PDF/Office-tekstiä; text-tyypeistä luetaan sisältö.
        // Katto 200 kt merkkejä, ettei localStorage täyty.
        let text = '';
        if (f.type.startsWith('text/')) {
          try { text = (await f.text()).slice(0, 200000); } catch (_) {}
        }
        DB.attachments.push({
          id, page_id: pageId, original_name: f.name, mimetype: f.type,
          size: f.size, uploaded_at: nowISO(), uploaded_by: author || '', text_content: text,
        });
        await putBlob(id, f);
      }
      save(DB); return { ok: true, count: newIds.length, ids: newIds };
    },
    async remove(id) {
      await ready; id = Number(id);
      DB.attachments = DB.attachments.filter((a) => a.id !== id);
      await delBlob(id); save(DB); return { ok: true };
    },
  },

  links: {
    async list() {
      await ready;
      return clone(DB.links).sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, 'fi'));
    },
    async create(data) {
      await ready;
      const label = (data.label || '').trim();
      const url = normalizeUrl(data.url);
      if (!label) throw new Error('Nimi puuttuu');
      if (!url) throw new Error('Osoite puuttuu');
      const l = { id: nextId(), label, url, note: (data.note || '').trim(),
        sort_order: (Math.max(0, ...DB.links.map((x) => x.sort_order)) + 1) };
      DB.links.push(l); save(DB); return clone(l);
    },
    async update(id, data) {
      await ready; id = Number(id);
      const l = DB.links.find((x) => x.id === id);
      if (!l) throw new Error('Linkkiä ei löydy');
      const label = (data.label || '').trim();
      const url = normalizeUrl(data.url);
      if (!label) throw new Error('Nimi puuttuu');
      if (!url) throw new Error('Osoite puuttuu');
      l.label = label; l.url = url; l.note = (data.note || '').trim();
      save(DB); return clone(l);
    },
    async remove(id) {
      await ready; id = Number(id);
      DB.links = DB.links.filter((l) => l.id !== id); save(DB); return { ok: true };
    },
    async reorder(ids) { await ready; applyReorder(DB.links, ids); save(DB); return { ok: true }; },
  },

  terms: {
    async list() {
      await ready;
      return clone(DB.terms).sort((a, b) => a.term.localeCompare(b.term, 'fi'));
    },
    async create(data) {
      await ready;
      const term = (data.term || '').trim();
      if (!term) throw new Error('Termi puuttuu');
      const t = { id: nextId(), term, definition: (data.definition || '').trim(), updated_at: nowISO(), updated_by: (data.author || '').trim() };
      DB.terms.push(t); save(DB); return clone(t);
    },
    async update(id, data) {
      await ready; id = Number(id);
      const t = DB.terms.find((x) => x.id === id);
      if (!t) throw new Error('Termiä ei löydy');
      const term = (data.term || '').trim();
      if (!term) throw new Error('Termi puuttuu');
      t.term = term; t.definition = (data.definition || '').trim();
      t.updated_at = nowISO(); t.updated_by = (data.author || '').trim();
      save(DB); return clone(t);
    },
    async remove(id) {
      await ready; id = Number(id);
      DB.terms = DB.terms.filter((t) => t.id !== id); save(DB); return { ok: true };
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
    async reorder(ids) { await ready; applyReorder(DB.contacts, ids); save(DB); return { ok: true }; },
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
    if (!q) return { pages: [], notes: [], files: [], announcements: [], terms: [], links: [] };
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
    const terms = clone(DB.terms)
      .filter((t) => includesCI(t.term, q) || includesCI(t.definition, q))
      .sort((a, b) => a.term.localeCompare(b.term, 'fi'));
    const links = clone(DB.links)
      .filter((l) => includesCI(l.label, q) || includesCI(l.url, q) || includesCI(l.note, q))
      .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, 'fi'));
    return { pages, notes, files, announcements, terms, links };
  },
};

async function removePageInternal(id) {
  const atts = DB.attachments.filter((a) => a.page_id === id);
  for (const a of atts) await delBlob(a.id);
  DB.attachments = DB.attachments.filter((a) => a.page_id !== id);
  DB.revisions = DB.revisions.filter((r) => r.page_id !== id);
  DB.pages = DB.pages.filter((p) => p.id !== id);
}
