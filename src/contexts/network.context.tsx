import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';

interface NetworkContextValue {
  isOnline: boolean;
  connectionType: string;
  isInternetReachable: boolean | null;
  requireOnline: (actionName?: string) => boolean;
}

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  connectionType: 'unknown',
  isInternetReachable: true,
  requireOnline: () => true,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState('unknown');
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);

  useEffect(() => {
    // Initial fetch
    NetInfo.fetch().then((state: NetInfoState) => {
      const online = state.isConnected !== false && state.isInternetReachable !== false;
      setIsOnline(online);
      setConnectionType(state.type || 'unknown');
      setIsInternetReachable(state.isInternetReachable);
    });

    // Event listener
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected !== false && state.isInternetReachable !== false;
      setIsOnline(online);
      setConnectionType(state.type || 'unknown');
      setIsInternetReachable(state.isInternetReachable);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  /**
   * Action guard: Prompts the user with an alert and haptic feedback
   * if they attempt a server mutation while offline.
   * Returns true if online, false if offline.
   */
  const requireOnline = useCallback(
    (actionName: string = 'modify records') => {
      if (!isOnline) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'Offline Mode',
          `You are currently offline. Please reconnect to the internet to ${actionName}.`,
          [{ text: 'OK', style: 'default' }]
        );
        return false;
      }
      return true;
    },
    [isOnline]
  );

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        connectionType,
        isInternetReachable,
        requireOnline,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
