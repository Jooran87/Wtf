import React, { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import GameScreen from './src/game/GameScreen';
import LevelSelect from './src/game/LevelSelect';
import { LEVELS } from './src/game/levels';

export default function App() {
  const [levelIndex, setLevelIndex] = useState<number | null>(null);
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
        <LevelSelect progress={progress} unlocked={unlocked} onPick={setLevelIndex} />
      ) : (
        <GameScreen
          level={LEVELS[levelIndex]}
          hasNext={levelIndex < LEVELS.length - 1}
          onComplete={handleComplete}
          onNext={() => setLevelIndex((i) => (i === null ? 0 : Math.min(i + 1, LEVELS.length - 1)))}
          onExit={() => setLevelIndex(null)}
        />
      )}
    </>
  );
}
