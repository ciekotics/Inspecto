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
import {
  PinchGestureHandler,
  TapGestureHandler,
  State,
} from 'react-native-gesture-handler';
import {PRIMARY} from '../utils/theme';
import {client} from '../utils/apiClient';
import {FramesInspection, InspectionApiResponse} from '../types/inspection';
import {store} from '../store/store';

type RouteParams = {
  sellCarId?: string | number;
};

type YesNo = 'Yes' | 'No' | '';

const FramesInspectionScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const {sellCarId} = (route.params as RouteParams) || {};
  const formattedSellCarId =
    sellCarId == null ? '' : String(sellCarId).trim();

  const [inspectionId, setInspectionId] = useState<string | number>('');
  const [front, setFront] = useState({
    bonnetSupport: '' as YesNo,
    crossMember: '' as YesNo,
    lampSupport: '' as YesNo,
    leftApron: '' as YesNo,
    rightApron: '' as YesNo,
  });
  const [pillars, setPillars] = useState({
    leftA: '' as YesNo,
    leftB: '' as YesNo,
    leftC: '' as YesNo,
    rightA: '' as YesNo,
    rightB: '' as YesNo,
    rightC: '' as YesNo,
  });
  const [pillarCondition, setPillarCondition] = useState({
    leftA: '',
    leftB: '',
    leftC: '',
    rightA: '',
    rightB: '',
    rightC: '',
  });
  const [rear, setRear] = useState({
    rearLeftQuarter: '' as YesNo,
    rearRightQuarter: '' as YesNo,
    dickey: '' as YesNo,
  });
  const [rearCondition, setRearCondition] = useState({
    rearLeftQuarter: '',
    rearRightQuarter: '',
    dickey: '',
  });
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [floodAffected, setFloodAffected] = useState<YesNo>('');
  const [otherComments, setOtherComments] = useState('');
  const [refurbCost, setRefurbCost] = useState('');
  const [frameImages, setFrameImages] = useState<(string | null)[]>([
    null,
    null,
    null,
    null,
  ]);

  const [pickerVisible, setPickerVisible] = useState<{
    open: boolean;
    index: number | null;
  }>({open: false, index: null});
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const pinchScale = useRef(new Animated.Value(1)).current;
  const baseScale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const combinedScale = Animated.multiply(baseScale, pinchScale);
  const doubleTapRef = useRef<TapGestureHandler | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requiredCount = useMemo(() => 16, []);

  const filledCount = useMemo(() => {
    let count = 0;
    Object.values(front).forEach(v => v && count++);
    Object.values(pillars).forEach(v => v && count++);
    Object.values(rear).forEach(v => v && count++);
    if (floodAffected) count += 1;
    if (frameImages.filter(Boolean).length > 0) count += 1;
    return count;
  }, [front, pillars, rear, floodAffected, frameImages]);

  const resetAll = () => {
    setFront({
      bonnetSupport: '',
      crossMember: '',
      lampSupport: '',
      leftApron: '',
      rightApron: '',
    });
    setPillars({
      leftA: '',
      leftB: '',
      leftC: '',
      rightA: '',
      rightB: '',
      rightC: '',
    });
    setPillarCondition({
      leftA: '',
      leftB: '',
      leftC: '',
      rightA: '',
      rightB: '',
      rightC: '',
    });
    setRear({
      rearLeftQuarter: '',
      rearRightQuarter: '',
      dickey: '',
    });
    setRearCondition({
      rearLeftQuarter: '',
      rearRightQuarter: '',
      dickey: '',
    });
    setFloodAffected('');
    setOtherComments('');
    setRefurbCost('');
    setFrameImages([null, null, null, null]);
  };

  const handlePick = async (mode: 'camera' | 'library') => {
    const targetIndex = pickerVisible.index;
    const resp: ImagePickerResponse =
      mode === 'camera'
        ? await launchCamera({mediaType: 'photo', quality: 0.8})
        : await launchImageLibrary({mediaType: 'photo', quality: 0.8});
    if (resp.didCancel || !resp.assets || resp.assets.length === 0) {
      setPickerVisible({open: false, index: null});
      return;
    }
    const uri = resp.assets[0]?.uri;
    if (uri != null && targetIndex != null) {
      setFrameImages(prev => {
        const next = [...prev];
        next[targetIndex] = uri;
        return next;
      });
    }
    setPickerVisible({open: false, index: null});
  };

  const renderToggle = (
    label: string,
    value: YesNo,
    onChange: (v: YesNo) => void,
  ) => (
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

  const renderPillarRow = (label: string, key: keyof typeof pillars) => {
    const val = pillars[key];
    const condition = pillarCondition[key];
    const setVal = (next: YesNo) => {
      setPillars(prev => ({...prev, [key]: next}));
      if (next !== 'Yes') {
        setPillarCondition(prev => ({...prev, [key]: ''}));
      }
    };
    return (
      <View style={{marginTop: 10}}>
        {renderToggle(label, val, setVal)}
        {val === 'Yes' ? (
          <View style={styles.conditionRow}>
            {['Already Repaired', 'To Be Repaired'].map(opt => {
              const active = condition === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() =>
                    setPillarCondition(prev => ({...prev, [key]: opt}))
                  }
                  style={[
                    styles.condPill,
                    active ? styles.condPillActive : styles.condPillInactive,
                  ]}>
                  <Text
                    style={[
                      styles.condPillText,
                      active ? styles.condPillTextActive : null,
                    ]}>
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  };

  const renderRearRow = (label: string, key: keyof typeof rear) => {
    const val = rear[key];
    const condition = rearCondition[key];
    const setVal = (next: YesNo) => {
      setRear(prev => ({...prev, [key]: next}));
      if (next !== 'Yes') {
        setRearCondition(prev => ({...prev, [key]: ''}));
      }
    };
    return (
      <View style={{marginTop: 10}}>
        {renderToggle(label, val, setVal)}
        {val === 'Yes' ? (
          <View style={styles.conditionRow}>
            {['Already Repaired', 'To Be Repaired'].map(opt => {
              const active = condition === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() =>
                    setRearCondition(prev => ({...prev, [key]: opt}))
                  }
                  style={[
                    styles.condPill,
                    active ? styles.condPillActive : styles.condPillInactive,
                  ]}>
                  <Text
                    style={[
                      styles.condPillText,
                      active ? styles.condPillTextActive : null,
                    ]}>
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  };

  const renderPhotoTile = (index: number) => {
    const uri = frameImages[index];
    return (
      <Pressable
        key={index}
        style={styles.photoTile}
        onPress={() => setPickerVisible({open: true, index})}>
        {uri ? (
          <>
            <Image source={{uri}} style={styles.photoImage} resizeMode="cover" />
            <View style={styles.photoBadge}>
              <Check size={14} color="#fff" />
            </View>
            <Pressable
              style={styles.eyeIcon}
              onPress={() => {
                setPreviewUri(uri);
                setPreviewVisible(true);
              }}>
              <Eye size={16} color="#111827" />
            </Pressable>
          </>
        ) : (
          <>
            <ImageIcon size={28} color="#9ca3af" strokeWidth={2} />
            <Text style={styles.photoText}>Click to upload</Text>
          </>
        )}
      </Pressable>
    );
  };

  useEffect(() => {
    let cancelled = false;
    const normYesNo = (val: any): YesNo => {
      const v = (val || '').toString().trim().toLowerCase();
      if (v === 'yes' || v === 'y' || v === 'true' || v === '1') return 'Yes';
      if (v === 'no' || v === 'n' || v === 'false' || v === '0') return 'No';
      return '';
    };
    const pickVal = (obj: any, keys: string[]) => {
      if (!obj || typeof obj !== 'object') return undefined;
      const normMap: Record<string, any> = {};
      Object.keys(obj).forEach(k => {
        normMap[k.trim().toLowerCase()] = obj[k];
      });
      for (const k of keys) {
        if (obj[k] !== undefined) return obj[k];
        const norm = k.trim().toLowerCase();
        if (normMap[norm] !== undefined) return normMap[norm];
      }
      return undefined;
    };
    const pickYesNo = (obj: any, keys: string[]) => normYesNo(pickVal(obj, keys));
    const applyFrames = (framesData: FramesInspection | undefined | null) => {
      if (!framesData || typeof framesData !== 'object') return;
      let anyDamage =
        framesData['Any Damage In'] ||
        framesData['Any damage in'] ||
        framesData.anyDamageIn ||
        framesData.anyDamage;
      if (!anyDamage) {
        const entry = Object.keys(framesData || {}).find(k =>
          k.toLowerCase().includes('damage'),
        );
        anyDamage = entry ? framesData[entry] : null;
      }
      const frontData =
        (anyDamage && anyDamage.Front) ||
        (anyDamage && anyDamage.front) ||
        framesData.Front ||
        framesData.front ||
        {};
      const pillarsData =
        (anyDamage && anyDamage.Pillars) ||
        (anyDamage && anyDamage.pillars) ||
        framesData.Pillars ||
        framesData.pillars ||
        {};
      const rearData =
        (anyDamage && anyDamage.Rear) ||
        (anyDamage && anyDamage.rear) ||
        framesData.Rear ||
        framesData.rear ||
        {};

      if (Object.keys(frontData).length > 0) {
        setFront({
          bonnetSupport: pickYesNo(frontData, ['Bonnet Support Member', 'Bonnet Support']),
          crossMember: pickYesNo(frontData, ['Cross Member']),
          lampSupport: pickYesNo(frontData, ['Lamp Support']),
          leftApron: pickYesNo(frontData, ['Left Apron']),
          rightApron: pickYesNo(frontData, ['Right Apron']),
        });
      }

      if (Object.keys(pillarsData).length > 0) {
        const nextPillars = {...pillars};
        const nextPillarCondition = {...pillarCondition};
        const setPillarVal = (
          key: keyof typeof pillars,
          label: string,
          detailKey?: string,
        ) => {
          const raw = pickVal(pillarsData, [label]);
          nextPillars[key] = normYesNo(raw);
          if (nextPillars[key] === 'Yes' && detailKey) {
            nextPillarCondition[key] = pillarsData[detailKey] || '';
          }
        };
        setPillarVal('leftA', 'Left A-Pillar');
        setPillarVal('leftB', 'Left B-Pillar', 'Left B-Pillar Details');
        setPillarVal('leftC', 'Left C-Pillar', 'Left C-Pillar Details');
        setPillarVal('rightA', 'Right A-Pillar');
        setPillarVal('rightB', 'Right B-Pillar', 'Right B-Pillar Details');
        setPillarVal('rightC', 'Right C-Pillar');
        setPillars(nextPillars);
        setPillarCondition(nextPillarCondition);
      }

      if (Object.keys(rearData).length > 0) {
        const nextRear = {...rear};
        const nextRearCond = {...rearCondition};
        const setRearVal = (key: keyof typeof rear, label: string) => {
          const raw = pickVal(rearData, [label, label.toLowerCase()]);
          nextRear[key] = normYesNo(raw);
          if (nextRear[key] !== 'Yes') {
            nextRearCond[key] = '';
          }
        };
        setRearVal('rearLeftQuarter', 'Rear Left Quarter Panel');
        setRearVal('rearRightQuarter', 'Rear Right Quarter Panel');
        setRearVal('dickey', 'Dickey');
        setRear(nextRear);
        setRearCondition(nextRearCond);
      }

      const floodVal =
        framesData['Flood Affected Vehicle'] || framesData.floodAffected;
      const flood = normYesNo(floodVal);
      if (flood) {
        setFloodAffected(flood);
      }

      const imgs =
        framesData['Frame images'] ||
        framesData.frameImages ||
        framesData.images ||
        [];
      if (Array.isArray(imgs)) {
        setFrameImages(prev => {
          const next = [...prev];
          for (let i = 0; i < Math.min(4, imgs.length); i += 1) {
            if (imgs[i]) next[i] = imgs[i];
          }
          return next;
        });
      }
    };

    const fetchExisting = async () => {
      if (!formattedSellCarId) return;
      setPrefillLoading(true);
      try {
        const res = await client.get<InspectionApiResponse>('/api/view-inspection', {
          params: {sellCarId: formattedSellCarId},
        });
        if (cancelled) return;
        const existing = res.data?.data?.allInspections?.[0];
        if (existing?.id != null) {
          setInspectionId(existing.id);
        }
        const frames =
          existing?.frames ||
          res.data?.data?.frames ||
          res.data?.frames;
        applyFrames(frames);
      } catch (err) {
        if (!cancelled) console.warn('Failed to prefill frames', err);
      } finally {
        if (!cancelled) setPrefillLoading(false);
      }
    };
    fetchExisting();
    return () => {
      cancelled = true;
    };
  }, [formattedSellCarId]);

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

  const handleSubmit = async () => {
    setMessage(null);
    if (!formattedSellCarId) {
      setMessage('Missing sellCarId.');
      return;
    }
    const requiredFront = Object.entries(front).find(([, v]) => !v);
    if (requiredFront) {
      setMessage(`Select ${requiredFront[0].replace(/([A-Z])/g, ' $1')}`);
      return;
    }
    const requiredPillar = Object.entries(pillars).find(([, v]) => !v);
    if (requiredPillar) {
      setMessage(`Select ${requiredPillar[0].replace(/([A-Z])/g, ' $1')}`);
      return;
    }
    const requiredRear = Object.entries(rear).find(([, v]) => !v);
    if (requiredRear) {
      setMessage(`Select ${requiredRear[0].replace(/([A-Z])/g, ' $1')}`);
      return;
    }
    const pillarDetailMissing = (['leftB', 'leftC', 'rightB'] as (keyof typeof pillars)[]).find(
      key => pillars[key] === 'Yes' && !pillarCondition[key],
    );
    if (pillarDetailMissing) {
      setMessage('Select condition for pillars marked Yes.');
      return;
    }
    const rearDetailMissing = (['rearLeftQuarter', 'rearRightQuarter', 'dickey'] as (keyof typeof rear)[]).find(
      key => rear[key] === 'Yes' && !rearCondition[key],
    );
    if (rearDetailMissing) {
      setMessage('Select condition for rear items marked Yes.');
      return;
    }
    if (!floodAffected) {
      setMessage('Select Flood Affected Vehicle.');
      return;
    }
    if (!frameImages.filter(Boolean).length) {
      setMessage('Add at least one frame image.');
      return;
    }

    setSubmitting(true);
    try {
      const pillarReports: any = {
        'Left A-Pillar': pillars.leftA,
        'Left B-Pillar': pillars.leftB,
        'Left C-Pillar': pillars.leftC,
        'Right A-Pillar': pillars.rightA,
        'Right B-Pillar': pillars.rightB,
        'Right C-Pillar': pillars.rightC,
      };
      // Only include detail keys when pillar is Yes to avoid validation on empty values.
      if (pillars.leftB === 'Yes') {
        pillarReports['Left B-Pillar Details'] = pillarCondition.leftB || 'Already Repaired';
      }
      if (pillars.leftC === 'Yes') {
        pillarReports['Left C-Pillar Details'] = pillarCondition.leftC || 'Already Repaired';
      }
      if (pillars.rightB === 'Yes') {
        pillarReports['Right B-Pillar Details'] = pillarCondition.rightB || 'Already Repaired';
      }

      const rearReports: any = {
        'Rear Left Quarter Panel': rear.rearLeftQuarter,
        'Rear Right Quarter Panel': rear.rearRightQuarter,
        Dickey: rear.dickey,
      };
      if (rear.rearLeftQuarter === 'Yes') {
        rearReports['Rear Left Quarter Panel Details'] =
          rearCondition.rearLeftQuarter || 'Already Repaired';
      }
      if (rear.rearRightQuarter === 'Yes') {
        rearReports['Rear Right Quarter Panel Details'] =
          rearCondition.rearRightQuarter || 'Already Repaired';
      }
      if (rear.dickey === 'Yes') {
        rearReports['Dickey Details'] = rearCondition.dickey || 'Already Repaired';
      }

      const reports: any = {
        'Any Damage In': {
          Front: {
            'Bonnet Support Member': front.bonnetSupport,
            'Cross Member': front.crossMember,
            'Lamp Support': front.lampSupport,
            'Left Apron': front.leftApron,
            'Right Apron': front.rightApron,
          },
          Pillars: pillarReports,
          Rear: rearReports,
        },
        'Flood Affected Vehicle': floodAffected,
        'Other Comments': otherComments,
        'Refurbishment Cost': refurbCost || '0',
      };

      const fd = new FormData();
      fd.append('id', String(inspectionId || formattedSellCarId));
      fd.append('sellCarId', formattedSellCarId);
      fd.append('Reports', JSON.stringify(reports));
      fd.append('deletedFiles', JSON.stringify([]));
      for (let i = 0; i < frameImages.length; i += 1) {
        const uri = frameImages[i];
        if (uri) {
          await appendFileToFormData(fd, `frame${i + 1}`, uri);
        }
      }

      const token = store.getState().auth.token;
      const resp = await fetch(`https://api.marnix.in/api/add-frames-inspection`, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          Accept: '*/*',
        },
        body: fd,
      });
      const text = await resp.text();
      if (!resp.ok) {
        console.error('[Frames] upload failed', {
          status: resp.status,
          statusText: resp.statusText,
          body: text,
        });
        throw new Error(text || 'Failed to save frames inspection');
      }
      setMessage(null);
      navigation.navigate('RefurbishmentCost', {sellCarId: formattedSellCarId});
    } catch (err: any) {
      setMessage(err?.message || 'Failed to save frames inspection');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          android_ripple={{color: 'rgba(0,0,0,0.08)'}}>
          <ChevronLeft size={18} color="#111827" strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.headerTitle}>Frames</Text>
        <Pressable style={styles.resetBtn} onPress={resetAll}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Step 7 · Frames</Text>
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
            <View style={[styles.skeletonBlock, {width: '70%', height: 12, marginTop: 8}]} />
            <View style={[styles.skeletonBlock, {width: '100%', height: 46, marginTop: 12}]} />
          </View>
        ) : (
        <View style={styles.card}>
          <Text style={styles.title}>Any Damage In?</Text>
          {renderToggle('Bonnet Support Member *', front.bonnetSupport, v =>
            setFront(prev => ({...prev, bonnetSupport: v})),
          )}
          {renderToggle('Cross Member *', front.crossMember, v =>
            setFront(prev => ({...prev, crossMember: v})),
          )}
          {renderToggle('Lamp Support *', front.lampSupport, v =>
            setFront(prev => ({...prev, lampSupport: v})),
          )}
          {renderToggle('Left Apron *', front.leftApron, v =>
            setFront(prev => ({...prev, leftApron: v})),
          )}
          {renderToggle('Right Apron *', front.rightApron, v =>
            setFront(prev => ({...prev, rightApron: v})),
          )}

          <Text style={[styles.sectionTitle, {marginTop: 16}]}>Pillars</Text>
          {renderPillarRow('Left A-Pillar *', 'leftA')}
          {renderPillarRow('Left B-Pillar *', 'leftB')}
          {renderPillarRow('Left C-Pillar *', 'leftC')}
          {renderPillarRow('Right A-Pillar *', 'rightA')}
          {renderPillarRow('Right B-Pillar *', 'rightB')}
          {renderPillarRow('Right C-Pillar *', 'rightC')}

          <Text style={[styles.sectionTitle, {marginTop: 16}]}>Rear</Text>
          {renderRearRow('Rear Left Quarter Panel *', 'rearLeftQuarter')}
          {renderRearRow('Rear Right Quarter Panel *', 'rearRightQuarter')}
          {renderRearRow('Dickey *', 'dickey')}

          {renderToggle('Flood Affected Vehicle *', floodAffected, setFloodAffected)}

          <Text style={[styles.sectionTitle, {marginTop: 16}]}>Other comments</Text>
          <TextInput
            style={[styles.input, {minHeight: 70}]}
            value={otherComments}
            onChangeText={setOtherComments}
            placeholder="Other comments"
            placeholderTextColor="#9ca3af"
            multiline
            autoComplete="off"
          />

          <Text style={[styles.sectionTitle, {marginTop: 16}]}>Frame images *</Text>
          <View style={styles.imageGrid}>
            {frameImages.map((_, idx) => (
              <View key={idx} style={styles.imageCell}>
                {renderPhotoTile(idx)}
              </View>
            ))}
          </View>

          <View style={[styles.inputGroup, {marginTop: 12}]}>
            <Text style={styles.inputLabel}>Refurbishment Cost (optional)</Text>
            <TextInput
              style={styles.input}
              value={refurbCost}
              onChangeText={setRefurbCost}
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
        visible={pickerVisible.open}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible({open: false, index: null})}>
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
                onPress={() => setPickerVisible({open: false, index: null})}>
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

export default FramesInspectionScreen;

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
    marginTop: 10,
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
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginTop: 8,
  },
  imageCell: {
    width: '48%',
  },
  photoTile: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    minHeight: 120,
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
    top: 8,
    right: 8,
    backgroundColor: PRIMARY,
    borderRadius: 10,
    padding: 4,
  },
  eyeIcon: {
    position: 'absolute',
    top: 8,
    left: 8,
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
  conditionRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  condPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  condPillActive: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY + '15',
  },
  condPillInactive: {
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  condPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  condPillTextActive: {
    color: PRIMARY,
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
