import React, {useMemo, useState} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ChevronLeft, Camera, Check} from 'lucide-react-native';
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
} from 'react-native-image-picker';
import {PRIMARY} from '../utils/theme';
import {client} from '../utils/apiClient';
import {statesArr, citiesArr} from '../assets/indian-states-cities';

type RouteParams = {
  sellCarId?: string | number;
};

type YesNo = 'Yes' | 'No' | 'N/A';
type YesNoWithEmpty = YesNo | '';
type YesNoBinary = 'Yes' | 'No' | '';
type RoadTax = 'Lifetime' | 'Limited Period' | '';

type RegistrationForm = {
  taxDocUri: string | null;
  registrationState: string;
  registrationCity: string;
  rto: string;
  rtoNocIssued: YesNoWithEmpty;
  registrationValid: YesNoBinary;
  roadTaxPaid: RoadTax;
  commercialVehicle: YesNoBinary;
  underHypothecation: YesNoBinary;
};

type ErrorMap = Partial<Record<keyof RegistrationForm, string>>;

const INITIAL_FORM: RegistrationForm = {
  taxDocUri: null,
  registrationState: '',
  registrationCity: '',
  rto: '',
  rtoNocIssued: '',
  registrationValid: '',
  roadTaxPaid: '',
  commercialVehicle: '',
  underHypothecation: '',
};

