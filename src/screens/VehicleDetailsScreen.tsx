import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  Animated,
} from 'react-native';
import {
  PinchGestureHandler,
  State,
  TapGestureHandler,
} from 'react-native-gesture-handler';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import {
  ChevronLeft,
  ChevronRight,
  Camera,
  Check,
  Calendar as CalendarIcon,
  Eye,
  X,
} from 'lucide-react-native';
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
} from 'react-native-image-picker';
import {nanoid} from '@reduxjs/toolkit';
import {PRIMARY} from '../utils/theme';
import {client} from '../utils/apiClient';
import {useAppSelector} from '../store/hooks';
import {
  enqueueEngineSync,
  EngineDraft,
  EngineQueueItem,
  loadEngineDraft,
  saveEngineDraft,
  peekEngineQueue,
  dequeueEngineSync,
} from '../utils/engineStorage';
import DiscreteSlider from '../components/DiscreteSlider';

type RouteParams = {
  sellCarId?: string | number;
};

type YesNo = 'Yes' | 'No' | '';
type Embossing =
  | 'OK'
  | 'Rusted'
  | 'Repunched'
  | 'Mismatch'
  | 'Not traceable'
  | 'Incomplete'
  | '';
type Colour = 'Metallic' | 'Non Metallic' | '';
type Transmission = 'Automatic' | 'Manual' | '';
type Emission =
  | 'Euro 1'
  | 'Euro 2'
  | 'Euro 3'
  | 'Euro 4'
  | 'Euro 6'
  | 'Non-Euro'
  | '';
type Fuel =
  | 'Petrol'
  | 'Diesel'
  | 'Petrol + CNG'
  | 'Hybrid'
  | 'Electric'
  | 'LPG'
  | '';
type InsuranceType =
  | 'Comprehensive'
  | 'Third party'
  | 'Zero deprecation'
  | 'Insurance Expired'
  | '';
type CarType =
  | 'Hatchback'
  | 'Sedan'
  | 'SUV'
  | 'MUV'
  | 'Luxury'
  | '';

type EngineForm = {
  chassisImageUri?: string | null;
  insuranceImageUri?: string | null;
  chassisNumber: string;
  chassisEmbossing: Embossing;
  engineNumber: string;
  engineCc: string;
  yearOfManufacturing: string;
  manufacturerName: string;
  carType: CarType;
  modelName: string;
  variantName: string;
  colour: Colour;
  paintType: string;
  transmission: Transmission;
  emission: Emission;
  dateOfRegistration: string;
  odometerReading: string;
  fuelType: Fuel;
  externalFitment: YesNo;
  owners: number;
  duplicateKey: YesNo;
  vinPlate: YesNo;
  jackToolkit: YesNo;
  spareWheel: YesNo;
  insuranceType: InsuranceType;
  insuranceValidUpto: string;
  insuranceIdvValue: string;
};

type ErrorMap = Record<string, string | null>;

const EMBOSSING_OPTIONS: Embossing[] = [
  'OK',
  'Rusted',
  'Repunched',
  'Mismatch',
  'Not traceable',
  'Incomplete',
];

const YEAR_OPTIONS = (() => {
  const start = 2000;
  const end = new Date().getFullYear();
  const list: string[] = [];
  for (let y = end; y >= start; y -= 1) {
    list.push(String(y));
  }
  return list;
})();

const DATE_YEAR_OPTIONS = (() => {
  const start = 2000;
  const end = new Date().getFullYear();
  const list: number[] = [];
  for (let y = end; y >= start; y -= 1) {
    list.push(y);
  }
  return list;
})();

const MONTH_OPTIONS = [
  {value: 1, label: 'Jan'},
  {value: 2, label: 'Feb'},
  {value: 3, label: 'Mar'},
  {value: 4, label: 'Apr'},
  {value: 5, label: 'May'},
  {value: 6, label: 'Jun'},
  {value: 7, label: 'Jul'},
  {value: 8, label: 'Aug'},
  {value: 9, label: 'Sep'},
  {value: 10, label: 'Oct'},
  {value: 11, label: 'Nov'},
  {value: 12, label: 'Dec'},
];

const EMISSION_OPTIONS: Emission[] = [
  'Euro 1',
  'Euro 2',
  'Euro 3',
  'Euro 4',
  'Euro 6',
  'Non-Euro',
];

const FUEL_OPTIONS: Fuel[] = [
  'Petrol',
  'Diesel',
  'Petrol + CNG',
  'Hybrid',
  'Electric',
  'LPG',
];

const INSURANCE_TYPES: InsuranceType[] = [
  'Comprehensive',
  'Third party',
  'Zero deprecation',
  'Insurance Expired',
];

const YES_NO: YesNo[] = ['Yes', 'No'];
const CAR_TYPE_OPTIONS: CarType[] = [
  'Hatchback',
  'Sedan',
  'SUV',
  'MUV',
  'Luxury',
];

const normalizeOption = <T extends string>(val: any, options: T[]): T | any => {
  if (val == null) {
    return val;
  }
  const raw = String(val).trim();
  const match = options.find(
    opt => opt.toLowerCase() === raw.toLowerCase(),
  );
  return match ?? raw;
};

const INITIAL_FORM: EngineForm = {
  chassisImageUri: null,
  insuranceImageUri: null,
  chassisNumber: '',
  chassisEmbossing: '',
  engineNumber: '',
  engineCc: '',
  yearOfManufacturing: '',
  manufacturerName: '',
  carType: '',
  modelName: '',
  variantName: '',
  colour: '',
  paintType: '',
  transmission: '',
  emission: '',
  dateOfRegistration: '',
  odometerReading: '',
  fuelType: '',
  externalFitment: '',
  owners: 0,
  duplicateKey: '',
  vinPlate: '',
  jackToolkit: '',
  spareWheel: '',
  insuranceType: '',
  insuranceValidUpto: '',
  insuranceIdvValue: '',
};

const formatDate = (value: string) => {
  if (!value) {
    return 'Select date';
  }
  return value;
};

