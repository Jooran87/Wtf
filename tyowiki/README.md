# Työohje-wiki

Selainpohjainen, paikallisesti ylläpidettävä wiki työohjeille. Sisältää:

- **Ohjeet ja kategoriat** – Wikipedia-tyylinen sivupalkki ja hakukenttä
- **Vuoroloki** – juokseva aikaleimattu lista vuoron huomioista
- **Tiedotteet** – oma sivu + nosto etusivulle; tärkeät tiedotteet voi 📌-kiinnittää,
  jolloin ne pysyvät listan ja etusivun kärjessä
- **Versiohistoria** – jokainen muokkaus tallentaa edellisen version talteen;
  vanhoja versioita voi katsella ja palauttaa (🕘 Historia -nappi ohjesivulla)
- **Termipankki** – talon termit ja lyhenteet aakkosittain; termit löytyvät myös haulla
- **Linkit** – usein tarvitut osoitteet (järjestelmät, häiriökartat, intranet);
  mukana haussa ja offline-versiossa
- **Perehdytys** – oma kategoria pohja-artikkeleineen (ensimmäinen viikko, tarkistuslista)
- **Vahvistettu ajantasaiseksi** – ohjeen voi kuitata tarkistetuksi; merkki näyttää
  vihreää (vahvistettu ≤ 180 pv), punaista (vahvistus vanhentunut) tai harmaata
  (ei vahvistettu). Vahvistus vaatii nimen yläkulman kenttään.
- **Tiedostoliitteet** – PDF, kuvat, Word, Excel (PDF ja kuvat näkyvät suoraan selaimessa, muut latautuvat)
- **Haku** ohjeista, huomioista **ja tiedostojen sisällöstä** (PDF, Word, Excel) – näyttää otteen osumakohdasta

Suunniteltu pienelle käyttäjämäärälle (n. 20) ja pyörii firman omalla palvelimella.
Kaikki data pysyy talon sisällä – ei pilveä.

## Tekniikka

- **Node.js + Express** – palvelin ja REST-rajapinta
- **SQLite** (better-sqlite3) – yksi tiedosto `data/tyowiki.db`, helppo varmuuskopioida
- **Vanilla JS -käyttöliittymä** – ei erillistä build-vaihetta, tarjoillaan `public/`-kansiosta
- **Tekstinlouhinta** – `pdf-parse` (PDF), `mammoth` + `word-extractor` (Word), `exceljs` (Excel):
  ladatusta tiedostosta louhitaan teksti latausvaiheessa hakua varten

## 📴 Offline-versio puhelimeen

Sivupalkin **📴 Offline-versio** -nappi lataa koko wikin (ohjeet, termipankki,
tärkeät numerot soittolinkkeineen, tiedotteet) yhtenä HTML-tiedostona
(`tyowiki-offline.html`). Tiedosto toimii puhelimessa **täysin ilman verkkoa** –
esim. nettikatkoksen aikana voi omalla puhelimella hakea ohjeen vikailmoituksen
tekemiseen ja soittaa IT-tukeen suoraan numerolinkistä.

- Palvelinversiossa myös suora osoite: `/offline` (katselu) ja
  `/offline?download=1` (lataus tiedostona)
- Offline-tiedostossa on haku ja avattavat ohjeet; se ei käytä selaimen
  tallennustilaa, joten se aukeaa myös tiukoissa selaimissa (Safari, esikatselut)
- Liitetiedostot eivät sisälly offline-versioon
- Suositus: lataa tuore kopio esim. viikoittain tai isojen ohjepäivitysten jälkeen

## Kaksi versiota: palvelin vs. sandbox

| | **Palvelinversio** (`public/` + `server.js`) | **Sandbox** (`sandbox/`) |
|---|---|---|
| Tarkoitus | Oikea, yhteinen käyttö | Demo & ulkoasun hionta |
| Vaatii | Node.js + `npm install` | Pelkkä selain, ei asennusta |
| Data | Yhteinen SQLite-tietokanta palvelimella | Vain omassa selaimessa (localStorage + IndexedDB) |
| Käyttäjät | Kaikki näkevät saman sisällön | Jokaisella oma erillinen kopio |
| Tiedostojen sisältöhaku | PDF, Word, Excel (louhinta palvelimella) | Vain seed-esimerkki + tekstitiedostot |

