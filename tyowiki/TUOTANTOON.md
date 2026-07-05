# Työohje-wikin vienti tuotantoon

Tämä ohje kertoo, miten wiki viedään maaliin: mitä palvelimelle tehdään,
miten käyttäjät hoidetaan ja miten päivitykset toimivat. Kohdat on merkitty
tekijän mukaan: **[Sinä]**, **[ICT]** tai **[Yhdessä]**.

---

## 1. Kokonaiskuva – mitä maaliin vienti vaatii

| Vaihe | Tekijä | Tila |
|---|---|---|
| Sovellus valmis ja testattu (65 testiä, 0 haavoittuvuutta) | – | ✅ Valmis |
| Sisältö kirjoitettu omalla koneella | Sinä | 🔶 Työn alla |
| Palvelinkone + verkko-osoite | ICT | ⬜ |
| Asennus palvelimelle + datan siirto | Yhdessä | ⬜ |
| Palvelu käynnistymään automaattisesti | ICT | ⬜ |
| Pääsynhallinta / kirjautuminen (luku 5) | Yhdessä | ⬜ |
| Automaattinen varmuuskopiointi | ICT | ⬜ |
| Käyttöönotto: linkki porukalle + lyhyt esittely | Sinä | ⬜ |

---

## 2. Palvelinvaatimukset [ICT]

Wiki on kevyt – melkein mikä tahansa kone riittää:

- **Käyttöjärjestelmä:** Windows Server tai Linux (kumpikin käy)
- **Node.js LTS** (v20 tai v22; myös v24 toimii)
- **Muisti:** sovellus käyttää ~100 Mt; 1 Gt vapaata on runsaasti
- **Levy:** 10 Gt riittää pitkälle (tietokanta on megatavuja; liitteet vievät
  eniten – 50 Mt/tiedosto maksimi)
- **Verkko:** vain sisäverkko. **Ei saa julkaista internetiin ennen kuin
  kirjautuminen (luku 5) on ratkaistu.**
- Ei tietokantapalvelinta, ei Dockeria, ei pilvipalveluita – SQLite on
  tiedosto sovelluksen omassa kansiossa.

---

## 3. Asennus palvelimelle [Yhdessä]

1. **[ICT]** Asenna Node.js LTS (nodejs.org, oletusasetukset)
2. **[ICT]** Pura `tyowiki-asennuspaketti.zip` esim. kansioon
   `/opt/tyowiki` (Linux) tai `D:\tyowiki` (Windows)
3. **[ICT]** Kansiosta: `npm install` (hakee kirjastot, vaatii verkon kerran)
4. **[Sinä]** Siirrä kirjoittamasi sisältö omalta koneelta:
   - Omalla Macilla: `npm run backup` → syntyy `backups/<aikaleima>/`
   - Kopioi kansio palvelimelle (esim. USB/verkkolevy)
   - Palvelimella: `node restore.js <kansio>` (kun palvelu ei ole käynnissä)
5. Koekäynnistys: `npm start` → selaimella `http://palvelimen-ip:3000`
6. Testit palvelimella (vapaaehtoinen mutta suositeltu): `npm test`

**Osoite [ICT]:** pyydä DNS-nimi, esim. `tyowiki.firma.local`, jotta porukka
pääsee osoitteella eikä IP-numerolla. Portin voi vaihtaa ympäristömuuttujalla
`PORT` (esim. 80, jolloin osoitteeksi riittää pelkkä nimi).

---

## 4. Palvelu käynnistymään automaattisesti [ICT]

Palvelun pitää nousta itsestään koneen uudelleenkäynnistyksen jälkeen.

### Linux (systemd)

Tiedosto `/etc/systemd/system/tyowiki.service`:

```ini
[Unit]
Description=Tyoohje-wiki
After=network.target

[Service]
WorkingDirectory=/opt/tyowiki
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=PORT=80
# Suositus: aja omalla palvelutunnuksella, ei roottina
User=tyowiki

[Install]
WantedBy=multi-user.target
```

Käyttöönotto:

```bash
sudo useradd -r -s /usr/sbin/nologin tyowiki
sudo chown -R tyowiki:tyowiki /opt/tyowiki
sudo systemctl enable --now tyowiki
sudo systemctl status tyowiki     # tarkistus
```

(Portti 80 vaatii joko rootin, `setcap`-oikeuden nodelle tai käänteisproxyn –
ICT valitsee talon tavan. Portilla 3000 ei erityisoikeuksia tarvita.)

### Windows

Kaksi tapaa, kumpi ICT:lle tutumpi:
- **Task Scheduler:** tehtävä "At startup", ohjelma `node`, argumentti
  `server.js`, aloituskansio `D:\tyowiki`, "Run whether user is logged on or not"
- **NSSM** (Non-Sucking Service Manager): tekee node-sovelluksesta oikean
  Windows-palvelun parilla komennolla

---

## 5. Käyttäjät ja kirjautuminen [Yhdessä] – TÄRKEIN AVOIN PÄÄTÖS

