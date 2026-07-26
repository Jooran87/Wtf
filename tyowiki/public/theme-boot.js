/* Teema ennen renderöintiä, ettei sivu välähdä väärällä värillä.
   Erillinen tiedosto, jotta palvelimen Content-Security-Policy voi
   kieltää inline-skriptit kokonaan. */
(function () {
  try {
    var t = localStorage.getItem('tyowiki_theme');
    if (!t && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) t = 'dark';
    document.documentElement.dataset.theme = t === 'dark' ? 'dark' : 'light';
    // Designin koekytkin (2a) samassa yhteydessä, ettei ulkoasu välähdä.
    if (localStorage.getItem('tyowiki_design') === '2a') {
      document.documentElement.dataset.design = '2a';
    }
  } catch (e) { /* oletusteema kelpaa */ }
})();
