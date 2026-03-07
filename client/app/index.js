import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';

export default function Index() {
  const { user, isLoading, shouldShowLogin } = useAuthStore();

  if (isLoading) {
    return null;
  }

  if (user) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return <Redirect href={shouldShowLogin ? '/(auth)/login' : '/(auth)/welcome'} />;
}
