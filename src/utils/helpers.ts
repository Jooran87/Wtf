export function formatTemperature(c: number | null): string {
  if (c === null) return '--';
  const rounded = Math.round(c);
  return `${rounded > 0 ? '+' : ''}${rounded}°`;
}

export function formatTemperatureFull(c: number | null): string {
  if (c === null) return '--';
  return `${c > 0 ? '+' : ''}${c.toFixed(1)}°C`;
}

export function formatWindSpeed(ms: number | null): string {
  if (ms === null) return '--';
  return `${ms.toFixed(1)} m/s`;
}

export function formatWindDirection(deg: number | null): string {
  if (deg === null) return '--';
  const dirs = ['P', 'KO', 'I', 'KA', 'E', 'LO', 'L', 'LU'];
  const index = Math.round(deg / 45) % 8;
  return dirs[index];
}

export function formatHumidity(rh: number | null): string {
  if (rh === null) return '--';
  return `${Math.round(rh)}%`;
}

export function formatPressure(hPa: number | null): string {
  if (hPa === null) return '--';
  return `${Math.round(hPa)} hPa`;
}

export function formatVisibility(m: number | null): string {
  if (m === null) return '--';
  if (m >= 10000) return '>10 km';
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

export function formatSnowDepth(cm: number | null): string {
  if (cm === null || cm < 0) return '0 cm';
  return `${Math.round(cm)} cm`;
}

export function formatPrecipitation(mm: number | null): string {
  if (mm === null || mm <= 0) return '0 mm';
  return `${mm.toFixed(1)} mm`;
}

export function formatHour(date: Date): string {
  return date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki' });
}

export function formatShortTime(date: Date): string {
  return date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki' });
}

export function formatDayTime(date: Date): string {
  const now = new Date();
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);

  if (date < tomorrowStart) {
    return formatShortTime(date);
  }
  return date.toLocaleDateString('fi-FI', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki' });
}

export type WeatherCondition = 'sunny' | 'partly-sunny' | 'cloudy' | 'rainy' | 'snowy' | 'foggy';

export function getWeatherCondition(
  temp: number | null,
  prec: number | null,
  vis: number | null,
  humidity: number | null,
): WeatherCondition {
  if (vis !== null && vis < 1000) return 'foggy';
  if (prec !== null && prec > 0.1) {
    return (temp !== null && temp < 0) ? 'snowy' : 'rainy';
  }
  if (humidity !== null && humidity > 90) return 'cloudy';
  return (temp !== null && temp > 15) ? 'sunny' : 'partly-sunny';
}

export function getConditionIcon(cond: WeatherCondition): string {
  switch (cond) {
    case 'sunny': return 'sunny';
    case 'partly-sunny': return 'partly-sunny';
    case 'cloudy': return 'cloudy';
    case 'rainy': return 'rainy';
    case 'snowy': return 'snow';
    case 'foggy': return 'cloudy';
  }
}

export function getGradientColors(cond: WeatherCondition): [string, string] {
  switch (cond) {
    case 'sunny': return ['#1565C0', '#0288D1'];
    case 'partly-sunny': return ['#0d1b2a', '#1b3a5c'];
    case 'cloudy': return ['#37474F', '#263238'];
    case 'rainy': return ['#1C313A', '#263238'];
    case 'snowy': return ['#455A64', '#546E7A'];
    case 'foggy': return ['#37474F', '#455A64'];
  }
}
