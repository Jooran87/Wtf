'use strict';

// ---------- Pieni apukirjasto ----------
const $ = (sel, root = document) => root.querySelector(sel);
const content = $('#content');

// Datakerros (`Store`) tulee erillisestä tiedostosta: palvelinversiossa
// store-api.js (REST), sandbox-versiossa store-local.js (selaimen tallennus).

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

// ---------- Tila + reititys ----------
let categories = [];
let currentCategoryId = null;

async function loadCategories() {
  categories = await Store.categories.list();
  renderSidebar();
}

function renderSidebar() {
  const ul = $('#categoryList');
  ul.innerHTML = categories.map((c) => `
    <li>
      <button class="cat-btn ${c.id === currentCategoryId ? 'active' : ''}" data-cat="${c.id}">${esc(c.name)}</button>
    </li>`).join('') || '<li class="muted" style="padding:8px 12px">Ei kategorioita vielä</li>';
}

function setActiveNav(nav) {
  document.querySelectorAll('.nav-link').forEach((b) => b.classList.toggle('active', b.dataset.nav === nav));
}

// Reititys hash-osoitteilla: #/, #/kohde/:id, #/sivu/:id, #/muokkaa/:id, #/uusi, #/vuoroloki, #/haku?q=
async function router() {
  const hash = location.hash.slice(1) || '/';
  const [pathPart, queryPart] = hash.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  closeSidebarMobile();

  try {
    if (parts.length === 0) { setActiveNav('home'); return viewHome(); }
    if (parts[0] === 'vuoroloki') { setActiveNav('shiftlog'); return viewShiftLog(); }
    if (parts[0] === 'kohde') { setActiveNav(''); currentCategoryId = +parts[1]; renderSidebar(); return viewCategory(+parts[1]); }
    if (parts[0] === 'sivu') { setActiveNav(''); return viewPage(+parts[1]); }
    if (parts[0] === 'muokkaa') { setActiveNav(''); return viewPageEdit(+parts[1]); }
    if (parts[0] === 'uusi') { setActiveNav(''); const q = new URLSearchParams(queryPart); return viewPageEdit(null, q.get('kohde')); }
    if (parts[0] === 'haku') { setActiveNav(''); const q = new URLSearchParams(queryPart); return viewSearch(q.get('q') || ''); }
  } catch (e) {
    content.innerHTML = `<div class="card empty">Virhe: ${esc(e.message)}</div>`;
  }
}

// ---------- Näkymät ----------
async function viewHome() {
  currentCategoryId = null; renderSidebar();
  const [pages, recentNotes, popular, contacts] = await Promise.all([
    Store.pages.list(),
    Store.notes.list({ limit: 5 }),
    Store.pages.popular(10),
    Store.contacts.list(),
  ]);
  content.innerHTML = `
    <h2>Hälytyskeskuksen työohjeet</h2>
    <p class="muted">Valitse kategoria vasemmalta tai selaa työohjeita ja vuorolokia.</p>
    <div class="home-grid">
      <div class="home-main">
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
          <div class="spread"><h3 style="margin:0">Kaikki työohjeet (${pages.length})</h3></div>
          <ul class="page-list">
            ${pages.map((p) => `<li><button class="page-link" data-page="${p.id}">
              <span>${esc(p.title)}</span>
              <span class="muted">${categoryName(p.category_id)}</span></button></li>`).join('')
              || '<li class="empty">Ei ohjeita vielä. Lisää kategoria ja luo ensimmäinen ohje.</li>'}
          </ul>
        </div>
      </div>
      <div class="home-side">
        <div class="card">
          <div class="spread"><h3 style="margin:0">☎ Tärkeät numerot</h3>
            <button class="icon-btn small" id="addContactBtn" title="Lisää yhteystieto">＋</button></div>
          <ul class="contact-list">
            ${contacts.map(contactHtml).join('') || '<li class="muted" style="border:none">Ei yhteystietoja vielä.</li>'}
          </ul>
        </div>
        <div class="card">
          <div class="spread"><h3 style="margin:0">📝 Viimeisimmät vuorohuomiot</h3>
            <a class="btn small secondary" href="#/vuoroloki">Kaikki</a></div>
          ${recentNotes.map(noteHtml).join('') || '<p class="empty">Ei huomioita vielä.</p>'}
        </div>
      </div>
    </div>`;

  $('#addContactBtn').onclick = () => editContact(null);
  document.querySelectorAll('[data-editcontact]').forEach((b) => b.onclick = () => {
    editContact(contacts.find((c) => String(c.id) === b.dataset.editcontact));
  });
  document.querySelectorAll('[data-delcontact]').forEach((b) => b.onclick = async () => {
    if (confirm('Poistetaanko yhteystieto?')) { await Store.contacts.remove(b.dataset.delcontact); viewHome(); }
  });
}

async function editContact(existing) {
  const label = prompt('Nimi / rooli (esim. IT-tuki, Vuoroesihenkilö):', existing ? existing.label : '');
  if (label === null || !label.trim()) return;
  const phone = prompt('Puhelinnumero:', existing ? existing.phone : '');
  if (phone === null) return;
  const note = prompt('Lisätieto (valinnainen, esim. aukioloaika tai sähköposti):', existing ? existing.note : '') || '';
  const data = { label: label.trim(), phone: phone.trim(), note: note.trim() };
  try {
    if (existing) await Store.contacts.update(existing.id, data);
    else await Store.contacts.create(data);
    toast('Tallennettu'); viewHome();
  } catch (err) { toast(err.message, true); }
}

