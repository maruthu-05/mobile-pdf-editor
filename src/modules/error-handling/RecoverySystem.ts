import { ErrorHandler } from './ErrorHandler';
import { AutoSaveManager, AutoSaveData } from './AutoSaveManager';
import { BackupManager, OperationHistory } from './BackupManager';
import { FileManager } from '../file-manager/FileManager';
import { ErrorFactory } from '../../types/errors';

/**
 * Interface for recovery options
 */
export interface RecoveryOptions {
  autoSaveSessions: AutoSaveData[];
  undoableOperations: OperationHistory[];
  corruptedFiles: string[];
  suggestions: RecoverySuggestion[];
}

/**
 * Interface for recovery suggestions
 */
export interface RecoverySuggestion {
  type: 'auto_save' | 'backup_restore' | 'file_recovery' | 'storage_cleanup';
  title: string;
  description: string;
  action: () => Promise<boolean>;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Comprehensive recovery system that coordinates error handling, auto-save, and backups
 */
export class RecoverySystem {
  private static instance: RecoverySystem;
  private errorHandler: ErrorHandler;
  private autoSaveManager: AutoSaveManager;
  private backupManager: BackupManager;
  private fileManager: FileManager;

  private constructor() {
    this.errorHandler = ErrorHandler.getInstance();
    this.autoSaveManager = AutoSaveManager.getInstance();
    this.backupManager = BackupManager.getInstance();
    this.fileManager = new FileManager();
  }

  static getInstance(): RecoverySystem {
    if (!RecoverySystem.instance) {
      RecoverySystem.instance = new RecoverySystem();
    }
    return RecoverySystem.instance;
  }

