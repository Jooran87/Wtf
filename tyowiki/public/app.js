'use strict';

// ---------- Pieni apukirjasto ----------
const $ = (sel, root = document) => root.querySelector(sel);
const content = $('#content');

// Datakerros (`Store`) tulee erillisestä tiedostosta: palvelinversiossa
// store-api.js (REST), sandbox-versiossa store-local.js (selaimen tallennus).

// Varoitus selaimen sulkemisesta/uudelleenlatauksesta, jos muokkaus on kesken.
function setUnsavedGuard(on) {
  window.onbeforeunload = on ? () => true : null;
}

function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' err' : '');
  setTimeout(() => { el.className = 'toast'; }, 2600);
}

// Nimi tallentuu selaimeen, jotta sitä ei tarvitse kirjoittaa joka kerta.
const author = {
  get: () => localStorage.getItem('tyowiki_author') || '',
  set: (v) => localStorage.setItem('tyowiki_author', v),
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Korostaa hakusanan otteessa (escapeta ensin XSS:n välttämiseksi).
function highlight(text, q) {
  const safe = esc(text);
  if (!q) return safe;
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
  return safe.replace(re, '<mark>$1</mark>');
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('fi-FI', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' t';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' kt';
  return (bytes / 1024 / 1024).toFixed(1) + ' Mt';
}

function fileIcon(mime) {
  if (mime === 'application/pdf') return '📕';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.includes('word')) return '📄';
  if (mime.includes('sheet') || mime.includes('excel')) return '📊';
  return '📎';
}

// ---------- Yksinkertainen Markdown-renderöinti (turvallinen: escapeta ensin) ----------
function renderMarkdown(md) {
  const lines = esc(md).split('\n');
  let html = '', inList = false, inCode = false;
  const inline = (t) => t
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Kuvat ennen linkkejä: liite:ID viittaa wikin omaan liitteeseen,
    // src täytetään jälkikäteen (hydrateDocImages), koska sandboxissa
    // osoite on istuntokohtainen blob-URL.
    .replace(/!\[([^\]]*)\]\(liite:(\d+)\)/g, '<img class="doc-img" alt="$1" data-liite="$2">')
    .replace(/!\[([^\]]*)\]\((https?:[^)]+)\)/g, '<img class="doc-img" alt="$1" src="$2">')
    .replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  for (let raw of lines) {
    if (raw.trim().startsWith('```')) {
      if (inCode) { html += '</code></pre>'; inCode = false; }
      else { if (inList) { html += '</ul>'; inList = false; } html += '<pre><code>'; inCode = true; }
      continue;
    }
    if (inCode) { html += raw + '\n'; continue; }

    const h = raw.match(/^(#{1,3})\s+(.*)$/);
    const li = raw.match(/^\s*[-*]\s+(.*)$/);
    if (h) {
      if (inList) { html += '</ul>'; inList = false; }
      const lvl = h[1].length;
      html += `<h${lvl}>${inline(h[2])}</h${lvl}>`;
    } else if (li) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(li[1])}</li>`;
    } else if (raw.trim() === '') {
      if (inList) { html += '</ul>'; inList = false; }
    } else if (raw.trim().startsWith('&gt;')) {
      html += `<blockquote>${inline(raw.replace(/^\s*&gt;\s?/, ''))}</blockquote>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p>${inline(raw)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  if (inCode) html += '</code></pre>';
  return html;
}

// Täyttää liite-kuvaviittausten (data-liite) osoitteet renderöinnin jälkeen.
async function hydrateDocImages(root) {
  for (const img of root.querySelectorAll('img[data-liite]')) {
    img.onerror = () => {
      const s = document.createElement('span');
      s.className = 'muted'; s.textContent = '[kuva puuttuu]';
      img.replaceWith(s);
    };
    img.src = await Store.attachments.url(+img.dataset.liite);
  }
}

// ---------- Kirjautuminen (vain palvelinversio; sandboxissa Store.auth=null) ----------
let currentUser = null;
const ROLE_LABELS = { admin: 'Ylläpitäjä', editor: 'Muokkaaja', viewer: 'Lukija' };

function authScreen(inner) {
  content.innerHTML = `<div class="auth-wrap"><div class="card auth-card">
    <div class="brand" style="justify-content:center; margin-bottom:14px">
      <span class="brand-mark">P</span>
      <span class="brand-text"><strong>Palmia</strong><small>Hälytyskeskus · Työohjeet</small></span>
    </div>${inner}</div></div>`;
}

function renderLogin(msg) {
  setActiveNav('');
  authScreen(`
    <h2 style="text-align:center; margin:0 0 4px">Kirjaudu sisään</h2>
    ${msg ? `<p class="muted" style="text-align:center">${esc(msg)}</p>` : ''}
    <div class="field"><label>Käyttäjätunnus</label>
      <input type="text" id="loginUser" autocomplete="username" /></div>
    <div class="field"><label>Salasana</label>
      <input type="password" id="loginPass" autocomplete="current-password" /></div>
    <button class="btn" id="loginBtn" style="width:100%">Kirjaudu</button>`);
  const doLogin = async () => {
    try {
      await Store.auth.login({ username: $('#loginUser').value, password: $('#loginPass').value });
      location.reload();
    } catch (err) { toast(err.message, true); }
  };
  $('#loginBtn').onclick = doLogin;
  $('#loginPass').onkeydown = (e) => { if (e.key === 'Enter') doLogin(); };
  $('#loginUser').focus();
}

function renderSetup() {
  setActiveNav('');
  authScreen(`
    <h2 style="text-align:center; margin:0 0 4px">Tervetuloa!</h2>
    <p class="muted" style="text-align:center">Wiki otetaan käyttöön ensimmäistä kertaa.<br/>
      Luo itsellesi <strong>pääkäyttäjätili</strong>.</p>
    <div class="field"><label>Koko nimi (näkyy muokkauksissa)</label>
      <input type="text" id="suName" placeholder="Esim. Miska Fofonoff" /></div>
    <div class="field"><label>Käyttäjätunnus (vähintään 3 merkkiä)</label>
      <input type="text" id="suUser" autocomplete="username" /></div>
    <div class="field"><label>Salasana (vähintään 8 merkkiä)</label>
      <input type="password" id="suPass" autocomplete="new-password" /></div>
    <div class="field"><label>Salasana uudelleen</label>
      <input type="password" id="suPass2" autocomplete="new-password" /></div>
    <button class="btn" id="setupBtn" style="width:100%">Luo pääkäyttäjä</button>`);
  $('#setupBtn').onclick = async () => {
    if ($('#suPass').value !== $('#suPass2').value) return toast('Salasanat eivät täsmää', true);
    try {
      await Store.auth.setup({
        name: $('#suName').value, username: $('#suUser').value, password: $('#suPass').value,
      });
      toast('Pääkäyttäjä luotu'); location.reload();
    } catch (err) { toast(err.message, true); }
  };
  $('#suName').focus();
}

function applyUser(user) {
  currentUser = user;
  author.set(user.name);
  document.documentElement.dataset.vrole = user.role;
  const chip = $('#userChip');
  if (chip) {
    chip.style.display = '';
    chip.innerHTML = `<strong>${esc(user.name)}</strong> · ${esc(ROLE_LABELS[user.role] || user.role)}`;
  }
  const logoutBtn = $('#logoutBtn');
  if (logoutBtn) {
    logoutBtn.style.display = '';
    logoutBtn.onclick = async () => { await Store.auth.logout(); location.reload(); };
  }
  const nameBox = document.querySelector('.user');
  if (nameBox) nameBox.style.display = 'none';
  const usersNav = $('#usersNav');
  if (usersNav && user.role === 'admin') usersNav.style.display = '';
}

async function viewUsers(editId) {
  if (!Store.auth) { location.hash = '#/'; return; }
  const users = await Store.users.list();
  const editing = editId ? users.find((u) => u.id === editId) : null;
  content.innerHTML = `
    <h2>👥 Käyttäjät</h2>
    <p class="muted">Ylläpitäjä hallitsee tunnuksia. Roolit: Ylläpitäjä (kaikki + käyttäjät),
      Muokkaaja (sisällön muokkaus), Lukija (vain luku).</p>
    <div class="card">
      <h3 style="margin-top:0">${editing ? 'Muokkaa: ' + esc(editing.name) : 'Lisää käyttäjä'}</h3>
      <div class="row" style="align-items:flex-end">
        <div class="field" style="flex:1; min-width:150px; margin-bottom:0"><label>Koko nimi</label>
          <input type="text" id="uName" value="${editing ? esc(editing.name) : ''}" /></div>
        <div class="field" style="flex:1; min-width:130px; margin-bottom:0"><label>Tunnus</label>
          <input type="text" id="uUser" value="${editing ? esc(editing.username) : ''}" ${editing ? 'disabled' : ''} /></div>
        <div class="field" style="min-width:130px; margin-bottom:0"><label>Rooli</label>
          <select id="uRole">
            ${['viewer', 'editor', 'admin'].map((r) =>
              `<option value="${r}" ${editing && editing.role === r ? 'selected' : ''}>${ROLE_LABELS[r]}</option>`).join('')}
          </select></div>
        <div class="field" style="flex:1; min-width:150px; margin-bottom:0">
          <label>${editing ? 'Uusi salasana (tyhjä = ei vaihdeta)' : 'Salasana (väh. 8 merkkiä)'}</label>
          <input type="password" id="uPass" autocomplete="new-password" /></div>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn" id="uSaveBtn">${editing ? 'Tallenna' : 'Lisää käyttäjä'}</button>
        ${editing ? '<button class="btn secondary" id="uCancelBtn">Peruuta</button>' : ''}
      </div>
    </div>
    <div class="card">
      <ul class="link-list">
        ${users.map((u) => `<li class="link-row">
          <span class="att-icon">${u.role === 'admin' ? '🛡️' : u.role === 'editor' ? '✏️' : '👁'}</span>
          <span class="att-name"><strong>${esc(u.name)}</strong>
            <div class="att-meta">${esc(u.username)} · ${esc(ROLE_LABELS[u.role] || u.role)}${u.id === currentUser.id ? ' · (sinä)' : ''}</div>
          </span>
          <span class="contact-actions">
            <button class="icon-btn small" data-edituser="${u.id}" title="Muokkaa">✏️</button>
            ${u.id !== currentUser.id ? `<button class="icon-btn small" data-deluser="${u.id}" title="Poista">🗑</button>` : ''}
          </span>
        </li>`).join('')}
      </ul>
    </div>`;

  $('#uSaveBtn').onclick = async () => {
    try {
      if (editing) {
        await Store.users.update(editing.id, {
          name: $('#uName').value, role: $('#uRole').value,
          password: $('#uPass').value || undefined,
        });
        toast('Tallennettu');
      } else {
        await Store.users.create({
          name: $('#uName').value, username: $('#uUser').value,
          role: $('#uRole').value, password: $('#uPass').value,
        });
        toast('Käyttäjä lisätty');
      }
      viewUsers();
    } catch (err) { toast(err.message, true); }
  };
  if (editing) $('#uCancelBtn').onclick = () => viewUsers();
  document.querySelectorAll('[data-edituser]').forEach((b) => b.onclick = () => viewUsers(+b.dataset.edituser));
  document.querySelectorAll('[data-deluser]').forEach((b) => b.onclick = async () => {
    if (confirm('Poistetaanko käyttäjä?')) {
      try { await Store.users.remove(b.dataset.deluser); viewUsers(); }
      catch (err) { toast(err.message, true); }
    }
  });
}

// ---------- Tila + reititys ----------
let categories = [];
let currentCategoryId = null;

async function loadCategories() {
  categories = await Store.categories.list();
  renderSidebar();
}

const CAT_ICONS = ['📄', '🎓', '🏢', '🏬', '🚨', '⚡', '📘', '🧰', '🧹', '🔧', '🛡️', '🗂️', '🏥'];
const catIcon = (c) => (c && c.icon) ? c.icon : '📄';

// Kategorian väriaksentti: valmis paletti + heksavalidointi (turvallinen inline-tyyliin).
const CAT_COLORS = ['#ea6a1e', '#e11d48', '#f59e0b', '#16a34a', '#2563eb', '#8b5cf6', '#0891b2', '#64748b'];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const catColor = (c) => (c && HEX_RE.test(c.color || '')) ? c.color.toLowerCase() : '';
// Palauttaa turvallisen style-attribuutin (tai tyhjän) värille.
const accentStyle = (c) => { const col = catColor(c); return col ? ` style="--cat-accent:${col}"` : ''; };

// Väripalettivalitsin lomakkeisiin. Valinta luetaan elementin data-color-kentästä.
function colorPickerHtml(id, selected) {
  const sel = HEX_RE.test(selected || '') ? selected.toLowerCase() : '';
  return `<div class="color-picker" id="${id}" data-color="${sel}">
    <button type="button" class="swatch swatch-none ${!sel ? 'sel' : ''}" data-c="" title="Ei väriä">∅</button>
    ${CAT_COLORS.map((c) => `<button type="button" class="swatch ${c === sel ? 'sel' : ''}" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}
  </div>`;
}

// Alakategoriat: yksi taso. Pääkategoriat = parent_id tyhjä.
const topCategories = () => categories.filter((c) => !c.parent_id);
const subCategories = (parentId) => categories.filter((c) => c.parent_id === parentId);
const parentOf = (c) => (c && c.parent_id) ? categories.find((x) => x.id === c.parent_id) : null;

// Kategorian ja sen alakategorioiden yhteenlaskettu ohjemäärä.
function totalPageCount(c) {
  let n = c.page_count || 0;
  for (const k of subCategories(c.id)) n += (k.page_count || 0);
  return n;
}

function catRowHtml(c, i, total, isSub) {
  const accent = catColor(c) ? ' has-accent' : '';
  return `<li>
      <button class="cat-btn ${isSub ? 'subcat' : ''}${accent} ${c.id === currentCategoryId ? 'active' : ''}" data-cat="${c.id}"${accentStyle(c)}>
        <span class="cat-ico">${esc(catIcon(c))}</span>
        <span class="cat-name">${esc(c.name)}</span>
        <span class="count-badge">${c.page_count != null ? c.page_count : ''}</span>
      </button>
      <span class="row-order">
        ${i > 0 ? `<button class="icon-btn" data-catmove="${c.id}" data-dir="-1" title="Siirrä ylös">▲</button>` : ''}
        ${i < total - 1 ? `<button class="icon-btn" data-catmove="${c.id}" data-dir="1" title="Siirrä alas">▼</button>` : ''}
      </span>
    </li>`;
}

function renderSidebar() {
  const ul = $('#categoryList');
  const tops = topCategories();
  ul.innerHTML = tops.map((c, i) => {
    const kids = subCategories(c.id);
    return catRowHtml(c, i, tops.length, false)
      + (kids.length ? `<li class="subcat-wrap"><ul class="subcat-list">${
          kids.map((k, j) => catRowHtml(k, j, kids.length, true)).join('')}</ul></li>` : '');
  }).join('') || '<li class="muted" style="padding:8px 12px">Ei kategorioita vielä</li>';
}

// Siirtää id:n annettuun suuntaan id-listassa; palauttaa uuden listan tai null.
function moveInList(ids, id, dir) {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return ids;
}

function iconSelectHtml(id, selected) {
  return `<select id="${id}" title="Ikoni">${CAT_ICONS.map((i) =>
    `<option ${i === selected ? 'selected' : ''}>${i}</option>`).join('')}</select>`;
}

// Kategoriavalinnan optiot hierarkiassa: pääkategoria ja sen alakategoriat
// sisennettynä. Käytetään ohjeen kategorian valintaan.
function categoryOptionsHtml(selectedId) {
  return topCategories().map((c) => {
    const self = `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${esc(c.name)}</option>`;
    const kids = subCategories(c.id).map((k) =>
      `<option value="${k.id}" ${k.id === selectedId ? 'selected' : ''}>  ↳ ${esc(k.name)}</option>`).join('');
    return self + kids;
  }).join('');
}

// Yläkategorian valitsin: tyhjä = pääkategoria. Vain pääkategoriat kelpaavat
// yläkategoriaksi (yksi taso). excludeId jätetään pois (kategoria itse).
function parentSelectHtml(id, selected, excludeId) {
  const opts = topCategories().filter((c) => c.id !== excludeId);
  return `<select id="${id}" class="parent-select" title="Yläkategoria">
    <option value="">— Pääkategoria (ei yläkategoriaa) —</option>
    ${opts.map((c) => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(catIcon(c))} ${esc(c.name)}</option>`).join('')}
  </select>`;
}

function setActiveNav(nav) {
  document.querySelectorAll('.nav-link').forEach((b) => b.classList.toggle('active', b.dataset.nav === nav));
}

// Reititys hash-osoitteilla: #/, #/kohde/:id, #/sivu/:id, #/muokkaa/:id, #/uusi, #/vuoroloki, #/haku?q=
// Oikean reunan kiinnitetty vuoroloki-palsta: näkyy leveillä näytöillä
// muilla sivuilla kuin etusivulla ja vuorolokissa (niissä huomiot ovat jo esillä).
const RAIL_ROUTES = ['kohde', 'sivu', 'tiedotteet', 'termipankki', 'linkit', 'haku', 'historia', 'versio', 'kayttajat'];

function railNoteHtml(n) {
  return `<div class="rail-note">
    <div class="muted">${n.author ? esc(n.author) + ' · ' : ''}${esc(fmtDate(n.created_at))}</div>
    <div>${esc(n.content)}</div>
  </div>`;
}

async function updateRail(section) {
  const rail = $('#rail');
  if (!rail) return;
  if (!RAIL_ROUTES.includes(section)) { rail.innerHTML = ''; return; }
  try {
    const notes = await Store.notes.list({ limit: 5 });
    rail.innerHTML = `<div class="card">
      <div class="spread"><h3 style="margin:0">📝 Vuoroloki</h3>
        <a class="btn small secondary" href="#/vuoroloki">Kaikki</a></div>
      <div class="note-quick">
        <textarea id="railNoteText" placeholder="Kirjaa huomio…"></textarea>
        <button class="btn small" id="railNoteAdd">Lisää huomio</button>
      </div>
      ${notes.map(railNoteHtml).join('') || '<p class="empty">Ei huomioita vielä.</p>'}
    </div>`;
    $('#railNoteAdd').onclick = async () => {
      const text = $('#railNoteText').value;
      if (!text.trim()) return toast('Kirjoita huomio', true);
      try { await Store.notes.create({ content: text, category_id: null, author: author.get() }); toast('Lisätty'); updateRail(section); }
      catch (err) { toast(err.message, true); }
    };
  } catch (_) { rail.innerHTML = ''; }
}

async function router() {
  const hash = location.hash.slice(1) || '/';
  const [pathPart, queryPart] = hash.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  closeSidebarMobile();
  updateRail(parts[0] || '');
  const openCatForm = $('#catForm');
  if (openCatForm) openCatForm.remove();
  setUnsavedGuard(false);

  // Huom: await on pakollinen, jotta catch nappaa myös async-näkymien virheet
  // (esim. poistetun sivun avaaminen).
  try {
    if (parts.length === 0) { setActiveNav('home'); return await viewHome(); }
    if (parts[0] === 'vuoroloki') { setActiveNav('shiftlog'); return await viewShiftLog(); }
    if (parts[0] === 'tiedotteet') { setActiveNav('announcements'); return await viewAnnouncements(); }
    if (parts[0] === 'termipankki') { setActiveNav('terms'); return await viewTerms(); }
    if (parts[0] === 'linkit') { setActiveNav('links'); return await viewLinks(); }
    if (parts[0] === 'kayttajat') { setActiveNav('users'); return await viewUsers(); }
    if (parts[0] === 'historia') { setActiveNav(''); return await viewHistory(+parts[1]); }
    if (parts[0] === 'versio') { setActiveNav(''); return await viewRevision(+parts[1]); }
    if (parts[0] === 'kohde') { setActiveNav(''); currentCategoryId = +parts[1]; renderSidebar(); return await viewCategory(+parts[1]); }
    if (parts[0] === 'sivu') { setActiveNav(''); return await viewPage(+parts[1]); }
    if (parts[0] === 'muokkaa') { setActiveNav(''); return await viewPageEdit(+parts[1]); }
    if (parts[0] === 'uusi') { setActiveNav(''); const q = new URLSearchParams(queryPart); return await viewPageEdit(null, q.get('kohde')); }
    if (parts[0] === 'haku') { setActiveNav(''); const q = new URLSearchParams(queryPart); return await viewSearch(q.get('q') || ''); }
  } catch (e) {
    if (e && e.status === 401 && Store.auth) return renderLogin('Istunto on vanhentunut – kirjaudu uudelleen.');
    content.innerHTML = `<div class="card empty">Virhe: ${esc(e.message)} · <a href="#/">Palaa etusivulle</a></div>`;
  }
}

// ---------- Näkymät ----------
async function viewHome() {
  currentCategoryId = null; renderSidebar();
  const [pages, recentNotes, popular, contacts, anns] = await Promise.all([
    Store.pages.list(),
    Store.notes.list({ limit: 5 }),
    Store.pages.popular(10),
    Store.contacts.list(),
    Store.announcements.list(),
  ]);
  // Kiinnitetyt tiedotteet nousevat bannereiksi ylimmäksi; muut omaan korttiin.
  const pinned = anns.filter((a) => a.pinned);
  const otherAnns = anns.filter((a) => !a.pinned).slice(0, 3);
  // Viimeksi päivitetyt: kertoo yhdellä silmäyksellä mikä on muuttunut.
  const recent = [...pages]
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
    .slice(0, 5);
  content.innerHTML = `
    ${pinned.map((a) => `<a class="pin-banner" href="#/tiedotteet">📌 <strong>${esc(a.title)}</strong>
      <span>${esc(String(a.content || '').replace(/\s+/g, ' ').slice(0, 140))}</span></a>`).join('')}
    <h2>Hälytyskeskuksen työohjeet</h2>
    <p class="muted">Valitse kategoria tai hae yläpalkista (pikanäppäin <code>/</code>).</p>
    <div class="home-grid">
      <div class="hg-num">
        <div class="card">
          <div class="spread"><h3 style="margin:0">☎ Tärkeät numerot</h3>
            <button class="icon-btn small" id="addContactBtn" title="Lisää yhteystieto">＋</button></div>
          <div id="contactFormWrap"></div>
          <ul class="contact-list">
            ${contacts.map(contactHtml).join('') || '<li class="muted" style="border:none">Ei yhteystietoja vielä.</li>'}
          </ul>
        </div>
      </div>
      <div class="home-main">
        <div class="cat-grid">
          ${topCategories().map((c) => {
            const subs = subCategories(c.id);
            const total = totalPageCount(c);
            return `<a class="cat-card${catColor(c) ? ' has-accent' : ''}" href="#/kohde/${c.id}"${accentStyle(c)}>
            <span class="cc-ico">${esc(catIcon(c))}</span>
            <span class="cc-name">${esc(c.name)}</span>
            <span class="cc-count">${total} ohjetta${subs.length ? ` · ${subs.length} alakategoriaa` : ''}</span>
          </a>`;
          }).join('')}
        </div>
        ${otherAnns.length ? `<div class="card">
          <div class="spread"><h3 style="margin:0">📢 Tiedotteet</h3>
            <a class="btn small secondary" href="#/tiedotteet">Kaikki (${anns.length})</a></div>
          ${otherAnns.map((a) => announcementHtml(a, { compact: true })).join('')}
        </div>` : ''}
        <div class="card">
          <div class="spread"><h3 style="margin:0">🔥 Suosituimmat ohjeet</h3></div>
          <ol class="rank-list">
            ${popular.map((p) => `<li><button class="page-link" data-page="${p.id}">
              <span>${esc(p.title)}</span>
              <span class="muted">${esc(p.category_name || 'Yleinen')} · ${p.views} katselua</span></button></li>`).join('')
              || '<li class="empty">Ei vielä tarpeeksi katseluita. Avaa ohjeita, niin suosituimmat kertyvät tähän.</li>'}
          </ol>
        </div>
        <div class="card">
          <div class="spread"><h3 style="margin:0">🕐 Viimeksi päivitetyt</h3></div>
          <ul class="page-list">
            ${recent.map((p) => `<li><button class="page-link" data-page="${p.id}">
              <span>${esc(p.title)}</span>
              <span class="muted">${categoryName(p.category_id)} · ${esc(fmtDate(p.updated_at))}</span></button></li>`).join('')
              || '<li class="empty">Ei ohjeita vielä. Lisää kategoria ja luo ensimmäinen ohje.</li>'}
          </ul>
        </div>
      </div>
      <div class="hg-notes">
        <div class="card">
          <div class="spread"><h3 style="margin:0">📝 Vuorohuomiot</h3>
            <a class="btn small secondary" href="#/vuoroloki">Kaikki</a></div>
          <div class="note-quick">
            <textarea id="homeNoteText" placeholder="Kirjaa huomio vuorolokiin…"></textarea>
            <button class="btn small" id="homeNoteAdd">Lisää huomio</button>
          </div>
          ${recentNotes.map(noteHtml).join('') || '<p class="empty">Ei huomioita vielä.</p>'}
        </div>
      </div>
    </div>`;

  $('#homeNoteAdd').onclick = async () => {
    const text = $('#homeNoteText').value;
    if (!text.trim()) return toast('Kirjoita huomio', true);
    try { await Store.notes.create({ content: text, category_id: null, author: author.get() }); toast('Lisätty'); viewHome(); }
    catch (err) { toast(err.message, true); }
  };
  bindNoteDelete(viewHome);
  $('#addContactBtn').onclick = () => editContact(null);
  document.querySelectorAll('[data-editcontact]').forEach((b) => b.onclick = () => {
    editContact(contacts.find((c) => String(c.id) === b.dataset.editcontact));
  });
  document.querySelectorAll('[data-delcontact]').forEach((b) => b.onclick = async () => {
    if (confirm('Poistetaanko yhteystieto?')) { await Store.contacts.remove(b.dataset.delcontact); viewHome(); }
  });
  document.querySelectorAll('[data-cmove]').forEach((b) => b.onclick = async () => {
    const ids = moveInList(contacts.map((c) => c.id), +b.dataset.cmove, +b.dataset.dir);
    if (ids) { await Store.contacts.reorder(ids); viewHome(); }
  });
}

// Yhteystiedon lisäys/muokkaus: lomake kortin sisään (ei prompt-ikkunoita).
function editContact(existing) {
  const wrap = $('#contactFormWrap');
  if (!wrap) return;
  if (wrap.innerHTML && !existing) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `<div class="contact-form">
    <input type="text" id="cfLabel" placeholder="Nimi / rooli (esim. IT-tuki)" value="${existing ? esc(existing.label) : ''}" />
    <input type="text" id="cfPhone" placeholder="Puhelinnumero" value="${existing ? esc(existing.phone) : ''}" />
    <input type="text" id="cfNote" placeholder="Lisätieto (valinnainen)" value="${existing ? esc(existing.note) : ''}" />
    <div class="row">
      <button class="btn small" id="cfSave">${existing ? 'Tallenna' : 'Lisää'}</button>
      <button class="btn small secondary" id="cfCancel">Peruuta</button>
    </div>
  </div>`;
  $('#cfSave').onclick = async () => {
    const data = { label: $('#cfLabel').value.trim(), phone: $('#cfPhone').value.trim(), note: $('#cfNote').value.trim() };
    if (!data.label) return toast('Anna nimi', true);
    try {
      if (existing) await Store.contacts.update(existing.id, data);
      else await Store.contacts.create(data);
      toast('Tallennettu'); viewHome();
    } catch (err) { toast(err.message, true); }
  };
  $('#cfCancel').onclick = () => { wrap.innerHTML = ''; };
  $('#cfLabel').focus();
}

function categoryName(id) {
  const c = categories.find((x) => x.id === id);
  return c ? c.name : 'Yleinen';
}

async function viewCategory(id) {
  const cat = categories.find((c) => c.id === id);
  if (!cat) {
    content.innerHTML = '<div class="card empty">Kategoriaa ei löydy (se on ehkä poistettu). <a href="#/">Palaa etusivulle</a></div>';
    return;
  }
  const pages = await Store.pages.list(id);
  const parent = parentOf(cat);
  const subs = subCategories(id);
  const crumbs = parent
    ? `<a href="#/">Etusivu</a><span class="sep">›</span><a href="#/kohde/${parent.id}">${esc(parent.name)}</a><span class="sep">›</span><span>${esc(cat.name)}</span>`
    : `<a href="#/">Etusivu</a><span class="sep">›</span><span>${esc(cat.name)}</span>`;
  content.innerHTML = `
    <div class="crumbs">${crumbs}</div>
    <div class="spread">
      <h2 style="margin:0">${esc(catIcon(cat))} ${esc(cat.name)}</h2>
      <div class="row">
        <button class="btn small" id="newPageBtn">＋ Uusi ohje</button>
        ${!parent ? '<button class="btn small secondary" id="newSubBtn">＋ Alakategoria</button>' : ''}
        <button class="btn small secondary" id="renameCatBtn">✏️ Muokkaa</button>
        <button class="btn small danger" id="delCatBtn">Poista kategoria</button>
      </div>
    </div>
    <div id="catEditRow"></div>
    ${subs.length ? `<div class="cat-grid">
      ${subs.map((s) => `<a class="cat-card${catColor(s) ? ' has-accent' : ''}" href="#/kohde/${s.id}"${accentStyle(s)}>
        <span class="cc-ico">${esc(catIcon(s))}</span>
        <span class="cc-name">${esc(s.name)}</span>
        <span class="cc-count">${s.page_count || 0} ohjetta</span>
      </a>`).join('')}
    </div>` : ''}
    <div class="card">
      ${subs.length ? '<div class="spread"><h3 style="margin:0 0 4px">Kategorian omat ohjeet</h3></div>' : ''}
      <ul class="page-list">
        ${pages.map((p, i) => `<li class="orderable">
          <button class="page-link" data-page="${p.id}">
            <span>${esc(p.title)}</span>
            <span class="muted">${esc(fmtDate(p.updated_at))}</span>
          </button>
          <span class="row-order">
            ${i > 0 ? `<button class="icon-btn" data-pmove="${p.id}" data-dir="-1" title="Siirrä ylös">▲</button>` : ''}
            ${i < pages.length - 1 ? `<button class="icon-btn" data-pmove="${p.id}" data-dir="1" title="Siirrä alas">▼</button>` : ''}
          </span>
        </li>`).join('')
          || `<li class="empty">${subs.length ? 'Ei ohjeita suoraan tässä kategoriassa – valitse alakategoria yltä.' : 'Ei ohjeita tässä kategoriassa. Luo ensimmäinen.'}</li>`}
      </ul>
    </div>`;

  document.querySelectorAll('[data-pmove]').forEach((b) => b.onclick = async () => {
    const ids = moveInList(pages.map((p) => p.id), +b.dataset.pmove, +b.dataset.dir);
    if (ids) { await Store.pages.reorder(ids); viewCategory(id); }
  });

  $('#newPageBtn').onclick = () => { location.hash = `#/uusi?kohde=${id}`; };
  const subBtn = $('#newSubBtn');
  if (subBtn) subBtn.onclick = () => {
    const row = $('#catEditRow');
    if (row.dataset.mode === 'sub') { row.innerHTML = ''; row.dataset.mode = ''; return; }
    row.dataset.mode = 'sub';
    row.innerHTML = `<div class="card">
      <div class="row" style="flex-wrap:wrap">
        ${iconSelectHtml('subCatIcon', '🏢')}
        <input type="text" id="subCatName" placeholder="Alakategorian nimi (esim. asiakas)"
          style="flex:1; min-width:180px; padding:8px 10px; border:1px solid var(--border); border-radius:6px" />
        <button class="btn small" id="subCatSave">Lisää alakategoria</button>
      </div>
      <label class="muted" style="display:block;margin:10px 0 4px">Väri</label>
      ${colorPickerHtml('subCatColor', '')}
    </div>`;
    $('#subCatSave').onclick = async () => {
      const name = $('#subCatName').value.trim();
      if (!name) return toast('Anna nimi', true);
      try {
        const c = await Store.categories.create({ name, icon: $('#subCatIcon').value, color: $('#subCatColor').dataset.color, parent_id: id });
        row.innerHTML = ''; row.dataset.mode = '';
        await loadCategories(); location.hash = '#/kohde/' + c.id; toast('Alakategoria lisätty');
      } catch (err) { toast(err.message, true); }
    };
    $('#subCatName').focus();
  };
  // Kategorian muokkaus: siisti lomake promptin sijaan.
  // Alakategoria voidaan siirtää toisen yläkategorian alle tai pääkategoriaksi.
  // Yläkategoriaa (jolla on alakategorioita) ei voi tehdä alakategoriaksi.
  const hasChildren = subs.length > 0;
  $('#renameCatBtn').onclick = () => {
    const row = $('#catEditRow');
    if (row.dataset.mode === 'edit') { row.innerHTML = ''; row.dataset.mode = ''; return; }
    row.dataset.mode = 'edit';
    row.innerHTML = `<div class="card">
      <div class="row" style="flex-wrap:wrap">
        ${iconSelectHtml('editCatIcon', catIcon(cat))}
        <input type="text" id="editCatName" value="${esc(cat.name)}"
          style="flex:1; min-width:180px; padding:8px 10px; border:1px solid var(--border); border-radius:6px" />
        <button class="btn small" id="editCatSave">Tallenna</button>
      </div>
      <label class="muted" style="display:block;margin:10px 0 4px">Väri</label>
      ${colorPickerHtml('editCatColor', cat.color || '')}
      ${hasChildren
        ? '<p class="muted" style="margin:8px 0 0">Tällä kategorialla on alakategorioita, joten sitä ei voi siirtää toisen alle.</p>'
        : `<label class="muted" style="display:block;margin:10px 0 4px">Yläkategoria</label>${parentSelectHtml('editCatParent', cat.parent_id || null, id)}`}
    </div>`;
    $('#editCatSave').onclick = async () => {
      const name = $('#editCatName').value.trim();
      if (!name) return toast('Anna nimi', true);
      const data = { name, icon: $('#editCatIcon').value, color: $('#editCatColor').dataset.color };
      if (!hasChildren) data.parent_id = $('#editCatParent').value || null;
      try {
        await Store.categories.update(id, data);
        await loadCategories(); viewCategory(id); toast('Tallennettu');
      } catch (err) { toast(err.message, true); }
    };
    $('#editCatName').focus();
  };
  const delMsg = subs.length
    ? `Poistetaanko kategoria, sen ${subs.length} alakategoriaa ja KAIKKI niiden ohjeet ja liitteet? Tätä ei voi perua.`
    : 'Poistetaanko kategoria ja KAIKKI sen ohjeet ja liitteet? Tätä ei voi perua.';
  const doDeleteCat = async (password) => {
    try {
      await Store.categories.remove(id, password);
      await loadCategories();
      location.hash = parent ? '#/kohde/' + parent.id : '#/';
      toast('Kategoria poistettu');
    } catch (err) { toast(err.message, true); }
  };
  $('#delCatBtn').onclick = () => {
    // Palvelinversiossa poisto vain ylläpitäjälle ja salasanaa vastaan.
    if (Store.auth) {
      if (currentUser && currentUser.role !== 'admin') return toast('Vain ylläpitäjä voi poistaa kategorioita', true);
      const row = $('#catEditRow');
      if (row.dataset.mode === 'del') { row.innerHTML = ''; row.dataset.mode = ''; return; }
      row.dataset.mode = 'del';
      row.innerHTML = `<div class="card danger-zone">
        <p style="margin:0 0 10px"><strong>⚠️ ${esc(delMsg)}</strong></p>
        <div class="row" style="flex-wrap:wrap">
          <input type="password" id="delCatPass" placeholder="Vahvista omalla salasanallasi" autocomplete="current-password"
            style="flex:1; min-width:200px; padding:8px 10px; border:1px solid var(--border); border-radius:6px" />
          <button class="btn small danger" id="delCatConfirm">Poista lopullisesti</button>
          <button class="btn small secondary" id="delCatCancel">Peruuta</button>
        </div>
      </div>`;
      const submit = () => {
        const pw = $('#delCatPass').value;
        if (!pw) return toast('Anna salasanasi', true);
        doDeleteCat(pw);
      };
      $('#delCatConfirm').onclick = submit;
      $('#delCatPass').onkeydown = (e) => { if (e.key === 'Enter') submit(); };
      $('#delCatCancel').onclick = () => { row.innerHTML = ''; row.dataset.mode = ''; };
      $('#delCatPass').focus();
      return;
    }
    // Sandbox-demo: ei kirjautumista, riittää vahvistus.
    if (confirm(delMsg)) doDeleteCat(null);
  };
}

// Sisällysluettelo pitkiin ohjeisiin: rakentaa otsikoista (h1–h3) linkkilistan
// ja korostaa vierityksen mukaan sen osion, joka on näkyvissä.
let tocObserver = null;
function buildToc() {
  if (tocObserver) { tocObserver.disconnect(); tocObserver = null; }
  const docEl = $('#content .doc');
  const holder = $('#tocHolder');
  if (!docEl || !holder) return;
  const heads = Array.from(docEl.querySelectorAll('h1, h2, h3'));
  if (heads.length < 3) return; // lyhyille ohjeille ei tarvita luetteloa
  heads.forEach((h, i) => { if (!h.id) h.id = 'osio-' + i; h.classList.add('doc-head'); });
  holder.innerHTML = `<nav class="toc-card" aria-label="Sisällys">
    <div class="toc-title">📑 Tällä sivulla</div>
    <ul>${heads.map((h) => `<li class="toc-${h.tagName.toLowerCase()}">
      <a href="#" data-toc="${h.id}">${esc(h.textContent)}</a></li>`).join('')}</ul>
  </nav>`;
  const links = new Map(heads.map((h) => [h.id, holder.querySelector(`[data-toc="${h.id}"]`)]));
  holder.querySelectorAll('[data-toc]').forEach((a) => a.onclick = (e) => {
    e.preventDefault();
    const t = document.getElementById(a.dataset.toc);
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  tocObserver = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      holder.querySelectorAll('[data-toc]').forEach((a) => a.classList.remove('on'));
      const a = links.get(en.target.id); if (a) a.classList.add('on');
    });
  }, { rootMargin: '-72px 0px -70% 0px' });
  heads.forEach((h) => tocObserver.observe(h));
}

