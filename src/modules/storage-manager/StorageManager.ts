import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  StorageManager as IStorageManager, 
  StorageInfo, 
  StorageCleanupOptions, 
  CompressionOptions, 
  StorageSettings,
  StorageAlert 
} from './interfaces';
import { 
  FileInfo, 
  CleanupResult, 
  CompressionResult, 
  DEFAULT_STORAGE_SETTINGS 
} from './types';

export class StorageManager implements IStorageManager {
  private static instance: StorageManager;
  private readonly STORAGE_SETTINGS_KEY = 'storage_settings';
  private readonly APP_DIRECTORY = FileSystem.documentDirectory!;
  private readonly TEMP_DIRECTORY = FileSystem.cacheDirectory!;
  
  private constructor() {}

  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  async getStorageInfo(): Promise<StorageInfo> {
    try {
      const freeSpace = await FileSystem.getFreeDiskStorageAsync();
      const totalSpace = await FileSystem.getTotalDiskCapacityAsync();
      const usedSpace = totalSpace - freeSpace;
      const appUsedSpace = await this.calculateAppUsedSpace();
      const usagePercentage = (usedSpace / totalSpace) * 100;

      return {
        totalSpace,
        freeSpace,
        usedSpace,
        appUsedSpace,
        usagePercentage,
      };
    } catch (error) {
      throw new Error(`Failed to get storage info: ${error}`);
    }
  }

  async monitorStorage(): Promise<void> {
    const storageInfo = await this.getStorageInfo();
    const settings = await this.getStorageSettings();
    
    if (storageInfo.usagePercentage >= settings.warningThreshold) {
      const alert: StorageAlert = {
        type: storageInfo.usagePercentage >= 90 ? 'critical' : 'warning',
        message: `Storage usage is at ${storageInfo.usagePercentage.toFixed(1)}%`,
        threshold: settings.warningThreshold,
        currentUsage: storageInfo.usagePercentage,
        suggestedActions: this.getSuggestedActions(storageInfo),
      };
      
      // Emit storage warning event (would be handled by UI)
      console.warn('Storage warning:', alert);
      
      if (settings.autoCleanup && storageInfo.usagePercentage >= settings.maxStorageUsage) {
        await this.optimizeStorage();
      }
    }
  }

  async cleanupStorage(options: StorageCleanupOptions): Promise<number> {
    let totalBytesFreed = 0;
    const errors: string[] = [];

    try {
      if (options.removeTemporaryFiles) {
        const tempResult = await this.cleanupTemporaryFiles();
        totalBytesFreed += tempResult.bytesFreed;
        errors.push(...tempResult.errors);
      }

      if (options.removeThumbnails) {
        const thumbResult = await this.cleanupThumbnails();
        totalBytesFreed += thumbResult.bytesFreed;
        errors.push(...thumbResult.errors);
      }

      if (options.removeBackups) {
        const backupResult = await this.cleanupOldBackups();
        totalBytesFreed += backupResult.bytesFreed;
        errors.push(...backupResult.errors);
      }

      if (options.compressOldFiles) {
        const settings = await this.getStorageSettings();
        const compressResult = await this.compressOldFiles(settings.compressionOptions);
        totalBytesFreed += compressResult.bytesFreed;
        errors.push(...compressResult.errors);
      }

      if (errors.length > 0) {
        console.warn('Cleanup completed with errors:', errors);
      }

      return totalBytesFreed;
    } catch (error) {
      throw new Error(`Storage cleanup failed: ${error}`);
    }
  }

  async compressFile(filePath: string, options: CompressionOptions): Promise<string> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      // For PDF compression, we would use a PDF compression library
      // This is a simplified implementation
      const compressedPath = filePath.replace('.pdf', '_compressed.pdf');
      
      // Simulate compression by copying file (in real implementation, use PDF compression)
      await FileSystem.copyAsync({
        from: filePath,
        to: compressedPath,
      });

      if (!options.preserveOriginal) {
        await FileSystem.deleteAsync(filePath);
      }