const VehicleDetailsStep1CScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const {sellCarId} = (route.params as RouteParams) || {};
  const formattedSellCarId = sellCarId == null ? '' : String(sellCarId).trim();

  const [form, setForm] = useState<RegistrationForm>(INITIAL_FORM);
  const [errors, setErrors] = useState<ErrorMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [stateModal, setStateModal] = useState(false);
  const [cityModal, setCityModal] = useState(false);
  const [citiesList, setCitiesList] = useState<string[]>([]);

  const requiredFields: (keyof RegistrationForm)[] = [
    'taxDocUri',
    'registrationState',
    'registrationCity',
    'rto',
    'rtoNocIssued',
    'registrationValid',
    'roadTaxPaid',
    'commercialVehicle',
    'underHypothecation',
  ];

  const filledCount = useMemo(
    () =>
      requiredFields.filter(key => {
        const val = form[key];
        return !!val;
      }).length,
    [form, requiredFields],
  );

  const setField = <K extends keyof RegistrationForm>(
    key: K,
    value: RegistrationForm[K],
  ) => {
    setForm(prev => ({...prev, [key]: value}));
    setErrors(prev => ({...prev, [key]: undefined}));
    setMessage(null);
  };

  const onPickImage = async (mode: 'camera' | 'library') => {
    const resp: ImagePickerResponse =
      mode === 'camera'
        ? await launchCamera({mediaType: 'photo', quality: 0.7})
        : await launchImageLibrary({mediaType: 'photo', quality: 0.8});
    if (resp.didCancel || !resp.assets || resp.assets.length === 0) {
      setPickerVisible(false);
      return;
    }
    const uri = resp.assets[0]?.uri;
    if (uri) {
      setField('taxDocUri', uri);
    }
    setPickerVisible(false);
  };

  const validate = (): ErrorMap => {
    const next: ErrorMap = {};
    const addErr = (key: keyof RegistrationForm, msg: string) => {
      next[key] = msg;
    };
    if (!form.taxDocUri) addErr('taxDocUri', 'Required');
    if (!form.registrationState) addErr('registrationState', 'Required');
    if (!form.registrationCity) addErr('registrationCity', 'Required');
    if (!form.rto.trim()) addErr('rto', 'Required');
    if (!form.rtoNocIssued) addErr('rtoNocIssued', 'Required');
    if (!form.registrationValid) addErr('registrationValid', 'Required');
    if (!form.roadTaxPaid) addErr('roadTaxPaid', 'Required');
    if (!form.commercialVehicle) addErr('commercialVehicle', 'Required');
    if (!form.underHypothecation) addErr('underHypothecation', 'Required');
    return next;
  };

  const appendFile = (fd: FormData, uri: string | null, name: string) => {
    if (!uri) return;
    const ext = uri.split('.').pop() || 'jpg';
    const mime =
      ext === 'png'
        ? 'image/png'
        : ext === 'jpeg' || ext === 'jpg'
        ? 'image/jpeg'
        : 'application/octet-stream';
    fd.append(name, {
      uri,
      name: `${name}.${ext}`,
      type: mime,
    } as any);
  };

  const toPayload = () => ({
    'Registration State': form.registrationState,
    'Registration City': form.registrationCity,
    RTO: form.rto,
    'RTO NOC Issued': form.rtoNocIssued,
    'Registration Valid': form.registrationValid,
    'Road Tax Paid': form.roadTaxPaid,
    'Commercial Vehicle': form.commercialVehicle,
    'Under Hypothecation': form.underHypothecation,
  });

  const handleSubmit = async () => {
    setMessage(null);
    const valErrors = validate();
    setErrors(valErrors);
    if (Object.keys(valErrors).length > 0) {
      return;
    }
    if (!formattedSellCarId) {
      Alert.alert('Missing sellCarId', 'Cannot save without sellCarId.');
      return;
    }
    const fd = new FormData();
    fd.append('sellCarId', formattedSellCarId);
    fd.append('Registration Details', JSON.stringify(toPayload()));
    appendFile(fd, form.taxDocUri, 'taxDocument');
    setSubmitting(true);
    try {
      await client.post('/api/add-inspection-registration-details', fd, {
        headers: {'Content-Type': 'multipart/form-data'},
      });
      setMessage('Registration details saved.');
      // Could navigate onward when next step exists.
    } catch (err: any) {
      setMessage(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to save registration details',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setErrors({});
    setMessage(null);
  };

  const currentCities = useMemo(() => {
    if (citiesList.length > 0) {
      return citiesList;
    }
    if (!form.registrationState) return [];
    return citiesArr
      .filter(
        item =>
          item.state?.trim().toLowerCase() ===
          form.registrationState.trim().toLowerCase(),
      )
      .map(item => item.city);
  }, [citiesList, form.registrationState]);

  const renderLabelRow = (label: string, required?: boolean) => (
    <View style={styles.rowLabel}>
      <Text style={styles.label}>{label}</Text>
      {required ? <Text style={styles.asterisk}>*</Text> : null}
    </View>
  );

  const renderChipRow = <T extends string>(
    label: string,
    field: keyof RegistrationForm,
    options: T[],
  ) => (
    <View style={{marginTop: 14}}>
      {renderLabelRow(label, true)}
      <View style={styles.chipRow}>
        {options.map(opt => {
          const active = form[field] === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => setField(field as any, opt as any)}
              style={[styles.chip, active && styles.chipActive]}>
              <Text
                style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {errors[field] ? (
        <Text style={styles.errorText}>{errors[field] as string}</Text>
      ) : null}
    </View>
  );

  const allStates = useMemo(() => {
    return statesArr.map(s => s.value || s.label || s.name);
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <View style={[styles.header, {paddingTop: insets.top + 10, paddingBottom: 10}]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          android_ripple={{color: 'rgba(0,0,0,0.08)'}}>
          <ChevronLeft size={18} color="#111827" strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.headerTitle}>Vehicle details</Text>
        <Pressable style={styles.resetBtn} onPress={resetForm}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Step 1c - Registration details</Text>
          <Text style={styles.progressValue}>
            {filledCount}/{requiredFields.length}
          </Text>
        </View>
        <View style={styles.stepperRow}>
          {[
            {label: 'Step 1a', sub: 'Vehicle details', status: 'done'},
            {label: 'Step 1b', sub: 'RC details', status: 'done'},
            {label: 'Step 1c', sub: 'Registration details', status: 'active'},
          ].map((step, idx, arr) => {
            const isLast = idx === arr.length - 1;
            const isDone = step.status === 'done';
            const isActive = step.status === 'active';
            return (
              <View style={styles.stepItem} key={step.label}>
                <View style={styles.stepTop}>
                  <View
                    style={[
                      styles.stepCircle,
                      isDone && styles.stepCircleDone,
                      isActive && styles.stepCircleActive,
                    ]}>
                    {isDone ? (
                      <Check size={12} color="#10b981" strokeWidth={3} />
                    ) : isActive ? (
                      <View style={styles.stepDot} />
                    ) : null}
                  </View>
                  {!isLast ? (
                    <View
                      style={[
                        styles.stepLine,
                        (isDone || isActive) && styles.stepLineActive,
                      ]}
                    />
                  ) : null}
                </View>
                <Text style={styles.stepLabel}>{step.label}</Text>
                <Text style={styles.stepSub}>{step.sub}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Step 1c - Registration details</Text>
          <Text style={styles.subtitle}>
            Upload tax document and registration information.
          </Text>

          <View style={styles.photoRow}>
            <View style={styles.photoBlock}>
              {renderLabelRow('Tax Document Image', true)}
              <Pressable
                style={styles.photoTile}
                onPress={() => setPickerVisible(true)}>
                {form.taxDocUri ? (
                  <>
                    <Image
                      source={{uri: form.taxDocUri}}
                      style={styles.photoImage}
                      resizeMode="cover"
                    />
                    <View style={styles.photoBadge}>
                      <Check size={14} color="#fff" />
                    </View>
                  </>
                ) : (
                  <>
                    <Camera size={28} color="#9ca3af" strokeWidth={2} />
                    <Text style={styles.photoText}>Add tax image</Text>
                  </>
                )}
              </Pressable>
              {errors.taxDocUri ? (
                <Text style={styles.errorText}>{errors.taxDocUri}</Text>
              ) : null}
            </View>

            <View style={{flex: 1, gap: 12}}>
              <View>
                {renderLabelRow('Registration State', true)}
                <Pressable
                  style={styles.selectBox}
                  onPress={() => setStateModal(true)}>
                  <Text
                    style={[
                      styles.selectValue,
                      !form.registrationState && {color: '#9ca3af'},
                    ]}>
                    {form.registrationState || 'Select State'}
                  </Text>
                </Pressable>
                {errors.registrationState ? (
                  <Text style={styles.errorText}>
                    {errors.registrationState}
                  </Text>
                ) : null}
              </View>

              <View>
                {renderLabelRow('Registration City', true)}
                <Pressable
                  style={styles.selectBox}
                  onPress={() => {
                    if (!form.registrationState) {
                      Alert.alert('Select state first');
                      return;
                    }
                    setCityModal(true);
                  }}>
                  <Text
                    style={[
                      styles.selectValue,
                      !form.registrationCity && {color: '#9ca3af'},
                    ]}>
                    {form.registrationCity || 'Select City'}
                  </Text>
                </Pressable>
                {errors.registrationCity ? (
                  <Text style={styles.errorText}>
                    {errors.registrationCity}
                  </Text>
                ) : null}
              </View>

              <View>
                {renderLabelRow('RTO', true)}
                <TextInput
                  style={styles.input}
                  value={form.rto}
                  onChangeText={t => setField('rto', t)}
                  placeholder="Enter RTO"
                  placeholderTextColor="#9ca3af"
                />
                {errors.rto ? (
                  <Text style={styles.errorText}>{errors.rto}</Text>
                ) : null}
              </View>
            </View>
          </View>

          {renderChipRow('RTO NOC Issued', 'rtoNocIssued', ['Yes', 'No', 'N/A'])}
          {renderChipRow('Registration Valid', 'registrationValid', ['Yes', 'No'])}
          {renderChipRow('Road Tax Paid', 'roadTaxPaid', ['Lifetime', 'Limited Period'])}
          {renderChipRow('Commercial Vehicle', 'commercialVehicle', ['Yes', 'No'])}
          {renderChipRow('Under Hypothecation', 'underHypothecation', ['Yes', 'No'])}

          <View style={styles.ctaBlock}>
            {message ? <Text style={styles.infoText}>{message}</Text> : null}
            <Pressable
              style={[
                styles.submitBtn,
                submitting && styles.submitBtnDisabled,
              ]}
              disabled={submitting}
              onPress={handleSubmit}
              android_ripple={{color: 'rgba(255,255,255,0.15)'}}>
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitLabel}>Save registration details</Text>
              )}
            </Pressable>
            <Text style={styles.helperText}>
              We will save these details to the inspection record.
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Add tax document</Text>
            <Text style={styles.pickerSubtitle}>Choose source</Text>
            <View style={styles.pickerActions}>
              <Pressable
                style={styles.pickerBtn}
                onPress={() => onPickImage('camera')}>
                <Text style={styles.pickerBtnText}>Camera</Text>
              </Pressable>
              <Pressable
                style={styles.pickerBtn}
                onPress={() => onPickImage('library')}>
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

      <Modal
        visible={stateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setStateModal(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setStateModal(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select State</Text>
            <ScrollView style={{maxHeight: 320}}>
              {allStates.map(stateName => {
                const active =
                  form.registrationState.trim().toLowerCase() ===
                  stateName.trim().toLowerCase();
                return (
                  <Pressable
                    key={stateName}
                    style={[
                      styles.modalOption,
                      active && styles.modalOptionActive,
                    ]}
                    onPress={() => {
                      setField('registrationState', stateName);
                      setField('registrationCity', '');
                      const relatedCities = citiesArr
                        .filter(
                          item =>
                            item.state?.trim().toLowerCase() ===
                            stateName.trim().toLowerCase(),
                        )
                        .map(c => c.city);
                      setCitiesList(relatedCities);
                      setStateModal(false);
                    }}>
                    <Text
                      style={[
                        styles.modalOptionLabel,
                        active && styles.modalOptionLabelActive,
                      ]}>
                      {stateName}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={cityModal}
        transparent
        animationType="fade"
        onRequestClose={() => setCityModal(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCityModal(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select City</Text>
            <ScrollView style={{maxHeight: 320}}>
              {currentCities.map(city => {
                const active = form.registrationCity === city;
                return (
                  <Pressable
                    key={city}
                    style={[
                      styles.modalOption,
                      active && styles.modalOptionActive,
                    ]}
                    onPress={() => {
                      setField('registrationCity', city);
                      setCityModal(false);
                    }}>
                    <Text
                      style={[
                        styles.modalOptionLabel,
                        active && styles.modalOptionLabelActive,
                      ]}>
                      {city}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '700',
  },
  progressValue: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '700',
  },
  stepperRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
  },
  stepTop: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#e6f7f0',
    borderWidth: 2,
    borderColor: '#c7f0df',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: {
    backgroundColor: '#ecfdf3',
    borderColor: '#86efac',
  },
  stepCircleActive: {
    borderColor: '#10b981',
    backgroundColor: '#d1fae5',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 5,
    backgroundColor: '#10b981',
  },
  stepLine: {
    flex: 1,
    height: 3,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 6,
    borderRadius: 999,
  },
  stepLineActive: {
    backgroundColor: '#10b981',
  },
  stepLabel: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  stepSub: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 2,
  },
  content: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    minHeight: 420,
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
  rowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  asterisk: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  photoRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  photoBlock: {
    flex: 1,
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
    minHeight: 140,
    overflow: 'hidden',
  },
  photoText: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
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
  selectBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  selectValue: {
    fontSize: 15,
    color: '#111827',
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: '#e5e7eb',
    backgroundColor: '#f3f4f6',
  },
  chipActive: {
    backgroundColor: '#fff',
    borderColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOpacity: 0.08,
    shadowOffset: {width: 0, height: 4},
    shadowRadius: 6,
    elevation: 1,
  },
  chipLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '700',
  },
  chipLabelActive: {
    color: PRIMARY,
  },
  errorText: {
    marginTop: 6,
    color: '#b91c1c',
    fontSize: 12,
  },
  infoText: {
    marginTop: 8,
    color: '#0f766e',
    fontSize: 12,
    textAlign: 'center',
  },
  ctaBlock: {
    marginTop: 20,
  },
  submitBtn: {
    marginTop: 6,
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
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalSheet: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: {width: 0, height: 8},
    shadowRadius: 14,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  modalOptionActive: {
    borderColor: PRIMARY,
    backgroundColor: '#f0f9ff',
  },
  modalOptionLabel: {
    fontSize: 14,
    color: '#111827',
  },
  modalOptionLabelActive: {
    color: PRIMARY,
    fontWeight: '700',
  },
});

export default VehicleDetailsStep1CScreen;



