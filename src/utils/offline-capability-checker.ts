import { OfflineManager } from '../modules/storage-manager/OfflineManager';
import { StorageManager } from '../modules/storage-manager/StorageManager';
import { DocumentLibrary } from '../modules/document-library/DocumentLibrary';
import { PDFEngine } from '../modules/pdf-engine/PDFEngine';
import { FileManager } from '../modules/file-manager/FileManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OfflineCapabilityResult {
  isFullyOfflineCapable: boolean;
  capabilities: {
    [feature: string]: {
      available: boolean;
      error?: string;
      performance?: number; // milliseconds
    };
  };
  recommendations: string[];
}

export class OfflineCapabilityChecker {
  private static instance: OfflineCapabilityChecker;

  private constructor() {}

  public static getInstance(): OfflineCapabilityChecker {
    if (!OfflineCapabilityChecker.instance) {
      OfflineCapabilityChecker.instance = new OfflineCapabilityChecker();
    }
    return OfflineCapabilityChecker.instance;
  }

  async checkAllCapabilities(): Promise<OfflineCapabilityResult> {
    const capabilities: OfflineCapabilityResult['capabilities'] = {};
    const recommendations: string[] = [];

    // Check core features
    const coreFeatures = [
      'localStorage',
      'documentLoading',
      'pdfViewing',
      'basicEditing',
      'fileManagement',
      'storageManagement',
      'offlineStateManagement',
    ];

    for (const feature of coreFeatures) {
      try {
        const startTime = Date.now();
        const result = await this.checkFeature(feature);
        const endTime = Date.now();

        capabilities[feature] = {
          available: result.available,
          error: result.error,
          performance: endTime - startTime,
        };

        if (!result.available && result.recommendation) {
          recommendations.push(result.recommendation);
        }
      } catch (error) {
        capabilities[feature] = {
          available: false,
          error: `Unexpected error: ${error}`,
        };
        recommendations.push(`Fix ${feature} capability: ${error}`);
      }
    }

    // Check performance requirements
    await this.checkPerformanceRequirements(capabilities, recommendations);

    // Check storage requirements
    await this.checkStorageRequirements(capabilities, recommendations);

    const isFullyOfflineCapable = Object.values(capabilities).every(cap => cap.available);

    return {
      isFullyOfflineCapable,
      capabilities,
      recommendations,
    };
  }

  private async checkFeature(feature: string): Promise<{
    available: boolean;
    error?: string;
    recommendation?: string;
  }> {
    switch (feature) {
      case 'localStorage':
        return this.checkLocalStorage();
      case 'documentLoading':
        return this.checkDocumentLoading();
      case 'pdfViewing':
        return this.checkPdfViewing();
      case 'basicEditing':
        return this.checkBasicEditing();
      case 'fileManagement':
        return this.checkFileManagement();
      case 'storageManagement':
        return this.checkStorageManagement();
      case 'offlineStateManagement':
        return this.checkOfflineStateManagement();
      default:
        return {
          available: false,
          error: `Unknown feature: ${feature}`,
        };
    }
  }

  private async checkLocalStorage(): Promise<{
    available: boolean;
    error?: string;
    recommendation?: string;
  }> {
    try {
      const testKey = 'offline_capability_test';
      const testValue = JSON.stringify({ test: true, timestamp: Date.now() });

      // Test write
      await AsyncStorage.setItem(testKey, testValue);

      // Test read
      const retrievedValue = await AsyncStorage.getItem(testKey);
      if (retrievedValue !== testValue) {
        throw new Error('Data integrity check failed');
      }

      // Test delete
      await AsyncStorage.removeItem(testKey);

      // Verify deletion
      const deletedValue = await AsyncStorage.getItem(testKey);
      if (deletedValue !== null) {
        throw new Error('Deletion verification failed');
      }

      return { available: true };
    } catch (error) {
      return {
        available: false,
        error: `Local storage error: ${error}`,
        recommendation: 'Ensure AsyncStorage is properly configured and accessible',
      };
    }
  }

  private async checkDocumentLoading(): Promise<{
    available: boolean;
    error?: string;
    recommendation?: string;
  }> {
    try {
      const documentLibrary = DocumentLibrary.getInstance();
      
      // Test getting documents (should work even if empty)
      const documents = await documentLibrary.getDocuments();
      
      // Test search functionality
      await documentLibrary.searchDocuments('test');

      return { available: true };
    } catch (error) {
      return {
        available: false,
        error: `Document loading error: ${error}`,
        recommendation: 'Verify DocumentLibrary can access local storage and handle empty states',
      };
    }
  }

  private async checkPdfViewing(): Promise<{
    available: boolean;
    error?: string;
    recommendation?: string;
  }> {
    try {
      const pdfEngine = PDFEngine.getInstance();
      
      // Test PDF engine initialization
      // Note: We can't test actual PDF loading without a real file,
      // but we can verify the engine is properly initialized
      
      // Check if PDF engine methods are available
      if (typeof pdfEngine.loadPDF !== 'function' ||
          typeof pdfEngine.renderPage !== 'function') {
        throw new Error('PDF engine methods not available');
      }

      return { available: true };
    } catch (error) {
      return {
        available: false,
        error: `PDF viewing error: ${error}`,
        recommendation: 'Ensure PDF engine is properly initialized and dependencies are available',
      };
    }
  }

