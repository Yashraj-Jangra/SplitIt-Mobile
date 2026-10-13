import { Stack, useRouter, useSegments, ThemeProvider, DarkTheme, Theme, ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, ActivityIndicator, Platform } from 'react-native';
import { enableFreeze } from 'react-native-screens';
import { THEME } from '../src/constants/theme';
import { AuthProvider, useAuth } from '../src/contexts/auth.context';
import { NetworkProvider } from '../src/contexts/network.context';
import { OfflineBanner } from '../src/components/common/OfflineBanner';
import { ErrorBoundary as AppErrorBoundary, ErrorFallbackView } from '../src/components/common/ErrorBoundary';
import { notificationService } from '../src/services/notification.service';
import { useEffect } from 'react';

// Expo Router route error boundary export
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorFallbackView error={error} onRetry={retry} />;
}

// Disarm react-freeze global suspense unmounts so background screens never suspend with null fallback
enableFreeze(false);

const splitItNavTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: THEME.colors.primary,
    background: THEME.colors.background,
    card: THEME.colors.background,
    border: THEME.colors.hairline,
    text: THEME.colors.text,
  },
};

function NavigationGate() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    notificationService.initNotifications();
    if (user) {
      notificationService.registerForPushNotifications();
    }
    const sub = notificationService.setupResponseListener((route) => {
      router.push(route as any);
    });
    return () => {
      sub.remove();
    };
  }, [user, router]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Redirect to login if unauthenticated
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Redirect to main tabs if already authenticated
      router.replace('/(tabs)');
    }
  }, [user, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
      </View>
    );
  }

  return (
    <ThemeProvider value={splitItNavTheme}>
      <View style={styles.navContainer} collapsable={false}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: THEME.colors.background },
            animation: Platform.OS === 'android' ? 'fade' : 'default',
            freezeOnBlur: false,
          }}
        >
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="groups/[id]/index" options={{ headerShown: false }} />
          <Stack.Screen name="groups/[id]/settings" options={{ headerShown: false }} />
          <Stack.Screen
            name="expenses/new"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen
            name="expenses/[id]"
            options={{
              presentation: Platform.OS === 'android' ? 'card' : 'modal',
              animation: Platform.OS === 'android' ? 'fade' : 'default',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="groups/new"
            options={{
              presentation: Platform.OS === 'android' ? 'card' : 'modal',
              animation: Platform.OS === 'android' ? 'fade' : 'default',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="groups/[id]/search"
            options={{
              headerShown: false,
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="settle/new"
            options={{
              presentation: Platform.OS === 'android' ? 'card' : 'modal',
              animation: Platform.OS === 'android' ? 'fade' : 'default',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="settle/qr"
            options={{
              presentation: Platform.OS === 'android' ? 'card' : 'modal',
              animation: Platform.OS === 'android' ? 'fade' : 'default',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="settlements/[id]"
            options={{
              presentation: Platform.OS === 'android' ? 'card' : 'modal',
              animation: Platform.OS === 'android' ? 'fade' : 'default',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="ai/chat"
            options={{
              presentation: Platform.OS === 'android' ? 'card' : 'modal',
              animation: Platform.OS === 'android' ? 'fade' : 'default',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="ai/scanner"
            options={{
              presentation: Platform.OS === 'android' ? 'card' : 'modal',
              animation: Platform.OS === 'android' ? 'fade' : 'default',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="notifications/index"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="notifications/preferences"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="support/index"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="support/new"
            options={{
              presentation: Platform.OS === 'android' ? 'card' : 'modal',
              animation: Platform.OS === 'android' ? 'fade' : 'default',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="support/[id]"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="legal/privacy"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="legal/terms"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="legal/delete-account"
            options={{
              presentation: Platform.OS === 'android' ? 'card' : 'modal',
              animation: Platform.OS === 'android' ? 'fade' : 'default',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="settings/account"
            options={{
              presentation: Platform.OS === 'android' ? 'card' : 'modal',
              animation: Platform.OS === 'android' ? 'fade' : 'default',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="settings/preferences"
            options={{
              presentation: Platform.OS === 'android' ? 'card' : 'modal',
              animation: Platform.OS === 'android' ? 'fade' : 'default',
              headerShown: false,
            }}
          />
        </Stack>
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <NetworkProvider>
            <AuthProvider>
              <OfflineBanner />
              <NavigationGate />
            </AuthProvider>
          </NetworkProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  navContainer: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
