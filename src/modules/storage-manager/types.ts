export type StorageUnit = 'B' | 'KB' | 'MB' | 'GB';

export interface FileInfo {
  path: string;
  size: number;
  lastModified: Date;
  isTemporary: boolean;
  canCompress: boolean;
}

export interface CleanupResult {
  filesRemoved: number;
  bytesFreed: number;
  errors: string[];
}

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  outputPath: string;
}

export interface StorageAlert {
  type: 'warning' | 'critical' | 'info';
  message: string;
  threshold: number;
  currentUsage: number;
  suggestedActions: string[];
}

export const DEFAULT_STORAGE_SETTINGS: StorageSettings = {
  maxStorageUsage: 80, // 80% of total storage
  autoCleanup: true,
  compressionEnabled: true,
  compressionOptions: {
    quality: 0.8,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    preserveOriginal: false,
  },
  warningThreshold: 70, // warn at 70% usage
};

import type { StorageSettings } from './interfaces';