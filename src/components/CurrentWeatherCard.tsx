import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { WeatherObservation } from '../api/types';
import {
  formatTemperatureFull,
  formatWindSpeed,
  formatWindDirection,
  getWeatherCondition,
  getConditionIcon,
  WeatherCondition,
} from '../utils/helpers';
import { colors, spacing, radius } from '../constants/theme';

interface Props {
  observation: WeatherObservation | null;
  locationName: string;
}

const CONDITION_LABEL: Record<WeatherCondition, string> = {
  'sunny': 'Aurinkoinen',
  'partly-sunny': 'Puolipilvinen',
  'cloudy': 'Pilvinen',
  'rainy': 'Sateinen',
  'snowy': 'Luminen',
  'foggy': 'Sumuinen',
};

export function CurrentWeatherCard({ observation, locationName }: Props) {
  const cond = observation
    ? getWeatherCondition(
        observation.temperature,
        observation.precipitation,
        observation.visibility,
        observation.humidity,
      )
    : 'partly-sunny';

  const iconName = getConditionIcon(cond);
  const condLabel = CONDITION_LABEL[cond];

  const updatedAt = observation
    ? observation.time.toLocaleTimeString('fi-FI', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Helsinki',
      })
    : null;

  return (
    <BlurView intensity={20} tint="dark" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.city}>{locationName}</Text>
        {updatedAt && (
          <Text style={styles.updated}>päivitetty {updatedAt}</Text>
        )}
      </View>

      <View style={styles.mainRow}>
        <Ionicons
          name={iconName as keyof typeof Ionicons.glyphMap}
          size={80}
          color={colors.textPrimary}
          style={styles.icon}
        />
        <Text style={styles.temp}>
          {formatTemperatureFull(observation?.temperature ?? null)}
        </Text>
      </View>

      <Text style={styles.condLabel}>{condLabel}</Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Ionicons name="water-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.summaryText}>
            {observation?.humidity != null ? `${Math.round(observation.humidity)}%` : '--'}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Ionicons name="navigate-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.summaryText}>
            {formatWindSpeed(observation?.windSpeed ?? null)}{' '}
            {formatWindDirection(observation?.windDirection ?? null)}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Ionicons name="eye-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.summaryText}>
            {observation?.visibility != null
              ? observation.visibility >= 10000
                ? '>10km'
                : `${(observation.visibility / 1000).toFixed(1)}km`
              : '--'}
          </Text>
        </View>
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: radius.card,
    padding: spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  city: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  updated: {
    fontSize: 12,
    color: colors.textMuted,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  icon: {
    opacity: 0.9,
  },
  temp: {
    fontSize: 72,
    fontWeight: '200',
    color: colors.textPrimary,
    letterSpacing: -2,
  },
  condLabel: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
