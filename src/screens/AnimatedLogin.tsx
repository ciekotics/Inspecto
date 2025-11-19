import React, {useEffect} from 'react';
import {useWindowDimensions, View, StyleSheet, SafeAreaView, Image, Pressable} from 'react-native';
import Animated, {Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming} from 'react-native-reanimated';
import {SharedElement} from 'react-navigation-shared-element';
import {useNavigation} from '@react-navigation/native';
import {PRIMARY} from '../utils/theme';

function AnimatedLoginScreen() {
  const {width, height} = useWindowDimensions();
  const navigation = useNavigation<any>();

  const carX = useSharedValue(0);
  const roadOffset = useSharedValue(0);
  const carBounce = useSharedValue(0);

  useEffect(() => {
    const roadWidth = Math.min(width * 0.55, 320);
    // Move a subtle texture continuously over the road
    roadOffset.value = withRepeat(withTiming(-roadWidth, {duration: 2400, easing: Easing.linear}), -1, false);
    // Slight forward drift and suspension bounce so car feels alive
    carX.value = withRepeat(
      withSequence(
        withTiming(10, {duration: 900, easing: Easing.inOut(Easing.cubic)}),
        withTiming(6, {duration: 900, easing: Easing.inOut(Easing.cubic)})
      ),
      -1,
      false,
    );
    carBounce.value = withRepeat(
      withSequence(
        withTiming(-2, {duration: 300, easing: Easing.inOut(Easing.cubic)}),
        withTiming(0, {duration: 300, easing: Easing.inOut(Easing.cubic)}),
        withTiming(2, {duration: 300, easing: Easing.inOut(Easing.cubic)}),
        withTiming(0, {duration: 300, easing: Easing.inOut(Easing.cubic)}),
      ),
      -1,
      false,
    );

    // Transition to login screen shortly after intro starts; tap also skips
    const id = setTimeout(() => {
      try { navigation.navigate('Login'); } catch {}
    }, 1600);

    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const carStyle = useAnimatedStyle(() => ({transform: [{translateX: carX.value}, {translateY: carBounce.value}]}));
  

  const roadWidth = Math.min(width * 0.55, 320);
  const PAD = 24; // container horizontal padding
  const stageWidth = Math.max(0, width - PAD * 2);
  // Center the road by building a centered inner host. We still keep
  // metrics for car placement relative to the road's own width.
  const roadLeft = Math.max(0, (stageWidth - roadWidth) / 2);
  const textureStyle = useAnimatedStyle(() => ({ transform: [{translateX: roadOffset.value}] }));
  const ROAD_TOP = 110;

  // Measure car image and place it flush with the road line while preserving aspect ratio
  const carSrc = require('../assets/images/car.png');
  const {width: srcW = 64, height: srcH = 32} = Image.resolveAssetSource(carSrc) ?? {};
  const aspect = srcW > 0 && srcH > 0 ? srcW / srcH : 2; // fallback aspect if resolution missing
  const targetCarWidth = Math.min(Math.max(roadWidth * 0.22, 48), 140);
  const targetCarHeight = Math.max(targetCarWidth / aspect, 24);
  const CAR_BASELINE_ADJUST = 1; // tweak so tires visually sit on the line
  const carTop = ROAD_TOP - targetCarHeight + CAR_BASELINE_ADJUST;

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: PRIMARY}}>
      <View style={[styles.container, {minHeight: height}]}> 
        {/* Decorative background blocks */}
        <View style={styles.glossOverlay} />
        <View style={styles.bgBlockTL} />
        <View style={styles.bgBlockTR} />
        <View style={styles.bgBlockBL} />
        <View style={styles.bigWheelShadow} />

        {/* Centered car running on a road */}
        <Pressable style={styles.stageCenter} onPress={() => navigation.navigate('Login')}>
          {/* Road and car are laid out within a centered host to avoid
              any parent width ambiguities across devices. */}
          <View style={[styles.roadHost, {left: PAD, right: PAD, top: ROAD_TOP}]}> 
            <View style={{width: roadWidth, alignSelf: 'center'}}>
              {/* Road base (shared underline) */}
              <SharedElement id="brand-underline">
                <View style={[styles.roadLine]} />
              </SharedElement>

              {/* Car positioned relative to road width so it always sits on it */}
              <Animated.View
                style={[
                  styles.carContainer,
                  {
                    left: roadWidth * 0.28,
                    top: -targetCarHeight + CAR_BASELINE_ADJUST,
                    width: targetCarWidth,
                    height: targetCarHeight,
                  },
                  carStyle,
                ]}
              >
                <SharedElement id="brand-logo">
                  <Animated.Image source={carSrc} style={styles.carImage} resizeMode="contain" />
                </SharedElement>
              </Animated.View>
            </View>
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  glossOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '36%',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  stageCenter: {alignItems: 'center', justifyContent: 'center', height: 260},
  roadHost: {position: 'absolute'},
  roadLine: { height: 3, backgroundColor: '#ffffff', borderRadius: 2 },
  textureClip: { position: 'absolute', top: 110, overflow: 'hidden', height: 10 },
  textureLane: { position: 'absolute', top: 0, height: 10 },
  textureBar: { position: 'absolute', top: -2, width: 6, height: 3, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 2 },
  carContainer: {position: 'absolute', top: 85, width: 64, height: 32},
  carImage: {width: '100%', height: '100%'},

  // Simple backdrop blocks for depth
  bgBlockTL: {
    position: 'absolute',
    top: 40,
    left: -10,
    width: 90,
    height: 90,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 8,
  },
  bgBlockTR: {
    position: 'absolute',
    top: 120,
    right: -20,
    width: 70,
    height: 70,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 8,
  },
  bgBlockBL: {
    position: 'absolute',
    bottom: 40,
    left: -16,
    width: 130,
    height: 130,
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius: 16,
  },
  bigWheelShadow: {
    position: 'absolute',
    bottom: -40,
    right: -50,
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 16,
    borderColor: 'rgba(0,0,0,0.10)',
  },
});

export default AnimatedLoginScreen;
