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
import Svg, { Circle, G, Line, Polygon, Rect } from 'react-native-svg';
import { Engine, buildEngine } from './engine';
import { spawnVehicle, vehicleInfo } from './vehicles';
import {
  BuildBeam,
  LevelDef,
  MATERIALS,
  MAX_BEAM_LEN,
  MaterialId,
  TIME_LIMIT,
} from './types';

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

const BUILD_TOP = 1;
const BUILD_BOTTOM = 7;

function isValidPoint(level: LevelDef, x: number, y: number): boolean {
  if (level.anchors.some((a) => a.x === x && a.y === y)) return true;
  if (x < 1 || x > level.worldW - 1 || y < BUILD_TOP || y > BUILD_BOTTOM) return false;
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

/** Jännitysväri: vihreä → keltainen → punainen */
function stressColor(s: number): string {
  const t = Math.max(0, Math.min(1, s));
  const lerp = (a: number, b: number, k: number) => Math.round(a + (b - a) * k);
  let r: number, g: number, bl: number;
  if (t < 0.5) {
    const k = t / 0.5;
    r = lerp(0x39, 0xe6, k);
    g = lerp(0xc2, 0xc3, k);
    bl = lerp(0x5c, 0x19, k);
  } else {
    const k = (t - 0.5) / 0.5;
    r = lerp(0xe6, 0xe0, k);
    g = lerp(0xc3, 0x43, k);
    bl = lerp(0x19, 0x43, k);
  }
  return `rgb(${r},${g},${bl})`;
}

export default function GameScreen({ level, hasNext, onComplete, onNext, onExit }: Props) {
  const { width: winW, height: winH } = useWindowDimensions();
  const [beams, setBeams] = useState<BuildBeam[]>([]);
  const [tool, setTool] = useState<Tool>('road');
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

  // Ajantasaiset arvot PanResponderin käyttöön (luodaan vain kerran)
  const stateRef = useRef({ level, beams, tool, phase, scale: 1, ox: 0, oy: 0, budget: level.budget });
  const cost = useMemo(() => beams.reduce((s, b) => s + beamCost(b), 0), [beams]);

  const scale = Math.min(winW / level.worldW, winH / level.worldH);
  const ox = (winW - level.worldW * scale) / 2;
  const oy = (winH - level.worldH * scale) / 2;
  stateRef.current = { level, beams, tool, phase, scale, ox, oy, budget: level.budget };
  const costRef = useRef(cost);
  costRef.current = cost;

  const sx = (x: number) => ox + x * scale;
  const sy = (y: number) => oy + y * scale;

  // Kentän vaihtuessa nollataan rakennelma
  useEffect(() => {
    setBeams([]);
    setPhase('build');
    setDrag(null);
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
    spawnVehicle(engine, st.level.vehicle, st.level.leftEdge - 0.8, st.level.deckY);
    engineRef.current = engine;
    progressRef.current = { maxX: -Infinity, at: 0 };
    setFailReason('');
    setPhase('test');
    phaseRef.current = 'test';

    const loop = () => {
      const eng = engineRef.current;
      if (!eng) return;
      eng.step();

      if (phaseRef.current === 'test') {
        const lvl = stateRef.current.level;
        if (eng.vehicleMinX() > lvl.rightEdge + 0.3) {
          const ratio = costRef.current / lvl.budget;
          const s = ratio <= 0.7 ? 3 : ratio <= 0.9 ? 2 : 1;
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
        const gx = Math.round(wx);
        const gy = Math.round(wy);
        if (Math.hypot(wx - gx, wy - gy) > 0.48) return;
        if (!isValidPoint(st.level, gx, gy)) return;
        dragRef.current = { x0: gx, y0: gy };
        setDrag({ x0: gx, y0: gy, x1: gx, y1: gy, valid: false });
      },
      onPanResponderMove: (evt) => {
        const start = dragRef.current;
        if (!start) return;
        const st = stateRef.current;
        const wx = (evt.nativeEvent.pageX - st.ox) / st.scale;
        const wy = (evt.nativeEvent.pageY - st.oy) / st.scale;
        const gx = Math.round(wx);
        const gy = Math.round(wy);
        const len = Math.hypot(gx - start.x0, gy - start.y0);
        const valid =
          len >= 0.99 &&
          len <= MAX_BEAM_LEN &&
          isValidPoint(st.level, gx, gy) &&
          !hasBeam(st.beams, start.x0, start.y0, gx, gy);
        setDrag({ x0: start.x0, y0: start.y0, x1: gx, y1: gy, valid });
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
    const beam: BuildBeam = { id: nextBeamId.current++, ax, ay, bx, by, material };
    const newCost = costRef.current + beamCost(beam);
    if (newCost > st.budget) {
      setBudgetFlash(true);
      setTimeout(() => setBudgetFlash(false), 700);
      return;
    }
    setBeams((prev) => [...prev, beam]);
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
    const dots: { x: number; y: number }[] = [];
    for (let x = 1; x <= level.worldW - 1; x++) {
      for (let y = BUILD_TOP; y <= BUILD_BOTTOM; y++) {
        if (isValidPoint(level, x, y)) dots.push({ x, y });
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
  const info = vehicleInfo(level.vehicle);

  const buildNodes = useMemo(() => {
    const set = new Map<string, { x: number; y: number }>();
    for (const b of beams) {
      set.set(`${b.ax},${b.ay}`, { x: b.ax, y: b.ay });
      set.set(`${b.bx},${b.by}`, { x: b.bx, y: b.by });
    }
    return [...set.values()];
  }, [beams]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#6fb0e3', '#cfe8f7']} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        <Svg width={winW} height={winH}>
          {/* Vesi */}
          <Rect
            x={sx(-0.5)}
            y={sy(level.waterY)}
            width={(level.worldW + 1) * scale}
            height={(level.worldH - level.waterY + 0.5) * scale}
            fill="#2e6f9e"
          />
          <Rect
            x={sx(-0.5)}
            y={sy(level.waterY)}
            width={(level.worldW + 1) * scale}
            height={0.12 * scale}
            fill="#5b9cc7"
          />
          {/* Maasto */}
          {terrainRects.map((r) => (
            <G key={r.i}>
              <Rect
                x={sx(r.x0)}
                y={sy(r.y0)}
                width={(r.x1 - r.x0) * scale}
                height={(r.y1 - r.y0) * scale}
                fill="#6b5340"
              />
              <Rect
                x={sx(r.x0)}
                y={sy(r.y0)}
                width={(r.x1 - r.x0) * scale}
                height={0.18 * scale}
                fill="#5da24e"
              />
            </G>
          ))}
          {/* Maali­lippu oikealla kalliolla */}
          <Line
            x1={sx(level.rightEdge + 1.5)}
            y1={sy(level.deckY)}
            x2={sx(level.rightEdge + 1.5)}
            y2={sy(level.deckY - 0.9)}
            stroke="#333"
            strokeWidth={2}
          />
          <Polygon
            points={`${sx(level.rightEdge + 1.5)},${sy(level.deckY - 0.9)} ${sx(level.rightEdge + 2.1)},${sy(
              level.deckY - 0.72
            )} ${sx(level.rightEdge + 1.5)},${sy(level.deckY - 0.54)}`}
            fill="#d8483b"
          />

          {/* Ruudukko rakennustilassa */}
          {phase === 'build' && (
            <G>
              {gridDots.map((d) => (
                <Circle
                  key={`${d.x},${d.y}`}
                  cx={sx(d.x)}
                  cy={sy(d.y)}
                  r={2.5}
                  fill="rgba(30,50,70,0.28)"
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
                // Murtunut palkki: kaksi roikkuvaa tynkää
                const dx = nb.x - na.x;
                const dy = nb.y - na.y;
                const len = Math.hypot(dx, dy) || 1;
                const s = (beam.restLen * 0.28) / len;
                return (
                  <G key={i} opacity={0.55}>
                    <Line
                      x1={sx(na.x)}
                      y1={sy(na.y)}
                      x2={sx(na.x + dx * s)}
                      y2={sy(na.y + dy * s)}
                      stroke={beam.mat.color}
                      strokeWidth={w}
                      strokeLinecap="round"
                    />
                    <Line
                      x1={sx(nb.x)}
                      y1={sy(nb.y)}
                      x2={sx(nb.x - dx * s)}
                      y2={sy(nb.y - dy * s)}
                      stroke={beam.mat.color}
                      strokeWidth={w}
                      strokeLinecap="round"
                    />
                  </G>
                );
              }
              return (
                <Line
                  key={i}
                  x1={sx(na.x)}
                  y1={sy(na.y)}
                  x2={sx(nb.x)}
                  y2={sy(nb.y)}
                  stroke={stressColor(beam.stress)}
                  strokeWidth={w}
                  strokeLinecap="round"
                />
              );
            })}

          {/* Liitossolmut */}
          {!testing &&
            buildNodes.map((n) => (
              <Circle key={`${n.x},${n.y}`} cx={sx(n.x)} cy={sy(n.y)} r={0.07 * scale} fill="#2f3a45" />
            ))}
          {testing &&
            engine!.nodes.map((n, i) =>
              n.vehicle ? null : (
                <Circle key={i} cx={sx(n.x)} cy={sy(n.y)} r={0.07 * scale} fill="#2f3a45" />
              )
            )}

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
              const wR = engine!.nodes[seg.wheels[1]];
              return (
                <G key={i}>
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
        </Svg>
      </View>

      {/* Yläpalkki */}
      <View style={styles.topBar} pointerEvents="box-none">
        <TouchableOpacity style={styles.btn} onPress={onExit}>
          <Text style={styles.btnText}>‹ Kentät</Text>
        </TouchableOpacity>
        <View style={styles.titleBox}>
          <Text style={styles.title}>
            {level.id}. {level.name}
          </Text>
          <Text style={styles.subtitle}>
            {info.emoji} {info.name} · {(info.totalMass / 1000).toFixed(1).replace('.', ',')} t
          </Text>
        </View>
        <Text style={[styles.budget, budgetFlash && styles.budgetOver]}>
          {cost.toLocaleString('fi-FI')} € / {level.budget.toLocaleString('fi-FI')} €
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
          {(['road', 'steel', 'cable'] as MaterialId[]).map((m) => (
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

      {phase === 'build' && level.hint != null && (
        <Text style={styles.hint}>💡 {level.hint}</Text>
      )}
      {phase === 'test' && (
        <Text style={styles.hint}>Palkin väri kertoo kuorman: vihreä = kevyt, punainen = murtumassa</Text>
      )}

      {/* Lopputulokset */}
      {phase === 'won' && (
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Silta kesti! 🎉</Text>
            <Text style={styles.cardStars}>{'★'.repeat(stars) + '☆'.repeat(3 - stars)}</Text>
            <Text style={styles.cardText}>
              Kustannus {cost.toLocaleString('fi-FI')} € / {level.budget.toLocaleString('fi-FI')} €
            </Text>
            <View style={styles.cardRow}>
              <TouchableOpacity style={styles.btn} onPress={backToBuild}>
                <Text style={styles.btnText}>Paranna siltaa</Text>
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
            <Text style={styles.cardTitle}>Silta petti 💥</Text>
            <Text style={styles.cardText}>{failReason}</Text>
            <View style={styles.cardRow}>
              <TouchableOpacity style={[styles.btn, styles.btnGo]} onPress={backToBuild}>
                <Text style={styles.btnText}>Korjaa siltaa</Text>
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
