import React, {useEffect, useRef, useState} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Modal,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Calendar, Car, Square, User, Clock} from 'lucide-react-native';
import {PRIMARY} from '../utils/theme';

import {client} from '../utils/apiClient';
import {useAppSelector} from '../store/hooks';

type BookingStatus = 'Booked' | 'Unassigned' | 'Completed';

type Booking = {
  id: string;
  sellCarId?: string;
  dateLabel: string;
  day: string;
  time: string;
  status: BookingStatus;
  number: string;
  title: string;
  fuel: string;
  transmission: string;
  kms: string;
  address: string;
  inspectorName?: string | null;
};

type OwnedVehicle = {
  id: string;
  dateLabel: string;
  day: string;
  status: BookingStatus;
  number: string;
  title: string;
  fuel: string;
  transmission: string;
  kms: string;
  address: string;
  isPremium: boolean;
  sold: boolean;
};

type Brand = {
  id: number;
  name: string;
  display_name?: string;
};

type Model = {
  id: number;
  name: string;
  display_name?: string;
};

const SAMPLE_BOOKINGS: Booking[] = [
  {
    id: '1',
    dateLabel: 'SEP',
    day: '25',
    time: '12:30',
    status: 'Booked',
    number: '8933442604',
    title: 'Kia Sonet GTX PLUS 1.5',
    fuel: 'Petrol',
    transmission: 'Manual',
    kms: '25k Km',
    address: '99 Ville Parle, Hanuman Road, Near Airport',
  },
  {
    id: '2',
    dateLabel: 'SEP',
    day: '25',
    time: '12:30',
    status: 'Unassigned',
    number: '8933442904',
    title: 'Kia Sonet GTR PLUS 1.5',
    fuel: 'Petrol',
    transmission: 'Manual',
    kms: '25k Km',
    address: '99 Ville Parle, Hanuman Road, Near Airport',
  },
];

type TabKey = 'bookings' | 'owned' | 'calendar' | 'profile';

const TABS: {key: TabKey; label: string; icon: React.ComponentType<any>}[] = [
  {key: 'bookings', label: 'Bookings', icon: Square},
  {key: 'owned', label: 'Owned', icon: Car},
  {key: 'calendar', label: 'Calendar', icon: Calendar},
  {key: 'profile', label: 'Profile', icon: User},
];

const MONTH_LABELS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

const normalizeName = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toUpperCase();

