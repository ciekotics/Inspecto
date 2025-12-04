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
import {useNavigation, useRoute} from '@react-navigation/native';
import {ChevronLeft} from 'lucide-react-native';
import {PRIMARY} from '../utils/theme';
import {client} from '../utils/apiClient';
import {store} from '../store/store';
import {loadDraft, saveDraft} from '../utils/draftStorage';

type RouteParams = {
  sellCarId?: string | number;
};

const RefurbishmentCostScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const {sellCarId} = (route.params as RouteParams) || {};
  const formattedSellCarId =
    sellCarId == null ? '' : String(sellCarId).trim();

  const [inspectionId, setInspectionId] = useState<string | number>('');
  const [popularWorkDemand, setPopularWorkDemand] = useState('');
  const [interiorCleaning, setInteriorCleaning] = useState('');
  const [rubbingPolishing, setRubbingPolishing] = useState('');
  const [spareKeys, setSpareKeys] = useState('');
  const [accessoriesRepair, setAccessoriesRepair] = useState('');
  const [insuranceCost, setInsuranceCost] = useState('');
  const [pollutionCost, setPollutionCost] = useState('');
  const [registrationDocCost, setRegistrationDocCost] = useState('');
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const optionalTotal = useMemo(() => 8, []);
  const filledCount = useMemo(() => {
    let count = 0;
    [
      popularWorkDemand,
      interiorCleaning,
      rubbingPolishing,
      spareKeys,
      accessoriesRepair,
      insuranceCost,
      pollutionCost,
      registrationDocCost,
    ].forEach(v => {
      if (v && `${v}`.trim() !== '') count += 1;
    });
    return count;
  }, [
    popularWorkDemand,
    interiorCleaning,
    rubbingPolishing,
    spareKeys,
    accessoriesRepair,
    insuranceCost,
    pollutionCost,
    registrationDocCost,
  ]);
  const optionalLeft = optionalTotal - filledCount;

  const resetAll = () => {
    setPopularWorkDemand('');
    setInteriorCleaning('');
    setRubbingPolishing('');
    setSpareKeys('');
    setAccessoriesRepair('');
    setInsuranceCost('');
    setPollutionCost('');
    setRegistrationDocCost('');
  };

  useEffect(() => {
    let cancelled = false;
    const fetchExisting = async () => {
      if (!formattedSellCarId) return;
      try {
        setPrefillLoading(true);
        const res = await client.get('/api/view-refurbishment-cost', {
          params: {sellCarId: formattedSellCarId},
        });
        if (cancelled) return;
        const refurbData = res.data?.data?.refurbishmentCost;
        if (refurbData?.id != null) {
          setInspectionId(refurbData.id);
        }
        const totalRf = refurbData?.['Total RF Cost'];
        const docs = totalRf?.Document || {};
        const other = totalRf?.['Other Refurbishment Cost'] || {};
        if (other) {
          if (other['Popular Work Demand'] != null)
            setPopularWorkDemand(String(other['Popular Work Demand']));
          if (other['Interior Cleaning'] != null)
            setInteriorCleaning(String(other['Interior Cleaning']));
          if (other['Rubbing & Polishing'] != null)
            setRubbingPolishing(String(other['Rubbing & Polishing']));
          if (other['Spare Keys'] != null)
            setSpareKeys(String(other['Spare Keys']));
          if (other['Accessories Repair'] != null)
            setAccessoriesRepair(String(other['Accessories Repair']));
        }
        if (docs) {
          if (docs['Insurance Cost'] != null)
            setInsuranceCost(String(docs['Insurance Cost']));
          if (docs['Pollution Cost'] != null)
            setPollutionCost(String(docs['Pollution Cost']));
          if (docs['Registration/ Doc Cost'] != null)
            setRegistrationDocCost(String(docs['Registration/ Doc Cost']));
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to prefill refurbishment cost', err);
        }
      } finally {
        if (!cancelled) setPrefillLoading(false);
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
      popularWorkDemand,
      interiorCleaning,
      rubbingPolishing,
      spareKeys,
      accessoriesRepair,
      insuranceCost,
      pollutionCost,
      registrationDocCost,
    };
    saveDraft(formattedSellCarId, 'refurbishment', payload);
  }, [
    formattedSellCarId,
    popularWorkDemand,
    interiorCleaning,
    rubbingPolishing,
    spareKeys,
    accessoriesRepair,
    insuranceCost,
    pollutionCost,
    registrationDocCost,
  ]);

  const renderInput = (
    label: string,
    value: string,
    onChange: (v: string) => void,
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor="#9ca3af"
        autoComplete="off"
      />
    </View>
  );

  const handleSubmit = async () => {
    setMessage(null);
    if (!formattedSellCarId) {
      setMessage('Missing sellCarId.');
      return;
    }

    setSubmitting(true);
    try {
      const otherCosts = {
        'Popular Work Demand': popularWorkDemand || '0',
        'Interior Cleaning': interiorCleaning || '0',
        'Rubbing & Polishing': rubbingPolishing || '0',
        'Spare Keys': spareKeys || '0',
        'Accessories Repair': accessoriesRepair || '0',
      };
      const documents = {
        'Insurance Cost': insuranceCost || '0',
        'Pollution Cost': pollutionCost || '0',
        'Registration/ Doc Cost': registrationDocCost || '0',
      };

      const payload = {
        id: inspectionId || formattedSellCarId,
        sellCarId: formattedSellCarId,
        'Others RF Cost': {
          'Other Refurbishment Cost': otherCosts,
          Document: documents,
        },
      };
      console.log('[Refurbishment] submit payload', payload);
      await client.post('/api/add-refurbishment-cost', payload, {
        headers: {
          'Content-Type': 'application/json',
          Accept: '*/*',
          Authorization: store.getState().auth.token
            ? `Bearer ${store.getState().auth.token}`
            : '',
        },
      });

      setMessage(null);
      navigation.navigate('DefectiveParts', {sellCarId: formattedSellCarId});
    } catch (err: any) {
      console.error('[Refurbishment] save failed', {
        message: err?.message,
        status: err?.response?.status,
        data: err?.response?.data,
      });
      setMessage(
        err?.response?.data?.message ||
          err?.response?.data?.errors?.message ||
          err?.message ||
          'Failed to save refurbishment cost',
      );
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
        <Text style={styles.headerTitle}>Refurbishment Cost</Text>
        <Pressable style={styles.resetBtn} onPress={resetAll}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Step 8 · Refurbishment Cost</Text>
          <View style={{width: 32}} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>Other Refurbishment Cost</Text>
          {prefillLoading ? (
            <>
              <View style={[styles.skeletonBlock, {height: 42, marginTop: 12}]} />
              <View style={[styles.skeletonBlock, {height: 42, marginTop: 12}]} />
              <View style={[styles.skeletonBlock, {height: 42, marginTop: 12}]} />
              <View style={[styles.skeletonBlock, {height: 42, marginTop: 12}]} />
              <View style={[styles.skeletonBlock, {height: 42, marginTop: 12}]} />

              <Text style={[styles.title, {marginTop: 16}]}>Document</Text>
              <View style={[styles.skeletonBlock, {height: 42, marginTop: 12}]} />
              <View style={[styles.skeletonBlock, {height: 42, marginTop: 12}]} />
              <View style={[styles.skeletonBlock, {height: 42, marginTop: 12}]} />
            </>
          ) : (
            <>
          {renderInput('Popular Work Demand', popularWorkDemand, setPopularWorkDemand)}
          {renderInput('Interior Cleaning', interiorCleaning, setInteriorCleaning)}
          {renderInput('Rubbing & Polishing', rubbingPolishing, setRubbingPolishing)}
          {renderInput('Spare Keys', spareKeys, setSpareKeys)}
          {renderInput('Accessories Repair', accessoriesRepair, setAccessoriesRepair)}

          <Text style={[styles.title, {marginTop: 16}]}>Document</Text>
          {renderInput('Insurance Cost', insuranceCost, setInsuranceCost)}
          {renderInput('Pollution Cost', pollutionCost, setPollutionCost)}
          {renderInput('Registration/ Doc Cost', registrationDocCost, setRegistrationDocCost)}
            </>
          )}

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
      </ScrollView>
    </SafeAreaView>
  );
};

export default RefurbishmentCostScreen;

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
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
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
  optionalHint: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '700',
  },
  skeletonBlock: {
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
  },
});
