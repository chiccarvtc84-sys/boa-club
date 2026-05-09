import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ConversationScreen } from '../screens/messages/ConversationScreen';
import { ConversationsListScreen } from '../screens/messages/ConversationsListScreen';

export type MessagesStackParamList = {
  ConversationsList: undefined;
  Conversation: { conversationId: string; title?: string };
};

export type MessagesStackNavigation<T extends keyof MessagesStackParamList> =
  NativeStackScreenProps<MessagesStackParamList, T>['navigation'];
export type MessagesStackRoute<T extends keyof MessagesStackParamList> =
  NativeStackScreenProps<MessagesStackParamList, T>['route'];

const Stack = createNativeStackNavigator<MessagesStackParamList>();

export function MessagesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ConversationsList" component={ConversationsListScreen} />
      <Stack.Screen name="Conversation" component={ConversationScreen} />
    </Stack.Navigator>
  );
}
