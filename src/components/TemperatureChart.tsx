import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, {
  Polyline,
  Line,
  Text as SvgText,
  Circle,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { WeatherObservation } from '../api/types';
import { colors, spacing, radius } from '../constants/theme';

interface Props {
  observations: WeatherObservation[];
}

export function TemperatureChart({ observations }: Props) {
  const hourly = observations
    .filter((_, i) => i % 6 === 0)
    .filter(o => o.temperature !== null);

  if (hourly.length < 3) return null;

  const chartWidth = Dimensions.get('window').width - 80;
  const chartHeight = 150;
  const pLeft = 36;
  const pRight = 12;
  const pTop = 16;
  const pBottom = 28;
  const innerW = chartWidth - pLeft - pRight;
  const innerH = chartHeight - pTop - pBottom;

  const temps = hourly.map(o => o.temperature as number);
  const minT = Math.min(...temps);
  const maxT = Math.max(...temps);
  const pad = Math.max((maxT - minT) * 0.15, 2);
  const minD = minT - pad;
  const maxD = maxT + pad;

  const xS = (i: number) => pLeft + (i / (hourly.length - 1)) * innerW;
  const yS = (v: number) => pTop + ((maxD - v) / (maxD - minD)) * innerH;

  const linePoints = hourly
    .map((o, i) => `${xS(i)},${yS(o.temperature as number)}`)
    .join(' ');

  const fillD =
    `M ${xS(0)} ${pTop + innerH} ` +
    hourly.map((o, i) => `L ${xS(i)} ${yS(o.temperature as number)}`).join(' ') +
    ` L ${xS(hourly.length - 1)} ${pTop + innerH} Z`;

  const yLabels = [
    { v: maxD, y: pTop },
    { v: (maxD + minD) / 2, y: pTop + innerH / 2 },
    { v: minD, y: pTop + innerH },
  ];

  const showZero = minD < 0 && maxD > 0;

  return (
    <BlurView intensity={20} tint="dark" style={styles.card}>
      <Text style={styles.title}>Lämpötila 24h</Text>
      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          <LinearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.tempLine} stopOpacity="0.35" />
            <Stop offset="100%" stopColor={colors.tempLine} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {yLabels.map((lbl, i) => (
          <Line
            key={i}
            x1={pLeft}
            y1={lbl.y}
            x2={chartWidth - pRight}
            y2={lbl.y}
            stroke={colors.glassBorder}
            strokeWidth={0.5}
          />
        ))}

        {showZero && (
          <Line
            x1={pLeft}
            y1={yS(0)}
            x2={chartWidth - pRight}
            y2={yS(0)}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1}
            strokeDasharray="4,3"
          />
        )}

        <Path d={fillD} fill="url(#tempFill)" />

        <Polyline
          points={linePoints}
          fill="none"
          stroke={colors.tempLine}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {hourly.map((o, i) => (
          <Circle
            key={i}
            cx={xS(i)}
            cy={yS(o.temperature as number)}
            r={2.5}
            fill={colors.tempLine}
          />
        ))}

        {yLabels.map((lbl, i) => (
          <SvgText
            key={i}
            x={pLeft - 4}
            y={lbl.y + 4}
            fill={colors.textMuted}
            fontSize={9}
            textAnchor="end"
          >
            {`${Math.round(lbl.v)}°`}
          </SvgText>
        ))}

        {hourly.map((o, i) => {
          if (i % 3 !== 0 && i !== hourly.length - 1) return null;
          return (
            <SvgText
              key={i}
              x={xS(i)}
              y={chartHeight - 5}
              fill={colors.textMuted}
              fontSize={9}
              textAnchor="middle"
            >
              {String(o.time.getHours()).padStart(2, '0')}
            </SvgText>
          );
        })}
      </Svg>
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
    marginBottom: spacing.sm,
  },
});
