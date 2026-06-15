import { useEffect, useCallback } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { VT323_400Regular } from '@expo-google-fonts/vt323';
import { AuthProvider, useAuth } from '@/src/auth';
import { AchievementProvider, AchievementToast } from '@/src/achievements';
import { theme } from '@/src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';
    if (!user && !inAuthGroup) {
      router.replace('/login');
    } else if (user && inAuthGroup) {
      router.replace('/');
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View style={styles.center} testID="boot-loader">
        <ActivityIndicator size="large" color={theme.colors.gold} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PressStart2P_400Regular,
    VT323_400Regular,
  });

  const onLayoutReady = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    onLayoutReady();
  }, [onLayoutReady]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.gold} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AchievementProvider>
          <Gate>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="login" />
              <Stack.Screen name="signup" />
              <Stack.Screen name="dps" options={{ headerShown: true }} />
              <Stack.Screen name="leaderboard" options={{ headerShown: true }} />
              <Stack.Screen name="notifications" options={{ headerShown: true }} />
              <Stack.Screen name="tips" options={{ headerShown: true }} />
              <Stack.Screen name="reaction" options={{ headerShown: true }} />
              <Stack.Screen name="crosshair" options={{ headerShown: true }} />
              <Stack.Screen name="servers" options={{ headerShown: true }} />
              <Stack.Screen name="friends" options={{ headerShown: true }} />
              <Stack.Screen name="replay" options={{ headerShown: true }} />
              <Stack.Screen name="accuracy" options={{ headerShown: true }} />
              <Stack.Screen name="clans" options={{ headerShown: true }} />
              <Stack.Screen name="challenges" options={{ headerShown: true }} />
              <Stack.Screen name="duo" options={{ headerShown: true }} />
              <Stack.Screen name="achievements" options={{ headerShown: true }} />
            </Stack>
          </Gate>
          <AchievementToast />
        </AchievementProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
});
