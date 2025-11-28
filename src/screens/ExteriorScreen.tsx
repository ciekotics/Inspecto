import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  Animated,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {ChevronLeft, Camera, Check, Eye, Image as ImageIcon, X} from 'lucide-react-native';
import {
  launchImageLibrary,
  launchCamera,
  ImagePickerResponse,
} from 'react-native-image-picker';
import {PRIMARY} from '../utils/theme';
import {Modal} from 'react-native';
import {AlertTriangle, CheckCircle, MinusCircle} from 'lucide-react-native';
import {
  PinchGestureHandler,
  TapGestureHandler,
  State,
} from 'react-native-gesture-handler';
import {client} from '../utils/apiClient';
import {loadDraft, saveDraft} from '../utils/draftStorage';

type RouteParams = {
  sellCarId?: string | number;
};

type ScratchStatus = 'Minor Scratch' | 'Major Scratch' | 'No Scratch' | '';
type TyreValue =
  | 'Bad (<2mm)'
  | 'Average (2-6mm)'
  | 'Good (6-8mm)'
  | 'Excellent (>8mm)'
  | '';
type WheelType = 'Alloys' | 'Normal Rim' | '';
type YesNo = 'Yes' | 'No' | '';

type PanelState = {
  photoUri: string | null;
  status: ScratchStatus;
};

const SCRATCH_META: Record<
  ScratchStatus,
  {icon: React.ComponentType<any>; color: string}
> = {
  'Minor Scratch': {icon: MinusCircle, color: '#2563eb'},
  'Major Scratch': {icon: AlertTriangle, color: '#b91c1c'},
  'No Scratch': {icon: CheckCircle, color: '#059669'},
  '': {icon: MinusCircle, color: '#6b7280'},
};

const SCRATCH_OPTIONS: ScratchStatus[] = [
  'Minor Scratch',
  'Major Scratch',
  'No Scratch',
];

const PANELS = [
  'Bonnet & Front Windshield',
  'Front Bumper',
  'Left Front Edge',
  'Roof Front',
  'Left Front',
  'Left Rear',
  'Left Rear Edge',
  'Rear Bumper',
  'Tailgate & Rear Windshield',
  'Right Rear Edge',
  'Roof Rear',
  'Right Rear',
  'Right Front',
  'Right Front Edge',
] as const;

const TYRE_POSITIONS = [
  'Front Right',
  'Front Left',
  'Rear Right',
  'Rear Left',
  'Spare',
] as const;

const TYRE_OPTIONS: TyreValue[] = [
  'Bad (<2mm)',
  'Average (2-6mm)',
  'Good (6-8mm)',
  'Excellent (>8mm)',
];

const ExteriorScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const {sellCarId} = (route.params as RouteParams) || {};
  const formattedSellCarId =
    sellCarId == null ? '' : String(sellCarId).trim();

  const initialPanels = useMemo(() => {
    const obj: Record<string, PanelState> = {};
    PANELS.forEach(key => {
      obj[key] = {photoUri: null, status: ''};
    });
    return obj;
  }, []);

  const [panelStates, setPanelStates] =
    useState<Record<string, PanelState>>(initialPanels);
  const [tyreValues, setTyreValues] = useState<Record<string, TyreValue>>(() => {
    const obj: Record<string, TyreValue> = {};
    TYRE_POSITIONS.forEach(pos => {
      obj[pos] = '';
    });
    return obj;
  });
  const [wheelType, setWheelType] = useState<WheelType>('');
  const [tyreRefurbCost, setTyreRefurbCost] = useState('');
  const [exteriorRefurbCost, setExteriorRefurbCost] = useState('');
  const [repaintDone, setRepaintDone] = useState<YesNo>('');
  const [pickerVisible, setPickerVisible] = useState<{
    open: boolean;
    panelKey: string | null;
  }>({open: false, panelKey: null});
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const pinchScale = useRef(new Animated.Value(1)).current;
  const baseScale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const combinedScale = Animated.multiply(baseScale, pinchScale);
  const doubleTapRef = useRef<TapGestureHandler | null>(null);

  const requiredFields = useMemo(() => {
    const base = [
      ...TYRE_POSITIONS.map(pos => ({key: `tyre-${pos}`})),
      {key: 'wheelType'},
      {key: 'tyreRefurbCost'},
      {key: 'exteriorRefurbCost'},
      {key: 'repaintDone'},
    ];
    const panelKeys = PANELS.map(panel => ({key: `panel-${panel}`}));
    return [...base, ...panelKeys];
  }, []);

  const filledCount = useMemo(() => {
    let count = 0;
    TYRE_POSITIONS.forEach(pos => {
      if (tyreValues[pos]) {
        count += 1;
      }
    });
    if (wheelType) count += 1;
    if (tyreRefurbCost) count += 1;
    if (exteriorRefurbCost) count += 1;
    if (repaintDone) count += 1;
    PANELS.forEach(panel => {
      const state = panelStates[panel];
      if (state?.photoUri && state?.status) {
        count += 1;
      }
    });
    return count;
  }, [
    tyreValues,
    wheelType,
    tyreRefurbCost,
    exteriorRefurbCost,
    repaintDone,
    panelStates,
  ]);

  const handlePick = async (mode: 'camera' | 'library') => {
    const key = pickerVisible.panelKey;
    if (!key) return;
    const resp: ImagePickerResponse =
      mode === 'camera'
        ? await launchCamera({mediaType: 'photo', quality: 0.8})
        : await launchImageLibrary({mediaType: 'photo', quality: 0.8});
    if (resp.didCancel || !resp.assets || resp.assets.length === 0) {
      setPickerVisible({open: false, panelKey: null});
      return;
    }
    const uri = resp.assets[0]?.uri;
    if (uri) {
      setPanelStates(prev => ({
        ...prev,
        [key]: {...prev[key], photoUri: uri},
      }));
    }
    setPickerVisible({open: false, panelKey: null});
  };

  const setPanelStatus = (panelKey: string, status: ScratchStatus) => {
    setPanelStates(prev => ({
      ...prev,
      [panelKey]: {...prev[panelKey], status},
    }));
  };

  const resetAll = () => {
    setPanelStates(initialPanels);
    setTyreValues(() => {
      const obj: Record<string, TyreValue> = {};
      TYRE_POSITIONS.forEach(pos => {
        obj[pos] = '';
      });
      return obj;
    });
    setWheelType('');
    setTyreRefurbCost('');
    setExteriorRefurbCost('');
    setRepaintDone('');
  };

  const renderScratchOptions = (panelKey: string) => {
    const current = panelStates[panelKey]?.status || '';
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scratchScroll}
        contentContainerStyle={styles.scratchColumn}>
        {SCRATCH_OPTIONS.map(opt => {
          const active = current === opt;
          const meta = SCRATCH_META[opt];
          const Icon = meta.icon;
          const tint = meta.color;
          return (
            <Pressable
              key={opt}
              onPress={() => setPanelStatus(panelKey, opt)}
              style={[
                styles.scratchPill,
                active
                  ? [
                      styles.scratchPillActive,
                      {borderColor: tint, backgroundColor: tint + '12'},
                    ]
                  : styles.scratchPillInactive,
              ]}>
              <Icon
                size={14}
                color={active ? tint : '#6b7280'}
                strokeWidth={2.4}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    );
  };

  const renderTyrePicker = (position: string) => {
    const current = tyreValues[position] || '';
    return (
      <View key={position} style={styles.selectCard}>
        <View style={{flex: 1}}>
          <Text style={styles.selectLabel}>{position} *</Text>
          <Text style={styles.selectValue}>
            {current || 'Select value'}
          </Text>
        </View>
        <View style={styles.tyreOptionsWrap}>
          {TYRE_OPTIONS.map(opt => {
            const active = current === opt;
            return (
              <Pressable
                key={opt}
                onPress={() =>
                  setTyreValues(prev => ({...prev, [position]: opt}))
                }
                style={[
                  styles.tyreOption,
                  active && styles.tyreOptionActive,
                ]}>
                {active ? (
                  <Check size={14} color="#fff" strokeWidth={2.5} />
                ) : null}
                <Text
                  style={[
                    styles.tyreOptionText,
                    active && styles.tyreOptionTextActive,
                  ]}>
                  {opt}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  useEffect(() => {
    let cancelled = false;
    const normalizeScratch = (val: any): ScratchStatus => {
      const v = (val || '').toString().trim().toLowerCase();
      if (!v) {
        return '';
      }
      if (v.includes('minor')) {
        return 'Minor Scratch';
      }
      if (v.includes('major')) {
        return 'Major Scratch';
      }
      if (v.includes('no')) {
        return 'No Scratch';
      }
      return '';
    };

    const normalizeTyre = (val: any): TyreValue => {
      const v = (val || '').toString().trim().toLowerCase();
      if (!v) {
        return '';
      }
      if (v.startsWith('bad')) {
        return 'Bad (<2mm)';
      }
      if (v.startsWith('average')) {
        return 'Average (2-6mm)';
      }
      if (v.startsWith('good')) {
        return 'Good (6-8mm)';
      }
      if (v.startsWith('excellent') || v.startsWith('great') || v.startsWith('ok')) {
        return 'Excellent (>8mm)';
      }
      return '';
    };

    const normalizeWheelType = (val: any): WheelType => {
      const v = (val || '').toString().trim().toLowerCase();
      if (!v) {
        return '';
      }
      if (v.includes('alloy')) {
        return 'Alloys';
      }
      if (v.includes('rim') || v.includes('steel') || v.includes('normal')) {
        return 'Normal Rim';
      }
      return '';
    };

    const normalizeYesNo = (val: any): YesNo => {
      const v = (val || '').toString().trim().toLowerCase();
      if (v === 'yes' || v === 'y' || v === 'true' || v === '1') {
        return 'Yes';
      }
      if (v === 'no' || v === 'n' || v === 'false' || v === '0') {
        return 'No';
      }
      return '';
    };

    const hydrateDraft = async () => {
      if (!formattedSellCarId) return;
      const draft = loadDraft<any>(formattedSellCarId, 'exterior');
      if (draft && !cancelled) {
        if (Array.isArray(draft.items)) {
          setPanelStates(prev => {
            const next = {...prev};
            PANELS.forEach(panel => {
              const stored = draft.panels?.[panel] || draft[panel] || {};
              if (stored.photoUri || stored.status) {
                next[panel] = {
                  photoUri: stored.photoUri || null,
                  status: stored.status || '',
                };
              }
            });
            return next;
          });
        }
        if (draft.tyreValues) setTyreValues(draft.tyreValues);
        if (draft.wheelType) setWheelType(draft.wheelType);
        if (draft.tyreRefurbCost) setTyreRefurbCost(draft.tyreRefurbCost);
        if (draft.exteriorRefurbCost)
          setExteriorRefurbCost(draft.exteriorRefurbCost);
        if (draft.repaintDone) setRepaintDone(draft.repaintDone);
      }
    };

    const fetchExisting = async () => {
      if (!formattedSellCarId) {
        return;
      }
      setPrefillLoading(true);
      try {
        await hydrateDraft();
        const res = await client.get('/api/view-inspection', {
          params: {sellCarId: formattedSellCarId},
        });
        if (cancelled) {
          return;
        }
        const existing = res.data?.data?.allInspections?.[0];
        const exteriorData =
          existing?.exterior || existing?.Exterior || existing?.ExteriorInspection;
        if (!exteriorData || typeof exteriorData !== 'object') {
          return;
        }
        setPanelStates(prev => {
          const next = {...prev};
          PANELS.forEach(panel => {
            const panelInfo: any = exteriorData[panel];
            const photoUri =
              panelInfo?.image || panelInfo?.photo || panelInfo?.photoUri || null;
            const status = normalizeScratch(
              panelInfo?.scratch || panelInfo?.status || panelInfo?.condition,
            );
            if ((photoUri || status) && next[panel]) {
              next[panel] = {
                photoUri: photoUri || next[panel].photoUri,
                status: status || next[panel].status,
              };
            }
          });
          return next;
        });

        const tyresSource: Record<string, any> =
          exteriorData.tyres ||
          exteriorData.Tyres ||
          exteriorData.tyreThreadCount ||
          exteriorData.TyreThreadCount ||
          exteriorData['Tyre Thread Count'] ||
          exteriorData['tyre thread count'] ||
          exteriorData.tyre ||
          {};
        setTyreValues(prev => {
          const next = {...prev};
          TYRE_POSITIONS.forEach(pos => {
            const raw =
              tyresSource[pos] ||
              tyresSource[pos.replace(/\s+/g, '')] ||
              tyresSource[pos.toLowerCase()];
            const normalized = normalizeTyre(
              raw?.value || raw?.status || raw?.condition || raw,
            );
            if (normalized) {
              next[pos] = normalized;
            }
          });
          return next;
        });

        const wheel =
          exteriorData.wheelType ||
          exteriorData.WheelType ||
          exteriorData['Wheel Type'] ||
          exteriorData.wheels ||
          exteriorData.wheel ||
          existing?.wheelType ||
          existing?.['Wheel Type'] ||
          '';
        const normalizedWheel = normalizeWheelType(wheel);
        if (normalizedWheel) {
          setWheelType(normalizedWheel);
        }

        const tyreCost =
          exteriorData.tyreRefurbCost ||
          exteriorData.TyreRefurbCost ||
          exteriorData.tyreCost ||
          exteriorData.tyreRefurbishmentCost ||
          exteriorData['Refurbishment Cost (Tyre)'] ||
          exteriorData['Refurbishment Cost - Tyre'] ||
          '';
        if (tyreCost != null && String(tyreCost).trim() !== '') {
          setTyreRefurbCost(String(tyreCost));
        }

        const extCost =
          exteriorData.exteriorRefurbCost ||
          exteriorData.ExteriorRefurbCost ||
          exteriorData.refurbishmentCostExterior ||
          exteriorData.exteriorCost ||
          exteriorData['Exterior Refurbishment Cost'] ||
          '';
        if (extCost != null && String(extCost).trim() !== '') {
          setExteriorRefurbCost(String(extCost));
        }

        const repaint =
          exteriorData.repaintDone ||
          exteriorData.RepaintDone ||
          exteriorData.repaint ||
          exteriorData.paint ||
          exteriorData['Repaint Done'] ||
          '';
        const normalizedRepaint = normalizeYesNo(repaint);
        if (normalizedRepaint) {
          setRepaintDone(normalizedRepaint);
        }
      } catch (err) {
        // Silent fail as requested; console warn for debugging.
        console.warn('Failed to prefill exterior', err);
      } finally {
        if (!cancelled) {
          setPrefillLoading(false);
        }
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
      panels: panelStates,
      tyreValues,
      wheelType,
      tyreRefurbCost,
      exteriorRefurbCost,
      repaintDone,
    };
    saveDraft(formattedSellCarId, 'exterior', payload);
  }, [
    formattedSellCarId,
    panelStates,
    tyreValues,
    wheelType,
    tyreRefurbCost,
    exteriorRefurbCost,
    repaintDone,
  ]);

  const renderSkeleton = () => (
    <View style={styles.card}>
      <View style={[styles.skeletonBlock, {width: 140, height: 16}]} />
      <View style={[styles.skeletonBlock, {width: '80%', height: 12, marginTop: 8}]} />
      <View style={[styles.skeletonRow, {marginTop: 16}]}>
        <View style={[styles.skeletonBlock, {width: '48%', height: 160}]} />
        <View style={[styles.skeletonBlock, {width: '48%', height: 160}]} />
      </View>
      <View style={[styles.skeletonBlock, {width: '100%', height: 46, marginTop: 18}]} />
      <View style={[styles.skeletonBlock, {width: '100%', height: 46, marginTop: 10}]} />
      <View style={[styles.skeletonBlock, {width: '100%', height: 46, marginTop: 10}]} />
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
        <Text style={styles.headerTitle}>Exterior</Text>
        <Pressable style={styles.resetBtn} onPress={resetAll}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Step 2 · Exterior</Text>
          <Text style={styles.progressValue}>
            {filledCount}/{requiredFields.length}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {prefillLoading ? (
          renderSkeleton()
        ) : (
          <View style={styles.card}>
          <Text style={styles.title}>Exterior inspection</Text>
          <Text style={styles.subtitle}>
            Capture panel condition, tyre health, wheel type, costs, and repaint
            info.
          </Text>

          <Text style={styles.sectionTitle}>Panels & scratches</Text>
          <Text style={styles.sectionHelper}>
            Add a photo and mark the scratch level for each panel.
          </Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <MinusCircle size={16} color="#2563eb" />
              <Text style={styles.legendText}>Minor Scratch</Text>
            </View>
            <View style={styles.legendItem}>
              <AlertTriangle size={16} color="#b91c1c" />
              <Text style={styles.legendText}>Major Scratch</Text>
            </View>
            <View style={styles.legendItem}>
              <CheckCircle size={16} color="#059669" />
              <Text style={styles.legendText}>No Scratch</Text>
            </View>
          </View>
          <View style={styles.panelGrid}>
            {PANELS.map(panel => {
              const state = panelStates[panel] || {photoUri: null, status: ''};
              return (
                <View key={panel} style={styles.panelCard}>
                  <Text style={styles.panelLabel}>{panel}</Text>
                  <Pressable
                    style={styles.photoTile}
                    onPress={() =>
                      setPickerVisible({open: true, panelKey: panel})
                    }>
                    {state.photoUri ? (
                      <>
                        <Image
                          source={{uri: state.photoUri}}
                          style={styles.photoImage}
                          resizeMode="cover"
                        />
                        <View style={styles.photoBadge}>
                          <Check size={14} color="#fff" />
                        </View>
                        <Pressable
                          style={styles.eyeIcon}
                          onPress={() => {
                            setPreviewUri(state.photoUri);
                            setPreviewVisible(true);
                          }}>
                          <Eye size={16} color="#111827" />
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <ImageIcon size={28} color="#9ca3af" strokeWidth={2} />
                        <Text style={styles.photoText}>Add photo</Text>
                      </>
                    )}
                  </Pressable>
                  {renderScratchOptions(panel)}
                </View>
              );
            })}
          </View>

          <Text style={[styles.sectionTitle, {marginTop: 16}]}>
            Tyre thread count
          </Text>
          <Text style={styles.sectionHelper}>
            Select condition for each tyre.
          </Text>
          <View style={styles.tyreList}>
            {TYRE_POSITIONS.map(pos => renderTyrePicker(pos))}
          </View>

          <Text style={[styles.sectionTitle, {marginTop: 16}]}>Wheel type</Text>
          <View style={styles.inlinePills}>
            {(['Alloys', 'Normal Rim'] as WheelType[]).map(opt => {
              const active = wheelType === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setWheelType(opt)}
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

          <Text style={[styles.sectionTitle, {marginTop: 16}]}>
            Refurbishment cost
          </Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Tyre replacement / wheel *
            </Text>
            <TextInput
              value={tyreRefurbCost}
              onChangeText={setTyreRefurbCost}
              keyboardType="numeric"
              placeholder="0"
              style={styles.input}
              autoComplete="off"
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Exterior refurbishment cost *</Text>
            <TextInput
              value={exteriorRefurbCost}
              onChangeText={setExteriorRefurbCost}
              keyboardType="numeric"
              placeholder="0"
              style={styles.input}
              autoComplete="off"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <Text style={[styles.sectionTitle, {marginTop: 16}]}>
            Paint thickness meter
          </Text>
          <Text style={styles.sectionHelper}>Has repaint been done? *</Text>
          <View style={styles.inlinePills}>
            {(['Yes', 'No'] as YesNo[]).map(opt => {
              const active = repaintDone === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setRepaintDone(opt)}
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

          <Pressable style={styles.nextBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.nextLabel}>Next</Text>
          </Pressable>
        </View>
        )}
      </ScrollView>

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
        onRequestClose={() => setPickerVisible({open: false, panelKey: null})}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Add photo</Text>
            <Text style={styles.pickerSubtitle}>Choose source</Text>
            <View style={styles.pickerActions}>
              <Pressable
                style={styles.pickerBtn}
                onPress={() => handlePick('camera')}>
                <Text style={styles.pickerBtnText}>Camera</Text>
              </Pressable>
              <Pressable
                style={styles.pickerBtn}
                onPress={() => handlePick('library')}>
                <Text style={styles.pickerBtnText}>Library</Text>
              </Pressable>
              <Pressable
                style={[styles.pickerBtn, styles.pickerCancel]}
                onPress={() => setPickerVisible({open: false, panelKey: null})}>
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

export default ExteriorScreen;

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
  sectionHelper: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
  },
  legendRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#4b5563',
    fontWeight: '700',
  },
  panelGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  panelCard: {
    width: '48%',
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  panelLabel: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 2,
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
  photoText: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillActive: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY + '15',
  },
  pillInactive: {
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  pillLabelActive: {
    color: PRIMARY,
  },
  pillLabelInactive: {
    color: '#374151',
  },
  scratchColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 6,
    flexWrap: 'nowrap',
  },
  scratchScroll: {
    marginTop: 8,
  },
  scratchPill: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scratchPillActive: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY + '15',
  },
  scratchPillInactive: {
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  tyreList: {
    marginTop: 10,
    gap: 10,
  },
  selectCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  selectLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '700',
  },
  selectValue: {
    marginTop: 4,
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },
  tyreOptionsWrap: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tyreOption: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tyreOptionActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  tyreOptionText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '700',
  },
  tyreOptionTextActive: {
    color: '#fff',
  },
  inlinePills: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  inputGroup: {
    marginTop: 12,
  },
  inputLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '700',
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
  helperBox: {
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  helperText: {
    fontSize: 12,
    color: '#9a3412',
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
  skeletonBlock: {
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
});
