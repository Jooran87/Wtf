import React, { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import GameScreen from './src/game/GameScreen';
import LevelSelect from './src/game/LevelSelect';
import { LEVELS, SANDBOX, SANDBOX2 } from './src/game/levels';

export default function App() {
  const [levelIndex, setLevelIndex] = useState<number | 'sandbox' | 'sandbox2' | null>(null);
  /** Kentän id → parhaat tähdet */
  const [progress, setProgress] = useState<Record<number, number>>({});
  /** Suurin avattu kenttäindeksi */
  const [unlocked, setUnlocked] = useState(0);

  const handleComplete = useCallback((levelId: number, stars: number) => {
    setProgress((p) => ({ ...p, [levelId]: Math.max(p[levelId] ?? 0, stars) }));
    const idx = LEVELS.findIndex((l) => l.id === levelId);
    if (idx >= 0) setUnlocked((u) => Math.max(u, idx + 1));
  }, []);

  return (
    <>
      <StatusBar hidden />
      {levelIndex === null ? (
        <LevelSelect
          progress={progress}
          unlocked={unlocked}
          onPick={setLevelIndex}
          onPickSandbox={() => setLevelIndex('sandbox')}
          onPickSandbox2={() => setLevelIndex('sandbox2')}
        />
      ) : (
        <GameScreen
          level={
            levelIndex === 'sandbox' ? SANDBOX : levelIndex === 'sandbox2' ? SANDBOX2 : LEVELS[levelIndex]
          }
          hasNext={typeof levelIndex === 'number' && levelIndex < LEVELS.length - 1}
          onComplete={handleComplete}
          onNext={() =>
            setLevelIndex((i) => (typeof i === 'number' ? Math.min(i + 1, LEVELS.length - 1) : i))
          }
          onExit={() => setLevelIndex(null)}
        />
      )}
    </>
  );
}
