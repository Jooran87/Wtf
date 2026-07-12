// Fysiikkamoottori: aksiaalijousiin perustuva ristikkomalli.
//
// - Solmut integroidaan Verlet-menetelmällä 600 Hz:n alifysiikka-askelin.
// - Palkit ovat aksiaalijousia: F = EA * venymä + vaimennus. Venymä kertoo
//   suoraan palkin jännityksen, ja palkki murtuu kun tasoitettu jännitys
//   ylittää materiaalin murtovenymän.
// - Ajoneuvo on jäykkä kappale: sen sisäiset sidokset ja törmäykset
//   ratkaistaan sijaintipohjaisesti (PBD) jousi-integroinnin päälle, jolloin
//   raskas ajoneuvo välittää painonsa siltaan ilman epästabiiliutta.

import {
  Box,
  BuildBeam,
  DRAG,
  DRIVE_ACCEL,
  FRAME_DT,
  GRAVITY,
  LevelDef,
  MATERIALS,
  Material,
  PBD_ITERS,
  QuakeSpec,
  SUBSTEPS,
  WHEEL_PAD,
  WindSpec,
  isTerrainPoint,
} from './types';

export interface SimNode {
  x: number;
  y: number;
  px: number;
  py: number;
  /** Alkuperäinen x (maanjäristys liikuttaa kiinteitä solmuja tämän ympärillä) */
  baseX: number;
  fx: number;
  fy: number;
  mass: number;
  invMass: number;
  fixed: boolean;
  /** Pyörän säde; 0 = pistesolmu */
  radius: number;
  vehicle: boolean;
  /** Kosketus tällä alifysiikka-askeleella */
  contact: boolean;
  contactPrev: boolean;
  /** Viimeisin kosketusnormaali (osoittaa pinnasta poispäin) */
  cnx: number;
  cny: number;
}

export interface SimBeam {
  a: number;
  b: number;
  mat: Material;
  restLen: number;
  damp: number;
  broken: boolean;
  /** Hetkellinen suhteellinen venymä (+ veto, − puristus) */
  strain: number;
  /** |venymä| / murtovenymä, 0..1+ */
  stress: number;
  /** Tasoitettu jännitys murtumistarkastelua varten */
  stressS: number;
}

/** Ajoneuvon jäykkä sidos (ei murru) */
interface RigidLink {
  a: number;
  b: number;
  rest: number;
}

export interface VehicleSegment {
  /** Pyöräsolmujen indeksit */
  wheels: number[];
  /** Korisolmujen indeksit järjestyksessä vasen, oikea */
  chassis: number[];
  drive: number[];
  speed: number;
  color: string;
  kind: 'car' | 'van' | 'truck' | 'loco' | 'wagon';
}

const SUB_DT = FRAME_DT / SUBSTEPS;

export class Engine {
  nodes: SimNode[] = [];
  beams: SimBeam[] = [];
  rigidLinks: RigidLink[] = [];
  segments: VehicleSegment[] = [];
  terrain: Box[];
  time = 0;
  /** Vetopyörien kiihtyvyys (jäisellä kannella pienempi) */
  driveAccel = DRIVE_ACCEL;
  /** Murtuiko jokin palkki viimeisimmällä askeleella */
  brokeThisStep = false;
  /** Tuulikuorma (tornikentät): puuskittainen vaakavoima solmuille */
  wind?: WindSpec;
  /** Maanjäristys (tornikentät): kiinteiden solmujen vaakaheilutus */
  quake?: QuakeSpec;
  /** Maanpinnan y tuulen korkeusskaalausta varten */
  windGroundY = 10;
  /** Tämänhetkinen tuulivoima newtoneina (näyttöä varten) */
  currentWind = 0;

  constructor(terrain: Box[]) {
    this.terrain = terrain;
  }

