import { NativeModules, TurboModuleRegistry } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as ImageManipulator from 'expo-image-manipulator';
import Constants from 'expo-constants';

type GoogleSigninModuleType = typeof import('@react-native-google-signin/google-signin');

let _googleSigninModule: GoogleSigninModuleType | null = null;
let _hasAttemptedLoad = false;

/**
 * Safely inspects whether RNGoogleSignin is registered in the native binary
 * BEFORE calling require(), preventing invariant crash in Expo Go.
 */
function isNativeGoogleSigninAvailable(): boolean {
  try {
    // 1. In Expo Go, native third-party TurboModules are never registered
    if (Constants.appOwnership === 'expo') {
      return false;
    }

    // 2. Safe TurboModule check (get returns null without throwing invariant)
    const turbo =
      typeof TurboModuleRegistry !== 'undefined' &&
      typeof TurboModuleRegistry.get === 'function'
        ? TurboModuleRegistry.get('RNGoogleSignin')
        : null;
    if (turbo) return true;

    // 3. Safe Legacy / Bridgeless NativeModules check
    if (NativeModules && NativeModules.RNGoogleSignin) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function getNativeGoogleSignin(): GoogleSigninModuleType | null {
  if (_hasAttemptedLoad) return _googleSigninModule;
  _hasAttemptedLoad = true;

  if (!isNativeGoogleSigninAvailable()) {
    _googleSigninModule = null;
    return null;
  }

  try {
    // Only require once native module registration is confirmed
    const mod = require('@react-native-google-signin/google-signin');
    if (mod && mod.GoogleSignin) {
      _googleSigninModule = mod;
      return _googleSigninModule;
    }
    return null;
  } catch {
    _googleSigninModule = null;
    return null;
  }
}

export const PRODUCTION_API_URL = 'https://split.cvweb.qzz.io';
export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '178311275102-ph0shfc0dhs7cfnefre0q4bue6h0knvp.apps.googleusercontent.com';

let isGoogleConfigured = false;
function ensureGoogleConfigured(): boolean {
  if (isGoogleConfigured) return true;
  const mod = getNativeGoogleSignin();
  if (!mod) return false;
  try {
    mod.GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      scopes: ['email', 'profile'],
      offlineAccess: false,
    });
    isGoogleConfigured = true;
    return true;
  } catch {
    // Graceful fallback if native module not available
    return false;
  }
}

function resolveApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  // Ensure we never inadvertently use localhost, 127.0.0.1, or emulator test URLs
  if (
    envUrl &&
    !envUrl.includes('localhost') &&
    !envUrl.includes('127.0.0.1') &&
    !envUrl.includes('10.0.2.2')
  ) {
    return envUrl;
  }
  const extraUrl = (Constants.expoConfig?.extra as Record<string, any> | undefined)?.apiUrl;
  if (
    extraUrl &&
    typeof extraUrl === 'string' &&
    !extraUrl.includes('localhost') &&
    !extraUrl.includes('127.0.0.1') &&
    !extraUrl.includes('10.0.2.2')
  ) {
    return extraUrl;
  }
  return PRODUCTION_API_URL;
}

function getAuthHeaders(extra?: Record<string, string>, token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Origin': API_BASE_URL,
    'Referer': `${API_BASE_URL}/`,
    ...extra,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['Cookie'] = `__Secure-better-auth.session_token=${token}; better-auth.session_token=${token}`;
  }
  return headers;
}

