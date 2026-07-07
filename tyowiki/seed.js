// Lisää esimerkkisisältöä demoa varten. Aja kerran: node seed.js
// Ei tee mitään jos sisältöä on jo olemassa.
const db = require('./db');
const now = () => new Date().toISOString();

const existing = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
if (existing > 0) {
  console.log('Tietokannassa on jo sisältöä – esimerkkidataa ei lisätty.');
  process.exit(0);
}

const insCat = db.prepare('INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)');
const insSubCat = db.prepare('INSERT INTO categories (name, icon, sort_order, parent_id) VALUES (?, ?, ?, ?)');
const insPage = db.prepare('INSERT INTO pages (category_id, title, content, keywords, updated_at, updated_by, views) VALUES (?, ?, ?, ?, ?, ?, ?)');
const insNote = db.prepare('INSERT INTO shift_notes (category_id, author, content, created_at) VALUES (?, ?, ?, ?)');
const insContact = db.prepare('INSERT INTO contacts (label, phone, note, sort_order) VALUES (?, ?, ?, ?)');
const insAnn = db.prepare('INSERT INTO announcements (title, content, pinned, created_at, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)');

const insTerm = db.prepare('INSERT INTO terms (term, definition, updated_at, updated_by) VALUES (?, ?, ?, ?)');

// Kategoriat asiakkuuksittain / aihealueittain (Palmia – kiinteistöhoito)
const pereh = insCat.run('Perehdytys', '🎓', 0).lastInsertRowid;
const kipa = insCat.run('Kipa', '🏢', 1).lastInsertRowid;
const halytyskeskus = insCat.run('Hälytyskeskus', '🚨', 2).lastInsertRowid;
const hairiot = insCat.run('Häiriötilanteet', '⚡', 3).lastInsertRowid;
const ism = insCat.run('ISM-ohjeet', '📘', 4).lastInsertRowid;

// Esimerkki alakategorioista: Kipan alle asiakkuuksittain.
const kipaAsA = insSubCat.run('Asiakas A – Toimistotalo', '🏢', 1, kipa).lastInsertRowid;
const kipaAsB = insSubCat.run('Asiakas B – Kauppakeskus', '🏬', 2, kipa).lastInsertRowid;

insPage.run(kipaAsA, 'Asiakas A – kohdekohtaiset ohjeet', `# Asiakas A – Toimistotalo

## Kulku ja avaimet
- Pääovi avautuu kulkutunnisteella klo 6–20
- Huoltotila 1. kerroksessa, avain avainkaapista nro 12

## Erityispiirteet
- Paloilmoitinkeskus aulassa, koodi vartijalla
- Yöaikaan liiketunnistimet päällä 2.–5. kerroksessa

> Alakategoriaesimerkki: täydennä asiakkaan omilla tiedoilla.`, 'Kipa, asiakas A, toimistotalo', now(), 'Anna', 8);

insPage.run(kipaAsB, 'Asiakas B – kohdekohtaiset ohjeet', `# Asiakas B – Kauppakeskus

## Aukiolo ja kierrokset
- Kauppakeskus auki klo 8–21, huoltokierros klo 22
- Tavaraliikenne takapihan kautta

## Erityispiirteet
- Useita paloilmoitinryhmiä – tarkista ryhmänumero hälytyksestä
- Yhteyshenkilö: keskuksen huoltopäällikkö

> Alakategoriaesimerkki: täydennä asiakkaan omilla tiedoilla.`, 'Kipa, asiakas B, kauppakeskus', now(), 'Jukka', 6);

insPage.run(pereh, 'Tervetuloa taloon – ensimmäinen työviikko', `# Tervetuloa taloon!

## Päivä 1
- Esittäytyminen ja tilat: työpisteet, tauko- ja sosiaalitilat
- Avaimet, kulkutunnisteet ja pysäköinti
- Tunnukset järjestelmiin (esihenkilö tilaa etukäteen)
- Tämä wiki: etusivu, haku, vuoroloki ja termipankki

## Viikko 1
- Vuorojen käytännöt: vuoronvaihdon rutiinit ja vuorolokin käyttö
- Hälytysten käsittelyn perusteet kokeneen työntekijän vierellä
- Tärkeimmät työohjeet: katso 🔥 Suosituimmat ohjeet etusivulta
- Kohteiden erityispiirteet oman vastuualueen osalta

## Muista
- **Termipankista** löydät talon lyhenteet ja käsitteet
- Kysy rohkeasti – jokainen on ollut uusi joskus

> Pohja: täydennä talon omilla tiedoilla.`, 'perehdytys, uusi työntekijä, ensimmäinen päivä', now(), 'Anna', 12);

