import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AdminBroadcastScreen } from '../screens/profile/AdminBroadcastScreen';
import { AdminDashboardScreen } from '../screens/profile/AdminDashboardScreen';
import { AdminEditCourseScreen } from '../screens/profile/AdminEditCourseScreen';
import { AdminNotifyScreen } from '../screens/profile/AdminNotifyScreen';
import { AdminPlanningScreen } from '../screens/profile/AdminPlanningScreen';
import { AdminUsersScreen } from '../screens/profile/AdminUsersScreen';
import { DeleteAccountScreen } from '../screens/profile/DeleteAccountScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { NotificationsSettingsScreen } from '../screens/profile/NotificationsSettingsScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { WeightVisibilityScreen } from '../screens/profile/WeightVisibilityScreen';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  WeightVisibility: undefined;
  NotificationsSettings: undefined;
  DeleteAccount: undefined;
  AdminDashboard: undefined;
  AdminBroadcast: undefined;
  AdminNotify: {
    courseId: string;
    courseName: string;
    defaultType: 'late' | 'absent';
    date: string; // YYYY-MM-DD
  };
  AdminEditCourse: { courseId: string; courseName: string };
  AdminPlanning: undefined;
  AdminUsers: undefined;
};

export type ProfileStackNavigation<T extends keyof ProfileStackParamList> =
  NativeStackScreenProps<ProfileStackParamList, T>['navigation'];
export type ProfileStackRoute<T extends keyof ProfileStackParamList> =
  NativeStackScreenProps<ProfileStackParamList, T>['route'];

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="WeightVisibility" component={WeightVisibilityScreen} />
      <Stack.Screen
        name="NotificationsSettings"
        component={NotificationsSettingsScreen}
      />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="AdminBroadcast" component={AdminBroadcastScreen} />
      <Stack.Screen name="AdminNotify" component={AdminNotifyScreen} />
      <Stack.Screen name="AdminEditCourse" component={AdminEditCourseScreen} />
      <Stack.Screen name="AdminPlanning" component={AdminPlanningScreen} />
      <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
    </Stack.Navigator>
  );
}
