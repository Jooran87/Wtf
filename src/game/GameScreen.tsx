import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Ellipse, G, Line, Polygon, Rect } from 'react-native-svg';
import { Engine, buildEngine } from './engine';
import { splitBeamsAtJoints } from './levels';
import { spawnVehicle, vehicleInfo } from './vehicles';
import {
  BuildBeam,
  LevelDef,
  MATERIALS,
  MAX_BEAM_LEN,
  MaterialId,
  THEMES,
  TIME_LIMIT,
  VehicleId,
  isTerrainPoint,
} from './types';

const SANDBOX_VEHICLES: VehicleId[] = ['car', 'van', 'truck', 'train0', 'train1', 'train2', 'train3', 'train4'];

/** Tornitestikentän säädettävät tuuliasetukset */
const TOWER_WINDS: { label: string; spec?: { base: number; gust: number; period: number } }[] = [
  { label: 'Tyyni' },
  { label: '💨 Tuulinen', spec: { base: 130, gust: 280, period: 3 } },
  { label: '🌬 Myrsky', spec: { base: 300, gust: 640, period: 2.2 } },
  { label: '🌪 Hirmumyrsky', spec: { base: 500, gust: 1050, period: 1.9 } },
];
const TOWER_LOADS = [0, 1000, 2500];

/** Deterministinen pseudosatunnaisluku koristeille */
const rnd01 = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const CONFETTI_COLORS = ['#ffd76b', '#e05555', '#5bc0de', '#8fd18a', '#f2f2f2'];

type Phase = 'build' | 'test' | 'won' | 'failed';
type Tool = MaterialId | 'delete';

interface Props {
  level: LevelDef;
  hasNext: boolean;
  onComplete: (levelId: number, stars: number) => void;
  onNext: () => void;
  onExit: () => void;
}

interface DragState {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  valid: boolean;
}

function isValidPoint(level: LevelDef, x: number, y: number): boolean {
  if (level.anchors.some((a) => a.x === x && a.y === y)) return true;
  const top = level.buildTop ?? 1;
  const bottom = level.buildBottom ?? 7;
  if (x < 1 || x > level.worldW - 1 || y < top || y > bottom) return false;
  if (level.lot && (x < level.lot[0] || x > level.lot[1])) return false;
  for (const box of level.terrain) {
    if (x > box.minX + 0.01 && x < box.maxX - 0.01 && y > box.minY + 0.01 && y < box.maxY) {
      return false;
    }
  }
  return true;
}

function beamCost(b: BuildBeam): number {
  const len = Math.hypot(b.bx - b.ax, b.by - b.ay);
  return Math.round(len * MATERIALS[b.material].costPerM);
}

/**
 * Jännitysväri. Veto: vihreä → keltainen → punainen (lämmin).
 * Puristus: vihreä → sininen → violetti (kylmä), jotta pelaaja näkee
 * kumpi kuormitustapa palkkia rasittaa.
 */
function stressColor(s: number, compression: boolean): string {
  const t = Math.max(0, Math.min(1, s));
  const lerp = (a: number, b: number, k: number) => Math.round(a + (b - a) * k);
  const ramp = compression
    ? [0x39, 0xc2, 0x5c, 0x3f, 0x8f, 0xd6, 0x9b, 0x59, 0xd6] // vihreä→sininen→violetti
    : [0x39, 0xc2, 0x5c, 0xe6, 0xc3, 0x19, 0xe0, 0x43, 0x43]; // vihreä→keltainen→punainen
  let r: number, g: number, bl: number;
  if (t < 0.5) {
    const k = t / 0.5;
    r = lerp(ramp[0], ramp[3], k);
    g = lerp(ramp[1], ramp[4], k);
    bl = lerp(ramp[2], ramp[5], k);
  } else {
    const k = (t - 0.5) / 0.5;
    r = lerp(ramp[3], ramp[6], k);
    g = lerp(ramp[4], ramp[7], k);
    bl = lerp(ramp[5], ramp[8], k);
  }
  return `rgb(${r},${g},${bl})`;
}

