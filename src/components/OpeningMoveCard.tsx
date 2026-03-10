import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '../types';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../theme';

interface OpeningMoveCardProps {
  message: Message;
  isOwn: boolean;
  onReply?: () => void;
}

export const OpeningMoveCard: React.FC<OpeningMoveCardProps> = ({ message, isOwn, onReply }) => {
  if (!message.openingMoveQuestion || !message.openingMoveAnswer) {
    return null;
  }

  if (isOwn) {
    return (
      <View style={[styles.container, styles.ownContainer]}>
        <Text style={styles.ownLabel}>Your opening move</Text>
        <Text style={styles.question}>{message.openingMoveQuestion}</Text>
        <Text style={styles.ownAnswer}>{message.openingMoveAnswer}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.otherContainer]}>
      <View style={styles.accentBorder} />
      <View style={styles.content}>
        <Text style={styles.question}>{message.openingMoveQuestion}</Text>
        <Text style={styles.answer}>{message.openingMoveAnswer}</Text>
        {onReply && (
          <Pressable style={styles.replyButton} onPress={onReply}>
            <Ionicons name="chatbubble-outline" size={14} color={colors.text} />
            <Text style={styles.replyText}>Reply</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  otherContainer: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    maxWidth: '85%',
    backgroundColor: colors.card,
  },
  ownContainer: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    backgroundColor: colors.card,
    opacity: 0.6,
    padding: spacing.md,
  },
  accentBorder: {
    width: 4,
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  question: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
  answer: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.regular,
    color: colors.text,
    lineHeight: 20,
  },
  ownAnswer: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.regular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  ownLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  replyText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
});
