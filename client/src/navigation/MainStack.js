import { createStackNavigator } from '@react-navigation/stack';
import { useTimeZone } from '../hooks/useTimeZone';
import MainTabs from './MainTabs';
import EditProfileScreen from '../screens/EditProfileScreen';
import ThemeSettingsScreen from '../screens/settings/ThemeSettingsScreen';
import LanguageSettingsScreen from '../screens/settings/LanguageSettingsScreen';
import StartDaySettingsScreen from '../screens/settings/StartDaySettingsScreen';
import TimeZoneSettingsScreen from '../screens/settings/TimeZoneSettingsScreen';
import TimeZoneSelectionScreen from '../screens/settings/TimeZoneSelectionScreen';
import GoogleCalendarSettingsScreen from '../screens/settings/GoogleCalendarSettingsScreen';
import TodoCalendarScreen from '../features/todo-calendar/TodoCalendarScreen';

const Stack = createStackNavigator();

export default function MainStack() {
  useTimeZone();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { flex: 1 }
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="CategoryManagement"
        component={require('../screens/CategoryManagementScreen').default}
        options={{
          title: '카테고리 관리',
          headerBackTitle: '내 정보',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="CategoryTodos"
        component={require('../screens/CategoryTodosScreen').default}
        options={{
          headerBackTitle: '뒤로',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          title: '프로필 수정',
          headerBackTitle: '취소',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="CategoryForm"
        component={require('../screens/CategoryFormScreen').default}
        options={{
          title: '',
          headerBackTitle: '취소',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="CategoryColor"
        component={require('../screens/CategoryColorScreen').default}
        options={{
          title: '색상 선택',
          headerBackTitle: '뒤로',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="VerifyPassword"
        component={require('../screens/VerifyPasswordScreen').default}
        options={{
          headerShown: false,
          cardStyle: { backgroundColor: 'white' },
          presentation: 'card'
        }}
      />
      <Stack.Screen
        name="Settings"
        component={require('../screens/SettingsScreen').default}
        options={{
          title: '앱 설정',
          headerBackTitle: '뒤로',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="ThemeSettings"
        component={ThemeSettingsScreen}
        options={{
          title: '테마 설정',
          headerBackTitleVisible: false,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="LanguageSettings"
        component={LanguageSettingsScreen}
        options={{
          title: '언어 설정',
          headerBackTitleVisible: false,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="StartDaySettings"
        component={StartDaySettingsScreen}
        options={{
          title: '주 시작 요일',
          headerBackTitleVisible: false,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="TimeZoneSettings"
        component={TimeZoneSettingsScreen}
        options={{
          title: '타임존 설정',
          headerBackTitleVisible: false,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="TimeZoneSelection"
        component={TimeZoneSelectionScreen}
        options={{
          title: '타임존 선택',
          headerBackTitleVisible: false,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="GoogleCalendarSettings"
        component={GoogleCalendarSettingsScreen}
        options={{
          title: '구글 캘린더 연동',
          headerBackTitleVisible: false,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="ConvertGuest"
        component={require('../screens/ConvertGuestScreen').default}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="GuestMigrationTest"
        component={require('../test/GuestMigrationTestScreen').default}
        options={{
          title: 'Guest Migration Test',
          headerBackTitle: '뒤로',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="TodoCalendar"
        component={TodoCalendarScreen}
        options={{
          title: '무한 스크롤 캘린더',
          headerShown: true,
        }}
      />
      {/* Archived: CalendarPerformanceBenchmark - Phase 1 테스트 완료 */}
      {/* <Stack.Screen
        name="CalendarPerformanceBenchmark"
        component={require('../test/CalendarPerformanceBenchmark').default}
        options={{
          title: '캘린더 성능 벤치마크',
          headerBackTitle: '뒤로',
          headerShown: true,
        }}
      /> */}
    </Stack.Navigator>
  );
}
