# Työohje-wikin asennus omalle koneelle

Tämä on wikin **täysversio** – sama, joka myöhemmin asennetaan firman
palvelimelle. Voit kirjoittaa artikkelit valmiiksi omalla koneellasi ja
siirtää ne myöhemmin palvelimelle (ohje alempana).

## 1. Asenna Node.js (kertaalleen)

- Lataa **Node.js LTS** osoitteesta <https://nodejs.org> (vihreä nappi)
- Asenna oletusasetuksilla (Windows: seuraava, seuraava, valmis)

## 2. Pura ja asenna wiki

1. Pura `tyowiki-asennuspaketti.zip` haluamaasi paikkaan,
   esim. `C:\tyowiki` tai Tiedostot-kansioon
2. Avaa komentorivi purettuun kansioon:
   - **Windows:** avaa kansio Resurssienhallinnassa, kirjoita osoitepalkkiin
     `cmd` ja paina Enter
   - **Mac:** Pääte (Terminal) ja `cd polku/tyowiki`
3. Aja komennot:

```
npm install
npm run seed
npm start
```

- `npm install` hakee tarvittavat kirjastot (kestää hetken, tarvitsee nettiä
  vain tämän kerran)
- `npm run seed` lisää esimerkkisisällön (valinnainen – jätä pois jos haluat
  aloittaa tyhjästä)
- `npm start` käynnistää wikin

## 3. Käytä

Avaa selaimessa: **http://localhost:3000**

- Kirjoita nimesi oikeaan yläkulmaan, ja ala lisätä artikkeleita
- Wiki pyörii niin kauan kuin komentorivi-ikkuna on auki;
  sammutus: `Ctrl + C` (tai sulje ikkuna)
- Seuraavilla kerroilla riittää pelkkä `npm start` samassa kansiossa

## Missä tietoni ovat?

Kaikki kirjoittamasi on kansiossa `data/` (tietokanta + liitetiedostot).
Ota kopio komennolla `npm run backup` → syntyy `backups/<aikaleima>/`.

## Siirto firman palvelimelle myöhemmin

1. Omalla koneella: `npm run backup`
2. Vie tuorein `backups/<aikaleima>`-kansio palvelimelle
3. Palvelimella (wiki pysäytettynä): `node restore.js <kansio>` ja `npm start`

Artikkelisi, kategoriat, termit ja liitteet siirtyvät sellaisenaan.

## Ongelmia?

- **"npm ei tunnistettu"** → Node.js ei asentunut / kone käynnistettävä
  uudelleen asennuksen jälkeen
- **Portti varattu** → käynnistä toiseen porttiin: Windows
  `set PORT=3001 && npm start`, Mac/Linux `PORT=3001 npm start`
- **Tarkempi dokumentaatio** → katso `README.md`
