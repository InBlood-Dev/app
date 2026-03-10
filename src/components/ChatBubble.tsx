import React from 'react';
import { StyleSheet, View, Text, Image, Pressable } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '../types';
import { colors, borderRadius, fontSize, fontWeight, spacing } from '../theme';
import * as Haptics from 'expo-haptics';

interface ChatBubbleProps {
  message: Message;
  isOwn: boolean;
  showTimestamp?: boolean;
  onLongPress?: (message: Message) => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  isOwn,
  showTimestamp = true,
  onLongPress,
}) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusIcon = () => {
    switch (message.status) {
      case 'sending':
        return <Ionicons name="time-outline" size={12} color={colors.textMuted} />;
      case 'sent':
        return <Ionicons name="checkmark" size={12} color={colors.textMuted} />;
      case 'delivered':
        return <Ionicons name="checkmark-done" size={12} color={colors.textMuted} />;
      case 'seen':
        return <Ionicons name="checkmark-done" size={12} color={colors.primary} />;
      case 'failed':
        return <Ionicons name="alert-circle" size={12} color={colors.error} />;
      default:
        return null;
    }
  };

  const handleLongPress = () => {
    if (onLongPress && !message.isDeleted) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onLongPress(message);
    }
  };

  return (
    <Animated.View
      entering={FadeInUp.duration(300)}
      style={[
        styles.container,
        isOwn ? styles.ownContainer : styles.otherContainer,
      ]}
    >
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={500}
        style={[
          styles.bubble,
          isOwn ? styles.ownBubble : styles.otherBubble,
          message.isDeleted && styles.deletedBubble,
        ]}
      >
        {message.type === 'image' && message.mediaUrl && !message.isDeleted && (
          <Image
            source={{ uri: message.mediaUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        )}
        <Text
          style={[
            styles.text,
            isOwn ? styles.ownText : styles.otherText,
            message.isDeleted && styles.deletedText,
          ]}
        >
          {message.text}
        </Text>
      </Pressable>

      {showTimestamp && (
        <View style={[styles.meta, isOwn && styles.ownMeta]}>
          <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
          {isOwn && <View style={styles.status}>{getStatusIcon()}</View>}
        </View>
      )}
    </Animated.View>
  );
};

interface TypingIndicatorProps {
  name: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ name }) => {
  return (
    <Animated.View
      entering={FadeInUp.duration(300)}
      style={[styles.container, styles.otherContainer]}
    >
      <View style={[styles.bubble, styles.otherBubble, styles.typingBubble]}>
        <View style={styles.typingDots}>
          <Animated.View style={[styles.dot, styles.dot1]} />
          <Animated.View style={[styles.dot, styles.dot2]} />
          <Animated.View style={[styles.dot, styles.dot3]} />
        </View>
      </View>
      <Text style={styles.typingText}>{name} is typing...</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
    maxWidth: '80%',
  },
  ownContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  otherContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
  },
  ownBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: spacing.xs,
  },
  otherBubble: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: spacing.xs,
  },
  text: {
    fontSize: fontSize.md,
    lineHeight: 20,
  },
  ownText: {
    color: colors.text,
  },
  otherText: {
    color: colors.text,
  },
  deletedBubble: {
    opacity: 0.6,
  },
  deletedText: {
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  image: {
    width: 200,
    height: 150,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  ownMeta: {
    flexDirection: 'row-reverse',
  },
  timestamp: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  status: {
    marginLeft: spacing.xs,
  },
  typingBubble: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.6,
  },
  dot3: {
    opacity: 0.8,
  },
  typingText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
