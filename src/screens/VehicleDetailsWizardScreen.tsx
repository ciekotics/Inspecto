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
import DatePicker from 'react-native-date-picker';
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
import {statesArr, citiesArr} from '../assets/indian-states-cities';

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

type YesNoNA = 'Yes' | 'No' | 'N/A';
type YesNoBinary = 'Yes' | 'No' | '';
type RoadTax = 'Lifetime' | 'Limited Period' | '';

type RegistrationForm = {
  taxDocUri: string | null;
  registrationState: string;
  registrationCity: string;
  rto: string;
  rtoNocIssued: YesNoNA | '';
  registrationValid: YesNoBinary;
  roadTaxPaid: RoadTax;
  commercialVehicle: YesNoBinary;
  underHypothecation: YesNoBinary;
};

type ErrorMap<T extends object> = Partial<Record<keyof T, string>>;

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

const INITIAL_ENGINE_FORM: EngineForm = {
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

const INITIAL_RC_FORM: RcForm = {
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

const INITIAL_REG_FORM: RegistrationForm = {
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

const formatDate = (value: string) => {
  if (!value) {
    return 'Select date';
  }
  return value;
};
const formatDateVal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

const hasValue = (v: any) => {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
};

const toUpperAlnum = (val: string) =>
  val
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');

const normalizeChassisInput = (val: string) =>
  val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 17);

const normalizeColourValue = (val: string) => {
  if (!val) return '';
  const lower = val.trim().toLowerCase();
  if (lower === 'non metallic' || lower === 'non-metallic') {
    return 'Non-Metallic';
  }
  return 'Metallic';
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

const normalizeCarTypeValue = (val: string) => {
  if (!val) return '';
  const upper = val.trim().toUpperCase();
  const allowed = ['SUV', 'MUV', 'SEDAN', 'HATCHBACK', 'LUXURY'];
  const match = allowed.find(a => a === upper);
  return match || upper;
};

const stepsMeta = [
  {key: 'engine', label: 'Step 1a', sub: 'Vehicle details'},
  {key: 'rc', label: 'Step 1b', sub: 'RC details'},
  {key: 'registration', label: 'Step 1c', sub: 'Registration details'},
];
const VehicleDetailsWizardScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const {sellCarId} = (route.params as RouteParams) || {};
  const online = useAppSelector(state => state.network.isOnline === true);
  const [inspectionId, setInspectionId] = useState<string | number>('');
  const [engineForm, setEngineForm] =
    useState<EngineForm>(INITIAL_ENGINE_FORM);
  const [rcForm, setRcForm] = useState<RcForm>(INITIAL_RC_FORM);
  const [regForm, setRegForm] = useState<RegistrationForm>(INITIAL_REG_FORM);
  const [engineErrors, setEngineErrors] = useState<ErrorMap<EngineForm>>({});
  const [rcErrors, setRcErrors] = useState<ErrorMap<RcForm>>({});
  const [regErrors, setRegErrors] = useState<ErrorMap<RegistrationForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState<{
    open: boolean;
    field:
      | 'chassisImageUri'
      | 'insuranceImageUri'
      | 'rcFrontUri'
      | 'rcBackUri'
      | 'taxDocUri'
      | null;
  }>({open: false, field: null});
  const [listSelector, setListSelector] = useState<{
    open: boolean;
    label: string;
    field: keyof EngineForm | null;
    options: string[];
  }>({open: false, label: '', field: null, options: []});
  const [datePicker, setDatePicker] = useState<{
    open: boolean;
    field: 'dateOfRegistration' | 'insuranceValidUpto' | null;
    date: Date;
  }>({
    open: false,
    field: null,
    date: new Date(),
  });
  const [profModal, setProfModal] = useState(false);
  const [stateModal, setStateModal] = useState(false);
  const [cityModal, setCityModal] = useState(false);
  const [citiesList, setCitiesList] = useState<string[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const draftSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const pinchScale = useRef(new Animated.Value(1)).current;
  const baseScale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const combinedScale = Animated.multiply(baseScale, pinchScale);
  const doubleTapRef = useRef<TapGestureHandler | null>(null);
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const progressAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const [currentStep, setCurrentStep] = useState(0);
  const scrollRefs = useRef<Array<ScrollView | null>>([null, null, null]);

  const resolvedSellCarId = useMemo(() => {
    if (sellCarId == null) {
      return '';
    }
    return String(sellCarId).trim();
  }, [sellCarId]);

  const engineRequired: (keyof EngineForm)[] = [
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

  const rcRequired: (keyof RcForm)[] = [
    'rcFrontUri',
    'rcBackUri',
    'nameOnRc',
    'phoneNumber',
    'profession',
    'rcAvailability',
    'rcCondition',
    'rcMismatch',
  ];

  const regRequired: (keyof RegistrationForm)[] = [
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

  const stepProgress = useMemo(() => {
    const countFilled = <T extends object>(
      form: T,
      required: (keyof T)[],
    ) => {
      return required.filter(field => {
        const val = (form as any)[field];
        if (typeof val === 'number') return true;
        return !!val;
      }).length;
    };
    return [
      Math.min(1, countFilled(engineForm, engineRequired) / engineRequired.length),
      Math.min(1, countFilled(rcForm, rcRequired) / rcRequired.length),
      Math.min(1, countFilled(regForm, regRequired) / regRequired.length),
    ];
  }, [engineForm, rcForm, regForm]);
  useEffect(() => {
    progressAnims.forEach((anim, idx) => {
      Animated.timing(anim, {
        toValue: stepProgress[idx],
        duration: 220,
        useNativeDriver: false,
      }).start();
    });
  }, [progressAnims, stepProgress]);

  useEffect(() => {
    if (!resolvedSellCarId) {
      return;
    }
    const draft = loadEngineDraft(resolvedSellCarId);
    if (draft?.data) {
      setEngineForm((prev: EngineForm) => ({
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
        data: engineForm,
        updatedAt: Date.now(),
        status: 'draft',
      };
      saveEngineDraft(draft);
    }, 350);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineForm, resolvedSellCarId]);

  useEffect(() => {
    if (!resolvedSellCarId) {
      return;
    }
    const fetchExistingServer = async () => {
      try {
        setRemoteLoading(true);
        const [inspRes, res] = await Promise.all([
          client
            .get('/api/view-inspection', {
              params: {sellCarId: resolvedSellCarId},
            })
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
        const vehicleDetails =
          res.data?.data?.vehicleDetails?.vehicleDetails ||
          res.data?.data?.vehiclesDetails?.vehicleDetails ||
          res.data?.data?.vehicleDetails ||
          res.data?.data?.vehiclesDetails ||
          {};
        const engineInfo =
          vehicleDetails?.['Engine Info'] ||
          vehicleDetails?.engineInfo ||
          res.data?.data?.EngineInfo ||
          res.data?.data?.engineInfo ||
          res.data?.data?.['Engine Info'] ||
          null;
        const rcDetails =
          vehicleDetails?.['RC Details'] ||
          vehicleDetails?.rcDetails ||
          null;
        const regDetails =
          vehicleDetails?.['Registration Details'] ||
          vehicleDetails?.registrationDetails ||
          null;

        if (engineInfo && typeof engineInfo === 'object') {
          setEngineForm(prev => {
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
              normalizeOption(engineInfo['Emission'] || engineInfo.emission, [
                'Euro 1',
                'Euro 2',
                'Euro 3',
                'Euro 4',
                'Euro 6',
                'Non-Euro',
              ]),
            );
            setIfEmpty(
              'dateOfRegistration',
              engineInfo['Date of Registration'] ||
                engineInfo.dateOfRegistration,
            );
            setIfEmpty(
              'odometerReading',
              engineInfo['Odometer Reading'] || engineInfo.odometerReading,
            );
            setIfEmpty(
              'fuelType',
              normalizeOption(engineInfo['Fuel Type'] || engineInfo.fuelType, [
                'Petrol',
                'Diesel',
                'Petrol + CNG',
                'Hybrid',
                'Electric',
                'LPG',
              ]),
            );
            setIfEmpty(
              'externalFitment',
              normalizeOption(
                engineInfo['External CNG/LPG Fitment'] ||
                  engineInfo.externalFitment,
                YES_NO,
              ),
            );
            const ownersVal =
              engineInfo['No. of Owners'] || engineInfo.owners || engineInfo.ownersCount;
            if (ownersVal != null && next.owners === 0) {
              next.owners = Number(ownersVal) || 0;
            }
            setIfEmpty(
              'duplicateKey',
              normalizeOption(
                engineInfo['Duplicate Key Available'] || engineInfo.duplicateKey,
                YES_NO,
              ),
            );
            setIfEmpty(
              'vinPlate',
              normalizeOption(engineInfo['VIN Plate Available'] || engineInfo.vinPlate, YES_NO),
            );
            setIfEmpty(
              'jackToolkit',
              normalizeOption(
                engineInfo['Jack & Toolkit Available'] || engineInfo.jackToolkit,
                YES_NO,
              ),
            );
            setIfEmpty(
              'spareWheel',
              normalizeOption(
                engineInfo['Spare Wheel Available'] || engineInfo.spareWheel,
                YES_NO,
              ),
            );
            setIfEmpty(
              'insuranceType',
              normalizeOption(
                engineInfo['Insurance Type'] || engineInfo.insuranceType,
                INSURANCE_TYPES,
              ),
            );
            setIfEmpty(
              'insuranceImageUri',
              engineInfo['Insurance image'] || engineInfo.insuranceImageUri,
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
            return next;
          });
        }

        if (rcDetails && typeof rcDetails === 'object') {
          setRcForm(prev => {
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
            setIfEmpty('nameOnRc', rcDetails['Name on RC'] || rcDetails.nameOnRc);
            setIfEmpty(
              'phoneNumber',
              rcDetails['Phone Number'] || rcDetails.phoneNumber,
            );
            setIfEmpty('address', rcDetails.Address || rcDetails.address);
            setIfEmpty('email', rcDetails['Email ID'] || rcDetails.email);
            setIfEmpty(
              'profession',
              normalizeOption(
                rcDetails.Profession || rcDetails.profession,
                PROFESSION_OPTIONS,
              ),
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
        }

        if (regDetails && typeof regDetails === 'object') {
          setRegForm(prev => {
            const next: RegistrationForm = {...prev};
            const setIfEmpty = <K extends keyof RegistrationForm>(
              key: K,
              val: any,
            ) => {
              if (val == null) return;
              if (typeof val === 'string' && val.trim() === '') return;
              if (next[key]) return;
              next[key] = val as any;
            };
            setIfEmpty(
              'registrationState',
              regDetails['Registration State'] || regDetails.registrationState,
            );
            setIfEmpty(
              'registrationCity',
              regDetails['Registration City'] || regDetails.registrationCity,
            );
            setIfEmpty('rto', regDetails.RTO || regDetails.rto);
            setIfEmpty(
              'rtoNocIssued',
              normalizeOption(regDetails['RTO NOC Issued'] || regDetails.rtoNocIssued, [
                'Yes',
                'No',
                'N/A',
              ]),
            );
            setIfEmpty(
              'registrationValid',
              normalizeOption(
                regDetails['Registration Valid'] || regDetails.registrationValid,
                ['Yes', 'No'],
              ),
            );
            setIfEmpty(
              'roadTaxPaid',
              normalizeOption(
                regDetails['Road Tax Paid'] || regDetails.roadTaxPaid,
                ['Lifetime', 'Limited Period'],
              ),
            );
            setIfEmpty(
              'commercialVehicle',
              normalizeOption(
                regDetails['Commercial Vehicle'] || regDetails.commercialVehicle,
                ['Yes', 'No'],
              ),
            );
            setIfEmpty(
              'underHypothecation',
              normalizeOption(
                regDetails['Under Hypothecation'] || regDetails.underHypothecation,
                ['Yes', 'No'],
              ),
            );
            setIfEmpty('taxDocUri', regDetails['Tax image'] || regDetails.taxDocUri);
            return next;
          });
        }
      } catch (err) {
        // ignore
      } finally {
        setRemoteLoading(false);
      }
    };
    fetchExistingServer();
  }, [resolvedSellCarId]);
  const onSelectDate = (
    field: 'dateOfRegistration' | 'insuranceValidUpto',
  ) => {
    let base = new Date();
    const existing = engineForm[field];
    if (existing) {
      const parsed = new Date(existing);
      if (!Number.isNaN(parsed.getTime())) {
        base = parsed;
      }
    }
    setDatePicker({
      open: true,
      field,
      date: base,
    });
  };

  const toEngineInfoPayload = () => ({
    'Chassis Number': toUpperAlnum(engineForm.chassisNumber),
    'Manufacturer Name': toUpperAlnum(engineForm.manufacturerName),
    'Chassis Number Embossing': engineForm.chassisEmbossing,
    'Chassis image': engineForm.chassisImageUri ?? '',
    'Engine Number': toUpperAlnum(engineForm.engineNumber),
    'Engine CC': engineForm.engineCc.trim(),
    'Year of Manufacturing': engineForm.yearOfManufacturing.trim(),
    'Car Type': normalizeCarTypeValue(engineForm.carType),
    'Model Name': toUpperAlnum(engineForm.modelName),
    'Variant Name': toUpperAlnum(engineForm.variantName),
    Colour: normalizeColourValue(engineForm.colour),
    'Paint Type': normalizeColourValue(engineForm.paintType || engineForm.colour),
    Transmission: engineForm.transmission,
    Emission: engineForm.emission === 'Non-Euro' ? 'Non Euro' : engineForm.emission,
    'Date of Registration': engineForm.dateOfRegistration,
    'Odometer Reading': engineForm.odometerReading.trim(),
    'Fuel Type': normalizeFuelValue(engineForm.fuelType),
    'External CNG/LPG Fitment': engineForm.externalFitment,
    'No. of Owners': String(engineForm.owners),
    'Duplicate Key Available': engineForm.duplicateKey,
    'VIN Plate Available': engineForm.vinPlate,
    'Jack & Toolkit Available': engineForm.jackToolkit,
    'Spare Wheel Available': engineForm.spareWheel,
    'Insurance Type': normalizeInsuranceTypeValue(engineForm.insuranceType),
    'Insurance image': engineForm.insuranceImageUri ?? '',
    'Insurance Valid Upto': engineForm.insuranceValidUpto,
    'Insurance IDV Value': engineForm.insuranceIdvValue.trim(),
  });

  const uploadEngineItem = async (item: EngineQueueItem) => {
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
    const isOnline = online ?? true;
    if (!isOnline || queue.length === 0) {
      return;
    }
    setIsSyncingQueue(true);
    for (const item of queue) {
      try {
        await uploadEngineItem(item);
        dequeueEngineSync(item.id);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 400 || status === 406) {
          // Drop invalid payloads so we don't retry forever.
          dequeueEngineSync(item.id);
        }
      }
    }
    setIsSyncingQueue(false);
  };

  const validateEngine = (): ErrorMap<EngineForm> => {
    const next: ErrorMap<EngineForm> = {};
    const addErr = (key: keyof EngineForm, msg: string) => {
      next[key] = msg;
    };
    engineRequired.forEach(field => {
      const val = engineForm[field];
      if (typeof val === 'number') {
        return;
      }
      if (!val) {
        addErr(field, 'Required');
      }
    });
    if (engineForm.engineCc && !/^[0-9.]+$/.test(engineForm.engineCc.trim())) {
      addErr('engineCc', 'Numbers only');
    }
    if (
      engineForm.yearOfManufacturing &&
      !/^(19|20)\d{2}$/.test(engineForm.yearOfManufacturing.trim())
    ) {
      addErr('yearOfManufacturing', 'Invalid year');
    }
    if (
      engineForm.odometerReading &&
      !/^[0-9.]+$/.test(engineForm.odometerReading.trim())
    ) {
      addErr('odometerReading', 'Numbers only');
    }
    if (
      engineForm.insuranceIdvValue &&
      !/^[0-9.]+$/.test(engineForm.insuranceIdvValue.trim())
    ) {
      addErr('insuranceIdvValue', 'Numbers only');
    }
    if (engineForm.chassisNumber) {
      const chassis = engineForm.chassisNumber.trim().toUpperCase();
      if (!/^[A-Z0-9]{17}$/.test(chassis)) {
        addErr('chassisNumber', '17-char alphanumeric (uppercase)');
      }
    }
    if (
      engineForm.engineNumber &&
      !/^[A-Z0-9]+$/.test(engineForm.engineNumber.trim().toUpperCase())
    ) {
      addErr('engineNumber', 'Alphanumeric only');
    }
    const carTypeNorm = normalizeCarTypeValue(engineForm.carType);
    if (carTypeNorm && !['SUV', 'MUV', 'SEDAN', 'HATCHBACK', 'LUXURY'].includes(carTypeNorm)) {
      addErr('carType', 'Invalid car type');
    }
    const fuelNorm = normalizeFuelValue(engineForm.fuelType);
    if (
      fuelNorm &&
      !['Petrol', 'Diesel', 'Petrol + CNG', 'Hybrid', 'Electric', 'LPG'].includes(
        fuelNorm,
      )
    ) {
      addErr('fuelType', 'Invalid fuel type');
    }
    return next;
  };

  const validateRc = (): ErrorMap<RcForm> => {
    const next: ErrorMap<RcForm> = {};
    const addErr = (key: keyof RcForm, msg: string) => {
      next[key] = msg;
    };
    if (!rcForm.rcFrontUri) addErr('rcFrontUri', 'Required');
    if (!rcForm.rcBackUri) addErr('rcBackUri', 'Required');
    if (!rcForm.nameOnRc.trim()) addErr('nameOnRc', 'Required');
    if (!rcForm.phoneNumber.trim()) addErr('phoneNumber', 'Required');
    if (!rcForm.profession.trim()) addErr('profession', 'Required');
    if (!rcForm.rcAvailability) addErr('rcAvailability', 'Required');
    if (!rcForm.rcCondition) addErr('rcCondition', 'Required');
    if (!rcForm.rcMismatch) addErr('rcMismatch', 'Required');
    if (rcForm.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rcForm.email.trim())) {
      addErr('email', 'Invalid email');
    }
    if (rcForm.phoneNumber && !/^[0-9]{10}$/.test(rcForm.phoneNumber.trim())) {
      addErr('phoneNumber', 'Enter 10-digit phone number');
    }
    return next;
  };

  const validateReg = (): ErrorMap<RegistrationForm> => {
    const next: ErrorMap<RegistrationForm> = {};
    const addErr = (key: keyof RegistrationForm, msg: string) => {
      next[key] = msg;
    };
    if (!regForm.taxDocUri) addErr('taxDocUri', 'Required');
    if (!regForm.registrationState) addErr('registrationState', 'Required');
    if (!regForm.registrationCity) addErr('registrationCity', 'Required');
    if (!regForm.rto.trim()) addErr('rto', 'Required');
    if (!regForm.rtoNocIssued) addErr('rtoNocIssued', 'Required');
    if (!regForm.registrationValid) addErr('registrationValid', 'Required');
    if (!regForm.roadTaxPaid) addErr('roadTaxPaid', 'Required');
    if (!regForm.commercialVehicle) addErr('commercialVehicle', 'Required');
    if (!regForm.underHypothecation) addErr('underHypothecation', 'Required');
    if (regForm.rto && !/^[A-Za-z0-9-\\s]+$/.test(regForm.rto.trim())) {
      addErr('rto', 'Alphanumeric only');
    }
    return next;
  };

  const scrollToTop = (idx: number) => {
    const ref = scrollRefs.current[idx];
    ref?.scrollTo?.({y: 0, animated: true});
  };

  const goToStep = (idx: number) => {
    if (idx === currentStep) {
      return;
    }
    contentOpacity.setValue(0);
    setCurrentStep(idx);
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      scrollToTop(idx);
    });
  };
  const handleSubmitEngine = async () => {
    setMessage(null);
    const valErrors = validateEngine();
    setEngineErrors(valErrors);
    if (Object.keys(valErrors).length > 0) {
      const firstKey = Object.keys(valErrors)[0];
      if (firstKey) {
        setMessage(`Fix ${String(firstKey)} and try again.`);
      }
      return;
    }
    if (!resolvedSellCarId) {
      Alert.alert('Missing sellCarId', 'Cannot save without sellCarId.');
      return;
    }
    setSubmitting(true);
    let saved = false;
    const engineInfo = toEngineInfoPayload();
    console.log('[VehicleDetails] submit engine info', engineInfo);
    const isOnline = online ?? true;
    const queueItem: EngineQueueItem = {
      id: nanoid(),
      sellCarId: resolvedSellCarId,
      payload: {
        engineInfo,
        chassisUri: engineForm.chassisImageUri || undefined,
        insuranceUri: engineForm.insuranceImageUri || undefined,
      },
      enqueuedAt: Date.now(),
      attempts: 0,
    };

    const draft: EngineDraft = {
      sellCarId: resolvedSellCarId,
      data: engineForm,
      updatedAt: Date.now(),
      status: isOnline ? 'synced' : 'pending-sync',
    };
    saveEngineDraft(draft);

    if (isOnline) {
      try {
        await uploadEngineItem(queueItem);
        setMessage('Saved vehicle details.');
        saved = true;
      } catch (err: any) {
        const status = err?.response?.status || err?.status;
        const msg =
          err?.response?.data?.message ||
          err?.data?.message ||
          err?.message ||
          'Saved locally. Will sync when online.';
        console.warn('[VehicleDetails] engine upload failed', status, msg, err?.data);
        if (status === 400 || status === 406) {
          setMessage(msg);
        } else {
          enqueueEngineSync(queueItem);
          setMessage(msg);
          saved = true;
        }
      }
    } else {
      enqueueEngineSync(queueItem);
      setMessage('Saved locally. Will sync when online.');
      saved = true;
    }
    setSubmitting(false);
    if (saved) {
      goToStep(1);
    }
  };

  const handleSubmitRc = async () => {
    setMessage(null);
    const valErrors = validateRc();
    setRcErrors(valErrors);
    if (Object.keys(valErrors).length > 0) {
      const firstKey = Object.keys(valErrors)[0];
      if (firstKey) {
        setMessage(`Fix ${String(firstKey)} and try again.`);
      }
      return;
    }
    if (!resolvedSellCarId) {
      Alert.alert('Missing sellCarId', 'Cannot save without sellCarId.');
      return;
    }

    const rcPayload = {
      'Name on RC': rcForm.nameOnRc.trim(),
      'Phone Number': rcForm.phoneNumber.trim(),
      Address: rcForm.address?.trim() || '',
      'Email ID': rcForm.email?.trim() || '',
      Profession: rcForm.profession,
      'RC image': {
        Front: '',
        Back: '',
      },
      'RC Availability': rcForm.rcAvailability,
      'RC Condition': rcForm.rcCondition,
      'Mismatch on RC': rcForm.rcMismatch,
    };
    const fd = new FormData();
    fd.append('sellCarId', resolvedSellCarId);
    fd.append('RC Details', JSON.stringify(rcPayload));

    const appendFile = (
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
    appendFile(rcForm.rcFrontUri, 'rcfront');
    appendFile(rcForm.rcBackUri, 'rcback');

    setSubmitting(true);
    try {
      console.log('[VehicleDetails] submit RC details');
      await client.post('/api/add-inspection-vehicle-details', fd, {
        headers: {'Content-Type': 'multipart/form-data'},
      });
      setMessage('RC details saved.');
      goToStep(2);
    } catch (err: any) {
      console.warn('[VehicleDetails] RC upload failed', err?.message);
      setMessage(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to save RC details',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReg = async () => {
    setMessage(null);
    const valErrors = validateReg();
    setRegErrors(valErrors);
    if (Object.keys(valErrors).length > 0) {
      const firstKey = Object.keys(valErrors)[0];
      if (firstKey) {
        setMessage(`Fix ${String(firstKey)} and try again.`);
      }
      return;
    }
    if (!resolvedSellCarId) {
      Alert.alert('Missing sellCarId', 'Cannot save without sellCarId.');
      return;
    }
    const fd = new FormData();
    fd.append('sellCarId', resolvedSellCarId);
    fd.append(
      'Registration Details',
      JSON.stringify({
        'Registration State': regForm.registrationState,
        'Registration City': regForm.registrationCity,
        RTO: regForm.rto.trim(),
        'RTO NOC Issued': regForm.rtoNocIssued,
        'Registration Valid': regForm.registrationValid,
        'Road Tax Paid': regForm.roadTaxPaid,
        'Commercial Vehicle': regForm.commercialVehicle,
        'Under Hypothecation': regForm.underHypothecation,
        'Tax image': regForm.taxDocUri ? '' : '',
      }),
    );
    if (regForm.taxDocUri) {
      const ext = regForm.taxDocUri.split('.').pop() || 'jpg';
      const mime =
        ext === 'png'
          ? 'image/png'
          : ext === 'jpeg' || ext === 'jpg'
          ? 'image/jpeg'
          : 'application/octet-stream';
      fd.append('tax', {
        uri: regForm.taxDocUri,
        name: `tax.${ext}`,
        type: mime,
      } as any);
    }
    setSubmitting(true);
    try {
      console.log('[VehicleDetails] submit Registration details');
      await client.post('/api/add-inspection-vehicle-details', fd, {
        headers: {'Content-Type': 'multipart/form-data'},
      });
      setMessage('Registration details saved.');
      flushQueue();
      // Navigate onward to next module (InspectionModules) after step 1c completion.
      setTimeout(() => {
        navigation.navigate('InspectionModules', {sellCarId: resolvedSellCarId});
      }, 200);
    } catch (err: any) {
      console.warn('[VehicleDetails] registration upload failed', err?.message);
      setMessage(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to save registration details',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const pickImage = async (
    field:
      | 'chassisImageUri'
      | 'insuranceImageUri'
      | 'rcFrontUri'
      | 'rcBackUri'
      | 'taxDocUri',
    mode: 'camera' | 'library',
  ) => {
    const resp: ImagePickerResponse =
      mode === 'camera'
        ? await launchCamera({mediaType: 'photo', quality: 0.7})
        : await launchImageLibrary({mediaType: 'photo', quality: 0.8});
    if (resp.didCancel || !resp.assets || resp.assets.length === 0) {
      setPickerVisible({open: false, field: null});
      return;
    }
    const uri = resp.assets[0]?.uri;
    if (!uri) {
      setPickerVisible({open: false, field: null});
      return;
    }
    if (field === 'chassisImageUri' || field === 'insuranceImageUri') {
      setEngineForm(prev => ({...prev, [field]: uri}));
      setEngineErrors(prev => ({...prev, [field]: undefined}));
    } else if (field === 'rcFrontUri' || field === 'rcBackUri') {
      setRcForm(prev => ({...prev, [field]: uri}));
      setRcErrors(prev => ({...prev, [field]: undefined}));
    } else {
      setRegForm(prev => ({...prev, [field]: uri}));
      setRegErrors(prev => ({...prev, [field]: undefined}));
    }
    setPickerVisible({open: false, field: null});
  };
  const renderOptionPills = <T extends string>(
    field: keyof EngineForm,
    options: T[],
  ) => (
    <View style={styles.pillRow}>
      {options.map(opt => {
        const active = engineForm[field] === opt;
        return (
          <Pressable
            key={opt}
            onPress={() =>
              setEngineForm(prev => {
                const next = {...prev, [field]: opt as any};
                if (field === 'colour') {
                  next.paintType = opt as any;
                }
                return next;
              })
            }
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
        const active = engineForm[field] === opt;
        return (
          <Pressable
            key={opt}
            onPress={() =>
              setEngineForm(prev => ({...prev, [field]: opt as any}))
            }
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
              !engineForm[field] && {color: '#9ca3af'},
            ]}>
            {(engineForm[field] as any) || `Select ${label.toLowerCase()}`}
          </Text>
        </Pressable>
      )}
      {engineErrors[field] ? (
        <Text style={styles.errorText}>{engineErrors[field] as string}</Text>
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
            !engineForm[field] && {color: '#9ca3af'},
          ]}>
          {formatDate(engineForm[field])}
        </Text>
        <CalendarIcon size={16} color="#9ca3af" />
      </Pressable>
      {engineErrors[field] ? (
        <Text style={styles.errorText}>{engineErrors[field] as string}</Text>
      ) : null}
    </View>
  );
  const renderRcChipRow = <T extends string>(
    label: string,
    field: keyof RcForm,
    options: T[],
    required?: boolean,
  ) => (
    <View style={{marginTop: 16}}>
      <View style={styles.rowLabel}>
        <Text style={styles.label}>{label}</Text>
        {required ? <Text style={styles.asterisk}>*</Text> : null}
      </View>
      <View style={styles.chipRow}>
        {options.map(opt => {
          const active = rcForm[field] === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => setRcForm(prev => ({...prev, [field]: opt as any}))}
              style={[styles.chip, active && styles.chipActive]}>
              <Text
                style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {rcErrors[field] ? (
        <Text style={styles.errorText}>{rcErrors[field] as string}</Text>
      ) : null}
    </View>
  );

  const renderRegChipRow = <T extends string>(
    label: string,
    field: keyof RegistrationForm,
    options: T[],
  ) => (
    <View style={{marginTop: 14}}>
      <View style={styles.rowLabel}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.asterisk}>*</Text>
      </View>
      <View style={styles.chipRow}>
        {options.map(opt => {
          const active = regForm[field] === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => setRegForm(prev => ({...prev, [field]: opt as any}))}
              style={[styles.chip, active && styles.chipActive]}>
              <Text
                style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {regErrors[field] ? (
        <Text style={styles.errorText}>{regErrors[field] as string}</Text>
      ) : null}
    </View>
  );

  const allStates = useMemo(() => {
    return statesArr.map(s => s.value || s.label || s.name);
  }, []);

  const currentCities = useMemo(() => {
    if (citiesList.length > 0) {
      return citiesList;
    }
    if (!regForm.registrationState) return [];
    return citiesArr
      .filter(
        item =>
          item.state?.trim().toLowerCase() ===
          regForm.registrationState.trim().toLowerCase(),
      )
      .map(item => item.city);
  }, [citiesList, regForm.registrationState]);
  const renderStepper = () => (
    <View style={styles.stepperRow}>
      {stepsMeta.map((step, idx) => {
        const isLast = idx === stepsMeta.length - 1;
        const isActive = currentStep === idx;
        const isDone = currentStep > idx || stepProgress[idx] >= 1;
        const isClickable = isDone || idx <= currentStep;
        const fillWidth = progressAnims[idx].interpolate({
          inputRange: [0, 1],
          outputRange: ['0%', '100%'],
          extrapolate: 'clamp',
        });
        const onStepPress = () => {
          if (!isClickable) {
            return;
          }
          goToStep(idx);
        };
        return (
          <Pressable
            key={step.key}
            style={styles.stepItem}
            onPress={onStepPress}
            android_ripple={{color: 'rgba(0,0,0,0.05)'}}>
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
                <View style={styles.stepLineWrap}>
                  <View style={styles.stepLine} />
                  <Animated.View
                    style={[styles.stepLineActive, {width: fillWidth}]}
                  />
                </View>
              ) : null}
            </View>
            <Text style={styles.stepLabel}>{step.label}</Text>
            <Text style={styles.stepSub}>{step.sub}</Text>
          </Pressable>
        );
      })}
    </View>
  );
  const renderEngineStep = () => (
    <ScrollView
      ref={ref => {
        scrollRefs.current[0] = ref;
      }}
      style={{flex: 1}}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        {remoteLoading ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator color={PRIMARY} size="small" />
            <Text style={styles.loaderText}>Loading saved details...</Text>
          </View>
        ) : null}
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
                onPress={() =>
                  setPickerVisible({open: true, field: 'chassisImageUri'})
                }>
                {engineForm.chassisImageUri ? (
                  <>
                    <Image
                      source={{uri: engineForm.chassisImageUri}}
                      style={styles.photoImage}
                      resizeMode="cover"
                    />
                    <View style={styles.photoBadge}>
                      <Check size={14} color="#fff" />
                    </View>
                    <Pressable
                      style={styles.eyeIcon}
                      onPress={() => {
                        setPreviewUri(engineForm.chassisImageUri || null);
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
              {engineErrors.chassisImageUri ? (
                <Text style={styles.errorText}>{engineErrors.chassisImageUri}</Text>
              ) : null}
            </View>

            <View style={styles.photoBlock}>
              <View style={styles.rowLabel}>
                <Text style={styles.label}>Insurance</Text>
                <Text style={styles.asterisk}>*</Text>
              </View>
              <Pressable
                style={styles.photoTile}
                onPress={() =>
                  setPickerVisible({open: true, field: 'insuranceImageUri'})
                }>
                {engineForm.insuranceImageUri ? (
                  <>
                    <Image
                      source={{uri: engineForm.insuranceImageUri}}
                      style={styles.photoImage}
                      resizeMode="cover"
                    />
                    <View style={styles.photoBadge}>
                      <Check size={14} color="#fff" />
                    </View>
                    <Pressable
                      style={styles.eyeIcon}
                      onPress={() => {
                        setPreviewUri(engineForm.insuranceImageUri || null);
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
              {engineErrors.insuranceImageUri ? (
                <Text style={styles.errorText}>
                  {engineErrors.insuranceImageUri}
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
            value={engineForm.chassisNumber}
            onChangeText={t => {
              const clean = normalizeChassisInput(t);
              setEngineForm(prev => ({...prev, chassisNumber: clean}));
              setEngineErrors(prev => ({...prev, chassisNumber: undefined}));
            }}
            maxLength={17}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="Enter chassis number"
            placeholderTextColor="#9ca3af"
          />
          {engineErrors.chassisNumber ? (
            <Text style={styles.errorText}>{engineErrors.chassisNumber}</Text>
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
            value={engineForm.engineNumber}
            onChangeText={t => {
              const clean = t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
              setEngineForm(prev => ({...prev, engineNumber: clean}));
              setEngineErrors(prev => ({...prev, engineNumber: undefined}));
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="Enter engine number"
            placeholderTextColor="#9ca3af"
          />
          {engineErrors.engineNumber ? (
            <Text style={styles.errorText}>{engineErrors.engineNumber}</Text>
          ) : null}

          <View style={styles.rowLabel}>
            <Text style={styles.label}>Engine CC</Text>
            <Text style={styles.asterisk}>*</Text>
          </View>
          <TextInput
            style={styles.input}
            value={engineForm.engineCc}
            keyboardType="numeric"
            onChangeText={t => {
              const clean = t.replace(/[^0-9.]/g, '');
              setEngineForm(prev => ({...prev, engineCc: clean}));
              setEngineErrors(prev => ({...prev, engineCc: undefined}));
            }}
            placeholder="Enter CC"
            placeholderTextColor="#9ca3af"
          />
          {engineErrors.engineCc ? (
            <Text style={styles.errorText}>{engineErrors.engineCc}</Text>
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
              value={engineForm.manufacturerName}
              onChangeText={t =>
                setEngineForm(prev => ({...prev, manufacturerName: t}))
              }
              placeholder="Enter manufacturer name"
              placeholderTextColor="#9ca3af"
            />
            {engineErrors.manufacturerName ? (
              <Text style={styles.errorText}>{engineErrors.manufacturerName}</Text>
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
              value={engineForm.modelName}
              onChangeText={t => setEngineForm(prev => ({...prev, modelName: t}))}
              placeholder="Enter model name"
              placeholderTextColor="#9ca3af"
            />
            {engineErrors.modelName ? (
              <Text style={styles.errorText}>{engineErrors.modelName}</Text>
            ) : null}
          </View>

          <View style={{marginTop: 14}}>
            <View style={styles.rowLabel}>
              <Text style={styles.label}>Variant name</Text>
              <Text style={styles.asterisk}>*</Text>
            </View>
            <TextInput
              style={styles.input}
              value={engineForm.variantName}
              onChangeText={t =>
                setEngineForm(prev => ({...prev, variantName: t}))
              }
              placeholder="Enter variant name"
              placeholderTextColor="#9ca3af"
            />
            {engineErrors.variantName ? (
              <Text style={styles.errorText}>{engineErrors.variantName}</Text>
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
              value={engineForm.paintType}
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
              value={engineForm.odometerReading}
              keyboardType="numeric"
              onChangeText={t =>
                setEngineForm(prev => ({...prev, odometerReading: t}))
              }
              placeholder="Enter reading"
              placeholderTextColor="#9ca3af"
            />
            {engineErrors.odometerReading ? (
              <Text style={styles.errorText}>{engineErrors.odometerReading}</Text>
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
              value={engineForm.owners}
              onChange={val => setEngineForm(prev => ({...prev, owners: val}))}
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
              value={engineForm.insuranceIdvValue}
              onChangeText={t =>
                setEngineForm(prev => ({...prev, insuranceIdvValue: t}))
              }
              placeholder="Enter value"
              placeholderTextColor="#9ca3af"
            />
            {engineErrors.insuranceIdvValue ? (
              <Text style={styles.errorText}>{engineErrors.insuranceIdvValue}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.ctaBlock}>
          {message && currentStep === 0 ? (
            <Text style={styles.infoText}>{message}</Text>
          ) : null}
          <Pressable
            style={[
              styles.submitBtn,
              (submitting || isSyncingQueue) && styles.submitBtnDisabled,
            ]}
            disabled={submitting || isSyncingQueue}
            onPress={handleSubmitEngine}
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
  );
  const renderRcStep = () => (
    <ScrollView
      ref={ref => {
        scrollRefs.current[1] = ref;
      }}
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
            <View style={styles.rowLabel}>
              <Text style={styles.label}>RC Front Image</Text>
              <Text style={styles.asterisk}>*</Text>
            </View>
            <Pressable
              style={styles.photoTile}
              onPress={() =>
                setPickerVisible({open: true, field: 'rcFrontUri'})
              }>
              {rcForm.rcFrontUri ? (
                <>
                  <Image
                    source={{uri: rcForm.rcFrontUri}}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                  <View style={styles.photoBadge}>
                    <Check size={14} color="#fff" />
                  </View>
                  <Pressable
                    style={styles.eyeIcon}
                    onPress={() => {
                      setPreviewUri(rcForm.rcFrontUri || null);
                      setPreviewVisible(true);
                    }}>
                    <Eye size={16} color="#111827" />
                  </Pressable>
                </>
              ) : (
                <>
                  <Camera size={28} color="#9ca3af" strokeWidth={2} />
                  <Text style={styles.photoText}>Add front photo</Text>
                </>
              )}
            </Pressable>
            {rcErrors.rcFrontUri ? (
              <Text style={styles.errorText}>{rcErrors.rcFrontUri}</Text>
            ) : null}
          </View>

          <View style={styles.photoBlock}>
            <View style={styles.rowLabel}>
              <Text style={styles.label}>RC Back Image</Text>
              <Text style={styles.asterisk}>*</Text>
            </View>
            <Pressable
              style={styles.photoTile}
              onPress={() =>
                setPickerVisible({open: true, field: 'rcBackUri'})
              }>
              {rcForm.rcBackUri ? (
                <>
                  <Image
                    source={{uri: rcForm.rcBackUri}}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                  <View style={styles.photoBadge}>
                    <Check size={14} color="#fff" />
                  </View>
                  <Pressable
                    style={styles.eyeIcon}
                    onPress={() => {
                      setPreviewUri(rcForm.rcBackUri || null);
                      setPreviewVisible(true);
                    }}>
                    <Eye size={16} color="#111827" />
                  </Pressable>
                </>
              ) : (
                <>
                  <Camera size={28} color="#9ca3af" strokeWidth={2} />
                  <Text style={styles.photoText}>Add back photo</Text>
                </>
              )}
            </Pressable>
            {rcErrors.rcBackUri ? (
              <Text style={styles.errorText}>{rcErrors.rcBackUri}</Text>
            ) : null}
          </View>
        </View>

        <View style={{marginTop: 14}}>
          <View style={styles.rowLabel}>
            <Text style={styles.label}>Name on RC</Text>
            <Text style={styles.asterisk}>*</Text>
          </View>
          <TextInput
            style={styles.input}
            value={rcForm.nameOnRc}
            onChangeText={t => setRcForm(prev => ({...prev, nameOnRc: t}))}
            placeholder="Enter name"
            placeholderTextColor="#9ca3af"
            autoCapitalize="words"
          />
          {rcErrors.nameOnRc ? (
            <Text style={styles.errorText}>{rcErrors.nameOnRc}</Text>
          ) : null}
        </View>

        <View style={{marginTop: 14}}>
          <View style={styles.rowLabel}>
            <Text style={styles.label}>Phone Number</Text>
            <Text style={styles.asterisk}>*</Text>
          </View>
          <TextInput
            style={styles.input}
            value={rcForm.phoneNumber}
            onChangeText={t => setRcForm(prev => ({...prev, phoneNumber: t}))}
            placeholder="Enter phone"
            keyboardType="phone-pad"
            placeholderTextColor="#9ca3af"
            maxLength={10}
          />
          {rcErrors.phoneNumber ? (
            <Text style={styles.errorText}>{rcErrors.phoneNumber}</Text>
          ) : null}
        </View>

        <View style={{marginTop: 14}}>
          <View style={styles.rowLabel}>
            <Text style={styles.label}>Address</Text>
          </View>
          <TextInput
            style={styles.input}
            value={rcForm.address}
            onChangeText={t => setRcForm(prev => ({...prev, address: t}))}
            placeholder="Enter address"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={{marginTop: 14}}>
          <View style={styles.rowLabel}>
            <Text style={styles.label}>Email ID</Text>
          </View>
          <TextInput
            style={styles.input}
            value={rcForm.email}
            onChangeText={t => setRcForm(prev => ({...prev, email: t}))}
            placeholder="Enter email"
            keyboardType="email-address"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={{marginTop: 14}}>
          <View style={styles.rowLabel}>
            <Text style={styles.label}>Profession</Text>
            <Text style={styles.asterisk}>*</Text>
          </View>
          <Pressable style={styles.selectBox} onPress={() => setProfModal(true)}>
            <Text
              style={[
                styles.selectValue,
                !rcForm.profession && {color: '#9ca3af'},
              ]}>
              {rcForm.profession || 'Select profession'}
            </Text>
          </Pressable>
          {rcErrors.profession ? (
            <Text style={styles.errorText}>{rcErrors.profession}</Text>
          ) : null}
        </View>

        {renderRcChipRow('RC Availability', 'rcAvailability', [
          'Original',
          'Duplicate',
          'Photocopy',
          'Lost',
        ], true)}

        {renderRcChipRow('RC Condition', 'rcCondition', [
          'OK',
          'Broken Chip',
          'Damaged',
          'Faded',
        ], true)}

        {renderRcChipRow('Mismatch on RC', 'rcMismatch', [
          'No Mismatch',
          'Details Mismatch',
        ], true)}

        <View style={styles.ctaBlock}>
          {message && currentStep === 1 && !/saved/i.test(message) ? (
            <Text style={styles.infoText}>{message}</Text>
          ) : null}
          <Pressable
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            disabled={submitting}
            onPress={handleSubmitRc}
            android_ripple={{color: 'rgba(255,255,255,0.15)'}}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitLabel}>Next</Text>
            )}
          </Pressable>
          <Text style={styles.helperText}>
            We will save these RC details to the inspection record.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
  const renderRegStep = () => (
    <ScrollView
      ref={ref => {
        scrollRefs.current[2] = ref;
      }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.title}>Step 1c - Registration details</Text>
        <Text style={styles.subtitle}>
          Upload tax document and registration information.
        </Text>

        <View style={styles.photoRow}>
          <View style={styles.photoBlock}>
            <View style={styles.rowLabel}>
              <Text style={styles.label}>Tax Document Image</Text>
              <Text style={styles.asterisk}>*</Text>
            </View>
            <Pressable
              style={styles.photoTile}
              onPress={() => setPickerVisible({open: true, field: 'taxDocUri'})}>
              {regForm.taxDocUri ? (
                <>
                  <Image
                    source={{uri: regForm.taxDocUri}}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                  <View style={styles.photoBadge}>
                    <Check size={14} color="#fff" />
                  </View>
                  <Pressable
                    style={styles.eyeIcon}
                    onPress={() => {
                      setPreviewUri(regForm.taxDocUri || null);
                      setPreviewVisible(true);
                    }}>
                    <Eye size={16} color="#111827" />
                  </Pressable>
                </>
              ) : (
                <>
                  <Camera size={28} color="#9ca3af" strokeWidth={2} />
                  <Text style={styles.photoText}>Add tax image</Text>
                </>
              )}
            </Pressable>
            {regErrors.taxDocUri ? (
              <Text style={styles.errorText}>{regErrors.taxDocUri}</Text>
            ) : null}
          </View>

          <View style={{flex: 1, gap: 12}}>
            <View>
              <View style={styles.rowLabel}>
                <Text style={styles.label}>Registration State</Text>
                <Text style={styles.asterisk}>*</Text>
              </View>
              <Pressable
                style={styles.selectBox}
                onPress={() => setStateModal(true)}>
                <Text
                  style={[
                    styles.selectValue,
                    !regForm.registrationState && {color: '#9ca3af'},
                  ]}>
                  {regForm.registrationState || 'Select State'}
                </Text>
              </Pressable>
              {regErrors.registrationState ? (
                <Text style={styles.errorText}>{regErrors.registrationState}</Text>
              ) : null}
            </View>

            <View>
              <View style={styles.rowLabel}>
                <Text style={styles.label}>Registration City</Text>
                <Text style={styles.asterisk}>*</Text>
              </View>
              <Pressable
                style={styles.selectBox}
                onPress={() => {
                  if (!regForm.registrationState) {
                    Alert.alert('Select state first');
                    return;
                  }
                  setCityModal(true);
                }}>
                <Text
                  style={[
                    styles.selectValue,
                    !regForm.registrationCity && {color: '#9ca3af'},
                  ]}>
                  {regForm.registrationCity || 'Select City'}
                </Text>
              </Pressable>
              {regErrors.registrationCity ? (
                <Text style={styles.errorText}>{regErrors.registrationCity}</Text>
              ) : null}
            </View>

            <View>
              <View style={styles.rowLabel}>
                <Text style={styles.label}>RTO</Text>
                <Text style={styles.asterisk}>*</Text>
              </View>
              <TextInput
                style={styles.input}
                value={regForm.rto}
                onChangeText={t => setRegForm(prev => ({...prev, rto: t}))}
                placeholder="Enter RTO"
                placeholderTextColor="#9ca3af"
              />
              {regErrors.rto ? (
                <Text style={styles.errorText}>{regErrors.rto}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {renderRegChipRow('RTO NOC Issued', 'rtoNocIssued', [
          'Yes',
          'No',
          'N/A',
        ])}
        {renderRegChipRow('Registration Valid', 'registrationValid', ['Yes', 'No'])}
        {renderRegChipRow('Road Tax Paid', 'roadTaxPaid', ['Lifetime', 'Limited Period'])}
        {renderRegChipRow('Commercial Vehicle', 'commercialVehicle', ['Yes', 'No'])}
        {renderRegChipRow('Under Hypothecation', 'underHypothecation', ['Yes', 'No'])}

        <View style={styles.ctaBlock}>
          {message && currentStep === 2 && !/saved/i.test(message) ? (
            <Text style={styles.infoText}>{message}</Text>
          ) : null}
          <Pressable
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            disabled={submitting}
            onPress={handleSubmitReg}
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
  );

  const renderStepContent = () => {
    if (currentStep === 0) return renderEngineStep();
    if (currentStep === 1) return renderRcStep();
    return renderRegStep();
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
        <Text style={styles.headerTitle}>Vehicle details</Text>
        <Pressable
          style={styles.resetBtn}
          onPress={() => {
            setEngineForm(INITIAL_ENGINE_FORM);
            setRcForm(INITIAL_RC_FORM);
            setRegForm(INITIAL_REG_FORM);
            setEngineErrors({});
            setRcErrors({});
            setRegErrors({});
            setMessage(null);
            setCurrentStep(0);
          }}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>
            {stepsMeta[currentStep].label} - {stepsMeta[currentStep].sub}
          </Text>
          <Text style={styles.progressValue}>
            {Math.round(stepProgress[currentStep] * 100)}%
          </Text>
        </View>
        {renderStepper()}
      </View>

      <Animated.View style={{flex: 1, opacity: contentOpacity}}>
        {renderStepContent()}
      </Animated.View>

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
        onRequestClose={() => setPickerVisible({open: false, field: null})}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Add photo</Text>
            <Text style={styles.pickerSubtitle}>Choose source</Text>
            <View style={styles.pickerActions}>
              <Pressable
                style={styles.pickerBtn}
                onPress={() =>
                  pickerVisible.field &&
                  pickImage(pickerVisible.field, 'camera')
                }>
                <Text style={styles.pickerBtnText}>Camera</Text>
              </Pressable>
              <Pressable
                style={styles.pickerBtn}
                onPress={() =>
                  pickerVisible.field &&
                  pickImage(pickerVisible.field, 'library')
                }>
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
                  listSelector.field && engineForm[listSelector.field] === opt;
                return (
                  <Pressable
                    key={opt}
                    style={[
                      styles.selectorOption,
                      active && styles.selectorOptionActive,
                    ]}
                    onPress={() => {
                      if (listSelector.field) {
                        setEngineForm(prev => ({...prev, [listSelector.field!]: opt as any}));
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
                const active = rcForm.profession === opt;
                return (
                  <Pressable
                    key={opt}
                    style={[
                      styles.modalOption,
                      active && styles.modalOptionActive,
                    ]}
                    onPress={() => {
                      setRcForm(prev => ({...prev, profession: opt}));
                      setRcErrors(prev => ({...prev, profession: undefined}));
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
                  regForm.registrationState.trim().toLowerCase() ===
                  stateName.trim().toLowerCase();
                return (
                  <Pressable
                    key={stateName}
                    style={[
                      styles.modalOption,
                      active && styles.modalOptionActive,
                    ]}
                    onPress={() => {
                      setRegForm(prev => ({
                        ...prev,
                        registrationState: stateName,
                        registrationCity: '',
                      }));
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
                const active = regForm.registrationCity === city;
                return (
                  <Pressable
                    key={city}
                    style={[
                      styles.modalOption,
                      active && styles.modalOptionActive,
                    ]}
                    onPress={() => {
                      setRegForm(prev => ({...prev, registrationCity: city}));
                      setRegErrors(prev => ({...prev, registrationCity: undefined}));
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

      <Modal
        visible={datePicker.open}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setDatePicker(prev => ({...prev, open: false, field: null}))
        }>
        <View style={styles.selectorOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() =>
              setDatePicker(prev => ({...prev, open: false, field: null}))
            }
          />
          <View style={styles.datePickerSheet}>
            <View style={styles.selectorHeader}>
              <Text style={styles.selectorTitle}>Select date</Text>
              <Pressable
                style={styles.selectorClose}
                onPress={() =>
                  setDatePicker(prev => ({...prev, open: false, field: null}))
                }>
                <X size={16} color="#6b7280" />
              </Pressable>
            </View>
            <View style={{alignItems: 'center', marginTop: 4}}>
              <DatePicker
                date={datePicker.date}
                mode="date"
                onDateChange={d =>
                  setDatePicker(prev => ({
                    ...prev,
                    date: d,
                  }))
                }
                locale="en"
                androidVariant="iosClone"
                dividerColor="#d1d5db"
                textColor="#111827"
                fadeToColor="#fff"
                theme="light"
                style={{alignSelf: 'center'}}
              />
            </View>
            <Pressable
              style={[styles.dateApplyBtn, {marginTop: 12}]}
              onPress={() => {
                if (!datePicker.field) {
                  setDatePicker(prev => ({...prev, open: false}));
                  return;
                }
                const iso = formatDateVal(datePicker.date);
                setEngineForm(prev => ({...prev, [datePicker.field!]: iso}));
                setEngineErrors(prev => ({...prev, [datePicker.field!]: undefined}));
                setDatePicker(prev => ({...prev, open: false, field: null}));
              }}>
              <Text style={styles.dateApplyLabel}>Set date</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default VehicleDetailsWizardScreen;
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
  stepLineWrap: {
    flex: 1,
    height: 3,
    marginHorizontal: 6,
    position: 'relative',
    justifyContent: 'center',
  },
  stepLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
  },
  stepLineActive: {
    position: 'absolute',
    left: 0,
    height: 3,
    backgroundColor: '#10b981',
    borderRadius: 999,
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
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  pillInactive: {},
  pillActive: {
    backgroundColor: '#fff',
    borderColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOpacity: 0.08,
    shadowOffset: {width: 0, height: 4},
    shadowRadius: 6,
    elevation: 1,
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  pillLabelInactive: {
    color: '#4b5563',
  },
  pillLabelActive: {
    color: PRIMARY,
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
  boxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  boxOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    minWidth: '48%',
  },
  boxOptionActive: {
    borderColor: PRIMARY,
    backgroundColor: '#fff',
  },
  boxOptionPressed: {
    opacity: 0.7,
  },
  boxOptionLabel: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 13,
  },
  boxOptionLabelActive: {
    color: PRIMARY,
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
  eyeIcon: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#f3f4f6',
    padding: 6,
    borderRadius: 999,
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
  selectorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  selectorSheet: {
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
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  selectorClose: {
    padding: 6,
  },
  selectorList: {
    maxHeight: 320,
  },
  selectorOption: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  selectorOptionActive: {
    borderColor: PRIMARY,
    backgroundColor: '#f0f9ff',
  },
  selectorOptionText: {
    fontSize: 14,
    color: '#111827',
  },
  selectorOptionTextActive: {
    color: PRIMARY,
    fontWeight: '700',
  },
  datePickerSheet: {
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
  calendarHeader: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarNav: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  calendarMonth: {
    fontWeight: '700',
    color: '#111827',
  },
  weekRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekLabel: {
    width: 34,
    textAlign: 'center',
    color: '#6b7280',
    fontWeight: '700',
  },
  dayScroll: {
    marginTop: 6,
  },
  dayScrollContent: {
    paddingBottom: 12,
  },
  dayGrid: {
    gap: 6,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCell: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  dayCellEmpty: {
    backgroundColor: 'transparent',
  },
  dayCellActive: {
    backgroundColor: '#d1fae5',
  },
  dayCellText: {
    color: '#111827',
    fontWeight: '700',
  },
  dayCellTextActive: {
    color: '#065f46',
  },
  dayCellTextEmpty: {
    color: 'transparent',
  },
  dateApplyBtn: {
    marginTop: 12,
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  dateApplyLabel: {
    color: '#fff',
    fontWeight: '700',
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
  syncBadge: {
    position: 'absolute',
    bottom: 18,
    alignSelf: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContent: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.9)',
    position: 'relative',
  },
  previewImageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 10,
  },
});
