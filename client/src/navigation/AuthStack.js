import { createStackNavigator } from '@react-navigation/stack';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import { useAuthStore } from '../store/authStore';

const Stack = createStackNavigator();

export default function AuthStack() {
  const { shouldShowLogin } = useAuthStore();

  return (
    <Stack.Navigator
      initialRouteName={shouldShowLogin ? 'Login' : 'Welcome'}
      screenOptions={{
        headerShown: false,
        cardStyle: { flex: 1 }
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}
