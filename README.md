# 🌉 Sillanrakentaja

Klassinen sillanrakennuspeli: rakenna palkeista silta rotkon yli ja testaa,
kestääkö se ajoneuvon painon. Jokainen kenttä on edellistä vaativampi —
leveämpi rotko, raskaampi ajoneuvo ja suhteessa tiukempi budjetti.
Viimeisissä kentissä sillan yli jyrää juna vaunuineen.

## Pelaaminen

- **Rakenna**: vedä sormella ruudukkopisteestä toiseen luodaksesi palkin.
  Materiaalit: **Tie** (ajettava kansi), **Palkki** (teräsristikko) ja
  **Vaijeri** (halpa, kestää vain vetoa).
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

## Kehitys

```bash
npm install
npm start        # Expo-kehityspalvelin, avaa Expo Go -sovelluksella
```

Peli on suunniteltu pelattavaksi vaakasuunnassa puhelimella tai tabletilla.
