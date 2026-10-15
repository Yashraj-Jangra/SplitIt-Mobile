import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, AuthUser, AuthResponse } from '../services/auth.service';
import { groupService } from '../services/group.service';
import { expenseService } from '../services/expense.service';
import { balanceService } from '../services/balance.service';
import { notificationService } from '../services/notification.service';
import { demoService } from '../services/demo.service';
import { storageService, STORAGE_KEYS } from '../services/storage.service';

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const cached = await authService.getCachedUser();
      if (cached) {
        setUser(cached);
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
          }
        }
      } catch {
        // Rehydration fallback
      } finally {
        setIsLoading(false);
      }
    };

    rehydrateAuth();
  }, []);

  const clearUserDataCaches = async () => {
    groupService.clearCache();
    expenseService.clearCache();
    balanceService.clearCache();
    notificationService.clearCache();
    demoService.clearCache();
  };

  const signInWithEmail = async (email: string, password: string): Promise<AuthResponse> => {
    await clearUserDataCaches();
    const res = await authService.signInWithEmail(email, password);
    if (res.success && res.user) {
      setUser(res.user);
    }
    return res;
  };

  const signUpWithEmail = async (name: string, email: string, password: string): Promise<AuthResponse> => {
    await clearUserDataCaches();
    const res = await authService.signUpWithEmail(name, email, password);
    if (res.success && res.user) {
      setUser(res.user);
    }
    return res;
  };

  const signInWithGoogle = async (): Promise<AuthResponse> => {
    await clearUserDataCaches();
    const res = await authService.signInWithGoogle();
    if (res.success && res.user) {
      setUser(res.user);
    }
    return res;
  };

  const signOut = async () => {
    await clearUserDataCaches();
    await storageService.removeItem(STORAGE_KEYS.GROUPS);
    await storageService.removeItem(STORAGE_KEYS.USER_TRANSACTIONS);
    await storageService.removeItem(STORAGE_KEYS.BALANCE_SUMMARY);
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

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
