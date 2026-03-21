import { useEffect } from 'react';
import { Stack } from 'expo-router';

import { useAuthStore } from '../../src/store/authStore';

export default function AuthLayout() {
  const { isLoading, isLoggedIn, shouldShowLogin, closeLoginScreen } = useAuthStore();

  useEffect(() => {
    if (!isLoading && shouldShowLogin) {
      closeLoginScreen();
    }
  }, [isLoading, shouldShowLogin, closeLoginScreen]);

  if (isLoading) {
    return null;
  }

  if (isLoggedIn) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
