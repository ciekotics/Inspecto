import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {ChevronLeft} from 'lucide-react-native';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {logout} from '../store/slices/authSlice';
import {PRIMARY} from '../utils/theme';

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.auth.user);

  const name =
    user?.firstName || user?.lastName
      ? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
      : user?.email ?? 'User';

  const email = user?.email ?? '';
  const role = user?.role || 'No Role Given Yet';

  const handleLogout = () => {
    dispatch(logout());
    navigation.reset({
      index: 0,
      routes: [{name: 'Login'}],
    });
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={[styles.header, {paddingTop: insets.top + 10, paddingBottom: 10}]}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{'‹'}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Profile Details</Text>
        <View style={{width: 24}} />
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.name}>{name}</Text>
          {email ? <Text style={styles.email}>{email}</Text> : null}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Address</Text>
            <View style={styles.addressBox}>
              <Text style={styles.addressPlaceholder}>Not set</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Role</Text>
            <View style={styles.roleRow}>
              <View style={styles.roleBadgeLabel}>
                <Text style={styles.roleBadgeLabelText}>Role</Text>
              </View>
              <View style={styles.roleBadgeValue}>
                <Text style={styles.roleBadgeValueText}>{role}</Text>
              </View>
            </View>
          </View>
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
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
  backText: {
    fontSize: 24,
    color: '#ffffff',
    paddingRight: 8,
  },
  headerTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  email: {
    marginTop: 4,
    fontSize: 13,
    color: '#6b7280',
  },
  section: {
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
  },
  addressBox: {
    minHeight: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  addressPlaceholder: {
    fontSize: 13,
    color: '#9ca3af',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleBadgeLabel: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#7f1d1d',
    marginRight: 8,
  },
  roleBadgeLabelText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  roleBadgeValue: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#9ca3af',
  },
  roleBadgeValueText: {
    color: '#f9fafb',
    fontSize: 12,
    fontWeight: '500',
  },
  logoutButton: {
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#b91c1c',
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});

