import { BackupManager, BackupMetadata, OperationHistory } from '../BackupManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FileManager } from '../../file-manager/FileManager';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../file-manager/FileManager');
jest.mock('../ErrorHandler');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockFileManager = FileManager as jest.MockedClass<typeof FileManager>;

describe('BackupManager', () => {
  let backupManager: BackupManager;
  let mockFileManagerInstance: jest.Mocked<FileManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup FileManager mock
    mockFileManagerInstance = {
      fileExists: jest.fn(),
      getFileInfo: jest.fn(),
      copyFile: jest.fn(),
      deleteFile: jest.fn(),
      listFiles: jest.fn(),
      getDocumentsDirectory: jest.fn(),
      createDirectory: jest.fn(),
    } as any;

    mockFileManager.mockImplementation(() => mockFileManagerInstance);
    
    // Setup AsyncStorage mocks
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.removeItem.mockResolvedValue();
    mockAsyncStorage.getAllKeys.mockResolvedValue([]);

    // Setup default FileManager responses
    mockFileManagerInstance.fileExists.mockResolvedValue(true);
    mockFileManagerInstance.getDocumentsDirectory.mockResolvedValue('/documents/');
    mockFileManagerInstance.getFileInfo.mockResolvedValue({
      fileName: 'test.pdf',
      filePath: '/test/file.pdf',
      fileSize: 1024,
      createdAt: new Date(),
      modifiedAt: new Date(),
      mimeType: 'application/pdf',
    });
    mockFileManagerInstance.copyFile.mockResolvedValue('/backup/path');
    mockFileManagerInstance.createDirectory.mockResolvedValue();
    mockFileManagerInstance.listFiles.mockResolvedValue([]);

    backupManager = BackupManager.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = BackupManager.getInstance();
      const instance2 = BackupManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Backup Creation', () => {
    it('should create a backup successfully', async () => {
      const filePath = '/test/document.pdf';
      const operation = 'merge';

      const backupId = await backupManager.createBackup(filePath, operation);

      expect(backupId).toBeDefined();
      expect(typeof backupId).toBe('string');
      expect(mockFileManagerInstance.fileExists).toHaveBeenCalledWith(filePath);
      expect(mockFileManagerInstance.copyFile).toHaveBeenCalled();
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should throw error if source file does not exist', async () => {
      mockFileManagerInstance.fileExists.mockResolvedValueOnce(false);

      await expect(
        backupManager.createBackup('/nonexistent/file.pdf', 'test')
      ).rejects.toThrow('Source file not found');
    });

    it('should create multiple backups for batch operations', async () => {
      const filePaths = ['/test/file1.pdf', '/test/file2.pdf', '/test/file3.pdf'];
      const operation = 'merge';

      const backupIds = await backupManager.createMultipleBackups(filePaths, operation);

      expect(backupIds).toHaveLength(3);
      expect(mockFileManagerInstance.copyFile).toHaveBeenCalledTimes(3);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(3);
    });

    it('should cleanup partial backups on failure', async () => {
      const filePaths = ['/test/file1.pdf', '/test/file2.pdf', '/test/file3.pdf'];
      
      // Make the second backup fail
      mockFileManagerInstance.copyFile
        .mockResolvedValueOnce('/backup/file1')
        .mockRejectedValueOnce(new Error('Copy failed'))
        .mockResolvedValueOnce('/backup/file3');

      await expect(
        backupManager.createMultipleBackups(filePaths, 'merge')
      ).rejects.toThrow('Copy failed');

      // Should attempt to cleanup the successful backup
      expect(mockAsyncStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('Operation Recording', () => {
    it('should record an operation successfully', async () => {
      const operationId = await backupManager.recordOperation(
        'merge',
        ['/test/file1.pdf', '/test/file2.pdf'],
        ['/test/merged.pdf'],
        ['backup1', 'backup2'],
        { description: 'Test merge' }
      );

      expect(operationId).toBeDefined();
      expect(typeof operationId).toBe('string');
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'operation_history',
        expect.any(String)
      );
    });

    it('should mark operation as undoable when backups exist', async () => {
      const operationId = await backupManager.recordOperation(
        'edit',
        ['/test/file.pdf'],
        ['/test/edited.pdf'],
        ['backup1']
      );

      const operations = backupManager.getOperationHistory();
      const operation = operations.find(op => op.id === operationId);
      
      expect(operation?.canUndo).toBe(true);
    });

    it('should mark operation as not undoable when no backups exist', async () => {
      const operationId = await backupManager.recordOperation(
        'split',
        ['/test/file.pdf'],
        ['/test/split1.pdf', '/test/split2.pdf'],
        [] // No backups
      );

      const operations = backupManager.getOperationHistory();
      const operation = operations.find(op => op.id === operationId);
      
      expect(operation?.canUndo).toBe(false);
    });
  });

  describe('Operation Rollback', () => {
    it('should rollback an operation successfully', async () => {
      // First create a backup
      const backupId = await backupManager.createBackup('/test/file.pdf', 'edit');
      
      // Record an operation
      const operationId = await backupManager.recordOperation(
        'edit',
        ['/test/file.pdf'],
        ['/test/edited.pdf'],
        [backupId]
      );

      // Mock backup metadata retrieval
      const backupMetadata: BackupMetadata = {
        id: backupId,
        originalFilePath: '/test/file.pdf',
        backupFilePath: '/backup/file.pdf',
        operation: 'edit',
        timestamp: new Date(),
        fileSize: 1024,
      };

      mockAsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify({
          ...backupMetadata,
          timestamp: backupMetadata.timestamp.toISOString(),
        })
      );

      const success = await backupManager.rollbackOperation(operationId);

      expect(success).toBe(true);
      expect(mockFileManagerInstance.copyFile).toHaveBeenCalledWith(
        '/backup/file.pdf',
        '/test/file.pdf'
      );
      expect(mockFileManagerInstance.deleteFile).toHaveBeenCalledWith('/test/edited.pdf');
    });

    it('should fail rollback for non-existent operation', async () => {
      const success = await backupManager.rollbackOperation('non-existent');
      expect(success).toBe(false);
    });

    it('should fail rollback for non-undoable operation', async () => {
      const operationId = await backupManager.recordOperation(
        'split',
        ['/test/file.pdf'],
        ['/test/split1.pdf'],
        [] // No backups, so not undoable
      );

      const success = await backupManager.rollbackOperation(operationId);
      expect(success).toBe(false);
    });
  });

  describe('Backup Restoration', () => {
    it('should restore file from backup successfully', async () => {
      const backupId = 'test-backup-id';
      const backupMetadata: BackupMetadata = {
        id: backupId,
        originalFilePath: '/test/original.pdf',
        backupFilePath: '/backup/original.pdf',
        operation: 'edit',
        timestamp: new Date(),
        fileSize: 1024,
      };

      mockAsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify({
          ...backupMetadata,
          timestamp: backupMetadata.timestamp.toISOString(),
        })
      );

      const restoredPath = await backupManager.restoreFromBackup(backupId);

      expect(restoredPath).toBe('/test/original.pdf');
      expect(mockFileManagerInstance.copyFile).toHaveBeenCalledWith(
        '/backup/original.pdf',
        '/test/original.pdf'
      );
    });

    it('should return null for non-existent backup', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const restoredPath = await backupManager.restoreFromBackup('non-existent');
      expect(restoredPath).toBeNull();
    });

    it('should return null if backup file does not exist', async () => {
      const backupMetadata: BackupMetadata = {
        id: 'test-backup',
        originalFilePath: '/test/original.pdf',
        backupFilePath: '/backup/missing.pdf',
        operation: 'edit',
        timestamp: new Date(),
        fileSize: 1024,
      };

      mockAsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify({
          ...backupMetadata,
          timestamp: backupMetadata.timestamp.toISOString(),
        })
      );

      mockFileManagerInstance.fileExists.mockResolvedValueOnce(false);

      const restoredPath = await backupManager.restoreFromBackup('test-backup');
      expect(restoredPath).toBeNull();
    });
  });

  describe('Operation History', () => {
    it('should return operation history sorted by timestamp', async () => {
      // Create multiple operations with different timestamps
      const op1Id = await backupManager.recordOperation(
        'merge',
        ['/test/file1.pdf'],
        ['/test/merged1.pdf'],
        ['backup1']
      );

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const op2Id = await backupManager.recordOperation(
        'edit',
        ['/test/file2.pdf'],
        ['/test/edited2.pdf'],
        ['backup2']
      );

      const history = backupManager.getOperationHistory();
      expect(history).toHaveLength(2);
      
      // Should be sorted by timestamp (newest first)
      expect(history[0].timestamp.getTime()).toBeGreaterThan(history[1].timestamp.getTime());
    });

    it('should return only undoable operations', async () => {
      await backupManager.recordOperation(
        'merge',
        ['/test/file1.pdf'],
        ['/test/merged.pdf'],
        ['backup1'] // Has backup, undoable
      );

      await backupManager.recordOperation(
        'split',
        ['/test/file2.pdf'],
        ['/test/split1.pdf'],
        [] // No backup, not undoable
      );

      const undoableOps = backupManager.getUndoableOperations();
      expect(undoableOps).toHaveLength(1);
      expect(undoableOps[0].type).toBe('merge');
    });
  });

  describe('Backup Information', () => {
    it('should return backup information', async () => {
      const mockFiles = [
        {
          fileName: 'backup1.pdf',
          filePath: '/backup/backup1.pdf',
          fileSize: 1024,
          createdAt: new Date(Date.now() - 1000),
          modifiedAt: new Date(),
          mimeType: 'application/pdf',
        },
        {
          fileName: 'backup2.pdf',
          filePath: '/backup/backup2.pdf',
          fileSize: 2048,
          createdAt: new Date(),
          modifiedAt: new Date(),
          mimeType: 'application/pdf',
        },
      ];

      mockFileManagerInstance.listFiles.mockResolvedValueOnce(mockFiles);

      const backupInfo = await backupManager.getBackupInfo();

      expect(backupInfo.totalBackups).toBe(2);
      expect(backupInfo.totalSize).toBe(3072);
      expect(backupInfo.oldestBackup).toBeDefined();
      expect(backupInfo.newestBackup).toBeDefined();
    });

    it('should handle empty backup directory', async () => {
      mockFileManagerInstance.listFiles.mockResolvedValueOnce([]);

      const backupInfo = await backupManager.getBackupInfo();

      expect(backupInfo.totalBackups).toBe(0);
      expect(backupInfo.totalSize).toBe(0);
      expect(backupInfo.oldestBackup).toBeNull();
      expect(backupInfo.newestBackup).toBeNull();
    });
  });

  describe('Backup Cleanup', () => {
    it('should clean up old backups', async () => {
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      const recentDate = new Date();

      const mockFiles = [
        {
          fileName: 'backup_old_file.pdf',
          filePath: '/backup/backup_old_file.pdf',
          fileSize: 1024,
          createdAt: oldDate,
          modifiedAt: oldDate,
          mimeType: 'application/pdf',
        },
        {
          fileName: 'backup_recent_file.pdf',
          filePath: '/backup/backup_recent_file.pdf',
          fileSize: 2048,
          createdAt: recentDate,
          modifiedAt: recentDate,
          mimeType: 'application/pdf',
        },
      ];

      mockFileManagerInstance.listFiles.mockResolvedValueOnce(mockFiles);

      await backupManager.cleanupOldBackups();

      // Should delete the old backup but keep the recent one
      expect(mockFileManagerInstance.deleteFile).toHaveBeenCalledWith('/backup/backup_old_file.pdf');
      expect(mockFileManagerInstance.deleteFile).not.toHaveBeenCalledWith('/backup/backup_recent_file.pdf');
    });

    it('should limit number of backups', async () => {
      // Create more backups than the limit (assuming limit is 50)
      const mockFiles = Array.from({ length: 55 }, (_, i) => ({
        fileName: `backup_${i}.pdf`,
        filePath: `/backup/backup_${i}.pdf`,
        fileSize: 1024,
        createdAt: new Date(Date.now() - i * 1000), // Different timestamps
        modifiedAt: new Date(),
        mimeType: 'application/pdf',
      }));

      mockFileManagerInstance.listFiles.mockResolvedValueOnce(mockFiles);

      await backupManager.cleanupOldBackups();

      // Should delete 5 oldest backups (55 - 50 = 5)
      expect(mockFileManagerInstance.deleteFile).toHaveBeenCalledTimes(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors during backup creation', async () => {
      mockFileManagerInstance.copyFile.mockRejectedValueOnce(new Error('Copy failed'));

      await expect(
        backupManager.createBackup('/test/file.pdf', 'test')
      ).rejects.toThrow();
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      mockAsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage error'));

      await expect(
        backupManager.recordOperation('merge', ['/test/file.pdf'], ['/test/result.pdf'], ['backup1'])
      ).rejects.toThrow();
    });

    it('should handle corrupted backup metadata', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce('invalid-json');

      const restoredPath = await backupManager.restoreFromBackup('test-backup');
      expect(restoredPath).toBeNull();
    });
  });
});