async function viewPage(id) {
  const p = await Store.pages.get(id, { track: true });
  content.innerHTML = `
    <div class="spread">
      <div>
        <div class="crumbs"><a href="#/">Etusivu</a><span class="sep">›</span>${p.category_id
          ? `<a href="#/kohde/${p.category_id}">${esc(categoryName(p.category_id))}</a>`
          : esc(categoryName(p.category_id))}<span class="sep">›</span><span>${esc(p.title)}</span></div>
        <h2 style="margin:4px 0 0">${esc(p.title)}</h2>
      </div>
      <div class="row">
        <button class="btn small secondary" id="editBtn">✏️ Muokkaa</button>
        <a class="btn small secondary" href="#/historia/${p.id}">🕘 Historia</a>
        <button class="btn small danger" id="delBtn">Poista</button>
      </div>
    </div>
    <p class="muted">Päivitetty ${esc(fmtDate(p.updated_at))}${p.updated_by ? ' · ' + esc(p.updated_by) : ''}</p>
    <div class="row" style="margin-bottom:12px">
      ${verifyBadge(p)}
      <button class="btn small secondary" id="verifyBtn">✔ Vahvista ajantasaiseksi</button>
    </div>
    ${(p.keywords || '').trim() ? `<div class="tags">${p.keywords.split(',').map((k) => k.trim()).filter(Boolean)
      .map((k) => `<a class="tag-chip" href="#/haku?q=${encodeURIComponent(k)}">${esc(k)}</a>`).join('')}</div>` : ''}
    <div id="tocHolder"></div>
    <div class="card doc">${p.content.trim() ? renderMarkdown(p.content) : '<p class="muted">Ei sisältöä. Klikkaa Muokkaa.</p>'}</div>
    <div class="card">
      <div class="spread"><h3 style="margin:0">📎 Liitteet (${p.attachments.length})</h3></div>
      <ul class="attach-list">
        ${p.attachments.map(attHtml).join('') || '<li class="muted" style="border:none">Ei liitteitä.</li>'}
      </ul>
      <form id="uploadForm" class="row" style="margin-top:12px" enctype="multipart/form-data">
        <input type="file" id="fileInput" name="files" multiple
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.doc,.docx,.xls,.xlsx" />
        <button class="btn small" type="submit">Lataa</button>
        <span class="muted">PDF, kuvat, Word, Excel · max 50 Mt</span>
      </form>
    </div>`;

  hydrateDocImages($('#content'));
  buildToc();

  $('#verifyBtn').onclick = async () => {
    if (!author.get()) return toast('Kirjoita ensin nimesi oikeaan yläkulmaan', true);
    await Store.pages.verify(id, author.get());
    toast('Vahvistettu ajantasaiseksi'); viewPage(id);
  };
  $('#editBtn').onclick = () => { location.hash = '#/muokkaa/' + id; };
  $('#delBtn').onclick = async () => {
    if (confirm('Poistetaanko ohje ja sen liitteet?')) {
      await Store.pages.remove(id);
      location.hash = '#/kohde/' + p.category_id; toast('Ohje poistettu');
    }
  };
  document.querySelectorAll('[data-delatt]').forEach((b) => b.onclick = async () => {
    if (confirm('Poistetaanko liite?')) { await Store.attachments.remove(b.dataset.delatt); viewPage(id); }
  });
  $('#uploadForm').onsubmit = async (e) => {
    e.preventDefault();
    const files = $('#fileInput').files;
    if (!files.length) return toast('Valitse tiedosto ensin', true);
    try {
      await Store.attachments.upload(id, files, author.get());
      toast('Ladattu'); viewPage(id);
    } catch (err) { toast(err.message, true); }
  };
}

