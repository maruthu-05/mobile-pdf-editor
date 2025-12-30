import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FileManager } from '../file-manager/FileManager';
import { ErrorHandler } from './ErrorHandler';
import { ErrorFactory } from '../../types/errors';

/**
 * Interface for backup metadata
 */
export interface BackupMetadata {
  id: string;
  originalFilePath: string;
  backupFilePath: string;
  operation: string;
  timestamp: Date;
  fileSize: number;
  checksum?: string;
}

/**
 * Interface for operation history
 */
export interface OperationHistory {
  id: string;
  type: 'merge' | 'split' | 'edit' | 'annotation' | 'delete';
  timestamp: Date;
  originalFiles: string[];
  resultFiles: string[];
  backupIds: string[];
  canUndo: boolean;
  metadata: any;
}

/**
 * Backup creation and operation rollback system
 */
export class BackupManager {
  private static instance: BackupManager;
  private fileManager: FileManager;
  private errorHandler: ErrorHandler;
  private backupDirectory: string;
  private maxBackups = 50;
  private maxBackupAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  private operationHistory: Map<string, OperationHistory> = new Map();

  private constructor() {
    this.fileManager = new FileManager();
    this.errorHandler = ErrorHandler.getInstance();
    this.backupDirectory = '';
    this.initializeBackupSystem();
  }

  static getInstance(): BackupManager {
    if (!BackupManager.instance) {
      BackupManager.instance = new BackupManager();
    }
    return BackupManager.instance;
  }

