import React, {useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  GestureResponderEvent,
  PanResponder,
  Animated,
} from 'react-native';
import {PRIMARY} from '../utils/theme';

type Props = {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (val: number) => void;
  label?: string;
  showValueBadge?: boolean;
};

const clamp = (val: number, min: number, max: number) =>
  Math.min(Math.max(val, min), max);

const DiscreteSlider: React.FC<Props> = ({
  min = 0,
  max = 10,
  step = 1,
  value,
  onChange,
  label,
  showValueBadge = true,
}) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const [trackLeft, setTrackLeft] = useState(0);
  const trackRef = useRef<View | null>(null);
  const steps = useMemo(() => Math.round((max - min) / step), [max, min, step]);
  const thumbScale = useRef(new Animated.Value(1)).current;

  const ratio = trackWidth > 0 ? clamp((value - min) / (max - min), 0, 1) : 0;
  const trackPadding = 4;

  const updateFromX = (x: number) => {
    if (trackWidth <= 0) {
      return;
    }
    const innerWidth = Math.max(trackWidth - trackPadding * 2, 1);
    const pos = clamp(x - trackPadding, 0, innerWidth);
    const raw = min + (pos / innerWidth) * (max - min);
    const snapped = Math.round(raw / step) * step;
    onChange(clamp(snapped, min, max));
  };

  const updateFromPageX = (pageX: number) => {
    const localX = pageX - trackLeft;
    updateFromX(localX);
  };

  const handleGrant = (e: GestureResponderEvent) => {
    updateFromPageX(e.nativeEvent.pageX);
    Animated.spring(thumbScale, {
      toValue: 1.08,
      useNativeDriver: true,
      speed: 14,
      bounciness: 6,
    }).start();
  };
  const handleMove = (e: GestureResponderEvent) => {
    updateFromPageX(e.nativeEvent.pageX);
  };
  const handleRelease = () => {
    Animated.spring(thumbScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 16,
      bounciness: 6,
    }).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: handleGrant,
        onPanResponderMove: handleMove,
        onPanResponderRelease: handleRelease,
        onPanResponderTerminate: handleRelease,
      }),
    [trackWidth, min, max, step, thumbScale],
  );

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        ref={trackRef}
        style={styles.track}
        onLayout={e => {
          setTrackWidth(e.nativeEvent.layout.width);
          requestAnimationFrame(() => {
            trackRef.current?.measure((_x, _y, _w, _h, pageX) => {
              if (typeof pageX === 'number') {
                setTrackLeft(pageX);
              }
            });
          });
        }}
        {...panResponder.panHandlers}>
        <View style={[styles.trackFill, {width: `${ratio * 100}%`}]} />
        <Animated.View
          style={[
            styles.thumb,
            {
              left:
                trackWidth > 0
                  ? trackPadding +
                    ratio * (trackWidth - trackPadding * 2) -
                    16
                  : 0,
              transform: [{scale: thumbScale}],
            },
          ]}
        />
      </View>
      {showValueBadge ? (
        <View style={styles.valueBadge}>
          <Text style={styles.valueText}>{value}</Text>
        </View>
      ) : null}
    </View>
  );
};

export default DiscreteSlider;

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  track: {
    height: 10,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    position: 'relative',
    justifyContent: 'center',
    overflow: 'visible',
    paddingHorizontal: 2,
  },
  trackFill: {
    position: 'absolute',
    left: 2,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: PRIMARY,
  },
  thumb: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: PRIMARY,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: {width: 0, height: 6},
    shadowRadius: 10,
    elevation: 4,
  },
  valueBadge: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: PRIMARY + '15',
  },
  valueText: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY,
  },
});
