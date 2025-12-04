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
        inspectionData?.['Test Drive'];
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
              <Pressable
                disabled={rating <= 0 || !drivingExperience}
                style={[
                  styles.ratingSaveBtn,
                  ratingSaved && styles.ratingSaveBtnSuccess,
                  (rating <= 0 || !drivingExperience) && styles.ratingSaveBtnDisabled,
                ]}
                onPress={() => {
                  if (rating <= 0 || !drivingExperience) return;
                  setRatingSaved(true);
                }}>
                {ratingSaved ? (
                  <View style={styles.ratingSaveInner}>
                    <View style={styles.ratingSaveIconOnly}>
                      <FileText size={20} color={PRIMARY} strokeWidth={2.2} />
                    </View>
                    <Text style={styles.ratingSaveLabel}>Download Report</Text>
                  </View>
                ) : (
                  <View style={styles.ratingSaveIconOnly}>
                    <Check size={20} color={PRIMARY} strokeWidth={4} />
                  </View>
                )}
              </Pressable>
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
  ratingSaveBtn: {
    marginTop: 10,
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
  ratingSaveText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
