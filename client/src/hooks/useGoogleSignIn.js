// Google Auth is intentionally disabled until the native OAuth flow is rebuilt.
export const useGoogleSignIn = () => {
  return {
    signIn: async () => {
      throw new Error('Google Auth is temporarily disabled');
    },
    signOut: async () => {
      console.log('Google Auth is disabled - signOut mock');
    },
    requestCalendarAccess: async () => {
      throw new Error('Google Calendar sync is temporarily disabled');
    },
    isLoading: false,
  };
};
