import { renderHook, act } from '@testing-library/react-native';
import { useOffline } from '../useOffline';
import { OfflineManager } from '../../modules/storage-manager/OfflineManager';

// Mock the OfflineManager
jest.mock('../../modules/storage-manager/OfflineManager');

const mockOfflineManager = {
  initialize: jest.fn(),
  getOfflineState: jest.fn(),
  addListener: jest.fn(),
  addPendingOperation: jest.fn(),
  ensureOfflineCapability: jest.fn(),
  preloadEssentialData: jest.fn(),
};

(OfflineManager.getInstance as jest.Mock).mockReturnValue(mockOfflineManager);

describe('useOffline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockOfflineManager.getOfflineState.mockReturnValue({
      isOnline: true,
      lastOnlineTime: new Date(),
      pendingOperations: [],
    });
    
    mockOfflineManager.addListener.mockReturnValue(() => {}); // unsubscribe function
  });

  it('should initialize with default state', async () => {
    mockOfflineManager.initialize.mockResolvedValue(undefined);

    const { result } = renderHook(() => useOffline());

    expect(result.current.isInitialized).toBe(false);
    expect(result.current.isOnline).toBe(true);
    expect(result.current.pendingOperations).toEqual([]);

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockOfflineManager.initialize).toHaveBeenCalled();
    expect(mockOfflineManager.addListener).toHaveBeenCalled();
  });

  it('should handle offline state changes', async () => {
    let stateListener: (state: any) => void;
    
    mockOfflineManager.addListener.mockImplementation((listener) => {
      stateListener = listener;
      return () => {};
    });
    
    mockOfflineManager.initialize.mockResolvedValue(undefined);

    const { result } = renderHook(() => useOffline());

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Simulate offline state change
    act(() => {
      stateListener({
        isOnline: false,
        lastOnlineTime: new Date(),
        pendingOperations: [{ id: '1', type: 'upload', data: {}, timestamp: new Date(), retryCount: 0 }],
      });
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.pendingOperations).toHaveLength(1);
  });

  it('should add pending operations', async () => {
    mockOfflineManager.initialize.mockResolvedValue(undefined);
    mockOfflineManager.addPendingOperation.mockResolvedValue(undefined);

    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await result.current.addPendingOperation('upload', { fileName: 'test.pdf' });
    });

    expect(mockOfflineManager.addPendingOperation).toHaveBeenCalledWith({
      type: 'upload',
      data: { fileName: 'test.pdf' },
    });
  });

  it('should handle pending operation errors', async () => {
    mockOfflineManager.initialize.mockResolvedValue(undefined);
    mockOfflineManager.addPendingOperation.mockRejectedValue(new Error('Operation failed'));

    const { result } = renderHook(() => useOffline());

    await expect(
      act(async () => {
        await result.current.addPendingOperation('sync', { test: 'data' });
      })
    ).rejects.toThrow('Operation failed');
  });

  it('should ensure offline capability', async () => {
    mockOfflineManager.initialize.mockResolvedValue(undefined);
    mockOfflineManager.ensureOfflineCapability.mockResolvedValue(true);

    const { result } = renderHook(() => useOffline());

    let capability: boolean;
    await act(async () => {
      capability = await result.current.ensureOfflineCapability();
    });

    expect(capability!).toBe(true);
    expect(mockOfflineManager.ensureOfflineCapability).toHaveBeenCalled();
  });

  it('should preload essential data', async () => {
    mockOfflineManager.initialize.mockResolvedValue(undefined);
    mockOfflineManager.preloadEssentialData.mockResolvedValue(undefined);

    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await result.current.preloadEssentialData();
    });

    expect(mockOfflineManager.preloadEssentialData).toHaveBeenCalled();
  });

  it('should handle initialization errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockOfflineManager.initialize.mockRejectedValue(new Error('Init failed'));

    const { result } = renderHook(() => useOffline());

    // Wait for initialization attempt
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isInitialized).toBe(true); // Should still mark as initialized
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to initialize offline manager:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('should cleanup listener on unmount', async () => {
    const unsubscribe = jest.fn();
    mockOfflineManager.addListener.mockReturnValue(unsubscribe);
    mockOfflineManager.initialize.mockResolvedValue(undefined);

    const { unmount } = renderHook(() => useOffline());

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});