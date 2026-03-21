import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';

export default function Index() {
  const { isLoading, shouldShowLogin } = useAuthStore();

  if (isLoading) {
    return null;
  }

  return <Redirect href={shouldShowLogin ? '/(auth)/login' : '/(app)/(tabs)'} />;
}
