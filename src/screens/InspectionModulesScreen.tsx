import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Share,
  Platform,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ChevronLeft,
  Car,
  DoorClosed,
  Gauge,
  Cpu,
  Workflow,
  Wrench,
  Settings,
  BadgeIndianRupee,
  AlertTriangle,
  Star,
  Check,
  FileText,
} from 'lucide-react-native';
import { PRIMARY } from '../utils/theme';
import { client } from '../utils/apiClient';
import { loadDraft } from '../utils/draftStorage';
import { store } from '../store/store';
import RNFS from 'react-native-fs';
import RNHTMLtoPDF from 'react-native-html-to-pdf';

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof global.btoa === 'function') {
    return global.btoa(binary);
  }
  return '';
};

type RouteParams = {
  sellCarId?: string | number;
};

const modules = [
  { key: 'vehicleDetails', label: 'Vehicle Details', icon: Car, enabled: true },
  { key: 'exterior', label: 'Exterior', icon: DoorClosed, enabled: true },
  {
    key: 'electrical',
    label: 'Electrical + Interior',
    icon: Cpu,
    enabled: true,
  },
  { key: 'testDrive', label: 'Test Drive', icon: Gauge, enabled: true },
  { key: 'engine', label: 'Engine', icon: Wrench, enabled: true },
  { key: 'functions', label: 'Functions', icon: Workflow, enabled: true },
  { key: 'frames', label: 'Frames', icon: Settings, enabled: true },
  {
    key: 'refurbishment',
    label: 'Refurbishment Cost',
    icon: BadgeIndianRupee,
    enabled: true,
  },
  { key: 'defective', label: 'Defective parts', icon: AlertTriangle, enabled: true },
];

type ModuleProgress = {
  pct: number;
  requiredLeft: number;
  optionalLeft: number;
  hasExplicitCounts?: boolean;
};

const InspectionModulesScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { sellCarId } = (route.params as RouteParams) || {};
  const formattedSellCarId =
    sellCarId == null ? '' : String(sellCarId).trim();
  const [progressMap, setProgressMap] = useState<Record<string, ModuleProgress>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allCompleted, setAllCompleted] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [pickupRemark, setPickupRemark] = useState('');
  const [drivingExperience, setDrivingExperience] = useState('');
  const [refurbTotal, setRefurbTotal] = useState('0');
  const [ratingSaved, setRatingSaved] = useState(false);
  const [ratingId, setRatingId] = useState<string | number>('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [reportDownloading, setReportDownloading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [inspectionId, setInspectionId] = useState<string | number>('');
  const [lastDownloadPath, setLastDownloadPath] = useState<string | null>(null);
  const [engineInfoData, setEngineInfoData] = useState<Record<string, any> | null>(null);
  const [regDetailsData, setRegDetailsData] = useState<Record<string, any> | null>(null);
  const [inspectionSnapshot, setInspectionSnapshot] = useState<any | null>(null);
  const [exteriorDataState, setExteriorDataState] = useState<any | null>(null);
  const [interiorDataState, setInteriorDataState] = useState<any | null>(null);
  const [engineDataState, setEngineDataState] = useState<any | null>(null);
  const [testDriveDataState, setTestDriveDataState] = useState<any | null>(null);
  const [functionsDataState, setFunctionsDataState] = useState<any | null>(null);
  const [framesDataState, setFramesDataState] = useState<any | null>(null);
  const [defectsDataState, setDefectsDataState] = useState<any[]>([]);
  const [refurbDataState, setRefurbDataState] = useState<any | null>(null);
  const [evaluationGenerating, setEvaluationGenerating] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [lastEvaluationPath, setLastEvaluationPath] = useState<string | null>(null);

  const fetchProgress = async (opts?: { isRefresh?: boolean }) => {
    if (!formattedSellCarId) {
      return;
    }
    if (opts?.isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const [
        vehicleResResult,
        inspectionResResult,
        refurbResResult,
        defectsResResult,
        testDriveReportResult,
      ] = await Promise.allSettled([
        client.get('/api/view-vehicle-details-inspection', {
          params: { sellCarId: formattedSellCarId },
        }),
        client.get('/api/view-inspection', {
          params: { sellCarId: formattedSellCarId },
        }),
        client.get('/api/view-refurbishment-cost', {
          params: { sellCarId: formattedSellCarId },
        }),
        client.get('/api/view-defects-inspection', {
          params: { sellCarId: formattedSellCarId },
        }),
        client.get('/api/view-test-drive-report', {
          params: { sellCarId: formattedSellCarId },
        }),
      ]);

      const vehicleRes =
        vehicleResResult.status === 'fulfilled' ? vehicleResResult.value : null;
      const inspectionRes =
        inspectionResResult.status === 'fulfilled'
          ? inspectionResResult.value
          : null;
      const refurbRes =
        refurbResResult.status === 'fulfilled' ? refurbResResult.value : null;
      const defectsRes =
        defectsResResult.status === 'fulfilled' ? defectsResResult.value : null;
      const testDriveReport =
        testDriveReportResult.status === 'fulfilled'
          ? testDriveReportResult.value?.data?.data?.testDriveReports?.Reports
          : null;

      const extractError = (r: any) =>
        r?.reason?.response?.data?.message ||
        r?.reason?.message ||
        'Request failed';
      const apiErrors = [
        { res: vehicleResResult, label: 'vehicle' },
        { res: inspectionResResult, label: 'inspection' },
        { res: refurbResResult, label: 'refurb' },
        { res: defectsResResult, label: 'defects' },
      ]
        .filter(r => r.res.status === 'rejected')
        .map(({ res, label }) => ({ label, message: extractError(res) }));
      const blockingErrors: string[] = [];
      if (vehicleResResult.status === 'rejected') {
        blockingErrors.push(`Vehicle fetch failed: ${extractError(vehicleResResult)}`);
      }
      if (inspectionResResult.status === 'rejected') {
        blockingErrors.push(`Inspection fetch failed: ${extractError(inspectionResResult)}`);
      }
      if (blockingErrors.length > 0) {
        console.warn('[InspectionModules] blocking errors', blockingErrors);
        setError(blockingErrors[0]);
      } else if (apiErrors.length > 0) {
        console.warn('[InspectionModules] Non-blocking fetch errors', apiErrors);
      }
      console.log('[InspectionModules] fetch results', {
        sellCarId: formattedSellCarId,
        vehicleOk: !!vehicleRes,
        inspectionOk: !!inspectionRes,
        refurbOk: !!refurbRes,
        defectsOk: !!defectsRes,
        errors: apiErrors,
      });

      let ratingResOk: any = null;
      try {
        ratingResOk = await client.get('/api/view-evaluator-rating', {
          params: { sellCarId: formattedSellCarId },
        });
      } catch (err: any) {
        console.warn('Failed to fetch evaluator rating', err?.message || err);
      }

      const nextProgress: Record<string, ModuleProgress> = {};

      // Vehicle details progress (aggregate of step 1a/1b/1c)
      let engineInfo: Record<string, any> | null = null;
      let rcDetails: Record<string, any> | null = null;
      let regDetails: Record<string, any> | null = null;
      if (inspectionRes?.data?.data?.allInspections?.[0]?.id != null) {
        setInspectionId(inspectionRes.data.data.allInspections[0].id);
      }
      if (vehicleRes) {
        const vehicleDetails =
          vehicleRes?.data?.data?.vehicleDetails?.vehicleDetails ||
          vehicleRes?.data?.data?.vehiclesDetails?.vehicleDetails ||
          vehicleRes?.data?.data?.vehicleDetails ||
          vehicleRes?.data?.data?.vehiclesDetails ||
          {};
        engineInfo =
          vehicleDetails?.['Engine Info'] ||
          vehicleDetails?.engineInfo ||
          vehicleRes?.data?.data?.EngineInfo ||
          vehicleRes?.data?.data?.engineInfo ||
          vehicleRes?.data?.data?.['Engine Info'] ||
          null;
        rcDetails =
          vehicleDetails?.['RC Details'] || vehicleDetails?.rcDetails || null;
        regDetails =
          vehicleDetails?.['Registration Details'] ||
          vehicleDetails?.registrationDetails ||
          null;
      }

      const hasValue = (v: any) => {
        if (v == null) {
          return false;
        }
        if (typeof v === 'string') {
          return v.trim() !== '';
        }
        return true;
      };

      const requiredEngine = [
        'Chassis Number',
        'Manufacturer Name',
        'Chassis Number Embossing',
        'Engine Number',
        'Engine CC',
        'Year of Manufacturing',
        'Car Type',
        'Model Name',
        'Variant Name',
        'Colour',
        'Paint Type',
        'Transmission',
        'Emission',
        'Date of Registration',
        'Odometer Reading',
        'Fuel Type',
        'External CNG/LPG Fitment',
        'No. of Owners',
        'Duplicate Key Available',
        'VIN Plate Available',
        'Jack & Toolkit Available',
        'Spare Wheel Available',
        'Insurance Type',
        'Insurance Valid Upto',
      ];
      const optionalEngine = ['Insurance IDV Value'];

      const requiredRc = [
        'Name on RC',
        'Phone Number',
        'Profession',
        'RC Availability',
        'RC Condition',
        'Mismatch on RC',
        'RC image.Front',
        'RC image.Back',
      ];
      const optionalRc = ['Address', 'Email ID'];

      const requiredReg = [
        'Registration State',
        'Registration City',
        'RTO',
        'RTO NOC Issued',
        'Registration Valid',
        'Road Tax Paid',
        'Commercial Vehicle',
        'Under Hypothecation',
        'Tax image',
      ];

      const toCamel = (s: string) =>
        s
          .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => (c ? c.toUpperCase() : ''))
          .replace(/^./, m => m.toLowerCase());
      const aliasMap: Record<string, string[]> = {
        'Car Type': ['carType', 'CarType', 'car_type'],
        'Fuel Type': ['fuelType', 'FuelType', 'fuel_type'],
        Colour: ['Color', 'colour', 'color'],
        'Paint Type': ['paintType', 'PaintType', 'paint_type'],
        'External CNG/LPG Fitment': [
          'externalFitment',
          'ExternalFitment',
          'externalCngLpgFitment',
          'ExternalCngLpgFitment',
          'cngLpgFitment',
        ],
        'Insurance Valid Upto': ['insuranceValidUpto', 'insurance_valid_upto', 'insuranceValidUpTo'],
        'Insurance Type': ['insuranceType'],
        'Insurance IDV Value': ['insuranceIdvValue', 'insuranceIdv'],
        'RC image': ['rcImage', 'rcImages'],
        'Tax image': ['taxImage', 'taxDocument', 'tax'],
        'No. of Owners': [
          'No. of owners',
          'No.of Owners',
          'No of Owners',
          'noOfOwners',
          'owners',
          'ownerCount',
          'ownersCount',
          'no_of_owners',
          'noOfOwner',
          'ownersCount',
          'noofowners',
        ],
      };
      const val = (obj: any, key: string) => {
        if (!obj) return null;
        if (key.includes('.') && !/\s/.test(key)) {
          const [root, child] = key.split('.');
          const lowerRoot = typeof root === 'string' ? root.toLowerCase() : root;
          return obj[root]?.[child] ?? obj[lowerRoot]?.[child];
        }
        const lowerKey = typeof key === 'string' ? key.toLowerCase() : key;
        const camelKey = typeof key === 'string' ? toCamel(key) : key;
        const compact = typeof key === 'string' ? key.replace(/\s+/g, '') : key;
        const aliasKeys = aliasMap[key] || [];
        const cleanKey =
          typeof key === 'string' ? key.replace(/[^a-zA-Z0-9]/g, '') : key;
        const lowerClean =
          typeof cleanKey === 'string' ? cleanKey.toLowerCase() : cleanKey;
        const candidates = [
          key,
          lowerKey,
          camelKey,
          toCamel(lowerKey as string),
          compact,
          typeof compact === 'string' ? compact.toLowerCase() : compact,
          typeof key === 'string' ? key.replace(/\s+/g, '_') : key,
          typeof lowerKey === 'string' ? (lowerKey as string).replace(/\s+/g, '_') : lowerKey,
          cleanKey,
          lowerClean,
          ...aliasKeys,
          ...aliasKeys.map(toCamel),
          ...aliasKeys.map(k => k.replace(/\s+/g, '')),
          ...aliasKeys.map(k => k.replace(/[^a-zA-Z0-9]/g, '')),
        ];
        for (const c of candidates) {
          if (obj && Object.prototype.hasOwnProperty.call(obj, c)) {
            return obj[c];
          }
        }
        return null;
      };

      if (vehicleRes && (engineInfo || rcDetails || regDetails)) {
        const engineFilled = requiredEngine.filter(k => hasValue(val(engineInfo, k)))
          .length;
        const rcFilled = requiredRc.filter(k => {
          if (k === 'RC image.Front') {
            const images = val(rcDetails, 'RC image') || val(rcDetails, 'rcImage') || val(rcDetails, 'rcImages') || {};
            return hasValue(images.Front || images.front);
          }
          if (k === 'RC image.Back') {
            const images = val(rcDetails, 'RC image') || val(rcDetails, 'rcImage') || val(rcDetails, 'rcImages') || {};
            return hasValue(images.Back || images.back);
          }
          return hasValue(val(rcDetails, k));
        }).length;
        const regFilled = requiredReg.filter(k => hasValue(val(regDetails, k))).length;

        const totalRequired =
          requiredEngine.length + requiredRc.length + requiredReg.length;
        if (totalRequired > 0) {
          const filledTotal = engineFilled + rcFilled + regFilled;
          const optionalLeft =
            (optionalEngine.filter(k => !hasValue(val(engineInfo, k))).length || 0) +
            (optionalRc.filter(k => !hasValue(val(rcDetails, k))).length || 0);
          const requiredLeft = totalRequired - filledTotal;
          nextProgress.vehicleDetails = {
            pct:
              requiredLeft === 0
                ? 100
                : Math.min(100, Math.round((filledTotal / totalRequired) * 100)),
            requiredLeft,
            optionalLeft,
            hasExplicitCounts: true,
          };
          if (requiredLeft > 0) {
            const missingEngine = requiredEngine.filter(k => !hasValue(val(engineInfo, k)));
            const missingRc = requiredRc.filter(k => {
              if (k === 'RC image.Front') {
                const images = val(rcDetails, 'RC image') || val(rcDetails, 'rcImage') || val(rcDetails, 'rcImages') || {};
                return !hasValue(images.Front || images.front);
              }
              if (k === 'RC image.Back') {
                const images = val(rcDetails, 'RC image') || val(rcDetails, 'rcImage') || val(rcDetails, 'rcImages') || {};
                return !hasValue(images.Back || images.back);
              }
              return !hasValue(val(rcDetails, k));
            });
            const missingReg = requiredReg.filter(k => !hasValue(val(regDetails, k)));
            console.log('[InspectionModules] vehicleDetails missing fields', {
              missingEngine,
              missingRc,
              missingReg,
            });
          }
        }
      }

      // Module-level completion flags from inspection API
      const inspectionData =
        inspectionRes?.data?.data?.allInspections?.[0] || {};
      const completed: Record<string, boolean> =
        (inspectionData?.completed as Record<string, boolean>) || {};
      const refurbData =
        refurbRes?.data?.data?.refurbishmentCost?.['Total RF Cost'] || null;
      const functionsData =
        inspectionData?.functions ||
        inspectionData?.Functions ||
        inspectionRes?.data?.data?.functions ||
        inspectionRes?.data?.functions;
      const framesData =
        inspectionData?.frames ||
        inspectionRes?.data?.data?.frames ||
        inspectionRes?.data?.frames;
      const defectsData =
        defectsRes?.data?.data?.DefectsReport?.Reports?.Report || [];
      const exteriorData =
        inspectionData?.exterior ||
        inspectionData?.Exterior ||
        inspectionData?.ExteriorInspection;
      const interiorData =
        inspectionData?.interior ||
        inspectionData?.Interior ||
        inspectionData?.electrical ||
        inspectionData?.Electrical ||
        inspectionData?.electricalInterior ||
        inspectionData?.ElectricalInterior;
      const engineData =
        inspectionData?.engine ||
        inspectionData?.Engine ||
        inspectionData?.engineInspection ||
        inspectionData?.EngineInspection;
      const testDriveData =
        inspectionData?.testDrive ||
        inspectionData?.TestDrive ||
        inspectionData?.test_drive ||
        inspectionData?.testdrive ||
        inspectionData?.['Test Drive'] ||
        testDriveReport;
      setEngineInfoData(engineInfo || null);
      setRegDetailsData(regDetails || null);
      setInspectionSnapshot(inspectionData || null);
      // Merge exterior data with local draft (needed for panel photos/status)
      const mergePanels = (base: any, override: any) => {
        const result: Record<string, any> = {};
        const apply = (src: any) => {
          if (!src) return;
          Object.keys(src).forEach(k => {
            result[k] = {...result[k], ...src[k]};
          });
        };
        apply(base);
        apply(override);
        return Object.keys(result).length > 0 ? result : null;
      };
      let exteriorDraft: any = null;
      try {
        exteriorDraft = loadDraft<any>(formattedSellCarId, 'exterior');
      } catch {
        exteriorDraft = null;
      }
      const mergedExterior = {
        ...(exteriorData || {}),
        ...(exteriorDraft || {}),
      };
      const mergedPanels = mergePanels(
        exteriorData?.panels || exteriorData?.panelStates,
        exteriorDraft?.panels || exteriorDraft?.panelStates,
      );
      if (mergedPanels) {
        mergedExterior.panels = mergedPanels;
      }
      setExteriorDataState(
        mergedExterior && Object.keys(mergedExterior).length > 0
          ? mergedExterior
          : null,
      );
      // Merge interior with draft to capture local-only values
      let interiorDraft: any = null;
      try {
        interiorDraft = loadDraft<any>(formattedSellCarId, 'electrical');
      } catch {
        interiorDraft = null;
      }
      setInteriorDataState({
        ...(interiorData || {}),
        ...(interiorDraft || {}),
      });
      setEngineDataState(engineData || null);

      // Merge test drive with draft to capture local-only values
      let testDriveDraft: any = null;
      try {
        testDriveDraft = loadDraft<any>(formattedSellCarId, 'testDrive');
      } catch {
        testDriveDraft = null;
      }
      setTestDriveDataState({
        ...(testDriveData || {}),
        ...(testDriveDraft || {}),
      });
      setFunctionsDataState(functionsData || null);
      setFramesDataState(framesData || null);
      setDefectsDataState(Array.isArray(defectsData) ? defectsData : []);
      setRefurbDataState(refurbData || null);
      const hasDataFlags: Record<string, boolean> = {
        vehicleDetails: !!(engineInfo || rcDetails || regDetails),
        exterior: !!exteriorData,
        interior: !!interiorData,
        testDrive: !!testDriveData,
        engine: !!engineData,
        functions: !!functionsData,
        frames: !!framesData,
        refurbishmentCost: !!refurbData,
        defective: Array.isArray(defectsData) ? defectsData.length > 0 : false,
      };
      const moduleKeyMap: { api: string; ui: string }[] = [
        { api: 'exterior', ui: 'exterior' },
        { api: 'interior', ui: 'electrical' },
        { api: 'testDrive', ui: 'testDrive' },
        { api: 'engine', ui: 'engine' },
        { api: 'functions', ui: 'functions' },
        { api: 'frames', ui: 'frames' },
        { api: 'refurbishmentCost', ui: 'refurbishment' },
        { api: 'defective', ui: 'defective' },
      ];
      moduleKeyMap.forEach(({ api, ui }) => {
        const isDone = !!completed[api] || !!hasDataFlags[api];
        const existing = nextProgress[ui];
        if (existing) {
          // Preserve detailed counts if we already computed them; just upgrade to 100 if backend marks completed
          nextProgress[ui] = isDone
            ? {
              ...existing,
              pct: 100,
              requiredLeft: existing.requiredLeft >= 0 ? 0 : existing.requiredLeft,
              optionalLeft: existing.optionalLeft,
            }
            : existing;
        } else {
          nextProgress[ui] = {
            pct: isDone ? 100 : 0,
            requiredLeft: isDone ? 0 : -1,
            optionalLeft: -1,
            hasExplicitCounts: false,
          };
        }
      });

      // If vehicle details completion flag is present but we lacked field-level info
      if (!nextProgress.vehicleDetails && completed.vehicleDetails) {
        nextProgress.vehicleDetails = {
          pct: 100,
          requiredLeft: 0,
          optionalLeft: 0,
          hasExplicitCounts: false,
        };
      }

      // Local draft-based progress overrides (best-effort)
      let evalRating: any = null;
      try {
        const functionsDraft = loadDraft<any>(formattedSellCarId, 'functions');
        const computeFunctionsPct = (src: any) => {
          const source = src?.Reports || src?.reports || src;
          const required = 11;
          const proper =
            source?.proper_condition ||
            source?.properCondition ||
            source?.['proper_condition'] ||
            {};
          const noise =
            source?.['noise/leakage'] ||
            source?.noiseLeakage ||
            source?.noise ||
            {};
          const refurb =
            source?.refurbCost ||
            source?.refurbishmentCost ||
            source?.['Refurbishment Cost'];
          const toggles = [
            source?.steering || proper?.Steering,
            source?.suspension || proper?.Suspension,
            source?.brake || proper?.Brake,
            source?.gearShifting || proper?.['Gear Shifting'],
            source?.driveShaft ||
            proper?.['Drive Shaft/ Axle'] ||
            proper?.['Drive Shaft'],
            source?.clutch || proper?.Clutch,
            source?.wheelBearingNoise || noise?.['Wheel Bearing Noise'],
            source?.gearBoxNoise || noise?.['Gear Box Noise'],
            source?.transmissionLeakage ||
            noise?.['Transmission/ Differential Oil Leakage'],
            source?.differentialNoise || noise?.['Differential Noise'],
            refurb,
          ];
          const filled = toggles.filter(Boolean).length;
          return {
            pct: Math.min(100, Math.round((filled / required) * 100)),
            requiredLeft: required - filled,
            optionalLeft: 0,
            hasExplicitCounts: true,
          };
        };
        if (functionsDraft) {
          nextProgress.functions = computeFunctionsPct(functionsDraft);
        } else if (functionsData) {
          nextProgress.functions = computeFunctionsPct(functionsData);
        }

        const engineDraft = loadDraft<any>(formattedSellCarId, 'engine');
        if (engineDraft) {
          const required = 15;
          const toggles = [
            engineDraft.engineWorking,
            engineDraft.engineCost,
            engineDraft.engineImage,
            engineDraft.radiator,
            engineDraft.silencer,
            engineDraft.starterMotor,
            engineDraft.engineOilLevel,
            engineDraft.coolantAvailability,
            engineDraft.engineMounting,
            engineDraft.battery,
            engineDraft.engineOilLeakage,
            engineDraft.coolantOilLeakage,
            engineDraft.abnormalNoise,
            engineDraft.blackSmoke,
            engineDraft.defectiveBelts,
          ];
          const filled = toggles.filter(Boolean).length;
          nextProgress.engine = {
            pct: Math.min(100, Math.round((filled / required) * 100)),
            requiredLeft: required - filled,
            optionalLeft: 0,
            hasExplicitCounts: true,
          };
        }

        const tdDraft = loadDraft<any>(formattedSellCarId, 'testDrive');
        if (tdDraft) {
          const isComplete =
            tdDraft.isComplete ||
            tdDraft.testDriveCompleted ||
            tdDraft['Test Drive Completed'] ||
            false;
          const required = isComplete ? 4 : 3;
          let filled = 0;
          if (tdDraft.drivingExperience) filled += 1;
          const problems = Array.isArray(tdDraft.problems)
            ? tdDraft.problems
            : tdDraft.problem
              ? [tdDraft.problem]
              : [];
          if (problems.filter(Boolean).length > 0) filled += 1;
          if (isComplete) {
            if (tdDraft.kmsDriven) filled += 1;
            if (tdDraft.timeTaken) filled += 1;
          } else {
            if (tdDraft.incompleteReason) filled += 1;
          }
          nextProgress.testDrive = {
            pct: Math.min(100, Math.round((filled / required) * 100)),
            requiredLeft: required - filled,
            optionalLeft: 0,
            hasExplicitCounts: true,
          };
        }

        const electricalDraft = loadDraft<any>(
          formattedSellCarId,
          'electrical',
        );
        if (electricalDraft) {
          const required = 30;
          let filled = 0;
          const countYN = (v: any) => (v ? 1 : 0);
          filled += countYN(electricalDraft.seatCover);
          filled += countYN(electricalDraft.sunRoof);
          filled += countYN(electricalDraft.carAntenna);
          filled += countYN(electricalDraft.powerWindowsCount);
          filled += countYN(electricalDraft.airBagsCount);
          [
            electricalDraft.powerWindowsWorking,
            electricalDraft.airBagsWorking,
            electricalDraft.parkingBrake,
            electricalDraft.horn,
            electricalDraft.instrumentCluster,
            electricalDraft.wiper,
            electricalDraft.headLamp,
            electricalDraft.tailLamp,
            electricalDraft.fogLamp,
            electricalDraft.blinkerLight,
            electricalDraft.seatBelts,
            electricalDraft.acEffectiveness,
            electricalDraft.acGrillEfficiency,
            electricalDraft.climateControlAC,
            electricalDraft.heater,
            electricalDraft.orvm,
            electricalDraft.steeringMounted,
            electricalDraft.abs,
            electricalDraft.reverseSensors,
            electricalDraft.reverseCamera,
            electricalDraft.keylessLocking,
            electricalDraft.musicSystemWorking,
          ].forEach(v => {
            if (v) filled += 1;
          });
          if (electricalDraft.odometerImageUri) filled += 1;
          if (
            Array.isArray(electricalDraft.interiorImages) &&
            electricalDraft.interiorImages.filter(Boolean).length > 0
          ) {
            filled += 1;
          }
          if (electricalDraft.refurbishmentCost) filled += 1;

          nextProgress.electrical = {
            pct: Math.min(100, Math.round((filled / required) * 100)),
            requiredLeft: required - filled,
            optionalLeft: 0,
            hasExplicitCounts: true,
          };
        }

        const framesDraft = loadDraft<any>(formattedSellCarId, 'frames');
        const computeFramesPct = (src: any) => {
          if (!src || typeof src !== 'object') return null;
          const anyDamage = src['Any Damage In'] || src.anyDamageIn || src.anyDamage;
          const front = anyDamage?.Front || anyDamage?.front || {};
          const pillars = anyDamage?.Pillars || anyDamage?.pillars || {};
          const rear = anyDamage?.Rear || anyDamage?.rear || {};

          let filled = 0;
          ['Bonnet Support Member', 'Cross Member', 'Lamp Support', 'Left Apron', 'Right Apron'].forEach(k => {
            if (front[k]) filled += 1;
          });

          const pillarKeys = [
            'Left A-Pillar',
            'Left B-Pillar',
            'Left C-Pillar',
            'Right A-Pillar',
            'Right B-Pillar',
            'Right C-Pillar',
          ];
          pillarKeys.forEach(k => {
            if (pillars[k]) {
              filled += 1;
            }
          });

          ['Rear Left Quarter Panel', 'Rear Right Quarter Panel', 'Dickey'].forEach(k => {
            if (rear[k]) filled += 1;
          });

          if (src['Flood Affected Vehicle']) filled += 1;
          const imgs = src['Frame images'] || src.frameImages || src.images || [];
          if (Array.isArray(imgs) && imgs.filter(Boolean).length > 0) {
            filled += 1;
          }
          const required = 16;
          return {
            pct: Math.min(100, Math.round((filled / required) * 100)),
            requiredLeft: Math.max(0, required - filled),
            optionalLeft: 0,
            hasExplicitCounts: true,
          };
        };

        const framesPct = computeFramesPct(framesDraft || framesData);
        if (framesPct) {
          nextProgress.frames = framesPct;
        }

        const refurbDraft = loadDraft<any>(formattedSellCarId, 'refurbishment');
        const computeRefurb = (src: any) => {
          if (!src || typeof src !== 'object') return null;
          const other = src['Other Refurbishment Cost'] || src.other || {};
          const docs = src.Document || src.document || {};
          const vals = [
            other['Popular Work Demand'],
            other['Interior Cleaning'],
            other['Rubbing & Polishing'],
            other['Spare Keys'],
            other['Accessories Repair'],
            docs['Insurance Cost'],
            docs['Pollution Cost'],
            docs['Registration/ Doc Cost'],
          ];
          const filled = vals.filter(v => v != null && `${v}`.trim() !== '').length;
          const optionalTotal = 8;
          const optionalLeft = Math.max(0, optionalTotal - filled);
          return {
            pct: Math.min(100, Math.round((filled / optionalTotal) * 100)),
            requiredLeft: -1,
            optionalLeft,
            hasExplicitCounts: true,
          };
        };
        const refurbPct = computeRefurb(refurbDraft || refurbData);
        if (refurbPct) {
          nextProgress.refurbishment = refurbPct;
        }

        const defectCount = Array.isArray(defectsData)
          ? defectsData.length
          : 0;
        nextProgress.defective = {
          pct: Math.min(100, defectCount > 0 ? 100 : 0),
          requiredLeft: -1,
          optionalLeft: defectCount,
          hasExplicitCounts: true,
        };
        // capture refurb total for banner display
        evalRating =
          ratingResOk?.data?.data?.evaluatorRating ||
          ratingResOk?.data?.evaluatorRating ||
          null;
        if (evalRating) {
          console.log('[InspectionModules] evaluator rating payload', evalRating);
          const total =
            evalRating['Total RF Cost'] ||
            evalRating.totalRfCost ||
            evalRating.total_rf_cost ||
            evalRating.total ||
            0;
          setRefurbTotal(String(total || 0));
        } else if (refurbData) {
          const other = refurbData['Other Refurbishment Cost'] || refurbData.other || {};
          const docs = refurbData.Document || refurbData.document || {};
          const nums = [
            other['Popular Work Demand'],
            other['Interior Cleaning'],
            other['Rubbing & Polishing'],
            other['Spare Keys'],
            other['Accessories Repair'],
            docs['Insurance Cost'],
            docs['Pollution Cost'],
            docs['Registration/ Doc Cost'],
          ];
          const sum = nums.reduce((acc, v) => {
            const n = parseFloat(`${v || 0}`);
            return acc + (isNaN(n) ? 0 : n);
          }, 0);
          setRefurbTotal(sum.toString());
        } else if (refurbDraft) {
          const other = refurbDraft['Other Refurbishment Cost'] || refurbDraft.other || {};
          const docs = refurbDraft.Document || refurbDraft.document || {};
          const nums = [
            other['Popular Work Demand'],
            other['Interior Cleaning'],
            other['Rubbing & Polishing'],
            other['Spare Keys'],
            other['Accessories Repair'],
            docs['Insurance Cost'],
            docs['Pollution Cost'],
            docs['Registration/ Doc Cost'],
          ];
          const sum = nums.reduce((acc, v) => {
            const n = parseFloat(`${v || 0}`);
            return acc + (isNaN(n) ? 0 : n);
          }, 0);
          setRefurbTotal(sum.toString());
        }
      } catch (err) {
        console.warn('Failed to use draft progress', err);
      }

      const requiredCompletedKeys = [
        'vehicleDetails',
        'engine',
        'exterior',
        'interior',
        'functions',
        'frames',
        'testDrive',
        'refurbishmentCost',
        'defective',
      ];
      const doneFromFlags = requiredCompletedKeys.every(
        key => completed[key] === true || hasDataFlags[key],
      );
      if (evalRating) {
        const stars = Number(evalRating['Evaluator Rating'] || 0);
        const drive = evalRating['Driving Experience'] || '';
        const comments = evalRating['Comments'] || '';
        const pickup = evalRating['Pickup remark'] || evalRating['Pickup Remark'] || '';
        setRating(isNaN(stars) ? 0 : stars);
        setDrivingExperience(drive);
        setRatingComment(comments);
        setPickupRemark(pickup);
        if (evalRating.id != null) {
          setRatingId(evalRating.id);
        }
        setRatingSaved(true);
      }

      console.log('[InspectionModules] progress snapshot', {
        completedFlags: completed,
        hasDataFlags,
        computedProgress: nextProgress,
        allCompleted: doneFromFlags,
      });

      setProgressMap(nextProgress);
      setAllCompleted(doneFromFlags);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load progress';
      console.error('[InspectionModules] fetchProgress failed', msg, err);
      setError(msg);
    } finally {
      if (opts?.isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [formattedSellCarId]);

  const handleSaveRating = async () => {
    if (ratingSubmitting) return;
    if (rating <= 0 || !drivingExperience) return;
    setRatingSubmitting(true);
    setRatingError(null);
    try {
      const payload: any = {
        id: ratingId || formattedSellCarId,
        sellCarId: formattedSellCarId,
        'Evaluator Rating': String(rating),
        'Driving Experience': drivingExperience,
        Comments: ratingComment || '',
        Remarks: pickupRemark || '',
      };
      console.log('[InspectionModules] Saving evaluator rating', payload);
      await client.post('/api/add-evaluator-rating', payload);
      console.log('[InspectionModules] Saved evaluator rating successfully');
      setRatingSaved(true);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || 'Failed to save rating';
      console.error('[InspectionModules] Failed to save evaluator rating', msg);
      setRatingError(msg);
      setRatingSaved(false);
    } finally {
      setRatingSubmitting(false);
    }
  };

  const openSavedReport = async () => {
    if (!lastDownloadPath) return;
    const path = lastDownloadPath;
    const isPrivatePath =
      path.includes('/data/user/') || path.includes('/Android/data/');
    const fileUrl = path.startsWith('file://') ? path : `file://${path}`;
    try {
      if (isPrivatePath) {
        await Share.share({
          title: 'Inspection report',
          url: fileUrl,
          message: 'Inspection report',
        });
      } else {
        await Linking.openURL(fileUrl);
      }
    } catch (err: any) {
      Alert.alert('Open failed', err?.message || 'Unable to open the saved file.');
    }
  };

  const handleDownloadReport = async () => {
    if (!formattedSellCarId) return;
    if (reportDownloading) return;
    setReportDownloading(true);
    setReportError(null);
    setLastDownloadPath(null);
    try {
      let useFallbackDir = false;
      if (Platform.OS === 'android') {
        const perm = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
        const has = await PermissionsAndroid.check(perm);
        if (!has) {
          const granted = await PermissionsAndroid.request(perm);
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            useFallbackDir = true;
          }
        }
      }
      const token = (store.getState() as any)?.auth?.token;
      const url = `https://api.marnix.in/api/generate-inspection-pdf?sellCarId=${encodeURIComponent(
        formattedSellCarId,
      )}`;
      console.log('[InspectionModules] Download request', {url});
      const authToken = token || '';
      const authHeader =
        authToken && !authToken.toLowerCase().startsWith('bearer')
          ? `Bearer ${authToken}`
          : authToken;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/pdf',
          type: 'employee',
          ...(authHeader ? {Authorization: authHeader} : {}),
        },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(
          `Failed with status ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
        );
      }
      const buffer = await res.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      if (!base64) {
        throw new Error('Unable to process PDF content');
      }
      const now = new Date();
      const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
        now.getDate(),
      ).padStart(2, '0')}`;
      const filename = `${formattedSellCarId}-${datePart}-inspection.pdf`;
      const downloadDir =
        (!useFallbackDir && RNFS.DownloadDirectoryPath) ||
        RNFS.DocumentDirectoryPath ||
        RNFS.TemporaryDirectoryPath ||
        RNFS.CachesDirectoryPath;
      const destPath = `${downloadDir}/${filename}`;
      await RNFS.writeFile(destPath, base64, 'base64');
      console.log('[InspectionModules] Report saved', destPath);
      setLastDownloadPath(destPath);
      Alert.alert('Report saved', `Saved to:\n${destPath}`);
    } catch (err: any) {
      const msg = err?.message || 'Failed to download report';
      console.error('[InspectionModules] Download report failed', msg);
      setReportError(msg);
    } finally {
      setReportDownloading(false);
    }
  };

  const resolveVal = (obj: any, key: string) => {
    if (!obj || !key) return '';
    const variants = [
      key,
      key.toLowerCase(),
      key.replace(/\s+/g, ''),
      key.replace(/\s+/g, '').toLowerCase(),
      key.replace(/\s+/g, '_'),
      key.replace(/\s+/g, '_').toLowerCase(),
    ];
    for (const v of variants) {
      if (obj[v] !== undefined && obj[v] !== null) {
        return obj[v];
      }
    }
    return '';
  };

  const isLikelyImageUri = (val: any) => {
    if (!val) return false;
    if (typeof val !== 'string') return false;
    const lower = val.toLowerCase();
    return (
      lower.startsWith('http') ||
      lower.startsWith('file:') ||
      lower.startsWith('content:') ||
      lower.includes('base64') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png')
    );
  };

  const toDisplay = (val: any) => {
    if (val == null) return '';
    if (Array.isArray(val)) return val.filter(Boolean).join(', ');
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val);
      } catch {
        return String(val);
      }
    }
    return String(val);
  };

  const yesNo = (val: any) => {
    const str = String(val || '').trim().toLowerCase();
    if (!str) return '';
    if (['yes', 'y', 'true', '1', 'available', 'ok'].includes(str)) return 'Yes';
    if (['no', 'n', 'false', '0', 'not available', 'na', 'n/a'].includes(str))
      return 'No';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return val;
  };

  const escapeHtml = (value: any) => {
    const str = toDisplay(value);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const buildAdditionalRows = (
    obj: any,
    excludeKeys: Set<string>,
    labelPrefix?: string,
  ) => {
    const rows: { label: string; value: any }[] = [];
    if (!obj || typeof obj !== 'object') return rows;
    Object.keys(obj).forEach(k => {
      if (excludeKeys.has(k)) return;
      const val = (obj as any)[k];
      if (
        val == null ||
        typeof val === 'object' ||
        Array.isArray(val) ||
        isLikelyImageUri(val) ||
        /image|photo|uri|img/i.test(k)
      ) {
        return;
      }
      rows.push({
        label: labelPrefix ? `${labelPrefix}: ${k}` : k,
        value: val,
      });
    });
    return rows;
  };

  const formatDateLabel = (val: any) => {
    if (!val) return '';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return toDisplay(val);
    return d.toDateString();
  };

  const buildRows = (rows: { label: string; value: any }[]) => {
    if (!rows || rows.length === 0) return '';
    return rows
      .map(r => {
        const val = toDisplay(r.value);
        const displayVal = val === '' ? '—' : val;
        return `
        <div class="row">
          <div class="row-label">${escapeHtml(r.label)}</div>
          <div class="row-value">${escapeHtml(displayVal)}</div>
        </div>
      `;
      })
      .join('');
  };

  const buildSection = (title: string, rows: { label: string; value: any }[]) => {
    const inner = buildRows(rows);
    if (!inner) return '';
    return `
      <div class="section">
        <div class="section-title">${escapeHtml(title)}</div>
        ${inner}
      </div>
    `;
  };

  const buildListSection = (title: string, items: string[]) => {
    const list = items.filter(Boolean);
    if (list.length === 0) return '';
    return `
      <div class="section">
        <div class="section-title">${escapeHtml(title)}</div>
        <div class="list">
          ${list.map(i => `<div class="list-item">• ${escapeHtml(i)}</div>`).join('')}
        </div>
      </div>
    `;
  };

  const normalizeUri = (val: any) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (val.uri) return val.uri;
    return '';
  };

  const extractImages = () => {
    const imgs: { label: string; uri: string }[] = [];
    const seen = new Set<string>();
    const pushImg = (label: string, uri: any) => {
      const norm = normalizeUri(uri);
      if (norm) {
        const key = norm; // dedupe strictly by uri to avoid repeats with different labels
        if (seen.has(key)) return;
        seen.add(key);
        imgs.push({ label, uri: norm });
      }
    };

    // Known, explicit fields
    pushImg('Engine Image', engineDataState?.engineImage || engineDataState?.EngineImage);
    const odometer = interiorDataState?.odometerImageUri || interiorDataState?.odometerImage;
    pushImg('Interior Odometer Image', odometer);

    const interiorImages =
      interiorDataState?.interiorImages ||
      interiorDataState?.InteriorImages ||
      interiorDataState?.images ||
      [];
    if (Array.isArray(interiorImages)) {
      interiorImages.forEach((uri: any, idx: number) =>
        pushImg(`Interior Image ${idx + 1}`, uri),
      );
    }

    const frameImages =
      framesDataState?.['Frame images'] ||
      framesDataState?.frameImages ||
      framesDataState?.images ||
      [];
    if (Array.isArray(frameImages)) {
      frameImages.forEach((uri: any, idx: number) => pushImg(`Frame ${idx + 1}`, uri));
    }

    // Defect images if present
    defectsDataState.forEach((d: any, idx: number) => {
      const uri = d?.uri || d?.image || d?.photo || d?.['Defect image'];
      pushImg(`Defect ${idx + 1}`, uri);
    });

    // Vehicle document images (if present in engineInfoData or regDetailsData)
    const docImages =
      engineInfoData?.documents ||
      engineInfoData?.images ||
      regDetailsData?.documents ||
      regDetailsData?.images ||
      [];
    if (Array.isArray(docImages)) {
      docImages.forEach((uri: any, idx: number) => pushImg(`Document ${idx + 1}`, uri));
    }

    // Generic scan for obvious image keys across all module data
    const scanForImages = (obj: any, prefix: string) => {
      if (!obj || typeof obj !== 'object') return;
      Object.keys(obj).forEach(k => {
        const v = (obj as any)[k];
        if (Array.isArray(v)) {
          v.forEach((item, idx) => {
            const label = `${prefix} ${k} ${idx + 1}`;
            if (isLikelyImageUri(item) || normalizeUri(item)) {
              pushImg(label, item);
            } else if (item && typeof item === 'object' && normalizeUri(item.uri)) {
              pushImg(label, item.uri);
            }
          });
        } else if (typeof v === 'object' && v) {
          if (normalizeUri((v as any).uri)) {
            pushImg(`${prefix} ${k}`, (v as any).uri);
          }
        } else if (isLikelyImageUri(v) || /image|photo|uri|img/i.test(k)) {
          pushImg(`${prefix} ${k}`, v);
        }
      });
    };

    scanForImages(exteriorDataState, 'Exterior');
    const panelStates =
      exteriorDataState?.panels ||
      exteriorDataState?.Panels ||
      exteriorDataState?.panelStates ||
      {};
    const pushPanelImg = (key: string, st: any) => {
      if (!st) return;
      const uri =
        st.photoUri || st.photo || st.image || st.img || st.uri || st.url;
      if (uri) {
        pushImg(`Exterior Panel: ${key} (${st.status || ''})`, uri);
      }
    };
    if (Array.isArray(panelStates)) {
      panelStates.forEach((st: any, idx: number) =>
        pushPanelImg(st?.name || `Panel ${idx + 1}`, st),
      );
    } else {
      Object.keys(panelStates || {}).forEach(key => {
        const st = (panelStates as any)[key];
        pushPanelImg(key, st);
      });
    }
    scanForImages(engineDataState, 'Engine');
    scanForImages(functionsDataState, 'Functions');
    scanForImages(framesDataState, 'Frames');
    scanForImages(refurbDataState, 'Refurb');

    return imgs;
  };

  const buildImageGrid = (title: string, items: { label: string; uri: string }[]) => {
    if (!items || items.length === 0) return '';
    const cards = items
      .map(
        it => `
        <div class="img-card">
          <img src="${escapeHtml(it.uri)}" />
          <div class="img-label">${escapeHtml(it.label)}</div>
        </div>
      `,
      )
      .join('');
    return `
      <div class="section">
        <div class="section-title">${escapeHtml(title)}</div>
        <div class="img-grid">${cards}</div>
      </div>
    `;
  };

  const buildDefectsSection = (
    defects: any[],
    images: { label: string; uri: string }[],
  ) => {
    if (!defects || defects.length === 0) return '';
    const cards = defects
      .map((d, idx) => {
        const remark =
          d?.Remark ||
          d?.remark ||
          d?.['Defect remark'] ||
          d?.defectRemark ||
          d?.['Defect image'] ||
          d?.imageRemark ||
          '';
        const label = `Defect ${idx + 1}`;
        const img = images.find(i => i.label === label);
        if (!img && !remark) return '';
        return `
          <div class="defect-card">
            ${img ? `<img src="${escapeHtml(img.uri)}" />` : ''}
            <div class="defect-caption">${escapeHtml(remark || label)}</div>
          </div>
        `;
      })
      .filter(Boolean)
      .join('');
    if (!cards) return '';
    return `
      <div class="section">
        <div class="section-title">Defects</div>
        <div class="defect-grid">
          ${cards}
        </div>
      </div>
    `;
  };

  const buildEvaluationHtml = (imagesOverride?: {label: string; uri: string}[]) => {
    const inspectorName =
      inspectionSnapshot?.inspectedBy?.name ||
      inspectionSnapshot?.inspector ||
      inspectionSnapshot?.inspectedBy ||
      '';
    const regNumber =
      resolveVal(engineInfoData, 'Registration Number') ||
      resolveVal(engineInfoData, 'RegNumber') ||
      resolveVal(engineInfoData, 'Reg Number') ||
      formattedSellCarId;
    const inspectionDate =
      inspectionSnapshot?.slotDate ||
      inspectionSnapshot?.inspectionDate ||
      inspectionSnapshot?.createdAt ||
      new Date().toISOString();

    const vehicleRows = [
      { label: 'Manufacturer', value: resolveVal(engineInfoData, 'Manufacturer Name') },
      { label: 'Chassis No.', value: resolveVal(engineInfoData, 'Chassis Number') },
      { label: 'Chassis Embossing', value: resolveVal(engineInfoData, 'Chassis Number Embossing') },
      { label: 'Engine Number', value: resolveVal(engineInfoData, 'Engine Number') },
      { label: 'Engine CC', value: resolveVal(engineInfoData, 'Engine CC') },
      { label: 'Year Of Manufacturing', value: resolveVal(engineInfoData, 'Year of Manufacturing') },
      { label: 'Car Type', value: resolveVal(engineInfoData, 'Car Type') },
      { label: 'Model Name', value: resolveVal(engineInfoData, 'Model Name') },
      { label: 'Variant Name', value: resolveVal(engineInfoData, 'Variant Name') },
      { label: 'Colour', value: resolveVal(engineInfoData, 'Colour') },
      { label: 'Paint Type', value: resolveVal(engineInfoData, 'Paint Type') },
      { label: 'Transmission', value: resolveVal(engineInfoData, 'Transmission') },
      { label: 'Emission', value: resolveVal(engineInfoData, 'Emission') },
      { label: 'Date of Registration', value: resolveVal(engineInfoData, 'Date of Registration') },
      { label: 'Odometer Reading', value: resolveVal(engineInfoData, 'Odometer Reading') },
      { label: 'Fuel Type', value: resolveVal(engineInfoData, 'Fuel Type') },
      { label: 'External CNG/LPG Fitment', value: yesNo(resolveVal(engineInfoData, 'External CNG/LPG Fitment')) },
      { label: 'No. of Owners', value: resolveVal(engineInfoData, 'No. of Owners') },
      { label: 'Duplicate Key Available', value: yesNo(resolveVal(engineInfoData, 'Duplicate Key Available')) },
      { label: 'VIN Plate Available', value: yesNo(resolveVal(engineInfoData, 'VIN Plate Available')) },
      { label: 'Jack & Toolkit Available', value: yesNo(resolveVal(engineInfoData, 'Jack & Toolkit Available')) },
      { label: 'Spare Wheel Available', value: yesNo(resolveVal(engineInfoData, 'Spare Wheel Available')) },
      { label: 'Insurance Type', value: resolveVal(engineInfoData, 'Insurance Type') },
      { label: 'Insurance Valid Upto', value: resolveVal(engineInfoData, 'Insurance Valid Upto') },
    ];
    const vehicleExtra = buildAdditionalRows(
      engineInfoData,
      new Set(vehicleRows.map(r => r.label)),
      'Vehicle',
    );

    // Step 1B is intentionally skipped per requirement (RC details omitted)

    const regRows = [
      { label: 'Registration State', value: resolveVal(regDetailsData, 'Registration State') },
      { label: 'Registration City', value: resolveVal(regDetailsData, 'Registration City') },
      { label: 'RTO NOC Issued', value: resolveVal(regDetailsData, 'RTO NOC Issued') },
      { label: 'Registration Valid', value: resolveVal(regDetailsData, 'Registration Valid') },
      { label: 'Road Tax Paid', value: resolveVal(regDetailsData, 'Road Tax Paid') },
      { label: 'Commercial Vehicle', value: yesNo(resolveVal(regDetailsData, 'Commercial Vehicle')) },
      { label: 'Under Hypothecation', value: yesNo(resolveVal(regDetailsData, 'Under Hypothecation')) },
      { label: 'RTO', value: resolveVal(regDetailsData, 'RTO') },
    ];
    const regExtra = buildAdditionalRows(
      regDetailsData,
      new Set(regRows.map(r => r.label)),
      'Registration',
    );

    const engineRows = [
      { label: 'Engine', value: yesNo(resolveVal(engineDataState, 'Engine') || resolveVal(engineDataState, 'engineWorking')) },
      { label: 'Radiator', value: yesNo(resolveVal(engineDataState, 'Radiator')) },
      { label: 'Silencer', value: yesNo(resolveVal(engineDataState, 'Silencer')) },
      { label: 'Starter Motor', value: yesNo(resolveVal(engineDataState, 'Starter Motor')) },
      { label: 'Engine Oil Level', value: yesNo(resolveVal(engineDataState, 'Engine Oil Level')) },
      { label: 'Coolant Availability', value: yesNo(resolveVal(engineDataState, 'Coolant Availability')) },
      { label: 'Engine Mounting', value: yesNo(resolveVal(engineDataState, 'Engine Mounting')) },
      { label: 'Battery', value: yesNo(resolveVal(engineDataState, 'Battery')) },
      { label: 'Engine Oil Leakage', value: yesNo(resolveVal(engineDataState, 'Engine Oil Leakage')) },
      { label: 'Coolant Oil Leakage', value: yesNo(resolveVal(engineDataState, 'Coolant Oil Leakage')) },
      { label: 'Abnormal Noise', value: yesNo(resolveVal(engineDataState, 'Abnormal Noise')) },
      { label: 'Black / White Smoke', value: yesNo(resolveVal(engineDataState, 'Black Smoke') || resolveVal(engineDataState, 'Black Smoke/White Smoke')) },
      { label: 'Defective Belts', value: yesNo(resolveVal(engineDataState, 'Defective Belts')) },
      { label: 'Highlights', value: resolveVal(engineDataState, 'Highlight Positives') },
      { label: 'Other Comments', value: resolveVal(engineDataState, 'Other Comments') },
      {
        label: 'Engine Refurbishment Cost (Total)',
        value:
          resolveVal(engineDataState, 'Refurbishment Cost (Total)') ||
          resolveVal(engineDataState, 'Engine Refurbishment Cost') ||
          resolveVal(engineDataState, 'Refurbishment Cost') ||
          resolveVal(engineDataState, 'engineCost') ||
          resolveVal(engineDataState, 'engineCostTotal'),
      },
    ];
    const engineExtra = buildAdditionalRows(
      engineDataState,
      new Set(engineRows.map(r => r.label)),
      'Engine',
    );

    const exteriorTyreCounts =
      exteriorDataState?.['Tyre Thread Count'] ||
      exteriorDataState?.tyreValues ||
      exteriorDataState?.tyres ||
      {};
    const exteriorRows: { label: string; value: any }[] = [
      { label: 'Wheel Type', value: resolveVal(exteriorDataState, 'Wheel Type') || resolveVal(exteriorDataState, 'wheelType') },
      { label: 'Refurbishment Cost (Tyre)', value: resolveVal(exteriorDataState, 'Refurbishment Cost (Tyre)') || resolveVal(exteriorDataState, 'tyreRefurbCost') },
      { label: 'Exterior Refurbishment Cost', value: resolveVal(exteriorDataState, 'Exterior Refurbishment Cost') || resolveVal(exteriorDataState, 'exteriorRefurbCost') },
      { label: 'Repaint Done', value: yesNo(resolveVal(exteriorDataState, 'Repaint Done') || resolveVal(exteriorDataState, 'repaintDone')) },
    ];
    Object.keys(exteriorTyreCounts || {}).forEach(k => {
      const v = (exteriorTyreCounts as any)[k];
      if (v) {
        exteriorRows.push({ label: `Tyre - ${k}`, value: v });
      }
    });

    const panelStates =
      exteriorDataState?.panels ||
      exteriorDataState?.Panels ||
      exteriorDataState?.panelStates ||
      {};
    Object.keys(panelStates || {}).forEach(key => {
      const st = (panelStates as any)[key];
      if (st?.status) {
        exteriorRows.push({ label: `Panel: ${key}`, value: st.status });
      }
    });

    const exteriorExtra = buildAdditionalRows(
      exteriorDataState,
      new Set(exteriorRows.map(r => r.label)),
      'Exterior',
    );

    const interiorRows: { label: string; value: any }[] = [
      { label: 'Seat Cover', value: resolveVal(interiorDataState, 'seatCover') },
      { label: 'Sun Roof', value: yesNo(resolveVal(interiorDataState, 'sunRoof')) },
      { label: 'Car Antenna', value: yesNo(resolveVal(interiorDataState, 'carAntenna')) },
      { label: 'Power Windows Count', value: resolveVal(interiorDataState, 'powerWindowsCount') },
      { label: 'Airbags Count', value: resolveVal(interiorDataState, 'airBagsCount') },
      { label: 'Power Windows Working', value: yesNo(resolveVal(interiorDataState, 'powerWindowsWorking')) },
      { label: 'Airbags Working', value: yesNo(resolveVal(interiorDataState, 'airBagsWorking')) },
      { label: 'Parking Brake', value: yesNo(resolveVal(interiorDataState, 'parkingBrake')) },
      { label: 'Horn', value: yesNo(resolveVal(interiorDataState, 'horn')) },
      { label: 'Instrument Cluster', value: yesNo(resolveVal(interiorDataState, 'instrumentCluster')) },
      { label: 'Wiper', value: yesNo(resolveVal(interiorDataState, 'wiper')) },
      { label: 'Head Lamp', value: yesNo(resolveVal(interiorDataState, 'headLamp')) },
      { label: 'Tail Lamp', value: yesNo(resolveVal(interiorDataState, 'tailLamp')) },
      { label: 'Fog Lamp', value: yesNo(resolveVal(interiorDataState, 'fogLamp')) },
      { label: 'Cabin Light', value: yesNo(resolveVal(interiorDataState, 'cabinLight')) },
      { label: 'Blinker Light', value: yesNo(resolveVal(interiorDataState, 'blinkerLight')) },
      { label: 'Seat Belts', value: yesNo(resolveVal(interiorDataState, 'seatBelts')) },
      { label: 'AC Effectiveness', value: resolveVal(interiorDataState, 'acEffectiveness') },
      { label: 'AC Grill Efficiency', value: resolveVal(interiorDataState, 'acGrillEfficiency') },
      { label: 'Climate Control AC', value: yesNo(resolveVal(interiorDataState, 'climateControlAC')) },
      { label: 'Heater', value: yesNo(resolveVal(interiorDataState, 'heater')) },
      { label: 'ORVM', value: yesNo(resolveVal(interiorDataState, 'orvm')) },
      { label: 'Steering Mounted Controls', value: yesNo(resolveVal(interiorDataState, 'steeringMounted')) },
      { label: 'ABS', value: yesNo(resolveVal(interiorDataState, 'abs')) },
      { label: 'Reverse Sensors', value: yesNo(resolveVal(interiorDataState, 'reverseSensors')) },
      { label: 'Reverse Camera', value: yesNo(resolveVal(interiorDataState, 'reverseCamera')) },
      { label: 'Keyless Locking', value: yesNo(resolveVal(interiorDataState, 'keylessLocking')) },
      { label: 'Music System', value: yesNo(resolveVal(interiorDataState, 'musicSystemWorking')) },
      { label: 'Music System Details', value: resolveVal(interiorDataState, 'musicSystemDetails') },
      { label: 'Refurbishment Cost', value: resolveVal(interiorDataState, 'refurbishmentCost') },
    ];
    const interiorExtra = buildAdditionalRows(
      interiorDataState,
      new Set(interiorRows.map(r => r.label)),
      'Interior',
    );

    const functionsSource =
      functionsDataState?.Reports ||
      functionsDataState?.reports ||
      functionsDataState ||
      {};
    const functionsProper =
      functionsSource?.proper_condition ||
      functionsSource?.properCondition ||
      functionsSource?.['proper_condition'] ||
      {};
    const functionsNoise =
      functionsSource?.['noise/leakage'] ||
      functionsSource?.noiseLeakage ||
      functionsSource?.noise ||
      {};
    const fnYesNo = (key: string, altKey?: string) =>
      yesNo(
        resolveVal(functionsProper, key) ||
          (altKey ? resolveVal(functionsProper, altKey) : '') ||
          resolveVal(functionsSource, key) ||
          (altKey ? resolveVal(functionsSource, altKey) : '') ||
          resolveVal(functionsNoise, key) ||
          (altKey ? resolveVal(functionsNoise, altKey) : ''),
      );
    const functionsRows: { label: string; value: any }[] = [
      { label: 'Steering', value: fnYesNo('Steering') },
      { label: 'Suspension', value: fnYesNo('Suspension') },
      { label: 'Brake', value: fnYesNo('Brake') },
      { label: 'Gear Shifting', value: fnYesNo('Gear Shifting') },
      { label: 'Drive Shaft / Axle', value: fnYesNo('Drive Shaft/ Axle', 'Drive Shaft') },
      { label: 'Clutch', value: fnYesNo('Clutch') },
      { label: 'Wheel Bearing Noise', value: fnYesNo('Wheel Bearing Noise') },
      { label: 'Gear Box Noise', value: fnYesNo('Gear Box Noise') },
      {
        label: 'Transmission / Differential Oil Leakage',
        value: fnYesNo('Transmission/ Differential Oil Leakage'),
      },
      { label: 'Differential Noise', value: fnYesNo('Differential Noise') },
      {
        label: 'Refurbishment Cost',
        value:
          resolveVal(functionsSource, 'Refurbishment Cost') ||
          resolveVal(functionsSource, 'refurbCost') ||
          resolveVal(functionsDataState, 'Refurbishment Cost'),
      },
      {
        label: 'Highlight Positives',
        value:
          resolveVal(functionsSource, 'Highlight Positives') ||
          resolveVal(functionsDataState, 'Highlight Positives'),
      },
      {
        label: 'Other Comments',
        value:
          resolveVal(functionsSource, 'Other Comments') ||
          resolveVal(functionsDataState, 'Other Comments'),
      },
    ];
    const functionsExtra = buildAdditionalRows(
      functionsDataState,
      new Set(functionsRows.map(r => r.label)),
      'Functions',
    );

    const frameRows: { label: string; value: any }[] = [];
    const anyDamage = framesDataState?.['Any Damage In'] || framesDataState?.anyDamageIn || framesDataState?.anyDamage;
    if (anyDamage) {
      const front = anyDamage.Front || anyDamage.front || {};
      const pillars = anyDamage.Pillars || anyDamage.pillars || {};
      const rear = anyDamage.Rear || anyDamage.rear || {};
      Object.keys(front || {}).forEach(k => frameRows.push({ label: `Front - ${k}`, value: yesNo(front[k]) }));
      Object.keys(pillars || {}).forEach(k => frameRows.push({ label: `Pillars - ${k}`, value: yesNo(pillars[k]) }));
      Object.keys(rear || {}).forEach(k => frameRows.push({ label: `Rear - ${k}`, value: yesNo(rear[k]) }));
    }
    if (framesDataState?.['Flood Affected Vehicle']) {
      frameRows.push({
        label: 'Flood Affected Vehicle',
        value: yesNo(framesDataState?.['Flood Affected Vehicle']),
      });
    }
    const frameExtra = buildAdditionalRows(
      framesDataState,
      new Set(frameRows.map(r => r.label)),
      'Frames',
    );


    const tdRows = [
      {
        label: 'Test Drive Complete',
        value:
          yesNo(
            resolveVal(testDriveDataState, 'isComplete') ||
              resolveVal(testDriveDataState, 'testDriveCompleted') ||
              resolveVal(testDriveDataState, 'Test Drive Completed'),
          ) || '',
      },
      {
        label: 'Driving Experience',
        value:
          resolveVal(testDriveDataState, 'drivingExperience') ||
          resolveVal(testDriveDataState, 'Driving Experience') ||
          resolveVal(testDriveDataState, 'Experience') ||
          drivingExperience,
      },
      {
        label: 'Problems',
        value: toDisplay(
          (() => {
            const prob =
              resolveVal(testDriveDataState, 'problems') ||
              resolveVal(testDriveDataState, 'problem') ||
              resolveVal(testDriveDataState, 'problems') ||
              resolveVal(testDriveDataState, 'problem') ||
              resolveVal(testDriveDataState, 'Problem') ||
              resolveVal(testDriveDataState, 'Specify the Problem');
            if (Array.isArray(prob)) return prob;
            if (typeof prob === 'string') return prob.split(',').map(s => s.trim());
            return prob;
          })(),
        ),
      },
      {
        label: 'Incomplete Reason',
        value:
          resolveVal(testDriveDataState, 'incompleteReason') ||
          resolveVal(testDriveDataState, 'incompleteReason') ||
          resolveVal(testDriveDataState, 'Incomplete Reason') ||
          resolveVal(testDriveDataState, 'Incomplete Test Drive') ||
          resolveVal(testDriveDataState, 'Reason'),
      },
      {
        label: 'Kms Driven',
        value:
          resolveVal(testDriveDataState, 'kmsDriven') ||
          resolveVal(testDriveDataState?.['Drive Details'] || testDriveDataState, "Km's Driven") ||
          resolveVal(testDriveDataState?.['Drive Details'] || testDriveDataState, 'Kms Driven') ||
          resolveVal(testDriveDataState?.['Drive Details'] || testDriveDataState, 'kmsDriven') ||
          resolveVal(testDriveDataState?.['Drive Details'] || testDriveDataState, 'Km Driven'),
      },
      {
        label: 'Time Taken',
        value:
          resolveVal(testDriveDataState, 'timeTaken') ||
          resolveVal(testDriveDataState?.['Drive Details'] || testDriveDataState, 'Time Taken') ||
          resolveVal(testDriveDataState?.['Drive Details'] || testDriveDataState, 'timeTaken'),
      },
      {
        label: 'Remarks',
        value:
          pickupRemark ||
          resolveVal(testDriveDataState, 'remarks') ||
          resolveVal(testDriveDataState, 'Remarks') ||
          resolveVal(testDriveDataState, 'Additional Remarks'),
      },
    ];

    const ratingRows = [
      { label: 'Evaluator Rating', value: ratingSaved ? `${rating}/5` : '' },
      { label: 'Evaluator Comment', value: ratingComment },
      { label: 'Pickup Remark', value: pickupRemark },
    ];

    const images = imagesOverride || extractImages();
    const frameImages = images.filter(img => /^frame/i.test(img.label || ''));
    const exteriorImages = images.filter(img => img.label.startsWith('Exterior'));
    const interiorImages = images.filter(img => img.label.startsWith('Interior'));
    const engineImages = images.filter(img => /^engine/i.test(img.label || ''));
    const documentImages = images.filter(img => img.label.startsWith('Document'));

    const sections = [
      `
        <div class="header">
          <div class="title">INSPECTION REPORT</div>
          <div class="meta">Evaluated By: ${escapeHtml(inspectorName || 'N/A')}</div>
          <div class="meta">Inspection Date: ${escapeHtml(formatDateLabel(inspectionDate) || '')}</div>
          <div class="meta">Reg. No.: ${escapeHtml(regNumber || '')}</div>
        </div>
      `,
      buildSection('Vehicle Details', [...vehicleRows, ...vehicleExtra]),
      buildSection('Registration Details', [...regRows, ...regExtra]) +
        buildImageGrid('Document Images', documentImages),
      buildSection('Exterior', [...exteriorRows, ...exteriorExtra]) +
        buildImageGrid('Exterior Images', exteriorImages),
      buildSection('Electrical + Interior', [...interiorRows, ...interiorExtra]) +
        buildImageGrid('Electrical + Interior Images', interiorImages),
      buildSection('Engine Inspection', [...engineRows, ...engineExtra]) +
        buildImageGrid('Engine Images', engineImages),
      buildSection('Test Drive', tdRows),
      buildSection('Functions', [...functionsRows, ...functionsExtra]),
      buildSection('Frames', [...frameRows, ...frameExtra]) +
        buildImageGrid('Frame Images', frameImages),
      buildSection('Rating & Remarks', ratingRows),
      (() => {
        const refurbSourceRaw = refurbDataState || {};
        const refurbSource =
          (refurbSourceRaw as any)?.['Total RF Cost'] &&
          typeof (refurbSourceRaw as any)['Total RF Cost'] === 'object'
            ? (refurbSourceRaw as any)['Total RF Cost']
            : refurbSourceRaw;
        const docCosts = refurbSource?.Document || refurbSource?.document || {};
        const otherCosts =
          refurbSource?.['Other Refurbishment Cost'] || refurbSource?.other || {};
        const firstNonEmpty = (...vals: any[]) => {
          for (const v of vals) {
            if (v !== undefined && v !== null && `${v}`.toString().trim() !== '') {
              return v;
            }
          }
          return '';
        };
        const refurbEstimateRows = [
          {
            label: 'Engine Refurbishment Cost',
            value: firstNonEmpty(
              resolveVal(refurbSource, 'Engine Refurbishment Cost'),
              resolveVal(engineDataState, 'Refurbishment Cost (Total)'),
              resolveVal(engineDataState, 'Refurbishment Cost'),
              resolveVal(engineDataState, 'refurbCost'),
            ),
          },
          {
            label: 'Functions Refurbishment Cost',
            value: firstNonEmpty(
              resolveVal(refurbSource, 'Functions Refurbishment Cost'),
              resolveVal(functionsSource, 'Refurbishment Cost'),
              resolveVal(functionsDataState, 'Refurbishment Cost'),
              resolveVal(functionsDataState, 'refurbCost'),
            ),
          },
          {
            label: 'Frames Refurbishment Cost',
            value: firstNonEmpty(
              resolveVal(refurbSource, 'Frames Refurbishment Cost'),
              resolveVal(framesDataState, 'Refurbishment Cost'),
              resolveVal(framesDataState, 'refurbCost'),
            ),
          },
          {
            label: 'Exterior Refurbishment Cost',
            value: firstNonEmpty(
              resolveVal(refurbSource, 'Exterior Refurbishment Cost'),
              resolveVal(exteriorDataState, 'Exterior Refurbishment Cost'),
              resolveVal(exteriorDataState, 'refurbCost'),
            ),
          },
          {
            label: 'Tyre/Wheel Refurbishment Cost',
            value: firstNonEmpty(
              resolveVal(refurbSource, 'Tyre/Wheel Refurbishment Cost'),
              resolveVal(exteriorDataState, 'Refurbishment Cost (Tyre)'),
              resolveVal(exteriorDataState, 'Refurbishment Cost - Tyre'),
              resolveVal(exteriorDataState, 'tyreRefurbCost'),
            ),
          },
          {
            label: 'Interior Refurbishment Cost',
            value: firstNonEmpty(
              resolveVal(refurbSource, 'Interior Refurbishment Cost'),
              resolveVal(interiorDataState, 'Refurbishment Cost'),
              resolveVal(interiorDataState, 'Interior Refurbishment Cost'),
              resolveVal(interiorDataState, 'refurbishmentCost'),
            ),
          },
        ];
        const documentRows = [
          { label: 'Insurance Cost', value: resolveVal(docCosts, 'Insurance Cost') },
          { label: 'Pollution Cost', value: resolveVal(docCosts, 'Pollution Cost') },
          {
            label: 'Registration/ Doc Cost',
            value: resolveVal(docCosts, 'Registration/ Doc Cost'),
          },
        ];
        const otherRows = [
          { label: 'Spare Keys', value: resolveVal(otherCosts, 'Spare Keys') },
          {
            label: 'Interior Cleaning',
            value: resolveVal(otherCosts, 'Interior Cleaning'),
          },
          {
            label: 'Accessories Repair',
            value: resolveVal(otherCosts, 'Accessories Repair'),
          },
          {
            label: 'Popular Work Demand',
            value: resolveVal(otherCosts, 'Popular Work Demand'),
          },
          {
            label: 'Rubbing & Polishing',
            value: resolveVal(otherCosts, 'Rubbing & Polishing'),
          },
        ];
        const totalRow = [
          {
            label: 'Total RF Cost',
            value: firstNonEmpty(
              resolveVal(refurbSource, 'Total RF Cost'),
              resolveVal(refurbSourceRaw, 'Total RF Cost'),
              refurbTotal,
            ),
          },
        ];
        return [
          buildSection('Refurbishment Cost Estimate', refurbEstimateRows),
          buildSection('Documents Cost', documentRows),
          buildSection('Other Refurbishment Cost', otherRows),
          buildSection('Total RF Cost', totalRow),
        ].join('');
      })(),
      buildDefectsSection(defectsDataState || [], images),
    ]
      .filter(Boolean)
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 12px; color: #111827; }
            .header { margin-bottom: 12px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 10px; background: #f9fafb; }
            .title { font-size: 18px; font-weight: 800; margin-bottom: 4px; color: #111827; }
            .meta { font-size: 12px; color: #374151; }
            .section { border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 12px; overflow: hidden; }
            .section-title { background: #f3f4f6; padding: 8px 12px; font-weight: 700; font-size: 13px; color: #111827; }
            .row { display: flex; padding: 8px 12px; border-top: 1px solid #f3f4f6; }
            .row:first-of-type { border-top: none; }
            .row-label { width: 42%; font-size: 11px; color: #6b7280; padding-right: 8px; }
            .row-value { flex: 1; font-size: 12px; font-weight: 600; color: #111827; }
            .list { padding: 10px 12px; }
            .list-item { font-size: 12px; color: #111827; margin-bottom: 6px; }
            .img-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; padding: 12px; }
            .img-card { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
            .img-card img { width: 100%; height: 180px; object-fit: cover; display: block; }
            .img-label { padding: 8px; text-align: center; font-size: 12px; font-weight: 600; color: #374151; }
            .defect-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; padding: 12px; }
            .defect-card { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.04); display: flex; flex-direction: column; }
            .defect-card img { width: 100%; height: 220px; object-fit: cover; display: block; }
            .defect-caption { padding: 10px; text-align: center; font-size: 12px; font-weight: 600; color: #374151; }
          </style>
        </head>
        <body>
          ${sections}
        </body>
      </html>
    `;
  };

  const handleGenerateEvaluation = async () => {
    if (!formattedSellCarId) return;
    if (evaluationGenerating) return;
    setEvaluationGenerating(true);
    setEvaluationError(null);
    setLastEvaluationPath(null);
    try {
      const rawImages = extractImages();
      const preparedImages = await Promise.all(
        rawImages.map(async img => {
          const uri = img.uri || '';
          const isData = uri.startsWith('data:');
          const isHttp = uri.startsWith('http');
          if (isData || isHttp) {
            return img;
          }
          try {
            const path =
              uri.startsWith('file://') || uri.startsWith('content://')
                ? uri.replace('file://', '')
                : uri;
            const b64 = await RNFS.readFile(path, 'base64');
            return {...img, uri: `data:image/jpeg;base64,${b64}`};
          } catch (err) {
            console.warn('Failed to inline image for PDF', {uri, err});
            return img;
          }
        }),
      );

      const html = buildEvaluationHtml(preparedImages);
      if (!html) {
        throw new Error('Unable to build evaluation report');
      }
      const now = new Date();
      const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
        now.getDate(),
      ).padStart(2, '0')}`;
      const fileName = `${formattedSellCarId}-${datePart}-evaluation`;
      const pdfModule: any =
        (RNHTMLtoPDF as any)?.convert ? RNHTMLtoPDF : (RNHTMLtoPDF as any)?.default;
      if (!pdfModule || typeof pdfModule.convert !== 'function') {
        throw new Error(
          'PDF module unavailable. Please rebuild the app after installing react-native-html-to-pdf.',
        );
      }
      const pdf = await pdfModule.convert({
        html,
        fileName,
        directory: 'Documents',
      });
      let savedPath = pdf.filePath || '';

      // If available, move to a public downloads location for easier access.
      const downloadDir =
        RNFS.DownloadDirectoryPath ||
        RNFS.DocumentDirectoryPath ||
        RNFS.TemporaryDirectoryPath ||
        RNFS.CachesDirectoryPath;
      const targetPath = downloadDir
        ? `${downloadDir}/${fileName}.pdf`
        : savedPath;
      if (savedPath && targetPath && savedPath !== targetPath) {
        try {
          await RNFS.moveFile(savedPath, targetPath);
          savedPath = targetPath;
        } catch {
          try {
            await RNFS.copyFile(savedPath, targetPath);
            savedPath = targetPath;
          } catch (err) {
            console.warn('Failed to move evaluation PDF, keeping original path', err);
          }
        }
      }

      setLastEvaluationPath(savedPath || null);
      Alert.alert(
        'Evaluation saved',
        savedPath
          ? `Evaluation PDF saved to:\n${savedPath}`
          : 'Evaluation PDF generated.',
      );
    } catch (err: any) {
      const msg =
        err?.message ||
        (typeof err === 'object' ? JSON.stringify(err) : String(err)) ||
        'Failed to generate evaluation PDF';
      console.error('[InspectionModules] Evaluation PDF failed', {
        message: msg,
        stack: err?.stack,
        err,
      });
      setEvaluationError(`PDF generation failed: ${msg}`);
    } finally {
      setEvaluationGenerating(false);
    }
  };

  const openSavedEvaluation = async () => {
    if (!lastEvaluationPath) return;
    const path = lastEvaluationPath;
    const fileUrl = path.startsWith('file://') ? path : `file://${path}`;
    try {
      await Share.share({
        title: 'Evaluation report',
        url: fileUrl,
        message: 'Evaluation report',
      });
    } catch (err: any) {
      Alert.alert('Open failed', err?.message || 'Unable to open the evaluation file.');
    }
  };

  const openModule = (key: string) => {
    if (!formattedSellCarId) {
      return;
    }
    if (key === 'vehicleDetails') {
      navigation.navigate('VehicleDetails', { sellCarId: formattedSellCarId });
    } else if (key === 'engine') {
      navigation.navigate('EngineInspection', { sellCarId: formattedSellCarId });
    } else if (key === 'exterior') {
      navigation.navigate('Exterior', { sellCarId: formattedSellCarId });
    } else if (key === 'electrical') {
      navigation.navigate('ElectricalInterior', { sellCarId: formattedSellCarId });
    } else if (key === 'testDrive') {
      navigation.navigate('TestDrive', { sellCarId: formattedSellCarId });
    } else if (key === 'functions') {
      navigation.navigate('FunctionsInspection', { sellCarId: formattedSellCarId });
    } else if (key === 'frames') {
      navigation.navigate('FramesInspection', { sellCarId: formattedSellCarId });
    } else if (key === 'refurbishment') {
      navigation.navigate('RefurbishmentCost', { sellCarId: formattedSellCarId });
    } else if (key === 'defective') {
      navigation.navigate('DefectiveParts', { sellCarId: formattedSellCarId });
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          android_ripple={{ color: 'rgba(0,0,0,0.08)' }}>
          <ChevronLeft size={18} color="#111827" strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.headerTitle}>Inspection</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchProgress({ isRefresh: true })}
            colors={[PRIMARY]}
            tintColor={PRIMARY}
          />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>Inspection checklist</Text>
          <Text style={styles.subtitle}>
            Pick a section to continue the inspection.
          </Text>

          {loading ? (
            <View style={styles.loaderRow}>
              <ActivityIndicator color={PRIMARY} />
              <Text style={styles.loaderText}>Loading progress...</Text>
            </View>
          ) : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {allCompleted ? (
            <View style={styles.ratingCard}>
              <View style={styles.ratingHeader}>
                <Text style={styles.ratingTitle}>Evaluator Rating</Text>
                <Text style={styles.ratingSub}>Comments optional</Text>
              </View>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(v => {
                  const active = rating >= v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => setRating(v)}
                      style={styles.starBtn}>
                      <Star
                        size={30}
                        color={active ? '#d0312d' : '#9ca3af'}
                        fill={active ? '#d0312d' : 'none'}
                        strokeWidth={1}
                      />
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.rfRow}>
                <Text style={styles.rfLabel}>Total RF Cost</Text>
                <View style={styles.rfChip}>
                  <Text style={styles.rfChipText}>Rs. {refurbTotal || '0'}</Text>
                </View>
              </View>
              <View style={styles.expRow}>
                <Text style={styles.expLabel}>Select Driving Experience</Text>
                <View style={styles.expButtons}>
                  {['Poor', 'Average', 'Good', 'Excellent'].map(opt => {
                    const active = drivingExperience === opt;
                    return (
                      <Pressable
                        key={opt}
                        style={[
                          styles.expBtn,
                          active && styles.expBtnActive,
                        ]}
                        onPress={() => setDrivingExperience(opt)}>
                        <Text
                          style={[
                            styles.expBtnText,
                            active && styles.expBtnTextActive,
                          ]}>
                          {opt}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <TextInput
                style={styles.commentInput}
                value={ratingComment}
                onChangeText={setRatingComment}
                placeholder="Leave a comment..."
                placeholderTextColor="#9ca3af"
                multiline
              />
              <TextInput
                style={[styles.commentInput, { marginTop: 8 }]}
                value={pickupRemark}
                onChangeText={setPickupRemark}
                placeholder="Pickup remark..."
                placeholderTextColor="#9ca3af"
                multiline
              />
              <View style={styles.actionRow}>
                <Pressable
                  disabled={
                    evaluationGenerating ||
                    ratingSubmitting ||
                    reportDownloading ||
                    !ratingSaved
                  }
                  style={[
                    styles.evaluationBtn,
                    (!ratingSaved || evaluationGenerating || ratingSubmitting || reportDownloading) &&
                      styles.evaluationBtnDisabled,
                  ]}
                  onPress={handleGenerateEvaluation}>
                  <Text style={styles.evaluationBtnText}>
                    {evaluationGenerating ? 'Building...' : 'Evaluation'}
                  </Text>
                </Pressable>

                <Pressable
                  disabled={
                    ratingSubmitting ||
                    reportDownloading ||
                    rating <= 0 ||
                    !drivingExperience
                  }
                  style={[
                    styles.ratingSaveBtn,
                    ratingSaved && styles.ratingSaveBtnSuccess,
                    (ratingSubmitting ||
                      reportDownloading ||
                      rating <= 0 ||
                      !drivingExperience) &&
                      styles.ratingSaveBtnDisabled,
                  ]}
                  onPress={ratingSaved ? handleDownloadReport : handleSaveRating}>
                  {ratingSaved ? (
                    <View style={styles.ratingSaveInner}>
                      <View style={styles.ratingSaveIconOnly}>
                        <FileText size={20} color={PRIMARY} strokeWidth={2.2} />
                      </View>
                      <Text style={styles.ratingSaveLabel}>
                        {reportDownloading ? 'Preparing...' : 'Download Report'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.ratingSaveIconOnly}>
                      <Check size={20} color={PRIMARY} strokeWidth={4} />
                    </View>
                  )}
                </Pressable>
              </View>

              {evaluationError ? (
                <View style={styles.statusRow}>
                  <Text style={styles.statusError}>
                    {evaluationError.length > 80
                      ? `${evaluationError.slice(0, 80)}...`
                      : evaluationError}
                  </Text>
                  <Pressable
                    style={styles.statusRetry}
                    onPress={handleGenerateEvaluation}
                    disabled={evaluationGenerating}>
                    <Text style={styles.statusRetryText}>
                      {evaluationGenerating ? 'Retrying...' : 'Retry'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              {lastEvaluationPath ? (
                <View style={styles.statusRow}>
                  <Text style={styles.statusSuccess}>
                    Evaluation: {lastEvaluationPath}
                  </Text>
                  <Pressable style={styles.statusRetry} onPress={openSavedEvaluation}>
                    <Text style={styles.statusRetryText}>Open / Export</Text>
                  </Pressable>
                </View>
              ) : null}

              {reportError ? (
                <View style={styles.statusRow}>
                  <Text style={styles.statusError}>
                    {reportError.length > 80 ? `${reportError.slice(0, 80)}...` : reportError}
                  </Text>
                  <Pressable
                    style={styles.statusRetry}
                    onPress={handleDownloadReport}
                    disabled={reportDownloading}>
                    <Text style={styles.statusRetryText}>
                      {reportDownloading ? 'Retrying...' : 'Retry'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              {lastDownloadPath ? (
                <View style={styles.statusRow}>
                  <Text style={styles.statusSuccess}>
                    Saved to: {lastDownloadPath}
                  </Text>
                  <Pressable style={styles.statusRetry} onPress={openSavedReport}>
                    <Text style={styles.statusRetryText}>Open / Export</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.list}>
            {modules.map(item => {
              const Icon = item.icon;
              const disabled = !item.enabled;
              const progress = progressMap[item.key] || {
                pct: 0,
                requiredLeft: -1,
                optionalLeft: -1,
                hasExplicitCounts: false,
              };
              const { pct, requiredLeft, optionalLeft, hasExplicitCounts } =
                progress;
              const isOptionalModule = item.key === 'vehicleDetails';
              const isRefurbishment = item.key === 'refurbishment';
              const refurbOptionalLeft =
                isRefurbishment && optionalLeft >= 0 ? optionalLeft : 8;
              const isDefective = item.key === 'defective';
              const defectCount =
                isDefective && optionalLeft >= 0 ? optionalLeft : 0;
              const completedAllFields =
                (isRefurbishment && refurbOptionalLeft === 0) ||
                (isDefective && defectCount > 0) ||
                (pct >= 100 &&
                  ((hasExplicitCounts &&
                    requiredLeft === 0 &&
                    optionalLeft === 0) ||
                    (!hasExplicitCounts && pct >= 100)));
              const hintLabel = (() => {
                if (isRefurbishment) {
                  if (refurbOptionalLeft === 0) return 'Completed';
                  return `${refurbOptionalLeft} optional field${refurbOptionalLeft === 1 ? '' : 's'} left`;
                }
                if (isDefective) {
                  return `${defectCount} defective piece${defectCount === 1 ? '' : 's'}`;
                }
                if (completedAllFields) {
                  return 'Completed';
                }
                return 'Required fields';
              })();
              const hintStyle =
                (isRefurbishment && refurbOptionalLeft > 0) ||
                  (isDefective && defectCount === 0) ||
                  !completedAllFields
                  ? styles.progressHint
                  : styles.progressComplete;
              return (
                <Pressable
                  key={item.key}
                  style={[
                    styles.listItem,
                    disabled && styles.listItemDisabled,
                  ]}
                  disabled={disabled || !formattedSellCarId}
                  onPress={() => openModule(item.key)}>
                  <View
                    style={[
                      styles.iconWrap,
                      !disabled && styles.iconWrapActive,
                    ]}>
                    <Icon
                      size={20}
                      color={disabled ? '#9ca3af' : PRIMARY}
                      strokeWidth={2.3}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.itemLabel,
                        disabled && styles.itemLabelDisabled,
                      ]}>
                      {item.label}
                    </Text>
                    {!isDefective ? (
                      isRefurbishment ? (
                        <Text style={styles.commentText}>
                          Add refurbishment costs and documents when available.
                        </Text>
                      ) : (
                        <View>
                          <View style={styles.progressBar}>
                            <View
                              style={[
                                styles.progressFill,
                                {
                                  width: `${pct}%`,
                                  backgroundColor: disabled ? '#e5e7eb' : PRIMARY,
                                },
                              ]}
                            />
                          </View>
                          <View style={styles.progressValueRow}>
                            <Text style={styles.progressValue}>{`${pct}%`}</Text>
                            <Text style={hintStyle}>{hintLabel}</Text>
                          </View>
                        </View>
                      )
                    ) : (
                      <View style={styles.progressValueRow}>
                        <Text style={styles.progressComplete}>{hintLabel}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default InspectionModulesScreen;

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
    flexGrow: 1,
    elevation: 1,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 10 },
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
  list: {
    marginTop: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    marginTop: 10,
    gap: 12,
  },
  listItemDisabled: {
    opacity: 0.6,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: PRIMARY + '15',
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  itemLabelDisabled: {
    color: '#6b7280',
  },
  progressBar: {
    marginTop: 6,
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    width: '0%',
    height: '100%',
    backgroundColor: PRIMARY,
  },
  progressValue: {
    marginTop: 4,
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '700',
    flexWrap: 'wrap',
  },
  progressValueRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  progressHint: {
    fontSize: 10,
    color: '#c99700',
    fontWeight: '700',
  },
  progressComplete: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '700',
  },
  progressOptional: {
    fontSize: 10,
    color: '#c99700',
    fontWeight: '700',
  },
  commentText: {
    marginTop: 6,
    fontSize: 12,
    color: '#6b7280',
  },
  chevron: {
    fontSize: 20,
    color: '#9ca3af',
    fontWeight: '700',
  },
  loaderRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loaderText: {
    fontSize: 12,
    color: '#6b7280',
  },
  errorText: {
    marginTop: 8,
    color: '#b91c1c',
    fontSize: 12,
  },
  ratingCard: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  ratingSub: {
    fontSize: 12,
    color: '#6b7280',
  },
  starsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 5,
  },
  starBtn: {
    width: 34,
    height: 34,
    // borderRadius: 10,
    // borderWidth: 1,
    // borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  starText: {
    fontSize: 18,
    color: '#d1d5db',
  },
  starTextActive: {
    color: '#f59e0b',
  },
  rfRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rfLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  rfChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#b91c1c',
  },
  rfChipText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  expRow: {
    marginTop: 14,
  },
  expLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  expButtons: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  expBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  expBtnActive: {
    borderColor: '#d0312d',
    backgroundColor: '#d0312d15',
  },
  expBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  expBtnTextActive: {
    color: '#d0312d',
  },
  commentInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  evaluationBtn: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PRIMARY,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  evaluationBtnDisabled: {
    opacity: 0.5,
  },
  evaluationBtnText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '700',
  },
  ratingSaveBtn: {
    marginTop: 0,
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: PRIMARY + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingSaveBtnSuccess: {
    backgroundColor: PRIMARY + '26',
  },
  ratingSaveBtnDisabled: {
    opacity: 0.5,
  },
  ratingSaveIconOnly: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingSaveInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingSaveLabel: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '700',
  },
  statusRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusError: {
    color: '#b91c1c',
    fontSize: 12,
    flexShrink: 1,
  },
  statusSuccess: {
    color: '#059669',
    fontSize: 12,
    flexShrink: 1,
  },
  statusRetry: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#111827',
  },
  statusRetryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
