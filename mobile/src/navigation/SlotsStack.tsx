import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CreateSlotScreen } from '../screens/slots/CreateSlotScreen';
import { SlotDetailScreen } from '../screens/slots/SlotDetailScreen';
import { SlotsListScreen } from '../screens/slots/SlotsListScreen';
// Réutilisée depuis le profil pour permettre de tap sur un participant
// d'un créneau et accéder à son profil sans changer d'onglet.
import { MemberDetailScreen } from '../screens/profile/MemberDetailScreen';

export type SlotsStackParamList = {
  SlotsList: undefined;
  SlotDetail: { slotId: string };
  CreateSlot: undefined;
  MemberDetail: { userId: string };
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
      <Stack.Screen name="MemberDetail" component={MemberDetailScreen as never} />
    </Stack.Navigator>
  );
}
