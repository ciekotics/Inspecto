import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  RefreshControl,
  Easing,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Calendar, ChevronLeft, ChevronRight, Star, X} from 'lucide-react-native';
import {PRIMARY} from '../utils/theme';
import {client} from '../utils/apiClient';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {setCalendarSlots} from '../store/slices/calendarSlotsSlice';

type CalendarSlotStatus = 'Booked' | 'Unassigned' | 'Completed';

type CalendarSlot = {
  id: string;
  sellCarId?: string;
  time: string;
  title: string;
  inspectorName: string | null;
  status: CalendarSlotStatus;
  date: string; // DD/MM/YYYY
  rating?: number | null;
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MONTH_LABELS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_LABELS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const normalizeName = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toUpperCase();

const normalizeStatusValue = (val: any) =>
  String(val || '').trim().toUpperCase();

const extractStartTime = (timeRange: string | undefined) => {
  if (!timeRange) {
    return '';
  }
  const [start] = timeRange.split('-');
  return (start || '').trim();
};

const TODAY = new Date();
const TODAY_DAY = TODAY.getDate();
const TODAY_MONTH = TODAY.getMonth();
const TODAY_YEAR = TODAY.getFullYear();

export default function CalendarScreen() {
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<'today' | 'week' | 'all'>('today');
  const [selectedDay, setSelectedDay] = useState<number>(TODAY_DAY);
  const [currentMonth, setCurrentMonth] = useState<number>(TODAY_MONTH);
  const [currentYear, setCurrentYear] = useState<number>(TODAY_YEAR);
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailSlot, setDetailSlot] = useState<CalendarSlot | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const auth = useAppSelector(state => state.auth);
  const calendarCache = useAppSelector(state => state.calendarSlots);
  const dispatch = useAppDispatch();
  const monthAnim = React.useRef(new Animated.Value(0)).current;
  const detailAnim = React.useRef(new Animated.Value(0)).current;
  const completionAnim = useRef(new Animated.Value(0)).current;
  const completionSeen = useRef(false);
  const monthDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    return Array.from({length: daysInMonth}, (_, i) => i + 1);
  }, [currentMonth, currentYear]);

  useEffect(() => {
    const statusStr =
      (detailSlot?.status || detailData?.currentStatus || '')?.toString?.() ||
      '';
    const isCompleted = statusStr.toLowerCase().includes('completed');
    if (detailVisible && isCompleted && !completionSeen.current) {
      completionSeen.current = true;
      completionAnim.setValue(0);
      Animated.timing(completionAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    } else if (!detailVisible) {
      completionSeen.current = false;
      completionAnim.setValue(0);
    }
  }, [detailVisible, detailSlot, detailData, completionAnim]);

  useEffect(() => {
    const maxDay = monthDays[monthDays.length - 1] || TODAY_DAY;
    if (selectedDay > maxDay) {
      setSelectedDay(maxDay);
    }
  }, [monthDays, selectedDay]);

  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    let cancelled = false;

    const fetchAllSlots = async (params: any) => {
      const pageSize = 25;
      let offset = 0;
      let all: any[] = [];
      let total: number | null = null;

      // Paginate in chunks of 25 until we've fetched everything.
      // Backend currently does not support date-based filtering.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res = await client.get('/api/view-inspection-slots', {
          params: {...params, limit: pageSize, offset},
        });
        const data = res.data?.data || {};
        const page: any[] = data.allSlots ?? [];
        const count: number | undefined = data.count;

        if (typeof count === 'number' && total == null) {
          total = count;
        }

        all = all.concat(page);
        offset += pageSize;

        if (page.length < pageSize) {
          break;
        }
        if (total != null && all.length >= total) {
          break;
        }
      }

      return all;
    };

    const fetchSlots = async () => {
      if (!auth.token) {
        setSlots([]);
        return;
      }

      const now = Date.now();
      const cachedSlots = Array.isArray(calendarCache.slots)
        ? (calendarCache.slots as CalendarSlot[])
        : [];
      const hasFreshCache =
        cachedSlots.length > 0 &&
        calendarCache.lastFetchedAt != null &&
        now - calendarCache.lastFetchedAt < CACHE_TTL_MS;

      if (hasFreshCache) {
        setSlots(cachedSlots);
        setLoading(false);
        setError(null);
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
          status: true,
        };

        let effectiveInspectorName: string | null = fullName || null;

        if (!isSuperAdmin) {
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
                effectiveInspectorName = String(match.name || fullName);
              }
            }
          } catch (evalErr) {
            console.error('[CalendarScreen] Failed to load evaluators', {
              message: (evalErr as any)?.message,
            });
          }
        }

        const rawSlots = await fetchAllSlots(baseParams);

        const normalizedInspector = effectiveInspectorName
          ? normalizeName(effectiveInspectorName)
          : null;

        let visibleSlots = rawSlots.filter(slot => {
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
              if (!normalizedInspector) {
                return false;
              }
              return inspectorNorm === normalizedInspector;
            }
            if (!inspectorRaw || inspectorNorm === 'NOT ASSIGNED') {
              return true;
            }
            if (normalizedInspector) {
              return inspectorNorm === normalizedInspector;
            }
            return false;
          });
        }

        const mapped: CalendarSlot[] = visibleSlots.map(slot => {
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
            !!inspectorRaw && inspectorNorm !== 'NOT ASSIGNED';
          const statusNorm = normalizeStatusValue(
            slot.currentStatus || slot.status,
          );
          const isCompleted = statusNorm.includes('COMPLETED');
          const status: CalendarSlotStatus = isCompleted
            ? 'Completed'
            : isAssigned
            ? 'Booked'
            : 'Unassigned';
          const ratingRaw =
            slot?.evaluatorRating ??
            slot?.rating ??
            slot?.evaluator_rating ??
            slot?.ratingValue;
          const ratingNum =
            ratingRaw != null && !Number.isNaN(Number(ratingRaw))
              ? Number(ratingRaw)
              : null;
          const sellCarId =
            slot.sellCarId != null ? slot.sellCarId : slot.id;

          return {
            id: String(slot.id ?? slot.sellCarId ?? ''),
            sellCarId: sellCarId != null ? String(sellCarId) : undefined,
            time: extractStartTime(
              typeof slot.time === 'string' ? slot.time : undefined,
            ),
            title: titleParts || 'Inspection',
            inspectorName: inspectorRaw || null,
            status,
            rating: ratingNum,
            date: String(slot.date || ''),
          };
        });

        if (!cancelled) {
          setSlots(mapped);
          dispatch(
            setCalendarSlots({slots: mapped as any[], fetchedAt: Date.now()}),
          );
        }
      } catch (err: any) {
        console.error('[CalendarScreen] Failed to load slots', {
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
          setSlots([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchSlots();

    return () => {
      cancelled = true;
    };
  }, [auth.token, auth.user, calendarCache.lastFetchedAt]);

  // Group slots by day for the currently visible month/year.
  const slotsByDay = useMemo(() => {
    const map: Record<number, CalendarSlot[]> = {};
    slots.forEach(slot => {
      const parts = slot.date ? slot.date.split('/') : null;
      if (!parts || parts.length !== 3) {
        return;
      }
      const [dd, mm, yyyy] = parts;
      const day = Number(dd);
      const monthIdx = Number(mm) - 1;
      const year = Number(yyyy);
      if (
        Number.isNaN(day) ||
        Number.isNaN(monthIdx) ||
        Number.isNaN(year) ||
        monthIdx !== currentMonth ||
        year !== currentYear
      ) {
        return;
      }
      if (!map[day]) {
        map[day] = [];
      }
      map[day].push(slot);
    });
    return map;
  }, [slots, currentMonth, currentYear]);

  const dayMetaByDay = useMemo(() => {
    const meta: Record<
      number,
      {completed: CalendarSlot[]; pending: CalendarSlot[]; rating: number | null}
    > = {};

    Object.entries(slotsByDay).forEach(([dayKey, daySlots]) => {
      const day = Number(dayKey);
      const completed = (daySlots as CalendarSlot[]).filter(
        slot => slot.status === 'Completed',
      );
      const pending = (daySlots as CalendarSlot[]).filter(
        slot => slot.status !== 'Completed',
      );
      const ratingValues = completed
        .map(slot =>
          typeof slot.rating === 'number'
            ? slot.rating
            : Number(slot.rating),
        )
        .filter(val => Number.isFinite(val)) as number[];
      const ratingAvg =
        ratingValues.length > 0
          ? ratingValues.reduce((sum, val) => sum + val, 0) /
            ratingValues.length
          : null;
      meta[day] = {completed, pending, rating: ratingAvg};
    });

    return meta;
  }, [slotsByDay]);

  const slotsForSelectedDay = useMemo(() => {
    const base = slotsByDay[selectedDay] || [];
    if (filter === 'today') {
      return base;
    }
    if (filter === 'week') {
      // Show inspections within +/- 3 days in the same month/year.
      const daysInRange = new Set<number>();
      for (let d = selectedDay - 3; d <= selectedDay + 3; d += 1) {
        if (d >= 1 && d <= 31) {
          daysInRange.add(d);
        }
      }
      const combined: CalendarSlot[] = [];
      daysInRange.forEach(day => {
        const daySlots = slotsByDay[day];
        if (daySlots) {
          combined.push(...daySlots);
        }
      });
      return combined;
    }
    // All inspections for the visible month/year.
    const allForMonth: CalendarSlot[] = [];
    Object.keys(slotsByDay).forEach(key => {
      const daySlots = slotsByDay[Number(key)];
      if (daySlots) {
        allForMonth.push(...daySlots);
      }
    });
    return allForMonth;
  }, [slotsByDay, selectedDay, filter]);

  const isTodaySelected =
    selectedDay === TODAY_DAY &&
    currentMonth === TODAY_MONTH &&
    currentYear === TODAY_YEAR;

  const closeDetail = () => {
    Animated.timing(detailAnim, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(() => {
      setDetailVisible(false);
      setDetailSlot(null);
      setDetailData(null);
      setDetailError(null);
    });
  };

  const openDetail = async (slot: CalendarSlot) => {
    setDetailSlot(slot);
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
        (slot.sellCarId && (Number(slot.sellCarId) || slot.sellCarId)) ||
        Number(slot.id) ||
        slot.id;
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
        slot.title ||
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

      if (
        !description &&
        car?.remarks &&
        typeof car.remarks === 'object'
      ) {
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
          car?.currentStatus ||
          car?.inspectionStatus ||
          '';
        const slotDescription = [
          car?.slotDate ? `Date: ${car.slotDate}` : '',
          car?.slotTime ? `Time: ${car.slotTime}` : '',
        ]
          .filter(Boolean)
          .join(' • ');
        description = [statusDescription, slotDescription]
          .filter(Boolean)
          .join(' • ');
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
          car?.inspectedBy?.name || detailSlot?.inspectorName || null,
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

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable
          style={styles.headerIconLeft}
          onPress={() => navigation.goBack()}>
          <ChevronLeft size={18} color="#fee2e2" strokeWidth={2.2} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Calendar</Text>
          <Text style={styles.headerSubtitle}>Inspections & operators</Text>
        </View>
        <View style={styles.headerIconRight}>
          <Calendar size={18} color="#fee2e2" strokeWidth={2.1} />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.monthContainer}>
          <View style={styles.monthHeaderRow}>
            <View>
              <Text style={styles.monthTitle}>
                {MONTH_LABELS_FULL[currentMonth]} {currentYear}
              </Text>
              <Text style={styles.monthSubtitle}>
                Tap a date to focus inspections.
              </Text>
            </View>
            <View style={styles.monthArrows}>
              <Pressable
                style={styles.monthArrowBtn}
                onPress={() => {
                  const nextMonth = currentMonth === 0 ? 11 : currentMonth - 1;
                  const nextYear =
                    currentMonth === 0 ? currentYear - 1 : currentYear;
                  Animated.timing(monthAnim, {
                    toValue: 1,
                    duration: 140,
                    useNativeDriver: true,
                  }).start(() => {
                    setCurrentMonth(nextMonth);
                    setCurrentYear(nextYear);
                    monthAnim.setValue(-1);
                    Animated.timing(monthAnim, {
                      toValue: 0,
                      duration: 180,
                      useNativeDriver: true,
                    }).start();
                  });
                }}>
                <ChevronLeft size={16} color={PRIMARY} strokeWidth={2.2} />
              </Pressable>
              <Pressable
                style={[styles.monthArrowBtn, {marginLeft: 6}]}
                onPress={() => {
                  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
                  const nextYear =
                    currentMonth === 11 ? currentYear + 1 : currentYear;
                  Animated.timing(monthAnim, {
                    toValue: -1,
                    duration: 140,
                    useNativeDriver: true,
                  }).start(() => {
                    setCurrentMonth(nextMonth);
                    setCurrentYear(nextYear);
                    monthAnim.setValue(1);
                    Animated.timing(monthAnim, {
                      toValue: 0,
                      duration: 180,
                      useNativeDriver: true,
                    }).start();
                  });
                }}>
                <ChevronRight size={16} color={PRIMARY} strokeWidth={2.2} />
              </Pressable>
            </View>
          </View>

          <Animated.View
            style={[
              styles.calendarShell,
              {
                transform: [
                  {
                    translateX: monthAnim.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: [24, 0, -24],
                    }),
                  },
                ],
                opacity: monthAnim.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: [0.85, 1, 0.85],
                }),
              },
            ]}>
            <View style={styles.weekRow}>
              {WEEKDAYS.map((day, index) => (
                <Text key={`${day}-${index}`} style={styles.weekLabel}>
                  {day}
                </Text>
              ))}
            </View>
            <View style={styles.dateGrid}>
              {monthDays.map(day => {
                if (loading) {
                  return (
                    <View key={day} style={styles.dateCell}>
                      <View style={[styles.datePill, styles.datePillSkeleton]} />
                    </View>
                  );
                }
                const isSelected = day === selectedDay;
                const dayMeta = dayMetaByDay[day];
                const completedCount = dayMeta?.completed.length || 0;
                const hasPending = (dayMeta?.pending.length || 0) > 0;
                return (
                  <Pressable
                    key={day}
                    style={styles.dateCell}
                    onPress={() => {
                      setSelectedDay(day);
                      setFilter('today');
                    }}>
                    <View style={styles.datePillWrapper}>
                      {completedCount > 0 && (
                        <View style={styles.dateBadge}>
                          <Text style={styles.dateBadgeText}>
                            {completedCount}
                          </Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.datePill,
                          isSelected && styles.datePillSelected,
                        ]}>
                        <Text
                          style={[
                            styles.dateText,
                            isSelected && styles.dateTextSelected,
                          ]}>
                          {day}
                        </Text>
                      </View>
                    </View>
                    {hasPending && (
                      <View
                        style={[
                          styles.dateDot,
                          isSelected && styles.dateDotSelected,
                        ]}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.filterRow}>
              {/* Primary chip: Today or selected date + clear */}
              <Pressable
                onPress={() => {
                  setFilter('today');
                }}>
                <View
                  style={[
                    styles.filterChip,
                    filter === 'today' && styles.filterChipActive,
                  ]}>
                  <Text
                    style={[
                      styles.filterChipText,
                      filter === 'today' && styles.filterChipTextActive,
                    ]}>
                    {isTodaySelected
                      ? 'Today'
                      : `${selectedDay} ${MONTH_LABELS_SHORT[currentMonth]}`}
                  </Text>
                  {!isTodaySelected && (
                    <Pressable
                      hitSlop={8}
                      onPress={() => {
                        setSelectedDay(TODAY_DAY);
                        setCurrentMonth(TODAY_MONTH);
                        setCurrentYear(TODAY_YEAR);
                        setFilter('today');
                      }}>
                      <Text style={styles.filterChipClear}>×</Text>
                    </Pressable>
                  )}
                </View>
              </Pressable>

              {/* Secondary chips */}
              <Pressable onPress={() => setFilter('week')}>
                <View
                  style={[
                    styles.filterChip,
                    filter === 'week' && styles.filterChipActive,
                    {marginLeft: 8},
                  ]}>
                  <Text
                    style={[
                      styles.filterChipText,
                      filter === 'week' && styles.filterChipTextActive,
                    ]}>
                    This week
                  </Text>
                </View>
              </Pressable>
              <Pressable onPress={() => setFilter('all')}>
                <View
                  style={[
                    styles.filterChip,
                    filter === 'all' && styles.filterChipActive,
                    {marginLeft: 8},
                  ]}>
                  <Text
                    style={[
                      styles.filterChipText,
                      filter === 'all' && styles.filterChipTextActive,
                    ]}>
                    All inspections
                  </Text>
                </View>
              </Pressable>
            </View>
          </Animated.View>
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              colors={[PRIMARY]}
              tintColor={PRIMARY}
              onRefresh={async () => {
                setRefreshing(true);
                // Invalidate cache by setting lastFetchedAt far in the past.
                dispatch(
                  setCalendarSlots({
                    slots: calendarCache.slots,
                    fetchedAt: 0,
                  }),
                );
                setRefreshing(false);
              }}
            />
          }>
          {loading ? (
            <>
              {[1, 2, 3].map(i => (
                <View key={i} style={[styles.card, styles.cardSkeleton]}>
                  <View style={[styles.timePill, styles.timePillSkeleton]} />
                  <View style={styles.cardBody}>
                    <View style={styles.skeletonLineWide} />
                    <View style={styles.skeletonLine} />
                    <View style={styles.skeletonLineSmall} />
                  </View>
                </View>
              ))}
            </>
          ) : error && slotsForSelectedDay.length === 0 ? (
            <Text style={styles.secondaryText}>{error}</Text>
          ) : slotsForSelectedDay.length === 0 ? (
            <Text style={styles.secondaryText}>
              No inspections for this date.
            </Text>
          ) : (
            slotsForSelectedDay.map((slot, index) => {
              const isBooked = slot.status === 'Booked';
              const isCompleted = slot.status === 'Completed';
              const statusPillStyle = isCompleted
                ? styles.statusPillCompleted
                : isBooked
                ? styles.statusPillBooked
                : styles.statusPillUnassigned;
              const statusTextStyle = isCompleted
                ? styles.statusTextCompleted
                : isBooked
                ? styles.statusTextBooked
                : styles.statusTextUnassigned;
              const ratingRounded =
                slot.rating != null && !Number.isNaN(Number(slot.rating))
                  ? Math.max(
                      0,
                      Math.min(5, Math.round(Number(slot.rating))),
                    )
                  : null;
              const key = `${slot.id}-${slot.date}-${slot.time}-${index}`;
              return (
                <Pressable
                  key={key}
                  style={styles.card}
                  onPress={() => openDetail(slot)}>
                  <View style={styles.timePill}>
                    <Text style={styles.timeText}>{slot.time}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.cardTitle}>{slot.title}</Text>
                      <View
                        style={[
                          styles.statusPill,
                          statusPillStyle,
                        ]}>
                        <Text
                          style={[
                            styles.statusText,
                            statusTextStyle,
                          ]}>
                          {slot.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.operatorText}>
                      {slot.inspectorName
                        ? `Inspector: ${slot.inspectorName}`
                        : 'Inspector: Not assigned'}
                    </Text>
                    <Text style={styles.secondaryText}>
                      Tap a date above to change the inspection focus.
                    </Text>
                    {isCompleted && ratingRounded != null && (
                      <View style={styles.cardRatingRow}>
                        {[1, 2, 3, 4, 5].map(star => {
                          const active =
                            ratingRounded != null && ratingRounded >= star;
                          return (
                            <Star
                              key={`card-star-${slot.id}-${star}`}
                              size={12}
                              color={active ? '#22c55e' : '#d1d5db'}
                              fill={active ? '#22c55e' : 'none'}
                              strokeWidth={2}
                            />
                          );
                        })}
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
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
                        detailSlot?.title ||
                        'Vehicle details'}
                    </Text>
                    <View style={styles.detailHeaderSubRow}>
                      {detailSlot?.time ? (
                        <Text style={styles.detailSubTitle}>
                          {detailSlot.time} | {detailSlot.status}
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
                    <X size={18} color="#6b7280" strokeWidth={2.2} />
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
                            detailSlot?.inspectorName ||
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

                    {(() => {
                      const statusStr =
                        (detailSlot?.status ||
                          detailData?.currentStatus ||
                          '')?.toString?.() || '';
                      const isCompleted = statusStr
                        .toLowerCase()
                        .includes('completed');
                      const targetId =
                        detailSlot?.sellCarId || detailSlot?.id;
                      const redRow = detailData?.currentRemark ? (
                        <View style={styles.remarkRow}>
                          <View style={styles.remarkDot} />
                          <Text style={styles.remarkText}>
                            {detailData.currentRemark}
                          </Text>
                        </View>
                      ) : null;
                      const greenRow = isCompleted ? (
                        <>
                          {redRow ? (
                            <Animated.View
                              style={[
                                styles.remarkConnector,
                                {
                                  transform: [{scaleY: completionAnim}],
                                  opacity: completionAnim,
                                },
                              ]}
                            />
                          ) : null}
                          <View style={styles.remarkRow}>
                            <View style={styles.remarkDotGreen} />
                            <Text
                              style={[styles.remarkText, styles.remarkTextGreen]}>
                              Inspection Done
                            </Text>
                          </View>
                        </>
                      ) : null;
                      const remarksBlock =
                        detailData?.currentRemark || isCompleted ? (
                          <View style={styles.detailRemarksBlock}>
                            <Text style={styles.detailRemarksTitle}>Remark</Text>
                            {redRow}
                            {greenRow}
                          </View>
                        ) : null;

                      if (isCompleted) {
                        return (
                          <>
                            {remarksBlock}
                            <View style={styles.detailInfoRow}>
                              <Text style={styles.detailInfoText}>
                                Inspection completed. View or edit details.
                              </Text>
                            </View>
                            <View style={styles.detailButtonRow}>
                              <Pressable
                                style={[styles.detailButton, styles.detailButtonHalf]}
                                onPress={closeDetail}
                                android_ripple={{color: 'rgba(0,0,0,0.08)'}}>
                                <Text style={styles.detailButtonText}>Close</Text>
                              </Pressable>
                              <Pressable
                                style={[styles.detailButton, styles.detailButtonPrimary, styles.detailButtonHalfRight]}
                                onPress={() => {
                                  closeDetail();
                                  if (targetId) {
                                    navigation.navigate('Inspection', {
                                      sellCarId: targetId,
                                    });
                                  }
                                }}
                                android_ripple={{color: 'rgba(255,255,255,0.12)'}}>
                                <Text style={styles.detailButtonTextPrimary}>Click to view</Text>
                              </Pressable>
                            </View>
                          </>
                        );
                      }
                      return (
                        <>
                          {remarksBlock}
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
                                closeDetail();
                                if (targetId) {
                                  navigation.navigate('Inspection', {
                                    sellCarId: targetId,
                                  });
                                }
                              }}
                              android_ripple={{color: 'rgba(255,255,255,0.12)'}}>
                              <Text style={styles.detailButtonTextPrimary}>Begin inspection</Text>
                            </Pressable>
                          </View>
                        </>
                      );
                    })()}
                  </>
                )}
              </ScrollView>
            </Animated.View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: PRIMARY,
  },
  headerIconLeft: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  backText: {
    fontSize: 18,
    color: '#fee2e2',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    marginTop: 2,
  },
  headerIconRight: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  content: {
    flex: 1,
  },
  monthContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  monthSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#6b7280',
  },
  monthArrows: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
  },
  monthArrowText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: '700',
  },
  calendarShell: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: {width: 0, height: 4},
    shadowRadius: 10,
    elevation: 2,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  weekLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '600',
  },
  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dateCell: {
    width: `${100 / 7}%`,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  datePillWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePill: {
    width: 30,
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePillSelected: {
    backgroundColor: '#fee2e2',
  },
  datePillSkeleton: {
    backgroundColor: '#e5e7eb',
  },
  dateText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '500',
  },
  dateTextSelected: {
    color: PRIMARY,
    fontWeight: '700',
  },
  dateBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  dateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  dateDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
    backgroundColor: '#ef4444',
  },
  dateDotSelected: {
    backgroundColor: '#b91c1c',
  },
  filterRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#fee2e2',
  },
  filterChipText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: PRIMARY,
    fontWeight: '600',
  },
  filterChipClear: {
    marginLeft: 6,
    fontSize: 12,
    color: '#6b7280',
  },
  list: {
    marginTop: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 16,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: {width: 0, height: 4},
    shadowRadius: 12,
    elevation: 2,
  },
  cardSkeleton: {
    backgroundColor: '#f3f4f6',
  },
  timePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    marginRight: 10,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  timePillSkeleton: {
    backgroundColor: '#e5e7eb',
  },
  cardBody: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    flex: 1,
    marginRight: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 11,
    color: PRIMARY,
    fontWeight: '600',
  },
  statusPillBooked: {
    backgroundColor: '#fbbf24',
  },
  statusPillCompleted: {
    backgroundColor: '#22c55e',
  },
  statusPillUnassigned: {
    backgroundColor: '#9ca3af',
  },
  statusTextBooked: {
    color: '#92400e',
  },
  statusTextCompleted: {
    color: '#ffffff',
  },
  statusTextUnassigned: {
    color: '#ffffff',
  },
  operatorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#4b5563',
  },
  secondaryText: {
    marginTop: 2,
    fontSize: 11,
    color: '#9ca3af',
  },
  cardRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
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
  detailInfoRow: {
    padding: 12,
    marginTop: 6,
    marginBottom: 10,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 10,
    position: 'relative',
  },
  detailInfoText: {
    fontSize: 12,
    color: '#15803d',
    textAlign: 'center',
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
  detailButtonHalf: {
    flex: 1,
    marginRight: 10,
  },
  detailButtonHalfRight: {
    flex: 1,
    marginRight: 0,
    marginLeft: 10,
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
  remarkConnector: {
    width: 2,
    height: 16,
    marginLeft: 4,
    marginVertical: 4,
    backgroundColor: '#16a34a',
    borderRadius: 2,
  },
  remarkDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    marginRight: 8,
    backgroundColor: '#16a34a',
  },
  remarkLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  remarkText: {
    fontSize: 12,
    color: '#374151',
    marginTop: 2,
    lineHeight: 16,
  },
  remarkTextGreen: {
    color: '#15803d',
    fontWeight: '700',
  },
});





