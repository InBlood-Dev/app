import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  useDerivedValue,
} from 'react-native-reanimated';
import { colors } from '../theme';

interface DualThumbSliderProps {
  min: number;
  max: number;
  low: number;
  high: number;
  step?: number;
  onValueChange: (low: number, high: number) => void;
  trackColor?: string;
  activeTrackColor?: string;
  thumbColor?: string;
}

const THUMB_SIZE = 24;
const TRACK_HEIGHT = 4;
const HIT_SLOP = 14;

export const DualThumbSlider: React.FC<DualThumbSliderProps> = ({
  min,
  max,
  low,
  high,
  step = 1,
  onValueChange,
  trackColor = colors.border,
  activeTrackColor = colors.primary,
  thumbColor = colors.primary,
}) => {
  // All state lives in shared values for worklet access
  const trackWidth = useSharedValue(0);
  const lowValue = useSharedValue(low);
  const highValue = useSharedValue(high);
  const lowStartPos = useSharedValue(0);
  const highStartPos = useSharedValue(0);
  const minVal = useSharedValue(min);
  const maxVal = useSharedValue(max);
  const stepVal = useSharedValue(step);

  // Sync props into shared values
  useEffect(() => { lowValue.value = low; }, [low]);
  useEffect(() => { highValue.value = high; }, [high]);
  useEffect(() => { minVal.value = min; }, [min]);
  useEffect(() => { maxVal.value = max; }, [max]);
  useEffect(() => { stepVal.value = step; }, [step]);

  // Pure worklet helpers — no closures over props
  const valToPos = (val: number, width: number, lo: number, hi: number) => {
    'worklet';
    if (hi <= lo) return 0;
    return ((val - lo) / (hi - lo)) * width;
  };

  const posToVal = (pos: number, width: number, lo: number, hi: number, s: number) => {
    'worklet';
    if (width <= 0) return lo;
    const raw = lo + (pos / width) * (hi - lo);
    const stepped = Math.round(raw / s) * s;
    return Math.max(lo, Math.min(hi, stepped));
  };

  const emitChange = (newLow: number, newHigh: number) => {
    onValueChange(newLow, newHigh);
  };

  const lowGesture = Gesture.Pan()
    .hitSlop({ top: HIT_SLOP, bottom: HIT_SLOP, left: HIT_SLOP, right: HIT_SLOP })
    .onStart(() => {
      'worklet';
      lowStartPos.value = valToPos(lowValue.value, trackWidth.value, minVal.value, maxVal.value);
    })
    .onUpdate((e) => {
      'worklet';
      const maxPos = valToPos(highValue.value - stepVal.value, trackWidth.value, minVal.value, maxVal.value);
      const newPos = Math.max(0, Math.min(maxPos, lowStartPos.value + e.translationX));
      const newVal = posToVal(newPos, trackWidth.value, minVal.value, maxVal.value, stepVal.value);
      if (newVal !== lowValue.value) {
        lowValue.value = newVal;
        runOnJS(emitChange)(newVal, highValue.value);
      }
    });

  const highGesture = Gesture.Pan()
    .hitSlop({ top: HIT_SLOP, bottom: HIT_SLOP, left: HIT_SLOP, right: HIT_SLOP })
    .onStart(() => {
      'worklet';
      highStartPos.value = valToPos(highValue.value, trackWidth.value, minVal.value, maxVal.value);
    })
    .onUpdate((e) => {
      'worklet';
      const minPos = valToPos(lowValue.value + stepVal.value, trackWidth.value, minVal.value, maxVal.value);
      const newPos = Math.max(minPos, Math.min(trackWidth.value, highStartPos.value + e.translationX));
      const newVal = posToVal(newPos, trackWidth.value, minVal.value, maxVal.value, stepVal.value);
      if (newVal !== highValue.value) {
        highValue.value = newVal;
        runOnJS(emitChange)(lowValue.value, newVal);
      }
    });

  // Derived positions for rendering — react to shared value changes on UI thread
  const lowPos = useDerivedValue(() => {
    return valToPos(lowValue.value, trackWidth.value, minVal.value, maxVal.value);
  });

  const highPos = useDerivedValue(() => {
    return valToPos(highValue.value, trackWidth.value, minVal.value, maxVal.value);
  });

  const lowThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: lowPos.value - THUMB_SIZE / 2 }],
  }));

  const highThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: highPos.value - THUMB_SIZE / 2 }],
  }));

  const activeTrackStyle = useAnimatedStyle(() => ({
    left: lowPos.value,
    width: Math.max(0, highPos.value - lowPos.value),
  }));

  return (
    <View
      style={styles.container}
      onLayout={(e) => { trackWidth.value = e.nativeEvent.layout.width; }}
    >
      {/* Background track */}
      <View style={[styles.track, { backgroundColor: trackColor }]} />

      {/* Active range track */}
      <Animated.View
        style={[styles.activeTrack, { backgroundColor: activeTrackColor }, activeTrackStyle]}
      />

      {/* Low thumb */}
      <GestureDetector gesture={lowGesture}>
        <Animated.View
          style={[styles.thumb, { backgroundColor: thumbColor }, lowThumbStyle]}
        />
      </GestureDetector>

      {/* High thumb */}
      <GestureDetector gesture={highGesture}>
        <Animated.View
          style={[styles.thumb, { backgroundColor: thumbColor }, highThumbStyle]}
        />
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 40,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  activeTrack: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
});
