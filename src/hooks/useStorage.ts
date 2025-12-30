import { useState, useEffect, useCallback } from 'react';
import { StorageManager } from '../modules/storage-manager/StorageManager';
import type { 
  StorageInfo, 
  StorageSettings, 
  StorageCleanupOptions 
} from '../modules/storage-manager/interfaces';

export const useStorage = () => {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [storageSettings, setStorageSettings] = useState<StorageSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const storageManager = StorageManager.getInstance();

  const loadStorageInfo = useCallback(async () => {
    try {
      const info = await storageManager.getStorageInfo();
      setStorageInfo(info);
      return info;
    } catch (error) {
      console.error('Failed to load storage info:', error);
      throw error;
    }
  }, [storageManager]);

  const loadStorageSettings = useCallback(async () => {
    try {
      const settings = await storageManager.getStorageSettings();
      setStorageSettings(settings);
      return settings;
    } catch (error) {
      console.error('Failed to load storage settings:', error);
      throw error;
    }
  }, [storageManager]);

  const updateStorageSettings = useCallback(async (updates: Partial<StorageSettings>) => {
    try {
      await storageManager.updateStorageSettings(updates);
      const updatedSettings = await loadStorageSettings();
      return updatedSettings;
    } catch (error) {
      console.error('Failed to update storage settings:', error);
      throw error;
    }
  }, [storageManager, loadStorageSettings]);

  const cleanupStorage = useCallback(async (options: StorageCleanupOptions) => {
    try {
      const bytesFreed = await storageManager.cleanupStorage(options);
      // Refresh storage info after cleanup
      await loadStorageInfo();
      return bytesFreed;
    } catch (error) {
      console.error('Failed to cleanup storage:', error);
      throw error;
    }
  }, [storageManager, loadStorageInfo]);

  const compressFile = useCallback(async (filePath: string) => {
    try {
      if (!storageSettings) {
        throw new Error('Storage settings not loaded');
      }
      
      const compressedPath = await storageManager.compressFile(
        filePath, 
        storageSettings.compressionOptions
      );
      
      // Refresh storage info after compression
      await loadStorageInfo();
      return compressedPath;
    } catch (error) {
      console.error('Failed to compress file:', error);
      throw error;
    }
  }, [storageManager, storageSettings, loadStorageInfo]);

  const optimizeStorage = useCallback(async () => {
    try {
      await storageManager.optimizeStorage();
      // Refresh storage info after optimization
      await loadStorageInfo();
    } catch (error) {
      console.error('Failed to optimize storage:', error);
      throw error;
    }
  }, [storageManager, loadStorageInfo]);

  const checkStorageWarning = useCallback(async () => {
    try {
      return await storageManager.checkStorageWarning();
    } catch (error) {
      console.error('Failed to check storage warning:', error);
      return false;
    }
  }, [storageManager]);

  const startStorageMonitoring = useCallback(async () => {
    if (isMonitoring) return;
    
    try {
      setIsMonitoring(true);
      
      // Monitor storage every 30 seconds
      const monitorInterval = setInterval(async () => {
        try {
          await storageManager.monitorStorage();
          await loadStorageInfo();
        } catch (error) {
          console.warn('Storage monitoring error:', error);
        }
      }, 30000);

      // Return cleanup function
      return () => {
        clearInterval(monitorInterval);
        setIsMonitoring(false);
      };
    } catch (error) {
      console.error('Failed to start storage monitoring:', error);
      setIsMonitoring(false);
    }
  }, [storageManager, isMonitoring, loadStorageInfo]);

  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const getStorageStatus = useCallback(() => {
    if (!storageInfo || !storageSettings) return null;

    const { usagePercentage } = storageInfo;
    const { warningThreshold, maxStorageUsage } = storageSettings;

    if (usagePercentage >= maxStorageUsage) {
      return {
        level: 'critical' as const,
        message: 'Storage is critically low',
        color: '#ff4444',
      };
    } else if (usagePercentage >= warningThreshold) {
      return {
        level: 'warning' as const,
        message: 'Storage is running low',
        color: '#ffaa00',
      };
    } else {
      return {
        level: 'normal' as const,
        message: 'Storage is healthy',
        color: '#44aa44',
      };
    }
  }, [storageInfo, storageSettings]);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        await Promise.all([
          loadStorageInfo(),
          loadStorageSettings(),
        ]);
      } catch (error) {
        console.error('Failed to initialize storage hook:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [loadStorageInfo, loadStorageSettings]);

  return {
    // State
    storageInfo,
    storageSettings,
    isLoading,
    isMonitoring,
    
    // Actions
    loadStorageInfo,
    loadStorageSettings,
    updateStorageSettings,
    cleanupStorage,
    compressFile,
    optimizeStorage,
    checkStorageWarning,
    startStorageMonitoring,
    
    // Utilities
    formatBytes,
    getStorageStatus,
  };
};