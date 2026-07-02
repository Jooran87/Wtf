# Työohje-wiki

Selainpohjainen, paikallisesti ylläpidettävä wiki työohjeille. Sisältää:

- **Kohteet ja työohjeet** – Wikipedia-tyylinen sivupalkki ja hakukenttä
- **Vuoroloki** – juokseva aikaleimattu lista vuoron huomioista
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

## Käyttöönotto

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
- **＋ Kohteet-otsikon vieressä** lisää uuden kohteen (esim. laite tai linja).
- Kohteen sisällä **＋ Uusi ohje** luo työohjeen. Sisältö tukee kevyttä Markdownia
  (`# otsikko`, `**lihavointi**`, `- lista`, `` `koodi` ``, `> lainaus`, linkit).
- **📝 Vuoroloki** – kirjaa huomiot; uusin näkyy ylimpänä, voi kohdistaa kohteeseen.
- Ohjesivulla voi ladata liitteitä (max 50 Mt / tiedosto).
- **Haku** löytää osumat sivujen tekstistä, vuorohuomioista sekä liitetiedostojen
  (PDF, Word, Excel) sisällöstä. Tulossivu näyttää tiedostosta lyhyen otteen ja
  linkin sekä tiedostoon että sen ohjesivuun.

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
- **Versiohistoria** ohjeille (kuka muutti, mitä).
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
