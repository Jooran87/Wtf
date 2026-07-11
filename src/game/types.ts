// Yhteiset tyypit, materiaalit ja fysiikkavakiot.

export type MaterialId = 'road' | 'steel' | 'cable';

export interface Material {
  id: MaterialId;
  name: string;
  /** Hinta euroina metriä kohden */
  costPerM: number;
  /** Massa kiloina metriä kohden */
  massPerM: number;
  /** Aksiaalijäykkyys EA (N) — voima = EA * venymä */
  EA: number;
  /** Suhteellinen venymä jolla palkki murtuu */
  breakStrain: number;
  /** Vaijeri vastustaa vain vetoa */
  tensionOnly: boolean;
  /** Törmääkö ajoneuvon pyörä tähän (vain kansi) */
  collidable: boolean;
  /** Piirtoleveys metreinä */
  width: number;
  color: string;
}

export const MATERIALS: Record<MaterialId, Material> = {
  road: {
    id: 'road',
    name: 'Tie',
    costPerM: 260,
    massPerM: 40,
    EA: 2.5e6,
    breakStrain: 0.024,
    tensionOnly: false,
    collidable: true,
    width: 0.16,
    color: '#6e5138',
  },
  steel: {
    id: 'steel',
    name: 'Palkki',
    costPerM: 170,
    massPerM: 16,
    EA: 8e6,
    breakStrain: 0.03,
    tensionOnly: false,
    collidable: false,
    width: 0.09,
    color: '#94a3b3',
  },
  cable: {
    id: 'cable',
    name: 'Vaijeri',
    costPerM: 90,
    massPerM: 8,
    EA: 8e6,
    breakStrain: 0.08,
    tensionOnly: true,
    collidable: false,
    width: 0.045,
    color: '#3d434c',
  },
};

// --- Visuaaliset teemat ---
export type ThemeId = 'summer' | 'autumn' | 'winter' | 'night';

export interface Theme {
  skyTop: string;
  skyBottom: string;
  /** Kaukainen puurivi */
  treeFar: string;
  /** Lähempi puurivi */
  treeNear: string;
  /** Utuinen laakso horisontin alapuolella (rotkon tausta) */
  valley: string;
  cliff: string;
  /** Kallion kerrosraidat */
  strata: string;
  /** Pintakaista: ruoho tai lumi */
  edge: string;
  water: string;
  waterHi: string;
  /** HUD-tekstit taivasta vasten */
  text: string;
  gridDot: string;
  ghost: string;
  cloudColor: string;
  clouds: boolean;
  snow: boolean;
  stars: boolean;
}

export const THEMES: Record<ThemeId, Theme> = {
  summer: {
    skyTop: '#6fb0e3',
    skyBottom: '#cfe8f7',
    treeFar: '#9dbccf',
    treeNear: '#6d9b7d',
    valley: '#bcd8ea',
    cliff: '#6b5340',
    strata: 'rgba(0,0,0,0.08)',
    edge: '#5da24e',
    water: '#2e6f9e',
    waterHi: '#5b9cc7',
    text: '#173049',
    gridDot: 'rgba(30,50,70,0.28)',
    ghost: 'rgba(20,40,60,0.18)',
    cloudColor: 'rgba(255,255,255,0.85)',
    clouds: true,
    snow: false,
    stars: false,
  },
  autumn: {
    skyTop: '#7d9cc2',
    skyBottom: '#ecdcbc',
    treeFar: '#c0a887',
    treeNear: '#a3763f',
    valley: '#d5c6a8',
    cliff: '#6b4c36',
    strata: 'rgba(0,0,0,0.09)',
    edge: '#c07f3a',
    water: '#3a6a8a',
    waterHi: '#6c93ad',
    text: '#2d2418',
    gridDot: 'rgba(50,40,25,0.3)',
    ghost: 'rgba(45,36,24,0.18)',
    cloudColor: 'rgba(255,250,240,0.8)',
    clouds: true,
    snow: false,
    stars: false,
  },
  winter: {
    skyTop: '#9fc0da',
    skyBottom: '#eef4f9',
    treeFar: '#c5d8e6',
    treeNear: '#8fa9bc',
    valley: '#dfeaf2',
    cliff: '#5f6874',
    strata: 'rgba(255,255,255,0.10)',
    edge: '#f0f6fa',
    water: '#4a7ba0',
    waterHi: '#d8e8f2',
    text: '#1e3346',
    gridDot: 'rgba(30,50,70,0.3)',
    ghost: 'rgba(20,40,60,0.2)',
    cloudColor: 'rgba(255,255,255,0.9)',
    clouds: false,
    snow: true,
    stars: false,
  },
  night: {
    skyTop: '#0d1a2e',
    skyBottom: '#2b4560',
    treeFar: '#16283e',
    treeNear: '#0e1c2e',
    valley: '#122338',
    cliff: '#2e2a26',
    strata: 'rgba(255,255,255,0.05)',
    edge: '#3d5c46',
    water: '#0f2438',
    waterHi: '#2c5570',
    text: '#d7e6f2',
    gridDot: 'rgba(220,235,250,0.3)',
    ghost: 'rgba(220,235,250,0.22)',
    cloudColor: 'rgba(180,200,220,0.25)',
    clouds: false,
    snow: false,
    stars: true,
  },
};