  /**
   * Analyze system state and provide recovery options
   */
  async analyzeRecoveryOptions(): Promise<RecoveryOptions> {
    try {
      const [autoSaveSessions, undoableOperations, corruptedFiles] = await Promise.all([
        this.autoSaveManager.getAutoSaveSessions(),
        this.backupManager.getUndoableOperations(),
        this.detectCorruptedFiles(),
      ]);

      const suggestions = await this.generateRecoverySuggestions(
        autoSaveSessions,
        undoableOperations,
        corruptedFiles
      );

      return {
        autoSaveSessions,
        undoableOperations,
        corruptedFiles,
        suggestions,
      };
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `Failed to analyze recovery options: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          error
        )
      );
      
      return {
        autoSaveSessions: [],
        undoableOperations: [],
        corruptedFiles: [],
        suggestions: [],
      };
    }
  }

  /**
   * Perform automatic recovery based on available options
   */
  async performAutoRecovery(): Promise<{
    success: boolean;
    recoveredFiles: string[];
    errors: string[];
  }> {
    const recoveredFiles: string[] = [];
    const errors: string[] = [];

    try {
      // 1. Recover from auto-save sessions
      const autoSaveSessions = await this.autoSaveManager.getAutoSaveSessions();
      for (const session of autoSaveSessions.slice(0, 5)) { // Limit to 5 most recent
        try {
          const recovered = await this.recoverFromAutoSave(session.id);
          if (recovered) {
            recoveredFiles.push(`Auto-save session: ${session.metadata.operation}`);
          }
        } catch (error) {
          errors.push(`Failed to recover auto-save session ${session.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 2. Check for corrupted files and suggest alternatives
      const corruptedFiles = await this.detectCorruptedFiles();
      for (const filePath of corruptedFiles) {
        try {
          const recovered = await this.attemptFileRecovery(filePath);
          if (recovered) {
            recoveredFiles.push(`Recovered file: ${filePath}`);
          }
        } catch (error) {
          errors.push(`Failed to recover file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 3. Clean up storage if needed
      try {
        const cleaned = await this.performStorageCleanup();
        if (cleaned) {
          recoveredFiles.push('Storage cleanup completed');
        }
      } catch (error) {
        errors.push(`Storage cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      return {
        success: recoveredFiles.length > 0,
        recoveredFiles,
        errors,
      };
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `Auto recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          error
        )
      );

      return {
        success: false,
        recoveredFiles,
        errors: [...errors, error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Recover work from an auto-save session
   */
  async recoverFromAutoSave(sessionId: string): Promise<boolean> {
    try {
      const session = await this.autoSaveManager.recoverWorkSession(sessionId);
      if (!session) {
        return false;
      }

      // Validate that original files still exist
      const validFiles: string[] = [];
      for (const filePath of session.originalFiles) {
        const exists = await this.fileManager.fileExists(filePath);
        if (exists) {
          validFiles.push(filePath);
        }
      }

      if (validFiles.length === 0) {
        // No original files exist, cannot recover
        await this.autoSaveManager.completeWorkSession(sessionId);
        return false;
      }

      // Create a recovery notification or dialog
      this.errorHandler.showErrorMessage(
        `Found unsaved work: ${session.metadata.operation}. Would you like to recover it?`,
        'info'
      );

      return true;
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `Failed to recover from auto-save: ${error instanceof Error ? error.message : 'Unknown error'}`,
          sessionId,
          error
        )
      );
      return false;
    }
  }

  /**
   * Undo the last operation
   */
  async undoLastOperation(): Promise<boolean> {
    try {
      const undoableOps = this.backupManager.getUndoableOperations();
      if (undoableOps.length === 0) {
        this.errorHandler.showErrorMessage('No operations available to undo.', 'info');
        return false;
      }

      const lastOperation = undoableOps[0];
      const success = await this.backupManager.rollbackOperation(lastOperation.id);
      
      if (success) {
        this.errorHandler.showErrorMessage(
          `Successfully undone: ${lastOperation.type} operation`,
          'info'
        );
      } else {
        this.errorHandler.showErrorMessage(
          'Failed to undo the last operation.',
          'error'
        );
      }

      return success;
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `Failed to undo operation: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          error
        )
      );
      return false;
    }
  }

  /**
   * Attempt to recover a corrupted file
   */
  async attemptFileRecovery(filePath: string): Promise<boolean> {
    try {
      // Check if file exists
      const exists = await this.fileManager.fileExists(filePath);
      if (!exists) {
        return false;
      }

      // Try to get file info to check if it's readable
      try {
        await this.fileManager.getFileInfo(filePath);
        return true; // File is readable, not corrupted
      } catch (error) {
        // File might be corrupted, try recovery strategies
      }

      // Strategy 1: Look for backups
      const operations = this.backupManager.getOperationHistory();
      for (const operation of operations) {
        if (operation.originalFiles.includes(filePath) || operation.resultFiles.includes(filePath)) {
          for (const backupId of operation.backupIds) {
            try {
              const restored = await this.backupManager.restoreFromBackup(backupId);
              if (restored === filePath) {
                return true;
              }
            } catch (error) {
              continue; // Try next backup
            }
          }
        }
      }

      // Strategy 2: Look for auto-save sessions
      const autoSaves = await this.autoSaveManager.getAutoSaveSessions();
      for (const session of autoSaves) {
        if (session.originalFiles.includes(filePath)) {
          // Found a session that worked with this file
          return await this.recoverFromAutoSave(session.id);
        }
      }

      return false;
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `File recovery attempt failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          filePath,
          error
        )
      );
      return false;
    }
  }

  /**
   * Perform storage cleanup to free up space
   */
  async performStorageCleanup(): Promise<boolean> {
    try {
      let cleanedUp = false;

      // Clean up old backups
      await this.backupManager.cleanupOldBackups();
      cleanedUp = true;

      // Clean up old auto-save sessions
      await this.autoSaveManager.cleanupOldSessions();
      cleanedUp = true;

      // Clean up temporary files (if any)
      try {
        const cacheDir = await this.fileManager.getCacheDirectory();
        const tempFiles = await this.fileManager.listFiles(cacheDir);
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        for (const file of tempFiles) {
          if (now - file.createdAt.getTime() > maxAge) {
            try {
              await this.fileManager.deleteFile(file.filePath);
              cleanedUp = true;
            } catch (error) {
              // Ignore individual file deletion errors
            }
          }
        }
      } catch (error) {
        // Ignore cache cleanup errors
      }

      return cleanedUp;
    } catch (error) {
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'file_corruption',
          `Storage cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          error
        )
      );
      return false;
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check storage space
      const availableSpace = await this.fileManager.getAvailableSpace();
      const usedSpace = await this.fileManager.getUsedSpace();
      const totalSpace = availableSpace + usedSpace;
      const usagePercentage = (usedSpace / totalSpace) * 100;

      if (usagePercentage > 90) {
        issues.push('Storage space critically low');
        recommendations.push('Free up storage space immediately');
      } else if (usagePercentage > 75) {
        issues.push('Storage space running low');
        recommendations.push('Consider cleaning up old files');
      }

      // Check for critical errors
      if (this.errorHandler.hasCriticalErrors()) {
        issues.push('Critical errors detected in error log');
        recommendations.push('Review error log and address critical issues');
      }

      // Check backup system
      const backupInfo = await this.backupManager.getBackupInfo();
      if (backupInfo.totalBackups === 0) {
        issues.push('No backups available');
        recommendations.push('Backups will be created automatically for future operations');
      }

      // Check auto-save system
      const autoSaveStats = this.autoSaveManager.getAutoSaveStats();
      if (!autoSaveStats.autoSaveEnabled) {
        issues.push('Auto-save is disabled');
        recommendations.push('Enable auto-save for better data protection');
      }

      // Determine overall status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (issues.some(issue => issue.includes('critically') || issue.includes('Critical'))) {
        status = 'critical';
      } else if (issues.length > 0) {
        status = 'warning';
      }

      return { status, issues, recommendations };
    } catch (error) {
      return {
        status: 'critical',
        issues: ['Failed to assess system health'],
        recommendations: ['Restart the application and try again'],
      };
    }
  }

