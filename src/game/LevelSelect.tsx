import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LEVELS, SANDBOX, TOWER_LEVELS } from './levels';
import { vehicleInfo } from './vehicles';

type Tab = 'bridges' | 'towers';

interface Props {
  /** Kentän id → tähdet */
  progress: Record<number, number>;
  unlocked: number;
  unlockedTower: number;
  onPick: (index: number) => void;
  onPickTower: (index: number) => void;
  onPickSandbox: () => void;
  onPickSandbox2: () => void;
}

export default function LevelSelect({
  progress,
  unlocked,
  unlockedTower,
  onPick,
  onPickTower,
  onPickSandbox,
  onPickSandbox2,
}: Props) {
  const [tab, setTab] = useState<Tab>('bridges');

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#173049', '#2c5578']} style={StyleSheet.absoluteFill} />
      <Text style={styles.title}>🌉 Sillanrakentaja</Text>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'bridges' && styles.tabActive]}
          onPress={() => setTab('bridges')}
        >
          <Text style={[styles.tabText, tab === 'bridges' && styles.tabTextActive]}>🌉 Sillat</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'towers' && styles.tabActive]}
          onPress={() => setTab('towers')}
        >
          <Text style={[styles.tabText, tab === 'towers' && styles.tabTextActive]}>🏗 Tornit</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>
        {tab === 'bridges'
          ? 'Rakenna silta, joka kestää ajoneuvon — joka kenttä on edellistä vaativampi.'
          : 'Rakenna torni tavoitekorkeuteen ja pidä se pystyssä tuulessa ja järistyksessä.'}
      </Text>
      <ScrollView contentContainerStyle={styles.grid} horizontal={false}>
        <View style={styles.gridInner}>
          {tab === 'bridges' &&
            LEVELS.map((lvl, i) => {
              const stars = progress[lvl.id];
              const locked = i > unlocked;
              const info = vehicleInfo(lvl.vehicle);
              return (
                <TouchableOpacity
                  key={lvl.id}
                  style={[styles.card, locked && styles.cardLocked]}
                  disabled={locked}
                  onPress={() => onPick(i)}
                >
                  <Text style={styles.cardNum}>{locked ? '🔒' : lvl.id}</Text>
                  <Text style={styles.cardName}>{lvl.name}</Text>
                  <Text style={styles.cardMeta}>
                    {info.emoji} {(info.totalMass / 1000).toFixed(1).replace('.', ',')} t · {lvl.gap} m
                    {lvl.theme === 'autumn' ? ' · 🍂' : lvl.theme === 'winter' ? ' · ❄️' : lvl.theme === 'night' ? ' · 🌙' : ''}
                  </Text>
                  <Text style={styles.cardStars}>
                    {stars ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : locked ? ' ' : '☆☆☆'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          {tab === 'bridges' && (
            <>
              <TouchableOpacity style={[styles.card, styles.cardSandbox]} onPress={onPickSandbox}>
                <Text style={styles.cardNum}>🧪</Text>
                <Text style={styles.cardName}>Testikenttä</Text>
                <Text style={styles.cardMeta}>vapaa rakentelu · {SANDBOX.gap} m</Text>
                <Text style={styles.cardMeta}>ei kustannusrajaa</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.card, styles.cardSandbox]} onPress={onPickSandbox2}>
                <Text style={styles.cardNum}>🏝️</Text>
                <Text style={styles.cardName}>Testikenttä II</Text>
                <Text style={styles.cardMeta}>saari · 2 × 6 m jänteet</Text>
                <Text style={styles.cardMeta}>ei kustannusrajaa</Text>
              </TouchableOpacity>
            </>
          )}
          {tab === 'towers' &&
            TOWER_LEVELS.map((lvl, i) => {
              const stars = progress[lvl.id];
              const locked = i > unlockedTower;
              const height = lvl.deckY - (lvl.targetY ?? 0);
              return (
                <TouchableOpacity
                  key={lvl.id}
                  style={[styles.card, locked && styles.cardLocked]}
                  disabled={locked}
                  onPress={() => onPickTower(i)}
                >
                  <Text style={styles.cardNum}>{locked ? '🔒' : i + 1}</Text>
                  <Text style={styles.cardName}>{lvl.name}</Text>
                  <Text style={styles.cardMeta}>
                    🏗 {height} m · {lvl.duration} s{(lvl.wind?.gust ?? 0) > 300 ? ' · 🌬' : ''}
                    {lvl.quake ? ' · 〰' : ''}
                    {lvl.theme === 'autumn' ? ' · 🍂' : lvl.theme === 'winter' ? ' · ❄️' : lvl.theme === 'night' ? ' · 🌙' : ''}
                  </Text>
                  <Text style={styles.cardStars}>
                    {stars ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : locked ? ' ' : '☆☆☆'}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  tabs: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  tab: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: 9 },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  tabText: { color: '#a8c4da', fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  subtitle: {
    color: '#a8c4da',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  grid: { paddingHorizontal: 20, paddingBottom: 30 },
  gridInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  card: {
    width: 140,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  cardLocked: { opacity: 0.4 },
  cardSandbox: { borderColor: 'rgba(224,169,46,0.6)', borderStyle: 'dashed' },
  cardNum: { color: '#ffd76b', fontSize: 20, fontWeight: '800' },
  cardName: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 2 },
  cardMeta: { color: '#a8c4da', fontSize: 11, marginTop: 2 },
  cardStars: { color: '#e0a92e', fontSize: 14, marginTop: 4 },
});