insPage.run(pereh, 'Perehdytyksen tarkistuslista', `# Perehdytyksen tarkistuslista

Käy kohdat läpi perehdyttäjän kanssa ja kuittaa valmiit.

## Käytännön asiat
- Avaimet ja kulkutunnisteet luovutettu
- Tunnukset järjestelmiin toimivat
- Työvaatteet ja varusteet
- Pysäköinti ja kulkureitit

## Turvallisuus
- Hätäpoistumistiet ja kokoontumispaikka
- Ensiapuvälineet ja defibrillaattorin sijainti
- Toiminta uhkatilanteessa
- Läheltä piti -ilmoituksen tekeminen

## Työtehtävät
- Hälytyksen vastaanotto ja luokittelu (ohje wikissä)
- Paloilmoitinhälytyksen toimintaohje käyty läpi
- Vuorolokin käyttö
- Varamenettely järjestelmäkatkoksessa

## Hallinto
- Sairauspoissaolokäytäntö
- Vuoronvaihdot ja lomatoiveet
- Palkanmaksun perusteet

> Kuittaa valmis perehdytys esihenkilölle.`, 'perehdytys, tarkistuslista, checklist', now(), 'Anna', 9);

insPage.run(kipa, 'Kipa – kohteen yleisohje', `# Kipa – kohteen yleisohje

## Kohteen perustiedot
- Tarkista kohdekortti ja yhteyshenkilöt järjestelmästä
- Huomioi kohteen aukioloajat ja kulkureitit

## Kiinteistöhoidon tehtävät
1. Kierrokset sovitun ohjelman mukaan
2. Kirjaa havainnot ja poikkeamat järjestelmään
3. Ilmoita kiireelliset viat välittömästi päivystykseen

> Päivitä tämä ohje kohteen todellisilla tiedoilla.`, 'Kipa, kiinteistöhoito, kohdekortti', now(), 'Anna', 34);

insPage.run(halytyskeskus, 'Hälytyksen vastaanotto ja luokittelu', `# Hälytyksen vastaanotto ja luokittelu

## Vastaanotto
1. Kuittaa saapuva hälytys järjestelmästä
2. Tarkista kohteen tiedot ja hälytystyyppi
3. Tarkista mahdolliset toimintaohjeet kohteelle

## Luokittelu
- **A – kiireellinen:** henkilö- tai paloturvallisuus vaarassa → toimi välittömästi
- **B – kiireellinen tekninen:** murtoilmaisu, laiterikko
- **C – ei-kiireellinen:** tekninen ilmoitus, huoltotarve

> Kirjaa kaikki toimenpiteet järjestelmään reaaliaikaisesti.`, 'hälytys, luokittelu, vastaanotto', now(), 'Anna', 58);

insPage.run(halytyskeskus, 'Paloilmoitinhälytyksen toimintaohje', `# Paloilmoitinhälytys

1. Vastaanota ja kuittaa hälytys
2. Soita kohteen yhteyshenkilölle ja varmista tilanne
3. Jos tulipaloa ei voida sulkea pois, **hälytä 112**
4. Ilmoita vartijalle / kohteen edustajalle
5. Kirjaa tapahtuma ja toimenpiteet lokiin

> Älä koskaan kuittaa paloilmoitusta vääräksi ilman kohteen varmistusta.`, 'paloilmoitin, palohälytys, 112', now(), 'Anna', 41);

insPage.run(hairiot, 'Järjestelmäkatkos – varamenettely', `# Järjestelmäkatkos

Jos hälytystenkäsittelyjärjestelmä ei ole käytettävissä:

1. Siirry **manuaaliseen lokiin** (paperilomake / varakone)
2. Ilmoita katkoksesta tekniselle tuelle ja vuoroesihenkilölle
3. Kirjaa kaikki hälytykset käsin aikaleimoineen
4. Kun järjestelmä palautuu, vie manuaaliset kirjaukset järjestelmään`, 'katkos, varamenettely, manuaalinen loki', now(), 'Jukka', 29);

insPage.run(hairiot, 'Sähkökatko kohteessa', `# Sähkökatko kohteessa

1. Varmista laajuus: yksi kohde vai laajempi alue (sähköyhtiön häiriökartta)
2. Tarkista varavoiman/UPS:ien toiminta kriittisissä kohteissa
3. Ilmoita kohteen yhteyshenkilölle ja kirjaa tapahtuma
4. Sähköjen palauduttua varmista järjestelmien normaali tila`, 'sähkökatko, varavoima, UPS', now(), 'Jukka', 18);

insPage.run(hairiot, 'Vikailmoituksen tekeminen IT-tukeen', `# Vikailmoitus IT-tukeen

## Ennen ilmoitusta
- Kokeile ensin: käynnistä ohjelma/laite uudelleen
- Katso onko tiedotteissa tietoa tunnetusta häiriöstä

## Ilmoituksen tekeminen
1. Soita **tekniseen tukeen 040 123 4567** (24/7)
2. Kerro: nimesi, työpiste, mikä laite/järjestelmä, mitä tapahtui ja milloin
3. Kerro näkyykö virheilmoitus – lue koodi sellaisenaan
4. Kirjaa saamasi tiketin numero vuorolokiin

## Kiireellisyys
- **Kriittinen** (hälytysjärjestelmä alhaalla): soita AINA, älä jätä vain viestiä
- Muut viat: voi ilmoittaa myös sähköpostilla

> Nettikatkoksen aikana: käytä puhelinta ja kirjaa tapahtumat käsin – vie ne järjestelmään kun yhteys palaa.`, 'vikailmoitus, IT-tuki, tiketti, häiriö', now(), 'Jukka', 25);

