import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, AuthUser, AuthResponse } from '../services/auth.service';
import { groupService } from '../services/group.service';
import { expenseService } from '../services/expense.service';
import { balanceService } from '../services/balance.service';
import { notificationService } from '../services/notification.service';
import { settlementService } from '../services/settlement.service';
import { supportService } from '../services/support.service';
import { demoService } from '../services/demo.service';
import { storageService } from '../services/storage.service';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<AuthResponse>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<AuthResponse>;
  signInWithGoogle: () => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  updateUserProfile: (updates: Partial<AuthUser>) => Promise<AuthUser | null>;
  refreshUser: () => Promise<void>;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  isLoading: true,
  signInWithEmail: async (email, password) => authService.signInWithEmail(email, password),
  signUpWithEmail: async (name, email, password) => authService.signUpWithEmail(name, email, password),
  signInWithGoogle: async () => authService.signInWithGoogle(),
  signOut: async () => authService.clearSession(),
  updateUserProfile: async (updates) => authService.updateUserProfile(updates),
  refreshUser: async () => {},
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAllAppData = async () => {
    // 1. Wipe all user-scoped caches from persistent storage
    await storageService.clearAllUserData();

    // 2. Clear all in-memory service singletons and memory maps
    groupService.clearCache();
    expenseService.clearCache();
    balanceService.clearCache();
    notificationService.clearCache();
    settlementService.clearCache();
    supportService.clearCache();
    demoService.clearCache();
  };

  const refreshUser = async () => {
    try {
      const cached = await authService.getCachedUser();
      if (cached) {
        setUser(cached);
      }
      const remote = await authService.fetchUserProfile();
      if (remote) {
        setUser(remote);
      }
    } catch {
      // safe fallback
    }
  };

  useEffect(() => {
    // Check for existing session in Keychain/Keystore
    const rehydrateAuth = async () => {
      try {
        const token = await authService.getToken();
        if (token) {
          const cachedUser = await authService.getCachedUser();
          if (cachedUser) {
            setUser(cachedUser);
            demoService.preloadDismissedState(cachedUser.id).catch(() => {});
          }
          // Fetch authoritative profile with upiId in background
          authService.fetchUserProfile(token).then((remote) => {
            if (remote) {
              setUser(remote);
              demoService.preloadDismissedState(remote.id).catch(() => {});
            }
          });
        }
      } catch {
        // Rehydration fallback
      } finally {
        setIsLoading(false);
      }
    };

    rehydrateAuth();
  }, []);

  const signInWithEmail = async (email: string, password: string): Promise<AuthResponse> => {
    await clearAllAppData();
    const res = await authService.signInWithEmail(email, password);
    if (res.success && res.user) {
      setUser(res.user);
      demoService.preloadDismissedState(res.user.id).catch(() => {});
      authService.fetchUserProfile(res.token).then((remote) => {
        if (remote) {
          setUser(remote);
          demoService.preloadDismissedState(remote.id).catch(() => {});
        }
      });
    }
    return res;
  };

  const signUpWithEmail = async (name: string, email: string, password: string): Promise<AuthResponse> => {
    await clearAllAppData();
    const res = await authService.signUpWithEmail(name, email, password);
    if (res.success && res.user) {
      setUser(res.user);
      demoService.preloadDismissedState(res.user.id).catch(() => {});
      authService.fetchUserProfile(res.token).then((remote) => {
        if (remote) {
          setUser(remote);
          demoService.preloadDismissedState(remote.id).catch(() => {});
        }
      });
    }
    return res;
  };

  const signInWithGoogle = async (): Promise<AuthResponse> => {
    await clearAllAppData();
    const res = await authService.signInWithGoogle();
    if (res.success && res.user) {
      setUser(res.user);
      demoService.preloadDismissedState(res.user.id).catch(() => {});
      authService.fetchUserProfile(res.token).then((remote) => {
        if (remote) {
          setUser(remote);
          demoService.preloadDismissedState(remote.id).catch(() => {});
        }
      });
    }
    return res;
  };

  const signOut = async () => {
    await clearAllAppData();
    await authService.clearSession();
    setUser(null);
  };

  const updateUserProfile = async (updates: Partial<AuthUser>): Promise<AuthUser | null> => {
    const updated = await authService.updateUserProfile(updates);
    if (updated) {
      setUser(updated);
    }
    return updated;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
        updateUserProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  return ctx || defaultAuthContext;
};
