# Kehittäjän käsikirja (handoff)

Tämä dokumentti siirtää projektin hiljaisen tiedon seuraavalle kehittäjälle
tai tekoälyavustajalle. Lue tämä ennen muutosten tekemistä.

## Arkkitehtuuri yhdellä silmäyksellä

```
server.js            Express + REST + kirjautuminen + turvaotsakkeet
db.js                SQLite (better-sqlite3) + skeema + MIGRAATIOT
extract.js           Liitteiden tekstinlouhinta hakua varten (pdf/docx/doc/xlsx)
public/
  index.html         Palvelinversion runko
  app.js             ★ JAETTU käyttöliittymälogiikka (myös sandbox käyttää tätä)
  styles.css         ★ JAETTU ulkoasu (teemat, liquid glass, tulostus)
  store-api.js       Datakerros palvelimelle (REST + auth)
  offline-template.js Offline-HTML:n generaattori (toimii Nodessa JA selaimessa)
  theme-boot.js      Teema ennen renderöintiä (erillinen tiedosto CSP:n takia)
sandbox/
  store-local.js     Datakerros sandboxille (localStorage + IndexedDB, EI authia)
  build-single.js    Kokoaa yhden tiedoston sandboxin (tyowiki-sandbox.html)
tests/               npm test: api (auth+CRUD+turva), backup, ui (Chromium)
backup.js/restore.js Varmuuskopiointi (VACUUM INTO) ja palautus
seed.js              Esimerkkisisältö (vain tyhjään kantaan)
```

**Tärkein sopimus:** `app.js` puhuu vain `Store`-rajapinnalle. Palvelinversio
ja sandbox eroavat AINOASTAAN siinä, kumpi store ladataan. Uusi ominaisuus =
toteuta molempiin storeihin TAI sandboxiin stub (esim. `Store.auth = null`,
jolloin app.js ohittaa kirjautumisen).

## Pelisäännöt (opittu kantapään kautta)

1. **Ei uusia riippuvuuksia kevyin perustein.** Auth tehtiin Node cryptolla,
   evästeparseri käsin. `npm audit` on 0 – pidä se nollassa
   (uuid on pakotettu overrides-kentällä package.jsonissa).
2. **Kaikki käyttäjäsisältö escapetaan** (`esc()` app.js:ssä) ennen innerHTML:ää.
   Markdown renderöidään escapetusta tekstistä. XSS-testit vartioivat tätä.
3. **Skeemamuutokset vain lisäävinä migraatioina db.js:ään**
   (PRAGMA table_info -tarkistus + ALTER TABLE). Ajautuvat automaattisesti
   käynnistyksessä – vanha data ei koskaan vaadi käsityötä.
4. **Sandboxin datamuutokset:** lisää kenttä `migrateExisting()`-funktioon
   (säilyttää käyttäjän datan) TAI nosta `LS_KEY`-versiota (nollaa demon
   seed-dataan – tee näin vain kun uusi seed-sisältö on demolle tärkeä).
5. **Ulkoasu-/logiikkamuutoksen jälkeen aina** `node sandbox/build-single.js`
   ja committaa syntynyt tyowiki-sandbox.html.
6. **`npm test` vihreänä (96 testiä) ennen jokaista committia.** Testit ajavat
   palvelimen eristetyssä TYOWIKI_DATA_DIR-hakemistossa – eivät koske oikeaa dataa.
7. **Tekijätieto tulee AINA istunnosta** (`req.user.name`) – älä koskaan luota
   selaimen author-kenttään.
8. **CSP kieltää inline-skriptit** palvelinversiossa – uusi JS vain erillisiin
   tiedostoihin (vrt. theme-boot.js). /offline-reitillä on oma löysempi CSP,
   koska se on itsenäinen dokumentti.
9. Asennuspaketti käyttäjälle: zip tyowiki-kansiosta ILMAN node_modules/data/
   backups -kansioita.

