import { useState, useEffect } from 'react';
import { OfflineManager, OfflineState } from '../modules/storage-manager/OfflineManager';

export const useOffline = () => {
  const [offlineState, setOfflineState] = useState<OfflineState>({
    isOnline: true,
    lastOnlineTime: new Date(),
    pendingOperations: [],
  });
  const [isInitialized, setIsInitialized] = useState(false);

  const offlineManager = OfflineManager.getInstance();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initialize = async () => {
      try {
        await offlineManager.initialize();
        
        // Get initial state
        const initialState = offlineManager.getOfflineState();
        setOfflineState(initialState);

        // Subscribe to state changes
        unsubscribe = offlineManager.addListener((state) => {
          setOfflineState(state);
        });

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize offline manager:', error);
        setIsInitialized(true); // Still mark as initialized to prevent infinite loading
      }
    };

    initialize();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const addPendingOperation = async (
    type: 'upload' | 'sync' | 'backup',
    data: any
  ) => {
    try {
      await offlineManager.addPendingOperation({ type, data });
    } catch (error) {
      console.error('Failed to add pending operation:', error);
      throw error;
    }
  };

  const ensureOfflineCapability = async (): Promise<boolean> => {
    try {
      return await offlineManager.ensureOfflineCapability();
    } catch (error) {
      console.error('Failed to ensure offline capability:', error);
      return false;
    }
  };

  const preloadEssentialData = async (): Promise<void> => {
    try {
      await offlineManager.preloadEssentialData();
    } catch (error) {
      console.error('Failed to preload essential data:', error);
    }
  };

  return {
    isOnline: offlineState.isOnline,
    lastOnlineTime: offlineState.lastOnlineTime,
    pendingOperations: offlineState.pendingOperations,
    isInitialized,
    addPendingOperation,
    ensureOfflineCapability,
    preloadEssentialData,
  };
};