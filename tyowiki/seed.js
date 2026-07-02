// Lisää esimerkkisisältöä demoa varten. Aja kerran: node seed.js
// Ei tee mitään jos kohteita on jo olemassa.
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

const linja1 = insCat.run('Tuotantolinja 1', 1).lastInsertRowid;
const linja2 = insCat.run('Pakkaamo', 2).lastInsertRowid;
insCat.run('Yleiset ohjeet', 3);

insPage.run(linja1, 'Linjan käynnistys aamuvuorossa', `# Linjan käynnistys

## Ennen käynnistystä
- Tarkista että hätäseis-painikkeet ovat vapautettuina
- Varmista suojaovien lukitus
- Tarkista voiteluöljyn taso

## Käynnistysjärjestys
1. Kytke pääkytkin päälle
2. Odota että ohjausjärjestelmä latautuu (n. 2 min)
3. Käynnistä kuljetin **vihreästä** painikkeesta
4. Nosta nopeus vähitellen tavoitearvoon

> Huom! Jos merkkivalo vilkkuu punaisena, katso vikaohje ennen jatkamista.`, now(), 'Matti', 42);

insPage.run(linja1, 'Häiriötilanteen kuittaus', `# Häiriön kuittaus

- Paina **RESET** ohjauspaneelista
- Tarkista näytöltä vikakoodi
- Yleisimmät koodit:
  - E01 = paperitukos
  - E02 = ylikuumeneminen
  - E05 = anturihäiriö`, now(), 'Matti', 27);

insPage.run(linja2, 'Pakkauskoneen puhdistus', `# Pakkauskoneen puhdistus (vuoron lopussa)

1. Pysäytä kone ja katkaise virta
2. Poista pakkausmateriaalin jäänteet
3. Pyyhi pinnat elintarvikehyväksytyllä puhdistusaineella
4. Kirjaa puhdistus lokiin`, now(), 'Liisa', 15);

insNote.run(linja1, 'Matti', 'Linja 1 pyöri hyvin koko aamuvuoron. Öljynpaine hieman koholla iltapäivällä, seurataan.', now());
insNote.run(linja2, 'Liisa', 'Pakkauskone jumitti kahdesti klo 14 aikaan. Puhdistettu ja kuitattu. Huoltopyyntö tehty.', now());
insNote.run(null, 'Liisa', 'Yleinen: varaosavarastosta loppui teippirulla. Tilaus lähtenyt.', now());

insContact.run('IT-tuki', '040 123 4567', 'ma–pe 8–16, kiireet: alue 200', 1);
insContact.run('Vuoroesihenkilö', '040 234 5678', 'ympäri vuorokauden', 2);
insContact.run('Kunnossapito / päivystys', '040 345 6789', 'häiriöt ja viat', 3);
insContact.run('Työterveys', '030 555 0100', 'ajanvaraus', 4);

console.log('Esimerkkisisältö lisätty.');
