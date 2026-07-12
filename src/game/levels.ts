import { Box, BuildBeam, LevelDef, ThemeId, VehicleId, isTerrainPoint } from './types';

/**
 * Jakaa 2 m:n suorat palkit kahtia, jos niiden keskikohdassa on liitos
 * (toisen palkin pää, ankkuri tai maastopiste). Palkit liittyvät toisiinsa
 * vain päistään — ilman jakoa keskelle piirretty palkki ei oikeasti
 * kiinnittyisi, vaikka siltä näyttää.
 */
export function splitBeamsAtJoints(
  level: LevelDef,
  beams: BuildBeam[],
  nextId: () => number
): BuildBeam[] {
  const pts = new Set<string>();
  for (const b of beams) {
    pts.add(`${b.ax},${b.ay}`);
    pts.add(`${b.bx},${b.by}`);
  }
  for (const a of level.anchors) pts.add(`${a.x},${a.y}`);

  const out: BuildBeam[] = [];
  for (const b of beams) {
    const dx = b.bx - b.ax;
    const dy = b.by - b.ay;
    const straight2 = (Math.abs(dx) === 2 && dy === 0) || (dx === 0 && Math.abs(dy) === 2);
    if (straight2) {
      const mx = (b.ax + b.bx) / 2;
      const my = (b.ay + b.by) / 2;
      if (pts.has(`${mx},${my}`) || isTerrainPoint(level.terrain, mx, my)) {
        out.push({ ...b, id: nextId(), bx: mx, by: my });
        out.push({ ...b, id: nextId(), ax: mx, ay: my });
        continue;
      }
    }
    out.push(b);
  }
  return out;
}

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
  /** Pilareita halutuissa x-kohdissa (huippu 2 m kannen alla) */
  pillarsAt?: number[];
  /** Saaria rotkon keskellä: maa-alue kannen tasossa [x0, x1] */
  islands?: [number, number][];
  hint?: string;
  theme?: ThemeId;
  driveFactor?: number;
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

  const pillarXs = [...(p.pillarsAt ?? [])];
  if (p.pillar) pillarXs.push(Math.round(leftEdge + p.gap / 2));
  for (const px of pillarXs) {
    terrain.push({ minX: px - 0.55, maxX: px + 0.55, minY: DECK_Y + 2, maxY: 99 });
    anchors.push({ x: px, y: DECK_Y + 2 });
  }

  // Saaret: maa-alue kannen tasossa rotkon keskellä; reunoihin ankkurit
  for (const [x0, x1] of p.islands ?? []) {
    terrain.push({ minX: x0, maxX: x1, minY: DECK_Y, maxY: 99 });
    anchors.push({ x: x0, y: DECK_Y }, { x: x1, y: DECK_Y });
    anchors.push({ x: x0, y: DECK_Y + 2 }, { x: x1, y: DECK_Y + 2 });
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
    theme: p.theme ?? 'summer',
    driveFactor: p.driveFactor,
  };
}

/** Testikenttä: vapaa rakentelu ilman kustannusrajaa, ajoneuvon saa valita */
export const SANDBOX: LevelDef = {
  // Parillinen jänneväli → keskipiste osuu ruudukkoon ja sillasta saa symmetrisen
  ...makeLevel(0, {
    name: 'Testikenttä',
    gap: 10,
    budget: 9999999,
    vehicle: 'truck',
    hint: 'Vapaa rakentelu: ei kustannusrajaa. Valitse testiajoneuvo alhaalta.',
  }),
  sandbox: true,
};

/** Testikenttä II: kaksi jännettä ja saari — uusien kenttien tapaan */
export const SANDBOX2: LevelDef = {
  ...makeLevel(-1, {
    name: 'Testikenttä II',
    gap: 14,
    budget: 9999999,
    vehicle: 'train1',
    islands: [[9, 11]],
    hint: 'Vapaa rakentelu saarella: kaksi 6 m jännettä. Saaren pinta on ankkuroitavissa.',
  }),
  sandbox: true,
};

