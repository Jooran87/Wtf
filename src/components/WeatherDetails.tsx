import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { WeatherObservation } from '../api/types';
import {
  formatHumidity,
  formatPressure,
  formatVisibility,
  formatSnowDepth,
  formatPrecipitation,
  formatWindDirection,
  formatWindSpeed,
} from '../utils/helpers';
import { colors, spacing, radius } from '../constants/theme';

interface Props {
  observation: WeatherObservation | null;
}

interface DetailTile {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

export function WeatherDetails({ observation: obs }: Props) {
  const tiles: DetailTile[] = [
    {
      icon: 'water-outline',
      label: 'Kosteus',
      value: formatHumidity(obs?.humidity ?? null),
    },
    {
      icon: 'speedometer-outline',
      label: 'Ilmanpaine',
      value: formatPressure(obs?.pressure ?? null),
    },
    {
      icon: 'eye-outline',
      label: 'Näkyvyys',
      value: formatVisibility(obs?.visibility ?? null),
    },
    {
      icon: 'snow-outline',
      label: 'Lumensyvyys',
      value: formatSnowDepth(obs?.snowDepth ?? null),
    },
    {
      icon: 'rainy-outline',
      label: 'Sade (1h)',
      value: formatPrecipitation(obs?.precipitation ?? null),
    },
    {
      icon: 'compass-outline',
      label: 'Tuulen suunta',
      value: obs?.windDirection != null
        ? `${Math.round(obs.windDirection)}° ${formatWindDirection(obs.windDirection)}`
        : '--',
    },
  ];

  return (
    <BlurView intensity={20} tint="dark" style={styles.card}>
      <Text style={styles.title}>Lisätiedot</Text>
      <View style={styles.grid}>
        {tiles.map((tile, i) => (
          <View key={i} style={styles.tile}>
            <Ionicons name={tile.icon} size={20} color={colors.textMuted} />
            <Text style={styles.tileLabel}>{tile.label}</Text>
            <Text style={styles.tileValue}>{tile.value}</Text>
          </View>
        ))}
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: radius.card,
    padding: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    width: '47%',
    backgroundColor: colors.glassFill,
    borderRadius: radius.tile,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tileLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  tileValue: {
    fontSize: 20,
    fontWeight: '300',
    color: colors.textPrimary,
  },
});
