import { OfflineManager } from '../OfflineManager';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('@react-native-community/netinfo');
jest.mock('@react-native-async-storage/async-storage');

const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('OfflineManager', () => {
  let offlineManager: OfflineManager;
  let mockNetInfoListener: (state: any) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock NetInfo.addEventListener to capture the listener
    mockNetInfo.addEventListener.mockImplementation((listener) => {
      mockNetInfoListener = listener;
      return jest.fn(); // Return unsubscribe function
    });
    
    mockNetInfo.fetch.mockResolvedValue({
      isConnected: true,
      type: 'wifi',
      isInternetReachable: true,
    } as any);

    offlineManager = OfflineManager.getInstance();
  });

  describe('initialization', () => {
    it('should initialize with default online state', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await offlineManager.initialize();

      const state = offlineManager.getOfflineState();
      expect(state.isOnline).toBe(true);
      expect(state.pendingOperations).toEqual([]);
    });

    it('should restore saved offline state', async () => {
      const savedState = {
        isOnline: false,
        lastOnlineTime: '2023-01-01T00:00:00.000Z',
        pendingOperations: [{
          id: 'test-op',
          type: 'upload',
          data: { test: 'data' },
          timestamp: '2023-01-01T00:00:00.000Z',
          retryCount: 0,
        }],
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedState));

      await offlineManager.initialize();

      const state = offlineManager.getOfflineState();
      expect(state.pendingOperations).toHaveLength(1);
      expect(state.pendingOperations[0].id).toBe('test-op');
    });
  });

  describe('network state changes', () => {
    it('should update state when going offline', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue();

      await offlineManager.initialize();

      // Simulate going offline
      mockNetInfoListener({
        isConnected: false,
        type: 'none',
        isInternetReachable: false,
      });

      const state = offlineManager.getOfflineState();
      expect(state.isOnline).toBe(false);
    });

    it('should process pending operations when coming back online', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue();

      await offlineManager.initialize();

      // Add a pending operation
      await offlineManager.addPendingOperation({
        type: 'upload',
        data: { test: 'data' },
      });

      // Simulate coming back online
      mockNetInfoListener({
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
      });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 0));

      const state = offlineManager.getOfflineState();
      expect(state.isOnline).toBe(true);
      expect(state.lastOnlineTime).toBeInstanceOf(Date);
    });
  });

  describe('pending operations', () => {
    it('should add pending operations', async () => {
      mockAsyncStorage.setItem.mockResolvedValue();

      await offlineManager.addPendingOperation({
        type: 'upload',
        data: { fileName: 'test.pdf' },
      });

      const state = offlineManager.getOfflineState();
      expect(state.pendingOperations).toHaveLength(1);
      expect(state.pendingOperations[0].type).toBe('upload');
      expect(state.pendingOperations[0].data.fileName).toBe('test.pdf');
    });

    it('should remove pending operations', async () => {
      mockAsyncStorage.setItem.mockResolvedValue();

      await offlineManager.addPendingOperation({
        type: 'sync',
        data: { test: 'data' },
      });

      const state = offlineManager.getOfflineState();
      const operationId = state.pendingOperations[0].id;

      await offlineManager.removePendingOperation(operationId);

      const updatedState = offlineManager.getOfflineState();
      expect(updatedState.pendingOperations).toHaveLength(0);
    });
  });

  describe('offline capability checks', () => {
    it('should ensure offline capability for core features', async () => {
      mockAsyncStorage.setItem.mockResolvedValue();
      mockAsyncStorage.removeItem.mockResolvedValue();

      const isCapable = await offlineManager.ensureOfflineCapability();

      expect(isCapable).toBe(true);
    });

    it('should handle offline capability check failures', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

      const isCapable = await offlineManager.ensureOfflineCapability();

      expect(isCapable).toBe(false);
    });
  });

  describe('listeners', () => {
    it('should notify listeners of state changes', async () => {
      const listener = jest.fn();
      mockAsyncStorage.setItem.mockResolvedValue();

      const unsubscribe = offlineManager.addListener(listener);

      // Simulate network change
      mockNetInfoListener({
        isConnected: false,
        type: 'none',
        isInternetReachable: false,
      });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          isOnline: false,
        })
      );

      unsubscribe();
    });

    it('should handle listener errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const faultyListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });

      mockAsyncStorage.setItem.mockResolvedValue();

      offlineManager.addListener(faultyListener);

      // Simulate network change
      mockNetInfoListener({
        isConnected: false,
        type: 'none',
        isInternetReachable: false,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in offline state listener:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('utility methods', () => {
    it('should check if online', () => {
      const isOnline = offlineManager.isOnline();
      expect(typeof isOnline).toBe('boolean');
    });

    it('should preload essential data', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await offlineManager.preloadEssentialData();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Preloading essential data for offline use...'
      );

      consoleSpy.mockRestore();
    });
  });
});