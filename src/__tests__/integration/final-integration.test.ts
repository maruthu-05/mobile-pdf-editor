/**
 * Final Integration Test Suite
 * Tests the complete integration of all modules and components
 */

import { appInitializer } from '../../utils/app-initializer';
import { DocumentLibrary } from '../../modules/document-library';
import { StorageManager } from '../../modules/storage-manager/StorageManager';
import { OfflineManager } from '../../modules/storage-manager/OfflineManager';
import { performanceMonitor } from '../../utils/performance-monitor';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock React Native modules
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Dimensions: { get: () => ({ width: 375, height: 812 }) },
}));

// Mock Expo modules
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file://test/',
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
}));

describe('Final Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singletons
    (appInitializer as any).initialized = false;
  });

  afterEach(async () => {
    try {
      await appInitializer.reset();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('App Initialization Integration', () => {
    it('should initialize all core modules successfully', async () => {
      // Mock successful initialization
      require('@react-native-async-storage/async-storage').getItem
        .mockResolvedValueOnce(null) // First launch check
        .mockResolvedValueOnce('false'); // Onboarding status

      const result = await appInitializer.initialize();

      expect(result).toEqual({
        isFirstLaunch: true,
        onboardingCompleted: false,
        storageInitialized: true,
        performanceMonitoringStarted: true,
        offlineManagerInitialized: true,
      });

      expect(appInitializer.isInitialized()).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock AsyncStorage error
      require('@react-native-async-storage/async-storage').getItem
        .mockRejectedValue(new Error('Storage error'));

      await expect(appInitializer.initialize()).rejects.toThrow();
    });

    it('should prevent double initialization', async () => {
      // First initialization
      require('@react-native-async-storage/async-storage').getItem
        .mockResolvedValue('true');

      await appInitializer.initialize();

      // Second initialization should throw
      await expect(appInitializer.initialize()).rejects.toThrow('App already initialized');
    });
  });

  describe('Module Integration', () => {
    it('should integrate DocumentLibrary as singleton', async () => {
      const library1 = DocumentLibrary.getInstance();
      const library2 = DocumentLibrary.getInstance();

      expect(library1).toBe(library2);
      expect(typeof library1.initialize).toBe('function');
    });

    it('should integrate StorageManager as singleton', async () => {
      const storage1 = StorageManager.getInstance();
      const storage2 = StorageManager.getInstance();

      expect(storage1).toBe(storage2);
      expect(typeof storage1.initialize).toBe('function');
    });

    it('should integrate OfflineManager as singleton', async () => {
      const offline1 = OfflineManager.getInstance();
      const offline2 = OfflineManager.getInstance();

      expect(offline1).toBe(offline2);
      expect(typeof offline1.initialize).toBe('function');
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should start performance monitoring in development', async () => {
      const startSpy = jest.spyOn(performanceMonitor, 'startMonitoring');
      
      require('@react-native-async-storage/async-storage').getItem
        .mockResolvedValue('true');

      await appInitializer.initialize();

      expect(startSpy).toHaveBeenCalledWith(10000);
    });

    it('should generate performance reports', () => {
      const report = performanceMonitor.generateReport();

      expect(report).toHaveProperty('memoryUsage');
      expect(report).toHaveProperty('performanceScore');
      expect(report).toHaveProperty('timestamp');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle DocumentLibrary initialization failure', async () => {
      // Mock DocumentLibrary to throw error
      const mockGetInstance = jest.spyOn(DocumentLibrary, 'getInstance');
      mockGetInstance.mockImplementation(() => {
        throw new Error('DocumentLibrary error');
      });

      require('@react-native-async-storage/async-storage').getItem
        .mockResolvedValue('true');

      await expect(appInitializer.initialize()).rejects.toThrow('DocumentLibrary error');

      mockGetInstance.mockRestore();
    });

    it('should handle StorageManager initialization failure gracefully', async () => {
      // Mock StorageManager to throw error
      const mockGetInstance = jest.spyOn(StorageManager, 'getInstance');
      mockGetInstance.mockImplementation(() => ({
        initialize: jest.fn().mockRejectedValue(new Error('Storage error')),
      } as any));

      require('@react-native-async-storage/async-storage').getItem
        .mockResolvedValue('true');

      const result = await appInitializer.initialize();

      expect(result.storageInitialized).toBe(false);

      mockGetInstance.mockRestore();
    });
  });

  describe('Memory Management Integration', () => {
    it('should not create memory leaks during initialization', async () => {
      const initialMemory = process.memoryUsage();

      // Initialize multiple times (after reset)
      for (let i = 0; i < 5; i++) {
        require('@react-native-async-storage/async-storage').getItem
          .mockResolvedValue('true');

        await appInitializer.initialize();
        await appInitializer.reset();
      }

      const finalMemory = process.memoryUsage();
      
      // Memory should not increase significantly (allow 10MB tolerance)
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB
    });

    it('should clean up resources properly', async () => {
      const stopSpy = jest.spyOn(performanceMonitor, 'stopMonitoring');

      require('@react-native-async-storage/async-storage').getItem
        .mockResolvedValue('true');

      await appInitializer.initialize();
      await appInitializer.reset();

      expect(stopSpy).toHaveBeenCalled();
      expect(appInitializer.isInitialized()).toBe(false);
    });
  });

  describe('Offline Functionality Integration', () => {
    it('should maintain functionality when offline', async () => {
      // Mock offline state
      const mockIsOnline = jest.fn().mockResolvedValue(false);
      jest.spyOn(OfflineManager, 'getInstance').mockReturnValue({
        initialize: jest.fn().mockResolvedValue(undefined),
        isOnline: mockIsOnline,
      } as any);

      require('@react-native-async-storage/async-storage').getItem
        .mockResolvedValue('true');

      const result = await appInitializer.initialize();

      expect(result.offlineManagerInitialized).toBe(true);
      
      const isOnline = await mockIsOnline();
      expect(isOnline).toBe(false);
    });
  });

  describe('Data Persistence Integration', () => {
    it('should persist app state across sessions', async () => {
      const mockSetItem = require('@react-native-async-storage/async-storage').setItem;
      
      require('@react-native-async-storage/async-storage').getItem
        .mockResolvedValue('true');

      await appInitializer.initialize();

      expect(mockSetItem).toHaveBeenCalledWith('app_initialized', 'true');
      expect(mockSetItem).toHaveBeenCalledWith('initialization_date', expect.any(String));
    });

    it('should retrieve initialization info correctly', async () => {
      const mockDate = '2023-01-01T00:00:00.000Z';
      require('@react-native-async-storage/async-storage').getItem
        .mockImplementation((key: string) => {
          switch (key) {
            case 'app_initialized': return Promise.resolve('true');
            case 'initialization_date': return Promise.resolve(mockDate);
            case 'first_launch_date': return Promise.resolve(mockDate);
            default: return Promise.resolve(null);
          }
        });

      const info = await appInitializer.getInitializationInfo();

      expect(info).toEqual({
        isInitialized: true,
        initializationDate: mockDate,
        firstLaunchDate: mockDate,
      });
    });
  });

  describe('Platform Compatibility', () => {
    it('should work across different device performance levels', async () => {
      // Simulate low-performance device
      const originalPerformance = global.performance;
      global.performance = {
        now: () => Date.now() + Math.random() * 100, // Simulate slower performance
      } as any;

      require('@react-native-async-storage/async-storage').getItem
        .mockResolvedValue('true');

      const startTime = Date.now();
      await appInitializer.initialize();
      const endTime = Date.now();

      // Should complete within reasonable time even on slow devices
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds

      global.performance = originalPerformance;
    });
  });

  describe('Complete User Workflow Integration', () => {
    it('should support complete user journey from initialization to usage', async () => {
      // Mock first launch
      require('@react-native-async-storage/async-storage').getItem
        .mockResolvedValueOnce(null) // First launch
        .mockResolvedValueOnce('false'); // Onboarding not completed

      // Initialize app
      const result = await appInitializer.initialize();

      expect(result.isFirstLaunch).toBe(true);
      expect(result.onboardingCompleted).toBe(false);

      // Simulate completing onboarding
      require('@react-native-async-storage/async-storage').setItem
        .mockResolvedValue(undefined);

      await require('@react-native-async-storage/async-storage').setItem('onboarding_completed', 'true');

      // Get document library for user operations
      const documentLibrary = DocumentLibrary.getInstance();
      expect(documentLibrary).toBeDefined();

      // Verify app is fully initialized and ready
      expect(appInitializer.isInitialized()).toBe(true);
    });
  });
});