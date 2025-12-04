import React, {useEffect, useMemo, useState} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {ChevronLeft, Camera, Check} from 'lucide-react-native';
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
} from 'react-native-image-picker';
import {PRIMARY} from '../utils/theme';
import {client} from '../utils/apiClient';

type RouteParams = {
  sellCarId?: string | number;
};

type RcAvailability = 'Original' | 'Duplicate' | 'Photocopy' | 'Lost' | '';
type RcCondition = 'OK' | 'Broken Chip' | 'Damaged' | 'Faded' | '';
type RcMismatch = 'No Mismatch' | 'Details Mismatch' | '';

type RcForm = {
  rcFrontUri: string | null;
  rcBackUri: string | null;
  nameOnRc: string;
  phoneNumber: string;
  address: string;
  email: string;
  profession: string;
  rcAvailability: RcAvailability;
  rcCondition: RcCondition;
  rcMismatch: RcMismatch;
};

type ErrorMap = Partial<Record<keyof RcForm, string>>;

const PROFESSION_OPTIONS = [
  'Agriculturist',
  'Housewife',
  'NRI',
  'Panchayat Member / Politician',
  'Proprietor / Business',
  'Retired',
  'Salaried',
  'Self Employed',
];

const INITIAL_FORM: RcForm = {
  rcFrontUri: null,
  rcBackUri: null,
  nameOnRc: '',
  phoneNumber: '',
  address: '',
  email: '',
  profession: '',
  rcAvailability: '',
  rcCondition: '',
  rcMismatch: '',
};

