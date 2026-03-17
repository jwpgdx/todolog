import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, TouchableOpacity, View } from 'react-native';

import { useTodoFormStore } from '../../../src/store/todoFormStore';

export default function TabsLayout() {
  const { openQuick } = useTodoFormStore();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#9ca3af',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarLabel: '홈',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: '캘린더',
          tabBarLabel: '캘린더',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="todo-calendar-v2"
        options={{
          href: null,
          title: 'Calendar V2',
          tabBarLabel: 'TC2',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-clear-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="test"
        options={{
          title: '테스트',
          tabBarLabel: '테스트',
          tabBarIcon: ({ color, size }) => <Ionicons name="flask-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="debug"
        options={{
          title: '디버그',
          tabBarLabel: '디버그',
          tabBarIcon: ({ color, size }) => <Ionicons name="bug-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="my-page"
        options={{
          title: 'My Page',
          tabBarLabel: 'My Page',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="week-flow"
        options={{
          title: 'Week Flow',
          tabBarLabel: 'WF',
          tabBarIcon: ({ color, size }) => <Ionicons name="swap-vertical-outline" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarLabel: '',
          tabBarButton: (props) => {
            const { href, accessibilityRole, ...restProps } = props;
            return (
              <TouchableOpacity
                {...restProps}
                accessibilityRole="button"
                onPress={(e) => {
                  if (e && e.preventDefault) {
                    e.preventDefault();
                  }
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
                    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : null),
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
            e.preventDefault();
            openQuick();
          },
        }}
      />
    </Tabs>
  );
}
