import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Line, Polygon, Text as SvgText, G } from 'react-native-svg';
import { WeatherObservation } from '../api/types';
import { formatWindSpeed, formatWindDirection } from '../utils/helpers';
import { colors, spacing, radius } from '../constants/theme';

interface Props {
  observation: WeatherObservation | null;
}

const SIZE = 160;
const CENTER = SIZE / 2;
const OUTER_R = 70;

export function WindCompass({ observation }: Props) {
  const speed = observation?.windSpeed ?? null;
  const direction = observation?.windDirection ?? null;

  const needleRotation = direction ?? 0;

  return (
    <BlurView intensity={20} tint="dark" style={styles.card}>
      <Text style={styles.title}>Tuuli</Text>
      <View style={styles.content}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Outer ring */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={OUTER_R}
            stroke={colors.glassBorder}
            strokeWidth={1.5}
            fill={colors.glassFill}
          />
          {/* Inner dot rings */}
          <Circle cx={CENTER} cy={CENTER} r={4} fill={colors.accentBlue} />

          {/* Cardinal direction labels */}
          <SvgText
            x={CENTER}
            y={14}
            fill={colors.textPrimary}
            fontSize={13}
            fontWeight="700"
            textAnchor="middle"
          >
            P
          </SvgText>
          <SvgText
            x={SIZE - 10}
            y={CENTER + 5}
            fill={colors.textSecondary}
            fontSize={12}
            textAnchor="middle"
          >
            I
          </SvgText>
          <SvgText
            x={CENTER}
            y={SIZE - 4}
            fill={colors.textSecondary}
            fontSize={12}
            textAnchor="middle"
          >
            E
          </SvgText>
          <SvgText
            x={10}
            y={CENTER + 5}
            fill={colors.textSecondary}
            fontSize={12}
            textAnchor="middle"
          >
            L
          </SvgText>

          {/* Wind direction needle (rotated around center) */}
          {direction !== null && (
            <G
              rotation={needleRotation}
              origin={`${CENTER}, ${CENTER}`}
            >
              {/* Arrow shaft */}
              <Line
                x1={CENTER}
                y1={CENTER - OUTER_R + 8}
                x2={CENTER}
                y2={CENTER + 15}
                stroke={colors.accentBlue}
                strokeWidth={3}
                strokeLinecap="round"
              />
              {/* Arrowhead */}
              <Polygon
                points={`${CENTER},${CENTER - OUTER_R + 4} ${CENTER - 6},${CENTER - OUTER_R + 18} ${CENTER + 6},${CENTER - OUTER_R + 18}`}
                fill={colors.accentBlue}
              />
              {/* Tail */}
              <Line
                x1={CENTER}
                y1={CENTER + 15}
                x2={CENTER - 5}
                y2={CENTER + 28}
                stroke={colors.glassBorder}
                strokeWidth={2}
                strokeLinecap="round"
              />
              <Line
                x1={CENTER}
                y1={CENTER + 15}
                x2={CENTER + 5}
                y2={CENTER + 28}
                stroke={colors.glassBorder}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </G>
          )}

          {/* Center speed text */}
          {speed !== null && (
            <SvgText
              x={CENTER}
              y={CENTER + 5}
              fill={colors.textPrimary}
              fontSize={11}
              fontWeight="600"
              textAnchor="middle"
            >
              {speed.toFixed(1)}
            </SvgText>
          )}
        </Svg>

        <View style={styles.info}>
          <Text style={styles.speedValue}>{formatWindSpeed(speed)}</Text>
          <Text style={styles.dirValue}>
            {direction !== null ? `${Math.round(direction)}° ${formatWindDirection(direction)}` : '--'}
          </Text>
          {speed !== null && direction !== null && (
            <Text style={styles.beaufort}>
              Beaufort {beaufortScale(speed)}
            </Text>
          )}
        </View>
      </View>
    </BlurView>
  );
}

function beaufortScale(ms: number): number {
  const limits = [0.3, 1.5, 3.3, 5.5, 7.9, 10.7, 13.8, 17.1, 20.7, 24.4, 28.4, 32.6];
  const idx = limits.findIndex(v => ms < v);
  return idx === -1 ? 12 : idx;
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
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
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  info: {
    flex: 1,
    paddingLeft: spacing.md,
    gap: spacing.xs,
  },
  speedValue: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dirValue: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  beaufort: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
