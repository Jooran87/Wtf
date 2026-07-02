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

// Kategoriat (Palmia – Hälytyskeskus)
const halytykset = insCat.run('Hälytysten käsittely', 1).lastInsertRowid;
const jarjestelmat = insCat.run('Järjestelmät ja ohjelmistot', 2).lastInsertRowid;
const hairio = insCat.run('Häiriö- ja poikkeustilanteet', 3).lastInsertRowid;
insCat.run('Yleiset ohjeet', 4);

insPage.run(halytykset, 'Hälytyksen vastaanotto ja luokittelu', `# Hälytyksen vastaanotto ja luokittelu

## Vastaanotto
1. Kuittaa saapuva hälytys järjestelmästä
2. Tarkista kohteen tiedot ja hälytystyyppi
3. Tarkista mahdolliset toimintaohjeet kohteelle

## Luokittelu
- **A – kiireellinen:** henkilö- tai paloturvallisuus vaarassa → toimi välittömästi
- **B – kiireellinen tekninen:** murtoilmaisu, laiterikko
- **C – ei-kiireellinen:** tekninen ilmoitus, huoltotarve

> Kirjaa kaikki toimenpiteet järjestelmään reaaliaikaisesti.`, now(), 'Anna', 58);

insPage.run(halytykset, 'Paloilmoitinhälytyksen toimintaohje', `# Paloilmoitinhälytys

1. Vastaanota ja kuittaa hälytys
2. Soita kohteen yhteyshenkilölle ja varmista tilanne
3. Jos tulipaloa ei voida sulkea pois, **hälytä 112**
4. Ilmoita vartijalle / kohteen edustajalle
5. Kirjaa tapahtuma ja toimenpiteet lokiin

> Älä koskaan kuittaa paloilmoitusta vääräksi ilman kohteen varmistusta.`, now(), 'Anna', 41);

insPage.run(halytykset, 'Rikosilmoitinhälytys – toimintaohje', `# Rikosilmoitinhälytys

1. Vastaanota hälytys ja tarkista kamerakuva (jos saatavilla)
2. Ota yhteys kohteen yhteyshenkilöön varmistaaksesi tilanteen
3. Tarvittaessa ohjaa vartija kohteeseen
4. Vakavassa tilanteessa hälytä poliisi (112)
5. Kirjaa toimenpiteet`, now(), 'Jukka', 33);

insPage.run(jarjestelmat, 'Hälytystenkäsittelyjärjestelmään kirjautuminen', `# Kirjautuminen

1. Avaa työaseman hälytystenkäsittelyohjelmisto
2. Kirjaudu henkilökohtaisilla tunnuksilla
3. Valitse aktiivinen vuoro / työpiste
4. Varmista että hälytyskanavat näkyvät vihreinä

## Ongelmatilanteet
- Jos tunnus ei toimi, ilmoita vuoroesihenkilölle
- Älä käytä toisen henkilön tunnuksia`, now(), 'Anna', 47);

insPage.run(hairio, 'Järjestelmäkatkos – varamenettely', `# Järjestelmäkatkos

Jos hälytystenkäsittelyjärjestelmä ei ole käytettävissä:

1. Siirry **manuaaliseen lokiin** (paperilomake / varakone)
2. Ilmoita katkoksesta tekniselle tuelle ja vuoroesihenkilölle
3. Kirjaa kaikki hälytykset käsin aikaleimoineen
4. Kun järjestelmä palautuu, vie manuaaliset kirjaukset järjestelmään`, now(), 'Jukka', 29);

insNote.run(halytykset, 'Anna', 'Aamuvuoro rauhallinen. Kohteessa 4021 toistuva tekninen ilmoitus – huolto tilattu.', now());
insNote.run(jarjestelmat, 'Jukka', 'Järjestelmässä lyhyt hidastelu klo 13. Tekninen tuki tietoinen, seurataan.', now());
insNote.run(null, 'Anna', 'Yleinen: uudet kohteen 5510 toimintaohjeet päivitetty järjestelmään.', now());

insContact.run('Tekninen tuki (24/7)', '040 123 4567', 'järjestelmä- ja laitehäiriöt', 1);
insContact.run('Vuoroesihenkilö', '040 234 5678', 'ympäri vuorokauden', 2);
insContact.run('Kiinteistöpäivystys', '040 345 6789', 'kiinteistöjen viat ja huolto', 3);
insContact.run('Hätäkeskus', '112', 'henkeä uhkaavat tilanteet', 4);

console.log('Esimerkkisisältö lisätty (Palmia – Hälytyskeskus).');
