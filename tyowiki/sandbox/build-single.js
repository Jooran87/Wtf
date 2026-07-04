// Kokoaa sandboxin YHDEKSI itsenäiseksi HTML-tiedostoksi, jonka voi
// tuplaklikata auki ilman palvelinta ja ilman muita tiedostoja.
// Lähteet pysyvät yhdessä paikassa (public/styles.css, public/app.js,
// sandbox/store-local.js) – tämä vain niputtaa ne. Aja tyylimuutosten jälkeen:
//   node sandbox/build-single.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8');
const storeLocal = fs.readFileSync(path.join(__dirname, 'store-local.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');

const html = `<!DOCTYPE html>
<html lang="fi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Palmia Hälytyskeskus – Työohjeet (Sandbox)</title>
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
    <div class="user"><label>Nimesi:</label><input id="authorInput" type="text" placeholder="Etunimi" /></div>
  </header>
  <div class="layout">
    <aside id="sidebar" class="sidebar">
      <nav>
        <button class="nav-link" data-nav="home">🏠 Etusivu</button>
        <button class="nav-link" data-nav="announcements">📢 Tiedotteet</button>
        <button class="nav-link" data-nav="shiftlog">📝 Vuoroloki</button>
        <button class="nav-link" data-nav="terms">📖 Termipankki</button>
      </nav>
      <div class="sidebar-section">
        <div class="sidebar-title"><span>Ohjeet</span>
          <button id="addCategoryBtn" class="icon-btn small" title="Lisää kategoria">＋</button></div>
        <ul id="categoryList" class="category-list"></ul>
      </div>
    </aside>
    <main id="content" class="content"></main>
  </div>
  <div id="toast" class="toast"></div>
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
