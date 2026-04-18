import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { WeatherForecast } from '../api/types';
import {
  formatTemperature,
  formatDayTime,
  getWeatherCondition,
  getConditionIcon,
} from '../utils/helpers';
import { colors, spacing, radius } from '../constants/theme';

interface Props {
  forecasts: WeatherForecast[];
}

export function ForecastRow({ forecasts }: Props) {
  const items = forecasts.slice(0, 24);
  if (items.length === 0) return null;

  return (
    <BlurView intensity={20} tint="dark" style={styles.card}>
      <Text style={styles.title}>Ennuste 48h</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {items.map((f, i) => {
            const cond = getWeatherCondition(f.temperature, f.precipitation, null, f.humidity);
            const iconName = getConditionIcon(cond);
            const hasPrec = f.precipitation !== null && f.precipitation > 0.05;

            return (
              <View key={i} style={styles.item}>
                <Text style={styles.time}>{formatDayTime(f.time)}</Text>
                <Ionicons
                  name={iconName as keyof typeof Ionicons.glyphMap}
                  size={24}
                  color={colors.textPrimary}
                />
                <Text style={styles.temp}>{formatTemperature(f.temperature)}</Text>
                {hasPrec ? (
                  <Text style={styles.prec}>
                    {(f.precipitation as number).toFixed(1)} mm
                  </Text>
                ) : (
                  <View style={styles.noPrecSpacer} />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
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
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  item: {
    alignItems: 'center',
    width: 64,
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.tile,
    backgroundColor: colors.glassFill,
  },
  time: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  temp: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  prec: {
    fontSize: 10,
    color: colors.accentBlue,
  },
  noPrecSpacer: {
    height: 14,
  },
});