insPage.run(ism, 'ISM – toimintakäsikirjan periaatteet', `# ISM-ohjeet

## Tarkoitus
ISM-ohjeet kokoavat toimintajärjestelmän mukaiset menettelyt.

## Periaatteet
- Noudata aina uusinta ohjeversiota – tarkista päivityspäivämäärä
- Poikkeamat kirjataan ja käsitellään sovitun menettelyn mukaan
- Ohjeiden muutosehdotukset esihenkilölle

> Lisää tähän kategoriaan viralliset ISM-dokumentit liitteinä.`, 'ISM, toimintajärjestelmä, laatu, käsikirja', now(), 'Anna', 22);

insNote.run(halytyskeskus, 'Anna', 'Aamuvuoro rauhallinen. Kohteessa 4021 toistuva tekninen ilmoitus – huolto tilattu.', now());
insNote.run(kipa, 'Jukka', 'Kipa: kohteen 5510 ulko-oven lukitus temppuili, huoltopyyntö tehty.', now());
insNote.run(null, 'Anna', 'Yleinen: uudet ISM-ohjeet päivitetty järjestelmään.', now());

insContact.run('Tekninen tuki (24/7)', '040 123 4567', 'järjestelmä- ja laitehäiriöt', 1);
insContact.run('Vuoroesihenkilö', '040 234 5678', 'ympäri vuorokauden', 2);
insContact.run('Kiinteistöpäivystys', '040 345 6789', 'kiinteistöjen viat ja huolto', 3);
insContact.run('Hätäkeskus', '112', 'henkeä uhkaavat tilanteet', 4);

// Esimerkkilinkit
const insLink = db.prepare('INSERT INTO links (label, url, note, sort_order) VALUES (?, ?, ?, ?)');
insLink.run('Sähköyhtiön häiriökartta', 'https://www.example-sahko.fi/hairiokartta', 'sähkökatkojen laajuus ja arvioitu kesto', 1);
insLink.run('Palmia intranet', 'https://intra.palmia.fi', 'sisäiset tiedotteet ja lomakkeet', 2);
insLink.run('Työvuorojärjestelmä', 'https://vuorot.example.fi', 'vuorolistat ja vaihtopyynnöt', 3);
insLink.run('Ilmatieteen laitos', 'https://www.ilmatieteenlaitos.fi', 'säävaroitukset ja ennusteet', 4);

// Termipankin esimerkkitermit
insTerm.run('Kipa', 'Asiakkuus, jolle tuotamme kiinteistöhoitoa. Kohdeohjeet omassa kategoriassaan.', now(), 'Anna');
insTerm.run('ISM', 'Toimintajärjestelmän mukaiset ohjeet ja menettelyt (toimintakäsikirja).', now(), 'Anna');
insTerm.run('Kohdekortti', 'Kohteen perustiedot: osoite, yhteyshenkilöt, hälytysjärjestelmä, erityispiirteet.', now(), 'Anna');
insTerm.run('A-luokan hälytys', 'Kiireellinen hälytys: henkilö- tai paloturvallisuus vaarassa – toimi välittömästi.', now(), 'Anna');
insTerm.run('Varamenettely', 'Toimintatapa kun normaali järjestelmä ei ole käytettävissä (esim. manuaalinen loki).', now(), 'Anna');
insTerm.run('UPS', 'Akkuvarmennus, joka pitää kriittiset laitteet käynnissä lyhyen sähkökatkon yli.', now(), 'Anna');
insTerm.run('Vuoroloki', 'Wikin osio, johon kirjataan vuoron aikaiset huomiot ja poikkeamat.', now(), 'Anna');

// Ajantasaisuusvahvistuksen esimerkit: yksi tuore, yksi vanhentunut
db.prepare('UPDATE pages SET verified_at = ?, verified_by = ? WHERE title = ?')
  .run(now(), 'Anna', 'Hälytyksen vastaanotto ja luokittelu');
db.prepare('UPDATE pages SET verified_at = ?, verified_by = ? WHERE title = ?')
  .run(new Date(Date.now() - 210 * 86400000).toISOString(), 'Jukka', 'ISM – toimintakäsikirjan periaatteet');

insAnn.run('Uusi työohje-wiki käytössä', 'Tervetuloa! Ohjeet, tiedotteet ja vuoroloki löytyvät jatkossa täältä. Palaute esihenkilölle.', 1, now(), 'Anna', now());
insAnn.run('Kohteen 4021 huoltokatko 12.7.', 'Paloilmoitinjärjestelmä huollossa klo 8–14. Hälytykset kohteesta ohjautuvat varajärjestelmään.', 0, now(), 'Jukka', now());

console.log('Esimerkkisisältö lisätty (Palmia – kategoriat asiakkuuksittain).');
