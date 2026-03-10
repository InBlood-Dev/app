import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

interface SafetyModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SafetyModal: React.FC<SafetyModalProps> = ({ visible, onClose }) => (
  <Modal
    visible={visible}
    animationType="slide"
    transparent={true}
    onRequestClose={onClose}
  >
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={28} color={colors.primary} />
          <Text style={styles.title}>Safety Tips</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Protect Yourself Online</Text>
          <Text style={styles.tip}>
            {'\u2022'} Never share personal information like your home address, workplace, or financial details with someone you haven't met in person.
          </Text>
          <Text style={styles.tip}>
            {'\u2022'} Keep conversations on the InBlood platform. Be cautious if someone asks you to move to other messaging apps right away.
          </Text>
          <Text style={styles.tip}>
            {'\u2022'} Be wary of anyone who avoids answering questions or provides inconsistent information about themselves.
          </Text>

          <Text style={styles.sectionTitle}>Meeting In Person</Text>
          <Text style={styles.tip}>
            {'\u2022'} Always meet in a public, well-lit place for the first few dates.
          </Text>
          <Text style={styles.tip}>
            {'\u2022'} Tell a friend or family member where you're going, who you're meeting, and when you expect to be back.
          </Text>
          <Text style={styles.tip}>
            {'\u2022'} Arrange your own transportation to and from the date so you can leave whenever you want.
          </Text>
          <Text style={styles.tip}>
            {'\u2022'} Trust your instincts — if something feels off, it's okay to leave.
          </Text>

          <Text style={styles.sectionTitle}>Reporting & Blocking</Text>
          <Text style={styles.tip}>
            {'\u2022'} If someone makes you uncomfortable, you can block and report them from their profile.
          </Text>
          <Text style={styles.tip}>
            {'\u2022'} InBlood takes reports seriously. Our team reviews every report to keep the community safe.
          </Text>

          <Text style={styles.sectionTitle}>Need Help?</Text>
          <Text style={styles.tip}>
            If you ever feel unsafe or need assistance, reach out to us at{' '}
            <Text style={styles.email}>followinblood@gmail.com</Text>
          </Text>
          <Text style={styles.tip}>
            In case of an emergency, always contact your local authorities first.
          </Text>
        </ScrollView>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modal: {
    maxHeight: '85%',
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  tip: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  email: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
});
