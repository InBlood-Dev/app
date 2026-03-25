import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

interface DefaultAvatarProps {
  size: number;
}

export const DefaultAvatar: React.FC<DefaultAvatarProps> = ({ size }) => (
  <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
    <Ionicons name="person" size={size * 0.5} color={colors.textMuted} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
