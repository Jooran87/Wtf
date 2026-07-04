// Lisää esimerkkisisältöä demoa varten. Aja kerran: node seed.js
// Ei tee mitään jos sisältöä on jo olemassa.
const db = require('./db');
const now = () => new Date().toISOString();

const existing = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
if (existing > 0) {
  console.log('Tietokannassa on jo sisältöä – esimerkkidataa ei lisätty.');
  process.exit(0);
}

const insCat = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
const insPage = db.prepare('INSERT INTO pages (category_id, title, content, updated_at, updated_by, views) VALUES (?, ?, ?, ?, ?, ?)');
const insNote = db.prepare('INSERT INTO shift_notes (category_id, author, content, created_at) VALUES (?, ?, ?, ?)');
const insContact = db.prepare('INSERT INTO contacts (label, phone, note, sort_order) VALUES (?, ?, ?, ?)');

// Kategoriat asiakkuuksittain / aihealueittain (Palmia – kiinteistöhoito)
const kipa = insCat.run('Kipa', 1).lastInsertRowid;
const halytyskeskus = insCat.run('Hälytyskeskus', 2).lastInsertRowid;
const hairiot = insCat.run('Häiriötilanteet', 3).lastInsertRowid;
const ism = insCat.run('ISM-ohjeet', 4).lastInsertRowid;

insPage.run(kipa, 'Kipa – kohteen yleisohje', `# Kipa – kohteen yleisohje

## Kohteen perustiedot
- Tarkista kohdekortti ja yhteyshenkilöt järjestelmästä
- Huomioi kohteen aukioloajat ja kulkureitit

## Kiinteistöhoidon tehtävät
1. Kierrokset sovitun ohjelman mukaan
2. Kirjaa havainnot ja poikkeamat järjestelmään
3. Ilmoita kiireelliset viat välittömästi päivystykseen

> Päivitä tämä ohje kohteen todellisilla tiedoilla.`, now(), 'Anna', 34);

insPage.run(halytyskeskus, 'Hälytyksen vastaanotto ja luokittelu', `# Hälytyksen vastaanotto ja luokittelu

## Vastaanotto
1. Kuittaa saapuva hälytys järjestelmästä
2. Tarkista kohteen tiedot ja hälytystyyppi
3. Tarkista mahdolliset toimintaohjeet kohteelle

## Luokittelu
- **A – kiireellinen:** henkilö- tai paloturvallisuus vaarassa → toimi välittömästi
- **B – kiireellinen tekninen:** murtoilmaisu, laiterikko
- **C – ei-kiireellinen:** tekninen ilmoitus, huoltotarve

> Kirjaa kaikki toimenpiteet järjestelmään reaaliaikaisesti.`, now(), 'Anna', 58);

insPage.run(halytyskeskus, 'Paloilmoitinhälytyksen toimintaohje', `# Paloilmoitinhälytys

1. Vastaanota ja kuittaa hälytys
2. Soita kohteen yhteyshenkilölle ja varmista tilanne
3. Jos tulipaloa ei voida sulkea pois, **hälytä 112**
4. Ilmoita vartijalle / kohteen edustajalle
5. Kirjaa tapahtuma ja toimenpiteet lokiin

> Älä koskaan kuittaa paloilmoitusta vääräksi ilman kohteen varmistusta.`, now(), 'Anna', 41);

insPage.run(hairiot, 'Järjestelmäkatkos – varamenettely', `# Järjestelmäkatkos

Jos hälytystenkäsittelyjärjestelmä ei ole käytettävissä:

1. Siirry **manuaaliseen lokiin** (paperilomake / varakone)
2. Ilmoita katkoksesta tekniselle tuelle ja vuoroesihenkilölle
3. Kirjaa kaikki hälytykset käsin aikaleimoineen
4. Kun järjestelmä palautuu, vie manuaaliset kirjaukset järjestelmään`, now(), 'Jukka', 29);

insPage.run(hairiot, 'Sähkökatko kohteessa', `# Sähkökatko kohteessa

1. Varmista laajuus: yksi kohde vai laajempi alue (sähköyhtiön häiriökartta)
2. Tarkista varavoiman/UPS:ien toiminta kriittisissä kohteissa
3. Ilmoita kohteen yhteyshenkilölle ja kirjaa tapahtuma
4. Sähköjen palauduttua varmista järjestelmien normaali tila`, now(), 'Jukka', 18);

insPage.run(ism, 'ISM – toimintakäsikirjan periaatteet', `# ISM-ohjeet

## Tarkoitus
ISM-ohjeet kokoavat toimintajärjestelmän mukaiset menettelyt.

## Periaatteet
- Noudata aina uusinta ohjeversiota – tarkista päivityspäivämäärä
- Poikkeamat kirjataan ja käsitellään sovitun menettelyn mukaan
- Ohjeiden muutosehdotukset esihenkilölle

> Lisää tähän kategoriaan viralliset ISM-dokumentit liitteinä.`, now(), 'Anna', 22);

insNote.run(halytyskeskus, 'Anna', 'Aamuvuoro rauhallinen. Kohteessa 4021 toistuva tekninen ilmoitus – huolto tilattu.', now());
insNote.run(kipa, 'Jukka', 'Kipa: kohteen 5510 ulko-oven lukitus temppuili, huoltopyyntö tehty.', now());
insNote.run(null, 'Anna', 'Yleinen: uudet ISM-ohjeet päivitetty järjestelmään.', now());

insContact.run('Tekninen tuki (24/7)', '040 123 4567', 'järjestelmä- ja laitehäiriöt', 1);
insContact.run('Vuoroesihenkilö', '040 234 5678', 'ympäri vuorokauden', 2);
insContact.run('Kiinteistöpäivystys', '040 345 6789', 'kiinteistöjen viat ja huolto', 3);
insContact.run('Hätäkeskus', '112', 'henkeä uhkaavat tilanteet', 4);

console.log('Esimerkkisisältö lisätty (Palmia – kategoriat asiakkuuksittain).');
