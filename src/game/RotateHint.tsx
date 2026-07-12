import React from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

/**
 * Peli on suunniteltu vaakasuuntaan. Natiivipuolella app.json lukitsee
 * suunnan käyttöjärjestelmätasolla, mutta selaimessa mikään ei estä
 * pystyasentoa — näytetään silloin kääntöohje pelinäkymän päällä.
 */
export default function RotateHint() {
  const { width, height } = useWindowDimensions();
  const portraitPhone = Platform.OS === 'web' && height > width && width < 820;
  if (!portraitPhone) return null;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <Text style={styles.icon}>📱↻</Text>
      <Text style={styles.text}>Käännä puhelin vaakasuuntaan</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#173049',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  icon: { fontSize: 48, marginBottom: 12 },
  text: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