**Nykytila rehellisesti:** wikissä ei ole käyttäjätilejä. "Nimesi"-kenttä on
vapaa teksti, joka leimautuu muokkauksiin ja vuorolokiin – hyvä jäljitettävyys
arjessa, mutta ei estä ketään verkossa olevaa käyttämästä wikiä. Siksi wiki
saa olla vain sisäverkossa, kunnes jokin alla olevista on tehty.

### Vaihtoehto A – ICT hoitaa pääsyn verkkotasolla (nopein, ei koodimuutoksia)

- Palomuurisääntö: wikiin pääsee vain hälytyskeskuksen verkosta/koneilta
- Haluttaessa lisäksi **käänteisproxy kirjautumisella** wikin eteen
  (IIS + Windows-autentikointi tai nginx + basic auth / AD):
  käyttäjä kirjautuu talon tunnuksilla ennen kuin wiki aukeaa
- **"Käyttäjien luonti"** = ICT lisää henkilön AD-ryhmään tai
  proxyn käyttäjälistaan – ei mitään tehtävää itse wikissä
- Sopii hyvin 20 hengen sisäiseen käyttöön; tämä on suositukseni
  ensimmäiseksi vaiheeksi

### Vaihtoehto B – kirjautuminen rakennetaan wikiin (kun halutaan roolit)

Rakennan tämän kun linjaus on selvä (noin päivän työ):
- Käyttäjätunnus + salasana, roolit: **lukija / muokkaaja / ylläpitäjä**
- Ylläpitäjä luo käyttäjät wikin omalta asetussivulta (ei ICT:tä tarvita)
- Nimi-kenttä korvautuu kirjautuneella käyttäjällä

**Päätettävä ICT:n kanssa:** riittääkö A, vai halutaanko B (tai A + B)?

---

## 6. Varmuuskopiot palvelimella [ICT]

Ajastettu `backup.js` joka yö + kopiot eri levylle:

- **Linux (cron):** `15 3 * * * cd /opt/tyowiki && /usr/bin/node backup.js /varmuuskopiot/tyowiki`
- **Windows (Task Scheduler):** päivittäin klo 03:15, ohjelma `node`,
  argumentit `backup.js D:\varmuuskopiot\tyowiki`, aloituskansio wikin kansio

Skripti pitää automaattisesti 30 uusinta kopiota ja siivoaa vanhat.
Kohdekansio kannattaa ottaa mukaan talon yleiseen varmistuskiertoon.

**Palautusharjoitus kerran:** `node restore.js <kopio>` testikansioon, jotta
tiedetään että palautus osataan ennen kuin sitä oikeasti tarvitaan.

---

## 7. Versiopäivitykset – tarvitaanko niitä?

**Lyhyt vastaus: wiki toimii sellaisenaan ilman pakollisia päivityksiä.**
Ei pilviriippuvuuksia, ei lisenssejä, ei "vanhenevia" osia – se pyörii
vuosia koskematta. Päivityksiä tarvitaan vain kahdesta syystä:

1. **Haluatte uuden ominaisuuden** (esim. kirjautuminen, "lue ja kuittaa")
2. **Tietoturvapäivitys kirjastoihin** – suositus: ICT ajaa `npm audit`
   puolen vuoden välein; jos löytyy korjattavaa, `npm update` + `npm test`

### Päivityksen kulku (sama aina, data säilyy)

```
1. npm run backup                  # varmuuskopio ENNEN päivitystä
2. Pysäytä palvelu
3. Nimeä vanha kansio talteen (tyowiki-vanha), pura uusi paketti tilalle
4. Kopioi data-kansio vanhasta uuteen
5. npm install
6. npm test                        # 65 testiä – kaikki vihreää?
7. Käynnistä palvelu
```

Tietokannan rakennemuutokset ajautuvat automaattisesti käynnistyksessä
(migraatiot) – dataan ei kosketa käsin. Jos jokin menee pieleen, palataan
vanhaan kansioon ja varmuuskopioon.

**Node.js:n päivitys:** LTS-versio noin kerran vuodessa ICT:n normaalissa
huoltoikkunassa; aja `npm install` ja `npm test` sen jälkeen.

---

## 8. Käyttöönoton tarkistuslista

- [ ] [ICT] Palvelin + Node.js + asennus (luku 3)
- [ ] [Sinä] Sisältö siirretty backup/restore-polulla
- [ ] [ICT] Palvelu automaattikäynnistykseen (luku 4)
- [ ] [ICT] DNS-nimi ja palomuurirajaus sisäverkkoon
- [ ] [Yhdessä] Pääsynhallintapäätös ja toteutus (luku 5)
- [ ] [ICT] Yövarmuuskopio ajastettu + palautus testattu (luku 6)
- [ ] [Sinä] Tiedote porukalle: osoite, lyhyt käyttöohje, offline-version
      lataus puhelimiin (📴-nappi)
- [ ] [Sinä] Ensimmäinen "wikin ylläpitäjä" nimetty (sisällön omistajuus)

Kun lista on kuitattu, projekti on maalissa. 🏁
