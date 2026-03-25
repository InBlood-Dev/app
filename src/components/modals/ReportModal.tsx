import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import { reportUser, ReportType } from '../../services/report.service';

const REPORT_REASONS: { type: ReportType; label: string; icon: string }[] = [
  { type: 'spam', label: 'Spam', icon: 'mail-unread-outline' },
  { type: 'harassment', label: 'Harassment', icon: 'warning-outline' },
  { type: 'fake_profile', label: 'Fake Profile', icon: 'person-remove-outline' },
  { type: 'inappropriate_content', label: 'Inappropriate Content', icon: 'eye-off-outline' },
  { type: 'solicitation', label: 'Solicitation', icon: 'cash-outline' },
  { type: 'underage', label: 'Underage', icon: 'alert-circle-outline' },
  { type: 'other', label: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
];

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedUserName: string;
  reportedMessageId?: string;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  visible,
  onClose,
  reportedUserId,
  reportedUserName,
  reportedMessageId,
}) => {
  const [step, setStep] = useState<'reason' | 'details'>('reason');
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setStep('reason');
    setSelectedType(null);
    setDescription('');
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSelectReason = (type: ReportType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedType(type);
    setStep('details');
  };

  const handleSubmit = async () => {
    if (!selectedType) return;

    setSubmitting(true);
    try {
      const reason = REPORT_REASONS.find(r => r.type === selectedType)?.label || selectedType;
      await reportUser({
        reported_user_id: reportedUserId,
        report_type: selectedType,
        reason,
        description: description.trim() || undefined,
        reported_message_id: reportedMessageId,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleClose();
      Alert.alert(
        'Report Submitted',
        'Thank you for reporting. Our team will review this and take appropriate action.',
      );
    } catch (error: any) {
      console.error('[ReportModal] Submit failed:', error?.message || error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error?.message || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={step === 'details' ? () => setStep('reason') : handleClose}>
            <Ionicons
              name={step === 'details' ? 'chevron-back' : 'close'}
              size={28}
              color={colors.text}
            />
          </Pressable>
          <Text style={styles.title}>Report {reportedUserName}</Text>
          <View style={{ width: 28 }} />
        </View>

        {step === 'reason' ? (
          <ScrollView style={styles.content}>
            <Text style={styles.subtitle}>
              Why are you reporting this user?
            </Text>
            {REPORT_REASONS.map((item) => (
              <Pressable
                key={item.type}
                style={styles.reasonOption}
                onPress={() => handleSelectReason(item.type)}
              >
                <View style={styles.reasonIconBg}>
                  <Ionicons name={item.icon as any} size={22} color={colors.error} />
                </View>
                <Text style={styles.reasonLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.content}>
            <Text style={styles.subtitle}>
              Tell us more (optional)
            </Text>
            <Text style={styles.selectedReason}>
              Reason: {REPORT_REASONS.find(r => r.type === selectedType)?.label}
            </Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Add details to help us understand the situation..."
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={500}
              autoFocus
            />
            <Text style={styles.charCount}>{description.length}/500</Text>

            <Pressable
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report</Text>
              )}
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  reasonIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.error + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  reasonLabel: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  selectedReason: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.error,
    marginBottom: spacing.lg,
  },
  descriptionInput: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    fontSize: fontSize.md,
    color: colors.text,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: spacing.sm,
  },
  charCount: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'right',
    marginBottom: spacing.xl,
  },
  submitButton: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: '#fff',
  },
});
