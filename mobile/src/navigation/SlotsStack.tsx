import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CreateSlotScreen } from '../screens/slots/CreateSlotScreen';
import { SlotDetailScreen } from '../screens/slots/SlotDetailScreen';
import { SlotsListScreen } from '../screens/slots/SlotsListScreen';

export type SlotsStackParamList = {
  SlotsList: undefined;
  SlotDetail: { slotId: string };
  CreateSlot: undefined;
};

export type SlotsStackNavigation<T extends keyof SlotsStackParamList> =
  NativeStackScreenProps<SlotsStackParamList, T>['navigation'];
export type SlotsStackRoute<T extends keyof SlotsStackParamList> =
  NativeStackScreenProps<SlotsStackParamList, T>['route'];

const Stack = createNativeStackNavigator<SlotsStackParamList>();

export function SlotsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SlotsList" component={SlotsListScreen} />
      <Stack.Screen name="SlotDetail" component={SlotDetailScreen} />
      <Stack.Screen name="CreateSlot" component={CreateSlotScreen} />
    </Stack.Navigator>
  );
}
