# Projekti: Palmia Hälytyskeskus -työohjewiki

Aktiivinen projekti on **`tyowiki/`**-kansiossa (repon juuressa on lisäksi
vanha, erillinen Expo-sääsovellus – älä koske siihen ilman pyyntöä).

**Lue ensin `tyowiki/KEHITYS.md`** – siinä on arkkitehtuuri, pelisäännöt,
tunnetut sudenkuopat ja priorisoitu työjono. Muut dokumentit:
README.md (ominaisuudet), ASENNUS.md (käyttäjän oma kone),
TUOTANTOON.md (palvelimelle vienti, ICT-tehtävät).

Nyrkkisäännöt:
- `npm test` (kansiossa tyowiki/) vihreänä ennen committia – 146 testiä
- Käyttöliittymämuutoksen jälkeen `node sandbox/build-single.js` ja
  committaa syntynyt sandbox/tyowiki-sandbox.html
- Ei uusia npm-riippuvuuksia kevyin perustein; `npm audit` pidetään nollassa
- Kaikki käyttäjäsisältö escapetaan; skeemamuutokset lisäävinä migraatioina
- Käyttäjälle toimitettavat tiedostot: asennuspaketti-zip (ilman
  node_modules/data/backups), sandbox/tyowiki-sandbox.html ja /offline-tuloste
- Kieli: käyttöliittymä, dokumentit ja commit-viestit suomeksi

Käyttäjä (Miska) ei ole ohjelmoija – selitä tekniset asiat selkokielellä ja
toimita kokeiltavat tiedostot + kuvakaappaukset muutosten jälkeen.
