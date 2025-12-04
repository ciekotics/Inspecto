import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createSharedElementStackNavigator} from 'react-navigation-shared-element';
import AnimatedLogin from '../screens/AnimatedLogin';
import LoginScreen from '../screens/BrandScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CalendarScreen from '../screens/CalendarScreen';
import InspectionScreen from '../screens/InspectionScreen';
import VehicleDetailsWizardScreen from '../screens/VehicleDetailsWizardScreen';
import EngineInspectionScreen from '../screens/EngineInspectionScreen';
import FunctionsInspectionScreen from '../screens/FunctionsInspectionScreen';
import FramesInspectionScreen from '../screens/FramesInspectionScreen';
import ExteriorScreen from '../screens/ExteriorScreen';
import ElectricalInteriorScreen from '../screens/ElectricalInteriorScreen';
import TestDriveScreen from '../screens/TestDriveScreen';
import RefurbishmentCostScreen from '../screens/RefurbishmentCostScreen';
import DefectivePartsScreen from '../screens/DefectivePartsScreen';
import InspectionModulesScreen from '../screens/InspectionModulesScreen';

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
        <Stack.Screen name="EngineInfo" component={VehicleDetailsWizardScreen} />
        <Stack.Screen name="VehicleDetails" component={VehicleDetailsWizardScreen} />
        <Stack.Screen
          name="VehicleDetailsStep1B"
          component={VehicleDetailsWizardScreen}
        />
        <Stack.Screen
          name="VehicleDetailsStep1C"
          component={VehicleDetailsWizardScreen}
        />
        <Stack.Screen name="EngineInspection" component={EngineInspectionScreen} />
        <Stack.Screen name="FunctionsInspection" component={FunctionsInspectionScreen} />
        <Stack.Screen name="FramesInspection" component={FramesInspectionScreen} />
        <Stack.Screen name="Exterior" component={ExteriorScreen} />
        <Stack.Screen
          name="ElectricalInterior"
          component={ElectricalInteriorScreen}
        />
        <Stack.Screen name="TestDrive" component={TestDriveScreen} />
        <Stack.Screen name="RefurbishmentCost" component={RefurbishmentCostScreen} />
        <Stack.Screen name="DefectiveParts" component={DefectivePartsScreen} />
        <Stack.Screen name="Inspection" component={InspectionScreen} />
        <Stack.Screen
          name="InspectionModules"
          component={InspectionModulesScreen}
        />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