async function viewPageEdit(id, presetCat) {
  let p = { title: '', content: '', category_id: presetCat ? +presetCat : (categories[0] && categories[0].id) };
  if (id) p = await Store.pages.get(id);
  content.innerHTML = `
    <h2>${id ? 'Muokkaa ohjetta' : 'Uusi ohje'}</h2>
    <div class="card">
      <div class="field">
        <label>Otsikko</label>
        <input type="text" id="titleInput" value="${esc(p.title)}" placeholder="Esim. Laitteen X käynnistys" />
      </div>
      <div class="field">
        <label>Kategoria</label>
        <select id="catSelect">
          ${categoryOptionsHtml(p.category_id)}
        </select>
      </div>
      <div class="field">
        <label>Avainsanat (pilkuin eroteltuna – haku löytää artikkelin myös näillä)</label>
        <input type="text" id="keywordsInput" value="${esc(p.keywords || '')}" placeholder="Esim. ISM, laatu, toimintajärjestelmä" />
      </div>
      <div class="field">
        <div class="spread" style="margin-bottom:4px">
          <label style="margin-bottom:0">Sisältö (Markdown: # otsikko, **lihavointi**, - lista)</label>
          <span class="row">
            <button type="button" class="btn small secondary" id="insertImgBtn" title="Lisää kuva tiedostosta – tai liitä kuvakaappaus suoraan tekstikenttään (Ctrl/Cmd+V)">📷 Lisää kuva</button>
            <button type="button" class="btn small secondary" id="previewToggle">👁 Esikatselu</button>
          </span>
        </div>
        <input type="file" id="imgFileInput" accept="image/*" multiple style="display:none" />
        <textarea id="contentInput" placeholder="Kirjoita työohje tähän…">${esc(p.content)}</textarea>
        <div id="previewBox" class="doc preview-box" style="display:none"></div>
      </div>
      <div class="row">
        <button class="btn" id="saveBtn">Tallenna</button>
        <button class="btn secondary" id="cancelBtn">Peruuta</button>
      </div>
    </div>`;

  // Jos jotain on muutettu, varoita selaimen sulkemisesta/uudelleenlatauksesta.
  ['titleInput', 'keywordsInput', 'contentInput'].forEach((fid) => {
    const el = $('#' + fid);
    if (el) el.addEventListener('input', () => setUnsavedGuard(true));
  });
  $('#catSelect').addEventListener('change', () => setUnsavedGuard(true));

  // Kuvien lisäys: lataa liitteeksi ja lisää viittaus tekstiin kursorin kohdalle.
  async function insertImages(files) {
    if (!id) return toast('Tallenna ohje ensin – kuvat voi lisätä heti sen jälkeen Muokkaa-näkymässä', true);
    const imgs = Array.from(files).filter((f) => f.type.indexOf('image/') === 0);
    if (!imgs.length) return;
    try {
      const res = await Store.attachments.upload(id, imgs, author.get());
      const ta = $('#contentInput');
      const pos = typeof ta.selectionStart === 'number' ? ta.selectionStart : ta.value.length;
      const md = (res.ids || []).map((aid) => `\n![kuva](liite:${aid})\n`).join('');
      ta.value = ta.value.slice(0, pos) + md + ta.value.slice(pos);
      toast(imgs.length > 1 ? 'Kuvat lisätty' : 'Kuva lisätty');
    } catch (err) { toast(err.message, true); }
  }
  $('#insertImgBtn').onclick = () => $('#imgFileInput').click();
  $('#imgFileInput').onchange = (e) => { insertImages(e.target.files); e.target.value = ''; };
  // Kuvakaappauksen liittäminen suoraan tekstikenttään (Ctrl/Cmd+V).
  $('#contentInput').addEventListener('paste', (e) => {
    const items = (e.clipboardData && e.clipboardData.items) || [];
    const files = [];
    for (const item of items) {
      if (item.type && item.type.indexOf('image/') === 0) {
        const f = item.getAsFile();
        if (f) files.push(new File([f], 'kuvakaappaus-' + Date.now() + '.png', { type: f.type }));
      }
    }
    if (files.length) { e.preventDefault(); insertImages(files); }
  });

  // Esikatselu: näyttää miltä Markdown-muotoilu näyttää ennen tallennusta.
  $('#previewToggle').onclick = () => {
    const ta = $('#contentInput'), box = $('#previewBox'), btn = $('#previewToggle');
    const showPreview = box.style.display === 'none';
    if (showPreview) {
      box.innerHTML = renderMarkdown(ta.value) || '<p class="muted">Ei sisältöä vielä.</p>';
      hydrateDocImages(box);
      box.style.display = ''; ta.style.display = 'none';
      btn.textContent = '✏️ Muokkaa tekstiä';
    } else {
      box.style.display = 'none'; ta.style.display = '';
      btn.textContent = '👁 Esikatselu';
    }
  };

  $('#saveBtn').onclick = async () => {
    const body = {
      title: $('#titleInput').value,
      content: $('#contentInput').value,
      keywords: $('#keywordsInput').value,
      category_id: +$('#catSelect').value,
      author: author.get(),
    };
    if (!body.title.trim()) return toast('Anna otsikko', true);
    try {
      const saved = id
        ? await Store.pages.update(id, body)
        : await Store.pages.create(body);
      toast('Tallennettu'); location.hash = '#/sivu/' + saved.id;
    } catch (err) { toast(err.message, true); }
  };
  $('#cancelBtn').onclick = () => history.back();
}

