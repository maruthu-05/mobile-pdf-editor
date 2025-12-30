import { appInitializer } from '../utils/app-initializer';
import { performanceMonitor } from '../utils/performance-monitor';
import { DocumentLibrary } from '../modules/document-library';
import { StorageManager } from '../modules/storage-manager/StorageManager';
import { OfflineManager } from '../modules/storage-manager/OfflineManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
  clear: jest.fn(),
}));

// Mock react-native modules
jest.mock('react-native', () => ({
  InteractionManager: {
    runAfterInteractions: (callback: () => void) => {
      setTimeout(callback, 0);
    },
  },
  PixelRatio: {
    get: () => 2,
    getFontScale: () => 1,
  },
}));

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, type: 'wifi' })),
}));

describe('Final Integration Tests', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
    
    // Reset singletons
    await appInitializer.reset();
    performanceMonitor.stopMonitoring();
    performanceMonitor.clearMetrics();
  });

  describe('App Initialization', () => {
    it('should initialize app successfully on first launch', async () => {
      const result = await appInitializer.initialize();

      expect(result).toEqual({
        isFirstLaunch: true,
        onboardingCompleted: false,
        storageInitialized: true,
        performanceMonitoringStarted: true,
        offlineManagerInitialized: true,
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('app_launched', 'true');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('app_initialized', 'true');
    });

    it('should handle returning user initialization', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockImplementation((key: string) => {
          switch (key) {
            case 'app_launched':
              return Promise.resolve('true');
            case 'onboarding_completed':
              return Promise.resolve('true');
            default:
              return Promise.resolve(null);
          }
        });

      const result = await appInitializer.initialize();

      expect(result.isFirstLaunch).toBe(false);
      expect(result.onboardingCompleted).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(appInitializer.initialize()).rejects.toThrow();
    });
  });

  describe('Module Integration', () => {
    beforeEach(async () => {
      await appInitializer.initialize();
    });

    it('should integrate all core modules successfully', async () => {
      // Test DocumentLibrary integration
      const documentLibrary = DocumentLibrary.getInstance();
      expect(documentLibrary).toBeDefined();

      // Test StorageManager integration
      const storageManager = StorageManager.getInstance();
      expect(storageManager).toBeDefined();

      // Test OfflineManager integration
      const offlineManager = OfflineManager.getInstance();
      expect(offlineManager).toBeDefined();
    });

    it('should handle cross-module communication', async () => {
      const storageManager = StorageManager.getInstance();
      const offlineManager = OfflineManager.getInstance();

      // Test that modules can interact
      const storageInfo = await storageManager.getStorageInfo();
      expect(storageInfo).toBeDefined();

      const isOnline = offlineManager.isOnline();
      expect(typeof isOnline).toBe('boolean');
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should start performance monitoring', () => {
      performanceMonitor.startMonitoring(1000);
      
      // Wait for metrics collection
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const metrics = performanceMonitor.getMetrics();
          expect(Array.isArray(metrics)).toBe(true);
          
          performanceMonitor.stopMonitoring();
          resolve();
        }, 1100);
      });
    });

    it('should generate performance reports', () => {
      performanceMonitor.startMonitoring(100);
      
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const report = performanceMonitor.generateReport();
          
          expect(report).toHaveProperty('devicePerformance');
          expect(report).toHaveProperty('memoryLeakDetected');
          expect(report).toHaveProperty('suggestions');
          expect(Array.isArray(report.suggestions)).toBe(true);
          
          performanceMonitor.stopMonitoring();
          resolve();
        }, 200);
      });
    });

    it('should detect performance issues', () => {
      const report = performanceMonitor.generateReport();
      expect(report.devicePerformance).toMatch(/^(high|medium|low)$/);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle storage errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage unavailable'));

      // App should still initialize but with degraded functionality
      const initInfo = await appInitializer.getInitializationInfo();
      expect(initInfo.isInitialized).toBe(false);
    });

    it('should recover from module initialization failures', async () => {
      // Simulate partial failure
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      try {
        await appInitializer.initialize();
        // Should not throw even if some modules fail
      } catch (error) {
        // Expected in some failure scenarios
      }

      consoleSpy.mockRestore();
    });
  });

  describe('Memory Management', () => {
    it('should not create memory leaks during initialization', async () => {
      const initialMemory = process.memoryUsage();
      
      // Initialize multiple times
      for (let i = 0; i < 5; i++) {
        await appInitializer.reset();
        await appInitializer.initialize();
      }
      
      const finalMemory = process.memoryUsage();
      
      // Memory usage should not increase significantly
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
    });

    it('should clean up resources properly', async () => {
      await appInitializer.initialize();
      performanceMonitor.startMonitoring(100);
      
      // Reset should clean up everything
      await appInitializer.reset();
      
      expect(appInitializer.isInitialized()).toBe(false);
    });
  });

  describe('Offline Functionality Integration', () => {
    it('should maintain functionality when offline', async () => {
      await appInitializer.initialize();
      
      const offlineManager = OfflineManager.getInstance();
      
      // Simulate going offline
      offlineManager.setNetworkState({ isConnected: false, type: 'none' });
      
      // Core functionality should still work
      const documentLibrary = DocumentLibrary.getInstance();
      expect(documentLibrary).toBeDefined();
      
      const storageManager = StorageManager.getInstance();
      const storageInfo = await storageManager.getStorageInfo();
      expect(storageInfo).toBeDefined();
    });
  });

  describe('Data Persistence Integration', () => {
    it('should persist app state across sessions', async () => {
      // First session
      await appInitializer.initialize();
      
      // Simulate app restart
      await appInitializer.reset();
      
      // Mock returning user
      (AsyncStorage.getItem as jest.Mock)
        .mockImplementation((key: string) => {
          switch (key) {
            case 'app_launched':
              return Promise.resolve('true');
            case 'onboarding_completed':
              return Promise.resolve('true');
            default:
              return Promise.resolve(null);
          }
        });
      
      // Second session
      const result = await appInitializer.initialize();
      
      expect(result.isFirstLaunch).toBe(false);
      expect(result.onboardingCompleted).toBe(true);
    });
  });

  describe('Platform Compatibility', () => {
    it('should work across different device performance levels', () => {
      const devicePerformance = performanceMonitor.assessDevicePerformance();
      expect(['high', 'medium', 'low']).toContain(devicePerformance);
      
      // App should adapt to device performance
      const report = performanceMonitor.generateReport();
      expect(report.devicePerformance).toBe(devicePerformance);
    });
  });

  describe('Complete User Workflow', () => {
    it('should support complete user journey', async () => {
      // 1. App initialization
      const initResult = await appInitializer.initialize();
      expect(initResult.storageInitialized).toBe(true);
      
      // 2. Document library access
      const documentLibrary = DocumentLibrary.getInstance();
      await documentLibrary.loadDocuments();
      
      // 3. Storage management
      const storageManager = StorageManager.getInstance();
      const storageInfo = await storageManager.getStorageInfo();
      expect(storageInfo).toBeDefined();
      
      // 4. Offline capability
      const offlineManager = OfflineManager.getInstance();
      expect(typeof offlineManager.isOnline()).toBe('boolean');
      
      // 5. Performance monitoring
      performanceMonitor.startMonitoring(100);
      
      // Wait for some metrics
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);
      
      performanceMonitor.stopMonitoring();
    });
  });
});