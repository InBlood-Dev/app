import React from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, Image } from 'react-native';
import { colors } from '../theme';
import { Ionicons } from '@expo/vector-icons';

interface ForceUpdateScreenProps {
  updateUrl: string;
}

export const ForceUpdateScreen: React.FC<ForceUpdateScreenProps> = ({ updateUrl }) => {
  const handleUpdate = () => {
    Linking.openURL(updateUrl).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="cloud-download-outline" size={80} color={colors.primary} />
        </View>

        <Text style={styles.title}>Update Required</Text>

        <Text style={styles.description}>
          A new version of InBlood is available. Please update to continue using the app.
        </Text>

        <TouchableOpacity style={styles.button} onPress={handleUpdate} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Update Now</Text>
        </TouchableOpacity>
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
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontFamily: 'Geist_600SemiBold',
    color: colors.text,
  },
});