async function viewShiftLog() {
  const notes = await Store.notes.list({ limit: 200 });
  content.innerHTML = `
    <h2>📝 Vuoroloki</h2>
    <p class="muted">Kirjaa juoksevaan listaan huomiot vuoron ajalta. Uusin näkyy ylimpänä.</p>
    <div class="card">
      <div class="field">
        <label>Kategoria (valinnainen)</label>
        <select id="noteCat">
          <option value="">– Yleinen –</option>
          ${categoryOptionsHtml(null)}
        </select>
      </div>
      <div class="field">
        <label>Huomio</label>
        <textarea id="noteText" style="min-height:90px" placeholder="Mitä vuoron aikana tapahtui?"></textarea>
      </div>
      <button class="btn" id="addNoteBtn">Lisää huomio</button>
    </div>
    <div id="notesList">
      ${notes.map(noteHtml).join('') || '<p class="empty">Ei huomioita vielä.</p>'}
    </div>`;

  $('#addNoteBtn').onclick = async () => {
    const body = { content: $('#noteText').value, category_id: $('#noteCat').value || null, author: author.get() };
    if (!body.content.trim()) return toast('Kirjoita huomio', true);
    try { await Store.notes.create(body); toast('Lisätty'); viewShiftLog(); }
    catch (err) { toast(err.message, true); }
  };
  bindNoteDelete(viewShiftLog);
}

