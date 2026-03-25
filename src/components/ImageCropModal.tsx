import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as ImageManipulator from 'expo-image-manipulator';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageCropModalProps {
  visible: boolean;
  imageUri: string;
  aspectRatio?: [number, number];
  onCropComplete: (croppedUri: string) => void;
  onCancel: () => void;
}

const HEADER_HEIGHT = 60;
const FOOTER_HEIGHT = 80;
const CROP_AREA_PADDING = 24;

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  visible,
  imageUri,
  aspectRatio = [3, 4],
  onCropComplete,
  onCancel,
}) => {
  const [cropping, setCropping] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Store original image dimensions in a ref for sync access
  const imageSizeRef = useRef({ width: 0, height: 0 });

  // Calculate crop frame dimensions
  const availableWidth = SCREEN_WIDTH - CROP_AREA_PADDING * 2;
  const availableHeight = SCREEN_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT - CROP_AREA_PADDING * 2;
  const cropAspect = aspectRatio[0] / aspectRatio[1];

  let cropWidth: number;
  let cropHeight: number;
  if (availableWidth / availableHeight < cropAspect) {
    cropWidth = availableWidth;
    cropHeight = availableWidth / cropAspect;
  } else {
    cropHeight = availableHeight;
    cropWidth = availableHeight * cropAspect;
  }

  // The crop container area (between header and footer)
  const containerHeight = SCREEN_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT;

  // Animation values
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Store rendered image dimensions (how the image actually appears at scale=1)
  const renderedImgW = useSharedValue(0);
  const renderedImgH = useSharedValue(0);
  // Store shared crop dimensions for worklet access
  const cropW = useSharedValue(cropWidth);
  const cropH = useSharedValue(cropHeight);

  const clampTranslation = (tx: number, ty: number, s: number, rw: number, rh: number, cw: number, ch: number) => {
    'worklet';
    if (!rw || !rh) return { x: tx, y: ty };
    const scaledW = rw * s;
    const scaledH = rh * s;
    const maxTx = Math.max(0, (scaledW - cw) / 2);
    const maxTy = Math.max(0, (scaledH - ch) / 2);
    return {
      x: Math.min(maxTx, Math.max(-maxTx, tx)),
      y: Math.min(maxTy, Math.max(-maxTy, ty)),
    };
  };

  const handleImageLoad = useCallback(() => {
    Image.getSize(
      imageUri,
      (w, h) => {
        imageSizeRef.current = { width: w, height: h };
        setImageLoaded(true);
        setImageError(false);

        // Calculate the rendered size of the image at scale=1
        // The Image component has style width=cropWidth and height=containerHeight
        // with resizeMode='contain', so we calculate the actual fit
        const displayW = cropWidth;
        const displayH = containerHeight;
        const imgAspect = w / h;
        const containerAspect = displayW / displayH;

        let renderW: number;
        let renderH: number;
        if (imgAspect > containerAspect) {
          renderW = displayW;
          renderH = displayW / imgAspect;
        } else {
          renderH = displayH;
          renderW = displayH * imgAspect;
        }

        renderedImgW.value = renderW;
        renderedImgH.value = renderH;
        cropW.value = cropWidth;
        cropH.value = cropHeight;

        // Initial scale so the image fills the crop frame
        const scaleX = cropWidth / renderW;
        const scaleY = cropHeight / renderH;
        const initialScale = Math.max(scaleX, scaleY);

        scale.value = initialScale;
        savedScale.value = initialScale;
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      },
      () => {
        // Image.getSize failed
        setImageError(true);
        setImageLoaded(false);
      },
    );
  }, [imageUri, cropWidth, cropHeight, containerHeight, scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY, renderedImgW, renderedImgH, cropW, cropH]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      'worklet';
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      'worklet';
      // Min scale: image must fill crop frame
      const minSx = cropW.value / renderedImgW.value;
      const minSy = cropH.value / renderedImgH.value;
      const minS = Math.max(minSx, minSy, 0.1);
      const maxS = 5;
      const clamped = Math.min(maxS, Math.max(minS, scale.value));

      scale.value = withSpring(clamped, { damping: 20, stiffness: 200 });
      savedScale.value = clamped;

      const c = clampTranslation(translateX.value, translateY.value, clamped, renderedImgW.value, renderedImgH.value, cropW.value, cropH.value);
      translateX.value = withSpring(c.x, { damping: 20, stiffness: 200 });
      translateY.value = withSpring(c.y, { damping: 20, stiffness: 200 });
      savedTranslateX.value = c.x;
      savedTranslateY.value = c.y;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      'worklet';
      const c = clampTranslation(translateX.value, translateY.value, scale.value, renderedImgW.value, renderedImgH.value, cropW.value, cropH.value);
      translateX.value = withSpring(c.x, { damping: 20, stiffness: 200 });
      translateY.value = withSpring(c.y, { damping: 20, stiffness: 200 });
      savedTranslateX.value = c.x;
      savedTranslateY.value = c.y;
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleCrop = useCallback(async () => {
    const imgW = imageSizeRef.current.width;
    const imgH = imageSizeRef.current.height;
    if (!imgW || !imgH) return;

    setCropping(true);
    try {
      // Read current animation values (gestures have ended, springs settled)
      const currentScale = savedScale.value;
      const currentTx = savedTranslateX.value;
      const currentTy = savedTranslateY.value;
      const rw = renderedImgW.value;
      const rh = renderedImgH.value;

      // The rendered image at scale=1 has size (rw, rh) centered in the crop container.
      // After transforms: scaled by currentScale, translated by (currentTx, currentTy).
      // The crop frame is centered in the same container.

      // Visible region of the scaled image that falls inside the crop frame:
      const scaledRW = rw * currentScale;
      const scaledRH = rh * currentScale;

      // Image top-left relative to crop center (crop frame center = origin)
      const imgLeft = -(scaledRW / 2) + currentTx;
      const imgTop = -(scaledRH / 2) + currentTy;

      // Crop frame top-left relative to center
      const cropLeft = -(cropWidth / 2);
      const cropTop = -(cropHeight / 2);

      // Origin in scaled-rendered-image space
      const originXScaled = cropLeft - imgLeft;
      const originYScaled = cropTop - imgTop;

      // Convert from rendered-image space to original pixel space
      // rendered size maps to original size: ratio = imgW / rw
      const renderToOrigX = imgW / rw;
      const renderToOrigY = imgH / rh;

      const originX = Math.max(0, Math.round((originXScaled / currentScale) * renderToOrigX));
      const originY = Math.max(0, Math.round((originYScaled / currentScale) * renderToOrigY));
      const w = Math.min(
        imgW - originX,
        Math.round((cropWidth / currentScale) * renderToOrigX),
      );
      const h = Math.min(
        imgH - originY,
        Math.round((cropHeight / currentScale) * renderToOrigY),
      );

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ crop: { originX, originY, width: Math.max(1, w), height: Math.max(1, h) } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );

      onCropComplete(result.uri);
    } catch (e) {
      console.error('[ImageCropModal] Crop failed:', e);
      // If crop fails, return original image
      onCropComplete(imageUri);
    } finally {
      setCropping(false);
    }
  }, [imageUri, cropWidth, cropHeight, savedScale, savedTranslateX, savedTranslateY, renderedImgW, renderedImgH, onCropComplete]);

  const handleCancel = useCallback(() => {
    setImageLoaded(false);
    setImageError(false);
    imageSizeRef.current = { width: 0, height: 0 };
    onCancel();
  }, [onCancel]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleCancel}
    >
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleCancel} style={styles.headerButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Crop Photo</Text>
          <Pressable
            onPress={handleCrop}
            style={[styles.headerButton, styles.doneButton]}
            disabled={cropping || !imageLoaded}
          >
            {cropping ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text style={[styles.doneText, (!imageLoaded) && { opacity: 0.5 }]}>Done</Text>
            )}
          </Pressable>
        </View>

        {/* Crop area */}
        <View style={[styles.cropContainer, { height: containerHeight }]}>
          {imageError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Failed to load image</Text>
            </View>
          ) : (
            <>
              {/* Image layer */}
              <GestureDetector gesture={composedGesture}>
                <Animated.View style={[styles.imageContainer, imageAnimatedStyle]}>
                  <Image
                    source={{ uri: imageUri }}
                    style={{ width: cropWidth, height: containerHeight }}
                    resizeMode="contain"
                    onLoad={handleImageLoad}
                    onError={() => setImageError(true)}
                  />
                </Animated.View>
              </GestureDetector>

              {/* Overlay with crop window cutout */}
              <View style={styles.overlayContainer} pointerEvents="none">
                {/* Top overlay */}
                <View style={[styles.overlay, { height: (containerHeight - cropHeight) / 2 }]} />
                {/* Middle row */}
                <View style={styles.middleRow}>
                  <View style={[styles.overlay, { width: (SCREEN_WIDTH - cropWidth) / 2 }]} />
                  {/* Crop frame */}
                  <View style={[styles.cropFrame, { width: cropWidth, height: cropHeight }]}>
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />
                  </View>
                  <View style={[styles.overlay, { width: (SCREEN_WIDTH - cropWidth) / 2 }]} />
                </View>
                {/* Bottom overlay */}
                <View style={[styles.overlay, { flex: 1 }]} />
              </View>
            </>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerHint}>
            Pinch to zoom, drag to adjust
          </Text>
        </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
};

const CORNER_SIZE = 20;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 70,
    alignItems: 'center',
  },
  doneButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  cancelText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  doneText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  cropContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  imageContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  middleRow: {
    flexDirection: 'row',
  },
  cropFrame: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTL: {
    top: -1,
    left: -1,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: colors.text,
  },
  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: colors.text,
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: colors.text,
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: colors.text,
  },
  footer: {
    height: FOOTER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
});