// Canonical API base URL for SplitIt (points to production backend)
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
  /**
   * Fetches the authoritative user profile from /api/user/profile.
   * Includes custom fields (upiId, firstName, lastName, username, etc.)
   * which Better-Auth session tokens deliberately omit.
   */
  async fetchUserProfile(tokenOverride?: string): Promise<AuthUser | null> {
    try {
      const token = tokenOverride || (await this.getToken());
      if (!token) return null;

      const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
        headers: getAuthHeaders({}, token),
      });

      if (res.ok) {
        const profile = await res.json();
        if (profile) {
          const cached = await this.getCachedUser();
          const nameParts = (profile.name || '').split(' ');
          const resolvedName =
            `${profile.firstName || ''} ${profile.lastName || ''}`.trim() ||
            profile.name ||
            cached?.name ||
            'SplitIt User';

          const emailVal = profile.email || cached?.email || '';
          const merged: AuthUser = {
            ...(cached || {}),
            id: profile.id || profile.uid || cached?.id || '',
            name: resolvedName,
            email: emailVal,
            avatarUrl: profile.avatarUrl || profile.image || cached?.avatarUrl,
            role: profile.role || cached?.role || 'user',
            firstName: profile.firstName || nameParts[0] || cached?.firstName,
            lastName: profile.lastName || nameParts.slice(1).join(' ') || cached?.lastName,
            username: profile.username || (emailVal ? emailVal.split('@')[0] : cached?.username),
            mobileNumber: profile.mobileNumber || cached?.mobileNumber,
            countryCode: profile.countryCode || cached?.countryCode,
            upiId: profile.upiId || undefined,
          };

          _cachedUser = merged;
          await SecureStore.setItemAsync(USER_KEY, JSON.stringify(merged));
          return merged;
        }
      }
      return null;
    } catch {
      return null;
    }
  },

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
      const mod = getNativeGoogleSignin();
      if (mod) {
        await mod.GoogleSignin.signOut().catch(() => {});
      }
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
        headers: getAuthHeaders(),
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
        upiId: data.user?.upiId || undefined,
      };

      await this.saveSession(token, user);

      // Hydrate authoritative profile with database upiId in background
      this.fetchUserProfile(token).then((profile) => {
        if (profile) _cachedUser = profile;
      });

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
        headers: getAuthHeaders(),
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
        upiId: data.user?.upiId || undefined,
      };

      await this.saveSession(token, user);
      return { success: true, token, user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during signup' };
    }
  },

  /**
   * Native phone Google login via Google Play Services / Credential Manager.
   * Exchanges the verified native ID token directly with Better-Auth backend.
   */
  async signInWithGoogle(): Promise<AuthResponse> {
    const nativeModule = getNativeGoogleSignin();

    if (nativeModule) {
      try {
        ensureGoogleConfigured();

        // Check for Google Play Services availability
        const hasPlay = await nativeModule.GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        }).catch(() => false);

        if (hasPlay) {
          // Trigger native Android / iOS Google Sign-In prompt
          const signInResult = await nativeModule.GoogleSignin.signIn();

          if (signInResult.type === 'cancelled') {
            return { success: false, error: 'Google sign-in was canceled' };
          }

          if (signInResult.type === 'success' && signInResult.data.idToken) {
            const idToken = signInResult.data.idToken;

            // Exchange native verified ID token directly with Better-Auth backend
            const res = await fetch(`${API_BASE_URL}/api/auth/sign-in/social`, {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({
                provider: 'google',
                idToken: {
                  token: idToken,
                },
              }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok || data.error) {
              return {
                success: false,
                error: data.message || data.error || 'Failed to authenticate Google credentials with server',
              };
            }

            const token =
              data.token ||
              data.session?.token ||
              res.headers.get('set-cookie')?.match(/better-auth\.session_token=([^;]+)/)?.[1] ||
              'session_active';
            const emailVal = data.user?.email || signInResult.data.user.email || '';
            const user: AuthUser = {
              id: data.user?.id || '',
              name: data.user?.name || signInResult.data.user.name || 'SplitIt User',
              email: emailVal,
              avatarUrl: data.user?.image || signInResult.data.user.photo || undefined,
              role: data.user?.role || 'user',
              upiId: data.user?.upiId || undefined,
            };

            await this.saveSession(token, user);

            // Hydrate authoritative profile with database upiId in background
            this.fetchUserProfile(token).then((profile) => {
              if (profile) _cachedUser = profile;
            });

            return { success: true, token, user };
          } else if (signInResult.type === 'success' && !signInResult.data.idToken) {
            return {
              success: false,
              error: 'Google sign-in succeeded on device but no ID token was returned. Check OAuth Web Client configuration.',
            };
          }
        }
      } catch (nativeErr: any) {
        if (nativeErr?.code === nativeModule.statusCodes?.SIGN_IN_CANCELLED) {
          return { success: false, error: 'Google sign-in was canceled' };
        }
        if (nativeErr?.code === nativeModule.statusCodes?.IN_PROGRESS) {
          return { success: false, error: 'Google sign-in is already in progress' };
        }
        if (nativeErr?.code === nativeModule.statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
          return { success: false, error: 'Google Play Services is not available on this device' };
        }
        // If native module is missing or failed unexpectedly and not user cancellation, fall back to WebBrowser
        if (
          !nativeErr?.message?.includes('RNGoogleSignin could not be found') &&
          !nativeErr?.message?.includes('TurboModule')
        ) {
          return {
            success: false,
            error: `Native Google Sign-In failed (${nativeErr?.code || 'error'}): ${nativeErr?.message || 'Check SHA-1 fingerprint in Google Cloud Console'}`,
          };
        }
      }
    }

    // WebBrowser fallback for environments without native binary link (e.g. Expo Go)
    try {
      const callbackUrl = Linking.createURL('auth/callback', { scheme: 'splitit' });
      let authUrl = `${API_BASE_URL}/api/auth/sign-in/social?provider=google&callbackURL=${encodeURIComponent(callbackUrl)}`;

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
          const profileRes = await fetch(`${API_BASE_URL}/api/user/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (profileRes.ok) {
            const profileData = await profileRes.json();
            const emailVal = profileData.email || '';
            const user: AuthUser = {
              id: profileData.id || profileData.user?.id || '',
              name: `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim() || profileData.name || 'SplitIt User',
              email: emailVal,
              avatarUrl: profileData.avatarUrl,
              upiId: profileData.upiId || undefined,
              role: profileData.role || profileData.user?.role || 'user',
            };
            await this.saveSession(token, user);
            return { success: true, token, user };
          }
        }

        const fallbackEmail = (parsed.queryParams?.email as string) || '';
        const fallbackUser: AuthUser = {
          id: 'google_user',
          name: 'SplitIt User',
          email: fallbackEmail,
          upiId: undefined,
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
          headers: getAuthHeaders({}, token),
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
        headers: getAuthHeaders({
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(token ? { Cookie: `better-auth.session_token=${token}` } : {}),
        }),
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

  /**
   * Request password reset recovery email.
   */
  async sendPasswordReset(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/send-password-reset`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        return { success: false, error: data.error || data.message || 'Failed to send recovery email' };
      }
      return { success: true, message: data.message || 'Password reset link sent to your email.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error sending reset email' };
    }
  },

  /**
   * Finalize password reset using cryptographic token.
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        return { success: false, error: data.message || data.error || 'Failed to reset password' };
      }
      return { success: true, message: data.message || 'Password updated successfully.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error resetting password' };
    }
  },

  /**
   * Upload user avatar image to backend storage.
   */
  async uploadAvatar(localUri: string): Promise<string | null> {
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );

      const token = await this.getToken();
      if (!token) return null;

      const formData = new FormData();
      formData.append('file', {
        uri: manipulated.uri,
        name: 'avatar.jpg',
        type: 'image/jpeg',
      } as any);

      const headers = getAuthHeaders({}, token);
      delete (headers as any)['Content-Type'];

      const res = await fetch(`${API_BASE_URL}/api/upload/avatar`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          const cached = await this.getCachedUser();
          if (cached) {
            const updated = { ...cached, avatarUrl: data.url };
            _cachedUser = updated;
            await SecureStore.setItemAsync(USER_KEY, JSON.stringify(updated));
          }
          return data.url;
        }
      }
      return null;
    } catch {
      return null;
    }
  },
};