async function viewHistory(pageId) {
  const [p, revs] = await Promise.all([Store.pages.get(pageId), Store.pages.revisions(pageId)]);
  content.innerHTML = `
    <div class="muted"><a href="#/sivu/${p.id}">← ${esc(p.title)}</a></div>
    <h2 style="margin-top:4px">🕘 Versiohistoria</h2>
    <div class="card">
      <ul class="page-list">
        <li><button class="page-link" data-page="${p.id}">
          <span><strong>Nykyinen versio</strong></span>
          <span class="muted">${esc(fmtDate(p.updated_at))}${p.updated_by ? ' · ' + esc(p.updated_by) : ''}</span>
        </button></li>
        ${revs.map((r) => `<li><button class="page-link" data-rev="${r.id}">
          <span>${esc(r.title)}</span>
          <span class="muted">${esc(fmtDate(r.saved_at))}${r.saved_by ? ' · ' + esc(r.saved_by) : ''}</span>
        </button></li>`).join('')
        || '<li class="empty">Ei aiempia versioita. Versio tallentuu aina kun ohjetta muokataan.</li>'}
      </ul>
    </div>`;
  document.querySelectorAll('[data-rev]').forEach((b) => b.onclick = () => {
    location.hash = '#/versio/' + b.dataset.rev;
  });
}