      return compressedPath;
    } catch (error) {
      throw new Error(`File compression failed: ${error}`);
    }
  }

  async optimizeStorage(): Promise<void> {
    const settings = await this.getStorageSettings();
    
    const cleanupOptions: StorageCleanupOptions = {
      removeTemporaryFiles: true,
      removeThumbnails: false, // Keep thumbnails for performance
      compressOldFiles: settings.compressionEnabled,
      removeBackups: false, // Keep recent backups
    };

    await this.cleanupStorage(cleanupOptions);
  }

  async getStorageSettings(): Promise<StorageSettings> {
    try {
      const settingsJson = await AsyncStorage.getItem(this.STORAGE_SETTINGS_KEY);
      if (settingsJson) {
        return { ...DEFAULT_STORAGE_SETTINGS, ...JSON.parse(settingsJson) };
      }
      return DEFAULT_STORAGE_SETTINGS;
    } catch (error) {
      console.warn('Failed to load storage settings, using defaults:', error);
      return DEFAULT_STORAGE_SETTINGS;
    }
  }

  async updateStorageSettings(settings: Partial<StorageSettings>): Promise<void> {
    try {
      const currentSettings = await this.getStorageSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      await AsyncStorage.setItem(this.STORAGE_SETTINGS_KEY, JSON.stringify(updatedSettings));
    } catch (error) {
      throw new Error(`Failed to update storage settings: ${error}`);
    }
  }

  async checkStorageWarning(): Promise<boolean> {
    const storageInfo = await this.getStorageInfo();
    const settings = await this.getStorageSettings();
    return storageInfo.usagePercentage >= settings.warningThreshold;
  }

  // Private helper methods
  private async calculateAppUsedSpace(): Promise<number> {
    try {
      let totalSize = 0;
      const directories = [this.APP_DIRECTORY, this.TEMP_DIRECTORY];
      
      for (const directory of directories) {
        const size = await this.getDirectorySize(directory);
        totalSize += size;
      }
      
      return totalSize;
    } catch (error) {
      console.warn('Failed to calculate app used space:', error);
      return 0;
    }
  }

  private async getDirectorySize(directory: string): Promise<number> {
    try {
      const items = await FileSystem.readDirectoryAsync(directory);
      let totalSize = 0;

      for (const item of items) {
        const itemPath = `${directory}${item}`;
        const info = await FileSystem.getInfoAsync(itemPath);
        
        if (info.exists) {
          if (info.isDirectory) {
            totalSize += await this.getDirectorySize(`${itemPath}/`);
          } else {
            totalSize += info.size || 0;
          }
        }
      }

      return totalSize;
    } catch (error) {
      console.warn(`Failed to get directory size for ${directory}:`, error);
      return 0;
    }
  }

  private async cleanupTemporaryFiles(): Promise<CleanupResult> {
    const result: CleanupResult = { filesRemoved: 0, bytesFreed: 0, errors: [] };
    
    try {
      const tempFiles = await this.getTemporaryFiles();
      
      for (const file of tempFiles) {
        try {
          const info = await FileSystem.getInfoAsync(file.path);
          if (info.exists) {
            await FileSystem.deleteAsync(file.path);
            result.filesRemoved++;
            result.bytesFreed += file.size;
          }
        } catch (error) {
          result.errors.push(`Failed to delete ${file.path}: ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Failed to cleanup temporary files: ${error}`);
    }

    return result;
  }

  private async cleanupThumbnails(): Promise<CleanupResult> {
    const result: CleanupResult = { filesRemoved: 0, bytesFreed: 0, errors: [] };
    
    try {
      const thumbnailDir = `${this.APP_DIRECTORY}thumbnails/`;
      const thumbnailInfo = await FileSystem.getInfoAsync(thumbnailDir);
      
      if (thumbnailInfo.exists && thumbnailInfo.isDirectory) {
        const thumbnails = await FileSystem.readDirectoryAsync(thumbnailDir);
        
        for (const thumbnail of thumbnails) {
          try {
            const thumbnailPath = `${thumbnailDir}${thumbnail}`;
            const info = await FileSystem.getInfoAsync(thumbnailPath);
            
            if (info.exists) {
              await FileSystem.deleteAsync(thumbnailPath);
              result.filesRemoved++;
              result.bytesFreed += info.size || 0;
            }
          } catch (error) {
            result.errors.push(`Failed to delete thumbnail ${thumbnail}: ${error}`);
          }
        }
      }
    } catch (error) {
      result.errors.push(`Failed to cleanup thumbnails: ${error}`);
    }

    return result;
  }

  private async cleanupOldBackups(): Promise<CleanupResult> {
    const result: CleanupResult = { filesRemoved: 0, bytesFreed: 0, errors: [] };
    
    try {
      const backupDir = `${this.APP_DIRECTORY}backups/`;
      const backupInfo = await FileSystem.getInfoAsync(backupDir);
      
      if (backupInfo.exists && backupInfo.isDirectory) {
        const backups = await FileSystem.readDirectoryAsync(backupDir);
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        for (const backup of backups) {
          try {
            const backupPath = `${backupDir}${backup}`;
            const info = await FileSystem.getInfoAsync(backupPath);
            
            if (info.exists && info.modificationTime && info.modificationTime < oneWeekAgo.getTime()) {
              await FileSystem.deleteAsync(backupPath);
              result.filesRemoved++;
              result.bytesFreed += info.size || 0;
            }
          } catch (error) {
            result.errors.push(`Failed to delete backup ${backup}: ${error}`);
          }
        }
      }
    } catch (error) {
      result.errors.push(`Failed to cleanup old backups: ${error}`);
    }

    return result;
  }

  private async compressOldFiles(options: CompressionOptions): Promise<CleanupResult> {
    const result: CleanupResult = { filesRemoved: 0, bytesFreed: 0, errors: [] };
    
    try {
      const pdfFiles = await this.getCompressibleFiles(options.maxFileSize);
      
      for (const file of pdfFiles) {
        try {
          const originalSize = file.size;
          await this.compressFile(file.path, options);
          
          // Calculate space saved (simplified)
          const savedBytes = Math.floor(originalSize * (1 - options.quality));
          result.bytesFreed += savedBytes;
          result.filesRemoved++; // Count as processed
        } catch (error) {
          result.errors.push(`Failed to compress ${file.path}: ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Failed to compress old files: ${error}`);
    }

    return result;
  }

  private async getTemporaryFiles(): Promise<FileInfo[]> {
    const tempFiles: FileInfo[] = [];
    
    try {
      const tempDir = this.TEMP_DIRECTORY;
      const items = await FileSystem.readDirectoryAsync(tempDir);
      
      for (const item of items) {
        const itemPath = `${tempDir}${item}`;
        const info = await FileSystem.getInfoAsync(itemPath);
        
        if (info.exists && !info.isDirectory) {
          tempFiles.push({
            path: itemPath,
            size: info.size || 0,
            lastModified: new Date(info.modificationTime || 0),
            isTemporary: true,
            canCompress: false,
          });
        }
      }
    } catch (error) {
      console.warn('Failed to get temporary files:', error);
    }

    return tempFiles;
  }

  private async getCompressibleFiles(maxSize: number): Promise<FileInfo[]> {
    const compressibleFiles: FileInfo[] = [];
    
    try {
      const pdfDir = `${this.APP_DIRECTORY}pdfs/`;
      const pdfInfo = await FileSystem.getInfoAsync(pdfDir);
      
      if (pdfInfo.exists && pdfInfo.isDirectory) {
        const files = await FileSystem.readDirectoryAsync(pdfDir);
        
        for (const file of files) {
          if (file.endsWith('.pdf')) {
            const filePath = `${pdfDir}${file}`;
            const info = await FileSystem.getInfoAsync(filePath);
            
            if (info.exists && info.size && info.size > maxSize) {
              compressibleFiles.push({
                path: filePath,
                size: info.size,
                lastModified: new Date(info.modificationTime || 0),
                isTemporary: false,
                canCompress: true,
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to get compressible files:', error);
    }

    return compressibleFiles;
  }

  private getSuggestedActions(storageInfo: StorageInfo): string[] {
    const actions: string[] = [];
    
    if (storageInfo.usagePercentage >= 90) {
      actions.push('Delete unused documents');
      actions.push('Clear temporary files');
      actions.push('Enable file compression');
    } else if (storageInfo.usagePercentage >= 80) {
      actions.push('Clean up temporary files');
      actions.push('Compress large files');
    } else {
      actions.push('Enable auto-cleanup');
    }

    return actions;
  }
}