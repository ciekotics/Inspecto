import React, {useEffect, useRef, useState} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Calendar, Car, Square, User, Clock} from 'lucide-react-native';
import {PRIMARY} from '../utils/theme';

import {client} from '../utils/apiClient';
import {useAppSelector} from '../store/hooks';

type BookingStatus = 'Booked' | 'Unassigned';

type Booking = {
  id: string;
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

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

        let visibleSlots = slots.filter(slot => {
          if (!slot) {
            return false;
          }
          if (slot.currentStatus !== 'BOOKED') {
            return false;
          }
          if (slot.status === false) {
            return false;
          }
          if (typeof slot.date === 'string' && slot.date) {
            if (slot.date !== todayStr) {
              return false;
            }
          }
          return true;
        });

        if (!isSuperAdmin) {
          visibleSlots = visibleSlots.filter(slot => {
            const inspectorRaw = String(slot?.inspector || '').trim();
            const inspectorNorm = normalizeName(inspectorRaw || '');
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

          const bookingStatus: BookingStatus = isAssigned
            ? 'Booked'
            : 'Unassigned';

          return {
            id: String(slot.id ?? slot.sellCarId ?? ''),
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
    TABS.forEach(tab => {
      Animated.timing(animations[tab.key], {
        toValue: tab.key === activeTab ? 1 : 0,
        duration: 260,
        useNativeDriver: false,
      }).start();
    });
  }, [activeTab, animations]);

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
      <View style={styles.content}>
        {activeTab === 'bookings' ? (
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}>
            {effectiveBookings.map(b => (
              <View key={b.id} style={styles.card}>
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
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              Owned vehicles will appear here.
            </Text>
          </View>
        )}
      </View>

      {/* Bottom tabs */}
      <View style={styles.tabBar}>
        {TABS.map(tab => {
          const animated = animations[tab.key];
          const pillPadding = animated.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 18],
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
    backgroundColor: '#16a34a',
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
    color: '#bbf7d0',
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
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
  },
  tabPressable: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
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
});