async function viewRevision(revId) {
  const rev = await Store.revisions.get(revId);
  content.innerHTML = `
    <div class="muted"><a href="#/historia/${rev.page_id}">← Versiohistoria</a></div>
    <div class="spread">
      <h2 style="margin:4px 0 0">${esc(rev.title)}</h2>
      <button class="btn small" id="restoreBtn">↩️ Palauta tämä versio</button>
    </div>
    <p class="muted">Vanha versio · tallennettu ${esc(fmtDate(rev.saved_at))}${rev.saved_by ? ' · ' + esc(rev.saved_by) : ''}</p>
    <div class="card doc">${rev.content.trim() ? renderMarkdown(rev.content) : '<p class="muted">Tyhjä sisältö.</p>'}</div>`;
  hydrateDocImages($('#content'));

  $('#restoreBtn').onclick = async () => {
    if (!confirm('Palautetaanko tämä versio? Nykyinen versio tallentuu historiaan.')) return;
    try {
      await Store.pages.update(rev.page_id, {
        title: rev.title, content: rev.content, keywords: rev.keywords || '',
        category_id: rev.category_id, author: author.get(),
      });
      toast('Versio palautettu'); location.hash = '#/sivu/' + rev.page_id;
    } catch (err) { toast(err.message, true); }
  };
}

async function viewAnnouncements(editId) {
  const anns = await Store.announcements.list();
  const editing = editId ? anns.find((a) => a.id === editId) : null;
  content.innerHTML = `
    <h2>📢 Tiedotteet</h2>
    <p class="muted">Kiinnitetyt tiedotteet (📌) pysyvät listan ja etusivun kärjessä.</p>
    <div class="card">
      <h3 style="margin-top:0">${editing ? 'Muokkaa tiedotetta' : 'Uusi tiedote'}</h3>
      <div class="field">
        <label>Otsikko</label>
        <input type="text" id="annTitle" value="${editing ? esc(editing.title) : ''}" placeholder="Esim. Kohteen 4021 huoltokatko 12.7." />
      </div>
      <div class="field">
        <label>Sisältö</label>
        <textarea id="annContent" style="min-height:110px" placeholder="Tiedotteen teksti…">${editing ? esc(editing.content) : ''}</textarea>
      </div>
      <label class="row" style="margin-bottom:12px; cursor:pointer">
        <input type="checkbox" id="annPinned" ${editing && editing.pinned ? 'checked' : ''} />
        📌 Kiinnitä tärkeänä (pysyy kärjessä)
      </label>
      <div class="row">
        <button class="btn" id="annSaveBtn">${editing ? 'Tallenna muutokset' : 'Julkaise tiedote'}</button>
        ${editing ? '<button class="btn secondary" id="annCancelBtn">Peruuta</button>' : ''}
      </div>
    </div>
    <div id="annList">
      ${anns.map((a) => announcementHtml(a)).join('') || '<p class="empty">Ei tiedotteita vielä.</p>'}
    </div>`;

  $('#annSaveBtn').onclick = async () => {
    const body = {
      title: $('#annTitle').value, content: $('#annContent').value,
      pinned: $('#annPinned').checked, author: author.get(),
    };
    if (!body.title.trim()) return toast('Anna otsikko', true);
    try {
      if (editing) await Store.announcements.update(editing.id, body);
      else await Store.announcements.create(body);
      toast(editing ? 'Tallennettu' : 'Tiedote julkaistu'); viewAnnouncements();
    } catch (err) { toast(err.message, true); }
  };
  if (editing) $('#annCancelBtn').onclick = () => viewAnnouncements();
  bindAnnouncementActions(() => viewAnnouncements());
}

function bindAnnouncementActions(refresh) {
  document.querySelectorAll('[data-pin]').forEach((b) => b.onclick = async () => {
    await Store.announcements.update(+b.dataset.pin, { pinned: b.dataset.pinned !== '1' });
    toast(b.dataset.pinned !== '1' ? 'Kiinnitetty' : 'Kiinnitys poistettu'); refresh();
  });
  document.querySelectorAll('[data-editann]').forEach((b) => b.onclick = () => viewAnnouncements(+b.dataset.editann));
  document.querySelectorAll('[data-delann]').forEach((b) => b.onclick = async () => {
    if (confirm('Poistetaanko tiedote?')) { await Store.announcements.remove(b.dataset.delann); refresh(); }
  });
}

async function viewTerms(editId) {
  const terms = await Store.terms.list();
  const editing = editId ? terms.find((t) => t.id === editId) : null;
  // Ryhmittely alkukirjaimen mukaan
  const groups = {};
  for (const t of terms) {
    const letter = (t.term[0] || '?').toUpperCase();
    (groups[letter] = groups[letter] || []).push(t);
  }
  content.innerHTML = `
    <h2>📖 Termipankki</h2>
    <p class="muted">Talon termit, lyhenteet ja käsitteet selkokielellä – erityisesti uusille työntekijöille. Haku löytää myös termit.</p>
    <div class="card">
      <h3 style="margin-top:0">${editing ? 'Muokkaa termiä' : 'Lisää termi'}</h3>
      <div class="row" style="align-items:flex-start">
        <div class="field" style="flex:1; min-width:180px; margin-bottom:0">
          <label>Termi / lyhenne</label>
          <input type="text" id="termInput" value="${editing ? esc(editing.term) : ''}" placeholder="Esim. Kipa" />
        </div>
        <div class="field" style="flex:3; min-width:260px; margin-bottom:0">
          <label>Selitys</label>
          <input type="text" id="defInput" value="${editing ? esc(editing.definition) : ''}" placeholder="Mitä termi tarkoittaa meillä" />
        </div>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn" id="termSaveBtn">${editing ? 'Tallenna' : 'Lisää'}</button>
        ${editing ? '<button class="btn secondary" id="termCancelBtn">Peruuta</button>' : ''}
      </div>
    </div>
    <div class="card">
      ${Object.keys(groups).map((letter) => `
        <div class="term-letter">${esc(letter)}</div>
        <dl class="term-list">
          ${groups[letter].map((t) => `
            <div class="term-row">
              <dt>${esc(t.term)}</dt>
              <dd>${esc(t.definition)}</dd>
              <span class="term-actions">
                <button class="icon-btn small" data-editterm="${t.id}" title="Muokkaa">✏️</button>
                <button class="icon-btn small" data-delterm="${t.id}" title="Poista">🗑</button>
              </span>
            </div>`).join('')}
        </dl>`).join('') || '<p class="empty">Ei termejä vielä. Lisää ensimmäinen yllä.</p>'}
    </div>`;

  $('#termSaveBtn').onclick = async () => {
    const body = { term: $('#termInput').value, definition: $('#defInput').value, author: author.get() };
    if (!body.term.trim()) return toast('Anna termi', true);
    try {
      if (editing) await Store.terms.update(editing.id, body);
      else await Store.terms.create(body);
      toast('Tallennettu'); viewTerms();
    } catch (err) { toast(err.message, true); }
  };
  if (editing) $('#termCancelBtn').onclick = () => viewTerms();
  document.querySelectorAll('[data-editterm]').forEach((b) => b.onclick = () => viewTerms(+b.dataset.editterm));
  document.querySelectorAll('[data-delterm]').forEach((b) => b.onclick = async () => {
    if (confirm('Poistetaanko termi?')) { await Store.terms.remove(b.dataset.delterm); viewTerms(); }
  });
}

async function viewLinks(editId) {
  const links = await Store.links.list();
  const editing = editId ? links.find((l) => l.id === editId) : null;
  content.innerHTML = `
    <h2>🔗 Linkit</h2>
    <p class="muted">Usein tarvitut osoitteet: järjestelmät, häiriökartat, intranet ym.</p>
    <div class="card">
      <h3 style="margin-top:0">${editing ? 'Muokkaa linkkiä' : 'Lisää linkki'}</h3>
      <div class="row" style="align-items:flex-start">
        <div class="field" style="flex:1; min-width:160px; margin-bottom:0">
          <label>Nimi</label>
          <input type="text" id="linkLabel" value="${editing ? esc(editing.label) : ''}" placeholder="Esim. Sähköyhtiön häiriökartta" />
        </div>
        <div class="field" style="flex:1; min-width:200px; margin-bottom:0">
          <label>Osoite (URL)</label>
          <input type="text" id="linkUrl" value="${editing ? esc(editing.url) : ''}" placeholder="esim. hairiokartta.fi" />
        </div>
        <div class="field" style="flex:1; min-width:180px; margin-bottom:0">
          <label>Kuvaus (valinnainen)</label>
          <input type="text" id="linkNote" value="${editing ? esc(editing.note) : ''}" placeholder="Mihin linkkiä käytetään" />
        </div>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn" id="linkSaveBtn">${editing ? 'Tallenna' : 'Lisää'}</button>
        ${editing ? '<button class="btn secondary" id="linkCancelBtn">Peruuta</button>' : ''}
      </div>
    </div>
    <div class="card">
      <ul class="link-list">
        ${links.map(linkHtml).join('') || '<li class="empty">Ei linkkejä vielä. Lisää ensimmäinen yllä.</li>'}
      </ul>
    </div>`;

  $('#linkSaveBtn').onclick = async () => {
    const body = { label: $('#linkLabel').value, url: $('#linkUrl').value, note: $('#linkNote').value };
    if (!body.label.trim()) return toast('Anna nimi', true);
    if (!body.url.trim()) return toast('Anna osoite', true);
    try {
      if (editing) await Store.links.update(editing.id, body);
      else await Store.links.create(body);
      toast('Tallennettu'); viewLinks();
    } catch (err) { toast(err.message, true); }
  };
  if (editing) $('#linkCancelBtn').onclick = () => viewLinks();
  document.querySelectorAll('[data-editlink]').forEach((b) => b.onclick = () => viewLinks(+b.dataset.editlink));
  document.querySelectorAll('[data-dellink]').forEach((b) => b.onclick = async () => {
    if (confirm('Poistetaanko linkki?')) { await Store.links.remove(b.dataset.dellink); viewLinks(); }
  });
  document.querySelectorAll('[data-lmove]').forEach((b) => b.onclick = async () => {
    const ids = moveInList(links.map((l) => l.id), +b.dataset.lmove, +b.dataset.dir);
    if (ids) { await Store.links.reorder(ids); viewLinks(); }
  });
}

