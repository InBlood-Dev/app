import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { Ionicons } from '@expo/vector-icons';

export const MaintenanceScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="construct-outline" size={80} color={colors.primary} />
        </View>

        <Text style={styles.title}>Under Maintenance</Text>

        <Text style={styles.description}>
          We're making some improvements to give you a better experience. We'll be back shortly!
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Geist_700Bold',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    fontFamily: 'Geist_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
});