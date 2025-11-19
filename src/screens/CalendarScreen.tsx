import React, {useEffect, useMemo, useState} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  RefreshControl,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Calendar, ChevronLeft, ChevronRight} from 'lucide-react-native';
import {PRIMARY} from '../utils/theme';
import {client} from '../utils/apiClient';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {setCalendarSlots} from '../store/slices/calendarSlotsSlice';

type CalendarSlotStatus = string;

type CalendarSlot = {
  id: string;
  time: string;
  title: string;
  inspectorName: string | null;
  status: CalendarSlotStatus;
  date: string; // DD/MM/YYYY
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_DAYS = Array.from({length: 30}, (_, i) => i + 1);

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
  const auth = useAppSelector(state => state.auth);
  const calendarCache = useAppSelector(state => state.calendarSlots);
  const dispatch = useAppDispatch();
  const monthAnim = React.useRef(new Animated.Value(0)).current;

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
          if (slot.currentStatus !== 'BOOKED') {
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

          return {
            id: String(slot.id ?? slot.sellCarId ?? ''),
            time: extractStartTime(
              typeof slot.time === 'string' ? slot.time : undefined,
            ),
            title: titleParts || 'Inspection',
            inspectorName: inspectorRaw || null,
            status: String(slot.currentStatus || 'BOOKED'),
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

  const inspectionDays = useMemo(
    () => Object.keys(slotsByDay).map(d => Number(d)),
    [slotsByDay],
  );

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
              {MONTH_DAYS.map(day => {
                if (loading) {
                  return (
                    <View key={day} style={styles.dateCell}>
                      <View style={[styles.datePill, styles.datePillSkeleton]} />
                    </View>
                  );
                }
                const isSelected = day === selectedDay;
                const hasInspections = inspectionDays.includes(day);
                return (
                  <Pressable
                    key={day}
                    style={styles.dateCell}
                    onPress={() => {
                      setSelectedDay(day);
                      setFilter('today');
                    }}>
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
                    {hasInspections && (
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
            slotsForSelectedDay.map(slot => (
              <View key={slot.id} style={styles.card}>
                <View style={styles.timePill}>
                  <Text style={styles.timeText}>{slot.time}</Text>
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>{slot.title}</Text>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusText}>{slot.status}</Text>
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
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
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
    paddingVertical: 4,
    alignItems: 'center',
  },
  datePill: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
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
  dateDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
    backgroundColor: '#f97316',
  },
  dateDotSelected: {
    backgroundColor: PRIMARY,
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
