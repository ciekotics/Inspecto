import React, {useEffect, useMemo, useState} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import {ChevronLeft} from 'lucide-react-native';
import {PRIMARY} from '../utils/theme';
import {client} from '../utils/apiClient';
import {loadDraft, saveDraft} from '../utils/draftStorage';

type RouteParams = {
  sellCarId?: string | number;
};

type DrivingExperience = 'Excellent' | 'Good' | 'Average' | 'Others' | '';
type Problem =
  'No Problem'
  | 'Engine'
  | 'Clutch'
  | 'Gear Shifting'
  | 'Suspension'
  | 'Brakes'
  | 'Others';
type IncompleteReason = 'Issue with vehicle' | 'Customer denied' | 'Others' | '';

const TestDriveScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const {sellCarId} = (route.params as RouteParams) || {};
  const formattedSellCarId =
    sellCarId == null ? '' : String(sellCarId).trim();

  const [inspectionId, setInspectionId] = useState<string | number>('');
  const [isComplete, setIsComplete] = useState(false);
  const [drivingExperience, setDrivingExperience] =
    useState<DrivingExperience>('');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [incompleteReason, setIncompleteReason] =
    useState<IncompleteReason>('');
  const [remarks, setRemarks] = useState('');
  const [kmsDriven, setKmsDriven] = useState('');
  const [timeTaken, setTimeTaken] = useState('');
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requiredCount = useMemo(() => (isComplete ? 4 : 3), [isComplete]);

  const filledCount = useMemo(() => {
    let count = 0;
    if (drivingExperience) count += 1;
    if (problems.length > 0) count += 1;
    if (isComplete) {
      if (kmsDriven) count += 1;
      if (timeTaken) count += 1;
    } else {
      if (incompleteReason) count += 1;
    }
    return count;
  }, [drivingExperience, problems, isComplete, kmsDriven, timeTaken, incompleteReason]);

  const resetAll = () => {
    setIsComplete(false);
    setDrivingExperience('');
    setProblems([]);
    setIncompleteReason('');
    setRemarks('');
    setKmsDriven('');
    setTimeTaken('');
  };

  useEffect(() => {
    let cancelled = false;
    const fetchExisting = async () => {
      if (!formattedSellCarId) return;
      const pickFrom = (obj: any, keys: string[]) => {
        if (!obj || typeof obj !== 'object') return undefined;
        for (const k of keys) {
          const v = obj[k];
          if (v !== undefined && v !== null && `${v}`.trim() !== '') {
            return v;
          }
        }
        return undefined;
      };
      const boolish = (v: any) => {
        const s = (v || '').toString().trim().toLowerCase();
        if (['true', 'yes', '1', 'completed', 'done'].includes(s)) return true;
        if (['false', 'no', '0', 'incomplete', 'not completed'].includes(s))
          return false;
        if (typeof v === 'boolean') return v;
        return null;
      };
      const normExp = (v: any): DrivingExperience => {
        const s = (v || '').toString().trim().toLowerCase();
        if (s.includes('excellent')) return 'Excellent';
        if (s.includes('good')) return 'Good';
        if (s.includes('average') || s.includes('avg')) return 'Average';
        if (s) return 'Others';
        return '';
      };
      const normProblem = (v: any): Problem => {
        const s = (v || '').toString().trim().toLowerCase();
        if (s.includes('engine')) return 'Engine';
        if (s.includes('clutch')) return 'Clutch';
        if (s.includes('gear')) return 'Gear Shifting';
        if (s.includes('susp')) return 'Suspension';
        if (s.includes('brake')) return 'Brakes';
        if (s.includes('no problem') || s === 'none') return 'No Problem';
        if (s) return 'Others';
        return '';
      };
      const applyData = (td: any) => {
        if (!td || typeof td !== 'object') return false;
        let applied = false;
        if (td.id != null) {
          setInspectionId(td.id);
          applied = true;
        }
        const completeVal = pickFrom(td, [
          'Test Drive Completed',
          'isComplete',
          'IsComplete',
          'Is Test Drive Complete',
          'completed',
          'testDriveCompleted',
          'Test Drive Completed',
        ]);
        const boolComplete = boolish(completeVal);
        if (boolComplete !== null) {
          setIsComplete(boolComplete);
          applied = true;
        }
        const exp = pickFrom(td, [
          'Driving Experience',
          'drivingExperience',
          'Experience',
          'Driving experience',
        ]);
        if (exp !== undefined) {
          setDrivingExperience(normExp(exp) || String(exp));
          applied = true;
        }
        const rawProblem = (() => {
          const val = pickFrom(td, [
            'Problem',
            'Specify the Problem',
            'problem',
            'Test Drive Issue',
          ]);
          return val;
        })();
        if (rawProblem !== undefined) {
          if (Array.isArray(rawProblem)) {
            const normalized = rawProblem
              .map(p => normProblem(p) || String(p))
              .filter(Boolean) as Problem[];
            setProblems(normalized);
          } else {
            const single = normProblem(rawProblem) || String(rawProblem);
            if (single) {
              setProblems([single as Problem]);
            }
          }
          applied = true;
        }
        const reason = pickFrom(td, [
          'Incomplete Reason',
          'incompleteReason',
          'Incomplete Test Drive',
          'Reason',
          'Reason for incomplete',
        ]);
        if (reason !== undefined) {
          setIncompleteReason(String(reason));
          applied = true;
        }
        const driveDetails =
          td['Drive Details'] || td.driveDetails || td['driveDetails'];
        const km = pickFrom(driveDetails || td, [
          "Km Driven",
          "Km's Driven",
          'Kms Driven',
          'kmsDriven',
          'Kms driven',
          'Distance',
        ]);
        if (km !== undefined) {
          setKmsDriven(String(km));
          applied = true;
        }
        const time = pickFrom(driveDetails || td, [
          'Time Taken',
          'timeTaken',
          'Time Taken (in min)',
          'Duration',
          'Duration (min)',
        ]);
        if (time !== undefined) {
          setTimeTaken(String(time));
          applied = true;
        }
        const rem = pickFrom(td, ['Remarks', 'remarks', 'Notes', 'comments', 'Comments', 'Additional Remarks']);
        if (rem !== undefined) {
          setRemarks(String(rem));
          applied = true;
        }
        return applied;
      };

      try {
        setPrefillLoading(true);
        // hydrate local draft first
        const localDraft = loadDraft<any>(formattedSellCarId, 'testDrive');
        if (localDraft) {
          applyData(localDraft);
        }
        let applied = false;
        // Preferred endpoint for test drive data
        try {
          const resReport = await client.get('/api/view-test-drive-report', {
            params: {sellCarId: formattedSellCarId},
          });
          if (!cancelled) {
            const report = resReport.data?.data?.testDriveReports?.Reports;
            if (applyData(report)) {
              applied = true;
            }
          }
        } catch (e) {
          console.warn('Failed to fetch test drive report', e);
        }
        // Fallback to older inspection payload if needed
        if (!applied) {
          const res = await client.get('/api/view-inspection', {
            params: {sellCarId: formattedSellCarId},
          });
          if (!cancelled) {
            const existing = res.data?.data?.allInspections?.[0];
            const td =
              existing?.testDrive ||
              existing?.TestDrive ||
              existing?.test_drive ||
              existing?.testdrive ||
              existing?.['Test Drive'];
            applyData(td);
          }
        }
      } catch (err) {
        console.warn('Failed to prefill test drive', err);
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
      isComplete,
      testDriveCompleted: isComplete,
      drivingExperience,
      problems,
      incompleteReason,
      remarks,
      kmsDriven,
      timeTaken,
    };
    saveDraft(formattedSellCarId, 'testDrive', payload);
  }, [
    formattedSellCarId,
    isComplete,
    drivingExperience,
    problems,
    incompleteReason,
    remarks,
    kmsDriven,
    timeTaken,
  ]);

  const renderPills = <T extends string>(
    options: T[],
    value: T,
    onChange: (v: T) => void,
  ) => (
    <View style={styles.pillWrap}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[
              styles.pill,
              active ? styles.pillActive : styles.pillInactive,
            ]}>
            <Text
              style={[
                styles.pillText,
                active ? styles.pillTextActive : null,
              ]}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const handleSubmit = async () => {
    setMessage(null);
    if (!formattedSellCarId) {
      setMessage('Missing sellCarId.');
      return;
    }
    if (!drivingExperience) {
      setMessage('Select driving experience.');
      return;
    }
    if (!problems.length) {
      setMessage('Select at least one problem.');
      return;
    }
    if (isComplete) {
      if (!kmsDriven) {
        setMessage("Enter Km's Driven.");
        return;
      }
      if (!timeTaken) {
        setMessage('Enter Time Taken.');
        return;
      }
    } else {
      if (!incompleteReason) {
        setMessage('Select incomplete reason.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const reports = {
        'Test Drive Completed': isComplete,
        'Drive Details': {
          'Km Driven': kmsDriven,
          'Time Taken': timeTaken,
        },
        'Driving Experience': drivingExperience,
        Problem: problems,
        'Incomplete Test Drive': isComplete ? '' : incompleteReason,
        'Additional Remarks': remarks,
      };

      await client.post('/api/add-test-drive', {
        id: inspectionId || formattedSellCarId,
        sellCarId: formattedSellCarId,
        Reports: reports,
      });

      setMessage('Test Drive saved.');
      navigation.navigate('EngineInspection', {sellCarId: formattedSellCarId});
    } catch (err: any) {
      setMessage(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to save test drive',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={[styles.header, {paddingTop: insets.top + 10, paddingBottom: 10}]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          android_ripple={{color: 'rgba(0,0,0,0.08)'}}>
          <ChevronLeft size={18} color="#111827" strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.headerTitle}>Test Drive</Text>
        <Pressable style={styles.resetBtn} onPress={resetAll}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Step 4 · Test Drive</Text>
          <Text style={styles.progressValue}>
            {filledCount}/{requiredCount}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {prefillLoading ? (
          <View style={styles.card}>
            <View style={[styles.skeletonBlock, {width: 180, height: 16}]} />
            <View
              style={[
                styles.skeletonBlock,
                {width: '70%', height: 12, marginTop: 8},
              ]}
            />
            <View
              style={[
                styles.skeletonBlock,
                {width: '100%', height: 46, marginTop: 16},
              ]}
            />
            <View
              style={[
                styles.skeletonBlock,
                {width: '100%', height: 120, marginTop: 12},
              ]}
            />
          </View>
        ) : (
          <View style={styles.card}>
          <Text style={styles.title}>Test Drive inspection</Text>
          <Text style={styles.subtitle}>
            Toggle completion, capture drive experience, issues, and remarks.
          </Text>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Is Test Drive Complete?</Text>
            <Pressable
              style={[
                styles.switch,
                isComplete ? styles.switchOn : styles.switchOff,
              ]}
              onPress={() => setIsComplete(prev => !prev)}>
              <View
                style={[
                  styles.switchThumb,
                  isComplete ? styles.switchThumbOn : null,
                ]}
              />
            </Pressable>
          </View>

          <Text style={[styles.sectionTitle, {marginTop: 16}]}>
            Select Driving Experience *
          </Text>
          {renderPills(
            ['Excellent', 'Good', 'Average', 'Others'],
            drivingExperience,
            setDrivingExperience,
          )}

          <Text style={[styles.sectionTitle, {marginTop: 8}]}>
            Select Problems *
          </Text>
          <View style={styles.pillWrap}>
            {(
              ['No Problem', 'Engine', 'Clutch', 'Gear Shifting', 'Suspension', 'Brakes'] as Problem[]
            ).map(opt => {
              const active = problems.includes(opt);
              const toggle = () => {
                setProblems(prev => {
                  if (active) {
                    return prev.filter(p => p !== opt);
                  }
                  if (opt === 'No Problem') {
                    return ['No Problem'];
                  }
                  return [...prev.filter(p => p !== 'No Problem'), opt];
                });
              };
              return (
                <Pressable
                  key={opt}
                  onPress={toggle}
                  style={[
                    styles.pill,
                    active ? styles.pillActive : styles.pillInactive,
                  ]}>
                  <Text
                    style={[
                      styles.pillText,
                      active ? styles.pillTextActive : null,
                    ]}>
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {isComplete ? (
            <>
              <Text style={[styles.sectionTitle, {marginTop: 16}]}>
                Drive Details
              </Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Km's Driven (in kms) *</Text>
                <TextInput
                  style={styles.input}
                  value={kmsDriven}
                  onChangeText={setKmsDriven}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#9ca3af"
                  autoComplete="off"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Time Taken (in min) *</Text>
                <TextInput
                  style={styles.input}
                  value={timeTaken}
                  onChangeText={setTimeTaken}
                  keyboardType="numeric"
                  placeholder="in minutes"
                  placeholderTextColor="#9ca3af"
                  autoComplete="off"
                />
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.sectionTitle, {marginTop: 16}]}>
                Incomplete Test Drive *
              </Text>
              {renderPills(
                ['Issue with vehicle', 'Customer denied', 'Others'],
                incompleteReason,
                setIncompleteReason,
              )}
            </>
          )}

          <Text style={[styles.sectionTitle, {marginTop: 16}]}>
            Additional Remarks (optional)
          </Text>
          <TextInput
            style={[styles.input, {minHeight: 80}]}
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Enter description here"
            placeholderTextColor="#9ca3af"
            multiline
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
    </SafeAreaView>
  );
};

export default TestDriveScreen;

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
  switchRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
    flex: 1,
  },
  switch: {
    width: 56,
    height: 32,
    borderRadius: 16,
    padding: 4,
    justifyContent: 'center',
  },
  switchOff: {
    backgroundColor: '#e5e7eb',
  },
  switchOn: {
    backgroundColor: '#0ea5e9',
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignSelf: 'flex-start',
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
  },
  sectionTitle: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  pillWrap: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillActive: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY + '15',
  },
  pillInactive: {
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  pillTextActive: {
    color: PRIMARY,
  },
  inputGroup: {
    marginTop: 10,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
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
  helperText: {
    marginTop: 10,
    fontSize: 12,
    color: '#b91c1c',
  },
  skeletonBlock: {
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
  },
});