  private async checkBasicEditing(): Promise<{
    available: boolean;
    error?: string;
    recommendation?: string;
  }> {
    try {
      const pdfEngine = PDFEngine.getInstance();
      
      // Check if editing methods are available
      if (typeof pdfEngine.editPDFText !== 'function' ||
          typeof pdfEngine.addAnnotations !== 'function') {
        throw new Error('PDF editing methods not available');
      }

      return { available: true };
    } catch (error) {
      return {
        available: false,
        error: `Basic editing error: ${error}`,
        recommendation: 'Verify PDF editing capabilities are properly implemented',
      };
    }
  }

  private async checkFileManagement(): Promise<{
    available: boolean;
    error?: string;
    recommendation?: string;
  }> {
    try {
      const fileManager = FileManager.getInstance();
      
      // Check if file management methods are available
      if (typeof fileManager.saveFile !== 'function' ||
          typeof fileManager.listFiles !== 'function' ||
          typeof fileManager.deleteFile !== 'function') {
        throw new Error('File management methods not available');
      }

      // Test listing files (should work even if empty)
      await fileManager.listFiles();

      return { available: true };
    } catch (error) {
      return {
        available: false,
        error: `File management error: ${error}`,
        recommendation: 'Ensure file system access is available and properly configured',
      };
    }
  }

  private async checkStorageManagement(): Promise<{
    available: boolean;
    error?: string;
    recommendation?: string;
  }> {
    try {
      const storageManager = StorageManager.getInstance();
      
      // Test storage info retrieval
      await storageManager.getStorageInfo();
      
      // Test storage settings
      await storageManager.getStorageSettings();

      return { available: true };
    } catch (error) {
      return {
        available: false,
        error: `Storage management error: ${error}`,
        recommendation: 'Verify storage monitoring and management capabilities',
      };
    }
  }

  private async checkOfflineStateManagement(): Promise<{
    available: boolean;
    error?: string;
    recommendation?: string;
  }> {
    try {
      const offlineManager = OfflineManager.getInstance();
      
      // Test offline state retrieval
      const state = offlineManager.getOfflineState();
      
      if (!state || typeof state.isOnline !== 'boolean') {
        throw new Error('Invalid offline state structure');
      }

      // Test offline capability check
      await offlineManager.ensureOfflineCapability();

      return { available: true };
    } catch (error) {
      return {
        available: false,
        error: `Offline state management error: ${error}`,
        recommendation: 'Ensure offline state management is properly initialized',
      };
    }
  }

  private async checkPerformanceRequirements(
    capabilities: OfflineCapabilityResult['capabilities'],
    recommendations: string[]
  ): Promise<void> {
    const performanceThresholds = {
      localStorage: 100, // 100ms
      documentLoading: 500, // 500ms
      pdfViewing: 1000, // 1s
      basicEditing: 2000, // 2s
      fileManagement: 300, // 300ms
      storageManagement: 1000, // 1s
      offlineStateManagement: 200, // 200ms
    };

    for (const [feature, threshold] of Object.entries(performanceThresholds)) {
      const capability = capabilities[feature];
      if (capability && capability.available && capability.performance) {
        if (capability.performance > threshold) {
          recommendations.push(
            `${feature} performance is slow (${capability.performance}ms > ${threshold}ms threshold)`
          );
        }
      }
    }
  }

  private async checkStorageRequirements(
    capabilities: OfflineCapabilityResult['capabilities'],
    recommendations: string[]
  ): Promise<void> {
    try {
      const storageManager = StorageManager.getInstance();
      const storageInfo = await storageManager.getStorageInfo();
      
      // Check if there's enough free space (at least 100MB)
      const minFreeSpace = 100 * 1024 * 1024; // 100MB
      if (storageInfo.freeSpace < minFreeSpace) {
        recommendations.push(
          `Low storage space: ${Math.round(storageInfo.freeSpace / 1024 / 1024)}MB free, recommend at least 100MB`
        );
      }

      // Check if storage usage is too high
      if (storageInfo.usagePercentage > 90) {
        recommendations.push(
          `Storage usage is critically high: ${storageInfo.usagePercentage.toFixed(1)}%`
        );
      }
    } catch (error) {
      recommendations.push(`Could not check storage requirements: ${error}`);
    }
  }

  async generateOfflineCapabilityReport(): Promise<string> {
    const result = await this.checkAllCapabilities();
    
    let report = '# Offline Capability Report\n\n';
    
    if (result.isFullyOfflineCapable) {
      report += '✅ **All core features are fully offline capable**\n\n';
    } else {
      report += '❌ **Some features may not work properly offline**\n\n';
    }

    report += '## Feature Capabilities\n\n';
    
    for (const [feature, capability] of Object.entries(result.capabilities)) {
      const status = capability.available ? '✅' : '❌';
      const performance = capability.performance ? ` (${capability.performance}ms)` : '';
      
      report += `- ${status} **${feature}**${performance}\n`;
      
      if (capability.error) {
        report += `  - Error: ${capability.error}\n`;
      }
    }

    if (result.recommendations.length > 0) {
      report += '\n## Recommendations\n\n';
      for (const recommendation of result.recommendations) {
        report += `- ${recommendation}\n`;
      }
    }

    report += '\n## Summary\n\n';
    const availableCount = Object.values(result.capabilities).filter(cap => cap.available).length;
    const totalCount = Object.keys(result.capabilities).length;
    
    report += `${availableCount}/${totalCount} features are offline capable.\n`;
    
    if (result.isFullyOfflineCapable) {
      report += '\nThe app is ready for offline use! 🎉';
    } else {
      report += '\nPlease address the issues above before using the app offline.';
    }

    return report;
  }
}

// Export singleton instance
export const offlineCapabilityChecker = OfflineCapabilityChecker.getInstance();