# Työohje-wiki

Selainpohjainen, paikallisesti ylläpidettävä wiki työohjeille. Sisältää:

- **Kohteet ja työohjeet** – Wikipedia-tyylinen sivupalkki ja hakukenttä
- **Vuoroloki** – juokseva aikaleimattu lista vuoron huomioista
- **Tiedostoliitteet** – PDF, kuvat, Word, Excel (PDF ja kuvat näkyvät suoraan selaimessa, muut latautuvat)
- **Haku** ohjeista ja huomioista

Suunniteltu pienelle käyttäjämäärälle (n. 20) ja pyörii firman omalla palvelimella.
Kaikki data pysyy talon sisällä – ei pilveä.

## Tekniikka

- **Node.js + Express** – palvelin ja REST-rajapinta
- **SQLite** (better-sqlite3) – yksi tiedosto `data/tyowiki.db`, helppo varmuuskopioida
- **Vanilla JS -käyttöliittymä** – ei erillistä build-vaihetta, tarjoillaan `public/`-kansiosta

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
- **Täystekstihaku** (SQLite FTS5) suuremmalle sisältömäärälle.

> Ennen tuotantokäyttöä sovi ICT-osaston kanssa palvelimesta, varmuuskopioinnista
> ja kirjautumistavasta.
