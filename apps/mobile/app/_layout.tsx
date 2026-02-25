import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";

/* Keep splash visible while we check auth state */
SplashScreen.preventAutoHideAsync();

/**
 * Root layout — wraps the entire app with a dark theme.
 *
 * Navigation structure:
 *   (auth) — Login, Signup (no tabs)
 *   (tabs) — Dashboard, Workflows, Runs, Settings
 */
export default function RootLayout() {
  useEffect(() => {
    /* Hide splash screen after initial render */
    void SplashScreen.hideAsync();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
