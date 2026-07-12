# 🌉 Sillanrakentaja

Klassinen sillanrakennuspeli: rakenna palkeista silta rotkon yli ja testaa,
kestääkö se ajoneuvon painon. 15 kenttää, joissa vaikeus kasvaa —
leveämmät rotkot, saarelliset ylitykset, pilarien varaan rakennettavat
kanjonit ja yhä raskaammat junat aina 24,8 tonnin tuplaveturijunaan asti.
Kaksi vapaata testikenttää (yksi jänne ja saarellinen kaksoisjänne)
ilman kustannusrajaa, testiajoneuvo valittavissa.

## Pelaaminen

- **Rakenna**: vedä sormella ruudukkopisteestä toiseen luodaksesi palkin.
  Materiaalit: **Tie** (ajettava kansi), **Palkki** (teräsristikko) ja
  **Vaijeri** (halpa, vedossa vahva, menee puristuksessa löysäksi).
- Tien voi vetää yhdellä vedolla vaikka koko rotkon yli — se jakautuu
  metrin paloihin, joiden jokainen liitos on aito nivel. Palkit ja
  vaijerit liittyvät toisiinsa vain päistään; 2 m:n palkki jakautuu
  automaattisesti, jos sen keskikohtaan tulee liitos.
- Maanpinnan pisteet (ruoho, kallion seinämä, pilari) ovat kallioankkureita —
  rakenteen voi kiinnittää niihin, esim. harukset tornin huipusta maahan.
- Valikon **Testikentässä** voi kokeilla rakenteita ilman kustannusrajaa ja
  valita testiajoneuvon henkilöautosta täyteen junaan.
- **Testaa**: ajoneuvo lähtee liikkeelle. Palkkien väri kertoo kuorman:
  vihreä = kevyt, keltainen = koholla, punainen = murtumaisillaan.
- Silta kestää, kun ajoneuvo pääsee kokonaan toiselle puolelle.
  Tähtiä saa sitä enemmän, mitä halvemmalla silta syntyi.

## Fysiikka

Oma voimapohjainen ristikkosimulaatio:

- Palkit ovat aksiaalijousia (voima = jäykkyys × venymä + vaimennus),
  solmut integroidaan Verlet-menetelmällä 600 Hz:n alifysiikka-askelin.
- Palkin massa jakautuu sen päätesolmuille; materiaaleilla on todelliset
  jäykkyys-, massa- ja murtovenymäparametrit.
- Ajoneuvo on jäykkä kappale, jonka pyörät törmäävät kansipalkkeihin ja
  välittävät painon siltarakenteeseen. Palkki murtuu, kun sen venymä
  ylittää materiaalin murtorajan.

## Pelin avaaminen puhelimella (Expo Go)

1. Asenna puhelimeen **Expo Go** -sovellus (App Store / Google Play).
2. Kloonaa tämä repo tietokoneelle ja asenna riippuvuudet:
   ```bash
   git clone https://github.com/Jooran87/Wtf.git
   cd Wtf
   npm install
   ```
3. Käynnistä kehityspalvelin:
   ```bash
   npm start
   ```
4. Varmista, että puhelin ja tietokone ovat **samassa wifi-verkossa**.
5. Skannaa terminaaliin ilmestyvä QR-koodi:
   - **iPhone**: kameralla, avaa linkki Expo Go:hon.
   - **Android**: Expo Go -sovelluksen omalla skannerilla.
6. Käännä puhelin vaakasuuntaan — peli aukeaa hetken latauksen jälkeen.

## Pelin avaaminen selaimella

1. Asenna riippuvuudet kuten yllä (`npm install`).
2. Käynnistä web-versio:
   ```bash
   npm run web
   ```
3. Selain aukeaa automaattisesti osoitteeseen `http://localhost:8081`
   (avaa se itse, jos ei aukea). Palkit piirretään hiirellä vetämällä.

Selaimesta voi myös tehdä staattisen buildin, jonka voi viedä mille
tahansa web-palvelimelle:

```bash
npx expo export --platform web   # tulos dist/-kansioon
npx serve dist                   # kokeile paikallisesti
```

Peli on suunniteltu pelattavaksi vaakasuunnassa (puhelin/tabletti)
tai tavallisessa työpöytäselaimessa.