## Sudenkuopat (älä astu uudelleen)

- **Safari + file://** estää IndexedDB:n → sandboxin blob-toiminnot on
  kääritty try/catchiin; älä tee IndexedDB:stä kriittistä polkua.
- **iOS:n tiedostoesikatselu (Quick Look) ei suorita JavaScriptiä** →
  sandboxissa on staattinen jsNotice-viesti; puhelinkäyttöön on offline-HTML,
  jonka sisältö on esirenderöityä.
- **`</script>` template-literalin sisällä** rikkoo single-file-buildin →
  offline-templatessa se on kirjoitettu muodossa `<\/script>`.
- **Node poolaa pienet tiedostopuskurit** (byteOffset ≠ 0) → pdf-parse vaatii
  kopion omaan puskuriin (tehty extract.js:ssä). Ilman tätä pienet PDF:t
  eivät indeksoidu.
- **better-sqlite3 pitää olla ^12**, jotta Node 24:lle on valmis binääri
  (v11 yritti kääntää lähteistä ja kaatui käyttäjän Macilla).
- Kehitysympäristöhuomio: `pkill` bash-ketjussa palauttaa 144 ja katkaisee
  `&&`-ketjun – aja siivous erillisenä komentona.

## Alakategoriat (yksi taso)

- `categories.parent_id` (NULL = pääkategoria). **Yksi taso:** alakategorialle
  ei voi luoda omaa alakategoriaa – validointi `validateParent()`:ssa (server.js)
  ja vastaava sandboxissa. Yläkategorian poisto vie alakategoriat ja kaikkien
  sivut/liitteet mukanaan.
- Järjestys (`sort_order`) lasketaan **sisarusten kesken** (sama `parent_id`);
  reorder-napit siirtävät vain saman tason sisällä (app.js catmove-käsittelijä).
- Client rakentaa puun litteästä listasta: `topCategories()` / `subCategories()`.

## Roolit ja oikeudet (server.js:n portti-middleware)

- `admin`: kaikki + /api/users
- `editor`: kaikki paitsi /api/users
- `viewer`: vain GET (käyttöliittymä piilottaa napit CSS:llä
  `:root[data-vrole="viewer"]`, mutta palvelin on ainoa oikea vartija)
- Avoimet reitit: /api/auth-status, /api/login, /api/setup (vain kun 0
  käyttäjää), /api/logout, staattiset tiedostot

## Työjono (priorisoitu, ei aloitettu)

1. **Lue ja kuittaa** tiedotteille – kuka on nähnyt tärkeän tiedotteen
   (taulu announcement_reads, kuittausnappi, lukijalista ylläpitäjälle)
2. **Vanhentuneiden vahvistusten kooste** – lista ohjeista joiden
   ✔-vahvistus puuttuu tai on yli 180 pv (data on jo kannassa)
3. **Vuorolokin arkisto** – päivämääräsuodatus + sivutus kun huomioita on satoja
4. **Liitelouhinta taustalle** – iso PDF viivyttää nyt latausvastausta
5. **HTTPS-ohje ICT:lle** käänteisproxyllä (evästeet + Secure-lippu)
6. Myöhemmin jos tarve: FTS5-haku (nyk. LIKE riittää satoihin artikkeleihin,
   mitattu 3–4 ms @ 309 sivua), OCR skannatuille PDF:ille

## Komennot

```bash
npm start                      # palvelin (PORT=xxxx vaihtaa portin)
npm test                       # 96 testiä eristetyssä ympäristössä
npm run backup                 # varmuuskopio backups/-kansioon
node sandbox/build-single.js   # kokoa jaettava sandbox-tiedosto
node reindex.js                # liitteiden hakuindeksin uudelleenajo
```

Dokumentit: README.md (ominaisuudet ja käyttö) · ASENNUS.md (oma kone) ·
TUOTANTOON.md (palvelin, ICT-tehtävät) · tämä tiedosto (kehittäjät).
