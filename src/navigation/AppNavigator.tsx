import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createSharedElementStackNavigator} from 'react-navigation-shared-element';
import AnimatedLogin from '../screens/AnimatedLogin';
import BrandScreen from '../screens/BrandScreen';

const Stack = createSharedElementStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Intro"
        screenOptions={{headerShown: false, animation: 'fade'}}
      >
        <Stack.Screen name="Intro" component={AnimatedLogin} />
        <Stack.Screen
          name="Brand"
          component={BrandScreen}
          sharedElements={() => [{id: 'brand-logo'}, {id: 'brand-underline'}]}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
