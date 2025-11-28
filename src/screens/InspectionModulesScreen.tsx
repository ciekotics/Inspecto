import React, {useEffect, useState} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
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
} from 'lucide-react-native';
import {PRIMARY} from '../utils/theme';
import {client} from '../utils/apiClient';
import {loadDraft} from '../utils/draftStorage';

type RouteParams = {
  sellCarId?: string | number;
};

const modules = [
  {key: 'vehicleDetails', label: 'Vehicle Details', icon: Car, enabled: true},
  {key: 'exterior', label: 'Exterior', icon: DoorClosed, enabled: true},
  {
    key: 'electrical',
    label: 'Electrical + Interior',
    icon: Cpu,
    enabled: true,
  },
  {key: 'testDrive', label: 'Test Drive', icon: Gauge, enabled: true},
  {key: 'engine', label: 'Engine', icon: Wrench, enabled: true},
  {key: 'functions', label: 'Functions', icon: Workflow, enabled: true},
  {key: 'frames', label: 'Frames', icon: Settings, enabled: true},
  {
    key: 'refurbishment',
    label: 'Refurbishment Cost',
    icon: BadgeIndianRupee,
    enabled: true,
  },
  {key: 'defective', label: 'Defective parts', icon: AlertTriangle, enabled: true},
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
  const {sellCarId} = (route.params as RouteParams) || {};
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
  const [refurbTotal, setRefurbTotal] = useState('0');

  const fetchProgress = async (opts?: {isRefresh?: boolean}) => {
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
      const [vehicleRes, inspectionRes, refurbRes, defectsRes] = await Promise.all([
        client.get('/api/view-vehicle-details-inspection', {
          params: {sellCarId: formattedSellCarId},
        }),
        client.get('/api/view-inspection', {
          params: {sellCarId: formattedSellCarId},
        }),
        client
          .get('/api/view-refurbishment-cost', {
            params: {sellCarId: formattedSellCarId},
          })
          .catch(err => {
            console.warn('Failed to fetch refurbishment cost', err);
            return null;
          }),
        client
          .get('/api/view-defects-inspection', {
            params: {sellCarId: formattedSellCarId},
          })
          .catch(err => {
            console.warn('Failed to fetch defects', err);
            return null;
          }),
      ]);

      const nextProgress: Record<string, ModuleProgress> = {};

      // Vehicle details progress (field level)
      const engineInfo: Record<string, any> | null =
        vehicleRes.data?.data?.vehicleDetails?.vehicleDetails?.['Engine Info'] ||
        vehicleRes.data?.data?.vehicleDetails?.vehicleDetails?.engineInfo ||
        vehicleRes.data?.data?.EngineInfo ||
        vehicleRes.data?.data?.engineInfo ||
        vehicleRes.data?.data?.['Engine Info'] ||
        null;

      if (engineInfo && typeof engineInfo === 'object') {
        const requiredKeys = [
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
        const optionalKeys = ['Insurance IDV Value'];

        const hasValue = (v: any) => {
          if (v == null) {
            return false;
          }
          if (typeof v === 'string') {
            return v.trim() !== '';
          }
          return true;
        };

        const filled = requiredKeys.filter(k => hasValue(engineInfo[k])).length;
        const requiredLeft = requiredKeys.filter(k => !hasValue(engineInfo[k]))
          .length;
        const optionalLeft = optionalKeys.filter(k => !hasValue(engineInfo[k]))
          .length;
        const total = requiredKeys.length;
        nextProgress.vehicleDetails = {
          pct: Math.min(100, Math.round((filled / total) * 100)),
          requiredLeft,
          optionalLeft,
          hasExplicitCounts: true,
        };
      }

      // Module-level completion flags from inspection API
      const completed: Record<string, boolean> =
        inspectionRes.data?.data?.allInspections?.[0]?.completed || {};
      const refurbData =
        refurbRes?.data?.data?.refurbishmentCost?.['Total RF Cost'] || null;
      const functionsData =
        inspectionRes.data?.data?.allInspections?.[0]?.functions ||
        inspectionRes.data?.data?.allInspections?.[0]?.Functions ||
        inspectionRes.data?.data?.functions ||
        inspectionRes.data?.functions;
      const framesData =
        inspectionRes.data?.data?.allInspections?.[0]?.frames ||
        inspectionRes.data?.data?.frames ||
        inspectionRes.data?.frames;
      const defectsData =
        defectsRes?.data?.data?.DefectsReport?.Reports?.Report || [];
      const moduleKeyMap: {api: string; ui: string}[] = [
        {api: 'exterior', ui: 'exterior'},
        {api: 'interior', ui: 'electrical'},
        {api: 'testDrive', ui: 'testDrive'},
        {api: 'engine', ui: 'engine'},
        {api: 'functions', ui: 'functions'},
        {api: 'frames', ui: 'frames'},
        {api: 'refurbishmentCost', ui: 'refurbishment'},
        {api: 'defective', ui: 'defective'},
      ];
      moduleKeyMap.forEach(({api, ui}) => {
        const isDone = !!completed[api];
        nextProgress[ui] = {
          pct: isDone ? 100 : 0,
          requiredLeft: isDone ? 0 : -1,
          optionalLeft: -1,
          hasExplicitCounts: false,
        };
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
      try {
        const functionsDraft = loadDraft<any>(formattedSellCarId, 'functions');
        const computeFunctionsPct = (src: any) => {
          const required = 10;
          const proper =
            src?.proper_condition ||
            src?.properCondition ||
            src?.['proper_condition'] ||
            {};
          const noise =
            src?.['noise/leakage'] ||
            src?.noiseLeakage ||
            src?.noise ||
            {};
          const toggles = [
            src?.steering || proper?.Steering,
            src?.suspension || proper?.Suspension,
            src?.brake || proper?.Brake,
            src?.gearShifting || proper?.['Gear Shifting'],
            src?.driveShaft || proper?.['Drive Shaft/ Axle'] || proper?.['Drive Shaft'],
            src?.clutch || proper?.Clutch,
            src?.wheelBearingNoise || noise?.['Wheel Bearing Noise'],
            src?.gearBoxNoise || noise?.['Gear Box Noise'],
            src?.transmissionLeakage ||
              noise?.['Transmission/ Differential Oil Leakage'],
            src?.differentialNoise || noise?.['Differential Noise'],
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
          const isComplete = !!tdDraft.isComplete;
          const required = isComplete ? 4 : 3;
          let filled = 0;
          if (tdDraft.drivingExperience) filled += 1;
          if (tdDraft.problem) filled += 1;
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
        if (refurbData) {
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

      setProgressMap(nextProgress);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load progress',
      );
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

  useEffect(() => {
    const keys = modules.map(m => m.key);
    const done = keys.every(k => {
      const prog = progressMap[k];
      if (!prog) return false;
      if (k === 'refurbishment') {
        return prog.optionalLeft === 0;
      }
      if (k === 'defective') {
        return prog.optionalLeft > 0 || prog.pct >= 100;
      }
      return prog.pct >= 100;
    });
    setAllCompleted(done);
  }, [progressMap]);

  const openModule = (key: string) => {
    if (!formattedSellCarId) {
      return;
    }
    if (key === 'vehicleDetails') {
      navigation.navigate('VehicleDetails', {sellCarId: formattedSellCarId});
    } else if (key === 'engine') {
      navigation.navigate('EngineInspection', {sellCarId: formattedSellCarId});
    } else if (key === 'exterior') {
      navigation.navigate('Exterior', {sellCarId: formattedSellCarId});
    } else if (key === 'electrical') {
      navigation.navigate('ElectricalInterior', {sellCarId: formattedSellCarId});
    } else if (key === 'testDrive') {
      navigation.navigate('TestDrive', {sellCarId: formattedSellCarId});
    } else if (key === 'functions') {
      navigation.navigate('FunctionsInspection', {sellCarId: formattedSellCarId});
    } else if (key === 'frames') {
      navigation.navigate('FramesInspection', {sellCarId: formattedSellCarId});
    } else if (key === 'refurbishment') {
      navigation.navigate('RefurbishmentCost', {sellCarId: formattedSellCarId});
    } else if (key === 'defective') {
      navigation.navigate('DefectiveParts', {sellCarId: formattedSellCarId});
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
        <Text style={styles.headerTitle}>Inspection</Text>
        <View style={{width: 32}} />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchProgress({isRefresh: true})}
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
                      <Text style={[styles.starText, active && styles.starTextActive]}>
                        ★
                      </Text>
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
              <TextInput
                style={styles.commentInput}
                value={ratingComment}
                onChangeText={setRatingComment}
                placeholder="Leave a comment..."
                placeholderTextColor="#9ca3af"
                multiline
              />
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
              const {pct, requiredLeft, optionalLeft, hasExplicitCounts} =
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
                const requiredText =
                  hasExplicitCounts && requiredLeft > 0
                    ? `${requiredLeft} required ${requiredLeft === 1 ? 'field' : 'fields'} left`
                    : null;
                const optionalText =
                  hasExplicitCounts && optionalLeft > 0
                    ? `${optionalLeft} optional ${optionalLeft === 1 ? 'field' : 'fields'} left`
                    : null;
                if (requiredText && optionalText) {
                  return `${requiredText}, ${optionalText}`;
                }
                return (
                  requiredText ||
                  optionalText ||
                  (isOptionalModule ? 'Optional fields' : 'Required fields')
                );
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
                  <View style={{flex: 1}}>
                    <Text
                      style={[
                        styles.itemLabel,
                        disabled && styles.itemLabelDisabled,
                      ]}>
                      {item.label}
                    </Text>
                    {!isDefective ? (
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
                          {!isRefurbishment ? (
                            <Text style={styles.progressValue}>{`${pct}%`}</Text>
                          ) : null}
                          <Text style={hintStyle}>{hintLabel}</Text>
                        </View>
                      </View>
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
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowOffset: {width: 0, height: 6},
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
    gap: 8,
  },
  starBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
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
});
