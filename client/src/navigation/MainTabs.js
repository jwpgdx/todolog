import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TodoScreen from '../screens/TodoScreen';
import NotificationScreen from '../screens/NotificationScreen';
import ProfileScreen from '../screens/ProfileScreen';
import TodoCalendarScreen from '../screens/TodoCalendarScreen';
import DebugScreen from '../screens/DebugScreen';
import CalendarServiceTestScreen from '../test/CalendarServiceTestScreen';
import { useTodoFormStore } from '../store/todoFormStore';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  const { openQuick } = useTodoFormStore();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#9ca3af',
      }}
    >
      <Tab.Screen
        name="Home"
        component={TodoScreen}
        options={{
          tabBarLabel: '홈',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={TodoCalendarScreen}
        options={{
          tabBarLabel: '캘린더',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Test"
        component={CalendarServiceTestScreen}
        options={{
          tabBarLabel: '테스트',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flask-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'My',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      {/* 모든 플랫폼: 탭 바 맨 오른쪽에 추가 버튼 */}
      <Tab.Screen
        name="Add"
        component={View}
        options={{
          tabBarLabel: '',
          tabBarButton: (props) => {
            // 웹에서 href와 accessibilityRole을 제거하여 <a> 태그로 렌더링되는 것을 방지
            const { href, accessibilityRole, ...restProps } = props;

            return (
              <TouchableOpacity
                {...restProps}
                accessibilityRole="button"
                onPress={(e) => {
                  // 웹에서 기본 동작 방지
                  if (e && e.preventDefault) {
                    e.preventDefault();
                  }
                  console.log('🔵 Add button pressed!');
                  openQuick();
                }}
                style={{
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 16,
                  marginTop: 4,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: '#3b82f6',
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                    elevation: 5,
                  }}
                >
                  <Ionicons name="add" size={28} color="white" />
                </View>
              </TouchableOpacity>
            );
          },
        }}
        listeners={{
          tabPress: (e) => {
            console.log('🔵 Tab press intercepted!');
            e.preventDefault();
            openQuick();
          },
        }}
      />
    </Tab.Navigator>
  );
}

