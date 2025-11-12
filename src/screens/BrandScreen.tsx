import React, {useEffect, useState} from 'react';
import {SafeAreaView, View, Text, StyleSheet, Image, useWindowDimensions, TextInput, Pressable, KeyboardAvoidingView, Platform} from 'react-native';
import Animated, {useSharedValue, withTiming, withDelay, useAnimatedStyle, Easing} from 'react-native-reanimated';
import {SharedElement} from 'react-navigation-shared-element';

const BLUE = '#0ea5e9';

export default function BrandScreen() {
  const {width} = useWindowDimensions();
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(8);
  const formOpacity = useSharedValue(0);
  const formY = useSharedValue(8);

  useEffect(() => {
    titleOpacity.value = withDelay(120, withTiming(1, {duration: 360}));
    titleY.value = withDelay(120, withTiming(0, {duration: 360, easing: Easing.out(Easing.cubic)}));
    formOpacity.value = withDelay(260, withTiming(1, {duration: 360}));
    formY.value = withDelay(260, withTiming(0, {duration: 360, easing: Easing.out(Easing.cubic)}));
  }, [titleOpacity, titleY, formOpacity, formY]);

  const titleStyle = useAnimatedStyle(() => ({opacity: titleOpacity.value, transform: [{translateY: titleY.value}]}));
  const formStyle = useAnimatedStyle(() => ({opacity: formOpacity.value, transform: [{translateY: formY.value}]}));

  // Compute same underline metrics as the intro so the element is identical
  const PAD = 24;
  const ROAD_TOP = 110; // kept for intro parity; not used for centering now
  const stageWidth = Math.max(0, width - PAD * 2);
  const roadWidth = Math.min(width * 0.55, 320);
  const roadLeft = Math.max(0, (stageWidth - roadWidth) / 2);
  // Desired proportions from design: slightly smaller text and a bigger car icon
  const LOGO_SIZE = 30; // dp
  const TITLE_SIZE = 22; // dp
  const UNDERLINE_GAP = 6; // tighter space between row and underline
  // We center the whole block, so no absolute Y; keep values for spacing only
  const rowTop = undefined as unknown as number; // unused placeholder
  // Responsive, narrower form width
  const FORM_WIDTH = Math.min(stageWidth, Math.max(260, stageWidth * 0.78));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rowWidthMeasured, setRowWidthMeasured] = useState(0);

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: BLUE}}>
      <KeyboardAvoidingView behavior={Platform.select({ios: 'padding', android: undefined})} style={styles.container}>
        {/* Decorative background blocks to match intro look */}
        <View style={styles.bgBlockTL} />
        <View style={styles.bgBlockTR} />
        <View style={styles.bgBlockBL} />
        <View style={styles.bigWheelShadow} />

        <View style={styles.center}>
          <Animated.View style={[styles.rowWrap, titleStyle]}>
            {/* Row container wraps content so underline can be 100% width of row */}
            <View style={styles.rowContainer}>
              <View
                style={styles.row}
                onLayout={e => setRowWidthMeasured(Math.round(e.nativeEvent.layout.width))}
              >
                <SharedElement id="brand-logo">
                  <Image
                    source={require('../assets/images/logo.png')}
                    style={[styles.logo, {width: LOGO_SIZE, height: LOGO_SIZE}]}
                    resizeMode="contain"
                  />
                </SharedElement>
                <Text style={styles.title}>Inspecto</Text>
              </View>
              {/* Underline matches row width and aligns to its left edge */}
              <SharedElement id="brand-underline">
                <View style={[styles.underlineFull, {width: Math.max(120, rowWidthMeasured)}]} />
              </SharedElement>
            </View>
          </Animated.View>

          {/* Login form */}
          <Animated.View style={[styles.formWrap, {width: FORM_WIDTH, alignSelf: 'center'}, formStyle]}> 
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor="rgba(0,0,0,0.35)"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />

            <Text style={[styles.label, {marginTop: 12}]}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="rgba(0,0,0,0.35)"
              secureTextEntry
              style={styles.input}
            />

            <Pressable style={styles.forgotBtn} onPress={() => {}}>
              <Text style={styles.forgotText}>Forgot your password ?</Text>
            </Pressable>

            <Pressable style={styles.loginBtn} onPress={() => {}}>
              <Text style={styles.loginText}>Log in</Text>
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BLUE, justifyContent: 'center', paddingHorizontal: 24},
  center: {flex: 1, justifyContent: 'center'},
  rowWrap: {alignItems: 'center'},
  rowContainer: {alignSelf: 'center', alignItems: 'flex-start'},
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  title: {color: '#ffffff', fontSize: 22, fontWeight: '700', letterSpacing: 0.25},
  underlineAbs: {position: 'absolute', height: 2, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 1},
  underlineFull: {height: 2, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 1, marginTop: 6},
  logo: {width: 30, height: 30},

  // Form styles
  formWrap: {width: '100%', marginTop: 18},
  label: {color: '#ffffff', fontSize: 12, marginBottom: 6},
  input: {backgroundColor: '#ffffff', borderRadius: 6, height: 44, paddingHorizontal: 12, borderWidth: 0},
  forgotBtn: {alignSelf: 'flex-end', paddingVertical: 10},
  forgotText: {color: '#e2f3ff', fontSize: 12, fontWeight: '600'},
  loginBtn: {marginTop: 10, height: 48, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b5ea8'},
  loginText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
  bgBlockTL: {position: 'absolute', top: 40, left: -10, width: 90, height: 90, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8},
  bgBlockTR: {position: 'absolute', top: 120, right: -20, width: 70, height: 70, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8},
  bgBlockBL: {position: 'absolute', bottom: 40, left: -16, width: 130, height: 130, backgroundColor: 'rgba(0,0,0,0.07)', borderRadius: 16},
  bigWheelShadow: {position: 'absolute', bottom: -40, right: -50, width: 260, height: 260, borderRadius: 130, borderWidth: 16, borderColor: 'rgba(0,0,0,0.10)'},
});

// Inform the navigator which elements are shared
// @ts-expect-error static property used by react-navigation-shared-element
BrandScreen.sharedElements = () => [{id: 'brand-logo'}, {id: 'brand-underline'}];
