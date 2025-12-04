import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Animated,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {
  ChevronLeft,
  Check,
  Eye,
  Image as ImageIcon,
  X,
  PlugZap,
  Lightbulb,
  ThermometerSun,
  Music,
} from 'lucide-react-native';
import {
  launchImageLibrary,
  launchCamera,
  ImagePickerResponse,
} from 'react-native-image-picker';
import {PRIMARY} from '../utils/theme';
import {Modal} from 'react-native';
import {
  PinchGestureHandler,
  TapGestureHandler,
  State,
} from 'react-native-gesture-handler';
import DiscreteSlider from '../components/DiscreteSlider';
import {client} from '../utils/apiClient';
import {loadDraft, saveDraft} from '../utils/draftStorage';
import {store} from '../store/store';

type RouteParams = {
  sellCarId?: string | number;
};

type YesNo = 'Yes' | 'No' | '';
type YesNoNA = 'Yes' | 'No' | 'N/A' | '';
type Effectiveness = 'Effective' | 'Not Effective' | 'AC Not Available' | '';
type GrillEfficiency = 'Bad (>14°c)' | 'Average (7-14°c)' | 'Excellent (<=7°c)' | '';
const GRILL_ALLOWED = {
  Bad: 'Bad (>14°c)',
  Average: 'Average (7-14°c)',
  Excellent: 'Excellent (<=7°c)',
} as const;
type Count024 = '0' | '2' | '4' | '';

const ElectricalInteriorScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const {sellCarId} = (route.params as RouteParams) || {};
  const formattedSellCarId =
    sellCarId == null ? '' : String(sellCarId).trim();

  const [inspectionId, setInspectionId] = useState<string | number>('');

  const [seatCover, setSeatCover] = useState<YesNo>('');
  const [sunRoof, setSunRoof] = useState<YesNo>('');
  const [carAntenna, setCarAntenna] = useState<YesNo>('');
  const [powerWindowsCount, setPowerWindowsCount] = useState<Count024>('');
  const [airBagsCount, setAirBagsCount] = useState<number>(0);

  const [powerWindowsWorking, setPowerWindowsWorking] = useState<YesNo>('');
  const [airBagsWorking, setAirBagsWorking] = useState<YesNo>('');
  const [parkingBrake, setParkingBrake] = useState<YesNo>('');
  const [horn, setHorn] = useState<YesNo>('');
  const [instrumentCluster, setInstrumentCluster] = useState<YesNo>('');
  const [wiper, setWiper] = useState<YesNo>('');
  const [headLamp, setHeadLamp] = useState<YesNo>('');
  const [tailLamp, setTailLamp] = useState<YesNo>('');
  const [fogLamp, setFogLamp] = useState<YesNo>('');
  const [cabinLight, setCabinLight] = useState<YesNo>('');
  const [blinkerLight, setBlinkerLight] = useState<YesNo>('');
  const [seatBelts, setSeatBelts] = useState<YesNo>('');

  const [acEffectiveness, setAcEffectiveness] = useState<Effectiveness>('');
  const [acGrillEfficiency, setAcGrillEfficiency] =
    useState<GrillEfficiency>('');
  const [climateControlAC, setClimateControlAC] = useState<YesNoNA>('');
  const [heater, setHeater] = useState<YesNoNA>('');
  const [orvm, setOrvm] = useState<YesNoNA>('');
  const [steeringMounted, setSteeringMounted] = useState<YesNoNA>('');
  const [abs, setAbs] = useState<YesNoNA>('');
  const [reverseSensors, setReverseSensors] = useState<YesNoNA>('');
  const [reverseCamera, setReverseCamera] = useState<YesNoNA>('');
  const [keylessLocking, setKeylessLocking] = useState<YesNoNA>('');
  const [musicSystemWorking, setMusicSystemWorking] = useState<YesNoNA>('');

  const [musicSystemDetails, setMusicSystemDetails] = useState('');
  const [odometerImageUri, setOdometerImageUri] = useState<string | null>(null);
  const [interiorImages, setInteriorImages] = useState<(string | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [refurbishmentCost, setRefurbishmentCost] = useState('');

  const [pickerVisible, setPickerVisible] = useState<{
    open: boolean;
    target:
      | {type: 'odometer'}
      | {type: 'interior'; index: number}
      | null;
  }>({open: false, target: null});

  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const pinchScale = useRef(new Animated.Value(1)).current;
  const baseScale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const combinedScale = Animated.multiply(baseScale, pinchScale);
  const doubleTapRef = useRef<TapGestureHandler | null>(null);

  const requiredFields = useMemo(() => {
    const availability = ['seatCover', 'sunRoof', 'carAntenna', 'powerWindowsCount', 'airBagsCount'];
    const workingYesNo = [
      'powerWindowsWorking',
      'airBagsWorking',
      'parkingBrake',
      'horn',
      'instrumentCluster',
      'wiper',
      'headLamp',
      'tailLamp',
      'fogLamp',
      'cabinLight',
      'blinkerLight',
      'seatBelts',
    ];
    const advanced = [
      'acEffectiveness',
      'acGrillEfficiency',
      'climateControlAC',
      'heater',
      'orvm',
      'steeringMounted',
      'abs',
      'reverseSensors',
      'reverseCamera',
      'keylessLocking',
      'musicSystemWorking',
    ];
    const photos = ['odometerImageUri', 'interiorImages'];
    return [...availability, ...workingYesNo, ...advanced, ...photos, 'refurbishmentCost'];
  }, []);

  const filledCount = useMemo(() => {
    let count = 0;
    if (seatCover) count += 1;
    if (sunRoof) count += 1;
    if (carAntenna) count += 1;
    if (powerWindowsCount) count += 1;
    if (airBagsCount !== null) count += 1;

    [
      powerWindowsWorking,
      airBagsWorking,
      parkingBrake,
      horn,
      instrumentCluster,
      wiper,
      headLamp,
      tailLamp,
      fogLamp,
      cabinLight,
      blinkerLight,
      seatBelts,
    ].forEach(v => {
      if (v) count += 1;
    });

    [
      acEffectiveness,
      acGrillEfficiency,
      climateControlAC,
      heater,
      orvm,
      steeringMounted,
      abs,
      reverseSensors,
      reverseCamera,
      keylessLocking,
      musicSystemWorking,
    ].forEach(v => {
      if (v) count += 1;
    });

    if (odometerImageUri) count += 1;
    if (interiorImages.filter(Boolean).length > 0) count += 1;
    if (refurbishmentCost) count += 1;

    return count;
  }, [
    seatCover,
    sunRoof,
    carAntenna,
    powerWindowsCount,
    airBagsCount,
    powerWindowsWorking,
    airBagsWorking,
    parkingBrake,
    horn,
    instrumentCluster,
    wiper,
    headLamp,
    tailLamp,
    fogLamp,
    cabinLight,
    blinkerLight,
    seatBelts,
    acEffectiveness,
    acGrillEfficiency,
    climateControlAC,
    heater,
    orvm,
    steeringMounted,
    abs,
    reverseSensors,
    reverseCamera,
    keylessLocking,
    musicSystemWorking,
    odometerImageUri,
    interiorImages,
    refurbishmentCost,
  ]);

  useEffect(() => {
    let cancelled = false;
    const pickField = (source: any, keys: string[]) => {
      for (const key of keys) {
        const val = source?.[key];
        if (val !== undefined && val !== null) {
          const str = typeof val === 'string' ? val.trim() : val;
          if (str !== '' && str !== null) {
            return val;
          }
        }
      }
      return undefined;
    };

    const normYesNo = (val: any): YesNo => {
      const v = (val || '').toString().trim().toLowerCase();
      if (v === 'yes' || v === 'y' || v === 'true' || v === '1') return 'Yes';
      if (v === 'no' || v === 'n' || v === 'false' || v === '0') return 'No';
      return '';
    };
    const normYesNoNA = (val: any): YesNoNA => {
      const v = (val || '').toString().trim().toLowerCase();
      if (v === 'n/a' || v === 'na') return 'N/A';
      const yn = normYesNo(v) as YesNo;
      return yn || '';
    };
    const normEffectiveness = (val: any): Effectiveness => {
      const v = (val || '').toString().trim().toLowerCase();
      if (v.includes('ac not') || v === 'na' || v === 'n/a')
        return 'AC Not Available';
      if (v.includes('not') || v.includes('non')) return 'Non-Effective';
      if (v.includes('effective')) return 'Effective';
      return '';
    };
    const normGrill = (val: any): GrillEfficiency => {
      const v = (val || '').toString().trim().toLowerCase();
      if (v.startsWith('bad')) return GRILL_ALLOWED.Bad;
      if (v.startsWith('avg') || v.startsWith('average'))
        return GRILL_ALLOWED.Average;
      if (v.startsWith('excel') || v.startsWith('good'))
        return GRILL_ALLOWED.Excellent;
      if (v.includes('>14')) return GRILL_ALLOWED.Bad;
      if (v.includes('7-14')) return GRILL_ALLOWED.Average;
      if (v.includes('<=7') || v.includes('7°')) return GRILL_ALLOWED.Excellent;
      return '';
    };
    const normCount024 = (val: any): Count024 => {
      const v = (val || '').toString().trim();
      return v === '0' || v === '2' || v === '4' ? (v as Count024) : '';
    };

    const hydrateDraft = async () => {
      if (!formattedSellCarId) return;
      const draft = loadDraft<any>(formattedSellCarId, 'electrical');
      if (draft && !cancelled) {
        setSeatCover(draft.seatCover || '');
        setSunRoof(draft.sunRoof || '');
        setCarAntenna(draft.carAntenna || '');
        setPowerWindowsCount(draft.powerWindowsCount || '');
        setAirBagsCount(draft.airBagsCount || 0);
        setPowerWindowsWorking(draft.powerWindowsWorking || '');
        setAirBagsWorking(draft.airBagsWorking || '');
        setParkingBrake(draft.parkingBrake || '');
        setHorn(draft.horn || '');
        setInstrumentCluster(draft.instrumentCluster || '');
        setWiper(draft.wiper || '');
        setHeadLamp(draft.headLamp || '');
        setTailLamp(draft.tailLamp || '');
        setFogLamp(draft.fogLamp || '');
        setCabinLight(draft.cabinLight || '');
        setBlinkerLight(draft.blinkerLight || '');
        setSeatBelts(draft.seatBelts || '');
        setAcEffectiveness(draft.acEffectiveness || '');
        setAcGrillEfficiency(draft.acGrillEfficiency || '');
        setClimateControlAC(draft.climateControlAC || '');
        setHeater(draft.heater || '');
        setOrvm(draft.orvm || '');
        setSteeringMounted(draft.steeringMounted || '');
        setAbs(draft.abs || '');
        setReverseSensors(draft.reverseSensors || '');
        setReverseCamera(draft.reverseCamera || '');
        setKeylessLocking(draft.keylessLocking || '');
        setMusicSystemWorking(draft.musicSystemWorking || '');
        setMusicSystemDetails(draft.musicSystemDetails || '');
        setOdometerImageUri(draft.odometerImageUri || null);
        if (Array.isArray(draft.interiorImages)) {
          setInteriorImages(draft.interiorImages);
        }
        setRefurbishmentCost(draft.refurbishmentCost || '');
      }
    };

    const fetchExisting = async () => {
      if (!formattedSellCarId) return;
      try {
        setPrefillLoading(true);
        await hydrateDraft();
        const res = await client.get('/api/view-inspection', {
          params: {sellCarId: formattedSellCarId},
        });
        if (cancelled) return;
        const existing = res.data?.data?.allInspections?.[0];
        if (existing?.id != null) {
          setInspectionId(existing.id);
        }
        const interiorData =
          existing?.interior ||
          existing?.Interior ||
          existing?.electrical ||
          existing?.Electrical ||
          existing?.electricalInterior ||
          existing?.ElectricalInterior;
        if (!interiorData || typeof interiorData !== 'object') {
          return;
        }
        const availableSrc =
          interiorData.available ||
          interiorData.Available ||
          interiorData.availability ||
          interiorData.Availability ||
          interiorData['Is Available'] ||
          interiorData;
        const workingSrc =
          interiorData.working ||
          interiorData.Working ||
          interiorData.condition ||
          interiorData.Condition ||
          interiorData;
        const acSrc =
          interiorData.ac ||
          interiorData.AC ||
          interiorData['AC & Safety'] ||
          interiorData.safety ||
          interiorData.Safety ||
          interiorData.advanced ||
          interiorData;

        const seatCoverVal = normYesNo(
          pickField(availableSrc, ['Seat Cover', 'seatCover', 'SeatCover']),
        );
        if (seatCoverVal) setSeatCover(seatCoverVal);

        const sunRoofVal = normYesNo(
          pickField(availableSrc, ['Sun Roof', 'sunRoof', 'SunRoof']),
        );
        if (sunRoofVal) setSunRoof(sunRoofVal);

        const antennaVal = normYesNo(
          pickField(availableSrc, ['Car Antenna', 'carAntenna', 'Antenna']),
        );
        if (antennaVal) setCarAntenna(antennaVal);

        const powerWindowsCnt = normCount024(
          pickField(availableSrc, [
            'No. of Power Windows',
            'Power Windows',
            'powerWindowsCount',
            'PowerWindowsCount',
          ]),
        );
        if (powerWindowsCnt) setPowerWindowsCount(powerWindowsCnt);

        const airBagsCntRaw = pickField(availableSrc, [
          'No. of Air Bags',
          'No. of Airbags',
          'Air Bags',
          'Airbags',
          'airBagsCount',
          'AirBagsCount',
        ]);
        const airBagsCntNum =
          typeof airBagsCntRaw === 'number'
            ? airBagsCntRaw
            : parseInt((airBagsCntRaw || '').toString(), 10);
        if (!isNaN(airBagsCntNum)) {
          setAirBagsCount(airBagsCntNum);
        }

        const setWorking = (
          setter: (v: YesNo) => void,
          keys: string[],
        ) => {
          const val = normYesNo(pickField(workingSrc, keys));
          if (val) setter(val);
        };

        setWorking(setPowerWindowsWorking, [
          'Power Windows',
          'powerWindowsWorking',
        ]);
        setWorking(setAirBagsWorking, ['Air Bags', 'airBagsWorking']);
        setWorking(setParkingBrake, [
          'Parking Brake Lever',
          'parkingBrake',
          'Parking Brake',
        ]);
        setWorking(setHorn, ['Horn', 'horn']);
        setWorking(setInstrumentCluster, [
          'Instrument Cluster',
          'instrumentCluster',
        ]);
        setWorking(setWiper, ['Wiper', 'wiper']);
        setWorking(setHeadLamp, ['Head Lamp', 'headLamp']);
        setWorking(setTailLamp, ['Tail Lamp', 'tailLamp']);
        setWorking(setFogLamp, ['Fog Lamp', 'fogLamp']);
        setWorking(setCabinLight, ['Cabin Light', 'cabinLight']);
        setWorking(setBlinkerLight, ['Blinker Light', 'blinkerLight']);
        setWorking(setSeatBelts, ['Seat Belts', 'seatBelts']);

        const setYNNA = (
          setter: (v: YesNoNA) => void,
          keys: string[],
        ) => {
          const val = normYesNoNA(pickField(acSrc, keys));
          if (val) setter(val);
        };

        const acEff = normEffectiveness(
          pickField(acSrc, ['AC Effectiveness', 'acEffectiveness']),
        );
        if (acEff) setAcEffectiveness(acEff);

        const acGrill = normGrill(
          pickField(acSrc, ['AC Grill Efficiency', 'acGrillEfficiency']),
        );
        if (acGrill) setAcGrillEfficiency(acGrill);

        setYNNA(setClimateControlAC, [
          'Climate Control AC',
          'climateControlAC',
        ]);
        setYNNA(setHeater, ['Heater', 'heater']);
        setYNNA(setOrvm, ['ORVM', 'orvm']);
        setYNNA(setSteeringMounted, [
          'Steering Mounted Controls',
          'steeringMounted',
        ]);
        setYNNA(setAbs, ['ABS', 'abs']);
        setYNNA(setReverseSensors, [
          'Reverse Parking Sensors',
          'reverseSensors',
        ]);
        setYNNA(setReverseCamera, ['Reverse Camera', 'reverseCamera']);
        setYNNA(setKeylessLocking, [
          'Keyless/Center Locking',
          'keylessLocking',
        ]);
        setYNNA(setMusicSystemWorking, [
          'Music System',
          'musicSystemWorking',
        ]);

        const musicDetails = pickField(interiorData, [
          'Music System Details',
          'musicSystemDetails',
        ]);
        if (musicDetails != null) {
          setMusicSystemDetails(String(musicDetails));
        }

        const odoImg = pickField(interiorData, [
          'Odometer Image',
          'Odometer image',
          'odometerImage',
          'Odometer',
          'odometer',
        ]);
        if (odoImg) setOdometerImageUri(String(odoImg));

        const interiorImgs =
          interiorData.interiorImages ||
          interiorData.InteriorImages ||
          interiorData['Interior Images'] ||
          interiorData['Interior images'] ||
          interiorData.images ||
          [];
        const toArray = (val: any): (string | null)[] => {
          if (Array.isArray(val))
            return val.map(v => (v ? String(v) : null));
          if (val && typeof val === 'object') {
            return Object.values(val).map(v => (v ? String(v) : null));
          }
          if (typeof val === 'string' && val.includes(',')) {
            return val.split(',').map(s => s.trim()).map(s => (s ? s : null));
          }
          return [];
        };
        const interiorArr = toArray(interiorImgs);
        if (interiorArr.length > 0) {
          setInteriorImages(prev => {
            const next = [...prev];
            for (let i = 0; i < Math.min(4, interiorArr.length); i += 1) {
              if (interiorArr[i]) {
                next[i] = interiorArr[i]!;
              }
            }
            return next;
          });
        }

        const refurb = pickField(interiorData, [
          'Refurbishment Cost',
          'Interior Refurbishment Cost',
          'refurbishmentCost',
        ]);
        if (refurb != null && String(refurb).trim() !== '') {
          setRefurbishmentCost(String(refurb));
        }
      } catch (err) {
        // silent prefill failure
        console.warn('Failed to prefill electrical/interior', err);
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
      seatCover,
      sunRoof,
      carAntenna,
      powerWindowsCount,
      airBagsCount,
      powerWindowsWorking,
      airBagsWorking,
      parkingBrake,
      horn,
      instrumentCluster,
      wiper,
      headLamp,
      tailLamp,
      fogLamp,
      cabinLight,
      blinkerLight,
      seatBelts,
      acEffectiveness,
      acGrillEfficiency,
      climateControlAC,
      heater,
      orvm,
      steeringMounted,
      abs,
      reverseSensors,
      reverseCamera,
      keylessLocking,
      musicSystemWorking,
      musicSystemDetails,
      odometerImageUri,
      interiorImages,
      refurbishmentCost,
    };
    saveDraft(formattedSellCarId, 'electrical', payload);
  }, [
    formattedSellCarId,
    seatCover,
    sunRoof,
    carAntenna,
    powerWindowsCount,
    airBagsCount,
    powerWindowsWorking,
    airBagsWorking,
    parkingBrake,
    horn,
    instrumentCluster,
    wiper,
    headLamp,
    tailLamp,
    fogLamp,
    blinkerLight,
    seatBelts,
    acEffectiveness,
    acGrillEfficiency,
    climateControlAC,
    heater,
    orvm,
    steeringMounted,
    abs,
    reverseSensors,
    reverseCamera,
    keylessLocking,
    musicSystemWorking,
    musicSystemDetails,
    odometerImageUri,
    interiorImages,
    refurbishmentCost,
  ]);

  const resetAll = () => {
    setSeatCover('');
    setSunRoof('');
    setCarAntenna('');
    setPowerWindowsCount('');
    setAirBagsCount(0);
    setPowerWindowsWorking('');
    setAirBagsWorking('');
    setParkingBrake('');
    setHorn('');
    setInstrumentCluster('');
    setWiper('');
    setHeadLamp('');
    setTailLamp('');
    setFogLamp('');
    setCabinLight('');
    setBlinkerLight('');
    setSeatBelts('');
    setAcEffectiveness('');
    setAcGrillEfficiency('');
    setClimateControlAC('');
    setHeater('');
    setOrvm('');
    setSteeringMounted('');
    setAbs('');
    setReverseSensors('');
    setReverseCamera('');
    setKeylessLocking('');
    setMusicSystemWorking('');
    setMusicSystemDetails('');
    setOdometerImageUri(null);
    setInteriorImages([null, null, null, null]);
    setRefurbishmentCost('');
  };

  const openPicker = (
    target:
      | {type: 'odometer'}
      | {
          type: 'interior';
          index: number;
        },
  ) => setPickerVisible({open: true, target});

  const handlePick = async (mode: 'camera' | 'library') => {
    const resp: ImagePickerResponse =
      mode === 'camera'
        ? await launchCamera({mediaType: 'photo', quality: 0.8})
        : await launchImageLibrary({mediaType: 'photo', quality: 0.8});
    if (resp.didCancel || !resp.assets || resp.assets.length === 0) {
      setPickerVisible({open: false, target: null});
      return;
    }
    const target = pickerVisible.target;
    if (!target) {
      setPickerVisible({open: false, target: null});
      return;
    }
    const uri = resp.assets[0]?.uri;
    if (uri) {
      if (target.type === 'odometer') {
        setOdometerImageUri(uri);
      } else if (target.type === 'interior') {
        setInteriorImages(prev => {
          const next = [...prev];
          const idx = target.index;
          next[idx] = uri;
          return next;
        });
      }
    }
    setPickerVisible({open: false, target: null});
  };

  const renderToggle = (
    label: string,
    value: string,
    onChange: (v: any) => void,
    options: string[] = ['Yes', 'No'],
  ) => (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={styles.togglePills}>
        {options.map(opt => {
          const active = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={[
                styles.togglePill,
                active ? styles.togglePillActive : styles.togglePillInactive,
              ]}>
              <Text
                style={[
                  styles.togglePillText,
                  active ? styles.togglePillTextActive : null,
                ]}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderCountButtons = (
    label: string,
    value: Count024,
    onChange: (v: Count024) => void,
  ) => (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={styles.togglePills}>
        {(['0', '2', '4'] as Count024[]).map(opt => {
          const active = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={[
                styles.togglePill,
                active ? styles.togglePillActive : styles.togglePillInactive,
              ]}>
              <Text
                style={[
                  styles.togglePillText,
                  active ? styles.togglePillTextActive : null,
                ]}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderPhotoTile = (
    label: string,
    uri: string | null,
    onPress: () => void,
  ) => (
    <View style={{flex: 1}}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Pressable style={styles.photoTile} onPress={onPress}>
        {uri ? (
          <>
            <Image source={{uri}} style={styles.photoImage} resizeMode="cover" />
            <View style={styles.photoBadge}>
              <Check size={14} color="#fff" />
            </View>
            <Pressable
              style={styles.eyeIcon}
              onPress={() => {
                setPreviewUri(uri);
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
    </View>
  );

  const appendFileToFormData = async (
    fd: FormData,
    fieldName: string,
    uri: string,
  ) => {
    const ext = uri.split('.').pop() || 'jpg';
    const mime =
      ext === 'png'
        ? 'image/png'
        : ext === 'jpeg' || ext === 'jpg'
        ? 'image/jpeg'
        : 'application/octet-stream';
    const isRemote = uri.startsWith('http://') || uri.startsWith('https://');
    if (isRemote) {
      const res = await fetch(uri);
      const blob = await res.blob();
      const typedBlob =
        blob.type && blob.type.length > 0
          ? blob
          : new Blob([blob], {type: mime || 'application/octet-stream'});
      (typedBlob as any).name = `${fieldName}.${ext}`;
      fd.append(fieldName, typedBlob as any);
    } else {
      const normalizedUri =
        uri.startsWith('file://') || uri.startsWith('content://') ? uri : uri;
      fd.append(fieldName, {
        uri: normalizedUri,
        name: `${fieldName}.${ext}`,
        type: mime,
      } as any);
    }
  };

  const handleSubmit = async () => {
    setMessage(null);
    if (!formattedSellCarId) {
      setMessage('Missing sellCarId.');
      return;
    }
    const token = store.getState().auth.token;

    const normalizeGrillForSubmit = (val: string): GrillEfficiency => {
      if (Object.values(GRILL_ALLOWED).includes(val as GrillEfficiency)) {
        return val as GrillEfficiency;
      }
      const v = (val || '').toString().toLowerCase();
      if (v.startsWith('bad') || v.includes('>14')) return GRILL_ALLOWED.Bad;
      if (v.startsWith('avg') || v.startsWith('average') || v.includes('7-14'))
        return GRILL_ALLOWED.Average;
      if (v.startsWith('excel') || v.startsWith('good') || v.includes('<=7') || v.includes('7°'))
        return GRILL_ALLOWED.Excellent;
      return '';
    };
    const acGrillValue = normalizeGrillForSubmit(acGrillEfficiency);

    const requiredYN = [
      {label: 'Seat Cover', val: seatCover},
      {label: 'Sun Roof', val: sunRoof},
      {label: 'Car Antenna', val: carAntenna},
      {label: 'Power Windows count', val: powerWindowsCount},
    ];
    const requiredWorking: {label: string; val: YesNo}[] = [
      {label: 'Power Windows', val: powerWindowsWorking},
      {label: 'Air Bags', val: airBagsWorking},
      {label: 'Parking Brake Lever', val: parkingBrake},
      {label: 'Horn', val: horn},
      {label: 'Instrument Cluster', val: instrumentCluster},
      {label: 'Wiper', val: wiper},
      {label: 'Head Lamp', val: headLamp},
      {label: 'Tail Lamp', val: tailLamp},
      {label: 'Fog Lamp', val: fogLamp},
      {label: 'Cabin Light', val: cabinLight},
      {label: 'Seat Belts', val: seatBelts},
    ];
    const requiredAdvanced: {label: string; val: YesNoNA | Effectiveness | GrillEfficiency}[] =
      [
        {label: 'AC Effectiveness', val: acEffectiveness},
        {label: 'AC Grill Efficiency', val: acGrillValue},
        {label: 'Climate Control AC', val: climateControlAC},
        {label: 'Heater', val: heater},
        {label: 'ORVM', val: orvm},
        {label: 'Steering Mounted Controls', val: steeringMounted},
        {label: 'ABS', val: abs},
        {label: 'Reverse Parking Sensors', val: reverseSensors},
        {label: 'Reverse Camera', val: reverseCamera},
        {label: 'Keyless/Center Locking', val: keylessLocking},
        {label: 'Music System', val: musicSystemWorking},
      ];

    const missingYN = requiredYN.find(item => !item.val);
    if (missingYN) {
      setMessage(`Select ${missingYN.label}`);
      return;
    }
    const missingWork = requiredWorking.find(item => !item.val);
    if (missingWork) {
      setMessage(`Select ${missingWork.label}`);
      return;
    }
    const missingAdv = requiredAdvanced.find(item => !item.val);
    if (missingAdv) {
      setMessage(`Select ${missingAdv.label}`);
      return;
    }
    if (!odometerImageUri) {
      setMessage('Add odometer image.');
      return;
    }
    if (!interiorImages.filter(Boolean).length) {
      setMessage('Add at least one interior image.');
      return;
    }
    if (!refurbishmentCost) {
      setMessage('Enter refurbishment cost.');
      return;
    }

    setSubmitting(true);
    try {
      const acEffReport =
        acEffectiveness === 'Not Effective'
          ? 'Non-Effective'
          : acEffectiveness;

      const reports = {
        available: {
          'Seat Cover': seatCover,
          'Sun Roof': sunRoof,
          'Car Antenna': carAntenna,
          'No. of Power Windows': powerWindowsCount,
          'No. of Airbags': String(airBagsCount),
        },
        working: {
          'Power Windows': powerWindowsWorking,
          'Air Bags': airBagsWorking,
          'Parking Brake Lever': parkingBrake,
          Horn: horn,
          'Instrument Cluster': instrumentCluster,
          Wiper: wiper,
          'Head Lamp': headLamp,
          'Tail Lamp': tailLamp,
          'Fog Lamp': fogLamp,
          'Cabin Light': cabinLight,
          'Blinker Light': blinkerLight,
          'Seat Belts': seatBelts,
        },
        'AC Effectiveness': acEffReport,
        'AC Grill Efficiency': acGrillValue,
        'Climate Control AC': climateControlAC,
        Heater: heater,
        ORVM: orvm,
        'Steering Mounted Controls': steeringMounted,
        ABS: abs,
        'Reverse Parking Sensors': reverseSensors,
        'Reverse Camera': reverseCamera,
        'Keyless/Center Locking': keylessLocking,
        'Keyless/Center Locking Details': '',
        'Music System': musicSystemWorking,
        'Music System Details': musicSystemDetails,
        'Odometer image': '',
        'Interior images': [],
        'Refurbishment Cost':
          refurbishmentCost === '' ? '0' : refurbishmentCost,
      };

      const fd = new FormData();
      fd.append('id', String(inspectionId || formattedSellCarId));
      fd.append('sellCarId', formattedSellCarId);
      fd.append('Reports', JSON.stringify(reports));
      fd.append('deletedFiles', JSON.stringify([]));

      if (odometerImageUri) {
        await appendFileToFormData(fd, 'odometer', odometerImageUri);
      }
      for (let i = 0; i < interiorImages.length; i += 1) {
        const uri = interiorImages[i];
        if (uri) {
          await appendFileToFormData(fd, `interior${i + 1}`, uri);
        }
      }

      const resp = await fetch(
        `https://api.marnix.in/api/add-electrical-and-interior-inspection`,
        {
          method: 'POST',
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
            Accept: '*/*',
          },
          body: fd,
        },
      );
      const text = await resp.text();
      if (!resp.ok) {
        console.error('[Electrical] upload failed', {
          status: resp.status,
          statusText: resp.statusText,
          body: text,
        });
        throw new Error(text || 'Failed to save electrical + interior');
      }
      setMessage('Electrical + Interior saved.');
      navigation.navigate('TestDrive', {sellCarId: formattedSellCarId});
    } catch (err: any) {
      setMessage(err?.message || 'Failed to save electrical + interior');
    } finally {
      setSubmitting(false);
    }
  };

  const renderSkeleton = () => (
    <View style={styles.card}>
      <View style={[styles.skeletonBlock, {width: 180, height: 16}]} />
      <View style={[styles.skeletonBlock, {width: '70%', height: 12, marginTop: 8}]} />
      <View style={[styles.skeletonBlock, {width: '100%', height: 46, marginTop: 16}]} />
      <View style={[styles.skeletonBlock, {width: '100%', height: 46, marginTop: 8}]} />
      <View style={[styles.skeletonRow, {marginTop: 12}]}>
        <View style={[styles.skeletonBlock, {width: '48%', height: 140}]} />
        <View style={[styles.skeletonBlock, {width: '48%', height: 140}]} />
      </View>
      <View style={[styles.skeletonBlock, {width: '100%', height: 100, marginTop: 12}]} />
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
        <Text style={styles.headerTitle}>Electrical + Interior</Text>
        <Pressable style={styles.resetBtn} onPress={resetAll}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Step 3 · Electrical + Interior</Text>
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
          <Text style={styles.title}>Electrical + Interior</Text>
          <Text style={styles.subtitle}>
            Mark availability, working condition, add photos, and costs.
          </Text>

          <Text style={styles.sectionTitle}>Is Available?</Text>
          {renderToggle('Seat Cover *', seatCover, setSeatCover)}
          {renderToggle('Sun Roof *', sunRoof, setSunRoof)}
          {renderToggle('Car Antenna *', carAntenna, setCarAntenna)}
          {renderCountButtons('No. of Power Windows *', powerWindowsCount, setPowerWindowsCount)}
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>No. of Air Bags *</Text>
            <DiscreteSlider
              min={0}
              max={6}
              step={1}
              value={airBagsCount}
              onChange={setAirBagsCount}
            />
          </View>

          <Text style={[styles.sectionTitle, {marginTop: 16}]}>
            Is in Working Condition?
          </Text>
          {renderToggle('Power Windows *', powerWindowsWorking, setPowerWindowsWorking)}
          {renderToggle('Air Bags *', airBagsWorking, setAirBagsWorking)}
          {renderToggle('Parking Brake Lever *', parkingBrake, setParkingBrake)}
          {renderToggle('Horn *', horn, setHorn)}
          {renderToggle('Instrument Cluster *', instrumentCluster, setInstrumentCluster)}
          {renderToggle('Wiper *', wiper, setWiper)}
          {renderToggle('Head Lamp *', headLamp, setHeadLamp)}
          {renderToggle('Tail Lamp *', tailLamp, setTailLamp)}
          {renderToggle('Fog Lamp *', fogLamp, setFogLamp)}
          {renderToggle('Cabin Light *', cabinLight, setCabinLight)}
          {renderToggle('Blinker Light *', blinkerLight, setBlinkerLight)}
          {renderToggle('Seat Belts *', seatBelts, setSeatBelts)}

          <Text style={[styles.sectionTitle, {marginTop: 16}]}>
            AC & Safety
          </Text>
          {renderToggle(
            'AC Effectiveness *',
            acEffectiveness,
            setAcEffectiveness,
            ['Effective', 'Non-Effective', 'AC Not Available'],
          )}
          {renderToggle(
            'AC Grill Efficiency *',
            acGrillEfficiency,
            setAcGrillEfficiency,
            [
              GRILL_ALLOWED.Bad,
              GRILL_ALLOWED.Average,
              GRILL_ALLOWED.Excellent,
            ],
          )}
          {renderToggle(
            'Climate Control AC *',
            climateControlAC,
            setClimateControlAC,
            ['Yes', 'No', 'N/A'],
          )}
          {renderToggle('Heater *', heater, setHeater, ['Yes', 'No', 'N/A'])}
          {renderToggle('ORVM *', orvm, setOrvm, ['Yes', 'No', 'N/A'])}
          {renderToggle(
            'Steering Mounted Controls *',
            steeringMounted,
            setSteeringMounted,
            ['Yes', 'No', 'N/A'],
          )}
          {renderToggle('ABS *', abs, setAbs, ['Yes', 'No', 'N/A'])}
          {renderToggle(
            'Reverse Parking Sensors *',
            reverseSensors,
            setReverseSensors,
            ['Yes', 'No', 'N/A'],
          )}
          {renderToggle(
            'Reverse Camera *',
            reverseCamera,
            setReverseCamera,
            ['Yes', 'No', 'N/A'],
          )}
          {renderToggle(
            'Keyless/Center Locking *',
            keylessLocking,
            setKeylessLocking,
            ['Yes', 'No', 'N/A'],
          )}
          {renderToggle(
            'Music System *',
            musicSystemWorking,
            setMusicSystemWorking,
            ['Yes', 'No', 'N/A'],
          )}

          <Text style={[styles.sectionTitle, {marginTop: 16}]}>
            Music System Details
          </Text>
          <TextInput
            style={styles.input}
            value={musicSystemDetails}
            onChangeText={setMusicSystemDetails}
            placeholder="Music system details ..."
            placeholderTextColor="#9ca3af"
            multiline
            autoComplete="off"
          />

          <Text style={[styles.sectionTitle, {marginTop: 16}]}>Photos</Text>
          <View style={styles.photoRow}>
            {renderPhotoTile('Odometer image *', odometerImageUri, () =>
              openPicker({type: 'odometer'}),
            )}
          </View>
          <View style={styles.interiorGrid}>
            {interiorImages.map((uri, idx) => (
              <View key={idx} style={styles.interiorCell}>
                {renderPhotoTile(
                  `Interior image ${idx + 1} *`,
                  uri,
                  () => openPicker({type: 'interior', index: idx}),
                )}
              </View>
            ))}
          </View>

          <Text style={[styles.sectionTitle, {marginTop: 16}]}>
            Refurbishment Cost
          </Text>
          <TextInput
            style={styles.input}
            value={refurbishmentCost}
            onChangeText={setRefurbishmentCost}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#9ca3af"
            autoComplete="off"
          />

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
        onRequestClose={() => setPickerVisible({open: false, target: null})}>
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
                onPress={() => setPickerVisible({open: false, target: null})}>
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

export default ElectricalInteriorScreen;

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
  toggleRow: {
    marginTop: 10,
  },
  toggleLabel: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '700',
  },
  togglePills: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  togglePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  togglePillActive: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY + '15',
  },
  togglePillInactive: {
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  togglePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  togglePillTextActive: {
    color: PRIMARY,
  },
  sliderRow: {
    marginTop: 12,
  },
  sliderLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
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
  photoRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 12,
  },
  photoTile: {
    marginTop: 6,
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
  skeletonBlock: {
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  interiorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginTop: 6,
  },
  interiorCell: {
    width: '48%',
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
  helperText: {
    marginTop: 10,
    fontSize: 12,
    color: '#b91c1c',
  },
});
