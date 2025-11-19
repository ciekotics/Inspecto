import {MMKV} from 'react-native-mmkv';

// Single MMKV instance for app state persistence.
export const mmkv = new MMKV({id: 'InspectoStorage'});