  addNode(x: number, y: number, mass: number, opts?: { fixed?: boolean; radius?: number; vehicle?: boolean }): number {
    this.nodes.push({
      x,
      y,
      px: x,
      py: y,
      baseX: x,
      fx: 0,
      fy: 0,
      mass,
      invMass: opts?.fixed ? 0 : 1 / mass,
      fixed: !!opts?.fixed,
      radius: opts?.radius ?? 0,
      vehicle: !!opts?.vehicle,
      contact: false,
      contactPrev: false,
      cnx: 0,
      cny: -1,
    });
    return this.nodes.length - 1;
  }

  addBeam(a: number, b: number, mat: Material): number {
    const na = this.nodes[a];
    const nb = this.nodes[b];
    const restLen = Math.hypot(nb.x - na.x, nb.y - na.y);
    // Alikriittinen vaimennus estää värähtelyn räjähtämisen
    const k = mat.EA / restLen;
    const mRed = 1 / (na.invMass + nb.invMass || 1);
    const damp = 0.08 * 2 * Math.sqrt(k * Math.min(mRed, 200));
    this.beams.push({
      a,
      b,
      mat,
      restLen,
      damp,
      broken: false,
      strain: 0,
      stress: 0,
      stressS: 0,
    });
    return this.beams.length - 1;
  }

  addRigidLink(a: number, b: number) {
    const na = this.nodes[a];
    const nb = this.nodes[b];
    this.rigidLinks.push({ a, b, rest: Math.hypot(nb.x - na.x, nb.y - na.y) });
  }

  /** Etenee yhden 60 Hz -ruudun verran. */
  step() {
    this.brokeThisStep = false;
    for (let s = 0; s < SUBSTEPS; s++) this.substep(SUB_DT);
  }

  private substep(h: number) {
    const nodes = this.nodes;

    // 1) Voimat: painovoima + tuuli + palkkijouset
    for (const n of nodes) {
      n.fx = 0;
      n.fy = GRAVITY * n.mass;
    }
    if (this.wind) {
      const t = this.time;
      const osc =
        0.6 * Math.sin((2 * Math.PI * t) / this.wind.period) +
        0.4 * Math.sin((2 * Math.PI * t) / (this.wind.period * 0.37) + 1.7);
      // Tuulivoima N per palkkimetri: rakenne on purje, jonka pinta-ala
      // kasvaa palkkien määrän mukana
      const w = this.wind.base + this.wind.gust * Math.max(0, osc);
      this.currentWind = w;
      for (const beam of this.beams) {
        if (beam.broken) continue;
        const na = nodes[beam.a];
        const nb = nodes[beam.b];
        // Tuuli voimistuu korkeuden myötä
        const midY = (na.y + nb.y) / 2;
        const hf = Math.min(1, Math.max(0.1, (this.windGroundY - midY) / 6));
        const F = w * beam.restLen * hf * 0.5;
        if (!na.fixed) na.fx += F;
        if (!nb.fixed) nb.fx += F;
      }
    }
    for (const beam of this.beams) {
      if (beam.broken) continue;
      const na = nodes[beam.a];
      const nb = nodes[beam.b];
      const dx = nb.x - na.x;
      const dy = nb.y - na.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-9) continue;
      const ux = dx / len;
      const uy = dy / len;
      const strain = (len - beam.restLen) / beam.restLen;
      beam.strain = strain;
      if (beam.mat.tensionOnly && strain <= 0) continue;
      // Venymän suuntainen suhteellinen nopeus vaimennusta varten
      const relV = ((nb.x - nb.px - (na.x - na.px)) * ux + (nb.y - nb.py - (na.y - na.py)) * uy) / h;
      const F = beam.mat.EA * strain + beam.damp * relV;
      na.fx += F * ux;
      na.fy += F * uy;
      nb.fx -= F * ux;
      nb.fy -= F * uy;
    }

