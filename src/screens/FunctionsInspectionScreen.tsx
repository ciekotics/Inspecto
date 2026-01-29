import React, {useEffect, useMemo, useState} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import {ChevronLeft} from 'lucide-react-native';
import {PRIMARY} from '../utils/theme';
import {loadDraft, saveDraft} from '../utils/draftStorage';
import {client} from '../utils/apiClient';
import {store} from '../store/store';

type RouteParams = {
  sellCarId?: string | number;
};

type YesNo = 'Yes' | 'No' | '';

const FunctionsInspectionScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const {sellCarId} = (route.params as RouteParams) || {};
  const formattedSellCarId =
    sellCarId == null ? '' : String(sellCarId).trim();

  const [inspectionId, setInspectionId] = useState<string | number>('');
  const [steering, setSteering] = useState<YesNo>('');
  const [suspension, setSuspension] = useState<YesNo>('');
  const [brake, setBrake] = useState<YesNo>('');
  const [gearShifting, setGearShifting] = useState<YesNo>('');
  const [driveShaft, setDriveShaft] = useState<YesNo>('');
  const [clutch, setClutch] = useState<YesNo>('');

  const [wheelBearingNoise, setWheelBearingNoise] = useState<YesNo>('');
  const [gearBoxNoise, setGearBoxNoise] = useState<YesNo>('');
  const [transmissionLeakage, setTransmissionLeakage] = useState<YesNo>('');
  const [differentialNoise, setDifferentialNoise] = useState<YesNo>('');

  const [highlightPositives, setHighlightPositives] = useState('');
  const [otherComments, setOtherComments] = useState('');
  const [refurbCost, setRefurbCost] = useState('');
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requiredCount = useMemo(() => 11, []);

  const filledCount = useMemo(() => {
    let count = 0;
    [
      steering,
      suspension,
      brake,
      gearShifting,
      driveShaft,
      clutch,
      wheelBearingNoise,
      gearBoxNoise,
      transmissionLeakage,
      differentialNoise,
    ].forEach(v => {
      if (v) count += 1;
    });
    if (refurbCost) count += 1;
    return count;
  }, [
    steering,
    suspension,
    brake,
    gearShifting,
    driveShaft,
    clutch,
    wheelBearingNoise,
    gearBoxNoise,
    transmissionLeakage,
    differentialNoise,
    refurbCost,
  ]);

  const resetAll = () => {
    setSteering('');
    setSuspension('');
    setBrake('');
    setGearShifting('');
    setDriveShaft('');
    setClutch('');
    setWheelBearingNoise('');
    setGearBoxNoise('');
    setTransmissionLeakage('');
    setDifferentialNoise('');
    setHighlightPositives('');
    setOtherComments('');
    setRefurbCost('');
  };

  useEffect(() => {
    let cancelled = false;
    const normYesNo = (val: any): YesNo => {
      const v = (val || '').toString().trim().toLowerCase();
      if (v === 'yes' || v === 'y' || v === 'true' || v === '1') return 'Yes';
      if (v === 'no' || v === 'n' || v === 'false' || v === '0') return 'No';
      return '';
    };
    const applyData = (fnData: any) => {
      if (!fnData || typeof fnData !== 'object') return;
      const source = fnData.Reports || fnData.reports || fnData;
      const proper =
        source.proper_condition ||
        source['proper_condition'] ||
        source.properCondition ||
        source.properCondition;
      const noise =
        source['noise/leakage'] ||
        source.noiseLeakage ||
        source.noise ||
        source.Noise;
      const properObj = proper && typeof proper === 'object' ? proper : {};
      const noiseObj = noise && typeof noise === 'object' ? noise : {};

      setSteering(normYesNo(properObj['Steering'] || source.Steering || source.steering));
      setSuspension(normYesNo(properObj['Suspension'] || source.Suspension || source.suspension));
      setBrake(normYesNo(properObj['Brake'] || source.Brake || source.brake));
      setGearShifting(normYesNo(properObj['Gear Shifting'] || source['Gear Shifting'] || source.gearShifting));
      setDriveShaft(
        normYesNo(
          properObj['Drive Shaft/ Axle'] ||
            properObj['Drive Shaft'] ||
            source['Drive Shaft/ Axle'] ||
            source.driveShaft,
        ),
      );
      setClutch(normYesNo(properObj['Clutch'] || source.Clutch || source.clutch));

      setWheelBearingNoise(
        normYesNo(noiseObj['Wheel Bearing Noise'] || source['Wheel Bearing Noise'] || source.wheelBearingNoise),
      );
      setGearBoxNoise(normYesNo(noiseObj['Gear Box Noise'] || source['Gear Box Noise'] || source.gearBoxNoise));
      setDifferentialNoise(
        normYesNo(noiseObj['Differential Noise'] || source['Differential Noise'] || source.differentialNoise),
      );
      setTransmissionLeakage(
        normYesNo(
          noiseObj['Transmission/ Differential Oil Leakage'] ||
            source['Transmission/ Differential Oil Leakage'] ||
            source.transmissionLeakage,
        ),
      );

      if (source['Highlight Positives'] !== undefined) {
        setHighlightPositives(String(source['Highlight Positives'] || ''));
      }
      if (source['Other Comments'] !== undefined) {
        setOtherComments(String(source['Other Comments'] || ''));
      }
      const refurb =
        source['Refurbishment Cost'] ||
        source.refurbCost ||
        source.refurbishmentCost;
      if (refurb !== undefined && `${refurb}`.trim() !== '') {
        setRefurbCost(String(refurb));
      }
    };

    const hydrate = async () => {
      if (!formattedSellCarId) return;
      setPrefillLoading(true);
      const draft = loadDraft(formattedSellCarId, 'functions');
      if (!cancelled && draft) {
        applyData(draft);
      }
      try {
        const res = await client.get('/api/view-inspection', {
          params: {sellCarId: formattedSellCarId},
        });
        if (!cancelled) {
          const existing = res.data?.data?.allInspections?.[0];
          if (existing?.id != null) {
            setInspectionId(existing.id);
          }
          const fn =
            existing?.functions ||
            existing?.Functions ||
            res.data?.data?.functions ||
            res.data?.functions;
          applyData(fn);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to prefill functions', err);
        }
      }
      if (!cancelled) setPrefillLoading(false);
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [formattedSellCarId]);

  useEffect(() => {
    if (!formattedSellCarId) return;
    const payload = {
      steering,
      suspension,
      brake,
      gearShifting,
      driveShaft,
      clutch,
      wheelBearingNoise,
      gearBoxNoise,
      transmissionLeakage,
      differentialNoise,
      highlightPositives,
      otherComments,
      refurbCost,
    };
    saveDraft(formattedSellCarId, 'functions', payload);
  }, [
    formattedSellCarId,
    steering,
    suspension,
    brake,
    gearShifting,
    driveShaft,
    clutch,
    wheelBearingNoise,
    gearBoxNoise,
    transmissionLeakage,
    differentialNoise,
    highlightPositives,
    otherComments,
    refurbCost,
  ]);

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

  const handleSubmit = async () => {
    setMessage(null);
    if (!formattedSellCarId) {
      setMessage('Missing sellCarId.');
      return;
    }
    const required = [
      {label: 'Steering', val: steering},
      {label: 'Suspension', val: suspension},
      {label: 'Brake', val: brake},
      {label: 'Gear Shifting', val: gearShifting},
      {label: 'Drive Shaft / Axle', val: driveShaft},
      {label: 'Clutch', val: clutch},
      {label: 'Wheel Bearing Noise', val: wheelBearingNoise},
      {label: 'Gear Box Noise', val: gearBoxNoise},
      {label: 'Transmission / Differential Oil Leakage', val: transmissionLeakage},
      {label: 'Differential Noise', val: differentialNoise},
      {label: 'Refurbishment Cost', val: refurbCost},
    ];
    const missing = required.find(item => !item.val);
    if (missing) {
      setMessage(`Select ${missing.label}`);
      return;
    }

    setSubmitting(true);
    try {
      const reports = {
        proper_condition: {
          Steering: steering,
          Suspension: suspension,
          Brake: brake,
          'Gear Shifting': gearShifting,
          'Drive Shaft/ Axle': driveShaft,
          Clutch: clutch,
        },
        'noise/leakage': {
          'Wheel Bearing Noise': wheelBearingNoise,
          'Gear Box Noise': gearBoxNoise,
          'Transmission/ Differential Oil Leakage': transmissionLeakage,
          'Differential Noise': differentialNoise,
        },
        'Highlight Positives': highlightPositives,
        'Other Comments': otherComments,
        'Refurbishment Cost': refurbCost || '0',
      };

      const token = store.getState().auth.token;
      await client.post(
        '/api/add-functions-inspection',
        {
          id: inspectionId || formattedSellCarId,
          sellCarId: formattedSellCarId,
          Reports: reports,
        },
        {headers: token ? {Authorization: `Bearer ${token}`} : undefined},
      );

      setMessage('Functions inspection saved.');
      navigation.navigate('FramesInspection', {sellCarId: formattedSellCarId});
    } catch (err: any) {
      console.error('[Functions] save failed', {
        message: err?.message,
        status: err?.response?.status,
        data: err?.response?.data,
      });
      setMessage(
        err?.response?.data?.message ||
          err?.response?.data?.errors?.message ||
          err?.message ||
          'Failed to save functions inspection',
      );
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
        <Text style={styles.headerTitle}>Functions</Text>
        <Pressable style={styles.resetBtn} onPress={resetAll}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Step 6 · Functions</Text>
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
            <View style={[styles.skeletonBlock, {width: '100%', height: 120, marginTop: 12}]} />
          </View>
        ) : (
          <View style={styles.card}>
          <Text style={styles.title}>Is in Proper Condition?</Text>
          {renderToggle('Steering *', steering, setSteering)}
          {renderToggle('Suspension *', suspension, setSuspension)}
          {renderToggle('Brake *', brake, setBrake)}
          {renderToggle('Gear Shifting *', gearShifting, setGearShifting)}
          {renderToggle('Drive Shaft / Axle *', driveShaft, setDriveShaft)}
          {renderToggle('Clutch *', clutch, setClutch)}

          <Text style={[styles.sectionTitle, {marginTop: 16}]}>
            Any Noise / Leakage?
          </Text>
          {renderToggle('Wheel Bearing Noise *', wheelBearingNoise, setWheelBearingNoise)}
          {renderToggle('Gear Box Noise *', gearBoxNoise, setGearBoxNoise)}
          {renderToggle(
            'Transmission / Differential Oil Leakage *',
            transmissionLeakage,
            setTransmissionLeakage,
          )}
          {renderToggle('Differential Noise *', differentialNoise, setDifferentialNoise)}

          <Text style={[styles.sectionTitle, {marginTop: 16}]}>
            Highlight Positives
          </Text>
          <TextInput
            style={[styles.input, {minHeight: 80}]}
            value={highlightPositives}
            onChangeText={setHighlightPositives}
            placeholder="Highlight positives"
            placeholderTextColor="#9ca3af"
            multiline
            autoComplete="off"
          />

          <Text style={[styles.sectionTitle, {marginTop: 12}]}>
            Other Comments
          </Text>
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
            <Text style={styles.inputLabel}>Refurbishment Cost</Text>
            <TextInput
              style={styles.input}
              value={refurbCost}
              onChangeText={setRefurbCost}
              keyboardType="numeric"
              placeholder="0"
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
    </SafeAreaView>
  );
};

export default FunctionsInspectionScreen;

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
  skeletonBlock: {
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
  },
});
