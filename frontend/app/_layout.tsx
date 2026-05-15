import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/src/auth';
import { theme } from '@/src/theme';

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
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Gate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="dps" options={{ headerShown: true }} />
            <Stack.Screen name="leaderboard" options={{ headerShown: true }} />
            <Stack.Screen name="notifications" options={{ headerShown: true }} />
          </Stack>
        </Gate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
});
