import { renderHook, act } from '@testing-library/react-native';
import { useStorage } from '../useStorage';
import { StorageManager } from '../../modules/storage-manager/StorageManager';
import { DEFAULT_STORAGE_SETTINGS } from '../../modules/storage-manager/types';

// Mock the StorageManager
jest.mock('../../modules/storage-manager/StorageManager');

const mockStorageManager = {
  getStorageInfo: jest.fn(),
  getStorageSettings: jest.fn(),
  updateStorageSettings: jest.fn(),
  cleanupStorage: jest.fn(),
  compressFile: jest.fn(),
  optimizeStorage: jest.fn(),
  checkStorageWarning: jest.fn(),
  monitorStorage: jest.fn(),
};

(StorageManager.getInstance as jest.Mock).mockReturnValue(mockStorageManager);

describe('useStorage', () => {
  const mockStorageInfo = {
    totalSpace: 5000000000,
    freeSpace: 1000000000,
    usedSpace: 4000000000,
    appUsedSpace: 500000000,
    usagePercentage: 80,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockStorageManager.getStorageInfo.mockResolvedValue(mockStorageInfo);
    mockStorageManager.getStorageSettings.mockResolvedValue(DEFAULT_STORAGE_SETTINGS);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with storage data', async () => {
    const { result } = renderHook(() => useStorage());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.storageInfo).toBeNull();
    expect(result.current.storageSettings).toBeNull();

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.storageInfo).toEqual(mockStorageInfo);
    expect(result.current.storageSettings).toEqual(DEFAULT_STORAGE_SETTINGS);
  });

  it('should load storage info', async () => {
    const { result } = renderHook(() => useStorage());

    await act(async () => {
      const info = await result.current.loadStorageInfo();
      expect(info).toEqual(mockStorageInfo);
    });

    expect(mockStorageManager.getStorageInfo).toHaveBeenCalled();
  });

  it('should update storage settings', async () => {
    mockStorageManager.updateStorageSettings.mockResolvedValue(undefined);
    
    const { result } = renderHook(() => useStorage());

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const updates = { autoCleanup: false, warningThreshold: 85 };

    await act(async () => {
      await result.current.updateStorageSettings(updates);
    });

    expect(mockStorageManager.updateStorageSettings).toHaveBeenCalledWith(updates);
    expect(mockStorageManager.getStorageSettings).toHaveBeenCalledTimes(2); // Initial + after update
  });

  it('should cleanup storage', async () => {
    mockStorageManager.cleanupStorage.mockResolvedValue(1000000); // 1MB freed
    
    const { result } = renderHook(() => useStorage());

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const cleanupOptions = {
      removeTemporaryFiles: true,
      removeThumbnails: false,
      compressOldFiles: false,
      removeBackups: false,
    };

    let bytesFreed: number;
    await act(async () => {
      bytesFreed = await result.current.cleanupStorage(cleanupOptions);
    });

    expect(bytesFreed!).toBe(1000000);
    expect(mockStorageManager.cleanupStorage).toHaveBeenCalledWith(cleanupOptions);
    expect(mockStorageManager.getStorageInfo).toHaveBeenCalledTimes(2); // Initial + after cleanup
  });

  it('should compress files', async () => {
    const compressedPath = '/path/to/compressed.pdf';
    mockStorageManager.compressFile.mockResolvedValue(compressedPath);
    
    const { result } = renderHook(() => useStorage());

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const filePath = '/path/to/original.pdf';

    let resultPath: string;
    await act(async () => {
      resultPath = await result.current.compressFile(filePath);
    });

    expect(resultPath!).toBe(compressedPath);
    expect(mockStorageManager.compressFile).toHaveBeenCalledWith(
      filePath,
      DEFAULT_STORAGE_SETTINGS.compressionOptions
    );
  });

  it('should optimize storage', async () => {
    mockStorageManager.optimizeStorage.mockResolvedValue(undefined);
    
    const { result } = renderHook(() => useStorage());

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.optimizeStorage();
    });

    expect(mockStorageManager.optimizeStorage).toHaveBeenCalled();
    expect(mockStorageManager.getStorageInfo).toHaveBeenCalledTimes(2); // Initial + after optimization
  });

  it('should check storage warning', async () => {
    mockStorageManager.checkStorageWarning.mockResolvedValue(true);
    
    const { result } = renderHook(() => useStorage());

    let hasWarning: boolean;
    await act(async () => {
      hasWarning = await result.current.checkStorageWarning();
    });

    expect(hasWarning!).toBe(true);
    expect(mockStorageManager.checkStorageWarning).toHaveBeenCalled();
  });

  it('should start storage monitoring', async () => {
    mockStorageManager.monitorStorage.mockResolvedValue(undefined);
    
    const { result } = renderHook(() => useStorage());

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    let cleanup: (() => void) | undefined;
    await act(async () => {
      cleanup = await result.current.startStorageMonitoring();
    });

    expect(result.current.isMonitoring).toBe(true);
    expect(cleanup).toBeDefined();

    // Simulate monitoring interval
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockStorageManager.monitorStorage).toHaveBeenCalled();

    // Cleanup
    if (cleanup) {
      cleanup();
    }
    expect(result.current.isMonitoring).toBe(false);
  });

  it('should format bytes correctly', () => {
    const { result } = renderHook(() => useStorage());

    expect(result.current.formatBytes(0)).toBe('0 B');
    expect(result.current.formatBytes(1024)).toBe('1 KB');
    expect(result.current.formatBytes(1048576)).toBe('1 MB');
    expect(result.current.formatBytes(1073741824)).toBe('1 GB');
  });

  it('should get storage status', async () => {
    const { result } = renderHook(() => useStorage());

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const status = result.current.getStorageStatus();

    expect(status).toEqual({
      level: 'warning',
      message: 'Storage is running low',
      color: '#ffaa00',
    });
  });

  it('should handle errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockStorageManager.getStorageInfo.mockRejectedValue(new Error('Storage error'));

    const { result } = renderHook(() => useStorage());

    await act(async () => {
      try {
        await result.current.loadStorageInfo();
      } catch (error) {
        // Expected to throw
      }
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to load storage info:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('should handle compress file without settings', async () => {
    // Mock settings as null
    mockStorageManager.getStorageSettings.mockResolvedValue(null as any);
    
    const { result } = renderHook(() => useStorage());

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await expect(
      act(async () => {
        await result.current.compressFile('/test.pdf');
      })
    ).rejects.toThrow('Storage settings not loaded');
  });
});