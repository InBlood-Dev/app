import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { MapUser } from '../types';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../theme';

interface Props {
  user: MapUser;
  onViewProfile: () => void;
  onClose: () => void;
}

export const MapUserCard: React.FC<Props> = ({ user, onViewProfile, onClose }) => {
  console.log('[MapUserCard] Rendering card for:', user.name, user);
  const imageUri = user.primary_photo || 'https://via.placeholder.com/150';

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <LinearGradient
        colors={['rgba(26, 26, 26, 0.95)', 'rgba(13, 13, 13, 0.98)']}
        style={styles.container}
      >
      <View style={styles.header}>
        <Image source={{ uri: imageUri }} style={styles.avatar} />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{user.name}, {user.age}</Text>
            {user.is_verified && (
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            )}
          </View>
          <View style={styles.distanceRow}>
            <Ionicons name="location" size={16} color={colors.textSecondary} />
            <Text style={styles.distance}>{user.distance} km away</Text>
          </View>
        </View>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      <Pressable onPress={onViewProfile} style={styles.viewButton}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)']}
          style={styles.buttonGradient}
        >
          <Text style={styles.buttonText}>View Profile</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.text} />
        </LinearGradient>
      </Pressable>
    </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  distance: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  buttonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
});
