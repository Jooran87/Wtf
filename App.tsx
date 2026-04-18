import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { LOCATIONS } from './src/constants/locations';
import { colors, spacing } from './src/constants/theme';
import { fetchObservations, fetchForecast } from './src/api/fmiService';
import { WeatherObservation, WeatherForecast, Location } from './src/api/types';
import { getWeatherCondition, getGradientColors } from './src/utils/helpers';

import { LocationSelector } from './src/components/LocationSelector';
import { CurrentWeatherCard } from './src/components/CurrentWeatherCard';
import { TemperatureChart } from './src/components/TemperatureChart';
import { ForecastRow } from './src/components/ForecastRow';
import { WindCompass } from './src/components/WindCompass';
import { WeatherDetails } from './src/components/WeatherDetails';

export default function App() {
  const [selectedLocation, setSelectedLocation] = useState<Location>(LOCATIONS[0]);
  const [observations, setObservations] = useState<WeatherObservation[]>([]);
  const [forecasts, setForecasts] = useState<WeatherForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (loc: Location) => {
    setError(null);
    try {
      const [obs, fcst] = await Promise.all([
        fetchObservations(loc.name),
        fetchForecast(loc.name),
      ]);
      setObservations(obs);
      setForecasts(fcst);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Tuntematon virhe';
      setError(`Lataus epäonnistui: ${msg}`);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setObservations([]);
    setForecasts([]);
    loadData(selectedLocation).finally(() => setLoading(false));
  }, [selectedLocation, loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(selectedLocation);
    setRefreshing(false);
  }, [selectedLocation, loadData]);

  const currentObs = observations.length > 0 ? observations[observations.length - 1] : null;

  const cond = currentObs
    ? getWeatherCondition(
        currentObs.temperature,
        currentObs.precipitation,
        currentObs.visibility,
        currentObs.humidity,
      )
    : 'partly-sunny';
  const gradientColors = getGradientColors(cond);

  return (
    <LinearGradient colors={gradientColors} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <LocationSelector
          locations={LOCATIONS}
          selectedId={selectedLocation.id}
          onSelect={setSelectedLocation}
        />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accentBlue} />
            <Text style={styles.loadingText}>Ladataan säätietoja…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => loadData(selectedLocation)}>
              <Text style={styles.retryText}>Yritä uudelleen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accentBlue}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            <CurrentWeatherCard
              observation={currentObs}
              locationName={selectedLocation.displayName}
            />

            {observations.length > 0 && (
              <TemperatureChart observations={observations} />
            )}

            {forecasts.length > 0 && (
              <ForecastRow forecasts={forecasts} />
            )}

            <View style={styles.row}>
              <View style={styles.compassWrapper}>
                <WindCompass observation={currentObs} />
              </View>
            </View>

            <WeatherDetails observation={currentObs} />

            <Text style={styles.attribution}>
              Tiedot: Ilmatieteenlaitos (FMI) Open Data
            </Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 16,
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 99,
    backgroundColor: colors.accentBlue,
  },
  retryText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    gap: spacing.sm,
  },
  compassWrapper: {
    flex: 1,
  },
  attribution: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});
