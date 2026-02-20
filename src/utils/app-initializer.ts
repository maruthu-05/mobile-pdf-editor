import AsyncStorage from '@react-native-async-storage/async-storage';
import { performanceMonitor } from './performance-monitor';
import { DocumentLibrary } from '../modules/document-library';
import { StorageManager } from '../modules/storage-manager/StorageManager';
import { OfflineManager } from '../modules/storage-manager/OfflineManager';

export interface AppInitializationResult {
  isFirstLaunch: boolean;
  onboardingCompleted: boolean;
  storageInitialized: boolean;
  performanceMonitoringStarted: boolean;
  offlineManagerInitialized: boolean;
}

class AppInitializer {
  private static instance: AppInitializer;
  private initialized = false;
  private initializationPromise: Promise<AppInitializationResult> | null = null;
  private initializationResult: AppInitializationResult | null = null;

  static getInstance(): AppInitializer {
    if (!AppInitializer.instance) {
      AppInitializer.instance = new AppInitializer();
    }
    return AppInitializer.instance;
  }

  async initialize(): Promise<AppInitializationResult> {
    // If already initialized, return cached result
    if (this.initialized && this.initializationResult) {
      console.log('App already initialized, returning cached result');
      return this.initializationResult;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      console.log('App initialization in progress, waiting...');
      return this.initializationPromise;
    }

    console.log('Starting app initialization...');

    const result: AppInitializationResult = {
      isFirstLaunch: false,
      onboardingCompleted: false,
      storageInitialized: false,
      performanceMonitoringStarted: false,
      offlineManagerInitialized: false,
    };

    // Store the promise to prevent concurrent initializations
    this.initializationPromise = (async () => {
      try {
        // Check if this is the first launch
        result.isFirstLaunch = await this.checkFirstLaunch();
        
        // Check onboarding status
        result.onboardingCompleted = await this.checkOnboardingStatus();

        // Initialize storage systems
        result.storageInitialized = await this.initializeStorage();

        // Initialize offline manager
        result.offlineManagerInitialized = await this.initializeOfflineManager();

        // Start performance monitoring
        result.performanceMonitoringStarted = this.initializePerformanceMonitoring();

        // Initialize document library
        await this.initializeDocumentLibrary();

        // Set app as initialized
        await this.markAsInitialized();

        this.initialized = true;
        this.initializationResult = result;
        console.log('App initialization completed successfully');

        return result;
      } catch (error) {
        console.error('App initialization failed:', error);
        this.initializationPromise = null; // Allow retry on failure
        throw error;
      }
    })();

    return this.initializationPromise;
  }

  private async checkFirstLaunch(): Promise<boolean> {
    try {
      const hasLaunched = await AsyncStorage.getItem('app_launched');
      const isFirstLaunch = hasLaunched === null;
      
      if (isFirstLaunch) {
        await AsyncStorage.setItem('app_launched', 'true');
        await AsyncStorage.setItem('first_launch_date', new Date().toISOString());
      }

      return isFirstLaunch;
    } catch (error) {
      console.error('Error checking first launch:', error);
      return false;
    }
  }

  private async checkOnboardingStatus(): Promise<boolean> {
    try {
      const onboardingCompleted = await AsyncStorage.getItem('onboarding_completed');
      return onboardingCompleted === 'true';
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  }

  private async initializeStorage(): Promise<boolean> {
    try {
      const storageManager = StorageManager.getInstance();
      // StorageManager doesn't need initialization, it's ready to use
      
      // Perform initial cleanup if needed
      const storageInfo = await storageManager.getStorageInfo();
      if (storageInfo.usagePercentage > 90) {
        console.log('Storage usage high, performing cleanup...');
        await storageManager.optimizeStorage();
      }

      return true;
    } catch (error) {
      console.error('Error initializing storage:', error);
      // Don't fail app initialization if storage check fails
      return true;
    }
  }

  private async initializeOfflineManager(): Promise<boolean> {
    try {
      const offlineManager = OfflineManager.getInstance();
      await offlineManager.initialize();
      return true;
    } catch (error) {
      console.error('Error initializing offline manager:', error);
      // Don't fail app initialization if offline manager fails
      return true;
    }
  }

  private initializePerformanceMonitoring(): boolean {
    try {
      // Start performance monitoring in development or if enabled in settings
      const shouldMonitor = __DEV__ || this.isPerformanceMonitoringEnabled();
      
      if (shouldMonitor) {
        performanceMonitor.startMonitoring(10000); // Monitor every 10 seconds
      }

      return shouldMonitor;
    } catch (error) {
      console.error('Error initializing performance monitoring:', error);
      return false;
    }
  }

  private async initializeDocumentLibrary(): Promise<void> {
    try {
      const documentLibrary = DocumentLibrary.getInstance();
      await documentLibrary.initialize();
    } catch (error) {
      console.error('Error initializing document library:', error);
      throw error;
    }
  }

  private async markAsInitialized(): Promise<void> {
    try {
      await AsyncStorage.setItem('app_initialized', 'true');
      await AsyncStorage.setItem('initialization_date', new Date().toISOString());
    } catch (error) {
      console.error('Error marking app as initialized:', error);
    }
  }

  private isPerformanceMonitoringEnabled(): boolean {
    // In a real app, this would check user settings
    // For now, enable in development mode
    return __DEV__;
  }

  async getInitializationInfo(): Promise<{
    isInitialized: boolean;
    initializationDate?: string;
    firstLaunchDate?: string;
  }> {
    try {
      const [isInitialized, initDate, firstLaunchDate] = await Promise.all([
        AsyncStorage.getItem('app_initialized'),
        AsyncStorage.getItem('initialization_date'),
        AsyncStorage.getItem('first_launch_date'),
      ]);

      return {
        isInitialized: isInitialized === 'true',
        initializationDate: initDate || undefined,
        firstLaunchDate: firstLaunchDate || undefined,
      };
    } catch (error) {
      console.error('Error getting initialization info:', error);
      return { isInitialized: false };
    }
  }

  async reset(): Promise<void> {
    try {
      console.log('Resetting app initialization...');
      
      // Stop performance monitoring
      performanceMonitor.stopMonitoring();
      
      // Clear initialization flags
      await AsyncStorage.multiRemove([
        'app_initialized',
        'initialization_date',
        'onboarding_completed',
      ]);

      this.initialized = false;
      console.log('App initialization reset completed');
    } catch (error) {
      console.error('Error resetting app initialization:', error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const appInitializer = AppInitializer.getInstance();