const formatDateForApi = (d: Date) => {
  const day = `${d.getDate()}`.padStart(2, '0');
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const parseDateLabel = (dateStr: string | undefined) => {
  if (!dateStr) {
    return {label: '', day: ''};
  }
  const parts = dateStr.split('/');
  if (parts.length !== 3) {
    return {label: '', day: ''};
  }
  const [dd, mm] = parts;
  const monthIndex = Math.max(0, Math.min(11, Number(mm) - 1));
  return {
    label: MONTH_LABELS[monthIndex],
    day: dd.replace(/^0+/, '') || dd,
  };
};

const extractStartTime = (timeRange: string | undefined) => {
  if (!timeRange) {
    return '';
  }
  const [start] = timeRange.split('-');
  return (start || '').trim();
};

const formatIsoDateLabel = (value: string | undefined) => {
  if (!value) {
    return {label: '', day: ''};
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return {label: '', day: ''};
  }
  const label = MONTH_LABELS[d.getMonth()];
  const day = `${d.getDate()}`;
  return {label, day};
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const bottomContentInset = 80 + insets.bottom; // keep cards clear of the floating tab bar
  const [activeTab, setActiveTab] = useState<TabKey>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ownedVehicles, setOwnedVehicles] = useState<OwnedVehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [ownedLoading, setOwnedLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownedError, setOwnedError] = useState<string | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [modelsByBrand, setModelsByBrand] = useState<Record<number, Model[]>>(
    {},
  );
  const [brandModalVisible, setBrandModalVisible] = useState(false);
  const [modelModalVisible, setModelModalVisible] = useState(false);
  const [filters, setFilters] = useState<{
    brandId: number | null;
    modelId: number | null;
  }>({brandId: null, modelId: null});
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const navigation = useNavigation<any>();
  const auth = useAppSelector(state => state.auth);

  const animations = useRef(
    TABS.reduce(
      (acc, t) => ({
        ...acc,
        [t.key]: new Animated.Value(t.key === 'bookings' ? 1 : 0),
      }),
      {} as Record<TabKey, Animated.Value>,
    ),
  ).current;
  const detailAnim = useRef(new Animated.Value(0)).current;

  // Load today's bookings for the logged-in user.
  useEffect(() => {
    let cancelled = false;

    const fetchBookings = async () => {
      if (activeTab !== 'bookings') {
        return;
      }

      if (!auth.token) {
        setBookings([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const isSuperAdmin = !!auth.user?.isSuperAdmin;
        const fullNameParts = [
          auth.user?.firstName,
          auth.user?.middleName,
          auth.user?.lastName,
        ].filter(Boolean);
        const fullName = fullNameParts.join(' ').trim();

        const baseParams: any = {
          limit: 50,
          offset: 0,
          status: true,
        };

        let slots: any[] = [];
        let effectiveInspectorName: string | null = fullName || null;

        if (isSuperAdmin) {
          const res = await client.get('/api/view-inspection-slots', {
            params: baseParams,
          });
          slots = res.data?.data?.allSlots ?? [];
        } else {
          let inspectorId: number | null = null;

          // Map logged-in user to evaluator (inspector) ID.
          try {
            const evalRes = await client.get('/api/view-evaluator-list');
            const evaluators: any[] =
              evalRes.data?.data?.evaluators ?? [];
            if (fullName) {
              const normalizedUser = normalizeName(fullName);
              const match = evaluators.find(ev => {
                const name = String(ev?.name || '');
                return normalizeName(name) === normalizedUser;
              });
              if (match) {
                inspectorId = Number(match.id);
                effectiveInspectorName = String(match.name || fullName);
              }
            }
          } catch (evalErr) {
            console.error('[HomeScreen] Failed to load evaluators', {
              message: (evalErr as any)?.message,
            });
          }

          // Slots already assigned to this inspector.
          if (inspectorId != null) {
            const resAssigned = await client.get(
              '/api/view-inspection-slots',
              {
                params: {...baseParams, inspectorId},
              },
            );
            const assigned = resAssigned.data?.data?.allSlots ?? [];
            slots = slots.concat(assigned);
          }

          // Everyone who is authorised should see unassigned bookings.
          try {
            const resAll = await client.get('/api/view-inspection-slots', {
              params: baseParams,
            });
            const allSlots: any[] = resAll.data?.data?.allSlots ?? [];
            const unassigned = allSlots.filter(slot => {
              const inspectorRaw = String(slot?.inspector || '').trim();
              return (
                !inspectorRaw ||
                normalizeName(inspectorRaw) === 'NOT ASSIGNED'
              );
            });
            const existingIds = new Set(slots.map(s => s.id));
            unassigned.forEach(slot => {
              if (!existingIds.has(slot.id)) {
                slots.push(slot);
              }
            });
          } catch (allErr) {
            console.error('[HomeScreen] Failed to load unassigned slots', {
              message: (allErr as any)?.message,
            });
          }
        }

        const todayStr = formatDateForApi(new Date());
        const normalizedInspector = effectiveInspectorName
          ? normalizeName(effectiveInspectorName)
          : null;

        const normalizeStatusValue = (val: any) =>
          String(val || '').trim().toUpperCase();

        let visibleSlots = slots.filter(slot => {
          if (!slot) {
            return false;
          }
          const statusNorm = normalizeStatusValue(
            slot.currentStatus || slot.status,
          );
          const isCompleted = statusNorm.includes('COMPLETED');
          const isBooked = statusNorm === 'BOOKED';

          if (!isBooked && !isCompleted) {
            return false;
          }
          if (slot.status === false) {
            return false;
          }
          if (typeof slot.date === 'string' && slot.date) {
            if (isBooked && slot.date !== todayStr) return false;
            if (isCompleted && slot.date !== todayStr) return false;
          }
          return true;
        });

        if (!isSuperAdmin) {
          visibleSlots = visibleSlots.filter(slot => {
            const inspectorRaw = String(slot?.inspector || '').trim();
            const inspectorNorm = normalizeName(inspectorRaw || '');
            const statusNorm = normalizeStatusValue(
              slot.currentStatus || slot.status,
            );
            const isCompleted = statusNorm.includes('COMPLETED');
            if (isCompleted) {
              if (!normalizedInspector) return false;
              return inspectorNorm === normalizedInspector;
            }
            if (!inspectorRaw || inspectorNorm === 'NOT ASSIGNED') {
              // Unassigned bookings are visible to everyone who is authorised.
              return true;
            }
            if (normalizedInspector) {
              // Only keep bookings assigned to this evaluator.
              return inspectorNorm === normalizedInspector;
            }
            // If we cannot determine the evaluator name, do not leak bookings
            // assigned to others.
            return false;
          });
        }

        const mapped: Booking[] = visibleSlots.map(slot => {
          const {label, day} = parseDateLabel(
            typeof slot.date === 'string' ? slot.date : undefined,
          );
          const time = extractStartTime(
            typeof slot.time === 'string' ? slot.time : undefined,
          );
          const vehicle = slot.vehicleDetails || {};
          const titleParts = [
            vehicle.brand,
            vehicle.model,
            vehicle.variant,
          ]
            .filter(Boolean)
            .join(' ');

          const inspectorRaw = String(slot?.inspector || '').trim();
          const inspectorNorm = normalizeName(inspectorRaw || '');
          const isAssigned =
            inspectorRaw &&
            inspectorNorm !== 'NOT ASSIGNED';

          const statusNorm = normalizeStatusValue(
            slot.currentStatus || slot.status,
          );
          const isCompleted = statusNorm.includes('COMPLETED');

          const bookingStatus: BookingStatus = isCompleted
            ? 'Completed'
            : isAssigned
            ? 'Booked'
            : 'Unassigned';

          return {
            id: String(slot.id ?? slot.sellCarId ?? ''),
            sellCarId:
              slot.sellCarId != null ? String(slot.sellCarId) : undefined,
            dateLabel: label,
            day,
            time,
            status: bookingStatus,
            number: String(slot.sellCarId ?? slot.id ?? ''),
            title: titleParts || 'Inspection',
            fuel: String(vehicle.brand || '') || '',
            transmission: String(vehicle.model || '') || '',
            kms: String(vehicle.variant || '') || '',
            address: String(slot.address || ''),
            inspectorName: inspectorRaw || null,
          };
        });

        if (!cancelled) {
          setBookings(mapped);
        }
      } catch (err: any) {
        console.error('[HomeScreen] Failed to load bookings', {
          message: err?.message,
          status: err?.response?.status,
          data: err?.response?.data,
        });
        if (!cancelled) {
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            'Failed to load inspections';
          setError(msg);
          setBookings([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchBookings();

    return () => {
      cancelled = true;
    };
  }, [activeTab, auth.token, auth.user]);

  useEffect(() => {
    let cancelled = false;

    const fetchBrands = async () => {
      if (brands.length > 0) {
        return;
      }
      try {
        const res = await client.get('/api/view-brands');
        const list: any[] = res.data?.data?.brands ?? [];
        if (!cancelled) {
          setBrands(list.map(b => ({id: Number(b.id), name: b.name, display_name: b.display_name})));
        }
      } catch (err) {
        console.error('[HomeScreen] Failed to load brands', {
          message: (err as any)?.message,
        });
      }
    };

    if (activeTab === 'owned' && auth.token) {
      fetchBrands();
    }

    return () => {
      cancelled = true;
    };
  }, [activeTab, auth.token, brands.length]);

  useEffect(() => {
    let cancelled = false;

    const fetchModels = async (brandId: number) => {
      try {
        const res = await client.get('/api/view-vehicles', {
          params: {brandId},
        });
        const list: any[] = res.data?.data?.vehicles ?? [];
        if (!cancelled) {
          setModelsByBrand(prev => ({
            ...prev,
            [brandId]: list.map(m => ({
              id: Number(m.id),
              name: m.name,
              display_name: m.display_name,
            })),
          }));
        }
      } catch (err) {
        console.error('[HomeScreen] Failed to load models', {
          message: (err as any)?.message,
        });
      }
    };

    if (activeTab === 'owned' && filters.brandId != null) {
      const brandId = filters.brandId;
      if (!modelsByBrand[brandId]) {
        fetchModels(brandId);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [activeTab, filters.brandId, modelsByBrand, auth.token]);

  useEffect(() => {
    let cancelled = false;

    const fetchOwnedVehicles = async () => {
      if (activeTab !== 'owned') {
        return;
      }

      if (!auth.token) {
        setOwnedVehicles([]);
        return;
      }

      setOwnedLoading(true);
      setOwnedError(null);

      try {
        const params: any = {
          limit: 20,
          offset: 0,
          status: true,
        };

        if (filters.brandId != null) {
          params.brandId = [filters.brandId];
        }
        if (filters.modelId != null) {
          params.modelId = [filters.modelId];
        }

        const res = await client.get('/api/view-owned-vehicles', {
          params,
        });

        const vehicles: any[] = res.data?.data?.vehicles ?? [];
        const mapped: OwnedVehicle[] = vehicles.map(v => {
          const {label, day} = formatIsoDateLabel(
            typeof v.createdDate === 'string' ? v.createdDate : undefined,
          );
          const brandName =
            v.brand?.display_name || v.brand?.name || 'Brand';
          const modelName =
            v.model?.display_name || v.model?.name || 'Model';
          const variant = v.variant?.name
            ? String(v.variant.name)
            : '';
          const titleParts = [brandName, modelName, variant]
            .filter(Boolean)
            .join(' ');
          const status: BookingStatus = v.isBooked ? 'Booked' : 'Unassigned';
          const fuel = v.fuelType || '';
          const transmission = v.transmission || '';
          const kms = v.distanceDriven
            ? `${v.distanceDriven} Km`
            : '';
          const addressParts = [v.city, v.state].filter(Boolean);

          return {
            id: String(v.id ?? ''),
            dateLabel: label,
            day,
            status,
            number: String(v.vehicleUniqueId || v.regNumber || v.id || ''),
            title: titleParts || 'Owned vehicle',
            fuel: String(fuel),
            transmission: String(transmission),
            kms: kms || String(v.make_year || ''),
            address: addressParts.join(', '),
            isPremium: !!v.isPremium,
            sold: !!v.sold,
          };
        });

        if (!cancelled) {
          setOwnedVehicles(mapped);
        }
      } catch (err: any) {
        console.error('[HomeScreen] Failed to load owned vehicles', {
          message: err?.message,
          status: err?.response?.status,
          data: err?.response?.data,
        });
        if (!cancelled) {
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            'Failed to load owned vehicles';
          setOwnedError(msg);
          setOwnedVehicles([]);
        }
      } finally {
        if (!cancelled) {
          setOwnedLoading(false);
        }
      }
    };

    fetchOwnedVehicles();

    return () => {
      cancelled = true;
    };
  }, [activeTab, auth.token, auth.user]);

  useEffect(() => {
    TABS.forEach(tab => {
      Animated.timing(animations[tab.key], {
        toValue: tab.key === activeTab ? 1 : 0,
        duration: 260,
        useNativeDriver: false,
      }).start();
    });
  }, [activeTab, animations]);

  const closeDetail = () => {
    Animated.timing(detailAnim, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(() => {
      setDetailVisible(false);
      setDetailBooking(null);
      setDetailData(null);
      setDetailError(null);
    });
  };

  const openBookingDetail = async (booking: Booking) => {
    setDetailBooking(booking);
    setDetailVisible(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailData(null);
    detailAnim.setValue(0);
    Animated.spring(detailAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 80,
    }).start();

    try {
      const payloadId =
        (booking.sellCarId &&
          (Number(booking.sellCarId) || booking.sellCarId)) ||
        Number(booking.id) ||
        booking.id;
      const res = await client.get('/api/view-sell-car', {
        params: {id: payloadId},
      });
      const data = res.data?.data || res.data || {};
      const car =
        (Array.isArray(data?.AllSellCars) && data.AllSellCars[0]) ||
        data.AllSellCars ||
        data;
      const vehicle = car?.vehicle || car?.vehicleDetails || {};

      const brandName =
        vehicle.brand?.display_name ||
        vehicle.brand?.name ||
        vehicle.brand ||
        '';
      const modelName =
        vehicle.model?.display_name ||
        vehicle.model?.name ||
        vehicle.model ||
        '';
      const variantName =
        vehicle.variant?.name || car?.variant || vehicle.variant || '';
      const title =
        [brandName, modelName, variantName].filter(Boolean).join(' ') ||
        vehicle.name ||
        booking.title ||
        'Vehicle';
      const kms =
        car?.kmDriven ||
        vehicle.distanceDriven ||
        vehicle.kms ||
        vehicle.kilometers ||
        vehicle.odometer;

      let description =
        car?.vehicleInfo ||
        vehicle.description ||
        vehicle.notes ||
        vehicle.userNote ||
        '';
      if (!description && car?.remarks && typeof car.remarks === 'object') {
        // Prefer the most relevant remark; fall back to the first non-empty.
        const remarkKeys = [
          'Inspection Slot Booked',
          'Estimated Valuation Provided',
        ];
        let remark = '';
        for (let i = 0; i < remarkKeys.length; i += 1) {
          const key = remarkKeys[i];
          const val = (car.remarks as any)[key];
          if (val && val.remarks) {
            remark = val.remarks;
            break;
          }
        }
        if (!remark) {
          const allRemarks = Object.entries(car.remarks || {})
            .map(([key, val]: [string, any]) => {
              if (val?.remarks) {
                return `${key}: ${val.remarks}`;
              }
              return '';
            })
            .filter(Boolean);
          remark = allRemarks[0] || '';
        }
        description = remark || '';
      }

      if (!description && car?.remarks && typeof car.remarks === 'object') {
        const remarkLines = Object.entries(car.remarks || {})
          .map(([key, val]: [string, any]) => {
            const text = val?.remarks;
            if (text) {
              return `${key}: ${text}`;
            }
            return '';
          })
          .filter(Boolean);
        if (remarkLines.length > 0) {
          description = remarkLines.join('\n');
        }
      }

      if (!description) {
        const statusDescription =
          car?.currentStatus || car?.inspectionStatus || '';
        const slotDescription = [
          car?.slotDate ? `Date: ${car.slotDate}` : '',
          car?.slotTime ? `Time: ${car.slotTime}` : '',
        ]
          .filter(Boolean)
          .join(' | ');
        description = [statusDescription, slotDescription]
          .filter(Boolean)
          .join(' | ');
      }

      setDetailData({
        title,
        brand: brandName,
        model: modelName,
        variant: variantName,
        customerMobile: car?.customer?.mobile || '',
        fuel:
          car?.fuelType ||
          vehicle.fuelType ||
          vehicle.fuel ||
          vehicle.fuel_type ||
          vehicle.fueltype ||
          '',
        transmission:
          car?.transmission || vehicle.transmission || vehicle.gearbox || '',
        year:
          car?.manufacturingYear ||
          vehicle.make_year ||
          vehicle.year ||
          vehicle.manufactureYear ||
          vehicle.mfgYear ||
          '',
        kms: kms ? String(kms) : '',
        city: car?.currentCity || vehicle.city || '',
        state: car?.state || vehicle.state || '',
        regNumber:
          car?.registrationNumber || car?.rto || vehicle.regNumber || '',
        rto: car?.rto || '',
        ownership: car?.ownerShip || '',
        whenSell: car?.whenWantToSell || '',
        estimatedValue: car?.estimatedValue || '',
        inspectorName:
          car?.inspectedBy?.name || booking.inspectorName || null,
        address: car?.address || '',
        vehicleInfo: car?.vehicleInfo || '',
        vehicleYears: Array.isArray(vehicle?.years)
          ? vehicle.years.join(', ')
          : '',
        currentStatus:
          car?.currentStatus || car?.inspectionStatus || car?.status || '',
        currentRemark: (() => {
          const remarksObj: Record<string, {remarks?: string}> =
            car?.remarks || {};
          const currentKeyRaw =
            (car?.currentStatus || car?.inspectionStatus || '') as string;
          const currentKeyNorm = currentKeyRaw.toLowerCase();
          const match = Object.entries(remarksObj).find(
            ([key, val]: [string, any]) =>
              key.toLowerCase() === currentKeyNorm && val?.remarks,
          );
          if (match && match[1]?.remarks) {
            return match[1].remarks as string;
          }
          const firstNonEmpty = Object.values(remarksObj).find(
            (val: any) => val?.remarks,
          ) as any;
          return (firstNonEmpty?.remarks as string) || '';
        })(),
        description,
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load vehicle details';
      setDetailError(msg);
    } finally {
      setDetailLoading(false);
    }
  };

  const effectiveBookings =
    activeTab === 'bookings' && bookings.length > 0
      ? bookings
      : activeTab === 'bookings' && !loading && !error
      ? []
      : activeTab === 'bookings' && (loading || error)
      ? bookings
      : [];

  const totalToday = effectiveBookings.length;
  const bookedToday = effectiveBookings.filter(
    b => b.status === 'Booked',
  ).length;
  const nextBooking = effectiveBookings[0];

  return (
    <SafeAreaView style={styles.root}>
      {/* Top header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Pressable
            style={styles.headerIconLeft}
            onPress={() => navigation.navigate('Calendar')}>
            <View style={styles.calendarTop} />
            <View style={styles.calendarBody} />
          </Pressable>
          <Text style={styles.headerTitle}>Inspecto</Text>
          <Pressable
            style={styles.headerIconRight}
            onPress={() => navigation.navigate('Profile')}>
            <View style={styles.profileHead} />
            <View style={styles.profileBody} />
          </Pressable>
        </View>

        <View style={styles.headerBottom}>
          <View>
            <Text style={styles.headerGreeting}>Welcome back, operator</Text>
            <Text style={styles.headerSubtitle}>
              {bookedToday} of {totalToday} inspections booked today.
            </Text>
          </View>

          {nextBooking && (
            <View style={styles.nextBadge}>
              <Clock size={14} color={PRIMARY} strokeWidth={2.4} />
              <View style={styles.nextTextWrap}>
                <Text style={styles.nextLabel}>Next at</Text>
                <Text style={styles.nextTime}>{nextBooking.time}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Content */}
      <View style={[styles.content, {paddingBottom: bottomContentInset}]}>
        {activeTab === 'bookings' ? (
          <ScrollView
            contentContainerStyle={[
              styles.listContent,
              {paddingBottom: bottomContentInset},
            ]}
            showsVerticalScrollIndicator={false}>
            {effectiveBookings.map(b => (
              <Pressable
                key={b.id}
                style={styles.card}
                onPress={() => openBookingDetail(b)}
                android_ripple={{color: 'rgba(0,0,0,0.06)'}}>
                <View
                  style={[
                    styles.dateColumn,
                    b.status === 'Completed'
                      ? styles.dateCompleted
                      : b.status === 'Booked'
                      ? styles.dateConfirmed
                      : styles.dateCancelled,
                  ]}>
                  <View style={styles.dateTop}>
                    <Text style={styles.dateMonth}>{b.dateLabel}</Text>
                    <Text style={styles.dateDay}>{b.day}</Text>
                    <Text style={styles.dateStatus}>{b.status}</Text>
                  </View>
                  <View style={styles.dateBottom}>
                    <Text style={styles.dateTime}>{b.time}</Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardNumber}>{b.number}</Text>
                    <Text style={styles.cardType}>
                      {b.inspectorName
                        ? `Inspector: ${b.inspectorName}`
                        : 'Inspector: Not assigned'}
                    </Text>
                  </View>
                  <Text style={styles.cardTitle}>{b.title}</Text>
                  <Text style={styles.cardMeta}>
                    {b.fuel} · {b.transmission} · {b.kms}
                  </Text>
                  <View style={styles.cardAddressRow}>
                    <Text style={styles.cardLocationDot}>⌖</Text>
                    <Text style={styles.cardAddress}>{b.address}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : activeTab === 'owned' ? (
          <View style={{flex: 1}}>
            <View style={styles.filterRow}>
              <Pressable
                style={styles.filterBox}
                onPress={() => setBrandModalVisible(true)}>
                <Text style={styles.filterLabel}>Brand</Text>
                <Text style={styles.filterValue}>
                  {filters.brandId
                    ? brands.find(b => b.id === filters.brandId)
                        ?.display_name ||
                      brands.find(b => b.id === filters.brandId)?.name ||
                      'Brand'
                    : 'All Brands'}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.filterBox,
                  filters.brandId == null && styles.filterBoxDisabled,
                ]}
                disabled={filters.brandId == null}
                onPress={() => setModelModalVisible(true)}>
                <Text style={styles.filterLabel}>Model</Text>
                <Text style={styles.filterValue}>
                  {filters.modelId
                    ? modelsByBrand[filters.brandId || -1]?.find(
                        m => m.id === filters.modelId,
                      )?.display_name ||
                      modelsByBrand[filters.brandId || -1]?.find(
                        m => m.id === filters.modelId,
                      )?.name ||
                      'Model'
                    : 'All Models'}
                </Text>
              </Pressable>
              <Pressable
                style={styles.filterClear}
                onPress={() =>
                  setFilters({brandId: null, modelId: null})
                }>
                <Text style={styles.filterClearText}>Clear</Text>
              </Pressable>
            </View>

            {ownedVehicles.length > 0 ? (
              <ScrollView
                contentContainerStyle={[
                  styles.listContent,
                  {paddingBottom: bottomContentInset},
                ]}
                showsVerticalScrollIndicator={false}>
                {ownedVehicles.map(b => (
                  <View key={`${b.id}-${b.number}`} style={styles.card}>
                    <View
                      style={[
                        styles.dateColumn,
                        b.status === 'Booked'
                          ? styles.dateConfirmed
                          : styles.dateCancelled,
                      ]}>
                      <View style={styles.dateTop}>
                        <Text style={styles.dateMonth}>{b.dateLabel}</Text>
                        <Text style={styles.dateDay}>{b.day}</Text>
                        <Text style={styles.dateStatus}>{b.status}</Text>
                      </View>
                      <View style={styles.dateBottom}>
                        <Text style={styles.dateTime}>
                          {b.isPremium ? 'Premium' : 'Standard'}
                        </Text>
                      </View>
                      </View>

                    <View style={styles.cardBody}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardNumber}>{b.number}</Text>
                        <Text style={styles.cardType}>
                          {b.sold ? 'Sold' : 'Available'}
                        </Text>
                      </View>
                      <Text style={styles.cardTitle}>{b.title}</Text>
                      <Text style={styles.cardMeta}>
                        {b.fuel} • {b.transmission} • {b.kms}
                      </Text>
                      <View style={styles.cardAddressRow}>
                        <Text style={styles.cardLocationDot}>?</Text>
                        <Text style={styles.cardAddress}>{b.address}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={[styles.placeholder, {paddingBottom: bottomContentInset}]}>
                <Text style={styles.placeholderText}>
                  {ownedLoading
                    ? 'Loading owned vehicles...'
                    : ownedError || 'No owned vehicles yet.'}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.placeholder, {paddingBottom: bottomContentInset}]}>
            <Text style={styles.placeholderText}>
              Select a tab to view content.
            </Text>
          </View>
        )}
      </View>

      {/* Bottom tabs */}
      <View
        style={[
          styles.tabBar,
          {
            bottom: 16 + insets.bottom,
            backgroundColor: '#f3f4f6',
            paddingVertical: 6,
          },
        ]}>
        {TABS.map(tab => {
          const animated = animations[tab.key];
          const pillPadding = animated.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 12],
          });
          const labelOpacity = animated;
          const labelMargin = animated.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 6],
          });
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <Pressable
              key={tab.key}
              style={styles.tabPressable}
              onPress={() => {
                if (tab.key === 'profile') {
                  setActiveTab(tab.key);
                  navigation.navigate('Profile');
                } else if (tab.key === 'calendar') {
                  navigation.navigate('Calendar');
                } else {
                  setActiveTab(tab.key);
                }
              }}>
              <Animated.View
                style={[
                  styles.tab,
                  {
                    paddingHorizontal: pillPadding,
                    backgroundColor: isActive ? '#ffffff' : 'transparent',
                  },
                ]}>
                <Icon
                  size={20}
                  color={isActive ? PRIMARY : '#9ca3af'}
                  strokeWidth={2.2}
                />
                {isActive && (
                  <Animated.Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                      styles.tabText,
                    styles.tabLabel,
                    {
                      opacity: labelOpacity,
                      marginLeft: labelMargin,
                      color: PRIMARY,
                    },
                  ]}>
                    {tab.label}
                  </Animated.Text>
                )}
              </Animated.View>
            </Pressable>
          );
        })}
      </View>

      {detailVisible && (
        <View style={styles.detailOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeDetail}
            android_ripple={{color: 'transparent'}}
          />
          <View style={styles.detailOverlayContent}>
            <Animated.View
              style={[
                styles.detailScreen,
                {
                  opacity: detailAnim,
                  transform: [
                    {
                      scale: detailAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.94, 1],
                      }),
                    },
                  ],
                },
              ]}>
              <ScrollView
                style={{flex: 1}}
                contentContainerStyle={styles.detailContent}
                showsVerticalScrollIndicator>
                <View style={styles.detailHeaderRow}>
                  <View style={{flex: 1, paddingRight: 10}}>
                    <Text style={styles.detailTitle}>
                      {detailData?.title ||
                        detailBooking?.title ||
                        'Vehicle details'}
                    </Text>
                    <View style={styles.detailHeaderSubRow}>
                      {detailBooking?.time ? (
                        <Text style={styles.detailSubTitle}>
                          {detailBooking.time} ·{' '}
                          {detailBooking.status === 'Booked'
                            ? 'Booked'
                            : 'Unassigned'}
                        </Text>
                      ) : null}
                      {detailData?.currentStatus ? (
                        <Text style={styles.detailStatusText}>
                          {detailData.currentStatus}
                        </Text>
                      ) : null}
                    </View>
                    {detailData?.customerMobile ? (
                      <Text style={styles.detailMobile}>
                        {detailData.customerMobile}
                      </Text>
                    ) : null}
                    {detailData?.variant ? (
                      <View style={styles.detailVariantPill}>
                        <Text style={styles.detailVariantText}>
                          {detailData.variant}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Pressable onPress={closeDetail} hitSlop={12}>
                    <Text style={styles.detailClose}>X</Text>
                  </Pressable>
                </View>

                {detailLoading ? (
                  <View style={styles.detailSkeleton}>
                    <View style={styles.skeletonLineWide} />
                    <View style={styles.skeletonLine} />
                    <View style={styles.skeletonLineSmall} />
                  </View>
                ) : detailError ? (
                  <Text style={styles.detailError}>{detailError}</Text>
                ) : (
                  <>
                    <View style={styles.detailMetaRow}>
                      <View style={styles.detailChip}>
                        <Text style={styles.detailChipLabel}>Inspector</Text>
                        <Text style={styles.detailChipValue}>
                          {detailData?.inspectorName ||
                            detailBooking?.inspectorName ||
                            'Not assigned'}
                        </Text>
                      </View>
                      {detailData?.rto ? (
                        <View style={styles.detailChip}>
                          <Text style={styles.detailChipLabel}>RTO</Text>
                          <Text style={styles.detailChipValue}>
                            {detailData.rto}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.detailMetaRow}>
                      {detailData?.ownership ? (
                        <View style={styles.detailChip}>
                          <Text style={styles.detailChipLabel}>Ownership</Text>
                          <Text style={styles.detailChipValue}>
                            {detailData.ownership}
                          </Text>
                        </View>
                      ) : null}
                      {detailData?.fuel ? (
                        <View style={styles.detailChip}>
                          <Text style={styles.detailChipLabel}>Fuel</Text>
                          <Text style={styles.detailChipValue}>
                            {detailData.fuel}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.detailMetaRow}>
                      {detailData?.transmission ? (
                        <View style={styles.detailChip}>
                          <Text style={styles.detailChipLabel}>Transmission</Text>
                          <Text style={styles.detailChipValue}>
                            {detailData.transmission}
                          </Text>
                        </View>
                      ) : null}
                      {detailData?.year ? (
                        <View style={styles.detailChip}>
                          <Text style={styles.detailChipLabel}>Year</Text>
                          <Text style={styles.detailChipValue}>
                            {detailData.year}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.detailMetaRow}>
                      {detailData?.kms ? (
                        <View style={styles.detailChip}>
                          <Text style={styles.detailChipLabel}>Kms</Text>
                          <Text style={styles.detailChipValue}>
                            {detailData.kms}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {(detailData?.city || detailData?.state) && (
                      <View style={styles.detailMetaRow}>
                        <View style={[styles.detailChip, {flex: 1}]}>
                          <Text style={styles.detailChipLabel}>Location</Text>
                          <Text style={styles.detailChipValue}>
                            {[detailData?.city, detailData?.state]
                              .filter(Boolean)
                              .join(', ')}
                          </Text>
                        </View>
                      </View>
                    )}

                    {detailData?.address ? (
                      <View style={styles.detailMetaRow}>
                        <View style={[styles.detailChip, {flex: 1}]}>
                          <Text style={styles.detailChipLabel}>Address</Text>
                          <Text style={styles.detailChipValue}>
                            {detailData.address}
                          </Text>
                        </View>
                      </View>
                    ) : null}

                    {detailData?.currentRemark || detailData?.description ? (
                      <View style={styles.detailRemarksBlock}>
                        <Text style={styles.detailRemarksTitle}>Remark</Text>
                        <View style={styles.remarkRow}>
                          <View style={styles.remarkDot} />
                          <Text style={styles.remarkText}>
                            {detailData.currentRemark || detailData.description}
                          </Text>
                        </View>
                      </View>
                    ) : null}

                    <View style={styles.detailButtonRow}>
                      <Pressable
                        style={styles.detailButton}
                        onPress={closeDetail}
                        android_ripple={{color: 'rgba(0,0,0,0.08)'}}>
                        <Text style={styles.detailButtonText}>Close</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.detailButton, styles.detailButtonPrimary]}
                        onPress={() => {
                          const targetId =
                            detailBooking?.sellCarId || detailBooking?.id;
                          closeDetail();
                          if (targetId) {
                            navigation.navigate('Inspection', {
                              sellCarId: targetId,
                            });
                          }
                        }}
                        android_ripple={{color: 'rgba(255,255,255,0.12)'}}>
                        <Text style={styles.detailButtonTextPrimary}>
                          Begin inspection
                        </Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </ScrollView>
            </Animated.View>
          </View>
        </View>
      )}

      <Modal
        visible={brandModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBrandModalVisible(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setBrandModalVisible(false)}>
          <View style={styles.modalSheet}>
            <ScrollView>
              <Pressable
                style={styles.modalItem}
                onPress={() => {
                  setFilters({brandId: null, modelId: null});
                  setBrandModalVisible(false);
                }}>
                <Text style={styles.modalItemText}>All Brands</Text>
              </Pressable>
              {brands.map(b => (
                <Pressable
                  key={b.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setFilters({brandId: b.id, modelId: null});
                    setBrandModalVisible(false);
                  }}>
                  <Text style={styles.modalItemText}>
                    {b.display_name || b.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={modelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModelModalVisible(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModelModalVisible(false)}>
          <View style={styles.modalSheet}>
            <ScrollView>
              <Pressable
                style={styles.modalItem}
                onPress={() => {
                  setFilters(prev => ({
                    ...prev,
                    modelId: null,
                  }));
                  setModelModalVisible(false);
                }}>
                <Text style={styles.modalItemText}>All Models</Text>
              </Pressable>
              {(modelsByBrand[filters.brandId || -1] || []).map(m => (
                <Pressable
                  key={m.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setFilters(prev => ({
                      ...prev,
                      modelId: m.id,
                    }));
                    setModelModalVisible(false);
                  }}>
                  <Text style={styles.modalItemText}>
                    {m.display_name || m.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: PRIMARY,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerIconLeft: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5f4ff',
    padding: 3,
    justifyContent: 'space-between',
  },
  calendarTop: {
    height: 6,
    borderBottomWidth: 1,
    borderColor: '#e5f4ff',
  },
  calendarBody: {
    flex: 1,
    marginTop: 2,
    backgroundColor: 'transparent',
  },
  headerIconRight: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5f4ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHead: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6b7280',
    marginBottom: 2,
  },
  profileBody: {
    width: 16,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6b7280',
  },
  headerBottom: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerGreeting: {
    color: '#fee2e2',
    fontSize: 13,
    fontWeight: '500',
  },
  headerSubtitle: {
    marginTop: 2,
    color: '#fecaca',
    fontSize: 11,
  },
  nextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  nextTextWrap: {
    marginLeft: 6,
  },
  nextLabel: {
    fontSize: 10,
    color: '#6b7280',
  },
  nextTime: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY,
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 80,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  dateColumn: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateConfirmed: {
    backgroundColor: '#fbbf24',
  },
  dateCompleted: {
    backgroundColor: '#22c55e',
  },
  dateCancelled: {
    backgroundColor: '#9ca3af',
  },
  dateTop: {
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: 'center',
  },
  dateBottom: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  dateMonth: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  dateDay: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  dateStatus: {
    color: '#ffffff',
    fontSize: 10,
    marginTop: 2,
  },
  dateTime: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardNumber: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '600',
  },
  cardType: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '600',
  },
  cardTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardMeta: {
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 6,
  },
  cardAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLocationDot: {
    fontSize: 10,
    color: '#6b7280',
    marginRight: 4,
  },
  cardAddress: {
    flex: 1,
    color: '#6b7280',
    fontSize: 11,
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
  },
  tabPressable: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    maxWidth: 90,
    overflow: 'hidden',
  },
  tabLabel: {
    // Additional spacing handled via animation
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  placeholderText: {
    color: '#6b7280',
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  filterBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    elevation: 1,
  },
  filterBoxDisabled: {
    opacity: 0.5,
  },
  filterLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 4,
  },
  filterValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
  },
  filterClear: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: PRIMARY,
    borderRadius: 10,
  },
  filterClearText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    padding: 20,
  },
  modalSheet: {
    maxHeight: '70%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 8,
  },
  modalItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  modalItemText: {
    fontSize: 14,
    color: '#111827',
  },
  detailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingTop: 12,
  },
  detailOverlayContent: {
    flex: 1,
  },
  detailScreen: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: {width: 0, height: 8},
    shadowRadius: 20,
    elevation: 8,
  },
  detailContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  detailSubTitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
  },
  detailHeaderSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  detailStatusText: {
    fontSize: 11,
    color: '#9ca3af',
    marginLeft: 8,
  },
  detailMobile: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  detailVariantPill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  detailVariantText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  detailClose: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6b7280',
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  detailChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    minWidth: 130,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  detailChipLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
  },
  detailChipValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
  },
  detailError: {
    fontSize: 13,
    color: '#b91c1c',
    marginTop: 4,
  },
  detailSkeleton: {
    marginTop: 6,
  },
  detailButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  detailButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    marginRight: 10,
  },
  detailButtonPrimary: {
    marginRight: 0,
    backgroundColor: PRIMARY,
  },
  detailButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  detailButtonTextPrimary: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  detailRemarksBlock: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
  },
  detailRemarksTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  remarkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  remarkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    marginRight: 8,
    backgroundColor: PRIMARY,
  },
  remarkText: {
    fontSize: 12,
    color: '#374151',
    marginTop: 2,
    lineHeight: 16,
  },
  skeletonLine: {
    height: 10,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
    marginTop: 6,
    marginRight: 40,
  },
  skeletonLineWide: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
    marginTop: 4,
    marginRight: 10,
  },
  skeletonLineSmall: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
    marginTop: 6,
    marginRight: 80,
  },
});