function categoryName(id) {
  const c = categories.find((x) => x.id === id);
  return c ? c.name : 'Yleinen';
}

async function viewCategory(id) {
  const cat = categories.find((c) => c.id === id);
  const pages = await Store.pages.list(id);
  content.innerHTML = `
    <div class="spread">
      <h2 style="margin:0">${esc(cat ? cat.name : 'Kategoria')}</h2>
      <div class="row">
        <button class="btn small" id="newPageBtn">＋ Uusi ohje</button>
        <button class="btn small secondary" id="renameCatBtn">Nimeä</button>
        <button class="btn small danger" id="delCatBtn">Poista kategoria</button>
      </div>
    </div>
    <div class="card">
      <ul class="page-list">
        ${pages.map((p) => `<li><button class="page-link" data-page="${p.id}">
          <span>${esc(p.title)}</span>
          <span class="muted">${esc(fmtDate(p.updated_at))}</span></button></li>`).join('')
          || '<li class="empty">Ei ohjeita tässä kohteessa. Luo ensimmäinen.</li>'}
      </ul>
    </div>`;

  $('#newPageBtn').onclick = () => { location.hash = `#/uusi?kohde=${id}`; };
  $('#renameCatBtn').onclick = async () => {
    const name = prompt('Kategorian uusi nimi:', cat.name);
    if (name && name.trim()) { await Store.categories.rename(id, name); await loadCategories(); viewCategory(id); toast('Nimetty'); }
  };
  $('#delCatBtn').onclick = async () => {
    if (confirm('Poistetaanko kategoria ja KAIKKI sen ohjeet ja liitteet?')) {
      await Store.categories.remove(id);
      await loadCategories(); location.hash = '#/'; toast('Kategoria poistettu');
    }
  };
}

async function viewPage(id) {
  const p = await Store.pages.get(id, { track: true });
  content.innerHTML = `
    <div class="spread">
      <div>
        <div class="muted"><a href="#/kohde/${p.category_id}">${esc(categoryName(p.category_id))}</a></div>
        <h2 style="margin:4px 0 0">${esc(p.title)}</h2>
      </div>
      <div class="row">
        <button class="btn small secondary" id="editBtn">✏️ Muokkaa</button>
        <button class="btn small danger" id="delBtn">Poista</button>
      </div>
    </div>
    <p class="muted">Päivitetty ${esc(fmtDate(p.updated_at))}${p.updated_by ? ' · ' + esc(p.updated_by) : ''}</p>
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
          ${categories.map((c) => `<option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Sisältö (Markdown: # otsikko, **lihavointi**, - lista)</label>
        <textarea id="contentInput" placeholder="Kirjoita työohje tähän…">${esc(p.content)}</textarea>
      </div>
      <div class="row">
        <button class="btn" id="saveBtn">Tallenna</button>
        <button class="btn secondary" id="cancelBtn">Peruuta</button>
      </div>
    </div>`;

  $('#saveBtn').onclick = async () => {
    const body = {
      title: $('#titleInput').value,
      content: $('#contentInput').value,
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
          ${categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
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

async function viewSearch(q) {
  $('#searchInput').value = q;
  const r = await Store.search(q);
  content.innerHTML = `
    <h2>Hakutulokset: "${esc(q)}"</h2>
    <div class="card">
      <h3 style="margin-top:0">Työohjeet (${r.pages.length})</h3>
      <ul class="page-list">
        ${r.pages.map((p) => `<li><button class="page-link" data-page="${p.id}">
          <span>${esc(p.title)}</span><span class="muted">${esc(p.category_name || 'Yleinen')}</span></button></li>`).join('')
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
    <div class="card">
      <h3 style="margin-top:0">Vuorohuomiot (${r.notes.length})</h3>
      ${r.notes.map(noteHtml).join('') || '<p class="empty">Ei osumia huomioista.</p>'}
    </div>`;
  bindNoteDelete(() => viewSearch(q));
}

// ---------- Osittaiset HTML-palaset ----------
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

document.addEventListener('click', (e) => {
  const page = e.target.closest('[data-page]');
  if (page) { location.hash = '#/sivu/' + page.dataset.page; return; }
  const cat = e.target.closest('[data-cat]');
  if (cat) { location.hash = '#/kohde/' + cat.dataset.cat; return; }
  const nav = e.target.closest('[data-nav]');
  if (nav) { location.hash = nav.dataset.nav === 'home' ? '#/' : '#/vuoroloki'; return; }
});

$('#addCategoryBtn').onclick = async () => {
  const name = prompt('Uuden kategorian nimi:');
  if (name && name.trim()) {
    const c = await Store.categories.create(name);
    await loadCategories(); location.hash = '#/kohde/' + c.id; toast('Kategoria lisätty');
  }
};

$('#searchForm').onsubmit = (e) => {
  e.preventDefault();
  const q = $('#searchInput').value.trim();
  if (q) location.hash = '#/haku?q=' + encodeURIComponent(q);
};

$('#menuToggle').onclick = () => $('#sidebar').classList.toggle('open');

const authorInput = $('#authorInput');
authorInput.value = author.get();
authorInput.oninput = () => author.set(authorInput.value);

window.addEventListener('hashchange', router);

// ---------- Käynnistys ----------
(async function init() {
  await loadCategories();
  router();
})();
