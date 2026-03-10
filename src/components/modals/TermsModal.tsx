import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TermsModalProps {
  visible: boolean;
  onClose: () => void;
  onDisagree?: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ visible, onClose, onDisagree }) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Terms & Conditions</Text>

        <ScrollView
          style={styles.modalScroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.modalBody}>
            Welcome to InBlood. By using this application, you agree to the following terms and conditions:{'\n\n'}
            <Text style={styles.modalSectionTitle}>1. Acceptance of Terms</Text>{'\n'}
            By accessing or using InBlood, you agree to be bound by these Terms & Conditions. If you do not agree, you must discontinue use of the application immediately.{'\n\n'}
            <Text style={styles.modalSectionTitle}>2. Eligibility</Text>{'\n'}
            You must be at least 18 years of age to use InBlood. By using this app, you represent and warrant that you meet this age requirement.{'\n\n'}
            <Text style={styles.modalSectionTitle}>3. Account & Privacy</Text>{'\n'}
            You are responsible for maintaining the confidentiality of your account. Your personal data will be handled in accordance with our Privacy Policy. We do not sell your personal information to third parties.{'\n\n'}
            <Text style={styles.modalSectionTitle}>4. User Conduct</Text>{'\n'}
            You agree not to use InBlood for any unlawful, abusive, or harmful purpose. Harassment, hate speech, impersonation, and sharing of explicit content without consent are strictly prohibited.{'\n\n'}
            <Text style={styles.modalSectionTitle}>5. Content Ownership</Text>{'\n'}
            You retain ownership of the content you upload. By uploading content, you grant InBlood a non-exclusive license to display it within the app for the purpose of providing the service.{'\n\n'}
            <Text style={styles.modalSectionTitle}>6. Safety</Text>{'\n'}
            InBlood is committed to user safety. We reserve the right to suspend or terminate accounts that violate community guidelines. Always exercise caution when meeting someone in person.{'\n\n'}
            <Text style={styles.modalSectionTitle}>7. Limitation of Liability</Text>{'\n'}
            InBlood is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the application.{'\n\n'}
            <Text style={styles.modalSectionTitle}>8. Changes to Terms</Text>{'\n'}
            We may update these terms from time to time. Continued use of the app constitutes acceptance of the updated terms.
          </Text>
        </ScrollView>

        <View style={styles.modalButtons}>
          {onDisagree ? (
            <Pressable style={styles.disagreeButton} onPress={onDisagree}>
              <Text style={styles.disagreeButtonText}>Disagree</Text>
            </Pressable>
          ) : null}
          <Pressable style={[styles.agreeButton, !onDisagree && styles.fullWidthButton]} onPress={onClose}>
            <Text style={styles.agreeButtonText}>{onDisagree ? 'Agree' : 'Close'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: borderRadius.xxl,
    padding: spacing.xl,
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.75,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalScroll: {
    marginBottom: spacing.lg,
  },
  modalBody: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  modalSectionTitle: {
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  disagreeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  disagreeButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  agreeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  fullWidthButton: {
    flex: 1,
  },
  agreeButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
});
