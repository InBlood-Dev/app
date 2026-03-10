import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

interface NotificationPermissionModalProps {
  visible: boolean;
  onClose: () => void;
  onEnable: () => void;
}

interface BenefitItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}

const BenefitItem: React.FC<BenefitItemProps> = ({ icon, text }) => (
  <View style={styles.benefitItem}>
    <View style={styles.benefitIconContainer}>
      <Ionicons name={icon} size={20} color={colors.primary} />
    </View>
    <Text style={styles.benefitText}>{text}</Text>
  </View>
);

export const NotificationPermissionModal: React.FC<NotificationPermissionModalProps> = ({
  visible,
  onClose,
  onEnable,
}) => {
  const handleEnable = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onEnable();
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <Animated.View entering={SlideInDown.duration(400).springify()} style={styles.card}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="notifications" size={64} color={colors.primary} />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>Never Miss a Match</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            Get notified instantly when someone matches with you or sends a message
          </Text>

          {/* Benefits */}
          <View style={styles.benefits}>
            <BenefitItem icon="heart" text="Instant match notifications" />
            <BenefitItem icon="chatbubbles" text="New message alerts" />
            <BenefitItem icon="flame" text="Know when someone likes you" />
          </View>

          {/* Enable Button */}
          <Pressable style={styles.enableButton} onPress={handleEnable}>
            <Text style={styles.enableText}>Enable Notifications</Text>
          </Pressable>

          {/* Not Now Button */}
          <Pressable style={styles.notNowButton} onPress={handleClose}>
            <Text style={styles.notNowText}>Not Now</Text>
          </Pressable>

          {/* Privacy Note */}
          <Text style={styles.privacyNote}>You can change this anytime in Settings</Text>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
    paddingHorizontal: spacing.sm,
  },
  benefits: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  benefitIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${colors.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  benefitText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: fontWeight.medium,
    flex: 1,
  },
  enableButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    width: '100%',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  enableText: {
    color: colors.background,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  notNowButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  notNowText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  privacyNote: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