**Ulkoasu on jaettu:** molemmat käyttävät samaa `public/styles.css`- ja
`public/app.js`-tiedostoa. Vain datakerros vaihtuu (`public/store-api.js` vs.
`sandbox/store-local.js`). Kun hiot ulkoasua, muokkaat vain yhtä paikkaa ja
molemmat versiot päivittyvät.

### Sandboxin avaaminen

**Helpoin tapa (ei asennusta):** avaa `sandbox/tyowiki-sandbox.html` selaimessa
(tuplaklikkaus). Se on yksi itsenäinen tiedosto – ei vaadi palvelinta eikä muita
tiedostoja vierellä. Voit lähettää sen vaikka sähköpostilla ja avata missä vain.

**Vaihtoehto:** avaa `sandbox/index.html` (vaatii että koko `tyowiki`-kansio on
kasassa, koska se viittaa `../public/`-tiedostoihin). Jos selaimesi estää jotain
file://-tilassa, tarjoile kansio paikallisen palvelimen kautta:

```bash
cd tyowiki
npx serve .        # tai: python3 -m http.server 8080
# avaa selaimessa .../sandbox/index.html
```

Sandbox on esitäytetty esimerkkisisällöllä. Data tallentuu vain kyseiseen
selaimeen; tyhjennä sivuston tallennustila (localStorage + IndexedDB)
nollataksesi sen esimerkkidataan.

> **Huom:** `tyowiki-sandbox.html` on koottu tiedosto. Jos muokkaat ulkoasua
> (`public/styles.css`) tai logiikkaa, päivitä se komennolla
> `node sandbox/build-single.js`.

## Käyttöönotto (palvelinversio)

```bash
cd tyowiki
npm install
node seed.js      # (valinnainen) lisää esimerkkisisältöä
npm start         # käynnistää palvelimen
```

Avaa selaimessa: <http://localhost:3000>

Portin voi vaihtaa: `PORT=8080 npm start`

## Käyttö

- **Nimesi** oikeassa yläkulmassa tallentuu selaimeen ja liittyy tekemiisi muutoksiin ja huomioihin.
- **＋ Ohjeet-otsikon vieressä** lisää uuden kategorian (esim. aihealue).
- Kategorian sisällä **＋ Uusi ohje** luo työohjeen. Sisältö tukee kevyttä Markdownia
  (`# otsikko`, `**lihavointi**`, `- lista`, `` `koodi` ``, `> lainaus`, linkit).
- **📝 Vuoroloki** – kirjaa huomiot; uusin näkyy ylimpänä, voi kohdistaa kohteeseen.
- Ohjesivulla voi ladata liitteitä (max 50 Mt / tiedosto).
- **Haku** löytää osumat sivujen otsikosta, tekstistä ja **avainsanoista**,
  vuorohuomioista sekä liitetiedostojen (PDF, Word, Excel) sisällöstä.
  Tulossivu näyttää otteen osumakohdasta korostettuna ja linkit suoraan
  artikkeliin/tiedostoon.
- **Avainsanat:** artikkelille voi antaa muokkausnäkymässä pilkuin erotellut
  avainsanat (esim. "ISM, laatu"). Haku löytää artikkelin niillä, vaikka sanaa
  ei olisi leipätekstissä. Avainsanat näkyvät artikkelisivulla klikattavina
  merkkeinä – klikkaus hakee samalla sanalla.

### Haku tiedostojen sisällöstä – huomiot

- Teksti louhitaan **latausvaiheessa**. Jos päivität tämän toiminnon vanhaan
  asennukseen, jossa on jo tiedostoja, indeksoi ne kerran: `node reindex.js`.
- **Kuvista ei louhita tekstiä** (ei OCR:ää) – kuvat ovat silti ladattavissa ja
  näkyvät selaimessa, mutta niiden sisältöä ei voi hakea.
- **Vanhoista `.xls`-tiedostoista** (Excel 97–2003) ei louhita tekstiä; uudet
  `.xlsx`-tiedostot indeksoidaan. Tiedosto on silti ladattavissa.
- Skannatut PDF:t (kuvana) eivät sisällä tekstiä, joten niistä ei löydy osumia
  ilman OCR:ää.

## Testit

```bash
npm test
```

Ajaa kaksi sarjaa:
- **Rajapintatestit** (`tests/api.test.js`) – käynnistää palvelimen väliaikaisella
  datahakemistolla (ympäristömuuttuja `TYOWIKI_DATA_DIR`), joten oikea kanta ei
  koskaan muutu. Kattaa CRUD:t, validoinnit, XSS-syötteet, versiokaton,
  liitteiden siivouksen, haun kaikki osiot ja offline-koonnin.