const VehicleDetailsStep1BScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const {sellCarId} = (route.params as RouteParams) || {};
  const formattedSellCarId = sellCarId == null ? '' : String(sellCarId).trim();

  const [form, setForm] = useState<RcForm>(INITIAL_FORM);
  const [errors, setErrors] = useState<ErrorMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [profModal, setProfModal] = useState(false);
  const [pickerVisible, setPickerVisible] = useState<{
    open: boolean;
    field: 'rcFrontUri' | 'rcBackUri' | null;
  }>({open: false, field: null});
  const [remoteLoading, setRemoteLoading] = useState(false);

  const requiredFields: (keyof RcForm)[] = [
    'rcFrontUri',
    'rcBackUri',
    'nameOnRc',
    'phoneNumber',
    'profession',
    'rcAvailability',
    'rcCondition',
    'rcMismatch',
  ];

  const filledCount = useMemo(() => {
    return requiredFields.filter(key => {
      const val = form[key];
      return !!val;
    }).length;
  }, [form, requiredFields]);

  const progress = useMemo(() => {
    const total = requiredFields.length || 1;
    return Math.min(1, filledCount / total);
  }, [filledCount, requiredFields]);

  const setField = <K extends keyof RcForm>(key: K, value: RcForm[K]) => {
    setForm(prev => ({...prev, [key]: value}));
    setErrors(prev => ({...prev, [key]: undefined}));
    setMessage(null);
  };

  const normalizeOption = <T extends string>(val: any, options: T[]): T | any => {
    if (val == null) return val;
    const raw = String(val).trim();
    const match = options.find(opt => opt.toLowerCase() === raw.toLowerCase());
    return match ?? raw;
  };

  const pickImage = async (mode: 'camera' | 'library') => {
    if (!pickerVisible.field) {
      return;
    }
    const resp: ImagePickerResponse =
      mode === 'camera'
        ? await launchCamera({mediaType: 'photo', quality: 0.7})
        : await launchImageLibrary({mediaType: 'photo', quality: 0.8});
    if (resp.didCancel || !resp.assets || resp.assets.length === 0) {
      setPickerVisible({open: false, field: null});
      return;
    }
    const uri = resp.assets[0]?.uri;
    if (uri) {
      setField(pickerVisible.field, uri);
    }
    setPickerVisible({open: false, field: null});
  };

  const validate = (): ErrorMap => {
    const next: ErrorMap = {};
    const addErr = (key: keyof RcForm, msg: string) => {
      next[key] = msg;
    };
    if (!form.rcFrontUri) addErr('rcFrontUri', 'Required');
    if (!form.rcBackUri) addErr('rcBackUri', 'Required');
    if (!form.nameOnRc.trim()) addErr('nameOnRc', 'Required');
    if (!form.phoneNumber.trim()) addErr('phoneNumber', 'Required');
    if (!form.profession.trim()) addErr('profession', 'Required');
    if (!form.rcAvailability) addErr('rcAvailability', 'Required');
    if (!form.rcCondition) addErr('rcCondition', 'Required');
    if (!form.rcMismatch) addErr('rcMismatch', 'Required');
    if (form.phoneNumber && !/^[0-9]{10}$/.test(form.phoneNumber.trim())) {
      addErr('phoneNumber', 'Enter 10-digit phone number');
    }
    return next;
  };

  const appendFile = (
    fd: FormData,
    uri: string | null,
    name: string,
    filename?: string,
  ) => {
    if (!uri) {
      return;
    }
    const ext = uri.split('.').pop() || 'jpg';
    const mime =
      ext === 'png'
        ? 'image/png'
        : ext === 'jpeg' || ext === 'jpg'
        ? 'image/jpeg'
        : 'application/octet-stream';
    fd.append(name, {
      uri,
      name: filename || `${name}.${ext}`,
      type: mime,
    } as any);
  };

  const toPayload = () => ({
    'Name on RC': form.nameOnRc,
    'Phone Number': form.phoneNumber,
    Address: form.address,
    'Email ID': form.email,
    Profession: form.profession,
    'RC Availability': form.rcAvailability,
    'RC Condition': form.rcCondition,
    'Mismatch on RC': form.rcMismatch,
  });

  useEffect(() => {
    if (!formattedSellCarId) {
      return;
    }
    const fetchExisting = async () => {
      setRemoteLoading(true);
      try {
        const res = await client.get('/api/view-vehicle-details-inspection', {
          params: {sellCarId: formattedSellCarId},
        });
        const rcDetails =
          res.data?.data?.vehicleDetails?.vehicleDetails?.['RC Details'] ||
          res.data?.data?.vehicleDetails?.vehicleDetails?.rcDetails ||
          null;
        if (rcDetails && typeof rcDetails === 'object') {
          setForm(prev => {
            const next: RcForm = {...prev};
            const setIfEmpty = <K extends keyof RcForm>(key: K, val: any) => {
              if (val == null) return;
              if (typeof val === 'string' && val.trim() === '') return;
              if (next[key]) return;
              next[key] = val as any;
            };
            const images =
              rcDetails['RC image'] ||
              rcDetails.rcImage ||
              rcDetails.rcImages ||
              {};
            setIfEmpty('rcFrontUri', images.Front || images.front);
            setIfEmpty('rcBackUri', images.Back || images.back);
            setIfEmpty(
              'nameOnRc',
              rcDetails['Name on RC'] || rcDetails.nameOnRc,
            );
            setIfEmpty(
              'phoneNumber',
              rcDetails['Phone Number'] || rcDetails.phoneNumber,
            );
            setIfEmpty('address', rcDetails.Address || rcDetails.address);
            setIfEmpty('email', rcDetails['Email ID'] || rcDetails.email);
            setIfEmpty(
              'profession',
              normalizeOption(rcDetails.Profession || rcDetails.profession, PROFESSION_OPTIONS),
            );
            setIfEmpty(
              'rcAvailability',
              normalizeOption(
                rcDetails['RC Availability'] || rcDetails.rcAvailability,
                ['Original', 'Duplicate', 'Photocopy', 'Lost'],
              ),
            );
            setIfEmpty(
              'rcCondition',
              normalizeOption(
                rcDetails['RC Condition'] || rcDetails.rcCondition,
                ['OK', 'Broken Chip', 'Damaged', 'Faded'],
              ),
            );
            setIfEmpty(
              'rcMismatch',
              normalizeOption(
                rcDetails['Mismatch on RC'] || rcDetails.rcMismatch,
                ['No Mismatch', 'Details Mismatch'],
              ),
            );
            return next;
          });
          setMessage('Loaded RC details.');
        }
      } catch (err) {
        // silent load failure
      } finally {
        setRemoteLoading(false);
      }
    };
    fetchExisting();
  }, [formattedSellCarId]);

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
    fd.append('RC Details', JSON.stringify(toPayload()));
    appendFile(fd, form.rcFrontUri, 'rcFront');
    appendFile(fd, form.rcBackUri, 'rcBack');

    setSubmitting(true);
    try {
      await client.post('/api/add-inspection-rc-details', fd, {
        headers: {'Content-Type': 'multipart/form-data'},
      });
      setMessage('RC details saved.');
      navigation.navigate('VehicleDetailsStep1C', {
        sellCarId: formattedSellCarId,
      });
    } catch (err: any) {
      setMessage(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to save RC details',
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

  const renderLabelRow = (label: string, required?: boolean) => (
    <View style={styles.rowLabel}>
      <Text style={styles.label}>{label}</Text>
      {required ? <Text style={styles.asterisk}>*</Text> : null}
    </View>
  );

  const renderInput = (
    label: string,
    field: keyof RcForm,
    props?: Partial<React.ComponentProps<typeof TextInput>>,
    required?: boolean,
  ) => (
    <View style={{marginTop: 14}}>
      {renderLabelRow(label, required)}
      <TextInput
        style={styles.input}
        value={(form[field] as string) || ''}
        onChangeText={text => setField(field as any, text as any)}
        placeholder={`Enter ${label.toLowerCase()}`}
        placeholderTextColor="#9ca3af"
        {...props}
      />
      {errors[field] ? (
        <Text style={styles.errorText}>{errors[field] as string}</Text>
      ) : null}
    </View>
  );

  const renderChipRow = <T extends string>(
    label: string,
    field: keyof RcForm,
    options: T[],
    required?: boolean,
  ) => (
    <View style={{marginTop: 16}}>
      {renderLabelRow(label, required)}
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

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
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
          <Text style={styles.progressLabel}>Step 1b - RC details</Text>
          <Text style={styles.progressValue}>
            {filledCount}/{requiredFields.length}
          </Text>
        </View>
        <View style={styles.stepperRow}>
          {[
            {label: 'Step 1a', sub: 'Vehicle details', status: 'done'},
            {label: 'Step 1b', sub: 'RC details', status: 'active'},
            {label: 'Step 1c', sub: 'Owner details', status: 'pending'},
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
          {remoteLoading ? (
            <View style={styles.loaderRow}>
              <ActivityIndicator color={PRIMARY} size="small" />
              <Text style={styles.loaderText}>Loading saved RC details...</Text>
            </View>
          ) : null}
          <Text style={styles.title}>Step 1b - RC details</Text>
          <Text style={styles.subtitle}>
            Capture RC copies and fill registration certificate details.
          </Text>

          <View style={styles.photoRow}>
              <View style={styles.photoBlock}>
                {renderLabelRow('RC Front Image', true)}
                <Pressable
                  style={styles.photoTile}
                  onPress={() =>
                    setPickerVisible({open: true, field: 'rcFrontUri'})
                  }>
                  {form.rcFrontUri ? (
                    <>
                      <Image
                        source={{uri: form.rcFrontUri}}
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
                    <Text style={styles.photoText}>Add front photo</Text>
                  </>
                )}
              </Pressable>
              {errors.rcFrontUri ? (
                <Text style={styles.errorText}>{errors.rcFrontUri}</Text>
              ) : null}
            </View>

              <View style={styles.photoBlock}>
                {renderLabelRow('RC Back Image', true)}
                <Pressable
                  style={styles.photoTile}
                  onPress={() =>
                    setPickerVisible({open: true, field: 'rcBackUri'})
                  }>
                  {form.rcBackUri ? (
                    <>
                      <Image
                        source={{uri: form.rcBackUri}}
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
                    <Text style={styles.photoText}>Add back photo</Text>
                  </>
                )}
              </Pressable>
              {errors.rcBackUri ? (
                <Text style={styles.errorText}>{errors.rcBackUri}</Text>
              ) : null}
            </View>
          </View>

          {renderInput('Name on RC', 'nameOnRc', {autoCapitalize: 'words'}, true)}
          {renderInput('Phone Number', 'phoneNumber', {keyboardType: 'phone-pad', maxLength: 10}, true)}
          {renderInput('Address', 'address', {multiline: true, numberOfLines: 3})}
          {renderInput('Email ID', 'email', {keyboardType: 'email-address'})}

          <View style={{marginTop: 14}}>
            {renderLabelRow('Profession', true)}
            <Pressable
              style={styles.selectBox}
              onPress={() => setProfModal(true)}>
              <Text
                style={[
                  styles.selectValue,
                  !form.profession && {color: '#9ca3af'},
                ]}>
                {form.profession || 'Select profession'}
              </Text>
            </Pressable>
            {errors.profession ? (
              <Text style={styles.errorText}>{errors.profession}</Text>
            ) : null}
          </View>

          {renderChipRow('RC Availability', 'rcAvailability', [
            'Original',
            'Duplicate',
            'Photocopy',
            'Lost',
          ], true)}

          {renderChipRow('RC Condition', 'rcCondition', [
            'OK',
            'Broken Chip',
            'Damaged',
            'Faded',
          ], true)}

          {renderChipRow('Mismatch on RC', 'rcMismatch', [
            'No Mismatch',
            'Details Mismatch',
          ], true)}

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
                <Text style={styles.submitLabel}>Save RC details</Text>
              )}
            </Pressable>
            <Text style={styles.helperText}>
              We will save these RC details to the inspection record.
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={profModal}
        transparent
        animationType="fade"
        onRequestClose={() => setProfModal(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setProfModal(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select profession</Text>
            <ScrollView style={{maxHeight: 280}}>
              {PROFESSION_OPTIONS.map(opt => {
                const active = form.profession === opt;
                return (
                  <Pressable
                    key={opt}
                    style={[
                      styles.modalOption,
                      active && styles.modalOptionActive,
                    ]}
                    onPress={() => {
                      setField('profession', opt);
                      setProfModal(false);
                    }}>
                    <Text
                      style={[
                        styles.modalOptionLabel,
                        active && styles.modalOptionLabelActive,
                      ]}>
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={pickerVisible.open}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible({open: false, field: null})}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Add RC image</Text>
            <Text style={styles.pickerSubtitle}>Choose source</Text>
            <View style={styles.pickerActions}>
              <Pressable
                style={styles.pickerBtn}
                onPress={() => pickImage('camera')}>
                <Text style={styles.pickerBtnText}>Camera</Text>
              </Pressable>
              <Pressable
                style={styles.pickerBtn}
                onPress={() => pickImage('library')}>
                <Text style={styles.pickerBtnText}>Library</Text>
              </Pressable>
              <Pressable
                style={[styles.pickerBtn, styles.pickerCancel]}
                onPress={() => setPickerVisible({open: false, field: null})}>
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
    minHeight: 400,
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
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  loaderText: {
    fontSize: 12,
    color: '#6b7280',
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

export default VehicleDetailsStep1BScreen;
