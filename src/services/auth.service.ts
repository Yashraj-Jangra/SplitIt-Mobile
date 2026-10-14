import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

function resolveApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  return 'https://split.cvweb.qzz.io';
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
  role?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  mobileNumber?: string;
  countryCode?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
}

let _cachedUser: AuthUser | null = null;

export const authService = {
  /**
   * Synchronous accessor for in-memory cached user (prevents layout flashing).
   */
  getInMemoryUser(): AuthUser | null {
    return _cachedUser;
  },

  /**
   * Save session token and user info securely in Keychain / Keystore.
   */
  async saveSession(token: string, user: AuthUser): Promise<void> {
    try {
      _cachedUser = user;
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
    if (_cachedUser) return _cachedUser;
    try {
      const raw = await SecureStore.getItemAsync(USER_KEY);
      if (raw) {
        _cachedUser = JSON.parse(raw);
        return _cachedUser;
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Clear session on logout.
   */
  async clearSession(): Promise<void> {
    try {
      _cachedUser = null;
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
        role: data.user?.role || data.session?.user?.role || 'user',
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
              role: profileData.role || profileData.user?.role || 'user',
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

  /**
   * Update user profile on backend and persist to SecureStore.
   */
  async updateUserProfile(updates: Partial<AuthUser>): Promise<AuthUser | null> {
    try {
      const currentUser = await this.getCachedUser();
      const token = await this.getToken();

      const mergedUser: AuthUser = {
        ...(currentUser || { id: 'user_active', name: 'User', email: '' }),
        ...updates,
      };

      if (updates.firstName !== undefined || updates.lastName !== undefined) {
        const fname = updates.firstName ?? currentUser?.firstName ?? '';
        const lname = updates.lastName ?? currentUser?.lastName ?? '';
        mergedUser.name = `${fname} ${lname}`.trim() || mergedUser.name;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(token ? { Cookie: `better-auth.session_token=${token}` } : {}),
          },
          body: JSON.stringify({
            firstName: updates.firstName,
            lastName: updates.lastName,
            username: updates.username,
            mobileNumber: updates.mobileNumber,
            countryCode: updates.countryCode,
            upiId: updates.upiId,
            avatarUrl: updates.avatarUrl,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.profile) {
            mergedUser.firstName = data.profile.firstName ?? mergedUser.firstName;
            mergedUser.lastName = data.profile.lastName ?? mergedUser.lastName;
            mergedUser.username = data.profile.username ?? mergedUser.username;
            mergedUser.upiId = data.profile.upiId ?? mergedUser.upiId;
            mergedUser.avatarUrl = data.profile.avatarUrl ?? mergedUser.avatarUrl;
            mergedUser.mobileNumber = data.profile.mobileNumber ?? mergedUser.mobileNumber;
            mergedUser.countryCode = data.profile.countryCode ?? mergedUser.countryCode;
            mergedUser.name = data.profile.name ?? mergedUser.name;
          }
        }
      } catch {
        // Safe fallback for local/offline usage
      }

      _cachedUser = mergedUser;
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(mergedUser));
      return mergedUser;
    } catch {
      return null;
    }
  },

  /**
   * Update user authentication password.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await this.getToken();
      const res = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(token ? { Cookie: `better-auth.session_token=${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        return { success: false, error: data.message || data.error || 'Failed to update password' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error updating password' };
    }
  },
};
