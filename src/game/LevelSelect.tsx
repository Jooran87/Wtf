import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LEVELS } from './levels';
import { vehicleInfo } from './vehicles';

interface Props {
  /** Kentän id → tähdet */
  progress: Record<number, number>;
  unlocked: number;
  onPick: (index: number) => void;
  onPickSandbox: () => void;
}

export default function LevelSelect({ progress, unlocked, onPick, onPickSandbox }: Props) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={['#173049', '#2c5578']} style={StyleSheet.absoluteFill} />
      <Text style={styles.title}>🌉 Sillanrakentaja</Text>
      <Text style={styles.subtitle}>
        Rakenna silta, joka kestää — joka kenttä on edellistä vaativampi.
      </Text>
      <ScrollView contentContainerStyle={styles.grid} horizontal={false}>
        <View style={styles.gridInner}>
          {LEVELS.map((lvl, i) => {
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
                </Text>
                <Text style={styles.cardStars}>
                  {stars ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : locked ? ' ' : '☆☆☆'}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.card, styles.cardSandbox]}
            onPress={onPickSandbox}
          >
            <Text style={styles.cardNum}>🧪</Text>
            <Text style={styles.cardName}>Testikenttä</Text>
            <Text style={styles.cardMeta}>vapaa rakentelu · 9 m</Text>
            <Text style={styles.cardMeta}>ei kustannusrajaa</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 24 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  subtitle: {
    color: '#a8c4da',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
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
