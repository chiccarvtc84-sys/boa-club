import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text } from 'react-native';

import { PlanningScreen } from '../screens/PlanningScreen';
import { MessagesStack } from './MessagesStack';
import { ProfileStack } from './ProfileStack';
import { SlotsStack } from './SlotsStack';
import { colors } from '../theme/colors';

export type MainTabsParamList = {
  Planning: undefined;
  Slots: undefined;
  Messages: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabsParamList>();

const tabIcon = (label: string) => ({ focused }: { focused: boolean }) => (
  <Text style={[styles.icon, { color: focused ? colors.primary : colors.gray500 }]}>
    {label}
  </Text>
);

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray500,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Planning"
        component={PlanningScreen}
        options={{ tabBarIcon: tabIcon('📅') }}
      />
      <Tab.Screen
        name="Slots"
        component={SlotsStack}
        options={{ title: 'Créneaux', tabBarIcon: tabIcon('👥') }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesStack}
        options={{ tabBarIcon: tabIcon('💬') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ title: 'Profil', tabBarIcon: tabIcon('👤') }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 18 },
});
