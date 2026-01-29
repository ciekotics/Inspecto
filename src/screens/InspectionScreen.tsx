import React, {useEffect, useMemo, useState} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ChevronLeft, AlertTriangle} from 'lucide-react-native';
import {client} from '../utils/apiClient';
import {PRIMARY} from '../utils/theme';

type EvalType = 'Non-Scrap' | 'Scrap';

type RouteParams = {
  sellCarId?: string | number;
};

const EvalOption = ({
  label,
  active,
  onPress,
}: {
  label: EvalType;
  active: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.evalOption,
      active ? styles.evalOptionActive : styles.evalOptionInactive,
    ]}>
    <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
      {active ? <View style={styles.radioInner} /> : null}
    </View>
    <Text
      style={[
        styles.evalLabel,
        active ? styles.evalLabelActive : styles.evalLabelInactive,
      ]}>
      {label}
    </Text>
  </Pressable>
);

export default function InspectionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const {sellCarId} = (route.params as RouteParams) || {};
  const [evaluationType, setEvaluationType] = useState<EvalType>('Non-Scrap');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [hasExisting, setHasExisting] = useState(false);
  const [editing, setEditing] = useState(false);

  const formattedSellCarId = useMemo(() => {
    if (sellCarId == null) {
      return '';
    }
    return String(sellCarId).trim();
  }, [sellCarId]);

  useEffect(() => {
    const fetchExisting = async () => {
      if (!formattedSellCarId) {
        setError('Missing sellCarId for inspection');
        return;
      }
      setLoading(true);
      setError(null);
      setInfo(null);
      try {
        const res = await client.get('/api/view-inspection', {
          params: {sellCarId: formattedSellCarId},
        });
        const list: any[] = res.data?.data?.allInspections ?? [];
        const first = list[0];
        if (first) {
          const savedEval =
            first['Evaluation Type'] || first.evaluationType || 'Non-Scrap';
          const savedReg =
            first.RegNumber || first.registrationNumber || '';
          setEvaluationType(
            savedEval === 'Scrap' || savedEval === 'Non-Scrap'
              ? savedEval
              : 'Non-Scrap',
          );
          setRegistrationNumber(savedReg);
          setHasExisting(true);
          setEditing(false);
          setInfo('Inspection already exists. Proceed or edit details.');
        }
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load inspection';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchExisting();
  }, [formattedSellCarId]);

  const handleSubmit = async () => {
    if (hasExisting && !editing) {
      navigation.navigate('InspectionModules', {sellCarId: formattedSellCarId});
      return;
    }
    if (!formattedSellCarId) {
      setError('Missing sellCarId for inspection');
      return;
    }
    if (!registrationNumber.trim()) {
      setError('Registration number is required');
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await client.post('/api/car-registration', {
        sellCarId: formattedSellCarId,
        evaluationType,
        registrationNumber: registrationNumber.trim(),
      });
      setHasExisting(true);
      setEditing(false);
      setInfo('Saved to inspection.');
      navigation.navigate('InspectionModules', {sellCarId: formattedSellCarId});
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save inspection';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={[styles.header, {paddingTop: insets.top + 4}]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          android_ripple={{color: 'rgba(0,0,0,0.08)'}}>
          <ChevronLeft size={18} color="#111827" strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.headerTitle}>Inspection</Text>
        <View style={{width: 32}} />
      </View>

      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.cardBody}>
          <Text style={styles.title}>Car Registration</Text>
          <Text style={styles.subtitle}>
            Register a car to begin inspection.
          </Text>

          <View style={styles.banner}>
            <AlertTriangle size={16} color="#b45309" strokeWidth={2.2} />
            <View style={{flex: 1}}>
              <Text style={styles.bannerText}>Non-Scrap by default.</Text>
              <Text style={styles.bannerSub}>You can switch anytime.</Text>
            </View>
          </View>

          <Text style={styles.label}>Evaluation Type *</Text>
          <View style={styles.evalRow}>
            <EvalOption
              label="Non-Scrap"
              active={evaluationType === 'Non-Scrap'}
              onPress={() => {
                if (hasExisting && !editing) return;
                setEvaluationType('Non-Scrap');
              }}
            />
            <EvalOption
              label="Scrap"
              active={evaluationType === 'Scrap'}
              onPress={() => {
                if (hasExisting && !editing) return;
                setEvaluationType('Scrap');
              }}
            />
          </View>

          <Text style={[styles.label, {marginTop: 12}]}>
            Registration number *
          </Text>
          <TextInput
            value={registrationNumber}
            onChangeText={setRegistrationNumber}
            placeholder="Enter registration number"
            autoCapitalize="characters"
            editable={!hasExisting || editing}
            style={[
              styles.input,
              hasExisting && !editing ? styles.inputDisabled : null,
            ]}
            placeholderTextColor="#9ca3af"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {info ? <Text style={styles.infoText}>{info}</Text> : null}
          </View>

          <View style={styles.ctaBlock}>
          {hasExisting && !editing ? (
            <View style={styles.dualCtaRow}>
              <Pressable
                style={[styles.submitBtn, styles.secondaryBtn, styles.dualBtn]}
                onPress={() => navigation.navigate('InspectionModules', {sellCarId: formattedSellCarId})}
                android_ripple={{color: 'rgba(255,255,255,0.15)'}}>
                <Text style={[styles.submitLabel, styles.secondaryBtnText]}>Proceed</Text>
              </Pressable>
              <Pressable
                style={[styles.submitBtn, styles.dualBtn]}
                onPress={() => setEditing(true)}
                android_ripple={{color: 'rgba(255,255,255,0.15)'}}>
                <Text style={styles.submitLabel}>Edit</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
              disabled={saving}
              onPress={handleSubmit}
              android_ripple={{color: 'rgba(255,255,255,0.15)'}}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitLabel}>
                  {hasExisting ? 'Save & Continue' : 'Next'}
                </Text>
              )}
            </Pressable>
          )}

          <Text style={styles.helperText}>
            {hasExisting && !editing
              ? 'Inspection already exists. Proceed to view/edit modules or switch to edit to change registration.'
              : 'We will save this info to the inspection record.'}
          </Text>
          </View>
        </View>
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={PRIMARY} size="large" />
        </View>
      )}
    </SafeAreaView>
  );
}

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
  content: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    minHeight: 520,
    flexGrow: 1,
    elevation: 1,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowOffset: {width: 0, height: 10},
    shadowRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  cardBody: {
    flexGrow: 1,
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  bannerText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#9a3412',
    flex: 1,
  },
  bannerSub: {
    marginLeft: 8,
    marginTop: 2,
    fontSize: 11,
    color: '#b45309',
  },
  label: {
    marginTop: 18,
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  evalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  evalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 122,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: {width: 0, height: 6},
    shadowRadius: 8,
    elevation: 1,
  },
  evalOptionActive: {
    backgroundColor: '#fff',
    borderColor: PRIMARY,
  },
  evalOptionInactive: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  evalLabel: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '700',
  },
  evalLabelActive: {
    color: PRIMARY,
  },
  evalLabelInactive: {
    color: '#374151',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: PRIMARY,
    backgroundColor: '#fff',
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: PRIMARY,
  },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  inputDisabled: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  submitBtn: {
    marginTop: 20,
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOpacity: 0.18,
    shadowOffset: {width: 0, height: 8},
    shadowRadius: 14,
    elevation: 2,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#e5e7eb',
    marginRight: 10,
  },
  secondaryBtnText: {
    color: '#111827',
  },
  dualCtaRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dualBtn: {
    flex: 1,
  },
  helperText: {
    marginTop: 8,
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
  },
  ctaBlock: {
    marginTop: 'auto',
  },
  errorText: {
    marginTop: 8,
    color: '#b91c1c',
    fontSize: 12,
  },
  infoText: {
    marginTop: 8,
    color: '#0f766e',
    fontSize: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
