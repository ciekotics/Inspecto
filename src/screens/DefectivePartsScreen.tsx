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
  Modal,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {ChevronLeft, Check, Eye, Image as ImageIcon, X, Trash2, Plus} from 'lucide-react-native';
import {
  launchImageLibrary,
  launchCamera,
  ImagePickerResponse,
} from 'react-native-image-picker';
import {
  PinchGestureHandler,
  TapGestureHandler,
  State,
} from 'react-native-gesture-handler';
import {nanoid} from '@reduxjs/toolkit';
import {PRIMARY} from '../utils/theme';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {
  useAddDefectsMutation,
  useGetDefectsQuery,
  useGetInspectionQuery,
} from '../store/services/inspectionApi';
import {setDraft} from '../store/slices/defectsSlice';

type RouteParams = {
  sellCarId?: string | number;
};

type DefectItem = {
  id: string;
  uri: string | null;
  remark: string;
};

const DefectivePartsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const {sellCarId} = (route.params as RouteParams) || {};
  const formattedSellCarId =
    sellCarId == null ? '' : String(sellCarId).trim();
  const dispatch = useAppDispatch();
  const draft = useAppSelector(
    state =>
      formattedSellCarId ? state.defects.drafts[formattedSellCarId] : undefined,
  );
  const {data: inspectionData} = useGetInspectionQuery(
    {sellCarId: formattedSellCarId},
    {skip: !formattedSellCarId},
  );
  const {data: defectsData, isFetching: defectsLoading} = useGetDefectsQuery(
    {sellCarId: formattedSellCarId},
    {skip: !formattedSellCarId},
  );
  const [addDefects, {isLoading: saving}] = useAddDefectsMutation();

  const [inspectionId, setInspectionId] = useState<string | number>('');
  const [items, setItems] = useState<DefectItem[]>([
    {id: nanoid(), uri: null, remark: ''},
  ]);
  const [deletedFiles, setDeletedFiles] = useState<string[]>([]);
  const [pickerVisible, setPickerVisible] = useState<{
    open: boolean;
    id: string | null;
  }>({open: false, id: null});
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const pinchScale = useRef(new Animated.Value(1)).current;
  const baseScale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const combinedScale = Animated.multiply(baseScale, pinchScale);
  const doubleTapRef = useRef<TapGestureHandler | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lastSavedRef = useRef<string>('');

  const pieceCountLabel = useMemo(() => {
    const count = items.length;
    if (count === 1) return '1 defective piece';
    return `${count} defective pieces`;
  }, [items]);

  useEffect(() => {
    if (!formattedSellCarId) return;
    const inspId =
      inspectionData?.data?.allInspections?.[0]?.id ||
      inspectionData?.data?.id ||
      draft?.inspectionId ||
      '';
    if (inspId) {
      setInspectionId(inspId);
    }

    const reports: any[] =
      defectsData?.data?.DefectsReport?.Reports?.Report || [];
    const existingDeleted: string[] =
      defectsData?.data?.deletedFiles ||
      defectsData?.data?.DefectsReport?.deletedFiles ||
      [];

    const hasDraftItems =
      draft?.items && draft.items.some(it => it.uri || it.remark);

    if (!hasDraftItems && Array.isArray(reports) && reports.length > 0) {
      const mapped = reports.map(rep => ({
        id: nanoid(),
        uri: rep['Defect image'] || rep.defectImage || null,
        remark: rep['Remark'] || rep.remark || '',
      }));
      if (mapped.length > 0) {
        setItems(mapped);
      }
    } else if (hasDraftItems) {
      setItems(draft?.items || items);
    }

    if (
      existingDeleted &&
      Array.isArray(existingDeleted) &&
      existingDeleted.length > 0
    ) {
      setDeletedFiles(existingDeleted.filter(Boolean));
    } else if (draft?.deletedFiles) {
      setDeletedFiles(draft.deletedFiles);
    }
  }, [formattedSellCarId, inspectionData, defectsData, draft]);

  useEffect(() => {
    if (!formattedSellCarId) return;
    const snapshot = JSON.stringify({items, deletedFiles, inspectionId});
    if (snapshot !== lastSavedRef.current) {
      lastSavedRef.current = snapshot;
      dispatch(
        setDraft({
          sellCarId: formattedSellCarId,
          items,
          deletedFiles,
          inspectionId,
        }),
      );
    }
  }, [dispatch, formattedSellCarId, items, deletedFiles, inspectionId]);

  const resetAll = () => {
    setItems([{id: nanoid(), uri: null, remark: ''}]);
  };

  const handlePick = async (mode: 'camera' | 'library') => {
    const targetId = pickerVisible.id;
    const resp: ImagePickerResponse =
      mode === 'camera'
        ? await launchCamera({mediaType: 'photo', quality: 0.8})
        : await launchImageLibrary({mediaType: 'photo', quality: 0.8});
    if (resp.didCancel || !resp.assets || resp.assets.length === 0) {
      setPickerVisible({open: false, id: null});
      return;
    }
    const uri = resp.assets[0]?.uri;
    if (uri && targetId) {
      setItems(prev =>
        prev.map(it => {
          if (it.id !== targetId) return it;
          const prevUri = it.uri;
          if (prevUri && (prevUri.startsWith('http://') || prevUri.startsWith('https://'))) {
            setDeletedFiles(d => {
              const next = [...d, prevUri].filter(Boolean);
              return Array.from(new Set(next));
            });
          }
          return {...it, uri};
        }),
      );
    }
    setPickerVisible({open: false, id: null});
  };

  const addItem = () => {
    setItems(prev => [...prev, {id: nanoid(), uri: null, remark: ''}]);
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      if (prev.length === 1) {
        return prev; // keep at least one
      }
      const target = prev.find(it => it.id === id);
      if (
        target?.uri &&
        (target.uri.startsWith('http://') || target.uri.startsWith('https://'))
      ) {
        setDeletedFiles(d => {
          const next = [...d, target.uri as string].filter(Boolean);
          return Array.from(new Set(next));
        });
      }
      return prev.filter(it => it.id !== id);
    });
  };

  const renderItem = (item: DefectItem) => (
    <View key={item.id} style={styles.tile}>
      <View style={styles.tileHeader}>
        <Text style={styles.tileLabel}>Image</Text>
        {items.length > 1 ? (
          <Pressable
            onPress={() => removeItem(item.id)}
            style={styles.deleteBtn}
            android_ripple={{color: 'rgba(0,0,0,0.08)'}}>
            <Trash2 size={16} color="#b91c1c" />
          </Pressable>
        ) : null}
      </View>

      <Pressable
        style={styles.photoTile}
        onPress={() => setPickerVisible({open: true, id: item.id})}>
        {item.uri ? (
          <>
            <Image source={{uri: item.uri}} style={styles.photoImage} />
            <View style={styles.photoBadge}>
              <Check size={14} color="#fff" />
            </View>
            <Pressable
              style={styles.eyeIcon}
              onPress={() => {
                setPreviewUri(item.uri);
                setPreviewVisible(true);
              }}>
              <Eye size={16} color="#111827" />
            </Pressable>
          </>
        ) : (
          <>
            <ImageIcon size={28} color="#9ca3af" strokeWidth={2} />
            <Text style={styles.photoText}>Tap to upload</Text>
          </>
        )}
      </Pressable>

      <Text style={styles.tileLabel}>Remarks</Text>
      <TextInput
        style={[styles.input, {minHeight: 60}]}
        value={item.remark}
        onChangeText={text =>
          setItems(prev =>
            prev.map(it => (it.id === item.id ? {...it, remark: text} : it)),
          )
        }
        placeholder="Add remark"
        placeholderTextColor="#9ca3af"
        multiline
        autoComplete="off"
      />
    </View>
  );

  const handleSubmit = async () => {
    setMessage(null);
    if (!formattedSellCarId) {
      setMessage('Missing sellCarId.');
      return;
    }
    const anyWithImageOrRemark = items.some(it => it.uri || it.remark.trim());
    if (!anyWithImageOrRemark) {
      setMessage('Add at least one defect image or remark.');
      return;
    }
    const missingRemark = items.find(it => it.uri && !it.remark.trim());
    if (missingRemark) {
      setMessage('Add a remark for each image.');
      return;
    }

    setSubmitting(true);
    try {
      await addDefects({
        sellCarId: formattedSellCarId,
        inspectionId: inspectionId || formattedSellCarId,
        items,
        deletedFiles,
      }).unwrap();
      setMessage('Defective parts saved.');
      navigation.navigate('InspectionModules', {sellCarId: formattedSellCarId});
    } catch (err: any) {
      setMessage(err?.message || 'Failed to save defective parts');
    } finally {
      setSubmitting(false);
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
        <Text style={styles.headerTitle}>Defective parts</Text>
        <Pressable style={styles.resetBtn} onPress={resetAll}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Step 10 · Defective parts</Text>
          <Text style={styles.progressValue}>{pieceCountLabel}</Text>
        </View>
      </View>

      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={[styles.content, {paddingBottom: 140}]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Defective pieces</Text>
          <Text style={styles.subtitle}>
            Add images with optional remarks. You can add as many as needed.
          </Text>

          {items.map(renderItem)}

          <View style={styles.addRow}>
            <Text style={styles.addHint}>{pieceCountLabel}</Text>
            <Pressable
              style={styles.addIconBtn}
              onPress={addItem}
              android_ripple={{color: 'rgba(0,0,0,0.08)'}}>
              <Plus size={18} color={PRIMARY} />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.nextBtn, (submitting || saving || defectsLoading) && {opacity: 0.7}]}
          onPress={handleSubmit}
          disabled={submitting || saving || defectsLoading}
          android_ripple={{color: 'rgba(255,255,255,0.15)'}}>
          <Text style={styles.nextLabel}>
            {submitting || saving ? 'Saving...' : 'Save & Next'}
          </Text>
        </Pressable>
        {message ? <Text style={styles.helperText}>{message}</Text> : null}
      </View>

      {previewVisible ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewVisible(false)}>
          <View style={styles.previewOverlay} pointerEvents="box-none">
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
      ) : null}

      {pickerVisible.open ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setPickerVisible({open: false, id: null})}>
          <View style={styles.pickerOverlay} pointerEvents="box-none">
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
                  onPress={() => setPickerVisible({open: false, id: null})}>
                  <Text style={[styles.pickerBtnText, {color: '#b91c1c'}]}>
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
};

export default DefectivePartsScreen;

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
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
  },
  metaRow: {
    marginTop: 12,
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
  tile: {
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fafafa',
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  deleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#fee2e2',
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
    top: 8,
    right: 8,
    backgroundColor: PRIMARY,
    borderRadius: 10,
    padding: 4,
  },
  eyeIcon: {
    position: 'absolute',
    top: 8,
    left: 8,
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
  addRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.4,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
  },
  addHint: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '700',
  },
  addIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  nextBtn: {
    marginTop: 12,
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOpacity: 0.18,
    shadowOffset: {width: 0, height: 10},
    shadowRadius: 14,
    elevation: 3,
  },
  nextLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: '#b91c1c',
    textAlign: 'center',
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
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
});