  /**
   * Initialize backup system
   */
  private async initializeBackupSystem(): Promise<void> {
    try {
      const documentsDir = await this.fileManager.getDocumentsDirectory();
      this.backupDirectory = `${documentsDir}backups/`;
      
      // Create backup directory if it doesn't exist
      await this.fileManager.createDirectory(this.backupDirectory);
      
      // Load operation history
      await this.loadOperationHistory();
      
      // Clean up old backups
      await this.cleanupOldBackups();
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `Failed to initialize backup system: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          error
        )
      );
    }
  }

  /**
   * Create backup before destructive operation
   */
  async createBackup(
    filePath: string,
    operation: string,
    metadata?: any
  ): Promise<string> {
    try {
      // Validate source file
      const fileExists = await this.fileManager.fileExists(filePath);
      if (!fileExists) {
        throw new Error(`Source file not found: ${filePath}`);
      }

      // Generate backup ID and path
      const backupId = this.generateBackupId();
      const fileName = filePath.split('/').pop() || 'unknown';
      const backupFileName = `${backupId}_${fileName}`;
      const backupFilePath = `${this.backupDirectory}${backupFileName}`;

      // Copy file to backup location
      await this.fileManager.copyFile(filePath, backupFilePath);

      // Get file info
      const fileInfo = await this.fileManager.getFileInfo(filePath);

      // Create backup metadata
      const backupMetadata: BackupMetadata = {
        id: backupId,
        originalFilePath: filePath,
        backupFilePath,
        operation,
        timestamp: new Date(),
        fileSize: fileInfo.fileSize,
        checksum: await this.calculateChecksum(filePath),
      };

      // Save backup metadata
      await this.saveBackupMetadata(backupMetadata);

      return backupId;
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
          filePath,
          error
        )
      );
      throw error;
    }
  }

  /**
   * Create multiple backups for batch operations
   */
  async createMultipleBackups(
    filePaths: string[],
    operation: string,
    metadata?: any
  ): Promise<string[]> {
    const backupIds: string[] = [];
    
    try {
      for (const filePath of filePaths) {
        const backupId = await this.createBackup(filePath, operation, metadata);
        backupIds.push(backupId);
      }
      
      return backupIds;
    } catch (error) {
      // If any backup fails, clean up the ones that succeeded
      for (const backupId of backupIds) {
        try {
          await this.removeBackup(backupId);
        } catch (cleanupError) {
          console.warn(`Failed to cleanup backup ${backupId}:`, cleanupError);
        }
      }
      throw error;
    }
  }

  /**
   * Record an operation in history for potential rollback
   */
  async recordOperation(
    type: OperationHistory['type'],
    originalFiles: string[],
    resultFiles: string[],
    backupIds: string[],
    metadata?: any
  ): Promise<string> {
    try {
      const operationId = this.generateOperationId();
      const operation: OperationHistory = {
        id: operationId,
        type,
        timestamp: new Date(),
        originalFiles: [...originalFiles],
        resultFiles: [...resultFiles],
        backupIds: [...backupIds],
        canUndo: backupIds.length > 0,
        metadata: metadata || {},
      };

      this.operationHistory.set(operationId, operation);
      await this.saveOperationHistory();

      // Limit history size
      await this.limitOperationHistory();

      return operationId;
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `Failed to record operation: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          error
        )
      );
      throw error;
    }
  }

  /**
   * Rollback an operation using backups
   */
  async rollbackOperation(operationId: string): Promise<boolean> {
    try {
      const operation = this.operationHistory.get(operationId);
      if (!operation) {
        throw new Error(`Operation not found: ${operationId}`);
      }

      if (!operation.canUndo) {
        throw new Error(`Operation cannot be undone: ${operationId}`);
      }

      // Restore files from backups
      const restoredFiles: string[] = [];
      
      for (const backupId of operation.backupIds) {
        try {
          const restored = await this.restoreFromBackup(backupId);
          if (restored) {
            restoredFiles.push(restored);
          }
        } catch (error) {
          console.warn(`Failed to restore backup ${backupId}:`, error);
        }
      }

      // Remove result files if they exist
      for (const resultFile of operation.resultFiles) {
        try {
          const exists = await this.fileManager.fileExists(resultFile);
          if (exists) {
            await this.fileManager.deleteFile(resultFile);
          }
        } catch (error) {
          console.warn(`Failed to remove result file ${resultFile}:`, error);
        }
      }

      // Mark operation as rolled back
      operation.canUndo = false;
      operation.metadata.rolledBack = true;
      operation.metadata.rollbackTimestamp = new Date();
      
      this.operationHistory.set(operationId, operation);
      await this.saveOperationHistory();

      return restoredFiles.length > 0;
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `Failed to rollback operation: ${error instanceof Error ? error.message : 'Unknown error'}`,
          operationId,
          error
        )
      );
      return false;
    }
  }

  /**
   * Restore a file from backup
   */
  async restoreFromBackup(backupId: string): Promise<string | null> {
    try {
      const backupMetadata = await this.getBackupMetadata(backupId);
      if (!backupMetadata) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      // Verify backup file exists
      const backupExists = await this.fileManager.fileExists(backupMetadata.backupFilePath);
      if (!backupExists) {
        throw new Error(`Backup file not found: ${backupMetadata.backupFilePath}`);
      }

      // Verify backup integrity
      const isValid = await this.verifyBackupIntegrity(backupMetadata);
      if (!isValid) {
        throw new Error(`Backup integrity check failed: ${backupId}`);
      }

      // Restore file to original location
      await this.fileManager.copyFile(
        backupMetadata.backupFilePath,
        backupMetadata.originalFilePath
      );

      return backupMetadata.originalFilePath;
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `Failed to restore from backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
          backupId,
          error
        )
      );
      return null;
    }
  }

  /**
   * Get operation history
   */
  getOperationHistory(): OperationHistory[] {
    return Array.from(this.operationHistory.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get undoable operations
   */
  getUndoableOperations(): OperationHistory[] {
    return this.getOperationHistory().filter(op => op.canUndo);
  }

  /**
   * Get backup information
   */
  async getBackupInfo(): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
  }> {
    try {
      const backupFiles = await this.fileManager.listFiles(this.backupDirectory);
      const totalSize = backupFiles.reduce((sum, file) => sum + file.fileSize, 0);
      
      const timestamps = backupFiles.map(file => file.createdAt);
      const oldestBackup = timestamps.length > 0 ? new Date(Math.min(...timestamps.map(d => d.getTime()))) : null;
      const newestBackup = timestamps.length > 0 ? new Date(Math.max(...timestamps.map(d => d.getTime()))) : null;

      return {
        totalBackups: backupFiles.length,
        totalSize,
        oldestBackup,
        newestBackup,
      };
    } catch (error) {
      return {
        totalBackups: 0,
        totalSize: 0,
        oldestBackup: null,
        newestBackup: null,
      };
    }
  }

  /**
   * Clean up old backups
   */
  async cleanupOldBackups(): Promise<void> {
    try {
      const now = new Date().getTime();
      const backupFiles = await this.fileManager.listFiles(this.backupDirectory);
      
      // Sort by creation date (oldest first)
      const sortedBackups = backupFiles.sort((a, b) => 
        a.createdAt.getTime() - b.createdAt.getTime()
      );

      // Remove backups that are too old
      const backupsToRemove = sortedBackups.filter(backup => 
        now - backup.createdAt.getTime() > this.maxBackupAge
      );

      // Remove excess backups (keep only maxBackups)
      if (sortedBackups.length > this.maxBackups) {
        const excessBackups = sortedBackups.slice(0, sortedBackups.length - this.maxBackups);
        backupsToRemove.push(...excessBackups);
      }

      // Remove the backups
      for (const backup of backupsToRemove) {
        try {
          await this.fileManager.deleteFile(backup.filePath);
          
          // Also remove metadata
          const backupId = this.extractBackupIdFromPath(backup.filePath);
          if (backupId) {
            await this.removeBackupMetadata(backupId);
          }
        } catch (error) {
          console.warn(`Failed to remove backup ${backup.filePath}:`, error);
        }
      }
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `Failed to cleanup old backups: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          error
        )
      );
    }
  }

  /**
   * Private methods
   */

  private async calculateChecksum(filePath: string): Promise<string> {
    try {
      // Simple checksum based on file size and modification time
      const fileInfo = await this.fileManager.getFileInfo(filePath);
      return `${fileInfo.fileSize}_${fileInfo.modifiedAt.getTime()}`;
    } catch (error) {
      return 'unknown';
    }
  }

  private async verifyBackupIntegrity(backup: BackupMetadata): Promise<boolean> {
    try {
      const fileInfo = await this.fileManager.getFileInfo(backup.backupFilePath);
      return fileInfo.fileSize === backup.fileSize;
    } catch (error) {
      return false;
    }
  }

  private async saveBackupMetadata(metadata: BackupMetadata): Promise<void> {
    const key = `backup_${metadata.id}`;
    const data = JSON.stringify({
      ...metadata,
      timestamp: metadata.timestamp.toISOString(),
    });
    await AsyncStorage.setItem(key, data);
  }

  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    try {
      const key = `backup_${backupId}`;
      const data = await AsyncStorage.getItem(key);
      
      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data);
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
      };
    } catch (error) {
      return null;
    }
  }

  private async removeBackupMetadata(backupId: string): Promise<void> {
    const key = `backup_${backupId}`;
    await AsyncStorage.removeItem(key);
  }

  private async removeBackup(backupId: string): Promise<void> {
    const metadata = await this.getBackupMetadata(backupId);
    if (metadata) {
      try {
        await this.fileManager.deleteFile(metadata.backupFilePath);
      } catch (error) {
        console.warn(`Failed to delete backup file: ${metadata.backupFilePath}`, error);
      }
      await this.removeBackupMetadata(backupId);
    }
  }

  private async saveOperationHistory(): Promise<void> {
    const data = JSON.stringify(
      Array.from(this.operationHistory.entries()).map(([id, op]) => [
        id,
        {
          ...op,
          timestamp: op.timestamp.toISOString(),
        },
      ])
    );
    await AsyncStorage.setItem('operation_history', data);
  }

  private async loadOperationHistory(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem('operation_history');
      if (data) {
        const parsed = JSON.parse(data);
        this.operationHistory = new Map(
          parsed.map(([id, op]: [string, any]) => [
            id,
            {
              ...op,
              timestamp: new Date(op.timestamp),
            },
          ])
        );
      }
    } catch (error) {
      console.warn('Failed to load operation history:', error);
      this.operationHistory = new Map();
    }
  }

  private async limitOperationHistory(): Promise<void> {
    const maxHistory = 100;
    if (this.operationHistory.size > maxHistory) {
      const operations = Array.from(this.operationHistory.entries())
        .sort(([, a], [, b]) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, maxHistory);
      
      this.operationHistory = new Map(operations);
      await this.saveOperationHistory();
    }
  }

  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractBackupIdFromPath(filePath: string): string | null {
    const fileName = filePath.split('/').pop() || '';
    const match = fileName.match(/^(backup_\d+_[a-z0-9]+)_/);
    return match ? match[1] : null;
  }
}