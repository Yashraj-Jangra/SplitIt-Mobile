import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

function resolveApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // When running in Expo Go or dev mode, resolve the host PC's LAN IP from Metro debugger connection
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:3231`;
    }
  }
  // Android emulator loopback fallback
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3231';
  }
  return 'http://localhost:3231';
}

// Points to existing Next.js backend (dynamically resolves PC LAN IP in Expo Go)
export const API_BASE_URL = resolveApiBaseUrl();

const TOKEN_KEY = 'splitit_session_token';
const USER_KEY = 'splitit_user_data';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  upiId?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
}

export const authService = {
  /**
   * Save session token and user info securely in Keychain / Keystore.
   */
  async saveSession(token: string, user: AuthUser): Promise<void> {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } catch {
      // SecureStore persist fallback
    }
  },

  /**
   * Retrieve active session token.
   */
  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Retrieve active user profile from SecureStore.
   */
  async getCachedUser(): Promise<AuthUser | null> {
    try {
      const raw = await SecureStore.getItemAsync(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  /**
   * Clear session on logout.
   */
  async clearSession(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch {
      // SecureStore clear fallback
    }
  },

  /**
   * Sign in with Email & Password via Better-Auth.
   */
  async signInWithEmail(email: string, password: string): Promise<AuthResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.message || data.error || 'Invalid email or password' };
      }

      const token = data.token || data.session?.token || (res.headers.get('set-cookie')?.match(/better-auth\.session_token=([^;]+)/)?.[1]) || 'session_active';
      const user: AuthUser = {
        id: data.user?.id || data.session?.userId || '',
        name: data.user?.name || data.user?.firstName || 'User',
        email: data.user?.email || email,
        avatarUrl: data.user?.image || undefined,
      };

      await this.saveSession(token, user);
      return { success: true, token, user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error connecting to auth server' };
    }
  },

  /**
   * Sign up with Name, Email & Password via Better-Auth.
   */
  async signUpWithEmail(name: string, email: string, password: string): Promise<AuthResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.message || data.error || 'Failed to create account' };
      }

      const token = data.token || data.session?.token || 'session_active';
      const user: AuthUser = {
        id: data.user?.id || '',
        name: data.user?.name || name,
        email: data.user?.email || email,
      };

      await this.saveSession(token, user);
      return { success: true, token, user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during signup' };
    }
  },

  /**
   * One-tap Google OAuth via WebBrowser session and Better-Auth.
   */
  async signInWithGoogle(): Promise<AuthResponse> {
    try {
      const callbackUrl = Linking.createURL('auth/callback', { scheme: 'splitit' });
      let authUrl = `${API_BASE_URL}/api/auth/sign-in/social?provider=google&callbackURL=${encodeURIComponent(callbackUrl)}`;

      // Step 1: Pre-fetch direct Google OAuth URL via POST to skip redirect latency
      try {
        const postRes = await fetch(`${API_BASE_URL}/api/auth/sign-in/social`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'google',
            callbackURL: callbackUrl,
          }),
        });
        if (postRes.ok) {
          const postData = await postRes.json();
          if (postData?.url) {
            authUrl = postData.url;
          }
        }
      } catch {
        // Fallback to GET authUrl
      }

      const result = await WebBrowser.openAuthSessionAsync(authUrl, callbackUrl);

      if (result.type === 'success' && result.url) {
        const parsed = Linking.parse(result.url);
        const token = (parsed.queryParams?.token as string) || (parsed.queryParams?.session_token as string);

        if (token) {
          // Fetch verified user profile with token
          const profileRes = await fetch(`${API_BASE_URL}/api/user/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (profileRes.ok) {
            const profileData = await profileRes.json();
            const user: AuthUser = {
              id: profileData.id || profileData.user?.id || '',
              name: `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim() || profileData.name || 'SplitIt User',
              email: profileData.email || '',
              avatarUrl: profileData.avatarUrl,
              upiId: profileData.upiId,
            };
            await this.saveSession(token, user);
            return { success: true, token, user };
          }
        }

        // Fallback user if profile endpoint unreachable
        const fallbackUser: AuthUser = {
          id: 'google_user',
          name: 'SplitIt User',
          email: (parsed.queryParams?.email as string) || '',
        };
        const fallbackToken = token || 'google_session_active';
        await this.saveSession(fallbackToken, fallbackUser);
        return { success: true, token: fallbackToken, user: fallbackUser };
      }

      return { success: false, error: 'Google sign-in was canceled' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Google sign-in failed' };
    }
  },
};
