import { RecoverySystem, RecoveryOptions } from '../RecoverySystem';
import { AutoSaveManager, AutoSaveData } from '../AutoSaveManager';
import { BackupManager, OperationHistory } from '../BackupManager';
import { FileManager } from '../../file-manager/FileManager';

// Mock dependencies
jest.mock('../ErrorHandler');
jest.mock('../AutoSaveManager');
jest.mock('../BackupManager');
jest.mock('../../file-manager/FileManager');

const mockAutoSaveManager = AutoSaveManager as jest.MockedClass<typeof AutoSaveManager>;
const mockBackupManager = BackupManager as jest.MockedClass<typeof BackupManager>;
const mockFileManager = FileManager as jest.MockedClass<typeof FileManager>;

describe('RecoverySystem', () => {
  let recoverySystem: RecoverySystem;
  let mockAutoSaveInstance: jest.Mocked<AutoSaveManager>;
  let mockBackupInstance: jest.Mocked<BackupManager>;
  let mockFileManagerInstance: jest.Mocked<FileManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup AutoSaveManager mock
    mockAutoSaveInstance = {
      getAutoSaveSessions: jest.fn(),
      recoverWorkSession: jest.fn(),
      completeWorkSession: jest.fn(),
      cleanupOldSessions: jest.fn(),
      getAutoSaveStats: jest.fn(),
    } as any;

    mockAutoSaveManager.getInstance.mockReturnValue(mockAutoSaveInstance);

    // Setup BackupManager mock
    mockBackupInstance = {
      getUndoableOperations: jest.fn(),
      getOperationHistory: jest.fn(),
      rollbackOperation: jest.fn(),
      restoreFromBackup: jest.fn(),
      cleanupOldBackups: jest.fn(),
      getBackupInfo: jest.fn(),
    } as any;

    mockBackupManager.getInstance.mockReturnValue(mockBackupInstance);

    // Setup FileManager mock
    mockFileManagerInstance = {
      fileExists: jest.fn(),
      getFileInfo: jest.fn(),
      listFiles: jest.fn(),
      deleteFile: jest.fn(),
      getDocumentsDirectory: jest.fn(),
      getCacheDirectory: jest.fn(),
      getAvailableSpace: jest.fn(),
      getUsedSpace: jest.fn(),
    } as any;

    mockFileManager.mockImplementation(() => mockFileManagerInstance);

    recoverySystem = RecoverySystem.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = RecoverySystem.getInstance();
      const instance2 = RecoverySystem.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Recovery Options Analysis', () => {
    it('should analyze recovery options successfully', async () => {
      const mockAutoSaveSessions: AutoSaveData[] = [
        {
          id: 'session1',
          type: 'merge',
          timestamp: new Date(),
          originalFiles: ['/test/file1.pdf', '/test/file2.pdf'],
          workInProgress: { progress: 50 },
          metadata: {
            operation: 'Merging PDFs',
            progress: 50,
            lastSaved: new Date(),
          },
        },
      ];

      const mockUndoableOps: OperationHistory[] = [
        {
          id: 'op1',
          type: 'edit',
          timestamp: new Date(),
          originalFiles: ['/test/file.pdf'],
          resultFiles: ['/test/edited.pdf'],
          backupIds: ['backup1'],
          canUndo: true,
          metadata: {},
        },
      ];

      mockAutoSaveInstance.getAutoSaveSessions.mockResolvedValue(mockAutoSaveSessions);
      mockBackupInstance.getUndoableOperations.mockResolvedValue(mockUndoableOps);
      mockFileManagerInstance.getDocumentsDirectory.mockResolvedValue('/documents/');
      mockFileManagerInstance.listFiles.mockResolvedValue([]);

      const options = await recoverySystem.analyzeRecoveryOptions();

      expect(options.autoSaveSessions).toEqual(mockAutoSaveSessions);
      expect(options.undoableOperations).toEqual(mockUndoableOps);
      expect(options.corruptedFiles).toEqual([]);
      expect(options.suggestions).toBeDefined();
    });

    it('should handle errors during analysis gracefully', async () => {
      mockAutoSaveInstance.getAutoSaveSessions.mockRejectedValue(new Error('Analysis failed'));
      mockBackupInstance.getUndoableOperations.mockResolvedValue([]);
      mockFileManagerInstance.getDocumentsDirectory.mockResolvedValue('/documents/');
      mockFileManagerInstance.listFiles.mockResolvedValue([]);

      const options = await recoverySystem.analyzeRecoveryOptions();

      expect(options.autoSaveSessions).toEqual([]);
      expect(options.undoableOperations).toEqual([]);
      expect(options.corruptedFiles).toEqual([]);
      expect(options.suggestions).toEqual([]);
    });
  });

  describe('Auto Recovery', () => {
    it('should perform auto recovery successfully', async () => {
      const mockAutoSaveSessions: AutoSaveData[] = [
        {
          id: 'session1',
          type: 'merge',
          timestamp: new Date(),
          originalFiles: ['/test/file1.pdf'],
          workInProgress: {},
          metadata: {
            operation: 'Test operation',
            progress: 25,
            lastSaved: new Date(),
          },
        },
      ];

      mockAutoSaveInstance.getAutoSaveSessions.mockResolvedValue(mockAutoSaveSessions);
      mockAutoSaveInstance.recoverWorkSession.mockResolvedValue(mockAutoSaveSessions[0]);
      mockFileManagerInstance.getDocumentsDirectory.mockResolvedValue('/documents/');
      mockFileManagerInstance.listFiles.mockResolvedValue([]);
      mockFileManagerInstance.fileExists.mockResolvedValue(true);
      mockFileManagerInstance.getAvailableSpace.mockResolvedValue(1000000);
      mockFileManagerInstance.getUsedSpace.mockResolvedValue(500000);

      const result = await recoverySystem.performAutoRecovery();

      expect(result.success).toBe(true);
      expect(result.recoveredFiles.length).toBeGreaterThan(0);
      expect(result.errors).toEqual([]);
    });

    it('should handle recovery failures gracefully', async () => {
      mockAutoSaveInstance.getAutoSaveSessions.mockResolvedValue([]);
      mockFileManagerInstance.getDocumentsDirectory.mockResolvedValue('/documents/');
      mockFileManagerInstance.listFiles.mockRejectedValue(new Error('List files failed'));

      const result = await recoverySystem.performAutoRecovery();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Auto-Save Recovery', () => {
    it('should recover from auto-save session successfully', async () => {
      const mockSession: AutoSaveData = {
        id: 'session1',
        type: 'edit',
        timestamp: new Date(),
        originalFiles: ['/test/file.pdf'],
        workInProgress: { edits: ['edit1'] },
        metadata: {
          operation: 'Editing PDF',
          progress: 75,
          lastSaved: new Date(),
        },
      };

      mockAutoSaveInstance.recoverWorkSession.mockResolvedValue(mockSession);
      mockFileManagerInstance.fileExists.mockResolvedValue(true);

      const success = await recoverySystem.recoverFromAutoSave('session1');

      expect(success).toBe(true);
      expect(mockAutoSaveInstance.recoverWorkSession).toHaveBeenCalledWith('session1');
    });

    it('should return false for non-existent session', async () => {
      mockAutoSaveInstance.recoverWorkSession.mockResolvedValue(null);

      const success = await recoverySystem.recoverFromAutoSave('non-existent');

      expect(success).toBe(false);
    });

    it('should handle sessions with missing original files', async () => {
      const mockSession: AutoSaveData = {
        id: 'session1',
        type: 'merge',
        timestamp: new Date(),
        originalFiles: ['/test/missing.pdf'],
        workInProgress: {},
        metadata: {
          operation: 'Test operation',
          progress: 50,
          lastSaved: new Date(),
        },
      };

      mockAutoSaveInstance.recoverWorkSession.mockResolvedValue(mockSession);
      mockFileManagerInstance.fileExists.mockResolvedValue(false);

      const success = await recoverySystem.recoverFromAutoSave('session1');

      expect(success).toBe(false);
      expect(mockAutoSaveInstance.completeWorkSession).toHaveBeenCalledWith('session1');
    });
  });

  describe('Undo Operations', () => {
    it('should undo last operation successfully', async () => {
      const mockOperations: OperationHistory[] = [
        {
          id: 'op1',
          type: 'merge',
          timestamp: new Date(),
          originalFiles: ['/test/file1.pdf', '/test/file2.pdf'],
          resultFiles: ['/test/merged.pdf'],
          backupIds: ['backup1', 'backup2'],
          canUndo: true,
          metadata: {},
        },
      ];

      mockBackupInstance.getUndoableOperations.mockReturnValue(mockOperations);
      mockBackupInstance.rollbackOperation.mockResolvedValue(true);

      const success = await recoverySystem.undoLastOperation();

      expect(success).toBe(true);
      expect(mockBackupInstance.rollbackOperation).toHaveBeenCalledWith('op1');
    });

    it('should handle no undoable operations', async () => {
      mockBackupInstance.getUndoableOperations.mockReturnValue([]);

      const success = await recoverySystem.undoLastOperation();

      expect(success).toBe(false);
    });

    it('should handle rollback failure', async () => {
      const mockOperations: OperationHistory[] = [
        {
          id: 'op1',
          type: 'edit',
          timestamp: new Date(),
          originalFiles: ['/test/file.pdf'],
          resultFiles: ['/test/edited.pdf'],
          backupIds: ['backup1'],
          canUndo: true,
          metadata: {},
        },
      ];

      mockBackupInstance.getUndoableOperations.mockReturnValue(mockOperations);
      mockBackupInstance.rollbackOperation.mockResolvedValue(false);

      const success = await recoverySystem.undoLastOperation();

      expect(success).toBe(false);
    });
  });

  describe('File Recovery', () => {
    it('should attempt file recovery successfully', async () => {
      const filePath = '/test/file.pdf';
      
      mockFileManagerInstance.fileExists.mockResolvedValue(true);
      mockFileManagerInstance.getFileInfo.mockResolvedValue({
        fileName: 'file.pdf',
        filePath,
        fileSize: 1024,
        createdAt: new Date(),
        modifiedAt: new Date(),
        mimeType: 'application/pdf',
      });

      const success = await recoverySystem.attemptFileRecovery(filePath);

      expect(success).toBe(true);
    });

    it('should return false for non-existent files', async () => {
      mockFileManagerInstance.fileExists.mockResolvedValue(false);

      const success = await recoverySystem.attemptFileRecovery('/test/missing.pdf');

      expect(success).toBe(false);
    });

    it('should attempt backup restoration for corrupted files', async () => {
      const filePath = '/test/corrupted.pdf';
      
      mockFileManagerInstance.fileExists.mockResolvedValue(true);
      mockFileManagerInstance.getFileInfo.mockRejectedValue(new Error('File corrupted'));
      
      const mockOperations: OperationHistory[] = [
        {
          id: 'op1',
          type: 'edit',
          timestamp: new Date(),
          originalFiles: [filePath],
          resultFiles: ['/test/edited.pdf'],
          backupIds: ['backup1'],
          canUndo: true,
          metadata: {},
        },
      ];

      mockBackupInstance.getOperationHistory.mockReturnValue(mockOperations);
      mockBackupInstance.restoreFromBackup.mockResolvedValue(filePath);

      const success = await recoverySystem.attemptFileRecovery(filePath);

      expect(success).toBe(true);
      expect(mockBackupInstance.restoreFromBackup).toHaveBeenCalledWith('backup1');
    });
  });

  describe('Storage Cleanup', () => {
    it('should perform storage cleanup successfully', async () => {
      mockFileManagerInstance.getCacheDirectory.mockResolvedValue('/cache/');
      mockFileManagerInstance.listFiles.mockResolvedValue([
        {
          fileName: 'old_temp.pdf',
          filePath: '/cache/old_temp.pdf',
          fileSize: 1024,
          createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          modifiedAt: new Date(),
          mimeType: 'application/pdf',
        },
      ]);

      const success = await recoverySystem.performStorageCleanup();

      expect(success).toBe(true);
      expect(mockBackupInstance.cleanupOldBackups).toHaveBeenCalled();
      expect(mockAutoSaveInstance.cleanupOldSessions).toHaveBeenCalled();
      expect(mockFileManagerInstance.deleteFile).toHaveBeenCalledWith('/cache/old_temp.pdf');
    });

    it('should handle cleanup errors gracefully', async () => {
      mockBackupInstance.cleanupOldBackups.mockRejectedValue(new Error('Cleanup failed'));
      mockAutoSaveInstance.cleanupOldSessions.mockResolvedValue();
      mockFileManagerInstance.getCacheDirectory.mockResolvedValue('/cache/');
      mockFileManagerInstance.listFiles.mockResolvedValue([]);

      const success = await recoverySystem.performStorageCleanup();

      expect(success).toBe(true); // Should still succeed if some cleanup works
    });
  });

  describe('System Health', () => {
    it('should return healthy status when no issues', async () => {
      mockFileManagerInstance.getAvailableSpace.mockResolvedValue(8000000); // 8MB available
      mockFileManagerInstance.getUsedSpace.mockResolvedValue(2000000); // 2MB used (20% usage)
      mockBackupInstance.getBackupInfo.mockResolvedValue({
        totalBackups: 5,
        totalSize: 1000000,
        oldestBackup: new Date(),
        newestBackup: new Date(),
      });
      mockAutoSaveInstance.getAutoSaveStats.mockReturnValue({
        activeSessions: 1,
        totalSessions: 3,
        lastAutoSave: new Date(),
        autoSaveEnabled: true,
      });

      const health = await recoverySystem.getSystemHealth();

      expect(health.status).toBe('healthy');
      expect(health.issues).toEqual([]);
    });

    it('should return warning status for low storage', async () => {
      mockFileManagerInstance.getAvailableSpace.mockResolvedValue(2000000); // 2MB available
      mockFileManagerInstance.getUsedSpace.mockResolvedValue(8000000); // 8MB used (80% usage)
      mockBackupInstance.getBackupInfo.mockResolvedValue({
        totalBackups: 5,
        totalSize: 1000000,
        oldestBackup: new Date(),
        newestBackup: new Date(),
      });
      mockAutoSaveInstance.getAutoSaveStats.mockReturnValue({
        activeSessions: 0,
        totalSessions: 0,
        lastAutoSave: null,
        autoSaveEnabled: true,
      });

      const health = await recoverySystem.getSystemHealth();

      expect(health.status).toBe('warning');
      expect(health.issues).toContain('Storage space running low');
      expect(health.recommendations).toContain('Consider cleaning up old files');
    });

    it('should return critical status for very low storage', async () => {
      mockFileManagerInstance.getAvailableSpace.mockResolvedValue(500000); // 0.5MB available
      mockFileManagerInstance.getUsedSpace.mockResolvedValue(9500000); // 9.5MB used (95% usage)
      mockBackupInstance.getBackupInfo.mockResolvedValue({
        totalBackups: 0,
        totalSize: 0,
        oldestBackup: null,
        newestBackup: null,
      });
      mockAutoSaveInstance.getAutoSaveStats.mockReturnValue({
        activeSessions: 0,
        totalSessions: 0,
        lastAutoSave: null,
        autoSaveEnabled: false,
      });

      const health = await recoverySystem.getSystemHealth();

      expect(health.status).toBe('critical');
      expect(health.issues).toContain('Storage space critically low');
      expect(health.issues).toContain('No backups available');
      expect(health.issues).toContain('Auto-save is disabled');
    });

    it('should handle health check errors', async () => {
      mockFileManagerInstance.getAvailableSpace.mockRejectedValue(new Error('Storage check failed'));

      const health = await recoverySystem.getSystemHealth();

      expect(health.status).toBe('critical');
      expect(health.issues).toContain('Failed to assess system health');
    });
  });

  describe('Recovery Suggestions Generation', () => {
    it('should generate auto-save recovery suggestions', async () => {
      const mockAutoSaveSessions: AutoSaveData[] = [
        {
          id: 'session1',
          type: 'merge',
          timestamp: new Date(),
          originalFiles: ['/test/file1.pdf'],
          workInProgress: {},
          metadata: {
            operation: 'Test operation',
            progress: 50,
            lastSaved: new Date(),
          },
        },
      ];

      mockAutoSaveInstance.getAutoSaveSessions.mockResolvedValue(mockAutoSaveSessions);
      mockBackupInstance.getUndoableOperations.mockResolvedValue([]);
      mockFileManagerInstance.getDocumentsDirectory.mockResolvedValue('/documents/');
      mockFileManagerInstance.listFiles.mockResolvedValue([]);
      mockFileManagerInstance.getAvailableSpace.mockResolvedValue(8000000);
      mockFileManagerInstance.getUsedSpace.mockResolvedValue(2000000);

      const options = await recoverySystem.analyzeRecoveryOptions();

      expect(options.suggestions).toHaveLength(1);
      expect(options.suggestions[0].type).toBe('auto_save');
      expect(options.suggestions[0].title).toBe('Recover Unsaved Work');
      expect(options.suggestions[0].priority).toBe('high');
    });

    it('should generate undo operation suggestions', async () => {
      const mockUndoableOps: OperationHistory[] = [
        {
          id: 'op1',
          type: 'edit',
          timestamp: new Date(),
          originalFiles: ['/test/file.pdf'],
          resultFiles: ['/test/edited.pdf'],
          backupIds: ['backup1'],
          canUndo: true,
          metadata: {},
        },
      ];

      mockAutoSaveInstance.getAutoSaveSessions.mockResolvedValue([]);
      mockBackupInstance.getUndoableOperations.mockResolvedValue(mockUndoableOps);
      mockFileManagerInstance.getDocumentsDirectory.mockResolvedValue('/documents/');
      mockFileManagerInstance.listFiles.mockResolvedValue([]);
      mockFileManagerInstance.getAvailableSpace.mockResolvedValue(8000000);
      mockFileManagerInstance.getUsedSpace.mockResolvedValue(2000000);

      const options = await recoverySystem.analyzeRecoveryOptions();

      expect(options.suggestions).toHaveLength(1);
      expect(options.suggestions[0].type).toBe('backup_restore');
      expect(options.suggestions[0].title).toBe('Undo Last Operation');
      expect(options.suggestions[0].priority).toBe('medium');
    });

    it('should generate storage cleanup suggestions for high usage', async () => {
      mockAutoSaveInstance.getAutoSaveSessions.mockResolvedValue([]);
      mockBackupInstance.getUndoableOperations.mockResolvedValue([]);
      mockFileManagerInstance.getDocumentsDirectory.mockResolvedValue('/documents/');
      mockFileManagerInstance.listFiles.mockResolvedValue([]);
      mockFileManagerInstance.getAvailableSpace.mockResolvedValue(2000000); // 2MB available
      mockFileManagerInstance.getUsedSpace.mockResolvedValue(8000000); // 8MB used (80% usage)

      const options = await recoverySystem.analyzeRecoveryOptions();

      const cleanupSuggestion = options.suggestions.find(s => s.type === 'storage_cleanup');
      expect(cleanupSuggestion).toBeDefined();
      expect(cleanupSuggestion?.priority).toBe('medium');
    });
  });
});