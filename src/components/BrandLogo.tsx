import React, {useEffect, useState} from 'react';
import {LayoutChangeEvent, Platform, StyleSheet, Text, View} from 'react-native';
import Animated, {Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming} from 'react-native-reanimated';

type Props = {
  title?: string;
  underlineWidth?: number; // fallback width if measurement not available
  play?: boolean;
  delay?: number; // when to start drawing the line + car
  titleDelay?: number; // when to reveal the title/icon after the line anim begins
  carStopAt?: number; // where the car should stop relative to underline start
};

const BLUE_TEXT = '#ffffff';
const UNDERLINE_COLOR = '#e6f3ff';

export default function BrandLogo({
  title = 'Inspecto',
  underlineWidth = 160,
  play = true,
  delay = 0,
  titleDelay = 400,
  carStopAt = 28,
}: Props) {
  const [measured, setMeasured] = useState<number | null>(null);
  const width = measured ?? underlineWidth;

  const lineW = useSharedValue(0);
  const carX = useSharedValue(-18);
  const wrapOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(8);

  useEffect(() => {
    if (!play) return;
    wrapOpacity.value = withTiming(1, {duration: 200});
    lineW.value = withDelay(delay, withTiming(width, {duration: 700, easing: Easing.out(Easing.cubic)}));
    carX.value = withDelay(delay, withTiming(Math.min(carStopAt, width - 18), {duration: 700, easing: Easing.out(Easing.cubic)}));
    // reveal title/icon slightly after drawing begins
    titleOpacity.value = withDelay(delay + titleDelay, withTiming(1, {duration: 450}));
    titleY.value = withDelay(delay + titleDelay, withTiming(0, {duration: 450}));
  }, [delay, play, width, lineW, carX, wrapOpacity, titleDelay, carStopAt, titleOpacity, titleY]);

  const lineStyle = useAnimatedStyle(() => ({width: lineW.value}));
  const carStyle = useAnimatedStyle(() => ({transform: [{translateX: carX.value}]}));
  const wrapStyle = useAnimatedStyle(() => ({opacity: wrapOpacity.value}));
  const titleStyle = useAnimatedStyle(() => ({opacity: titleOpacity.value, transform: [{translateY: titleY.value}]}));

  const onTextLayout = (e: LayoutChangeEvent) => {
    setMeasured(e.nativeEvent.layout.width + 8); // small padding
  };

  return (
    <Animated.View style={[styles.wrap, wrapStyle]}>
      <Animated.View style={[styles.titleRow, titleStyle]}>
        <View style={styles.wrench} />
        <Text onLayout={onTextLayout} style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </Animated.View>
      <View style={styles.underlineRow}>
        <Animated.View style={[styles.underline, lineStyle]} />
        <Animated.View style={[styles.car, carStyle]}>
          <View style={styles.carBody}>
            <View style={styles.carWindow} />
          </View>
          <View style={[styles.wheel, styles.leftWheel]} />
          <View style={[styles.wheel, styles.rightWheel]} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {alignItems: 'center'},
  titleRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  title: {color: BLUE_TEXT, fontSize: 40, fontWeight: '800', letterSpacing: 0.5},
  underlineRow: {marginTop: 6, flexDirection: 'row', alignItems: 'center', height: 10},
  underline: {height: 3, backgroundColor: UNDERLINE_COLOR, borderRadius: 3},
  car: {position: 'absolute', left: 0, width: 54, height: 24, transform: [{translateX: -18}]},
  carBody: {position: 'absolute', left: 8, right: 8, bottom: 8, top: 6, backgroundColor: '#f8fbff', borderRadius: 6},
  carWindow: {position: 'absolute', left: 14, top: -8, width: 22, height: 12, backgroundColor: '#e3f2ff', borderTopLeftRadius: 6, borderTopRightRadius: 6},
  wheel: {position: 'absolute', bottom: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#0b2447'},
  leftWheel: {left: 12},
  rightWheel: {right: 12},
  wrench: {width: 18, height: 18, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#e6f3ff', borderRadius: 2, transform: [{rotate: '45deg'}]},
});
