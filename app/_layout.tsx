import { Stack, useRouter, useSegments, ThemeProvider, DarkTheme, Theme, ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { enableFreeze } from 'react-native-screens';
import { THEME } from '../src/constants/theme';
import { QuantumLogo } from '../src/components/brand/QuantumLogo';
import { AuthProvider, useAuth } from '../src/contexts/auth.context';
import { NetworkProvider } from '../src/contexts/network.context';
import { HapticsProvider } from '../src/contexts/haptics.context';
import { CurrencyProvider } from '../src/contexts/currency.context';
import { AppThemeProvider, useAppTheme } from '../src/contexts/theme.context';
import { OfflineBanner } from '../src/components/common/OfflineBanner';
import { ErrorBoundary as AppErrorBoundary, ErrorFallbackView } from '../src/components/common/ErrorBoundary';
import { notificationService } from '../src/services/notification.service';
import { useEffect, useMemo } from 'react';

// Expo Router route error boundary export
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorFallbackView error={error} onRetry={retry} />;
}

// Disarm react-freeze global suspense unmounts so background screens never suspend with null fallback
enableFreeze(false);

function NavigationGate() {
  const { user, isLoading } = useAuth();
  const { currentAccent } = useAppTheme();
  const segments = useSegments();
  const router = useRouter();

  const splitItNavTheme = useMemo<Theme>(() => ({
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: currentAccent.primary,
      background: THEME.colors.background,
      card: THEME.colors.background,
      border: THEME.colors.hairline,
      text: THEME.colors.text,
    },
  }), [currentAccent]);

  useEffect(() => {
    notificationService.initNotifications();

    // Proactively prompt for notification permission on initial install/launch if undetermined
    notificationService.getPermissionStatus().then((status) => {
      if (status.status === 'undetermined' && status.canAskAgain) {
        notificationService.requestPermission().catch(() => {});
      }
    }).catch(() => {});

    if (user) {
      notificationService.registerForPushNotifications().catch(() => {});
    }

    const sub = notificationService.setupResponseListener((route) => {
      router.push(route as any);
    });
    return () => {
      sub?.remove?.();
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

  return (
    <ThemeProvider value={splitItNavTheme}>
      <View style={styles.navContainer} collapsable={false}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: THEME.colors.background },
            animation: 'slide_from_right',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            animationMatchesGesture: true,
            freezeOnBlur: false,
          }}
        >
          <Stack.Screen name="(auth)" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen
            name="groups/[id]/index"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
          <Stack.Screen
            name="groups/[id]/settings"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
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
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
          <Stack.Screen
            name="groups/new"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              gestureEnabled: true,
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="groups/[id]/search"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
          <Stack.Screen
            name="settle/new"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              gestureEnabled: true,
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="settle/qr"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              gestureEnabled: true,
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="settlements/[id]"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
          <Stack.Screen
            name="analysis/index"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
          <Stack.Screen
            name="ai/chat"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
          <Stack.Screen
            name="ai/scanner"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              gestureEnabled: true,
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="notifications/index"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
          <Stack.Screen
            name="notifications/preferences"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
          <Stack.Screen
            name="support/index"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
          <Stack.Screen
            name="support/new"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              gestureEnabled: true,
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="support/[id]"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
          <Stack.Screen
            name="legal/privacy"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
          <Stack.Screen
            name="legal/terms"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
          <Stack.Screen
            name="legal/delete-account"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              gestureEnabled: true,
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="settings/account"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
          <Stack.Screen
            name="settings/preferences"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
          <Stack.Screen
            name="settings/appearance"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
          <Stack.Screen
            name="settings/security"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
          <Stack.Screen
            name="settings/payment"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
          <Stack.Screen
            name="settings/my-qr"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
          <Stack.Screen
            name="info/about"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animationMatchesGesture: true,
            }}
          />
        </Stack>

        {isLoading && (
          <View style={[StyleSheet.absoluteFill, styles.loadingContainer]} pointerEvents="auto">
            <QuantumLogo size={96} spinning />
            <Text style={styles.loadingTitle}>SplitIt</Text>
          </View>
        )}
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
          <HapticsProvider>
            <NetworkProvider>
              <AuthProvider>
                <CurrencyProvider>
                  <AppThemeProvider>
                    <OfflineBanner />
                    <NavigationGate />
                  </AppThemeProvider>
                </CurrencyProvider>
              </AuthProvider>
            </NetworkProvider>
          </HapticsProvider>
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
  loadingTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.5,
    marginTop: 16,
  },
});
