import React, { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import GameScreen from './src/game/GameScreen';
import LevelSelect from './src/game/LevelSelect';
import { LEVELS, SANDBOX, SANDBOX2, SANDBOX_TOWER, TOWER_LEVELS } from './src/game/levels';

type Selection = number | { tower: number } | 'sandbox' | 'sandbox2' | 'sandboxTower' | null;

export default function App() {
  const [sel, setSel] = useState<Selection>(null);
  /** Kentän id → parhaat tähdet */
  const [progress, setProgress] = useState<Record<number, number>>({});
  /** Suurin avattu kenttäindeksi per pelimuoto */
  const [unlocked, setUnlocked] = useState(0);
  const [unlockedTower, setUnlockedTower] = useState(0);

  const handleComplete = useCallback((levelId: number, stars: number) => {
    setProgress((p) => ({ ...p, [levelId]: Math.max(p[levelId] ?? 0, stars) }));
    const bi = LEVELS.findIndex((l) => l.id === levelId);
    if (bi >= 0) setUnlocked((u) => Math.max(u, bi + 1));
    const ti = TOWER_LEVELS.findIndex((l) => l.id === levelId);
    if (ti >= 0) setUnlockedTower((u) => Math.max(u, ti + 1));
  }, []);

  const level =
    sel === 'sandbox'
      ? SANDBOX
      : sel === 'sandbox2'
        ? SANDBOX2
        : sel === 'sandboxTower'
          ? SANDBOX_TOWER
          : typeof sel === 'number'
            ? LEVELS[sel]
            : sel && typeof sel === 'object'
              ? TOWER_LEVELS[sel.tower]
              : null;

  const hasNext =
    typeof sel === 'number'
      ? sel < LEVELS.length - 1
      : sel && typeof sel === 'object'
        ? sel.tower < TOWER_LEVELS.length - 1
        : false;

  return (
    <>
      <StatusBar hidden />
      {level === null ? (
        <LevelSelect
          progress={progress}
          unlocked={unlocked}
          unlockedTower={unlockedTower}
          onPick={setSel}
          onPickTower={(i) => setSel({ tower: i })}
          onPickSandbox={() => setSel('sandbox')}
          onPickSandbox2={() => setSel('sandbox2')}
          onPickSandboxTower={() => setSel('sandboxTower')}
        />
      ) : (
        <GameScreen
          level={level}
          hasNext={!!hasNext}
          onComplete={handleComplete}
          onNext={() =>
            setSel((s) =>
              typeof s === 'number'
                ? Math.min(s + 1, LEVELS.length - 1)
                : s && typeof s === 'object'
                  ? { tower: Math.min(s.tower + 1, TOWER_LEVELS.length - 1) }
                  : s
            )
          }
          onExit={() => setSel(null)}
        />
      )}
    </>
  );
}