function linkHtml(l) {
  return `<li class="link-row">
    <span class="att-icon">🔗</span>
    <span class="att-name">
      <a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>
      <div class="att-meta">${esc(l.url)}${l.note ? ' · ' + esc(l.note) : ''}</div>
    </span>
    <span class="contact-actions">
      <span class="row-order">
        <button class="icon-btn" data-lmove="${l.id}" data-dir="-1" title="Siirrä ylös">▲</button>
        <button class="icon-btn" data-lmove="${l.id}" data-dir="1" title="Siirrä alas">▼</button>
      </span>
      <button class="icon-btn small" data-editlink="${l.id}" title="Muokkaa">✏️</button>
      <button class="icon-btn small" data-dellink="${l.id}" title="Poista">🗑</button>
    </span>
  </li>`;
}

async function viewSearch(q) {
  $('#searchInput').value = q;
  const r = await Store.search(q);
  content.innerHTML = `
    <h2>Hakutulokset: "${esc(q)}"</h2>
    <div class="card">
      <h3 style="margin-top:0">Työohjeet (${r.pages.length})</h3>
      <ul class="page-list">
        ${r.pages.map((p) => `<li><button class="page-link result" data-page="${p.id}">
          <span class="result-main">
            <span>${esc(p.title)}</span>
            ${p.snippet ? `<span class="snippet">${highlight(p.snippet, q)}</span>` : ''}
          </span>
          <span class="muted">${esc(p.category_name || 'Yleinen')}</span></button></li>`).join('')
          || '<li class="empty">Ei osumia ohjeista.</li>'}
      </ul>
    </div>
    <div class="card">
      <h3 style="margin-top:0">📎 Tiedostot (${r.files.length})</h3>
      <ul class="attach-list">
        ${r.files.map((f) => `<li>
          <span class="att-icon">${fileIcon(f.mimetype)}</span>
          <span class="att-name">
            <a href="${f.url}" target="_blank" rel="noopener">${esc(f.original_name)}</a>
            <div class="att-meta">Sivulla: <a href="#/sivu/${f.page_id}">${esc(f.page_title)}</a>
              ${f.category_name ? ' · ' + esc(f.category_name) : ''}</div>
            ${f.snippet ? `<div class="snippet">${highlight(f.snippet, q)}</div>` : ''}
          </span>
        </li>`).join('') || '<li class="muted" style="border:none">Ei osumia tiedostoista.</li>'}
      </ul>
    </div>
    ${(r.links || []).length ? `<div class="card">
      <h3 style="margin-top:0">🔗 Linkit (${r.links.length})</h3>
      <ul class="link-list">
        ${r.links.map((l) => `<li class="link-row">
          <span class="att-icon">🔗</span>
          <span class="att-name">
            <a href="${esc(l.url)}" target="_blank" rel="noopener">${highlight(l.label, q)}</a>
            <div class="att-meta">${esc(l.url)}${l.note ? ' · ' + esc(l.note) : ''}</div>
          </span>
        </li>`).join('')}
      </ul>
    </div>` : ''}
    ${(r.terms || []).length ? `<div class="card">
      <h3 style="margin-top:0">📖 Termit (${r.terms.length})</h3>
      <dl class="term-list">
        ${r.terms.map((t) => `<div class="term-row">
          <dt>${highlight(t.term, q)}</dt>
          <dd>${highlight(t.definition, q)}</dd>
          <span class="term-actions"><a class="btn small secondary" href="#/termipankki">Termipankki</a></span>
        </div>`).join('')}
      </dl>
    </div>` : ''}
    <div class="card">
      <h3 style="margin-top:0">📢 Tiedotteet (${(r.announcements || []).length})</h3>
      ${(r.announcements || []).map((a) => announcementHtml(a, { compact: true })).join('')
        || '<p class="empty">Ei osumia tiedotteista.</p>'}
    </div>
    <div class="card">
      <h3 style="margin-top:0">Vuorohuomiot (${r.notes.length})</h3>
      ${r.notes.map(noteHtml).join('') || '<p class="empty">Ei osumia huomioista.</p>'}
    </div>`;
  bindNoteDelete(() => viewSearch(q));
}

// ---------- Osittaiset HTML-palaset ----------
// Ajantasaisuusmerkki: vihreä jos vahvistettu ≤ 180 pv sitten, punainen jos
// vahvistus on sitä vanhempi, harmaa jos ei koskaan vahvistettu.
const VERIFY_MAX_DAYS = 180;
function verifyBadge(p) {
  if (!p.verified_at) {
    return '<span class="verify-badge never">Ei vahvistettu ajantasaiseksi</span>';
  }
  const days = Math.floor((Date.now() - new Date(p.verified_at).getTime()) / 86400000);
  const meta = esc(fmtDate(p.verified_at)) + (p.verified_by ? ' · ' + esc(p.verified_by) : '');
  if (days > VERIFY_MAX_DAYS) {
    return `<span class="verify-badge stale">⚠️ Vahvistus vanhentunut (${meta})</span>`;
  }
  return `<span class="verify-badge ok">✔ Vahvistettu ajantasaiseksi ${meta}</span>`;
}

function announcementHtml(a, { compact } = {}) {
  return `<div class="ann ${a.pinned ? 'pinned' : ''}">
    <div class="ann-head">
      <strong class="ann-title">${a.pinned ? '📌 ' : ''}${esc(a.title)}</strong>
      <span class="ann-actions">
        ${compact ? '' : `<button class="icon-btn small" data-pin="${a.id}" data-pinned="${a.pinned ? 1 : 0}"
          title="${a.pinned ? 'Poista kiinnitys' : 'Kiinnitä'}">${a.pinned ? '📌' : '📍'}</button>
        <button class="icon-btn small" data-editann="${a.id}" title="Muokkaa">✏️</button>
        <button class="icon-btn small" data-delann="${a.id}" title="Poista">🗑</button>`}
      </span>
    </div>
    ${a.content.trim() ? `<div class="ann-body">${esc(a.content)}</div>` : ''}
    <div class="ann-meta">${esc(fmtDate(a.created_at))}${a.created_by ? ' · ' + esc(a.created_by) : ''}</div>
  </div>`;
}

function noteHtml(n) {
  return `<div class="note">
    <div class="note-head">
      <span>${n.author ? '<strong>' + esc(n.author) + '</strong> · ' : ''}${esc(fmtDate(n.created_at))}
        ${n.category_name ? '· <span class="tag">' + esc(n.category_name) + '</span>' : ''}</span>
      <button class="icon-btn small" data-delnote="${n.id}" title="Poista">🗑</button>
    </div>
    <div class="note-body">${esc(n.content)}</div>
  </div>`;
}

function contactHtml(c) {
  const tel = c.phone ? c.phone.replace(/[^\d+]/g, '') : '';
  return `<li class="contact">
    <div class="contact-main">
      <div class="contact-label">${esc(c.label)}</div>
      ${c.phone ? `<a class="contact-phone" href="tel:${esc(tel)}">${esc(c.phone)}</a>` : ''}
      ${c.note ? `<div class="att-meta">${esc(c.note)}</div>` : ''}
    </div>
    <div class="contact-actions">
      <span class="row-order">
        <button class="icon-btn" data-cmove="${c.id}" data-dir="-1" title="Siirrä ylös">▲</button>
        <button class="icon-btn" data-cmove="${c.id}" data-dir="1" title="Siirrä alas">▼</button>
      </span>
      <button class="icon-btn small" data-editcontact="${c.id}" title="Muokkaa">✏️</button>
      <button class="icon-btn small" data-delcontact="${c.id}" title="Poista">🗑</button>
    </div>
  </li>`;
}

function attHtml(a) {
  return `<li>
    <span class="att-icon">${fileIcon(a.mimetype)}</span>
    <span class="att-name">
      <a href="${a.url}" target="_blank" rel="noopener">${esc(a.original_name)}</a>
      <div class="att-meta">${fmtSize(a.size)} · ${esc(fmtDate(a.uploaded_at))}${a.uploaded_by ? ' · ' + esc(a.uploaded_by) : ''}</div>
    </span>
    <button class="btn small danger" data-delatt="${a.id}">Poista</button>
  </li>`;
}

function bindNoteDelete(refresh) {
  document.querySelectorAll('[data-delnote]').forEach((b) => b.onclick = async () => {
    if (confirm('Poistetaanko huomio?')) { await Store.notes.remove(b.dataset.delnote); refresh(); }
  });
}

// ---------- Globaalit tapahtumat ----------
function closeSidebarMobile() { $('#sidebar').classList.remove('open'); }

