import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  Dimensions,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import RenderHtml from 'react-native-render-html';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import { getLegalPage } from '../../services/legal.service';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TermsModalProps {
  visible: boolean;
  onClose: () => void;
  onDisagree?: () => void;
}

const FALLBACK_TERMS_CONTENT = `Welcome to InBlood. By using this application, you agree to the following terms and conditions:

1. Acceptance of Terms
By accessing or using InBlood, you agree to be bound by these Terms & Conditions. If you do not agree, you must discontinue use of the application immediately.

2. Eligibility
You must be at least 18 years of age to use InBlood. By using this app, you represent and warrant that you meet this age requirement.

3. Account & Privacy
You are responsible for maintaining the confidentiality of your account. Your personal data will be handled in accordance with our Privacy Policy. We do not sell your personal information to third parties.

4. User Conduct
You agree not to use InBlood for any unlawful, abusive, or harmful purpose. Harassment, hate speech, impersonation, and sharing of explicit content without consent are strictly prohibited.

5. Content Ownership
You retain ownership of the content you upload. By uploading content, you grant InBlood a non-exclusive license to display it within the app for the purpose of providing the service.

6. Safety
InBlood is committed to user safety. We reserve the right to suspend or terminate accounts that violate community guidelines. Always exercise caution when meeting someone in person.

7. Limitation of Liability
InBlood is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the application.

8. Changes to Terms
We may update these terms from time to time. Continued use of the app constitutes acceptance of the updated terms.`;

export const TermsModal: React.FC<TermsModalProps> = ({ visible, onClose, onDisagree }) => {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const { width: windowWidth } = useWindowDimensions();

  useEffect(() => {
    if (visible && !htmlContent) {
      setLoading(true);
      setError(false);
      getLegalPage('terms-of-service')
        .then((res) => {
          if (res.data?.content) {
            setHtmlContent(res.data.content);
          } else {
            setError(true);
          }
        })
        .catch((err) => {
          console.error('[TermsModal] Failed to load legal page:', err);
          setError(true);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [visible, htmlContent]);

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (htmlContent && !error) {
      return (
        <RenderHtml
          contentWidth={windowWidth - spacing.lg * 2 - spacing.xl * 2}
          source={{ html: htmlContent }}
          baseStyle={htmlBaseStyle}
          tagsStyles={htmlTagsStyles}
        />
      );
    }

    // Fallback to hardcoded content
    return (
      <Text style={styles.modalBody}>
        {FALLBACK_TERMS_CONTENT}
      </Text>
    );
  };

  return (
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
            {renderContent()}
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
};

const htmlBaseStyle = {
  color: colors.textSecondary,
  fontSize: 14,
  lineHeight: 20,
};

const htmlTagsStyles = {
  h1: { color: colors.text, fontSize: 18, fontWeight: fontWeight.bold as any },
  h2: { color: colors.text, fontSize: 16, fontWeight: fontWeight.semibold as any },
  h3: { color: colors.text, fontSize: 15, fontWeight: fontWeight.semibold as any },
  p: { color: colors.textSecondary, marginBottom: 8 },
  strong: { color: colors.text, fontWeight: fontWeight.semibold as any },
  a: { color: colors.primary },
  li: { color: colors.textSecondary },
};

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
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
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
