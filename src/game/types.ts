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
    breakStrain: 0.025,
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
/** Testin aikaraja sekunteina */
export const TIME_LIMIT = 45;
