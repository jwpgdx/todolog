import { Stack } from 'expo-router';

import { useAuthStore } from '../../src/store/authStore';

export default function AuthLayout() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return null;
  }

  if (user) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
