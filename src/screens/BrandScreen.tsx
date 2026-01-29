import React, {useEffect, useState} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Image,
  useWindowDimensions,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {useSharedValue, withTiming, withDelay, useAnimatedStyle, Easing} from 'react-native-reanimated';
import {SharedElement} from 'react-navigation-shared-element';
import {useNavigation} from '@react-navigation/native';
import {Eye, EyeOff} from 'lucide-react-native';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {login} from '../store/slices/authSlice';
import {PRIMARY, PRIMARY_DARK} from '../utils/theme';

export default function LoginScreen() {
  const {width} = useWindowDimensions();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(s => s.auth);
  const navigation = useNavigation<any>();
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(8);
  const formOpacity = useSharedValue(0);
  const formY = useSharedValue(8);

  useEffect(() => {
    console.log('[LoginScreen] Mount');
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
  const [showPassword, setShowPassword] = useState(false);
  const [rowWidthMeasured, setRowWidthMeasured] = useState(0);

  useEffect(() => {
    if (auth.status === 'succeeded') {
      navigation.reset({
        index: 0,
        routes: [{name: 'Home'}],
      });
    }
  }, [auth.status, navigation]);

  const onLogin = () => {
    console.log('[LoginScreen] onLogin pressed', {
      email,
      passwordLength: password.length,
    });
    dispatch(login({email, password}));
  };

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: PRIMARY}}>
      <KeyboardAvoidingView behavior={Platform.select({ios: 'padding', android: undefined})} style={styles.container}>
        {/* Decorative background blocks to match intro look */}
        <View style={styles.glossOverlay} />
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
            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder=""
                placeholderTextColor="rgba(0,0,0,0.35)"
                secureTextEntry={!showPassword}
                style={[styles.input, styles.passwordInput]}
              />
              <Pressable onPress={() => setShowPassword(prev => !prev)} hitSlop={12} style={styles.eyeBtn}>
                {showPassword ? <EyeOff size={18} color="#6b7280" /> : <Eye size={18} color="#6b7280" />}
              </Pressable>
            </View>

            <Pressable style={styles.forgotBtn} onPress={() => {}}>
              <Text style={styles.forgotText}>Forgot your password ?</Text>
            </Pressable>

            {auth.status === 'failed' && auth.error ? (
              <Text style={styles.errorText}>{auth.error}</Text>
            ) : null}

            <Pressable
              style={[styles.loginBtn, auth.status === 'loading' && {opacity: 0.6}]}
              // Avoid disabling during an active press to prevent RN warning
              onPress={() => {
                if (auth.status === 'loading') return;
                onLogin();
              }}
            >
              <Text style={styles.loginText}>{auth.status === 'loading' ? 'Logging in.' : 'Log in'}</Text>
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: PRIMARY, justifyContent: 'center', paddingHorizontal: 24},
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
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    height: 44,
    paddingHorizontal: 12,
    borderWidth: 0,
    color: '#111827',
  },
  passwordRow: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 6, height: 44, paddingHorizontal: 12},
  passwordInput: {flex: 1, paddingHorizontal: 0, backgroundColor: 'transparent'},
  eyeBtn: {marginLeft: 8, paddingVertical: 8},
  forgotBtn: {alignSelf: 'flex-end', paddingVertical: 10},
  forgotText: {color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '600'},
  loginBtn: {marginTop: 10, height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: PRIMARY_DARK, shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: {width: 0, height: 8}, shadowRadius: 16, elevation: 4},
  loginText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
  errorText: {color: '#ffebee', backgroundColor: '#b91c1c', padding: 8, borderRadius: 6, marginTop: 8},
  glossOverlay: {position: 'absolute', top: 0, left: 0, right: 0, height: '32%', backgroundColor: 'rgba(255,255,255,0.06)'},
  bgBlockTL: {position: 'absolute', top: 40, left: -10, width: 90, height: 90, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 8},
  bgBlockTR: {position: 'absolute', top: 120, right: -20, width: 70, height: 70, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 8},
  bgBlockBL: {position: 'absolute', bottom: 40, left: -16, width: 130, height: 130, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 16},
  bigWheelShadow: {position: 'absolute', bottom: -40, right: -50, width: 260, height: 260, borderRadius: 130, borderWidth: 16, borderColor: 'rgba(0,0,0,0.10)'},
});

// Inform the navigator which elements are shared
// @ts-expect-error static property used by react-navigation-shared-element
LoginScreen.sharedElements = () => [{id: 'brand-logo'}, {id: 'brand-underline'}];
