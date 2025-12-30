/**
 * Final Integration Module
 * Handles the integration of all core modules and provides a unified interface
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DocumentLibrary } from '../modules/document-library';
import { StorageManager } from '../modules/storage-manager/StorageManager';
import { OfflineManager } from '../modules/storage-manager/OfflineManager';
import { performanceMonitor } from './performance-monitor';

export interface IntegrationStatus {
  documentLibrary: boolean;
  storageManager: boolean;
  offlineManager: boolean;
  performanceMonitor: boolean;
  overallHealth: 'healthy' | 'degraded' | 'critical';
}

export class FinalIntegration {
  private static instance: FinalIntegration;
  private initialized = false;
  private documentLibrary: DocumentLibrary | null = null;
  private storageManager: StorageManager | null = null;
  private offlineManager: OfflineManager | null = null;

  static getInstance(): FinalIntegration {
    if (!FinalIntegration.instance) {
      FinalIntegration.instance = new FinalIntegration();
    }
    return FinalIntegration.instance;
  }

  async initialize(): Promise<IntegrationStatus> {
    if (this.initialized) {
      return this.getStatus();
    }

    console.log('Starting final integration...');

    const status: IntegrationStatus = {
      documentLibrary: false,
      storageManager: false,
      offlineManager: false,
      performanceMonitor: false,
      overallHealth: 'critical'
    };

    try {
      // Initialize Document Library
      try {
        this.documentLibrary = DocumentLibrary.getInstance();
        await this.documentLibrary.initialize();
        status.documentLibrary = true;
        console.log('✓ Document Library initialized');
      } catch (error) {
        console.error('✗ Document Library initialization failed:', error);
      }

      // Initialize Storage Manager
      try {
        this.storageManager = StorageManager.getInstance();
        await this.storageManager.initialize();
        status.storageManager = true;
        console.log('✓ Storage Manager initialized');
      } catch (error) {
        console.error('✗ Storage Manager initialization failed:', error);
      }

      // Initialize Offline Manager
      try {
        this.offlineManager = OfflineManager.getInstance();
        await this.offlineManager.initialize();
        status.offlineManager = true;
        console.log('✓ Offline Manager initialized');
      } catch (error) {
        console.error('✗ Offline Manager initialization failed:', error);
      }

      // Initialize Performance Monitor
      try {
        if (__DEV__) {
          performanceMonitor.startMonitoring(10000);
        }
        status.performanceMonitor = true;
        console.log('✓ Performance Monitor initialized');
      } catch (error) {
        console.error('✗ Performance Monitor initialization failed:', error);
      }

      // Determine overall health
      const successCount = Object.values(status).filter(v => v === true).length;
      if (successCount >= 3) {
        status.overallHealth = 'healthy';
      } else if (successCount >= 2) {
        status.overallHealth = 'degraded';
      } else {
        status.overallHealth = 'critical';
      }

      this.initialized = true;
      console.log(`Final integration completed with ${status.overallHealth} status`);

      return status;
    } catch (error) {
      console.error('Final integration failed:', error);
      throw error;
    }
  }

  getStatus(): IntegrationStatus {
    return {
      documentLibrary: this.documentLibrary !== null,
      storageManager: this.storageManager !== null,
      offlineManager: this.offlineManager !== null,
      performanceMonitor: performanceMonitor.isMonitoring(),
      overallHealth: this.initialized ? 'healthy' : 'critical'
    };
  }

  async performHealthCheck(): Promise<{
    status: IntegrationStatus;
    details: Record<string, any>;
  }> {
    const status = this.getStatus();
    const details: Record<string, any> = {};

    // Check Document Library health
    if (this.documentLibrary) {
      try {
        const stats = await this.documentLibrary.getLibraryStats();
        details.documentLibrary = {
          healthy: true,
          totalDocuments: stats.totalDocuments,
          totalSize: stats.totalSize
        };
      } catch (error) {
        details.documentLibrary = {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Check Storage Manager health
    if (this.storageManager) {
      try {
        const storageInfo = await this.storageManager.getStorageInfo();
        details.storageManager = {
          healthy: true,
          usagePercentage: storageInfo.usagePercentage,
          availableSpace: storageInfo.availableSpace
        };
      } catch (error) {
        details.storageManager = {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Check Offline Manager health
    if (this.offlineManager) {
      try {
        const isOnline = await this.offlineManager.isOnline();
        details.offlineManager = {
          healthy: true,
          isOnline,
          offlineCapable: true
        };
      } catch (error) {
        details.offlineManager = {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Check Performance Monitor health
    if (performanceMonitor.isMonitoring()) {
      try {
        const report = performanceMonitor.generateReport();
        details.performanceMonitor = {
          healthy: true,
          memoryUsage: report.memoryUsage,
          performanceScore: report.performanceScore
        };
      } catch (error) {
        details.performanceMonitor = {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return { status, details };
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up final integration...');

    try {
      // Stop performance monitoring
      if (performanceMonitor.isMonitoring()) {
        performanceMonitor.stopMonitoring();
      }

      // Cleanup storage manager
      if (this.storageManager) {
        await this.storageManager.performCleanup();
      }

      this.initialized = false;
      console.log('Final integration cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  // Convenience methods for accessing integrated modules
  getDocumentLibrary(): DocumentLibrary | null {
    return this.documentLibrary;
  }

  getStorageManager(): StorageManager | null {
    return this.storageManager;
  }

  getOfflineManager(): OfflineManager | null {
    return this.offlineManager;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const finalIntegration = FinalIntegration.getInstance();