/** Akselien suuntainen maastolaatikko (kallio, pilari) */
export interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Onko piste maaston pinnalla (katto tai seinämä) → rakenteen voi ankkuroida siihen */
export function isTerrainPoint(terrain: Box[], x: number, y: number): boolean {
  const e = 1e-6;
  for (const b of terrain) {
    const onTop = Math.abs(y - b.minY) < e && x >= b.minX - e && x <= b.maxX + e;
    const onLeft = Math.abs(x - b.minX) < e && y >= b.minY - e && y <= b.maxY + e;
    const onRight = Math.abs(x - b.maxX) < e && y >= b.minY - e && y <= b.maxY + e;
    if (onTop || onLeft || onRight) return true;
  }
  return false;
}

/** Rakennusvaiheen palkki ruudukkokoordinaateissa */
export interface BuildBeam {
  id: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  material: MaterialId;
}

export type VehicleId = 'car' | 'van' | 'truck' | 'train0' | 'train1' | 'train2';

export interface LevelDef {
  id: number;
  name: string;
  /** Rotkon leveys metreinä */
  gap: number;
  budget: number;
  vehicle: VehicleId;
  /** Maailman leveys metreinä */
  worldW: number;
  /** Maailman korkeus metreinä */
  worldH: number;
  /** Kannen / kallionreunan y */
  deckY: number;
  /** Vasemman kallion oikea reuna */
  leftEdge: number;
  /** Oikean kallion vasen reuna */
  rightEdge: number;
  terrain: Box[];
  /** Kiinteät ankkuripisteet */
  anchors: { x: number; y: number }[];
  /** y jonka alapuolella ajoneuvo on pudonnut veteen */
  failY: number;
  waterY: number;
  hint?: string;
  /** Testikenttä: ei kustannusrajaa, ajoneuvon saa valita */
  sandbox?: boolean;
  theme: ThemeId;
  /** Vetovoiman kerroin (esim. jäinen kansi talvella < 1) */
  driveFactor?: number;
}

// --- Fysiikkavakiot ---
export const GRAVITY = 9.81;
/** Alifysiikka-askelia per 60 Hz -ruutu → h = 1/720 s (jäykät vaijerit vaativat tiheän askeleen) */
export const SUBSTEPS = 12;
export const FRAME_DT = 1 / 60;
/** PBD-iteraatiot törmäyksille ja ajoneuvon jäykille sidoksille */
export const PBD_ITERS = 6;
/** Nopeusvaimennus per alifysiikka-askel */
export const DRAG = 0.9997;
/** Vetopyörän kiihtyvyys m/s² */
export const DRIVE_ACCEL = 3.5;
/** Ruudukon jako metreinä */
export const GRID = 1;
/** Palkin maksimipituus metreinä */
export const MAX_BEAM_LEN = 2.4;
/**
 * Pyörän kosketusvara metreinä: pyörä lepää tämän verran pinnan
 * yläpuolella sekä kansipalkeilla että maastossa, jotta sillan ja
 * maan saumassa ei ole korkeuseroa.
 */
export const WHEEL_PAD = 0.04;
/** Testin aikaraja sekunteina */
export const TIME_LIMIT = 45;
