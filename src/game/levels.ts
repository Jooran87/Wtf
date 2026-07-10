import { Box, LevelDef, VehicleId } from './types';

const CLIFF_W = 3;
const DECK_Y = 4;
const BUILD_BOTTOM = 7;
const WATER_Y = 7.4;
const FAIL_Y = 7.9;
const WORLD_H = 8.4;

interface LevelParams {
  name: string;
  gap: number;
  budget: number;
  vehicle: VehicleId;
  /** Keskipilari (vain leveimmät kentät) */
  pillar?: boolean;
  hint?: string;
}

function makeLevel(id: number, p: LevelParams): LevelDef {
  const leftEdge = CLIFF_W;
  const rightEdge = CLIFF_W + p.gap;
  const worldW = p.gap + CLIFF_W * 2;

  const terrain: Box[] = [
    { minX: -60, maxX: leftEdge, minY: DECK_Y, maxY: 99 },
    { minX: rightEdge, maxX: worldW + 60, minY: DECK_Y, maxY: 99 },
  ];
  const anchors = [
    { x: leftEdge, y: DECK_Y },
    { x: rightEdge, y: DECK_Y },
    { x: leftEdge, y: DECK_Y + 2 },
    { x: rightEdge, y: DECK_Y + 2 },
  ];

  if (p.pillar) {
    const mid = Math.round(leftEdge + p.gap / 2);
    terrain.push({ minX: mid - 0.55, maxX: mid + 0.55, minY: DECK_Y + 2, maxY: 99 });
    anchors.push({ x: mid, y: DECK_Y + 2 });
  }

  return {
    id,
    name: p.name,
    gap: p.gap,
    budget: p.budget,
    vehicle: p.vehicle,
    worldW,
    worldH: WORLD_H,
    deckY: DECK_Y,
    leftEdge,
    rightEdge,
    terrain,
    anchors,
    failY: FAIL_Y,
    waterY: WATER_Y,
    hint: p.hint,
  };
}

/** Testikenttä: vapaa rakentelu ilman kustannusrajaa, ajoneuvon saa valita */
export const SANDBOX: LevelDef = {
  ...makeLevel(0, {
    name: 'Testikenttä',
    gap: 9,
    budget: 9999999,
    vehicle: 'truck',
    hint: 'Vapaa rakentelu: ei kustannusrajaa. Valitse testiajoneuvo alhaalta.',
  }),
  sandbox: true,
};

export const LEVELS: LevelDef[] = [
  makeLevel(1, {
    name: 'Puronylitys',
    gap: 4,
    budget: 3400,
    vehicle: 'car',
    hint: 'Rakenna tiekansi reunalta reunalle ja tue se palkeilla ylä- tai alapuolelta.',
  }),
  makeLevel(2, {
    name: 'Joenranta',
    gap: 5,
    budget: 4200,
    vehicle: 'car',
    hint: 'Kolmiot ovat lujin muoto — ristikko kestää enemmän kuin pelkkä kansi.',
  }),
  makeLevel(3, {
    name: 'Kanjoni',
    gap: 6,
    budget: 5400,
    vehicle: 'van',
    hint: 'Pakettiauto painaa yli kaksi kertaa auton verran — tue kansi joka liitoksesta.',
  }),
  makeLevel(4, {
    name: 'Rotko',
    gap: 7,
    budget: 6200,
    vehicle: 'van',
    hint: 'Alemmat ankkurit kallion kyljessä sopivat tukikaarelle.',
  }),
  makeLevel(5, {
    name: 'Raskas kuljetus',
    gap: 8,
    budget: 7800,
    vehicle: 'truck',
    hint: 'Kuorma-auto painaa 4,2 tonnia — seuraa palkkien värejä testissä.',
  }),
  makeLevel(6, {
    name: 'Vuoristotie',
    gap: 9,
    budget: 9800,
    vehicle: 'truck',
    hint: 'Vaijeri on vedossa vahva mutta menee puristuksessa löysäksi — löysät vaijerit näkyvät testissä haaleina.',
  }),
  makeLevel(7, {
    name: 'Rautatie',
    gap: 9,
    budget: 11500,
    vehicle: 'train0',
    hint: 'Veturi painaa 7 tonnia. Piste­kuorma on kova — jaa se ristikolla.',
  }),
  makeLevel(8, {
    name: 'Tavarajuna',
    gap: 10,
    budget: 12800,
    vehicle: 'train1',
    hint: 'Juna kuormittaa siltaa koko ylityksen ajan, ei vain hetken.',
  }),
  makeLevel(9, {
    name: 'Pitkä ylitys',
    gap: 11,
    budget: 14000,
    vehicle: 'train1',
    hint: 'Mitä pidempi jänne, sitä kovempi veto kanteen — tue joka liitos ja pidä ristikko korkeana.',
  }),
  makeLevel(10, {
    name: 'Suurhanke',
    gap: 14,
    budget: 18500,
    vehicle: 'train2',
    pillar: true,
    hint: 'Keskipilari on kaksi metriä kannen alapuolella — hyödynnä se.',
  }),
];
