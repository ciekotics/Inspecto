import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Animated,
  Modal,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {ChevronLeft, Check, Eye, Image as ImageIcon, X} from 'lucide-react-native';
import {
  launchImageLibrary,
  launchCamera,
  ImagePickerResponse,
} from 'react-native-image-picker';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  PinchGestureHandler,
  TapGestureHandler,
  State,
} from 'react-native-gesture-handler';
import {PRIMARY} from '../utils/theme';
import {client} from '../utils/apiClient';
import {loadDraft, saveDraft} from '../utils/draftStorage';
import {store} from '../store/store';

type RouteParams = {
  sellCarId?: string | number;
};

type YesNo = 'Yes' | 'No' | '';

const EngineInspectionScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const {sellCarId} = (route.params as RouteParams) || {};
  const formattedSellCarId =
    sellCarId == null ? '' : String(sellCarId).trim();

  const [inspectionId, setInspectionId] = useState<string | number>('');
  const [engineWorking, setEngineWorking] = useState<YesNo>('');
  const [engineCost, setEngineCost] = useState('');
  const [engineImage, setEngineImage] = useState<string | null>(null);
  const [radiator, setRadiator] = useState<YesNo>('');
  const [silencer, setSilencer] = useState<YesNo>('');
  const [starterMotor, setStarterMotor] = useState<YesNo>('');
  const [engineOilLevel, setEngineOilLevel] = useState<YesNo>('');
  const [coolantAvailability, setCoolantAvailability] = useState<YesNo>('');
  const [engineMounting, setEngineMounting] = useState<YesNo>('');
  const [battery, setBattery] = useState<YesNo>('');
  const [engineOilLeakage, setEngineOilLeakage] = useState<YesNo>('');
  const [coolantOilLeakage, setCoolantOilLeakage] = useState<YesNo>('');
  const [abnormalNoise, setAbnormalNoise] = useState<YesNo>('');
  const [blackSmoke, setBlackSmoke] = useState<YesNo>('');
  const [defectiveBelts, setDefectiveBelts] = useState<YesNo>('');
  const [highlightPositives, setHighlightPositives] = useState('');
  const [otherComments, setOtherComments] = useState('');
  const [refurbCostTotal, setRefurbCostTotal] = useState('');
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const pinchScale = useRef(new Animated.Value(1)).current;
  const baseScale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const combinedScale = Animated.multiply(baseScale, pinchScale);
  const doubleTapRef = useRef<TapGestureHandler | null>(null);

  const requiredCount = useMemo(() => 15, []);

  const filledCount = useMemo(() => {
    let count = 0;
    if (engineWorking) count += 1;
    if (engineCost) count += 1;
    if (engineImage) count += 1;
    if (radiator) count += 1;
    if (silencer) count += 1;
    if (starterMotor) count += 1;
    if (engineOilLevel) count += 1;
    if (coolantAvailability) count += 1;
    if (engineMounting) count += 1;
    if (battery) count += 1;
    if (engineOilLeakage) count += 1;
    if (coolantOilLeakage) count += 1;
    if (abnormalNoise) count += 1;
    if (blackSmoke) count += 1;
    if (defectiveBelts) count += 1;
    return count;
  }, [
    engineWorking,
    engineCost,
    engineImage,
    radiator,
    silencer,
    starterMotor,
    engineOilLevel,
    coolantAvailability,
    engineMounting,
    battery,
    engineOilLeakage,
    coolantOilLeakage,
    abnormalNoise,
    blackSmoke,
    defectiveBelts,
  ]);

  const resetAll = () => {
    setEngineWorking('');
    setEngineCost('');
    setEngineImage(null);
    setRadiator('');
    setSilencer('');
    setStarterMotor('');
    setEngineOilLevel('');
    setCoolantAvailability('');
    setEngineMounting('');
    setBattery('');
    setEngineOilLeakage('');
    setCoolantOilLeakage('');
    setAbnormalNoise('');
    setBlackSmoke('');
    setDefectiveBelts('');
    setHighlightPositives('');
    setOtherComments('');
    setRefurbCostTotal('');
  };

  const handlePick = async (mode: 'camera' | 'library') => {
    const resp: ImagePickerResponse =
      mode === 'camera'
        ? await launchCamera({mediaType: 'photo', quality: 0.8})
        : await launchImageLibrary({mediaType: 'photo', quality: 0.8});
    if (resp.didCancel || !resp.assets || resp.assets.length === 0) {
      setPickerVisible(false);
      return;
    }
    const uri = resp.assets[0]?.uri;
    if (uri) {
      setEngineImage(uri);
    }
    setPickerVisible(false);
  };

  const renderToggle = (label: string, value: YesNo, onChange: (v: YesNo) => void) => (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={styles.togglePills}>
        {(['Yes', 'No'] as YesNo[]).map(opt => {
          const active = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={[
                styles.pill,
                active ? styles.pillActive : styles.pillInactive,
              ]}>
              <Text
                style={[
                  styles.pillText,
                  active ? styles.pillTextActive : null,
                ]}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const appendFileToFormData = async (
    fd: FormData,
    fieldName: string,
    uri: string,
  ) => {
    const ext = uri.split('.').pop() || 'jpg';
    const mime =
      ext === 'png'
        ? 'image/png'
        : ext === 'jpeg' || ext === 'jpg'
        ? 'image/jpeg'
        : 'application/octet-stream';
    const isRemote = uri.startsWith('http://') || uri.startsWith('https://');
    if (isRemote) {
      const res = await fetch(uri);
      const blob = await res.blob();
      const typedBlob =
        blob.type && blob.type.length > 0
          ? blob
          : new Blob([blob], {type: mime || 'application/octet-stream'});
      (typedBlob as any).name = `${fieldName}.${ext}`;
      fd.append(fieldName, typedBlob as any);
    } else {
      const normalizedUri =
        uri.startsWith('file://') || uri.startsWith('content://') ? uri : uri;
      fd.append(fieldName, {
        uri: normalizedUri,
        name: `${fieldName}.${ext}`,
        type: mime,
      } as any);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const normYesNo = (val: any): YesNo => {
      const v = (val || '').toString().trim().toLowerCase();
      if (v === 'yes' || v === 'y' || v === 'true' || v === '1') return 'Yes';
      if (v === 'no' || v === 'n' || v === 'false' || v === '0') return 'No';
      return '';
    };
    const hydrateLocal = async () => {
      if (!formattedSellCarId) return;
      const draft = loadDraft<any>(formattedSellCarId, 'engine');
      if (draft && !cancelled) {
        setEngineWorking(draft.engineWorking || '');
        setEngineCost(draft.engineCost || '');
        setEngineImage(draft.engineImage || null);
        setRadiator(draft.radiator || '');
        setSilencer(draft.silencer || '');
        setStarterMotor(draft.starterMotor || '');
        setEngineOilLevel(draft.engineOilLevel || '');
        setCoolantAvailability(draft.coolantAvailability || '');
        setEngineMounting(draft.engineMounting || '');
        setBattery(draft.battery || '');
        setEngineOilLeakage(draft.engineOilLeakage || '');
        setCoolantOilLeakage(draft.coolantOilLeakage || '');
        setAbnormalNoise(draft.abnormalNoise || '');
        setBlackSmoke(draft.blackSmoke || '');
        setDefectiveBelts(draft.defectiveBelts || '');
        setHighlightPositives(draft.highlightPositives || '');
        setOtherComments(draft.otherComments || '');
        setRefurbCostTotal(draft.refurbCostTotal || '');
      }
    };

    const fetchExisting = async () => {
      if (!formattedSellCarId) return;
      try {
        setPrefillLoading(true);
        await hydrateLocal();
        const res = await client.get('/api/view-inspection', {
          params: {sellCarId: formattedSellCarId},
        });
        if (cancelled) return;
        const existing = res.data?.data?.allInspections?.[0];
        if (existing?.id != null) {
          setInspectionId(existing.id);
        }
        const engineData =
          existing?.engine ||
          existing?.Engine ||
          existing?.engineInspection ||
          existing?.EngineInspection;
        if (engineData && typeof engineData === 'object') {
          const working =
            engineData.working ||
            engineData.Working ||
            engineData['working '] ||
            {};
          const noise =
            engineData['noise/leakage'] ||
            engineData.noiseLeakage ||
            engineData.noise ||
            {};

          const setYN = (setter: (v: YesNo) => void, key: string) => {
            const val = normYesNo(working[key] || engineData[key]);
            if (val) setter(val);
          };
          const setYNNoise = (setter: (v: YesNo) => void, key: string, altKey?: string) => {
            const raw = noise[key] || (altKey ? noise[altKey] : undefined) || working[key] || engineData[key];
            const val = normYesNo(raw);
            if (val) setter(val);
          };

          setYN(setEngineWorking, 'Engine');
          setYN(setRadiator, 'Radiator');
          setYN(setSilencer, 'Silencer');
          setYN(setStarterMotor, 'Starter Motor');
          setYN(setEngineOilLevel, 'Engine Oil Level');
          setYN(setCoolantAvailability, 'Coolant Availability');
          setYN(setEngineMounting, 'Engine Mounting');
          setYN(setBattery, 'Battery');
          setYNNoise(setEngineOilLeakage, 'Engine Oil Leakage');
          setYNNoise(setCoolantOilLeakage, 'Coolant Oil Leakage');
          setYNNoise(setAbnormalNoise, 'Abnormal Noise');
          setYNNoise(setBlackSmoke, 'Black Smoke/White Smoke', 'Black Smoke / White Smoke');
          setYNNoise(setDefectiveBelts, 'Defective Belts');

          const cost = working['Refurbishment Cost'] || engineData['Refurbishment Cost'];
          if (cost !== undefined && cost !== null && `${cost}`.trim() !== '') {
            setEngineCost(String(cost));
          }

          const img =
            working['Engine image'] ||
            working['Engine Image'] ||
            engineData['Engine image'] ||
            engineData.engineImage ||
            engineData.image;
          if (img) {
            setEngineImage(String(img));
          }

          const pos =
            noise['Highlight Positives'] ||
            noise.highlightPositives ||
            engineData.highlightPositives;
          if (pos !== undefined) {
            setHighlightPositives(String(pos));
          }
          const comments =
            noise['Other Comments'] ||
            noise.otherComments ||
            engineData.otherComments;
          if (comments !== undefined) {
            setOtherComments(String(comments));
          }

          const refurbTotal =
            engineData['Refurbishment Cost (Total)'] ||
            engineData.refurbishmentCostTotal ||
            engineData.RefurbishmentCostTotal;
          if (refurbTotal !== undefined && `${refurbTotal}`.trim() !== '') {
            setRefurbCostTotal(String(refurbTotal));
          }
        }
      } catch (err) {
        console.warn('Failed to prefill engine', err);
      } finally {
        if (!cancelled) {
          setPrefillLoading(false);
        }
      }
    };
    fetchExisting();
    return () => {
      cancelled = true;
    };
  }, [formattedSellCarId]);

  useEffect(() => {
    if (!formattedSellCarId) return;
    const payload = {
      engineWorking,
      engineCost,
      engineImage,
      radiator,
      silencer,
      starterMotor,
      engineOilLevel,
      coolantAvailability,
      engineMounting,
      battery,
      engineOilLeakage,
      coolantOilLeakage,
      abnormalNoise,
      blackSmoke,
      defectiveBelts,
      highlightPositives,
      otherComments,
      refurbCostTotal,
    };
    saveDraft(formattedSellCarId, 'engine', payload);
  }, [
    formattedSellCarId,
    engineWorking,
    engineCost,
    engineImage,
    radiator,
    silencer,
    starterMotor,
    engineOilLevel,
    coolantAvailability,
    engineMounting,
    battery,
    engineOilLeakage,
    coolantOilLeakage,
    abnormalNoise,
    blackSmoke,
    defectiveBelts,
    highlightPositives,
    otherComments,
    refurbCostTotal,
  ]);

  const handleSubmit = async () => {
    setMessage(null);
    if (!formattedSellCarId) {
      setMessage('Missing sellCarId.');
      return;
    }
    const requiredFields: {label: string; val: YesNo}[] = [
      {label: 'Engine', val: engineWorking},
      {label: 'Radiator', val: radiator},
      {label: 'Silencer', val: silencer},
      {label: 'Starter Motor', val: starterMotor},
      {label: 'Engine Oil Level', val: engineOilLevel},
      {label: 'Coolant Availability', val: coolantAvailability},
      {label: 'Engine Mounting', val: engineMounting},
      {label: 'Battery', val: battery},
      {label: 'Engine Oil Leakage', val: engineOilLeakage},
      {label: 'Coolant Oil Leakage', val: coolantOilLeakage},
      {label: 'Abnormal Noise', val: abnormalNoise},
      {label: 'Black Smoke / White Smoke', val: blackSmoke},
      {label: 'Defective Belts', val: defectiveBelts},
    ];
    const missing = requiredFields.find(item => !item.val);
    if (missing) {
      setMessage(`Select ${missing.label}`);
      return;
    }
    if (!engineCost) {
      setMessage('Enter engine refurbishment cost.');
      return;
    }
    if (!engineImage) {
      setMessage('Add engine image.');
      return;
    }

    setSubmitting(true);
    try {
      const working = {
        Engine: engineWorking,
        Radiator: radiator,
        Silencer: silencer,
        'Starter Motor': starterMotor,
        'Engine Oil Level': engineOilLevel,
        'Coolant Availability': coolantAvailability,
        'Engine Mounting': engineMounting,
        Battery: battery,
        'Refurbishment Cost': engineCost || '0',
        'Engine image': '',
      };
      const noise = {
        'Engine Oil Leakage': engineOilLeakage,
        'Coolant Oil Leakage': coolantOilLeakage,
        'Abnormal Noise': abnormalNoise,
        'Black Smoke/White Smoke': blackSmoke,
        'Defective Belts': defectiveBelts,
        'Highlight Positives': highlightPositives,
        'Other Comments': otherComments,
      };
      const reports = {
        working,
        'noise/leakage': noise,
        'Refurbishment Cost (Total)': refurbCostTotal || '0',
      };

      const fd = new FormData();
      fd.append('id', String(inspectionId || formattedSellCarId));
      fd.append('sellCarId', formattedSellCarId);
      fd.append('Reports', JSON.stringify(reports));
      fd.append('deletedFiles', JSON.stringify([]));
      await appendFileToFormData(fd, 'engine', engineImage);

      const token = store.getState().auth.token;
      const resp = await fetch('https://api.marnix.in/api/add-engine-inspection', {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          Accept: '*/*',
        },
        body: fd,
      });
      const text = await resp.text();
      if (!resp.ok) {
        console.error('[Engine] upload failed', {
          status: resp.status,
          statusText: resp.statusText,
          body: text,
        });
        throw new Error(text || 'Failed to save engine inspection');
      }

      setMessage('Engine inspection saved.');
      navigation.navigate('FunctionsInspection', {sellCarId: formattedSellCarId});
    } catch (err: any) {
      setMessage(err?.message || 'Failed to save engine inspection');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={[styles.header, {paddingTop: insets.top + 10, paddingBottom: 10}]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          android_ripple={{color: 'rgba(0,0,0,0.08)'}}>
          <ChevronLeft size={18} color="#111827" strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.headerTitle}>Engine</Text>
        <Pressable style={styles.resetBtn} onPress={resetAll}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Step 5 · Engine</Text>
          <Text style={styles.progressValue}>
            {filledCount}/{requiredCount}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {prefillLoading ? (
          <View style={styles.card}>
            <View style={[styles.skeletonBlock, {width: 160, height: 16}]} />
            <View
              style={[
                styles.skeletonBlock,
                {width: '70%', height: 12, marginTop: 8},
              ]}
            />
            <View
              style={[
                styles.skeletonBlock,
                {width: '100%', height: 46, marginTop: 16},
              ]}
            />
            <View
              style={[
                styles.skeletonBlock,
                {width: '100%', height: 46, marginTop: 10},
              ]}
            />
            <View
              style={[
                styles.skeletonBlock,
                {width: '100%', height: 140, marginTop: 12},
              ]}
            />
          </View>
        ) : (
          <View style={styles.card}>
          <Text style={styles.title}>Is in Working Condition?</Text>

          {renderToggle('Engine *', engineWorking, setEngineWorking)}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Engine refurbishment cost *</Text>
            <TextInput
              style={styles.input}
              value={engineCost}
              onChangeText={setEngineCost}
              keyboardType="numeric"
              placeholder="₹ Enter refurbishment cost"
              placeholderTextColor="#9ca3af"
              autoComplete="off"
            />
          </View>

          <Text style={[styles.sectionTitle, {marginTop: 14}]}>Engine Image *</Text>
          <Pressable style={styles.photoTile} onPress={() => setPickerVisible(true)}>
            {engineImage ? (
              <>
                <Image source={{uri: engineImage}} style={styles.photoImage} resizeMode="cover" />
                <View style={styles.photoBadge}>
                  <Check size={14} color="#fff" />
                </View>
                <Pressable
                  style={styles.eyeIcon}
                  onPress={() => {
                    setPreviewUri(engineImage);
                    setPreviewVisible(true);
                  }}>
                  <Eye size={16} color="#111827" />
                </Pressable>
              </>
            ) : (
              <>
                <ImageIcon size={32} color="#cbd5e1" strokeWidth={2} />
                <Text style={styles.photoText}>Click to upload</Text>
              </>
            )}
          </Pressable>

          {renderToggle('Radiator *', radiator, setRadiator)}
          {renderToggle('Silencer *', silencer, setSilencer)}
          {renderToggle('Starter Motor *', starterMotor, setStarterMotor)}
          {renderToggle('Engine Oil Level *', engineOilLevel, setEngineOilLevel)}
          {renderToggle('Coolant Availability *', coolantAvailability, setCoolantAvailability)}
          {renderToggle('Engine Mounting *', engineMounting, setEngineMounting)}
          {renderToggle('Battery *', battery, setBattery)}

          <Text style={[styles.sectionTitle, {marginTop: 16}]}>Any Noise / Leakage?</Text>
          {renderToggle('Engine Oil Leakage *', engineOilLeakage, setEngineOilLeakage)}
          {renderToggle('Coolant Oil Leakage *', coolantOilLeakage, setCoolantOilLeakage)}
          {renderToggle('Abnormal Noise *', abnormalNoise, setAbnormalNoise)}
          {renderToggle('Black Smoke / White Smoke *', blackSmoke, setBlackSmoke)}

          {renderToggle('Defective Belts *', defectiveBelts, setDefectiveBelts)}

          <Text style={[styles.sectionTitle, {marginTop: 16}]}>Highlight positives</Text>
          <TextInput
            style={[styles.input, {minHeight: 80}]}
            value={highlightPositives}
            onChangeText={setHighlightPositives}
            placeholder="Highlight positives"
            placeholderTextColor="#9ca3af"
            multiline
            autoComplete="off"
          />

          <Text style={[styles.sectionTitle, {marginTop: 12}]}>Other Comments</Text>
          <TextInput
            style={[styles.input, {minHeight: 80}]}
            value={otherComments}
            onChangeText={setOtherComments}
            placeholder="Other comments"
            placeholderTextColor="#9ca3af"
            multiline
            autoComplete="off"
          />

          <View style={[styles.inputGroup, {marginTop: 12}]}>
            <Text style={styles.inputLabel}>Refurbishment Cost (Total)</Text>
            <TextInput
              style={styles.input}
              value={refurbCostTotal}
              onChangeText={setRefurbCostTotal}
              keyboardType="numeric"
              placeholder="₹ 0.00"
              placeholderTextColor="#9ca3af"
              autoComplete="off"
            />
          </View>

          <Pressable
            style={[styles.nextBtn, submitting && {opacity: 0.7}]}
            onPress={handleSubmit}
            disabled={submitting}
            android_ripple={{color: 'rgba(255,255,255,0.15)'}}>
            <Text style={styles.nextLabel}>
              {submitting ? 'Saving...' : 'Save & Next'}
            </Text>
          </Pressable>
          {message ? <Text style={styles.helperText}>{message}</Text> : null}
        </View>
        )}
      </ScrollView>

      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}>
        <View style={styles.previewOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPreviewVisible(false)}
          />
          <View style={styles.previewContent}>
            {previewUri ? (
              <TapGestureHandler
                ref={doubleTapRef}
                numberOfTaps={2}
                onActivated={() => {
                  const next = lastScale.current > 1 ? 1 : 2;
                  lastScale.current = next;
                  baseScale.setValue(next);
                  pinchScale.setValue(1);
                }}>
                <View style={{flex: 1}}>
                  <PinchGestureHandler
                    simultaneousHandlers={doubleTapRef}
                    onGestureEvent={Animated.event(
                      [{nativeEvent: {scale: pinchScale}}],
                      {useNativeDriver: true},
                    )}
                    onHandlerStateChange={e => {
                      if (
                        e.nativeEvent.state === State.END ||
                        e.nativeEvent.state === State.CANCELLED
                      ) {
                        const next =
                          lastScale.current * (e.nativeEvent.scale || 1);
                        const clamped = Math.min(Math.max(next, 1), 4);
                        lastScale.current = clamped;
                        baseScale.setValue(clamped);
                        pinchScale.setValue(1);
                      }
                    }}>
                    <Animated.View style={styles.previewImageWrap}>
                      <Animated.Image
                        source={{uri: previewUri}}
                        style={[
                          styles.previewImage,
                          {transform: [{scale: combinedScale}]},
                        ]}
                        resizeMode="contain"
                      />
                    </Animated.View>
                  </PinchGestureHandler>
                </View>
              </TapGestureHandler>
            ) : null}
            <Pressable
              style={styles.previewClose}
              onPress={() => setPreviewVisible(false)}>
              <X size={16} color="#fff" strokeWidth={3} />
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Add photo</Text>
            <Text style={styles.pickerSubtitle}>Choose source</Text>
            <View style={styles.pickerActions}>
              <Pressable
                style={styles.pickerBtn}
                onPress={() => handlePick('camera')}>
                <Text style={styles.pickerBtnText}>Camera</Text>
              </Pressable>
              <Pressable
                style={styles.pickerBtn}
                onPress={() => handlePick('library')}>
                <Text style={styles.pickerBtnText}>Library</Text>
              </Pressable>
              <Pressable
                style={[styles.pickerBtn, styles.pickerCancel]}
                onPress={() => setPickerVisible(false)}>
                <Text style={[styles.pickerBtnText, {color: '#b91c1c'}]}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default EngineInspectionScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#111827',
    fontSize: 17,
    fontWeight: '700',
  },
  resetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  resetText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
  },
  progressWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  progressValue: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    elevation: 1,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowOffset: {width: 0, height: 10},
    shadowRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
  },
  metaRow: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  metaLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  metaValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  sectionTitle: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  toggleRow: {
    marginTop: 10,
  },
  toggleLabel: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '700',
  },
  togglePills: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillActive: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY + '15',
  },
  pillInactive: {
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  pillTextActive: {
    color: PRIMARY,
  },
  inputGroup: {
    marginTop: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
  },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  photoTile: {
    marginTop: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    minHeight: 160,
    overflow: 'hidden',
  },
  photoImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  photoBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: PRIMARY,
    borderRadius: 10,
    padding: 4,
  },
  eyeIcon: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    zIndex: 2,
  },
  photoText: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
  },
  nextBtn: {
    marginTop: 18,
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOpacity: 0.12,
    shadowOffset: {width: 0, height: 8},
    shadowRadius: 12,
    elevation: 2,
  },
  nextLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  helperText: {
    marginTop: 10,
    fontSize: 12,
    color: '#b91c1c',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerSheet: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: {width: 0, height: 8},
    shadowRadius: 16,
    elevation: 6,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  pickerSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#9ca3af',
  },
  pickerActions: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pickerBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  pickerBtnText: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '700',
  },
  pickerCancel: {
    borderColor: '#b91c1c',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 16,
  },
  previewContent: {
    width: '100%',
    height: '80%',
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImageWrap: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonBlock: {
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
  },
});