const normalizeFuelValue = (val: string) => {
  if (!val) return '';
  const lower = val.trim().toLowerCase();
  if (lower === 'petrol+cng' || lower === 'petrol + cng') {
    return 'Petrol + CNG';
  }
  if (lower === 'petrol') return 'Petrol';
  if (lower === 'diesel') return 'Diesel';
  if (lower === 'hybrid') return 'Hybrid';
  if (lower === 'electric') return 'Electric';
  if (lower === 'lpg') return 'LPG';
  return val;
};

const normalizeInsuranceTypeValue = (val: string) => {
  if (!val) return '';
  const lower = val.trim().toLowerCase();
  if (lower.includes('third')) return 'Third Party';
  if (lower.includes('zero')) return 'Zero Depreciation';
  if (lower.includes('expired')) return 'Insurance Expired';
  if (lower.includes('comprehensive')) return 'Comprehensive';
  return val;
};

const sanitizeEngineInfo = (info: any) => {
  const next = {...info};
  if (next['Fuel Type']) {
    next['Fuel Type'] = normalizeFuelValue(next['Fuel Type']);
  }
  if (next['Insurance Type']) {
    next['Insurance Type'] = normalizeInsuranceTypeValue(next['Insurance Type']);
  }
  if (next['Insurance IDV Value'] != null) {
    const raw = String(next['Insurance IDV Value']).trim();
    next['Insurance IDV Value'] = /^[0-9.]+$/.test(raw) ? raw : '';
  }
  return next;
};

const VehicleDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const {sellCarId} = (route.params as RouteParams) || {};
  const online = useAppSelector(state => state.network.isOnline === true);
  const [inspectionId, setInspectionId] = useState<string | number>('');
  const [form, setForm] = useState<EngineForm>(INITIAL_FORM);
  const [errors, setErrors] = useState<ErrorMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const draftSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const pinchScale = useRef(new Animated.Value(1)).current;
  const baseScale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const combinedScale = Animated.multiply(baseScale, pinchScale);
  const doubleTapRef = useRef<TapGestureHandler | null>(null);
  const [pickerVisible, setPickerVisible] = useState<{
    open: boolean;
    field?: 'chassisImageUri' | 'insuranceImageUri';
    onPick?: (action: 'camera' | 'library') => Promise<void>;
  }>({open: false});
  const [listSelector, setListSelector] = useState<{
    open: boolean;
    label: string;
    field: keyof EngineForm | null;
    options: string[];
  }>({open: false, label: '', field: null, options: []});
  const [datePicker, setDatePicker] = useState<{
    open: boolean;
    field: 'dateOfRegistration' | 'insuranceValidUpto' | null;
    year: number;
    month: number;
    day: number;
  }>({
    open: false,
    field: null,
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
  });
  const [remoteLoading, setRemoteLoading] = useState(false);

  const resolvedSellCarId = useMemo(() => {
    if (sellCarId == null) {
      return '';
    }
    return String(sellCarId);
  }, [sellCarId]);

  useEffect(() => {
    if (!resolvedSellCarId) {
      return;
    }
    const draft = loadEngineDraft(resolvedSellCarId);
    if (draft?.data) {
      setForm((prev: EngineForm) => ({
        ...prev,
        ...draft.data,
      }));
    }
  }, [resolvedSellCarId]);

  useEffect(() => {
    if (!resolvedSellCarId) {
      return;
    }
    if (draftSaveTimer.current) {
      clearTimeout(draftSaveTimer.current);
    }
    draftSaveTimer.current = setTimeout(() => {
      const draft: EngineDraft = {
        sellCarId: resolvedSellCarId,
        data: form,
        updatedAt: Date.now(),
        status: 'draft',
      };
      saveEngineDraft(draft);
    }, 350);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, resolvedSellCarId]);

  // Avoid auto-uploading drafts when simply opening the screen; sync can be triggered after explicit submit.
  useEffect(() => {}, [online]);

  const setField = <K extends keyof EngineForm>(key: K, value: EngineForm[K]) => {
    setForm(prev => {
      const next: EngineForm = {...prev, [key]: value};
      if (key === 'colour') {
        next.paintType = value as string;
      }
      return next;
    });
  };

  const requiredFields: (keyof EngineForm)[] = [
    'chassisImageUri',
    'insuranceImageUri',
    'chassisNumber',
    'chassisEmbossing',
    'engineNumber',
    'engineCc',
    'yearOfManufacturing',
    'manufacturerName',
    'carType',
    'modelName',
    'variantName',
    'colour',
    'paintType',
    'transmission',
    'emission',
    'dateOfRegistration',
    'odometerReading',
    'fuelType',
    'externalFitment',
    'owners',
    'duplicateKey',
    'vinPlate',
    'jackToolkit',
    'spareWheel',
    'insuranceType',
    'insuranceValidUpto',
  ];

  const filledCount = useMemo(() => {
    return requiredFields.filter(field => {
      const val = form[field];
      if (typeof val === 'number') {
        return true;
      }
      return !!val;
    }).length;
  }, [form, requiredFields]);

  useEffect(() => {
    if (!resolvedSellCarId) {
      return;
    }
    const fetchExistingServer = async () => {
      try {
        setRemoteLoading(true);
        const [inspRes, res] = await Promise.all([
          client
            .get('/api/view-inspection', {params: {sellCarId: resolvedSellCarId}})
            .catch(() => null),
          client.get('/api/view-vehicle-details-inspection', {
            params: {sellCarId: resolvedSellCarId},
          }),
        ]);
        const inspId =
          inspRes?.data?.data?.allInspections?.[0]?.id ||
          inspRes?.data?.data?.id ||
          '';
        if (inspId) {
          setInspectionId(inspId);
        }
        const engineInfo =
          res.data?.data?.vehicleDetails?.vehicleDetails?.['Engine Info'] ||
          res.data?.data?.vehicleDetails?.vehicleDetails?.engineInfo ||
          res.data?.data?.vehiclesDetails?.vehicleDetails?.['Engine Info'] ||
          res.data?.data?.vehiclesDetails?.vehicleDetails?.engineInfo ||
          res.data?.data?.EngineInfo ||
          res.data?.data?.engineInfo ||
          res.data?.data?.['Engine Info'] ||
          null;
        if (engineInfo && typeof engineInfo === 'object') {
          setForm(prev => {
            const next: EngineForm = {...prev};
            const setIfEmpty = <K extends keyof EngineForm>(
              key: K,
              val: EngineForm[K],
            ) => {
              if (val == null || val === '') {
                return;
              }
              if (typeof prev[key] === 'string' && (prev[key] as string)) {
                return;
              }
              next[key] = val;
            };

            setIfEmpty(
              'chassisNumber',
              engineInfo['Chassis Number'] || engineInfo.chassisNumber,
            );
            setIfEmpty(
              'chassisEmbossing',
              engineInfo['Chassis Number Embossing'] ||
                engineInfo.chassisEmbossing,
            );
            setIfEmpty(
              'engineNumber',
              engineInfo['Engine Number'] || engineInfo.engineNumber,
            );
            setIfEmpty('engineCc', engineInfo['Engine CC'] || engineInfo.engineCc);
            setIfEmpty(
              'yearOfManufacturing',
              engineInfo['Year of Manufacturing'] ||
                engineInfo.yearOfManufacturing,
            );
            setIfEmpty(
              'manufacturerName',
              engineInfo['Manufacturer Name'] || engineInfo.manufacturerName,
            );
            setIfEmpty(
              'carType',
              normalizeOption(
                engineInfo['Car Type'] || engineInfo.carType,
                CAR_TYPE_OPTIONS,
              ),
            );
            setIfEmpty('modelName', engineInfo['Model Name'] || engineInfo.modelName);
            setIfEmpty(
              'variantName',
              engineInfo['Variant Name'] || engineInfo.variantName,
            );
            setIfEmpty(
              'colour',
              normalizeOption(engineInfo['Colour'] || engineInfo.colour, [
                'Metallic',
                'Non Metallic',
              ]) as Colour,
            );
            setIfEmpty(
              'paintType',
              normalizeOption(engineInfo['Paint Type'] || engineInfo.paintType, [
                'Metallic',
                'Non Metallic',
              ]),
            );
            setIfEmpty(
              'transmission',
              normalizeOption(
                engineInfo['Transmission'] || engineInfo.transmission,
                ['Automatic', 'Manual'],
              ),
            );
            setIfEmpty(
              'emission',
              (() => {
                const val = normalizeOption(
                  engineInfo['Emission'] || engineInfo.emission,
                  EMISSION_OPTIONS,
                );
                if (val === 'Non Euro') {
                  return 'Non-Euro';
                }
                return val;
              })(),
            );
            setIfEmpty(
              'dateOfRegistration',
              engineInfo['Date of Registration'] || engineInfo.dateOfRegistration,
            );
            setIfEmpty(
              'odometerReading',
              engineInfo['Odometer Reading'] || engineInfo.odometerReading,
            );
            setIfEmpty(
              'fuelType',
              (() => {
                const val = normalizeOption(
                  engineInfo['Fuel Type'] || engineInfo.fuelType,
                  FUEL_OPTIONS,
                );
                if (val === 'Petrol+CNG') {
                  return 'Petrol + CNG';
                }
                return val;
              })(),
            );
            setIfEmpty(
              'externalFitment',
              engineInfo['External CNG/LPG Fitment'] ||
                engineInfo.externalFitment,
            );
            const ownersRaw =
              engineInfo['No. of Owners'] || engineInfo.owners || engineInfo.NoOfOwners;
            if (ownersRaw != null && next.owners === 0) {
              const parsed = Number(ownersRaw);
              if (!Number.isNaN(parsed)) {
                next.owners = parsed;
              }
            }
            setIfEmpty(
              'duplicateKey',
              engineInfo['Duplicate Key Available'] || engineInfo.duplicateKey,
            );
            setIfEmpty(
              'vinPlate',
              engineInfo['VIN Plate Available'] || engineInfo.vinPlate,
            );
            setIfEmpty(
              'jackToolkit',
              engineInfo['Jack & Toolkit Available'] || engineInfo.jackToolkit,
            );
            setIfEmpty(
              'spareWheel',
              engineInfo['Spare Wheel Available'] || engineInfo.spareWheel,
            );
            setIfEmpty(
              'insuranceType',
              engineInfo['Insurance Type'] || engineInfo.insuranceType,
            );
            setIfEmpty(
              'insuranceValidUpto',
              engineInfo['Insurance Valid Upto'] || engineInfo.insuranceValidUpto,
            );
            setIfEmpty(
              'insuranceIdvValue',
              engineInfo['Insurance IDV Value'] || engineInfo.insuranceIdvValue,
            );
            setIfEmpty(
              'chassisImageUri',
              engineInfo['Chassis image'] || engineInfo.chassisImageUri,
            );
            setIfEmpty(
              'insuranceImageUri',
              engineInfo['Insurance image'] || engineInfo.insuranceImageUri,
            );
            return next;
          });
        }
      } catch {
        // silent
      } finally {
        setRemoteLoading(false);
      }
    };

    fetchExistingServer();
  }, [resolvedSellCarId]);

  const progress = Math.min(
    1,
    requiredFields.length > 0 ? filledCount / requiredFields.length : 0,
  );

  const pickImage = async (field: 'chassisImageUri' | 'insuranceImageUri') => {
    const pickHandler = async (action: 'camera' | 'library') => {
      const resp: ImagePickerResponse =
        action === 'camera'
          ? await launchCamera({mediaType: 'photo', quality: 0.7})
          : await launchImageLibrary({mediaType: 'photo', quality: 0.8});
      if (resp.didCancel || !resp.assets || resp.assets.length === 0) {
        return;
      }
      const uri = resp.assets[0]?.uri;
      if (uri) {
        setField(field, uri);
        setMessage(null);
      }
      setPickerVisible({open: false});
    };

    setPickerVisible({field, open: true, onPick: pickHandler});
  };

  const validate = (): ErrorMap => {
    const next: ErrorMap = {};
    const addErr = (key: keyof EngineForm, msg: string) => {
      next[key] = msg;
    };
    if (!form.chassisNumber || form.chassisNumber.length < 5) {
      addErr('chassisNumber', 'Chassis number must be at least 5 characters');
    }
    if (!form.chassisEmbossing) {
      addErr('chassisEmbossing', 'Required');
    }
    if (!form.engineNumber || form.engineNumber.length < 3) {
      addErr('engineNumber', 'Engine number must be at least 3 characters');
    }
    if (!form.engineCc || form.engineCc.length < 2 || form.engineCc.length > 5) {
      addErr('engineCc', 'Enter a valid CC value');
    }
    if (!form.yearOfManufacturing) {
      addErr('yearOfManufacturing', 'Required');
    }
    if (!form.manufacturerName) {
      addErr('manufacturerName', 'Required');
    }
    if (!form.carType) {
      addErr('carType', 'Required');
    }
    if (!form.modelName) {
      addErr('modelName', 'Required');
    }
    if (!form.variantName) {
      addErr('variantName', 'Required');
    }
    if (!form.colour) {
      addErr('colour', 'Required');
    }
    if (!form.transmission) {
      addErr('transmission', 'Required');
    }
    if (!form.emission) {
      addErr('emission', 'Required');
    }
    if (!form.dateOfRegistration) {
      addErr('dateOfRegistration', 'Required');
    }
    if (!form.odometerReading) {
      addErr('odometerReading', 'Required');
    }
    if (!form.fuelType) {
      addErr('fuelType', 'Required');
    }
    if (!form.externalFitment) {
      addErr('externalFitment', 'Required');
    }
    if (form.owners < 0) {
      addErr('owners', 'Required');
    }
    if (!form.duplicateKey) {
      addErr('duplicateKey', 'Required');
    }
    if (!form.vinPlate) {
      addErr('vinPlate', 'Required');
    }
    if (!form.jackToolkit) {
      addErr('jackToolkit', 'Required');
    }
    if (!form.spareWheel) {
      addErr('spareWheel', 'Required');
    }
    if (!form.insuranceType) {
      addErr('insuranceType', 'Required');
    }
    if (!form.insuranceValidUpto) {
      addErr('insuranceValidUpto', 'Required');
    }
    if (
      form.insuranceIdvValue &&
      !/^[0-9.]+$/.test(form.insuranceIdvValue.trim())
    ) {
      addErr('insuranceIdvValue', 'Numbers only');
    }
    if (!form.chassisImageUri) {
      addErr('chassisImageUri', 'Required');
    }
    if (!form.insuranceImageUri) {
      addErr('insuranceImageUri', 'Required');
    }
    return next;
  };

  const daysInMonth = (year: number, month: number) =>
    new Date(year, month, 0).getDate();

  const onSelectDate = (field: 'dateOfRegistration' | 'insuranceValidUpto') => {
    let year = new Date().getFullYear();
    let month = new Date().getMonth() + 1;
    let day = new Date().getDate();

    if (form[field]) {
      const parts = form[field].split('-');
      if (parts.length === 3) {
        const parsedYear = Number(parts[0]);
        const parsedMonth = Number(parts[1]);
        const parsedDay = Number(parts[2]);
        if (!Number.isNaN(parsedYear)) {
          year = parsedYear;
        }
        if (!Number.isNaN(parsedMonth)) {
          month = parsedMonth;
        }
        if (!Number.isNaN(parsedDay)) {
          day = parsedDay;
        }
      }
    }

    const maxDay = daysInMonth(year, month);
    setDatePicker({
      open: true,
      field,
      year,
      month,
      day: Math.min(day, maxDay),
    });
  };

  const updateDatePart = (part: 'year' | 'month' | 'day', value: number) => {
    setDatePicker(prev => {
      let nextYear = prev.year;
      let nextMonth = prev.month;
      let nextDay = prev.day;

      if (part === 'year') {
        nextYear = value;
      }
      if (part === 'month') {
        nextMonth = value;
      }
      if (part === 'day') {
        nextDay = value;
      }

      const maxDay = daysInMonth(nextYear, nextMonth);
      if (nextDay > maxDay) {
        nextDay = maxDay;
      }

      return {
        ...prev,
        year: nextYear,
        month: nextMonth,
        day: nextDay,
      };
    });
  };

  const closeDatePicker = () =>
    setDatePicker(prev => ({
      ...prev,
      open: false,
      field: null,
    }));

  const applyDatePicker = () => {
    if (!datePicker.field) {
      return;
    }
    const iso = `${datePicker.year}-${String(datePicker.month).padStart(
      2,
      '0',
    )}-${String(datePicker.day).padStart(2, '0')}`;
    setField(datePicker.field, iso);
    closeDatePicker();
  };

  const changeMonth = (delta: number) => {
    setDatePicker(prev => {
      let nextMonth = prev.month + delta;
      let nextYear = prev.year;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      } else if (nextMonth < 1) {
        nextMonth = 12;
        nextYear -= 1;
      }
      const maxDay = daysInMonth(nextYear, nextMonth);
      const nextDay = Math.min(prev.day, maxDay);
      return {...prev, month: nextMonth, year: nextYear, day: nextDay};
    });
  };

  const getCalendarDays = (year: number, month: number) => {
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0-6 (Sun-Sat)
    const totalDays = daysInMonth(year, month);
    const days: Array<number | null> = [];
    for (let i = 0; i < firstDay; i += 1) {
      days.push(null);
    }
    for (let d = 1; d <= totalDays; d += 1) {
      days.push(d);
    }
    return days;
  };

  const toEngineInfoPayload = () => ({
    'Chassis Number': form.chassisNumber,
    'Manufacturer Name': form.manufacturerName,
    'Chassis Number Embossing': form.chassisEmbossing,
    'Chassis image': form.chassisImageUri ?? '',
    'Engine Number': form.engineNumber,
    'Engine CC': form.engineCc,
    'Year of Manufacturing': form.yearOfManufacturing,
    'Car Type': form.carType ? String(form.carType).toUpperCase() : '',
    'Model Name': form.modelName,
    'Variant Name': form.variantName,
    Colour: form.colour,
    'Paint Type': form.paintType || form.colour,
    Transmission: form.transmission,
    Emission: form.emission === 'Non-Euro' ? 'Non Euro' : form.emission,
    'Date of Registration': form.dateOfRegistration,
    'Odometer Reading': form.odometerReading,
    'Fuel Type': normalizeFuelValue(form.fuelType),
    'External CNG/LPG Fitment': form.externalFitment,
    'No. of Owners': String(form.owners),
    'Duplicate Key Available': form.duplicateKey,
    'VIN Plate Available': form.vinPlate,
    'Jack & Toolkit Available': form.jackToolkit,
    'Spare Wheel Available': form.spareWheel,
    'Insurance Type': normalizeInsuranceTypeValue(form.insuranceType),
    'Insurance image': form.insuranceImageUri ?? '',
    'Insurance Valid Upto': form.insuranceValidUpto,
    'Insurance IDV Value': form.insuranceIdvValue,
  });

  const uploadItem = async (item: EngineQueueItem) => {
    const formData = new FormData();
    const sanitizedInfo = sanitizeEngineInfo(item.payload.engineInfo);
    formData.append('sellCarId', item.sellCarId);
    if (inspectionId) {
      formData.append('id', String(inspectionId));
    }
    formData.append('Engine Info', JSON.stringify(sanitizedInfo));

    const appendFile = (uri: string | null | undefined, name: string) => {
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
      formData.append(name, {
        uri,
        name: `${name}.${ext}`,
        type: mime,
      } as any);
    };

    appendFile(item.payload.chassisUri, 'chassis');
    appendFile(item.payload.insuranceUri, 'insurance');

    await client.post('/api/add-inspection-vehicle-details', formData, {
      headers: {'Content-Type': 'multipart/form-data'},
    });
  };

  const flushQueue = async () => {
    const queue = peekEngineQueue();
    if (!online || queue.length === 0) {
      return;
    }
    setIsSyncingQueue(true);
    for (const item of queue) {
      try {
        await uploadItem(item);
        dequeueEngineSync(item.id);
      } catch {
        // keep for retry
      }
    }
    setIsSyncingQueue(false);
  };

  const handleSubmit = async () => {
    setMessage(null);
    const valErrors = validate();
    setErrors(valErrors);
    if (Object.keys(valErrors).length > 0) {
      return;
    }
    if (!resolvedSellCarId) {
      Alert.alert('Missing sellCarId', 'Cannot save without sellCarId.');
      return;
    }
    setSubmitting(true);
    let saved = false;
    const engineInfo = toEngineInfoPayload();
    const queueItem: EngineQueueItem = {
      id: nanoid(),
      sellCarId: resolvedSellCarId,
      payload: {
        engineInfo,
        chassisUri: form.chassisImageUri || undefined,
        insuranceUri: form.insuranceImageUri || undefined,
      },
      enqueuedAt: Date.now(),
      attempts: 0,
    };

    const draft: EngineDraft = {
      sellCarId: resolvedSellCarId,
      data: form,
      updatedAt: Date.now(),
      status: online ? 'synced' : 'pending-sync',
    };
    saveEngineDraft(draft);

    if (online) {
      try {
        await uploadItem(queueItem);
        setMessage('Saved online.');
        saved = true;
      } catch (err: any) {
        enqueueEngineSync(queueItem);
        const status = err?.response?.status || err?.status;
        const msg =
          err?.response?.data?.message ||
          err?.data?.message ||
          err?.message ||
          'Saved locally. Will sync when online.';
        console.warn('[VehicleDetails] engine upload failed', status, msg, err?.data);
        setMessage(msg);
        saved = true;
      }
    } else {
      enqueueEngineSync(queueItem);
      setMessage('Saved locally. Will sync when online.');
      saved = true;
    }
    setSubmitting(false);
    if (saved) {
      navigation.navigate('VehicleDetailsStep1B', {
        sellCarId: resolvedSellCarId,
      });
    }
  };

  const renderOptionPills = <T extends string>(
    field: keyof EngineForm,
    options: T[],
  ) => (
    <View style={styles.pillRow}>
      {options.map(opt => {
        const active = form[field] === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => setField(field as any, opt as any)}
            style={[
              styles.pill,
              active ? styles.pillActive : styles.pillInactive,
            ]}>
            <Text
              style={[
                styles.pillLabel,
                active ? styles.pillLabelActive : styles.pillLabelInactive,
              ]}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderBoxOptions = <T extends string>(
    field: keyof EngineForm,
    options: T[],
  ) => (
    <View style={styles.boxGrid}>
      {options.map(opt => {
        const active = form[field] === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => setField(field as any, opt as any)}
            android_ripple={{color: 'transparent', borderless: false, foreground: false}}
            style={({pressed}) => [
              styles.boxOption,
              active && styles.boxOptionActive,
              pressed && styles.boxOptionPressed,
            ]}>
            <Text
              style={[
                styles.boxOptionLabel,
                active && styles.boxOptionLabelActive,
              ]}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderSelectRow = (
    label: string,
    field: keyof EngineForm,
    options: string[],
    required?: boolean,
  ) => (
    <View style={{marginTop: 14}}>
      <View style={styles.rowLabel}>
        <Text style={styles.label}>{label}</Text>
        {required ? <Text style={styles.asterisk}>*</Text> : null}
      </View>
      {field === 'chassisEmbossing' ||
      field === 'carType' ||
      field === 'emission' ||
      field === 'fuelType' ? (
        renderOptionPills(field, options)
      ) : options.length <= 5 ? (
        renderOptionPills(field, options)
      ) : (
        <Pressable
          style={styles.selectBox}
          onPress={() =>
            setListSelector({
              open: true,
              label,
              field,
              options,
            })
          }>
          <Text
            style={[
              styles.selectValue,
              !form[field] && {color: '#9ca3af'},
            ]}>
            {(form[field] as string) || 'Select'}
          </Text>
          <CalendarIcon size={16} color="#9ca3af" />
        </Pressable>
      )}
      {errors[field] ? (
        <Text style={styles.errorText}>{errors[field] as string}</Text>
      ) : null}
    </View>
  );

  const renderDateRow = (
    label: string,
    field: 'dateOfRegistration' | 'insuranceValidUpto',
  ) => (
    <View style={{marginTop: 14}}>
      <View style={styles.rowLabel}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.asterisk}>*</Text>
      </View>
      <Pressable
        style={styles.selectBox}
        onPress={() => onSelectDate(field)}>
        <Text
          style={[
            styles.selectValue,
            !form[field] && {color: '#9ca3af'},
          ]}>
          {formatDate(form[field])}
        </Text>
        <CalendarIcon size={16} color="#9ca3af" />
      </Pressable>
      {errors[field] ? (
        <Text style={styles.errorText}>{errors[field] as string}</Text>
      ) : null}
    </View>
  );

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
        <Pressable
          style={styles.resetBtn}
          onPress={() => setForm(INITIAL_FORM)}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Step 1a - Vehicle details</Text>
          <Text style={styles.progressValue}>
            {filledCount}/{requiredFields.length}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.cardBody}>
          <Text style={styles.title}>Vehicle Details</Text>
          <Text style={styles.subtitle}>
            Capture chassis and insurance, then fill vehicle details.
          </Text>

            <View style={styles.photoRow}>
              <View style={styles.photoBlock}>
                <View style={styles.rowLabel}>
          <Text style={styles.label}>Chassis Image</Text>
          <Text style={styles.asterisk}>*</Text>
        </View>
                <Pressable
                  style={styles.photoTile}
                  onPress={() => pickImage('chassisImageUri')}>
                  {form.chassisImageUri ? (
                    <>
                      <Image
                        source={{uri: form.chassisImageUri}}
                        style={styles.photoImage}
                        resizeMode="cover"
                      />
                      <View style={styles.photoBadge}>
                        <Check size={14} color="#fff" />
                      </View>
                      <Pressable
                        style={styles.eyeIcon}
                        onPress={() => {
                          setPreviewUri(form.chassisImageUri || null);
                          setPreviewVisible(true);
                        }}>
                        <Eye size={16} color="#111827" />
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Camera size={28} color="#9ca3af" strokeWidth={2} />
                      <Text style={styles.photoText}>Add photo</Text>
                    </>
                  )}
                </Pressable>
                {errors.chassisImageUri ? (
                  <Text style={styles.errorText}>{errors.chassisImageUri}</Text>
                ) : null}
              </View>

              <View style={styles.photoBlock}>
                <View style={styles.rowLabel}>
                  <Text style={styles.label}>Insurance</Text>
                  <Text style={styles.asterisk}>*</Text>
                </View>
                <Pressable
                  style={styles.photoTile}
                  onPress={() => pickImage('insuranceImageUri')}>
                  {form.insuranceImageUri ? (
                    <>
                      <Image
                        source={{uri: form.insuranceImageUri}}
                        style={styles.photoImage}
                        resizeMode="cover"
                      />
                      <View style={styles.photoBadge}>
                        <Check size={14} color="#fff" />
                      </View>
                      <Pressable
                        style={styles.eyeIcon}
                        onPress={() => {
                          setPreviewUri(form.insuranceImageUri || null);
                          setPreviewVisible(true);
                        }}>
                        <Eye size={16} color="#111827" />
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Camera size={28} color="#9ca3af" strokeWidth={2} />
                      <Text style={styles.photoText}>Add photo</Text>
                    </>
                  )}
                </Pressable>
                {errors.insuranceImageUri ? (
                  <Text style={styles.errorText}>
                    {errors.insuranceImageUri}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.rowLabel}>
              <Text style={styles.label}>Chassis number</Text>
              <Text style={styles.asterisk}>*</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.chassisNumber}
              onChangeText={t => setField('chassisNumber', t)}
              placeholder="Enter chassis number"
              placeholderTextColor="#9ca3af"
            />
            {errors.chassisNumber ? (
              <Text style={styles.errorText}>{errors.chassisNumber}</Text>
            ) : null}

            {renderSelectRow(
              'Chassis number embossing',
              'chassisEmbossing',
              EMBOSSING_OPTIONS,
              true,
            )}

            <View style={styles.rowLabel}>
              <Text style={styles.label}>Engine number</Text>
              <Text style={styles.asterisk}>*</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.engineNumber}
              onChangeText={t => setField('engineNumber', t)}
              placeholder="Enter engine number"
              placeholderTextColor="#9ca3af"
            />
            {errors.engineNumber ? (
              <Text style={styles.errorText}>{errors.engineNumber}</Text>
            ) : null}

            <View style={styles.rowLabel}>
              <Text style={styles.label}>Engine CC</Text>
              <Text style={styles.asterisk}>*</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.engineCc}
              keyboardType="numeric"
              onChangeText={t => setField('engineCc', t)}
              placeholder="Enter CC"
              placeholderTextColor="#9ca3af"
            />
            {errors.engineCc ? (
              <Text style={styles.errorText}>{errors.engineCc}</Text>
            ) : null}

            {renderSelectRow(
              'Year of Manufacturing',
              'yearOfManufacturing',
              YEAR_OPTIONS,
              true,
            )}

            <View style={{marginTop: 14}}>
              <View style={styles.rowLabel}>
              <Text style={styles.label}>Manufacturer name</Text>
              <Text style={styles.asterisk}>*</Text>
            </View>
              <TextInput
                style={styles.input}
                value={form.manufacturerName}
                onChangeText={t => setField('manufacturerName', t)}
                placeholder="Enter manufacturer name"
                placeholderTextColor="#9ca3af"
              />
            {errors.manufacturerName ? (
              <Text style={styles.errorText}>{errors.manufacturerName}</Text>
            ) : null}
          </View>

          {renderSelectRow('Car type', 'carType', CAR_TYPE_OPTIONS, true)}

          <View style={{marginTop: 14}}>
            <View style={styles.rowLabel}>
              <Text style={styles.label}>Model name</Text>
              <Text style={styles.asterisk}>*</Text>
            </View>
              <TextInput
                style={styles.input}
                value={form.modelName}
                onChangeText={t => setField('modelName', t)}
                placeholder="Enter model name"
                placeholderTextColor="#9ca3af"
              />
              {errors.modelName ? (
                <Text style={styles.errorText}>{errors.modelName}</Text>
              ) : null}
            </View>

            <View style={{marginTop: 14}}>
              <View style={styles.rowLabel}>
              <Text style={styles.label}>Variant name</Text>
              <Text style={styles.asterisk}>*</Text>
            </View>
              <TextInput
                style={styles.input}
                value={form.variantName}
                onChangeText={t => setField('variantName', t)}
                placeholder="Enter variant name"
                placeholderTextColor="#9ca3af"
              />
              {errors.variantName ? (
                <Text style={styles.errorText}>{errors.variantName}</Text>
              ) : null}
            </View>

            {renderSelectRow('Colour', 'colour', ['Metallic', 'Non Metallic'], true)}

            <View style={{marginTop: 14}}>
              <View style={styles.rowLabel}>
                <Text style={styles.label}>Paint type</Text>
                <Text style={styles.asterisk}>*</Text>
              </View>
              <TextInput
                editable={false}
                style={[styles.input, {backgroundColor: '#f9fafb'}]}
                value={form.paintType}
                placeholder="Auto"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {renderSelectRow(
              'Transmission',
              'transmission',
              ['Automatic', 'Manual'],
              true,
            )}
            {renderSelectRow('Emission', 'emission', EMISSION_OPTIONS, true)}

            {renderDateRow('Date of registration', 'dateOfRegistration')}

            <View style={{marginTop: 14}}>
              <View style={styles.rowLabel}>
                <Text style={styles.label}>Odometer reading</Text>
                <Text style={styles.asterisk}>*</Text>
              </View>
              <TextInput
                style={styles.input}
                value={form.odometerReading}
                keyboardType="numeric"
                onChangeText={t => setField('odometerReading', t)}
                placeholder="Enter reading"
                placeholderTextColor="#9ca3af"
              />
              {errors.odometerReading ? (
                <Text style={styles.errorText}>{errors.odometerReading}</Text>
              ) : null}
            </View>

            {renderSelectRow('Fuel type', 'fuelType', FUEL_OPTIONS, true)}

            {renderSelectRow(
              'External CNG/LPG fitment',
              'externalFitment',
              YES_NO,
              true,
            )}

            <View style={{marginTop: 14}}>
              <View style={styles.rowLabel}>
                <Text style={styles.label}>No. of owners</Text>
                <Text style={styles.asterisk}>*</Text>
              </View>
              <DiscreteSlider
                min={0}
                max={5}
                step={1}
                value={form.owners}
                onChange={val => setField('owners', val)}
              />
            </View>

            {renderSelectRow('Duplicate key available', 'duplicateKey', YES_NO, true)}
            {renderSelectRow('VIN plate available', 'vinPlate', YES_NO, true)}
            {renderSelectRow('Jack & toolkit available', 'jackToolkit', YES_NO, true)}
            {renderSelectRow('Spare wheel available', 'spareWheel', YES_NO, true)}
            {renderSelectRow('Insurance type', 'insuranceType', INSURANCE_TYPES, true)}
            {renderDateRow('Insurance valid upto', 'insuranceValidUpto')}

            <View style={{marginTop: 14}}>
              <View style={styles.rowLabel}>
                <Text style={styles.label}>Insurance IDV value</Text>
              </View>
              <TextInput
                style={styles.input}
                value={form.insuranceIdvValue}
                onChangeText={t => setField('insuranceIdvValue', t)}
                placeholder="Enter value"
                placeholderTextColor="#9ca3af"
              />
              {errors.insuranceIdvValue ? (
                <Text style={styles.errorText}>{errors.insuranceIdvValue}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.ctaBlock}>
            {message ? <Text style={styles.infoText}>{message}</Text> : null}
            <Pressable
              style={[
                styles.submitBtn,
                (submitting || isSyncingQueue) && styles.submitBtnDisabled,
              ]}
              disabled={submitting || isSyncingQueue}
              onPress={handleSubmit}
              android_ripple={{color: 'rgba(255,255,255,0.15)'}}>
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitLabel}>Next</Text>
              )}
            </Pressable>
            <Text style={styles.helperText}>
              Saved locally and synced when connection is stable.
            </Text>
          </View>
        </View>
      </ScrollView>

      {isSyncingQueue ? (
        <View style={styles.syncBadge}>
          <ActivityIndicator color="#fff" size="small" />
          <Text style={styles.syncText}>Syncing drafts...</Text>
        </View>
      ) : null}

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
        onRequestClose={() => setPickerVisible({open: false})}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Add photo</Text>
            <Text style={styles.pickerSubtitle}>Choose source</Text>
            <View style={styles.pickerActions}>
              <Pressable
                style={styles.pickerBtn}
                onPress={() => pickerVisible.onPick?.('camera')}>
                <Text style={styles.pickerBtnText}>Camera</Text>
              </Pressable>
              <Pressable
                style={styles.pickerBtn}
                onPress={() => pickerVisible.onPick?.('library')}>
                <Text style={styles.pickerBtnText}>Library</Text>
              </Pressable>
              <Pressable
                style={[styles.pickerBtn, styles.pickerCancel]}
                onPress={() => setPickerVisible({open: false})}>
                <Text style={[styles.pickerBtnText, {color: '#b91c1c'}]}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={listSelector.open}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setListSelector({open: false, label: '', field: null, options: []})
        }>
        <View style={styles.selectorOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() =>
              setListSelector({open: false, label: '', field: null, options: []})
            }
          />
          <View style={styles.selectorSheet}>
            <View style={styles.selectorHeader}>
              <Text style={styles.selectorTitle}>{listSelector.label}</Text>
              <Pressable
                style={styles.selectorClose}
                onPress={() =>
                  setListSelector({open: false, label: '', field: null, options: []})
                }>
                <X size={16} color="#6b7280" />
              </Pressable>
            </View>
            <ScrollView style={styles.selectorList}>
              {listSelector.options.map(opt => {
                const active =
                  listSelector.field && form[listSelector.field] === opt;
                return (
                  <Pressable
                    key={opt}
                    style={[
                      styles.selectorOption,
                      active && styles.selectorOptionActive,
                    ]}
                    onPress={() => {
                      if (listSelector.field) {
                        setField(listSelector.field as any, opt as any);
                      }
                      setListSelector({
                        open: false,
                        label: '',
                        field: null,
                        options: [],
                      });
                    }}>
                    <Text
                      style={[
                        styles.selectorOptionText,
                        active && styles.selectorOptionTextActive,
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
        visible={datePicker.open}
        transparent
        animationType="fade"
        onRequestClose={closeDatePicker}>
        <View style={styles.selectorOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDatePicker} />
          <View style={styles.datePickerSheet}>
            <View style={styles.selectorHeader}>
              <Text style={styles.selectorTitle}>Select date</Text>
              <Pressable style={styles.selectorClose} onPress={closeDatePicker}>
                <X size={16} color="#6b7280" />
              </Pressable>
            </View>

            <View style={styles.calendarHeader}>
              <Pressable
                style={styles.calendarNav}
                onPress={() => changeMonth(-1)}>
                <ChevronLeft size={16} color="#111827" />
              </Pressable>
              <Text style={styles.calendarMonth}>
                {MONTH_OPTIONS[datePicker.month - 1].label} {datePicker.year}
              </Text>
              <Pressable
                style={styles.calendarNav}
                onPress={() => changeMonth(1)}>
                <ChevronRight size={16} color="#111827" />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <Text key={d} style={styles.weekLabel}>
                  {d}
                </Text>
              ))}
            </View>

            <ScrollView style={styles.dayScroll} contentContainerStyle={styles.dayScrollContent}>
              <View style={styles.dayGrid}>
                {(() => {
                  const rows: Array<Array<number | null>> = [];
                  const days = getCalendarDays(datePicker.year, datePicker.month);
                  for (let i = 0; i < days.length; i += 7) {
                    rows.push(days.slice(i, i + 7));
                  }
                  return rows.map((row, rowIdx) => (
                    <View key={`row-${rowIdx}`} style={styles.dayRow}>
                      {row.map((day, idx) => {
                        const active = day === datePicker.day;
                        return (
                          <Pressable
                            key={`${day ?? 'blank'}-${idx}`}
                            disabled={!day}
                            style={[
                              styles.dayCell,
                              !day && styles.dayCellEmpty,
                              active && styles.dayCellActive,
                            ]}
                            onPress={() => {
                              if (day) {
                                updateDatePart('day', day);
                              }
                            }}>
                            <Text
                              style={[
                                styles.dayCellText,
                                active && styles.dayCellTextActive,
                                !day && styles.dayCellTextEmpty,
                              ]}>
                              {day ?? ''}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ));
                })()}
              </View>

              <Pressable style={styles.dateApplyBtn} onPress={applyDatePicker}>
                <Text style={styles.dateApplyLabel}>Set date</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default VehicleDetailsScreen;

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
  resetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#111827',
    fontSize: 17,
    fontWeight: '700',
  },
  resetText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexGrow: 1,
    elevation: 1,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
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
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  asterisk: {
    color: '#b91c1c',
    marginLeft: 4,
  },
  rowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: PRIMARY + '15',
    borderColor: PRIMARY,
  },
  pillInactive: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  pillLabelActive: {
    color: PRIMARY,
  },
  pillLabelInactive: {
    color: '#374151',
  },
  boxGrid: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 10,
  },
  boxOption: {
    flexBasis: '48%',
    maxWidth: '48%',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  boxOptionActive: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY + '14',
    shadowColor: PRIMARY,
    shadowOpacity: 0.12,
    shadowOffset: {width: 0, height: 6},
    shadowRadius: 10,
    elevation: 2,
  },
  boxOptionPressed: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY + '10',
  },
  boxOptionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  boxOptionLabelActive: {
    color: PRIMARY,
  },
  selectorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 16,
    justifyContent: 'flex-end',
  },
  selectorSheet: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '70%',
    paddingBottom: 12,
    overflow: 'hidden',
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  selectorClose: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  selectorList: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectorOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 8,
    backgroundColor: '#f9fafb',
  },
  selectorOptionActive: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY + '12',
  },
  selectorOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  selectorOptionTextActive: {
    color: PRIMARY,
  },
  datePickerSheet: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '80%',
    paddingBottom: 12,
    overflow: 'hidden',
  },
  calendarHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarMonth: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  calendarNav: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  weekRow: {
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  weekLabel: {
    width: 32,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
  dayScroll: {
    maxHeight: 300,
  },
  dayScrollContent: {
    paddingHorizontal: 10,
    paddingBottom: 12,
  },
  dayGrid: {
    paddingTop: 6,
    rowGap: 10,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    columnGap: 6,
  },
  dayCell: {
    width: 39,
    height: 39,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellEmpty: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  dayCellActive: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY + '15',
  },
  dayCellText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  dayCellTextActive: {
    color: PRIMARY,
  },
  dayCellTextEmpty: {
    color: 'transparent',
  },
  dateApplyBtn: {
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: 'center',
  },
  dateApplyLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectValue: {
    fontSize: 15,
    color: '#111827',
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
  progressWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
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
  progressBar: {
    marginTop: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: PRIMARY,
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
  photoPreview: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 8,
    backgroundColor: '#f8fafc',
  },
  photoImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
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
  photoBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: PRIMARY,
    borderRadius: 10,
    padding: 4,
  },
  submitBtn: {
    marginTop: 14,
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
  ctaBlock: {
    marginTop: 16,
  },
  syncBadge: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  syncText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
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
});