document.addEventListener('click', async (e) => {
  // Värivalitsin: valitse sävy ja tallenna se pickerin data-color-kenttään.
  const swatch = e.target.closest('.color-picker .swatch');
  if (swatch) {
    e.preventDefault();
    const picker = swatch.closest('.color-picker');
    picker.dataset.color = swatch.dataset.c || '';
    picker.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('sel', s === swatch));
    return;
  }
  const catMove = e.target.closest('[data-catmove]');
  if (catMove) {
    // Järjestys vaihdetaan vain sisarusten (saman yläkategorian) kesken.
    const cid = +catMove.dataset.catmove;
    const moved = categories.find((c) => c.id === cid);
    const siblingIds = categories.filter((c) => (c.parent_id || null) === (moved.parent_id || null)).map((c) => c.id);
    const ids = moveInList(siblingIds, cid, +catMove.dataset.dir);
    if (ids) { await Store.categories.reorder(ids); await loadCategories(); }
    return;
  }
  const page = e.target.closest('[data-page]');
  if (page) { location.hash = '#/sivu/' + page.dataset.page; return; }
  const cat = e.target.closest('[data-cat]');
  if (cat) { location.hash = '#/kohde/' + cat.dataset.cat; return; }
  const nav = e.target.closest('[data-nav]');
  if (nav) {
    const routes = { home: '#/', shiftlog: '#/vuoroloki', announcements: '#/tiedotteet', terms: '#/termipankki', links: '#/linkit', users: '#/kayttajat' };
    location.hash = routes[nav.dataset.nav] || '#/';
    return;
  }
});

// Kategorian lisäys: siisti pikalomake sivupalkkiin (ei selaimen prompt-ikkunaa).
$('#addCategoryBtn').onclick = () => {
  const existing = $('#catForm');
  if (existing) { existing.remove(); return; }
  const wrap = document.createElement('div');
  wrap.id = 'catForm'; wrap.className = 'cat-form';
  wrap.innerHTML = `<div class="row" style="width:100%">
      ${iconSelectHtml('newCatIcon', '📄')}
      <input id="newCatName" type="text" placeholder="Kategorian nimi" style="flex:1;min-width:0" />
    </div>
    ${parentSelectHtml('newCatParent', null, null)}
    ${colorPickerHtml('newCatColor', '')}
    <button class="btn small" id="newCatSave" style="width:100%">Lisää kategoria</button>`;
  $('#categoryList').before(wrap);
  const saveCat = async () => {
    const name = $('#newCatName').value.trim();
    if (!name) return toast('Anna nimi', true);
    try {
      const c = await Store.categories.create({ name, icon: $('#newCatIcon').value, color: $('#newCatColor').dataset.color, parent_id: $('#newCatParent').value || null });
      wrap.remove(); await loadCategories();
      location.hash = '#/kohde/' + c.id; toast('Kategoria lisätty');
    } catch (err) { toast(err.message, true); }
  };
  $('#newCatSave').onclick = saveCat;
  $('#newCatName').onkeydown = (e) => { if (e.key === 'Enter') saveCat(); };
  $('#newCatName').focus();
};

$('#searchForm').onsubmit = (e) => {
  e.preventDefault();
  const q = $('#searchInput').value.trim();
  if (q) location.hash = '#/haku?q=' + encodeURIComponent(q);
};

// Live-haku: parhaat osumat pudotusvalikossa jo kirjoittaessa (nopea löytö).
(function initLiveSearch() {
  const input = $('#searchInput');
  const form = $('#searchForm');
  if (!input || !form) return;
  form.classList.add('has-drop');
  const drop = document.createElement('div');
  drop.id = 'searchDrop';
  drop.className = 'search-drop';
  drop.style.display = 'none';
  form.appendChild(drop);
  let items = [];   // näkyvät rivit järjestyksessä (näppäinnavigointia varten)
  let hi = -1;      // korostettu rivi
  let timer = null;
  let lastQ = '';

  const hide = () => { drop.style.display = 'none'; hi = -1; };
  const highlight = () => drop.querySelectorAll('.sd-item').forEach((el, i) => el.classList.toggle('hl', i === hi));
  const go = (href) => { hide(); location.hash = href; };

  async function run(q) {
    if (q.length < 2) { hide(); return; }
    let r;
    try { r = await Store.search(q); } catch (_) { hide(); return; }
    if (q !== lastQ) return; // vanhentunut vastaus – ohitetaan
    const groups = [];
    if (r.pages.length) groups.push(['Ohjeet', r.pages.slice(0, 6).map((p) => ({
      href: '#/sivu/' + p.id, label: p.title, meta: p.category_name || 'Yleinen' }))]);
    if (r.terms.length) groups.push(['Termit', r.terms.slice(0, 3).map((t) => ({
      href: '#/haku?q=' + encodeURIComponent(t.term), label: t.term, meta: 'termi' }))]);
    if (r.files.length) groups.push(['Liitteet', r.files.slice(0, 3).map((f) => ({
      href: '#/sivu/' + f.page_id, label: f.original_name, meta: f.page_title || 'liite' }))]);
    items = [];
    if (!groups.length) {
      drop.innerHTML = '<div class="sd-empty">Ei osumia – paina Enter täydelle haulle</div>';
      drop.style.display = ''; hi = -1; return;
    }
    let html = '';
    for (const [name, rows] of groups) {
      html += `<div class="sd-grp">${esc(name)}</div>`;
      for (const row of rows) {
        const idx = items.length; items.push(row);
        html += `<a class="sd-item" data-i="${idx}" href="${esc(row.href)}">
          <span class="sd-label">${esc(row.label)}</span><span class="sd-meta">${esc(row.meta)}</span></a>`;
      }
    }
    html += `<button type="button" class="sd-all">Näytä kaikki tulokset “${esc(q)}” →</button>`;
    drop.innerHTML = html;
    drop.style.display = ''; hi = -1;
    // mousedown (ei click), jotta navigointi ehtii ennen kentän blur-piilotusta
    drop.querySelectorAll('.sd-item').forEach((a) =>
      a.onmousedown = (e) => { e.preventDefault(); go(a.getAttribute('href')); });
    const allBtn = drop.querySelector('.sd-all');
    if (allBtn) allBtn.onmousedown = (e) => { e.preventDefault(); go('#/haku?q=' + encodeURIComponent(q)); };
  }

  input.addEventListener('input', () => {
    lastQ = input.value.trim();
    clearTimeout(timer);
    timer = setTimeout(() => run(lastQ), 160);
  });
  input.addEventListener('keydown', (e) => {
    if (drop.style.display === 'none') return;
    const links = drop.querySelectorAll('.sd-item');
    if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hi + 1, links.length - 1); highlight(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(hi - 1, -1); highlight(); }
    else if (e.key === 'Enter') { if (hi >= 0 && items[hi]) { e.preventDefault(); go(items[hi].href); } }
    else if (e.key === 'Escape') { hide(); }
  });
  input.addEventListener('blur', () => setTimeout(hide, 120));
  input.addEventListener('focus', () => { const q = input.value.trim(); if (q.length >= 2) run(q); });
})();

$('#menuToggle').onclick = () => $('#sidebar').classList.toggle('open');

// Teema: tallennettu valinta > käyttöjärjestelmän asetus.
function applyTheme() {
  let saved = null;
  try { saved = localStorage.getItem('tyowiki_theme'); } catch (_) {}
  const dark = saved ? saved === 'dark'
    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const btn = $('#themeToggle');
  if (btn) { btn.textContent = dark ? '☀️' : '🌙'; btn.title = dark ? 'Vaalea tila' : 'Tumma tila'; }
}
const themeToggle = $('#themeToggle');
if (themeToggle) themeToggle.onclick = () => {
  const nowDark = document.documentElement.dataset.theme === 'dark';
  try { localStorage.setItem('tyowiki_theme', nowDark ? 'light' : 'dark'); } catch (_) {}
  applyTheme();
};
applyTheme();
// Seuraa käyttöjärjestelmän teemanvaihtoa, jos käyttäjä ei ole valinnut itse.
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    let saved = null;
    try { saved = localStorage.getItem('tyowiki_theme'); } catch (_) {}
    if (!saved) applyTheme();
  });
}

// Pikanäppäin: / vie hakukenttään.
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
    e.preventDefault(); $('#searchInput').focus();
  }
});

// Takaisin ylös -nappi pitkillä sivuilla.
const backTop = document.createElement('button');
backTop.id = 'backTop'; backTop.title = 'Takaisin ylös'; backTop.textContent = '↑';
document.body.appendChild(backTop);
backTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
window.addEventListener('scroll', () => backTop.classList.toggle('show', window.scrollY > 600), { passive: true });

// Offline-versio: yksi HTML-tiedosto puhelimeen, toimii ilman verkkoa.
const offlineBtn = $('#offlineBtn');
if (offlineBtn) offlineBtn.onclick = async () => {
  if (Store.mode === 'server') { window.location.href = '/offline?download=1'; return; }
  // Sandbox: koostetaan tiedosto selaimen datasta.
  toast('Kootaan offline-versiota…');
  try {
    const [cats, pageList, terms, contacts, anns, links] = await Promise.all([
      Store.categories.list(), Store.pages.list(), Store.terms.list(),
      Store.contacts.list(), Store.announcements.list(), Store.links.list(),
    ]);
    const pages = [];
    for (const p of pageList) pages.push(await Store.pages.get(p.id));
    const html = buildOfflineHtml({
      generatedAt: new Date().toISOString(),
      categories: cats, pages, terms, contacts, announcements: anns, links,
    });
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tyowiki-offline.html';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Offline-versio ladattu');
  } catch (err) { toast(err.message, true); }
};

const authorInput = $('#authorInput');
authorInput.value = author.get();
authorInput.oninput = () => author.set(authorInput.value);

window.addEventListener('hashchange', router);

// ---------- Käynnistys ----------
(async function init() {
  try {
    if (Store.auth) {
      const st = await Store.auth.status();
      if (st.setupRequired) return renderSetup();
      if (!st.user) return renderLogin();
      applyUser(st.user);
    }
    await loadCategories();
    router();
  } catch (e) {
    content.innerHTML = `<div class="card empty">Sovelluksen käynnistys epäonnistui: ${esc(e.message)}.<br/>
      Kokeile toista selainta (Chrome/Edge/Firefox) tai tyhjennä sivuston selaintiedot.</div>`;
  }
})();
