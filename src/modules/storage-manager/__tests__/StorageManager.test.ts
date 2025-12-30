import { StorageManager } from '../StorageManager';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_STORAGE_SETTINGS } from '../types';

// Mock dependencies
jest.mock('expo-file-system');
jest.mock('@react-native-async-storage/async-storage');

const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('StorageManager', () => {
  let storageManager: StorageManager;

  beforeEach(() => {
    jest.clearAllMocks();
    storageManager = StorageManager.getInstance();
  });

  describe('getStorageInfo', () => {
    it('should return storage information', async () => {
      // Mock file system responses
      mockFileSystem.getFreeDiskStorageAsync.mockResolvedValue(1000000000); // 1GB free
      mockFileSystem.getTotalDiskCapacityAsync.mockResolvedValue(5000000000); // 5GB total
      mockFileSystem.readDirectoryAsync.mockResolvedValue([]);
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: true,
        size: 0,
        modificationTime: Date.now(),
        uri: 'file://test'
      });

      const storageInfo = await storageManager.getStorageInfo();

      expect(storageInfo).toEqual({
        totalSpace: 5000000000,
        freeSpace: 1000000000,
        usedSpace: 4000000000,
        appUsedSpace: 0,
        usagePercentage: 80,
      });
    });

    it('should handle errors gracefully', async () => {
      mockFileSystem.getFreeDiskStorageAsync.mockRejectedValue(new Error('File system error'));

      await expect(storageManager.getStorageInfo()).rejects.toThrow('Failed to get storage info');
    });
  });

  describe('monitorStorage', () => {
    it('should monitor storage and trigger warnings when threshold exceeded', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      mockFileSystem.getFreeDiskStorageAsync.mockResolvedValue(500000000); // 0.5GB free
      mockFileSystem.getTotalDiskCapacityAsync.mockResolvedValue(5000000000); // 5GB total
      mockFileSystem.readDirectoryAsync.mockResolvedValue([]);
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: true,
        size: 0,
        modificationTime: Date.now(),
        uri: 'file://test'
      });
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(DEFAULT_STORAGE_SETTINGS));

      await storageManager.monitorStorage();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Storage warning:',
        expect.objectContaining({
          type: 'critical',
          currentUsage: 90,
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('cleanupStorage', () => {
    it('should cleanup temporary files and return bytes freed', async () => {
      mockFileSystem.readDirectoryAsync.mockResolvedValue(['temp1.pdf', 'temp2.pdf']);
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 1000000,
        modificationTime: Date.now(),
        uri: 'file://test'
      });
      mockFileSystem.deleteAsync.mockResolvedValue();

      const bytesFreed = await storageManager.cleanupStorage({
        removeTemporaryFiles: true,
        removeThumbnails: false,
        compressOldFiles: false,
        removeBackups: false,
      });

      expect(bytesFreed).toBeGreaterThan(0);
      expect(mockFileSystem.deleteAsync).toHaveBeenCalled();
    });
  });

  describe('compressFile', () => {
    it('should compress a file and return new path', async () => {
      const filePath = '/test/document.pdf';
      const expectedCompressedPath = '/test/document_compressed.pdf';

      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 5000000,
        modificationTime: Date.now(),
        uri: 'file://test'
      });
      mockFileSystem.copyAsync.mockResolvedValue();

      const compressedPath = await storageManager.compressFile(filePath, {
        quality: 0.8,
        maxFileSize: 50000000,
        preserveOriginal: true,
      });

      expect(compressedPath).toBe(expectedCompressedPath);
      expect(mockFileSystem.copyAsync).toHaveBeenCalled();
    });

    it('should throw error for non-existent file', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: false,
        isDirectory: false,
        size:0,
        modificationTime: 0,
        uri: 'file://test'
      });

      await expect(
        storageManager.compressFile('/nonexistent.pdf', {
          quality: 0.8,
          maxFileSize: 50000000,
          preserveOriginal: true,
        })
      ).rejects.toThrow('File compression failed');
    });
  });

  describe('storage settings', () => {
    it('should get default storage settings when none exist', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const settings = await storageManager.getStorageSettings();

      expect(settings).toEqual(DEFAULT_STORAGE_SETTINGS);
    });

    it('should update storage settings', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(DEFAULT_STORAGE_SETTINGS));
      mockAsyncStorage.setItem.mockResolvedValue();

      await storageManager.updateStorageSettings({
        autoCleanup: false,
        warningThreshold: 85,
      });

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'storage_settings',
        expect.stringContaining('"autoCleanup":false')
      );
    });
  });

  describe('checkStorageWarning', () => {
    it('should return true when storage exceeds warning threshold', async () => {
      mockFileSystem.getFreeDiskStorageAsync.mockResolvedValue(1000000000); // 1GB free
      mockFileSystem.getTotalDiskCapacityAsync.mockResolvedValue(5000000000); // 5GB total
      mockFileSystem.readDirectoryAsync.mockResolvedValue([]);
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: true,
        size: 0,
        modificationTime: Date.now(),
        uri: 'file://test'
      });
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(DEFAULT_STORAGE_SETTINGS));

      const hasWarning = await storageManager.checkStorageWarning();

      expect(hasWarning).toBe(true); // 80% usage > 70% threshold
    });

    it('should return false when storage is below warning threshold', async () => {
      mockFileSystem.getFreeDiskStorageAsync.mockResolvedValue(3000000000); // 3GB free
      mockFileSystem.getTotalDiskCapacityAsync.mockResolvedValue(5000000000); // 5GB total
      mockFileSystem.readDirectoryAsync.mockResolvedValue([]);
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: true,
        size: 0,
        modificationTime: Date.now(),
        uri: 'file://test'
      });
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(DEFAULT_STORAGE_SETTINGS));

      const hasWarning = await storageManager.checkStorageWarning();

      expect(hasWarning).toBe(false); // 40% usage < 70% threshold
    });
  });
});