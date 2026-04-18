import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LineChart } from 'react-native-gifted-charts';
import { WeatherObservation } from '../api/types';
import { colors, spacing, radius } from '../constants/theme';

interface Props {
  observations: WeatherObservation[];
}

export function TemperatureChart({ observations }: Props) {
  const hourly = observations.filter((_, i) => i % 6 === 0);

  if (hourly.length < 3) return null;

  const chartWidth = Dimensions.get('window').width - 80;

  const data = hourly
    .filter(o => o.temperature !== null)
    .map(o => ({
      value: o.temperature as number,
      label:
        o.time.getHours() % 6 === 0
          ? String(o.time.getHours()).padStart(2, '0')
          : '',
    }));

  if (data.length < 3) return null;

  return (
    <BlurView intensity={20} tint="dark" style={styles.card}>
      <Text style={styles.title}>Lämpötila 24h</Text>
      <LineChart
        data={data}
        width={chartWidth}
        height={130}
        color={colors.tempLine}
        thickness={2}
        curved
        hideDataPoints={false}
        dataPointsColor={colors.tempLine}
        dataPointsRadius={3}
        xAxisLabelTextStyle={styles.axisLabel}
        yAxisTextStyle={styles.axisLabel}
        noOfSections={4}
        yAxisColor="transparent"
        xAxisColor={colors.glassBorder}
        rulesColor={colors.glassFill}
        backgroundColor="transparent"
        initialSpacing={12}
        endSpacing={12}
        isAnimated
        animationDuration={800}
        hideRules={false}
      />
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: radius.card,
    padding: spacing.md,
    paddingBottom: spacing.sm,
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
  axisLabel: {
    color: colors.textMuted,
    fontSize: 10,
  } as object,
});
