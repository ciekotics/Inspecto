import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createSharedElementStackNavigator} from 'react-navigation-shared-element';
import AnimatedLogin from '../screens/AnimatedLogin';
import LoginScreen from '../screens/BrandScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CalendarScreen from '../screens/CalendarScreen';

const Stack = createSharedElementStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Intro"
        screenOptions={{headerShown: false, animation: 'slide_from_right'}}
      >
        <Stack.Screen name="Intro" component={AnimatedLogin} />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          sharedElements={() => [{id: 'brand-logo'}, {id: 'brand-underline'}]}
        />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Calendar" component={CalendarScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