- **Selaintestit** (`tests/ui.test.js`) – kokoaa sandboxin ja ajaa sen oikeassa
  Chromiumissa (käynnistys, XSS-renderöinti, virhetilat, teema, esikatselu).
  Ohitetaan automaattisesti jos Chromiumia ei ole; polun voi antaa
  muuttujalla `CHROMIUM_PATH`.

Aja testit aina muutosten jälkeen ennen tuotantoon vientiä.

## Varmuuskopiointi

Kaikki data on kansiossa `data/` (`tyowiki.db` + `uploads/`).

```bash
npm run backup            # kopio kansioon ./backups/<aikaleima>/
node backup.js /polku     # tai omaan kohteeseen (esim. verkkolevy)
```

- Turvallinen ajaa **palvelimen ollessa käynnissä** (SQLiten `VACUUM INTO`
  tuottaa eheän kopion).
- Mukana tietokanta, liitetiedostot ja manifest.json (sisällön yhteenveto).
- Vanhat kopiot siivotaan automaattisesti: oletuksena säilytetään 30 uusinta
  (`TYOWIKI_BACKUP_KEEP`-ympäristömuuttujalla säädettävissä).

**Palautus** (pysäytä palvelin ensin):

```bash
node restore.js backups/2026-07-04_120000
```

Nykyinen data siirtyy turvaan kansioon `data_ennen_palautusta_<aikaleima>` –
mitään ei tuhota.

**Ajastus (ICT):**

- Linux (cron, joka yö klo 03:15):
  `15 3 * * * cd /polku/tyowiki && /usr/bin/node backup.js /varmuuskopiot/tyowiki`
- Windows (Task Scheduler): ajastettu tehtävä, ohjelma `node`,
  argumentit `backup.js D:\varmuuskopiot\tyowiki`, aloituskansio wikin kansio.
- Suositus: kohteeksi eri levy/verkkolevy kuin missä wiki pyörii, ja
  varmuuskopiokansio mukaan talon yleiseen nauhakiertoon/pilvikopioon.

## Jatkokehitys (ehdotuksia)

- **Kirjautuminen** – tällä hetkellä nimi on vapaa tekstikenttä (prototyyppi).
  Tuotantoon suositellaan firman AD/Microsoft-kirjautumista tai vähintään
  käyttäjätunnus/salasana ja luku-/muokkausoikeudet.
- **Word/Excel-esikatselu selaimessa** (esim. OnlyOffice/Collabora) latauslinkkien sijaan.
- **Täystekstihaku** (SQLite FTS5) suuremmalle sisältömäärälle (nykyinen haku on
  `LIKE`-pohjainen; toimii hyvin muutamalle sadalle ohjeelle/liitteelle).
- **OCR** skannatuille PDF:ille ja kuville (esim. Tesseract), jos tarve.

## Tietoturva

- **`npm audit`: 0 haavoittuvuutta** (uuid pakotettu korjattuun versioon
  package.jsonin `overrides`-kentällä)
- **HTTP-turvaotsakkeet**: Content-Security-Policy (ei inline-skriptejä
  sovelluksessa), X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
  Permissions-Policy; `X-Powered-By` piilotettu
- **Syötteet**: kaikki käyttäjäsyöte escapetaan renderöinnissä (XSS-testattu),
  SQL parametrisoitu, kenttäkohtaiset pituusrajat palvelimella,
  tiedostotyyppien sallittulista ja 50 Mt koko/tiedosto -raja latauksissa
- **Kirjautuminen ja roolit**: pakollinen kirjautuminen (ylläpitäjä /
  muokkaaja / lukija), salasanat scrypt-tiivisteinä, istunnot
  httpOnly-evästeellä, kirjautumisyritysten rajoitus. Ensikäynnistys luo
  pääkäyttäjän; muut tunnukset luodaan 👥 Käyttäjät -sivulta. Muokkausten
  tekijä tulee aina istunnosta.
- Suositus tuotantoon: palomuurirajaus sisäverkkoon ja HTTPS
  käänteisproxyllä, jos käyttö laajenee verkon yli.

> Ennen tuotantokäyttöä sovi ICT-osaston kanssa palvelimesta, varmuuskopioinnista
> ja kirjautumistavasta.