  /**
   * Private methods
   */

  private async detectCorruptedFiles(): Promise<string[]> {
    const corruptedFiles: string[] = [];

    try {
      const documentsDir = await this.fileManager.getDocumentsDirectory();
      const files = await this.fileManager.listFiles(documentsDir, '.pdf');

      for (const file of files) {
        try {
          // Try to read file info - if this fails, file might be corrupted
          await this.fileManager.getFileInfo(file.filePath);
          
          // Additional PDF-specific validation could be added here
          // For now, we assume if we can get file info, it's not corrupted
        } catch (error) {
          corruptedFiles.push(file.filePath);
        }
      }
    } catch (error) {
      // If we can't even list files, there's a bigger problem
      this.errorHandler.logError(
        ErrorFactory.createFileSystemError(
          'permission_denied',
          `Failed to detect corrupted files: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          error
        )
      );
    }

    return corruptedFiles;
  }

  private async generateRecoverySuggestions(
    autoSaveSessions: AutoSaveData[],
    undoableOperations: OperationHistory[],
    corruptedFiles: string[]
  ): Promise<RecoverySuggestion[]> {
    const suggestions: RecoverySuggestion[] = [];

    // Auto-save recovery suggestions
    if (autoSaveSessions.length > 0) {
      suggestions.push({
        type: 'auto_save',
        title: 'Recover Unsaved Work',
        description: `Found ${autoSaveSessions.length} unsaved work session(s)`,
        action: async () => {
          let recovered = false;
          for (const session of autoSaveSessions.slice(0, 3)) {
            const result = await this.recoverFromAutoSave(session.id);
            if (result) recovered = true;
          }
          return recovered;
        },
        priority: 'high',
      });
    }

    // Undo operation suggestions
    if (undoableOperations.length > 0) {
      suggestions.push({
        type: 'backup_restore',
        title: 'Undo Last Operation',
        description: `Undo the last ${undoableOperations[0].type} operation`,
        action: async () => this.undoLastOperation(),
        priority: 'medium',
      });
    }

    // File recovery suggestions
    if (corruptedFiles.length > 0) {
      suggestions.push({
        type: 'file_recovery',
        title: 'Recover Corrupted Files',
        description: `Attempt to recover ${corruptedFiles.length} corrupted file(s)`,
        action: async () => {
          let recovered = false;
          for (const filePath of corruptedFiles) {
            const result = await this.attemptFileRecovery(filePath);
            if (result) recovered = true;
          }
          return recovered;
        },
        priority: 'high',
      });
    }

    // Storage cleanup suggestions
    const availableSpace = await this.fileManager.getAvailableSpace();
    const usedSpace = await this.fileManager.getUsedSpace();
    const usagePercentage = (usedSpace / (availableSpace + usedSpace)) * 100;

    if (usagePercentage > 75) {
      suggestions.push({
        type: 'storage_cleanup',
        title: 'Clean Up Storage',
        description: `Free up storage space (${usagePercentage.toFixed(1)}% used)`,
        action: async () => this.performStorageCleanup(),
        priority: usagePercentage > 90 ? 'high' : 'medium',
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
}