export default function GameScreen({ level, hasNext, onComplete, onNext, onExit }: Props) {
  const { width: winW, height: winH } = useWindowDimensions();
  const [beams, setBeams] = useState<BuildBeam[]>([]);
  const [tool, setTool] = useState<Tool>('road');
  const [vehicle, setVehicle] = useState<VehicleId>(level.vehicle);
  // Tornitestikentän säätimet
  const [windIdx, setWindIdx] = useState(1);
  const [quakeOn, setQuakeOn] = useState(false);
  const [loadIdx, setLoadIdx] = useState(1);
  const [phase, setPhase] = useState<Phase>('build');
  const [drag, setDrag] = useState<DragState | null>(null);
  const [failReason, setFailReason] = useState('');
  const [stars, setStars] = useState(0);
  const [budgetFlash, setBudgetFlash] = useState(false);
  const [, setTick] = useState(0);

  const engineRef = useRef<Engine | null>(null);
  const rafRef = useRef<number | null>(null);
  const nextBeamId = useRef(1);
  const progressRef = useRef({ maxX: -Infinity, at: 0 });
  // Tehosteet: murtumakipinät ja voittokonfetit
  const brokenSeenRef = useRef<Set<number>>(new Set());
  const burstsRef = useRef<{ x: number; y: number; t0: number }[]>([]);
  const wonTimeRef = useRef<number | null>(null);
  // Tornin huippusolmu huojuntaseurantaan + kiinnitetty kuorma
  const topIdxRef = useRef<number | null>(null);
  const topX0Ref = useRef(0);
  const loadKgRef = useRef(0);

  // Ajantasaiset arvot PanResponderin käyttöön (luodaan vain kerran)
  const stateRef = useRef({
    level,
    beams,
    tool,
    phase,
    vehicle,
    windIdx,
    quakeOn,
    loadIdx,
    scale: 1,
    ox: 0,
    oy: 0,
    budget: level.budget,
  });
  const cost = useMemo(() => beams.reduce((s, b) => s + beamCost(b), 0), [beams]);

  // Työkalurivi varaa alareunan — maailma skaalataan sen yläpuolelle,
  // jottei maanpinnan pisteitä jää nappien alle
  const TOOLBAR_H = 64;
  const scale = Math.min(winW / level.worldW, (winH - TOOLBAR_H) / level.worldH);
  const ox = (winW - level.worldW * scale) / 2;
  const oy = (winH - TOOLBAR_H - level.worldH * scale) / 2;
  stateRef.current = { level, beams, tool, phase, vehicle, windIdx, quakeOn, loadIdx, scale, ox, oy, budget: level.budget };
  const costRef = useRef(cost);
  costRef.current = cost;

  const sx = (x: number) => ox + x * scale;
  const sy = (y: number) => oy + y * scale;

  // Kentän vaihtuessa nollataan rakennelma
  useEffect(() => {
    setBeams([]);
    setPhase('build');
    setDrag(null);
    setVehicle(level.vehicle);
    setTool(level.mode === 'tower' ? 'steel' : 'road');
    stopLoop();
    engineRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.id]);

  useEffect(() => () => stopLoop(), []);

  function stopLoop() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const startTest = useCallback(() => {
    const st = stateRef.current;
    const engine = buildEngine(st.level, st.beams);
    if (st.level.mode !== 'tower') {
      spawnVehicle(engine, st.vehicle, st.level.leftEdge - 0.8, st.level.deckY);
    } else {
      // Perustuksen leveysvaatimus: maatason solmujen jänne
      if (st.level.minWidth != null) {
        let minX = Infinity;
        let maxX = -Infinity;
        for (const b of st.beams) {
          for (const [x, y] of [
            [b.ax, b.ay],
            [b.bx, b.by],
          ] as const) {
            if (y === st.level.deckY) {
              minX = Math.min(minX, x);
              maxX = Math.max(maxX, x);
            }
          }
        }
        if (maxX - minX < st.level.minWidth) {
          setFailReason(
            `Perustus on liian kapea: vaaditaan vähintään ${st.level.minWidth} m leveä tukipinta maassa.`
          );
          setPhase('failed');
          phaseRef.current = 'failed';
          return;
        }
      }
      // Tornitestikentässä kuormitukset tulevat säätimistä
      let effLoad = st.level.towerLoad ?? 0;
      if (st.level.sandbox) {
        engine.wind = TOWER_WINDS[st.windIdx].spec;
        engine.quake = st.quakeOn ? { amp: 0.13, freq: 2.2, start: 4 } : undefined;
        effLoad = TOWER_LOADS[st.loadIdx];
      }
      topIdxRef.current = engine.attachTopLoad(effLoad);
      topX0Ref.current = topIdxRef.current != null ? engine.nodes[topIdxRef.current].x : 0;
      loadKgRef.current = effLoad;
    }
    engineRef.current = engine;
    progressRef.current = { maxX: -Infinity, at: 0 };
    brokenSeenRef.current = new Set();
    burstsRef.current = [];
    wonTimeRef.current = null;
    setFailReason('');
    setPhase('test');
    phaseRef.current = 'test';

    const loop = () => {
      const eng = engineRef.current;
      if (!eng) return;
      eng.step();

      // Kerää uudet murtumat kipinätehosteita varten
      eng.beams.forEach((b, i) => {
        if (b.broken && !brokenSeenRef.current.has(i)) {
          brokenSeenRef.current.add(i);
          const na = eng.nodes[b.a];
          const nb = eng.nodes[b.b];
          burstsRef.current.push({ x: (na.x + nb.x) / 2, y: (na.y + nb.y) / 2, t0: eng.time });
          if (burstsRef.current.length > 14) burstsRef.current.shift();
        }
      });

      if (phaseRef.current === 'test' && stateRef.current.level.mode === 'tower') {
        // Torni: pysyttävä tavoitekorkeuden yllä kentän keston ajan
        const lvl = stateRef.current.level;
        const top = eng.structureMinY();
        const sway =
          topIdxRef.current != null ? Math.abs(eng.nodes[topIdxRef.current].x - topX0Ref.current) : 0;
        if (eng.time > 1.5 && top > (lvl.targetY ?? 0) + 0.3) {
          setFailReason('Torni painui alle tavoitekorkeuden!');
          setPhase('failed');
          phaseRef.current = 'failed';
        } else if (sway > (lvl.swayLimit ?? 1.5)) {
          setFailReason('Torni huojui liikaa!');
          setPhase('failed');
          phaseRef.current = 'failed';
        } else if (eng.time >= (lvl.duration ?? 20)) {
          const ratio = costRef.current / lvl.budget;
          const s = ratio <= 0.7 ? 3 : ratio <= 0.9 ? 2 : 1;
          wonTimeRef.current = eng.time;
          setStars(s);
          setPhase('won');
          phaseRef.current = 'won';
          onComplete(lvl.id, s);
        }
      } else if (phaseRef.current === 'test') {
        const lvl = stateRef.current.level;
        if (eng.vehicleMinX() > lvl.rightEdge + 0.3) {
          const ratio = costRef.current / lvl.budget;
          const s = ratio <= 0.7 ? 3 : ratio <= 0.9 ? 2 : 1;
          wonTimeRef.current = eng.time;
          setStars(s);
          setPhase('won');
          phaseRef.current = 'won';
          onComplete(lvl.id, s);
        } else if (eng.vehicleMaxY() > lvl.failY) {
          setFailReason('Ajoneuvo putosi!');
          setPhase('failed');
          phaseRef.current = 'failed';
        } else if (eng.time > TIME_LIMIT) {
          setFailReason('Aika loppui.');
          setPhase('failed');
          phaseRef.current = 'failed';
        } else {
          // Jumiutumisen tunnistus: ei etenemistä 6 sekuntiin
          const maxX = eng.vehicleMaxX();
          const pr = progressRef.current;
          if (maxX > pr.maxX + 0.05) {
            progressRef.current = { maxX, at: eng.time };
          } else if (eng.time - pr.at > 6 && eng.time > 3) {
            setFailReason('Ajoneuvo jäi jumiin.');
            setPhase('failed');
            phaseRef.current = 'failed';
          }
        }
      }

      setTick((t) => t + 1);
      // Romahdus jää näkyviin: simulaatio jatkuu myös voiton/häviön jälkeen
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [onComplete]);

  const backToBuild = useCallback(() => {
    stopLoop();
    engineRef.current = null;
    setPhase('build');
    phaseRef.current = 'build';
  }, []);

  // --- Rakentelun kosketuskäsittely ---
  const dragRef = useRef<{ x0: number; y0: number } | null>(null);
  const flashRef = useRef(false);

  /**
   * Tie voidaan vetää minkä pituisena tahansa, kunhan veto kulkee
   * ruudukkopisteiden kautta: se jaetaan paloihin joka pisteen kohdalta.
   * Palauttaa reitin pisteet tai null, jos veto ei ole mahdollinen.
   */
  function roadPath(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] | null {
    const st = stateRef.current;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const g = gcd(Math.abs(dx), Math.abs(dy));
    if (g === 0) return null;
    const stepLen = Math.hypot(dx / g, dy / g);
    if (stepLen < 0.99 || stepLen > MAX_BEAM_LEN) return null;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= g; i++) {
      const x = x0 + (dx / g) * i;
      const y = y0 + (dy / g) * i;
      if (!isValidPoint(st.level, x, y)) return null;
      pts.push({ x, y });
    }
    return pts;
  }

  /** Tievedon uudet (ei-päällekkäiset) palat */
  function roadSegments(pts: { x: number; y: number }[]): BuildBeam[] {
    const st = stateRef.current;
    const out: BuildBeam[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      if (!hasBeam(st.beams, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)) {
        out.push({
          id: 0,
          ax: pts[i].x,
          ay: pts[i].y,
          bx: pts[i + 1].x,
          by: pts[i + 1].y,
          material: 'road',
        });
      }
    }
    return out;
  }

  /**
   * Tarttumispiste sormen kohdalle: ankkurit ja olemassa olevat solmut
   * vetävät puoleensa laajemmalla säteellä kuin tyhjät ruudukkopisteet,
   * jottei palkin pää jää vahingossa ankkurin viereen ilmaan.
   */
  function snapPoint(wx: number, wy: number): { x: number; y: number } | null {
    const st = stateRef.current;
    const magnets: { x: number; y: number }[] = [...st.level.anchors];
    for (const b of st.beams) {
      magnets.push({ x: b.ax, y: b.ay }, { x: b.bx, y: b.by });
    }
    let best: { x: number; y: number } | null = null;
    let bestD = 0.8;
    for (const m of magnets) {
      const d = Math.hypot(wx - m.x, wy - m.y);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    if (best) return best;
    const gx = Math.round(wx);
    const gy = Math.round(wy);
    if (Math.hypot(wx - gx, wy - gy) > 0.48) return null;
    if (!isValidPoint(st.level, gx, gy)) return null;
    return { x: gx, y: gy };
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => stateRef.current.phase === 'build',
      onMoveShouldSetPanResponder: () => stateRef.current.phase === 'build',
      onPanResponderGrant: (evt) => {
        const st = stateRef.current;
        const wx = (evt.nativeEvent.pageX - st.ox) / st.scale;
        const wy = (evt.nativeEvent.pageY - st.oy) / st.scale;
        if (st.tool === 'delete') {
          deleteNearestBeam(wx, wy);
          return;
        }
        const p = snapPoint(wx, wy);
        if (!p) return;
        dragRef.current = { x0: p.x, y0: p.y };
        setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, valid: false });
      },
      onPanResponderMove: (evt) => {
        const start = dragRef.current;
        if (!start) return;
        const st = stateRef.current;
        const wx = (evt.nativeEvent.pageX - st.ox) / st.scale;
        const wy = (evt.nativeEvent.pageY - st.oy) / st.scale;
        const p = snapPoint(wx, wy) ?? { x: Math.round(wx), y: Math.round(wy) };
        const len = Math.hypot(p.x - start.x0, p.y - start.y0);
        const totalCost = st.beams.reduce((s, b) => s + beamCost(b), 0);
        // Torneissa vaijerin saa vetää pitkänä haruksena — ketju ei jäykistä
        const maxLen = st.tool === 'cable' && st.level.mode === 'tower' ? 6 : MAX_BEAM_LEN;
        let valid: boolean;
        let price: number;
        if (st.tool === 'road') {
          // Tie: rajaton pituus ruudukkopisteiden kautta, jaetaan paloihin
          const pts = roadPath(start.x0, start.y0, p.x, p.y);
          const segs = pts ? roadSegments(pts) : [];
          price = segs.reduce((s, b) => s + beamCost(b), 0);
          valid = segs.length > 0 && totalCost + price <= st.budget;
        } else {
          // Budjetin ylittävää palkkia ei voi piirtää: veto näkyy punaisena
          price = Math.round(len * MATERIALS[st.tool as MaterialId].costPerM);
          valid =
            len >= 0.99 &&
            len <= maxLen &&
            isValidPoint(st.level, p.x, p.y) &&
            !hasBeam(st.beams, start.x0, start.y0, p.x, p.y) &&
            totalCost + price <= st.budget;
        }
        if (totalCost + price > st.budget && !flashRef.current) {
          flashRef.current = true;
          setBudgetFlash(true);
          setTimeout(() => {
            flashRef.current = false;
            setBudgetFlash(false);
          }, 900);
        }
        setDrag({ x0: start.x0, y0: start.y0, x1: p.x, y1: p.y, valid });
      },
      onPanResponderRelease: () => {
        const start = dragRef.current;
        dragRef.current = null;
        setDrag((d) => {
          if (d && start && d.valid) addBeam(d.x0, d.y0, d.x1, d.y1);
          return null;
        });
      },
      onPanResponderTerminate: () => {
        dragRef.current = null;
        setDrag(null);
      },
    })
  ).current;

  function hasBeam(list: BuildBeam[], ax: number, ay: number, bx: number, by: number): boolean {
    return list.some(
      (b) =>
        (b.ax === ax && b.ay === ay && b.bx === bx && b.by === by) ||
        (b.ax === bx && b.ay === by && b.bx === ax && b.by === ay)
    );
  }

  function addBeam(ax: number, ay: number, bx: number, by: number) {
    const st = stateRef.current;
    const material = st.tool as MaterialId;
    let added: BuildBeam[];
    if (material === 'road') {
      const pts = roadPath(ax, ay, bx, by);
      if (!pts) return;
      added = roadSegments(pts).map((b) => ({ ...b, id: nextBeamId.current++ }));
    } else {
      added = [{ id: nextBeamId.current++, ax, ay, bx, by, material }];
    }
    if (added.length === 0) return;
    const newCost = costRef.current + added.reduce((s, b) => s + beamCost(b), 0);
    if (newCost > st.budget) {
      setBudgetFlash(true);
      setTimeout(() => setBudgetFlash(false), 700);
      return;
    }
    // Jaa 2 m:n palkit kahtia liitosten kohdalta, jotta kiinnitys on aito
    setBeams((prev) =>
      splitBeamsAtJoints(st.level, [...prev, ...added], () => nextBeamId.current++)
    );
  }

  function deleteNearestBeam(wx: number, wy: number) {
    setBeams((prev) => {
      let bestIdx = -1;
      let bestDist = 0.4;
      prev.forEach((b, i) => {
        const abx = b.bx - b.ax;
        const aby = b.by - b.ay;
        const len2 = abx * abx + aby * aby;
        let t = len2 > 0 ? ((wx - b.ax) * abx + (wy - b.ay) * aby) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const d = Math.hypot(wx - (b.ax + abx * t), wy - (b.ay + aby * t));
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      });
      if (bestIdx < 0) return prev;
      return prev.filter((_, i) => i !== bestIdx);
    });
  }

  // --- Piirto ---

  const gridDots = useMemo(() => {
    const dots: { x: number; y: number; ground: boolean }[] = [];
    for (let x = 1; x <= level.worldW - 1; x++) {
      for (let y = level.buildTop ?? 1; y <= (level.buildBottom ?? 7); y++) {
        if (isValidPoint(level, x, y)) {
          dots.push({ x, y, ground: isTerrainPoint(level.terrain, x, y) });
        }
      }
    }
    return dots;
  }, [level]);

  const terrainRects = useMemo(
    () =>
      level.terrain.map((box, i) => {
        const x0 = Math.max(box.minX, -0.5);
        const x1 = Math.min(box.maxX, level.worldW + 0.5);
        const y1 = Math.min(box.maxY, level.worldH + 0.5);
        return { i, x0, x1, y0: box.minY, y1 };
      }),
    [level]
  );

  const engine = engineRef.current;
  const testing = phase !== 'build' && engine !== null;
  const info = vehicleInfo(vehicle);
  const brokenCount = testing ? engine!.beams.filter((b) => b.broken).length : 0;
  const theme = THEMES[level.theme];
  /** Animaatioaika koristeille (vain testissä liikkuvat) */
  const animT = testing ? engine!.time : 0;

  // Kuusimetsäsiluetit horisontissa: kaukainen tiheä rivi ja lähempi rivi
  const trees = useMemo(() => {
    const base = level.deckY + 0.02;
    const mkRow = (seed: number, hMin: number, hMax: number, step: number) => {
      const arr: { x: number; y: number; h: number; w: number }[] = [];
      for (let x = -0.3; x < level.worldW + 0.3; x += step * (0.7 + 0.6 * rnd01(seed + x * 7))) {
        const h = hMin + (hMax - hMin) * rnd01(seed + x * 13);
        arr.push({ x, y: base, h, w: h * 0.6 });
      }
      return arr;
    };
    return { far: mkRow(23, 0.55, 0.95, 0.55), near: mkRow(71, 0.85, 1.5, 0.8) };
  }, [level]);

  const nightStars = useMemo(() => {
    const arr: { x: number; y: number; r: number; o: number }[] = [];
    for (let i = 0; i < 42; i++) {
      arr.push({
        x: rnd01(i * 3 + 1) * level.worldW,
        y: rnd01(i * 5 + 2) * (level.deckY - 1.6),
        r: 0.8 + rnd01(i * 7 + 3) * 1.2,
        o: 0.35 + rnd01(i * 11 + 4) * 0.55,
      });
    }
    return arr;
  }, [level]);

  const treePoly = (t: { x: number; y: number; h: number; w: number }) =>
    `${sx(t.x - t.w / 2)},${sy(t.y)} ${sx(t.x)},${sy(t.y - t.h)} ${sx(t.x + t.w / 2)},${sy(t.y)}`;

  const buildNodes = useMemo(() => {
    const map = new Map<string, { x: number; y: number; degree: number }>();
    for (const b of beams) {
      for (const [x, y] of [
        [b.ax, b.ay],
        [b.bx, b.by],
      ] as const) {
        const k = `${x},${y}`;
        const n = map.get(k);
        if (n) n.degree++;
        else map.set(k, { x, y, degree: 1 });
      }
    }
    return [...map.values()];
  }, [beams]);

  const isAnchoredPoint = useCallback(
    (x: number, y: number) =>
      level.anchors.some((a) => a.x === x && a.y === y) || isTerrainPoint(level.terrain, x, y),
    [level]
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={[theme.skyTop, theme.skyBottom]} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        <Svg width={winW} height={winH}>
          {/* Tähdet ja kuu (yö) */}
          {theme.stars && (
            <G>
              {nightStars.map((s, i) => (
                <Circle key={i} cx={sx(s.x)} cy={sy(s.y)} r={s.r} fill="#e8f0f8" opacity={s.o} />
              ))}
              <Circle cx={sx(level.worldW - 2.2)} cy={sy(1.2)} r={0.65 * scale} fill="#dfe6d4" opacity={0.25} />
              <Circle cx={sx(level.worldW - 2.2)} cy={sy(1.2)} r={0.45 * scale} fill="#e9edda" />
            </G>
          )}

          {/* Utuinen laakso horisontin alapuolella — rotkon takana ei näy taivasta */}
          <Rect
            x={sx(-0.5)}
            y={sy(level.deckY)}
            width={(level.worldW + 1) * scale}
            height={(level.worldH - level.deckY + 0.5) * scale}
            fill={theme.valley}
          />
          <Rect
            x={sx(-0.5)}
            y={sy(level.deckY + 1.2)}
            width={(level.worldW + 1) * scale}
            height={(level.worldH - level.deckY - 0.7) * scale}
            fill={theme.valley}
            opacity={0.6}
          />

          {/* Kuusimetsä horisontissa */}
          <G>
            {trees.far.map((t, i) => (
              <Polygon key={`f${i}`} points={treePoly(t)} fill={theme.treeFar} />
            ))}
            {trees.near.map((t, i) => (
              <Polygon key={`n${i}`} points={treePoly(t)} fill={theme.treeNear} />
            ))}
          </G>

          {/* Pilvet (ajelehtivat testin aikana) */}
          {theme.clouds &&
            [0, 1, 2].map((i) => {
              const cw = level.worldW + 8;
              const cx0 = ((rnd01(i * 13 + 5) * cw + animT * 0.18) % cw) - 4;
              const cy0 = 0.7 + i * 0.55;
              return (
                <G key={i} opacity={0.9}>
                  <Ellipse cx={sx(cx0)} cy={sy(cy0)} rx={0.9 * scale} ry={0.28 * scale} fill={theme.cloudColor} />
                  <Ellipse cx={sx(cx0 + 0.7)} cy={sy(cy0 + 0.12)} rx={0.7 * scale} ry={0.22 * scale} fill={theme.cloudColor} />
                  <Ellipse cx={sx(cx0 - 0.6)} cy={sy(cy0 + 0.1)} rx={0.55 * scale} ry={0.18 * scale} fill={theme.cloudColor} />
                </G>
              );
            })}

          {/* Vesi */}
          <Rect
            x={sx(-0.5)}
            y={sy(level.waterY)}
            width={(level.worldW + 1) * scale}
            height={(level.worldH - level.waterY + 0.5) * scale}
            fill={theme.water}
          />
          <Rect
            x={sx(-0.5)}
            y={sy(level.waterY)}
            width={(level.worldW + 1) * scale}
            height={0.12 * scale}
            fill={theme.waterHi}
          />
          {/* Maasto */}
          {terrainRects.map((r) => (
            <G key={r.i}>
              <Rect
                x={sx(r.x0)}
                y={sy(r.y0)}
                width={(r.x1 - r.x0) * scale}
                height={(r.y1 - r.y0) * scale}
                fill={theme.cliff}
              />
              {[1.5, 3.1, 4.7].map((d) => (
                <Rect
                  key={d}
                  x={sx(r.x0)}
                  y={sy(r.y0 + d)}
                  width={(r.x1 - r.x0) * scale}
                  height={0.22 * scale}
                  fill={theme.strata}
                />
              ))}
              <Rect
                x={sx(r.x0)}
                y={sy(r.y0)}
                width={(r.x1 - r.x0) * scale}
                height={0.18 * scale}
                fill={theme.edge}
              />
            </G>
          ))}
          {/* Maali­lippu oikealla kalliolla (siltakentät) */}
          {level.mode !== 'tower' && (
            <G>
              <Line
                x1={sx(level.rightEdge + 1.5)}
                y1={sy(level.deckY)}
                x2={sx(level.rightEdge + 1.5)}
                y2={sy(level.deckY - 0.9)}
                stroke="#333"
                strokeWidth={2}
              />
              <Polygon
                points={`${sx(level.rightEdge + 1.5)},${sy(level.deckY - 0.9)} ${sx(
                  level.rightEdge + 2.1
                )},${sy(level.deckY - 0.72)} ${sx(level.rightEdge + 1.5)},${sy(level.deckY - 0.54)}`}
                fill="#d8483b"
              />
            </G>
          )}

          {/* Tornin tavoitekorkeus */}
          {level.mode === 'tower' && level.targetY != null && (
            <G>
              <Line
                x1={sx(0)}
                y1={sy(level.targetY)}
                x2={sx(level.worldW)}
                y2={sy(level.targetY)}
                stroke="#d8483b"
                strokeWidth={2}
                strokeDasharray="8,6"
                opacity={0.8}
              />
              <Polygon
                points={`${sx(0.4)},${sy(level.targetY)} ${sx(1.0)},${sy(level.targetY + 0.18)} ${sx(
                  0.4
                )},${sy(level.targetY + 0.36)}`}
                fill="#d8483b"
              />
              {/* Tontin rajat */}
              {level.lot && phase === 'build' && (
                <G opacity={0.5}>
                  <Line
                    x1={sx(level.lot[0])}
                    y1={sy(level.buildTop ?? 1)}
                    x2={sx(level.lot[0])}
                    y2={sy(level.deckY)}
                    stroke={theme.gridDot}
                    strokeWidth={1.5}
                    strokeDasharray="3,5"
                  />
                  <Line
                    x1={sx(level.lot[1])}
                    y1={sy(level.buildTop ?? 1)}
                    x2={sx(level.lot[1])}
                    y2={sy(level.deckY)}
                    stroke={theme.gridDot}
                    strokeWidth={1.5}
                    strokeDasharray="3,5"
                  />
                </G>
              )}
            </G>
          )}

          {/* Ruudukko rakennustilassa */}
          {phase === 'build' && (
            <G>
              {gridDots.map((d) =>
                // eslint-disable-next-line no-nested-ternary
                d.ground ? (
                  // Maanpinnan piste: kallioankkuri, johon rakenteen voi kiinnittää
                  <Circle
                    key={`${d.x},${d.y}`}
                    cx={sx(d.x)}
                    cy={sy(d.y)}
                    r={0.08 * scale}
                    fill="rgba(40,69,94,0.35)"
                    stroke="rgba(40,69,94,0.7)"
                    strokeWidth={1.5}
                  />
                ) : (
                  <Circle
                    key={`${d.x},${d.y}`}
                    cx={sx(d.x)}
                    cy={sy(d.y)}
                    r={2.5}
                    fill={theme.gridDot}
                  />
                )
              )}
            </G>
          )}

          {/* Haamukuva: rakennettu geometria testin aikana vertailua varten */}
          {testing && (
            <G>
              {beams.map((b) => (
                <Line
                  key={`ghost-${b.id}`}
                  x1={sx(b.ax)}
                  y1={sy(b.ay)}
                  x2={sx(b.bx)}
                  y2={sy(b.by)}
                  stroke={theme.ghost}
                  strokeWidth={1.5}
                  strokeDasharray="4,4"
                />
              ))}
            </G>
          )}

          {/* Palkit */}
          {!testing &&
            beams.map((b) => {
              const mat = MATERIALS[b.material];
              return (
                <Line
                  key={b.id}
                  x1={sx(b.ax)}
                  y1={sy(b.ay)}
                  x2={sx(b.bx)}
                  y2={sy(b.by)}
                  stroke={mat.color}
                  strokeWidth={Math.max(2, mat.width * scale)}
                  strokeLinecap="round"
                />
              );
            })}
          {testing &&
            engine!.beams.map((beam, i) => {
              const na = engine!.nodes[beam.a];
              const nb = engine!.nodes[beam.b];
              const w = Math.max(2, beam.mat.width * scale);
              if (beam.broken) {
                // Murtunut palkki: punaiset tyngät, jotta murtuma erottuu selvästi
                const dx = nb.x - na.x;
                const dy = nb.y - na.y;
                const len = Math.hypot(dx, dy) || 1;
                const s = (beam.restLen * 0.28) / len;
                return (
                  <G key={i} opacity={0.85}>
                    <Line
                      x1={sx(na.x)}
                      y1={sy(na.y)}
                      x2={sx(na.x + dx * s)}
                      y2={sy(na.y + dy * s)}
                      stroke="#c0392b"
                      strokeWidth={w}
                      strokeLinecap="round"
                    />
                    <Line
                      x1={sx(nb.x)}
                      y1={sy(nb.y)}
                      x2={sx(nb.x - dx * s)}
                      y2={sy(nb.y - dy * s)}
                      stroke="#c0392b"
                      strokeWidth={w}
                      strokeLinecap="round"
                    />
                  </G>
                );
              }
              // Löysä vaijeri ei kanna kuormaa: piirretään haaleana
              const slack = beam.mat.tensionOnly && beam.strain <= 0;
              return (
                <Line
                  key={i}
                  x1={sx(na.x)}
                  y1={sy(na.y)}
                  x2={sx(nb.x)}
                  y2={sy(nb.y)}
                  stroke={slack ? beam.mat.color : stressColor(beam.stress, beam.strain < 0)}
                  strokeWidth={w}
                  strokeLinecap="round"
                  opacity={slack ? 0.35 : 1}
                />
              );
            })}

          {/* Liitossolmut (maahan ankkuroidut ankkurityylillä, irtopäät oranssilla) */}
          {!testing &&
            buildNodes.map((n) => {
              if (isAnchoredPoint(n.x, n.y)) {
                return (
                  <G key={`${n.x},${n.y}`}>
                    <Circle cx={sx(n.x)} cy={sy(n.y)} r={0.13 * scale} fill="#28455e" />
                    <Circle cx={sx(n.x)} cy={sy(n.y)} r={0.06 * scale} fill="#7fb2d9" />
                  </G>
                );
              }
              if (n.degree === 1) {
                // Vain yksi palkki kiinni: pää roikkuu vapaana testissä
                return (
                  <G key={`${n.x},${n.y}`}>
                    <Circle cx={sx(n.x)} cy={sy(n.y)} r={0.12 * scale} fill="#e08a2e" opacity={0.5} />
                    <Circle cx={sx(n.x)} cy={sy(n.y)} r={0.07 * scale} fill="#c96f14" />
                  </G>
                );
              }
              return <Circle key={`${n.x},${n.y}`} cx={sx(n.x)} cy={sy(n.y)} r={0.07 * scale} fill="#2f3a45" />;
            })}
          {testing &&
            engine!.nodes.map((n, i) => {
              if (n.vehicle) return null;
              if (n.fixed) {
                return (
                  <G key={i}>
                    <Circle cx={sx(n.x)} cy={sy(n.y)} r={0.13 * scale} fill="#28455e" />
                    <Circle cx={sx(n.x)} cy={sy(n.y)} r={0.06 * scale} fill="#7fb2d9" />
                  </G>
                );
              }
              return <Circle key={i} cx={sx(n.x)} cy={sy(n.y)} r={0.07 * scale} fill="#2f3a45" />;
            })}

          {/* Ankkurit */}
          {level.anchors.map((a) => (
            <G key={`${a.x},${a.y}`}>
              <Circle cx={sx(a.x)} cy={sy(a.y)} r={0.16 * scale} fill="#28455e" />
              <Circle cx={sx(a.x)} cy={sy(a.y)} r={0.08 * scale} fill="#7fb2d9" />
            </G>
          ))}

          {/* Vetopreview */}
          {drag && (
            <G>
              <Line
                x1={sx(drag.x0)}
                y1={sy(drag.y0)}
                x2={sx(drag.x1)}
                y2={sy(drag.y1)}
                stroke={drag.valid ? '#2e9e4f' : '#d8483b'}
                strokeWidth={3}
                strokeDasharray="6,5"
              />
              <Circle cx={sx(drag.x1)} cy={sy(drag.y1)} r={5} fill={drag.valid ? '#2e9e4f' : '#d8483b'} />
            </G>
          )}

          {/* Ajoneuvo */}
          {testing &&
            engine!.segments.map((seg, i) => {
              const cR = engine!.nodes[seg.chassis[0]];
              const cF = engine!.nodes[seg.chassis[1]];
              const wF = engine!.nodes[seg.wheels[0]];
              const wR = engine!.nodes[seg.wheels[seg.wheels.length - 1]];
              // Ajovalot yökentillä
              let headlight = null;
              if (theme.stars && i === 0) {
                const dx = cF.x - cR.x;
                const dy = cF.y - cR.y;
                const dl = Math.hypot(dx, dy) || 1;
                const ux = dx / dl;
                const uy = dy / dl;
                const tipX = cF.x + ux * 2.6;
                const tipY = cF.y + uy * 2.6;
                headlight = (
                  <G>
                    <Polygon
                      points={`${sx(cF.x)},${sy(cF.y)} ${sx(tipX - uy * 0.7)},${sy(tipY + ux * 0.7)} ${sx(
                        tipX + uy * 0.7
                      )},${sy(tipY - ux * 0.7)}`}
                      fill="rgba(255,226,140,0.22)"
                    />
                    <Circle cx={sx(cF.x)} cy={sy(cF.y)} r={0.1 * scale} fill="#ffe28c" />
                  </G>
                );
              }
              return (
                <G key={i}>
                  {headlight}
                  <Polygon
                    points={`${sx(cR.x)},${sy(cR.y)} ${sx(cF.x)},${sy(cF.y)} ${sx(wF.x)},${sy(wF.y)} ${sx(
                      wR.x
                    )},${sy(wR.y)}`}
                    fill={seg.color}
                    stroke="#2b2b2b"
                    strokeWidth={1}
                  />
                  {seg.kind === 'loco' && (
                    <Circle cx={sx(cF.x)} cy={sy(cF.y)} r={0.12 * scale} fill="#ffd76b" />
                  )}
                  {seg.wheels.map((wi) => {
                    const w = engine!.nodes[wi];
                    return (
                      <G key={wi}>
                        <Circle cx={sx(w.x)} cy={sy(w.y)} r={w.radius * scale} fill="#23272c" />
                        <Circle cx={sx(w.x)} cy={sy(w.y)} r={w.radius * 0.45 * scale} fill="#5a6470" />
                      </G>
                    );
                  })}
                </G>
              );
            })}

          {/* Tornin huippukuorma */}
          {testing && level.mode === 'tower' && topIdxRef.current != null && loadKgRef.current > 0 && (
            <G>
              {(() => {
                const n = engine!.nodes[topIdxRef.current!];
                return (
                  <G>
                    <Rect
                      x={sx(n.x - 0.4)}
                      y={sy(n.y - 0.62)}
                      width={0.8 * scale}
                      height={0.55 * scale}
                      rx={3}
                      fill="#c9963d"
                      stroke="#2b2b2b"
                      strokeWidth={1}
                    />
                    <Line
                      x1={sx(n.x)}
                      y1={sy(n.y - 0.62)}
                      x2={sx(n.x)}
                      y2={sy(n.y - 1.05)}
                      stroke="#2b2b2b"
                      strokeWidth={1.5}
                    />
                    <Circle cx={sx(n.x)} cy={sy(n.y - 1.05)} r={2.5} fill="#d8483b" />
                  </G>
                );
              })()}
            </G>
          )}

          {/* Lumisade (talvi) */}
          {theme.snow && (
            <G>
              {Array.from({ length: 42 }, (_, i) => {
                const fx =
                  ((rnd01(i) * (level.worldW + 1) + animT * (0.25 + 0.2 * (i % 3))) %
                    (level.worldW + 1)) -
                  0.5;
                const fy = (rnd01(i + 99) * level.worldH + animT * (0.7 + 0.3 * rnd01(i + 7))) % level.worldH;
                return (
                  <Circle
                    key={i}
                    cx={sx(fx)}
                    cy={sy(fy)}
                    r={1.4 + (i % 3) * 0.7}
                    fill="#ffffff"
                    opacity={0.75}
                  />
                );
              })}
            </G>
          )}

          {/* Murtumakipinät */}
          {testing &&
            burstsRef.current.map((b, bi) => {
              const age = engine!.time - b.t0;
              if (age < 0 || age > 0.7) return null;
              return (
                <G key={bi} opacity={1 - age / 0.7}>
                  {Array.from({ length: 8 }, (_, k) => {
                    const ang = (k * Math.PI) / 4 + rnd01(k + bi * 17) * 0.5;
                    const rr = 0.12 + age * 2.2;
                    return (
                      <Circle
                        key={k}
                        cx={sx(b.x + Math.cos(ang) * rr)}
                        cy={sy(b.y + Math.sin(ang) * rr * 0.8 + age * age * 2.5)}
                        r={2.2}
                        fill="#ffb347"
                      />
                    );
                  })}
                </G>
              );
            })}

          {/* Voittokonfetit */}
          {phase === 'won' && testing && wonTimeRef.current !== null && (
            <G>
              {Array.from({ length: 40 }, (_, i) => {
                const t = engine!.time - wonTimeRef.current!;
                const o = Math.max(0, 1.15 - t / 2.4);
                if (o <= 0) return null;
                const x0 = level.worldW / 2 + (rnd01(i) - 0.5) * 6;
                const vy0 = -(2.2 + 3 * rnd01(i + 50));
                const vx = (rnd01(i + 13) - 0.5) * 4;
                const cx0 = x0 + vx * t;
                const cy0 = level.deckY - 2.6 + vy0 * t + 0.5 * 3.4 * t * t;
                return (
                  <Rect
                    key={i}
                    x={sx(cx0)}
                    y={sy(cy0)}
                    width={5}
                    height={3.5}
                    fill={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
                    opacity={o}
                  />
                );
              })}
            </G>
          )}
        </Svg>
      </View>

      {/* Yläpalkki */}
      <View style={styles.topBar} pointerEvents="box-none">
        <TouchableOpacity style={styles.btn} onPress={onExit}>
          <Text style={styles.btnText}>‹ Kentät</Text>
        </TouchableOpacity>
        <View style={styles.titleBox}>
          <Text style={[styles.title, { color: theme.text }]}>
            {level.sandbox
              ? level.name
              : level.mode === 'tower'
                ? `${level.id - 100}. ${level.name}`
                : `${level.id}. ${level.name}`}
          </Text>
          <Text style={[styles.subtitle, { color: theme.text, opacity: 0.8 }]}>
            {level.mode === 'tower'
              ? `🏗 Tavoite ${level.deckY - (level.targetY ?? 0)} m · ${level.duration} s${(level.towerLoad ?? 0) > 0 ? ` · 📦 ${level.towerLoad} kg` : ''}${level.quake ? ' · 〰 järistys' : ''}${(level.wind?.gust ?? 0) > 300 ? ' · 🌬 myrsky' : ''}`
              : `${info.emoji} ${info.name} · ${(info.totalMass / 1000).toFixed(1).replace('.', ',')} t${
                  level.driveFactor != null && level.driveFactor < 1 ? ' · ❄ jäinen kansi' : ''
                }`}
          </Text>
        </View>
        <Text style={[styles.budget, budgetFlash && styles.budgetOver]}>
          {level.sandbox
            ? `${cost.toLocaleString('fi-FI')} € · vapaa budjetti`
            : `${cost.toLocaleString('fi-FI')} € / ${level.budget.toLocaleString('fi-FI')} €`}
        </Text>
        {phase === 'build' ? (
          <TouchableOpacity style={[styles.btn, styles.btnGo]} onPress={startTest}>
            <Text style={styles.btnText}>▶ Testaa</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.btn, styles.btnStop]} onPress={backToBuild}>
            <Text style={styles.btnText}>◼ Rakenna</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Työkalurivi */}
      {phase === 'build' && (
        <View style={styles.toolBar} pointerEvents="box-none">
          {((level.mode === 'tower'
            ? ['wood', 'steel', 'cable']
            : ['road', 'wood', 'steel', 'cable']) as MaterialId[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.tool, tool === m && styles.toolActive]}
              onPress={() => setTool(m)}
            >
              <View style={[styles.swatch, { backgroundColor: MATERIALS[m].color }]} />
              <Text style={styles.toolText}>{MATERIALS[m].name}</Text>
              <Text style={styles.toolCost}>{MATERIALS[m].costPerM} €/m</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.tool, tool === 'delete' && styles.toolDeleteActive]}
            onPress={() => setTool('delete')}
          >
            <Text style={styles.toolText}>✕ Poista</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tool} onPress={() => setBeams([])}>
            <Text style={styles.toolText}>Tyhjennä</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tornitestikentän säätimet */}
      {phase === 'build' && level.sandbox && level.mode === 'tower' && (
        <>
          <View style={[styles.vehBar, { bottom: 92 }]} pointerEvents="box-none">
            {TOWER_WINDS.map((w, i) => (
              <TouchableOpacity
                key={w.label}
                style={[styles.tool, windIdx === i && styles.toolActive]}
                onPress={() => setWindIdx(i)}
              >
                <Text style={styles.toolText}>{w.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.vehBar} pointerEvents="box-none">
            {TOWER_LOADS.map((kg, i) => (
              <TouchableOpacity
                key={kg}
                style={[styles.tool, loadIdx === i && styles.toolActive]}
                onPress={() => setLoadIdx(i)}
              >
                <Text style={styles.toolText}>📦 {kg === 0 ? 'ei kuormaa' : `${kg} kg`}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.tool, quakeOn && styles.toolDeleteActive]}
              onPress={() => setQuakeOn((q) => !q)}
            >
              <Text style={styles.toolText}>〰 Järistys {quakeOn ? 'päällä' : 'pois'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Hiekkalaatikon ajoneuvovalitsin */}
      {phase === 'build' && level.sandbox && level.mode !== 'tower' && (
        <View style={styles.vehBar} pointerEvents="box-none">
          {SANDBOX_VEHICLES.map((v) => {
            const vi = vehicleInfo(v);
            return (
              <TouchableOpacity
                key={v}
                style={[styles.tool, vehicle === v && styles.toolActive]}
                onPress={() => setVehicle(v)}
              >
                <Text style={styles.toolText}>
                  {vi.emoji} {(vi.totalMass / 1000).toFixed(1).replace('.', ',')} t
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {phase === 'build' && level.hint != null && (
        <Text
          style={[
            styles.hint,
            level.sandbox && styles.hintHigh,
            level.sandbox && level.mode === 'tower' && styles.hintHigher,
          ]}
        >
          💡 {level.hint}
        </Text>
      )}
      {phase === 'test' && level.mode === 'tower' && engine && (
        <Text style={styles.hint}>
          ⏱ {Math.max(0, Math.ceil((level.duration ?? 20) - engine.time))} s · tuuli{' '}
          {(engine.currentWind < 0 ? '←' : '→').repeat(
            Math.min(5, 1 + Math.floor(Math.abs(engine.currentWind) / 150))
          )}{' '}
          {Math.round(Math.abs(engine.currentWind))} N/m
        </Text>
      )}
      {phase === 'test' && level.mode !== 'tower' && (
        <Text style={styles.hint}>
          Vihreä = kevyt kuorma · punainen = veto murtumassa · violetti = puristus murtumassa
        </Text>
      )}

      {/* Lopputulokset */}
      {phase === 'won' && (
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {level.mode === 'tower' ? 'Torni kesti! 🎉' : 'Silta kesti! 🎉'}
            </Text>
            {!level.sandbox && (
              <Text style={styles.cardStars}>{'★'.repeat(stars) + '☆'.repeat(3 - stars)}</Text>
            )}
            <Text style={styles.cardText}>
              {level.sandbox
                ? `Kustannus ${cost.toLocaleString('fi-FI')} €`
                : `Kustannus ${cost.toLocaleString('fi-FI')} € / ${level.budget.toLocaleString('fi-FI')} €`}
            </Text>
            <Text style={styles.cardText}>
              {brokenCount === 0
                ? 'Ei murtuneita palkkeja'
                : `Murtuneita palkkeja: ${brokenCount}`}
            </Text>
            <View style={styles.cardRow}>
              <TouchableOpacity style={styles.btn} onPress={backToBuild}>
                <Text style={styles.btnText}>
                  {level.mode === 'tower' ? 'Paranna tornia' : 'Paranna siltaa'}
                </Text>
              </TouchableOpacity>
              {hasNext && (
                <TouchableOpacity style={[styles.btn, styles.btnGo]} onPress={onNext}>
                  <Text style={styles.btnText}>Seuraava kenttä ›</Text>
                </TouchableOpacity>
              )}
              {!hasNext && (
                <TouchableOpacity style={[styles.btn, styles.btnGo]} onPress={onExit}>
                  <Text style={styles.btnText}>Kentät</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}
      {phase === 'failed' && (
        <View style={styles.overlayTop} pointerEvents="box-none">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {level.mode === 'tower' ? 'Torni sortui 💥' : 'Silta petti 💥'}
            </Text>
            <Text style={styles.cardText}>{failReason}</Text>
            {brokenCount > 0 && (
              <Text style={styles.cardText}>Murtuneita palkkeja: {brokenCount}</Text>
            )}
            <View style={styles.cardRow}>
              <TouchableOpacity style={[styles.btn, styles.btnGo]} onPress={backToBuild}>
                <Text style={styles.btnText}>
                  {level.mode === 'tower' ? 'Korjaa tornia' : 'Korjaa siltaa'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={onExit}>
                <Text style={styles.btnText}>Kentät</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#6fb0e3' },
  topBar: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleBox: { flex: 1 },
  title: { color: '#173049', fontSize: 15, fontWeight: '700' },
  subtitle: { color: '#2c4a66', fontSize: 11 },
  budget: {
    color: '#173049',
    fontSize: 14,
    fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: 'hidden',
  },
  budgetOver: { color: '#fff', backgroundColor: '#d8483b' },
  btn: {
    backgroundColor: 'rgba(23,48,73,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnGo: { backgroundColor: '#2e9e4f' },
  btnStop: { backgroundColor: '#c9963d' },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  toolBar: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  tool: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    gap: 6,
  },
  toolActive: { borderColor: '#2e9e4f' },
  toolDeleteActive: { borderColor: '#d8483b' },
  swatch: { width: 18, height: 6, borderRadius: 3 },
  toolText: { color: '#173049', fontSize: 12, fontWeight: '700' },
  toolCost: { color: '#5a7186', fontSize: 10 },
  vehBar: {
    position: 'absolute',
    bottom: 50,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  hintHigh: { bottom: 96 },
  hintHigher: { bottom: 138 },
  hint: {
    position: 'absolute',
    bottom: 52,
    alignSelf: 'center',
    color: '#173049',
    fontSize: 11,
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayTop: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#173049' },
  cardStars: { fontSize: 26, color: '#e0a92e', letterSpacing: 4 },
  cardText: { fontSize: 13, color: '#2c4a66' },
  cardRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
});
