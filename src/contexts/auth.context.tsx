import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, AuthUser, AuthResponse } from '../services/auth.service';

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

  const signInWithEmail = async (email: string, password: string): Promise<AuthResponse> => {
    const res = await authService.signInWithEmail(email, password);
    if (res.success && res.user) {
      setUser(res.user);
    }
    return res;
  };

  const signUpWithEmail = async (name: string, email: string, password: string): Promise<AuthResponse> => {
    const res = await authService.signUpWithEmail(name, email, password);
    if (res.success && res.user) {
      setUser(res.user);
    }
    return res;
  };

  const signInWithGoogle = async (): Promise<AuthResponse> => {
    const res = await authService.signInWithGoogle();
    if (res.success && res.user) {
      setUser(res.user);
    }
    return res;
  };

  const signOut = async () => {
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
