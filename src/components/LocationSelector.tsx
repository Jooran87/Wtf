import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Location } from '../api/types';
import { colors, spacing, radius } from '../constants/theme';

interface Props {
  locations: Location[];
  selectedId: string;
  onSelect: (loc: Location) => void;
}

export function LocationSelector({ locations, selectedId, onSelect }: Props) {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {locations.map(loc => (
          <TouchableOpacity
            key={loc.id}
            style={[styles.button, loc.id === selectedId && styles.selected]}
            onPress={() => onSelect(loc)}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, loc.id === selectedId && styles.selectedLabel]}>
              {loc.displayName}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: spacing.sm,
  },
  container: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFill,
  },
  selected: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  selectedLabel: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