export const LEVELS: LevelDef[] = [
  makeLevel(1, {
    name: 'Puronylitys',
    gap: 4,
    budget: 4100,
    vehicle: 'car',
    hint: 'Rakenna tiekansi reunalta reunalle ja tue se palkeilla ylä- tai alapuolelta.',
  }),
  makeLevel(2, {
    name: 'Joenranta',
    gap: 5,
    budget: 4200,
    vehicle: 'van',
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
    theme: 'autumn',
    hint: 'Alemmat ankkurit kallion kyljessä sopivat tukikaarelle.',
  }),
  makeLevel(5, {
    name: 'Raskas kuljetus',
    gap: 8,
    budget: 7800,
    vehicle: 'truck',
    theme: 'autumn',
    hint: 'Kuorma-auto painaa 4,2 tonnia — seuraa palkkien värejä testissä.',
  }),
  makeLevel(6, {
    name: 'Vuoristotie',
    gap: 9,
    budget: 9800,
    vehicle: 'truck',
    theme: 'winter',
    driveFactor: 0.75,
    hint: 'Vaijeri kestää vain vetoa. ❄ Jäinen kansi pitää huonommin — loivat mäet!',
  }),
  makeLevel(7, {
    name: 'Rautatie',
    gap: 9,
    budget: 11500,
    vehicle: 'train0',
    theme: 'winter',
    driveFactor: 0.75,
    hint: 'Veturi painaa 7 tonnia ja kansi on jäinen — jaa kuorma tiheällä ristikolla.',
  }),
  makeLevel(8, {
    name: 'Tavarajuna',
    gap: 10,
    budget: 12800,
    vehicle: 'train1',
    theme: 'winter',
    driveFactor: 0.75,
    hint: 'Juna kuormittaa siltaa koko ylityksen ajan, ei vain hetken.',
  }),
  makeLevel(9, {
    name: 'Pitkä ylitys',
    gap: 11,
    budget: 14000,
    vehicle: 'train1',
    theme: 'night',
    hint: 'Mitä pidempi jänne, sitä kovempi veto kanteen — tue joka liitos ja pidä ristikko korkeana.',
  }),
  makeLevel(10, {
    name: 'Suurhanke',
    gap: 14,
    budget: 18500,
    vehicle: 'train2',
    theme: 'night',
    pillar: true,
    hint: 'Keskipilari on kaksi metriä kannen alapuolella — hyödynnä se.',
  }),
  makeLevel(11, {
    name: 'Saaristotie',
    gap: 12,
    budget: 10000,
    vehicle: 'truck',
    islands: [[8, 10]],
    hint: 'Saari jakaa ylityksen kahteen jänteeseen — sen pintaan voi ankkuroida.',
  }),
  makeLevel(12, {
    name: 'Kaksoisrotko',
    gap: 14,
    budget: 14500,
    vehicle: 'train0',
    theme: 'autumn',
    islands: [[9, 11]],
    hint: 'Veturi ylittää molemmat rotkot — muista tukea myös saaren reunat.',
  }),
  makeLevel(13, {
    name: 'Malmijuna',
    gap: 12,
    budget: 16000,
    vehicle: 'train3',
    theme: 'winter',
    driveFactor: 0.75,
    pillar: true,
    hint: '17,8 tonnia jäisellä kannella. Pilari kantaa vain jos rakennat sen varaan.',
  }),
  makeLevel(14, {
    name: 'Suurkanjoni',
    gap: 16,
    budget: 23000,
    vehicle: 'train2',
    theme: 'night',
    pillarsAt: [8, 14],
    hint: 'Kaksi pilaria jakaa 16 metrin jänteen kolmeen osaan.',
  }),
  makeLevel(15, {
    name: 'Jättiläinen',
    gap: 17,
    budget: 18500,
    vehicle: 'train4',
    theme: 'night',
    islands: [[10, 13]],
    hint: 'Tuplaveturijuna painaa 24,8 tonnia. Saari on ainoa liittolaisesi.',
  }),
];
