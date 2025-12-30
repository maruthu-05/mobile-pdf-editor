import { AutoSaveManager, AutoSaveData } from '../AutoSaveManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../file-manager/FileManager');
jest.mock('../ErrorHandler');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('AutoSaveManager', () => {
  let autoSaveManager: AutoSaveManager;

  beforeEach(() => {
    jest.clearAllMocks();
    autoSaveManager = AutoSaveManager.getInstance();
    
    // Mock AsyncStorage methods
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.removeItem.mockResolvedValue();
    mockAsyncStorage.getAllKeys.mockResolvedValue([]);
  });

  afterEach(() => {
    // Clear any running timers
    jest.clearAllTimers();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = AutoSaveManager.getInstance();
      const instance2 = AutoSaveManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Work Session Management', () => {
    it('should start a new work session', async () => {
      const sessionId = await autoSaveManager.startWorkSession(
        'merge',
        ['/test/file1.pdf', '/test/file2.pdf'],
        'Merging PDFs'
      );

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should update work in progress', async () => {
      const sessionId = await autoSaveManager.startWorkSession(
        'edit',
        ['/test/file.pdf'],
        'Editing PDF'
      );

      await autoSaveManager.updateWorkInProgress(
        sessionId,
        { currentPage: 5, edits: ['edit1', 'edit2'] },
        50
      );

      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(2); // Once for start, once for update
    });

    it('should complete a work session', async () => {
      const sessionId = await autoSaveManager.startWorkSession(
        'split',
        ['/test/file.pdf'],
        'Splitting PDF'
      );

      await autoSaveManager.completeWorkSession(sessionId);

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(`autosave_${sessionId}`);
    });

    it('should handle invalid session ID gracefully', async () => {
      await expect(
        autoSaveManager.updateWorkInProgress('invalid-session', {}, 0)
      ).resolves.not.toThrow();
    });
  });

  describe('Auto-Save Sessions Retrieval', () => {
    it('should return empty array when no sessions exist', async () => {
      const sessions = await autoSaveManager.getAutoSaveSessions();
      expect(sessions).toEqual([]);
    });

    it('should return sessions sorted by timestamp', async () => {
      // Mock multiple sessions
      const session1 = await autoSaveManager.startWorkSession(
        'merge',
        ['/test/file1.pdf'],
        'Operation 1'
      );
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const session2 = await autoSaveManager.startWorkSession(
        'edit',
        ['/test/file2.pdf'],
        'Operation 2'
      );

      const sessions = await autoSaveManager.getAutoSaveSessions();
      expect(sessions).toHaveLength(2);
      
      // Should be sorted by timestamp (newest first)
      expect(sessions[0].timestamp.getTime()).toBeGreaterThan(sessions[1].timestamp.getTime());
    });
  });

  describe('Work Session Recovery', () => {
    it('should recover existing work session', async () => {
      const sessionId = await autoSaveManager.startWorkSession(
        'annotation',
        ['/test/file.pdf'],
        'Adding annotations'
      );

      const recovered = await autoSaveManager.recoverWorkSession(sessionId);
      expect(recovered).toBeDefined();
      expect(recovered?.id).toBe(sessionId);
    });

    it('should return null for non-existent session', async () => {
      const recovered = await autoSaveManager.recoverWorkSession('non-existent');
      expect(recovered).toBeNull();
    });

    it('should load session from storage if not in memory', async () => {
      const sessionData = {
        id: 'test-session',
        type: 'merge',
        timestamp: new Date().toISOString(),
        originalFiles: ['/test/file.pdf'],
        workInProgress: {},
        metadata: {
          operation: 'Test operation',
          progress: 25,
          lastSaved: new Date().toISOString(),
        },
      };

      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(sessionData));

      const recovered = await autoSaveManager.recoverWorkSession('test-session');
      expect(recovered).toBeDefined();
      expect(recovered?.id).toBe('test-session');
    });
  });

  describe('Session Cleanup', () => {
    it('should clean up old sessions', async () => {
      // Create an old session (simulate by mocking the data)
      const oldTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      const sessionId = 'old-session';
      
      // Mock the session data
      const sessionData = {
        id: sessionId,
        type: 'merge',
        timestamp: oldTimestamp.toISOString(),
        originalFiles: ['/test/file.pdf'],
        workInProgress: {},
        metadata: {
          operation: 'Old operation',
          progress: 0,
          lastSaved: oldTimestamp.toISOString(),
        },
      };

      mockAsyncStorage.getAllKeys.mockResolvedValueOnce([`autosave_${sessionId}`]);
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(sessionData));

      await autoSaveManager.cleanupOldSessions(24 * 60 * 60 * 1000); // 24 hours

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(`autosave_${sessionId}`);
    });

    it('should not clean up recent sessions', async () => {
      const recentTimestamp = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago
      const sessionId = 'recent-session';
      
      const sessionData = {
        id: sessionId,
        type: 'edit',
        timestamp: recentTimestamp.toISOString(),
        originalFiles: ['/test/file.pdf'],
        workInProgress: {},
        metadata: {
          operation: 'Recent operation',
          progress: 50,
          lastSaved: recentTimestamp.toISOString(),
        },
      };

      mockAsyncStorage.getAllKeys.mockResolvedValueOnce([`autosave_${sessionId}`]);
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(sessionData));

      await autoSaveManager.cleanupOldSessions(24 * 60 * 60 * 1000); // 24 hours

      expect(mockAsyncStorage.removeItem).not.toHaveBeenCalledWith(`autosave_${sessionId}`);
    });
  });

  describe('Auto-Save Configuration', () => {
    it('should enable and disable auto-save', () => {
      autoSaveManager.setAutoSaveEnabled(false);
      autoSaveManager.setAutoSaveEnabled(true);
      
      // Test passes if no errors are thrown
      expect(true).toBe(true);
    });

    it('should set auto-save interval', () => {
      autoSaveManager.setAutoSaveInterval(60000); // 1 minute
      
      // Test passes if no errors are thrown
      expect(true).toBe(true);
    });
  });

  describe('Auto-Save Statistics', () => {
    it('should return correct statistics', async () => {
      const sessionId = await autoSaveManager.startWorkSession(
        'merge',
        ['/test/file1.pdf', '/test/file2.pdf'],
        'Test operation'
      );

      const stats = autoSaveManager.getAutoSaveStats();
      
      expect(stats.activeSessions).toBe(1);
      expect(stats.autoSaveEnabled).toBe(true);
      expect(stats.lastAutoSave).toBeDefined();
    });

    it('should return correct statistics when no sessions exist', () => {
      const stats = autoSaveManager.getAutoSaveStats();
      
      expect(stats.activeSessions).toBe(0);
      expect(stats.totalSessions).toBe(0);
      expect(stats.lastAutoSave).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle AsyncStorage errors gracefully', async () => {
      mockAsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage error'));

      await expect(
        autoSaveManager.startWorkSession('merge', ['/test/file.pdf'], 'Test')
      ).rejects.toThrow();
    });

    it('should handle corrupted session data', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce('invalid-json');

      const recovered = await autoSaveManager.recoverWorkSession('test-session');
      expect(recovered).toBeNull();
    });

    it('should handle missing session data gracefully', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const recovered = await autoSaveManager.recoverWorkSession('missing-session');
      expect(recovered).toBeNull();
    });
  });

  describe('Session Data Persistence', () => {
    it('should serialize and deserialize session data correctly', async () => {
      const originalFiles = ['/test/file1.pdf', '/test/file2.pdf'];
      const operation = 'Test merge operation';
      
      const sessionId = await autoSaveManager.startWorkSession(
        'merge',
        originalFiles,
        operation
      );

      const workData = {
        mergedPages: [1, 2, 3],
        currentStep: 'processing',
      };

      await autoSaveManager.updateWorkInProgress(sessionId, workData, 75);

      // Verify that setItem was called with properly serialized data
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
      
      const lastCall = mockAsyncStorage.setItem.mock.calls[mockAsyncStorage.setItem.mock.calls.length - 1];
      const [key, serializedData] = lastCall;
      
      expect(key).toBe(`autosave_${sessionId}`);
      
      const parsedData = JSON.parse(serializedData);
      expect(parsedData.originalFiles).toEqual(originalFiles);
      expect(parsedData.metadata.operation).toBe(operation);
      expect(parsedData.metadata.progress).toBe(75);
      expect(parsedData.workInProgress).toEqual(workData);
    });
  });
});