import { XMLParser } from 'fast-xml-parser';
import { WeatherObservation, WeatherForecast, Location } from './types';

const BASE_URL = 'https://opendata.fmi.fi/wfs';
const TIMEOUT_MS = 15000;

const OBS_PARAMS = 't2m,ws_10min,wd_10min,rh,r_1h,snow_aws,p_sea,vis';
const FCST_PARAMS = 'Temperature,WindSpeedMS,WindDirection,Precipitation1h,Humidity';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: true,
  isArray: (name: string) => name === 'member' || name === 'point',
});

interface DataPoint {
  time: Date;
  value: number;
}

async function fetchXml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function extractParamName(member: Record<string, unknown>): string {
  const obs = member?.PointTimeSeriesObservation as Record<string, unknown> | undefined;
  if (!obs) return '';

  const ts = (obs?.result as Record<string, unknown>)?.MeasurementTimeseries as Record<string, unknown> | undefined;
  const gmlId: string = (ts?.['@_id'] as string) ?? (ts?.['@_gml:id'] as string) ?? '';

  if (gmlId) {
    const parts = gmlId.split('-');
    const last = parts[parts.length - 1];
    if (last) return last;
  }

  const observedProp = obs?.observedProperty as Record<string, unknown> | undefined;
  const href: string = (observedProp?.['@_href'] as string) ?? '';
  if (href) {
    const paramMatch = href.match(/[?&]param=([^&#]+)/i);
    if (paramMatch) return paramMatch[1];
    const hashMatch = href.match(/#([^/#?]+)$/);
    if (hashMatch) return hashMatch[1];
  }

  return '';
}

function parseTimeSeries(xml: string): Map<string, DataPoint[]> {
  const doc = xmlParser.parse(xml) as Record<string, unknown>;

  if (doc?.ExceptionReport) {
    const msg = (doc.ExceptionReport as Record<string, unknown>)?.Exception;
    throw new Error(`FMI virhe: ${JSON.stringify(msg)}`);
  }

  const fc = doc?.FeatureCollection as Record<string, unknown> | undefined;
  const members = (fc?.member as unknown[]) ?? [];
  const result = new Map<string, DataPoint[]>();

  for (const rawMember of members) {
    const member = rawMember as Record<string, unknown>;
    const paramName = extractParamName(member);
    if (!paramName) continue;

    const obs = member?.PointTimeSeriesObservation as Record<string, unknown> | undefined;
    const ts = (obs?.result as Record<string, unknown>)?.MeasurementTimeseries as Record<string, unknown> | undefined;
    const points = (ts?.point as unknown[]) ?? [];

    const dataPoints: DataPoint[] = [];
    for (const rawPoint of points) {
      const pt = rawPoint as Record<string, unknown>;
      const tvp = pt?.MeasurementTVP as Record<string, unknown> | undefined;
      if (!tvp) continue;

      const timeStr = tvp.time as string | undefined;
      const rawVal = tvp.value;
      const val = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal ?? 'NaN'));

      if (timeStr && !isNaN(val)) {
        dataPoints.push({ time: new Date(timeStr), value: val });
      }
    }

    if (dataPoints.length > 0) {
      result.set(paramName, dataPoints);
    }
  }

  return result;
}

function getValueAt(series: DataPoint[] | undefined, time: Date): number | null {
  if (!series) return null;
  const t = time.getTime();
  const match = series.find(p => p.time.getTime() === t);
  return match ? match.value : null;
}

export async function fetchObservations(loc: Location): Promise<WeatherObservation[]> {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 3600 * 1000);

  const locationParam = loc.fmisid
    ? `fmisid=${loc.fmisid}`
    : `place=${encodeURIComponent(loc.apiPlace)}`;

  const url =
    `${BASE_URL}?service=WFS&version=2.0.0&request=getFeature` +
    `&storedquery_id=fmi::observations::weather::timevaluepair` +
    `&${locationParam}` +
    `&starttime=${start.toISOString().slice(0, 19)}Z` +
    `&endtime=${end.toISOString().slice(0, 19)}Z` +
    `&parameters=${OBS_PARAMS}` +
    `&timestep=10`;

  const xml = await fetchXml(url);
  const series = parseTimeSeries(xml);

  const tempSeries = series.get('t2m') ?? [];
  return tempSeries.map(tp => ({
    place: loc.name,
    time: tp.time,
    temperature: tp.value,
    windSpeed: getValueAt(series.get('ws_10min'), tp.time),
    windDirection: getValueAt(series.get('wd_10min'), tp.time),
    humidity: getValueAt(series.get('rh'), tp.time),
    precipitation: getValueAt(series.get('r_1h'), tp.time),
    snowDepth: getValueAt(series.get('snow_aws'), tp.time),
    pressure: getValueAt(series.get('p_sea'), tp.time),
    visibility: getValueAt(series.get('vis'), tp.time),
  }));
}

export async function fetchForecast(loc: Location): Promise<WeatherForecast[]> {
  const start = new Date();
  const end = new Date(start.getTime() + 48 * 3600 * 1000);

  const url =
    `${BASE_URL}?service=WFS&version=2.0.0&request=getFeature` +
    `&storedquery_id=fmi::forecast::harmonie::surface::point::timevaluepair` +
    `&latlon=${loc.lat},${loc.lon}` +
    `&starttime=${start.toISOString().slice(0, 19)}Z` +
    `&endtime=${end.toISOString().slice(0, 19)}Z` +
    `&parameters=${FCST_PARAMS}`;

  const xml = await fetchXml(url);
  const series = parseTimeSeries(xml);

  const tempSeries = series.get('Temperature') ?? [];
  return tempSeries.map(tp => ({
    place: loc.name,
    time: tp.time,
    temperature: tp.value,
    windSpeed: getValueAt(series.get('WindSpeedMS'), tp.time),
    windDirection: getValueAt(series.get('WindDirection'), tp.time),
    precipitation: getValueAt(series.get('Precipitation1h'), tp.time),
    humidity: getValueAt(series.get('Humidity'), tp.time),
  }));
}