    // 2) Verlet-integrointi
    for (const n of nodes) {
      if (n.fixed) continue;
      const vx = (n.x - n.px) * DRAG;
      const vy = (n.y - n.py) * DRAG;
      n.px = n.x;
      n.py = n.y;
      n.x += vx + n.fx * n.invMass * h * h;
      n.y += vy + n.fy * n.invMass * h * h;
    }
    // Maanjäristys: perustukset heiluvat vaakasuunnassa
    if (this.quake && this.time > this.quake.start) {
      const off = this.quake.amp * Math.sin(2 * Math.PI * this.quake.freq * (this.time - this.quake.start));
      for (const n of nodes) {
        if (!n.fixed) continue;
        n.px = n.x;
        n.x = n.baseX + off;
      }
    }

    // 3) Vetopyörät: kiihdytys pinnan tangentin suuntaan.
    // Vain yläpuolinen kosketus vetää — sivu- tai alakosketuksesta ei saa
    // työntöä väärään suuntaan.
    for (const seg of this.segments) {
      for (const wi of seg.drive) {
        const n = nodes[wi];
        if (!n.contactPrev || n.cny > -0.3) continue;
        const tx = -n.cny;
        const ty = n.cnx;
        const vt = ((n.x - n.px) * tx + (n.y - n.py) * ty) / h;
        if (vt < seg.speed) {
          const dv = Math.min(this.driveAccel * h, seg.speed - vt);
          n.px -= tx * dv * h;
          n.py -= ty * dv * h;
        }
      }
    }

    // 4) Sijaintipohjaiset rajoitteet: ajoneuvon jäykkyys + törmäykset
    for (const n of nodes) {
      n.contactPrev = n.contact;
      n.contact = false;
    }
    for (let it = 0; it < PBD_ITERS; it++) {
      this.solveRigidLinks();
      this.keepVehiclesUnmirrored();
      this.collideWheelsWithDeck();
      this.collideTerrain();
    }

    // 5) Jännitys ja murtuminen
    for (const beam of this.beams) {
      if (beam.broken) continue;
      const na = nodes[beam.a];
      const nb = nodes[beam.b];
      const len = Math.hypot(nb.x - na.x, nb.y - na.y);
      const strain = (len - beam.restLen) / beam.restLen;
      beam.strain = strain;
      const eff = beam.mat.tensionOnly && strain <= 0 ? 0 : Math.abs(strain) / beam.mat.breakStrain;
      beam.stress = eff;
      beam.stressS = beam.stressS * 0.9 + eff * 0.1;
      if (beam.stressS > 1 || eff > 1.6) {
        beam.broken = true;
        this.brokeThisStep = true;
      }
    }

