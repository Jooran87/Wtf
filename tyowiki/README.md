# Työohje-wiki

Selainpohjainen, paikallisesti ylläpidettävä wiki työohjeille. Sisältää:

- **Ohjeet ja kategoriat** – Wikipedia-tyylinen sivupalkki ja hakukenttä
- **Vuoroloki** – juokseva aikaleimattu lista vuoron huomioista
- **Tiedotteet** – oma sivu + nosto etusivulle; tärkeät tiedotteet voi 📌-kiinnittää,
  jolloin ne pysyvät listan ja etusivun kärjessä
- **Versiohistoria** – jokainen muokkaus tallentaa edellisen version talteen;
  vanhoja versioita voi katsella ja palauttaa (🕘 Historia -nappi ohjesivulla)
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

## Varmuuskopiointi

Kaikki data on kansiossa `data/`:
- `tyowiki.db` – tietokanta (ohjeet, huomiot, liitteiden tiedot)
- `uploads/` – ladatut tiedostot

Varmuuskopioi koko `data/`-kansio säännöllisesti.

## Jatkokehitys (ehdotuksia)

- **Kirjautuminen** – tällä hetkellä nimi on vapaa tekstikenttä (prototyyppi).
  Tuotantoon suositellaan firman AD/Microsoft-kirjautumista tai vähintään
  käyttäjätunnus/salasana ja luku-/muokkausoikeudet.
- **Word/Excel-esikatselu selaimessa** (esim. OnlyOffice/Collabora) latauslinkkien sijaan.
- **Täystekstihaku** (SQLite FTS5) suuremmalle sisältömäärälle (nykyinen haku on
  `LIKE`-pohjainen; toimii hyvin muutamalle sadalle ohjeelle/liitteelle).
- **OCR** skannatuille PDF:ille ja kuville (esim. Tesseract), jos tarve.

## Tunnetut riippuvuushuomiot

- `exceljs` käyttää transitiivisesti `uuid`-kirjastoa, jossa on *moderate*-tason
  varoitus (puskurin rajatarkistus). Se koskee vain tapausta jossa uuid:lle
  annetaan valmis puskuri – exceljs ei tee niin, joten se ei ole tässä
  hyödynnettävissä. Downgrade olisi rikkova muutos, joten versio on pidetty.

> Ennen tuotantokäyttöä sovi ICT-osaston kanssa palvelimesta, varmuuskopioinnista
> ja kirjautumistavasta.
