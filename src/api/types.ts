export interface WeatherObservation {
  place: string;
  time: Date;
  temperature: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  humidity: number | null;
  precipitation: number | null;
  snowDepth: number | null;
  pressure: number | null;
  visibility: number | null;
}

export interface WeatherForecast {
  place: string;
  time: Date;
  temperature: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  precipitation: number | null;
  humidity: number | null;
}

export interface Location {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  apiPlace: string;
  fmisid?: string;
}