    this.time += h;
  }

  /**
   * Estää ajoneuvon peilautumisen: pelkät etäisyyssidokset sallivat
   * kappaleen kääntymisen peilikuvakseen kovassa iskussa (kori päätyy
   * akselin alapuolelle). Jos korisolmu on akselilinjan väärällä
   * puolella, se heijastetaan takaisin. Aito ympäripyörähdys (jossa myös
   * akseli kääntyy) on edelleen mahdollinen.
   */
  private keepVehiclesUnmirrored() {
    for (const seg of this.segments) {
      const wF = this.nodes[seg.wheels[0]];
      const wR = this.nodes[seg.wheels[seg.wheels.length - 1]];
      const fx = wF.x - wR.x;
      const fy = wF.y - wR.y;
      const len2 = fx * fx + fy * fy;
      if (len2 < 1e-9) continue;
      for (const ci of seg.chassis) {
        const c = this.nodes[ci];
        const ox = c.x - wR.x;
        const oy = c.y - wR.y;
        // Kori kuuluu akselilinjan yläpuolelle: cross < 0 (y kasvaa alaspäin)
        if (fx * oy - fy * ox > 0) {
          const t = (ox * fx + oy * fy) / len2;
          const footX = wR.x + fx * t;
          const footY = wR.y + fy * t;
          c.x = 2 * footX - c.x;
          c.y = 2 * footY - c.y;
        }
      }
    }
  }

  private solveRigidLinks() {
    const nodes = this.nodes;
    for (const link of this.rigidLinks) {
      const na = nodes[link.a];
      const nb = nodes[link.b];
      const dx = nb.x - na.x;
      const dy = nb.y - na.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-9) continue;
      const wSum = na.invMass + nb.invMass;
      if (wSum === 0) continue;
      const corr = (len - link.rest) / len / wSum;
      na.x += dx * corr * na.invMass;
      na.y += dy * corr * na.invMass;
      nb.x -= dx * corr * nb.invMass;
      nb.y -= dy * corr * nb.invMass;
    }
  }

  /** Pyörä vastaan kansipalkki (jana–ympyrä) painotetulla PBD-projektiolla */
  private collideWheelsWithDeck() {
    const nodes = this.nodes;
    for (const seg of this.segments) {
      for (const wi of seg.wheels) {
        const w = nodes[wi];
        const r = w.radius + WHEEL_PAD;
        for (const beam of this.beams) {
          if (beam.broken || !beam.mat.collidable) continue;
          const na = nodes[beam.a];
          const nb = nodes[beam.b];
          const abx = nb.x - na.x;
          const aby = nb.y - na.y;
          const abLen2 = abx * abx + aby * aby;
          if (abLen2 < 1e-9) continue;
          let t = ((w.x - na.x) * abx + (w.y - na.y) * aby) / abLen2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const cx = na.x + abx * t;
          const cy = na.y + aby * t;
          let nx = w.x - cx;
          let ny = w.y - cy;
          const dist = Math.hypot(nx, ny);
          if (dist >= r) continue;
          if (dist < 1e-6) {
            nx = 0;
            ny = -1;
          } else {
            nx /= dist;
            ny /= dist;
          }
          const pen = r - dist;
          const wWheel = w.invMass;
          const wBeam = (1 - t) * (1 - t) * na.invMass + t * t * nb.invMass;
          const wSum = wWheel + wBeam;
          if (wSum === 0) continue;
          w.x += nx * pen * (wWheel / wSum);
          w.y += ny * pen * (wWheel / wSum);
          const beamShare = pen * (wBeam / wSum);
          if (wBeam > 0) {
            const denom = (1 - t) * (1 - t) * na.invMass + t * t * nb.invMass;
            na.x -= nx * beamShare * ((1 - t) * na.invMass) / denom;
            na.y -= ny * beamShare * ((1 - t) * na.invMass) / denom;
            nb.x -= nx * beamShare * (t * nb.invMass) / denom;
            nb.y -= ny * beamShare * (t * nb.invMass) / denom;
          }
          w.contact = true;
          w.cnx = nx;
          w.cny = ny;
        }
      }
    }
  }

  /** Kaikki solmut vastaan maastolaatikot (ympyrä–AABB) */
  private collideTerrain() {
    for (const n of this.nodes) {
      if (n.fixed) continue;
      // Pyörille sama kosketusvara kuin kansipalkeissa, jotta sillan ja
      // maanpinnan saumassa ei ole pudotusta joka tömäyttäisi ajoneuvon
      // kannen päätypalkille.
      const r = Math.max(n.radius, 0.02) + (n.radius > 0 ? WHEEL_PAD : 0);
      for (const box of this.terrain) {
        const cx = n.x < box.minX ? box.minX : n.x > box.maxX ? box.maxX : n.x;
        const cy = n.y < box.minY ? box.minY : n.y > box.maxY ? box.maxY : n.y;
        let dx = n.x - cx;
        let dy = n.y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > 1e-9) {
          // Keskipiste laatikon ulkopuolella
          if (dist >= r) continue;
          dx /= dist;
          dy /= dist;
          n.x += dx * (r - dist);
          n.y += dy * (r - dist);
          n.contact = true;
          n.cnx = dx;
          n.cny = dy;
        } else {
          // Keskipiste laatikon sisällä: työnnä ulos lähimmän sivun kautta
          const dl = n.x - box.minX;
          const dr = box.maxX - n.x;
          const dt = n.y - box.minY;
          const db = box.maxY - n.y;
          const m = Math.min(dl, dr, dt, db);
          if (m === dt) {
            n.y = box.minY - r;
            n.cnx = 0;
            n.cny = -1;
          } else if (m === dl) {
            n.x = box.minX - r;
            n.cnx = -1;
            n.cny = 0;
          } else if (m === dr) {
            n.x = box.maxX + r;
            n.cnx = 1;
            n.cny = 0;
          } else {
            n.y = box.maxY + r;
            n.cnx = 0;
            n.cny = 1;
          }
          n.contact = true;
        }
        // Kitka sillan solmuille kallion päällä
        if (!n.vehicle && n.contact) {
          n.px += (n.x - n.px) * 0.3;
          n.py += (n.y - n.py) * 0.3;
        }
      }
    }
  }

  // --- Voitto- ja häviötarkastelut ---

  vehicleMinX(): number {
    let min = Infinity;
    for (const n of this.nodes) if (n.vehicle && n.x < min) min = n.x;
    return min;
  }

  vehicleMaxX(): number {
    let max = -Infinity;
    for (const n of this.nodes) if (n.vehicle && n.x > max) max = n.x;
    return max;
  }

  vehicleMaxY(): number {
    let max = -Infinity;
    for (const n of this.nodes) if (n.vehicle && n.y > max) max = n.y;
    return max;
  }

  /** Rakenteen korkein piste (pienin y) — tornikenttien tavoitetarkastelu */
  structureMinY(): number {
    let min = Infinity;
    for (const n of this.nodes) if (!n.vehicle && n.y < min) min = n.y;
    return min;
  }

  /**
   * Kiinnittää kuorman (kg) rakenteen korkeimpaan solmuun ja palauttaa
   * solmun indeksin huojuntaseurantaa varten. Kuorma 0 palauttaa silti
   * huippusolmun.
   */
  attachTopLoad(mass: number): number | null {
    let idx = -1;
    let best = Infinity;
    this.nodes.forEach((n, i) => {
      if (!n.fixed && !n.vehicle && n.y < best) {
        best = n.y;
        idx = i;
      }
    });
    if (idx < 0) return null;
    if (mass > 0) {
      const n = this.nodes[idx];
      n.mass += mass;
      n.invMass = 1 / n.mass;
    }
    return idx;
  }
}

