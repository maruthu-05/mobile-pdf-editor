export interface StorageInfo {
  totalSpace: number;
  freeSpace: number;
  usedSpace: number;
  appUsedSpace: number;
  usagePercentage: number;
}

export interface StorageCleanupOptions {
  removeTemporaryFiles: boolean;
  removeThumbnails: boolean;
  compressOldFiles: boolean;
  removeBackups: boolean;
}

export interface CompressionOptions {
  quality: number; // 0.1 to 1.0
  maxFileSize: number; // in bytes
  preserveOriginal: boolean;
}

export interface StorageSettings {
  maxStorageUsage: number; // percentage of total storage
  autoCleanup: boolean;
  compressionEnabled: boolean;
  compressionOptions: CompressionOptions;
  warningThreshold: number; // percentage when to warn user
}

export interface StorageManager {
  getStorageInfo(): Promise<StorageInfo>;
  monitorStorage(): Promise<void>;
  cleanupStorage(options: StorageCleanupOptions): Promise<number>; // returns bytes freed
  compressFile(filePath: string, options: CompressionOptions): Promise<string>;
  optimizeStorage(): Promise<void>;
  getStorageSettings(): Promise<StorageSettings>;
  updateStorageSettings(settings: Partial<StorageSettings>): Promise<void>;
  checkStorageWarning(): Promise<boolean>;
}