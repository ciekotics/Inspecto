/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import {Provider} from 'react-redux';
import {PersistGate} from 'redux-persist/integration/react';
import NetInfo from '@react-native-community/netinfo';
import {persistor, store} from './src/store/store';
import {setOnline} from './src/store/slices/networkSlice';

export default function App() {
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      store.dispatch(setOnline(!!state.isConnected));
    });
    return () => unsub();
  }, []);

  return (
    <Provider store={store}>
      <PersistGate persistor={persistor}>
        <StatusBar barStyle="light-content" />
        <AppNavigator />
      </PersistGate>
    </Provider>
  );
}