/** Kokoaa rakennetusta sillasta ja kentästä simulaation. */
export function buildEngine(level: LevelDef, beams: BuildBeam[]): Engine {
  const engine = new Engine(level.terrain);
  engine.driveAccel = DRIVE_ACCEL * (level.driveFactor ?? 1);
  engine.wind = level.wind;
  engine.quake = level.quake;
  engine.windGroundY = level.deckY;
  const nodeIdx = new Map<string, number>();
  const key = (x: number, y: number) => `${x},${y}`;

  const anchorSet = new Set(level.anchors.map((a) => key(a.x, a.y)));
  const getNode = (x: number, y: number): number => {
    const k = key(x, y);
    let idx = nodeIdx.get(k);
    if (idx === undefined) {
      // Maanpinnalla olevat pisteet ovat kallioankkureita
      const fixed = anchorSet.has(k) || isTerrainPoint(level.terrain, x, y);
      idx = engine.addNode(x, y, 2, { fixed });
      nodeIdx.set(k, idx);
    }
    return idx;
  };

  for (const b of beams) {
    const a = getNode(b.ax, b.ay);
    const c = getNode(b.bx, b.by);
    engine.addBeam(a, c, MATERIALS[b.material]);
  }

  // Jaa palkkien massa päätesolmuille ja lukitse käänteismassat
  for (const beam of engine.beams) {
    const half = (beam.mat.massPerM * beam.restLen) / 2;
    engine.nodes[beam.a].mass += half;
    engine.nodes[beam.b].mass += half;
  }
  for (const n of engine.nodes) {
    if (!n.fixed) n.invMass = 1 / n.mass;
  }

  return engine;
}
