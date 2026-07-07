// Kokoaa sandboxin YHDEKSI itsenäiseksi HTML-tiedostoksi, jonka voi
// tuplaklikata auki ilman palvelinta ja ilman muita tiedostoja.
// Lähteet pysyvät yhdessä paikassa (public/styles.css, public/app.js,
// sandbox/store-local.js) – tämä vain niputtaa ne. Aja tyylimuutosten jälkeen:
//   node sandbox/build-single.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8');
const offlineTpl = fs.readFileSync(path.join(root, 'public', 'offline-template.js'), 'utf8');
const storeLocal = fs.readFileSync(path.join(__dirname, 'store-local.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');

const html = `<!DOCTYPE html>
<html lang="fi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Palmia Hälytyskeskus – Työohjeet (Sandbox)</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiNlYTZhMWUiLz48dGV4dCB4PSIzMiIgeT0iNDUiIGZvbnQtZmFtaWx5PSJBcmlhbCxIZWx2ZXRpY2Esc2Fucy1zZXJpZiIgZm9udC1zaXplPSIzOCIgZm9udC13ZWlnaHQ9IjgwMCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+UDwvdGV4dD48L3N2Zz4=" />
  <script>
    /* Teema ennen renderöintiä, ettei sivu välähdä väärällä värillä */
    (function(){try{var t=localStorage.getItem('tyowiki_theme');
      if(!t&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)t='dark';
      document.documentElement.dataset.theme=t==='dark'?'dark':'light';}catch(e){}})();
  </script>
  <style>
${css}
    .sandbox-badge { background:#1c2430; color:#fff; font-size:11px; font-weight:700;
      padding:2px 8px; border-radius:10px; text-transform:uppercase; letter-spacing:.04em; }
  </style>
</head>
<body>
  <header class="topbar">
    <button id="menuToggle" class="icon-btn" title="Valikko" aria-label="Valikko">☰</button>
    <div class="brand" data-nav="home">
      <span class="brand-mark">P</span>
      <span class="brand-text"><strong>Palmia</strong><small>Hälytyskeskus · Työohjeet</small></span>
    </div>
    <span class="sandbox-badge" title="Demo: data tallentuu vain tähän selaimeen">Sandbox</span>
    <form id="searchForm" class="search">
      <input id="searchInput" type="search" placeholder="Hae ohjeista, huomioista ja tiedostoista…" autocomplete="off" />
    </form>
    <button id="themeToggle" class="icon-btn" title="Tumma tila">🌙</button>
    <span id="userChip" class="user-chip" style="display:none"></span>
    <button id="logoutBtn" class="btn small secondary" style="display:none">Kirjaudu ulos</button>
    <div class="user"><label>Nimesi:</label><input id="authorInput" type="text" placeholder="Etunimi" /></div>
  </header>
  <div class="layout">
    <aside id="sidebar" class="sidebar">
      <nav>
        <button class="nav-link" data-nav="home">🏠 Etusivu</button>
        <button class="nav-link" data-nav="announcements">📢 Tiedotteet</button>
        <button class="nav-link" data-nav="shiftlog">📝 Vuoroloki</button>
        <button class="nav-link" data-nav="terms">📖 Termipankki</button>
        <button class="nav-link" data-nav="links">🔗 Linkit</button>
        <button class="nav-link" data-nav="users" id="usersNav" style="display:none">👥 Käyttäjät</button>
        <button class="nav-link" id="offlineBtn" title="Lataa puhelimeen – toimii ilman verkkoa">📴 Offline-versio</button>
      </nav>
      <div class="sidebar-section">
        <div class="sidebar-title"><span>Ohjeet</span>
          <span class="sidebar-title-actions">
            <button id="toggleSubcatsBtn" class="icon-btn small" title="Piilota alakategoriat">▾</button>
            <button id="addCategoryBtn" class="icon-btn small" title="Lisää kategoria">＋</button></span></div>
        <ul id="categoryList" class="category-list"></ul>
      </div>
    </aside>
    <main id="content" class="content">
      <div class="card empty" id="jsNotice">
        Ladataan…<br/><br/>
        <strong>Jos tämä teksti ei katoa</strong>, avaamasi esikatselu ei suorita
        JavaScriptiä (näin käy esim. iPhonen Tiedostot-sovelluksen esikatselussa).<br/>
        👉 Avaa tämä tiedosto tietokoneen selaimessa (Chrome, Edge, Firefox).<br/>
        📱 Puhelimeen tarkoitettu versio on <strong>tyowiki-offline.html</strong> –
        sen sisältö näkyy myös esikatselussa.
      </div>
    </main>
    <aside id="rail" class="rail"></aside>
  </div>
  <div id="toast" class="toast"></div>
  <script>
${offlineTpl}
  </script>
  <script>
${storeLocal}
  </script>
  <script>
${app}
  </script>
</body>
</html>
`;

const out = path.join(__dirname, 'tyowiki-sandbox.html');
fs.writeFileSync(out, html);
console.log('Koottu:', out, '(' + (html.length / 1024).toFixed(0) + ' kt)');
