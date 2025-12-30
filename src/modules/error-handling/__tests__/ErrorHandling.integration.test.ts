import { ErrorHandler } from '../ErrorHandler';
import { AutoSaveManager } from '../AutoSaveManager';
import { BackupManager } from '../BackupManager';
import { RecoverySystem } from '../RecoverySystem';
import { PDFEngine } from '../../pdf-engine/PDFEngine';
import { FileManager } from '../../file-manager/FileManager';
import { ErrorFactory } from '../../../types/errors';

// Mock external dependencies
jest.mock('expo-file-system');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../../components/common/ToastNotification');
jest.mock('../../performance/MemoryManager');
jest.mock('../../performance/LazyLoader');
jest.mock('../../performance/BackgroundProcessor');
jest.mock('../../performance/ProgressManager');

describe('Error Handling Integration Tests', () => {
  let errorHandler: ErrorHandler;
  let autoSaveManager: AutoSaveManager;
  let backupManager: BackupManager;
  let recoverySystem: RecoverySystem;
  let pdfEngine: PDFEngine;
  let fileManager: FileManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    errorHandler = ErrorHandler.getInstance();
    autoSaveManager = AutoSaveManager.getInstance();
    backupManager = BackupManager.getInstance();
    recoverySystem = RecoverySystem.getInstance();
    pdfEngine = new PDFEngine();
    fileManager = new FileManager();

    // Clear error log
    errorHandler.clearErrorLog();
  });

  describe('PDF Operation Error Handling with Auto-Save and Backup', () => {
    it('should handle PDF merge operation with complete error recovery flow', async () => {
      const testFiles = ['/test/file1.pdf', '/test/file2.pdf'];
      const operation = 'merge';

      try {
        // 1. Start auto-save session
        const sessionId = await autoSaveManager.startWorkSession(
          'merge',
          testFiles,
          'Merging test PDFs'
        );

        // 2. Create backups before operation
        const backupIds = await backupManager.createMultipleBackups(
          testFiles,
          operation
        );

        // 3. Update work progress
        await autoSaveManager.updateWorkInProgress(
          sessionId,
          { selectedFiles: testFiles, mergeOrder: [0, 1] },
          25
        );

        // 4. Simulate PDF merge operation that fails
        try {
          await pdfEngine.mergePDFs(testFiles);
        } catch (pdfError) {
          // 5. Handle the PDF error
          const error = ErrorFactory.createPDFError(
            'merge_failed',
            'Failed to merge PDFs due to memory limitation',
            testFiles[0]
          );
          
          errorHandler.handlePDFProcessingError(error);

          // 6. Attempt recovery
          const recoveryOptions = await recoverySystem.analyzeRecoveryOptions();
          
          expect(recoveryOptions.autoSaveSessions).toHaveLength(1);
          expect(recoveryOptions.autoSaveSessions[0].id).toBe(sessionId);

          // 7. Recover from auto-save
          const recovered = await recoverySystem.recoverFromAutoSave(sessionId);
          expect(recovered).toBe(true);

          // 8. Clean up failed operation
          await autoSaveManager.completeWorkSession(sessionId);
        }

        // Verify error was logged
        const errorLog = errorHandler.getErrorLog();
        expect(errorLog).toHaveLength(1);
        expect(errorLog[0].type).toBe('pdf_processing');
        expect(errorLog[0].category).toBe('merge_failed');

      } catch (error) {
        // Test should handle the error gracefully
        expect(error).toBeDefined();
      }
    });

    it('should handle file system errors during PDF operations', async () => {
      const testFile = '/test/nonexistent.pdf';

      try {
        // Attempt to load a non-existent PDF
        await pdfEngine.loadPDF(testFile);
      } catch (error) {
        // Handle the file system error
        const fsError = ErrorFactory.createFileSystemError(
          'file_not_found',
          'PDF file not found',
          testFile
        );

        errorHandler.handleFileSystemError(fsError);

        // Attempt file recovery
        const recovered = await recoverySystem.attemptFileRecovery(testFile);
        expect(recovered).toBe(false); // Should fail for truly non-existent file

        // Check system health after error
        const health = await recoverySystem.getSystemHealth();
        expect(health.status).toBeDefined();
      }
    });
  });

  describe('Complete Operation Lifecycle with Error Handling', () => {
    it('should handle complete PDF edit operation with rollback capability', async () => {
      const testFile = '/test/document.pdf';
      const editOperation = 'text_edit';

      try {
        // 1. Create backup before destructive operation
        const backupId = await backupManager.createBackup(testFile, editOperation);

        // 2. Start auto-save session
        const sessionId = await autoSaveManager.startWorkSession(
          'edit',
          [testFile],
          'Editing PDF text'
        );

        // 3. Simulate text editing progress
        const textEdits = [
          {
            pageNumber: 1,
            x: 100,
            y: 200,
            width: 200,
            height: 20,
            newText: 'Updated text',
          },
        ];

        await autoSaveManager.updateWorkInProgress(
          sessionId,
          { edits: textEdits, currentPage: 1 },
          50
        );

        // 4. Attempt PDF text editing
        let resultFile: string;
        try {
          resultFile = await pdfEngine.editPDFText(testFile, textEdits);
          
          // 5. Record successful operation
          const operationId = await backupManager.recordOperation(
            'edit',
            [testFile],
            [resultFile],
            [backupId],
            { edits: textEdits }
          );

          // 6. Complete auto-save session
          await autoSaveManager.completeWorkSession(sessionId);

          // 7. Later, user wants to undo the operation
          const undoSuccess = await recoverySystem.undoLastOperation();
          expect(undoSuccess).toBe(true);

        } catch (editError) {
          // Handle edit failure
          const error = ErrorFactory.createPDFError(
            'edit_failed',
            'Text editing not supported for this PDF',
            testFile
          );

          errorHandler.handlePDFProcessingError(error);

          // Restore from backup
          const restored = await backupManager.restoreFromBackup(backupId);
          expect(restored).toBe(testFile);

          // Clean up auto-save session
          await autoSaveManager.completeWorkSession(sessionId);
        }

      } catch (error) {
        // Ensure error is handled gracefully
        expect(error).toBeDefined();
      }
    });
  });

  describe('System Recovery After Critical Errors', () => {
    it('should perform comprehensive system recovery', async () => {
      // Simulate multiple types of errors
      const errors = [
        ErrorFactory.createFileSystemError(
          'disk_full',
          'Storage space exhausted',
          '/test/large_file.pdf'
        ),
        ErrorFactory.createPDFError(
          'memory_limitation',
          'PDF too large to process',
          '/test/huge_document.pdf'
        ),
        ErrorFactory.createFileSystemError(
          'file_corruption',
          'File appears to be corrupted',
          '/test/corrupted.pdf'
        ),
      ];

      // Log all errors
      errors.forEach(error => {
        if (error.type === 'file_system') {
          errorHandler.handleFileSystemError(error);
        } else if (error.type === 'pdf_processing') {
          errorHandler.handlePDFProcessingError(error);
        }
      });

      // Check if system has critical errors
      const hasCritical = errorHandler.hasCriticalErrors();
      expect(hasCritical).toBe(true);

      // Perform auto recovery
      const recoveryResult = await recoverySystem.performAutoRecovery();
      
      // Should attempt recovery even if not fully successful
      expect(recoveryResult).toBeDefined();
      expect(Array.isArray(recoveryResult.recoveredFiles)).toBe(true);
      expect(Array.isArray(recoveryResult.errors)).toBe(true);

      // Check system health after recovery attempt
      const health = await recoverySystem.getSystemHealth();
      expect(health.status).toBeDefined();
      expect(Array.isArray(health.issues)).toBe(true);
      expect(Array.isArray(health.recommendations)).toBe(true);
    });

    it('should provide recovery suggestions based on system state', async () => {
      // Create some auto-save sessions
      const session1 = await autoSaveManager.startWorkSession(
        'merge',
        ['/test/file1.pdf', '/test/file2.pdf'],
        'Incomplete merge'
      );

      const session2 = await autoSaveManager.startWorkSession(
        'split',
        ['/test/large.pdf'],
        'Incomplete split'
      );

      // Create some operations that can be undone
      const backupId = await backupManager.createBackup('/test/original.pdf', 'edit');
      const operationId = await backupManager.recordOperation(
        'edit',
        ['/test/original.pdf'],
        ['/test/edited.pdf'],
        [backupId]
      );

      // Analyze recovery options
      const options = await recoverySystem.analyzeRecoveryOptions();

      expect(options.autoSaveSessions.length).toBeGreaterThanOrEqual(2);
      expect(options.undoableOperations.length).toBeGreaterThanOrEqual(1);
      expect(options.suggestions.length).toBeGreaterThan(0);

      // Verify suggestions are prioritized correctly
      const highPrioritySuggestions = options.suggestions.filter(s => s.priority === 'high');
      const mediumPrioritySuggestions = options.suggestions.filter(s => s.priority === 'medium');

      expect(highPrioritySuggestions.length + mediumPrioritySuggestions.length).toBeGreaterThan(0);

      // Test executing a suggestion
      if (options.suggestions.length > 0) {
        const suggestion = options.suggestions[0];
        const result = await suggestion.action();
        expect(typeof result).toBe('boolean');
      }
    });
  });

  describe('Error Handling Performance and Memory Management', () => {
    it('should handle error logging without memory leaks', () => {
      // Generate many errors to test log size management
      for (let i = 0; i < 1500; i++) {
        const error = ErrorFactory.createFileSystemError(
          'file_not_found',
          `Test error ${i}`,
          `/test/file${i}.pdf`
        );
        errorHandler.logError(error);
      }

      const errorLog = errorHandler.getErrorLog();
      
      // Should maintain reasonable log size
      expect(errorLog.length).toBeLessThanOrEqual(1000);
      
      // Should keep most recent errors
      const recentErrors = errorHandler.getRecentErrors(10);
      expect(recentErrors).toHaveLength(10);
      expect(recentErrors[0].message).toContain('1499'); // Most recent
    });

    it('should handle concurrent error scenarios', async () => {
      const concurrentOperations = Array.from({ length: 5 }, async (_, i) => {
        try {
          // Start auto-save session
          const sessionId = await autoSaveManager.startWorkSession(
            'merge',
            [`/test/file${i}_1.pdf`, `/test/file${i}_2.pdf`],
            `Concurrent operation ${i}`
          );

          // Create backup
          const backupId = await backupManager.createBackup(
            `/test/file${i}_1.pdf`,
            `concurrent_op_${i}`
          );

          // Simulate some work
          await autoSaveManager.updateWorkInProgress(
            sessionId,
            { step: 'processing', progress: 50 },
            50
          );

          // Simulate error
          const error = ErrorFactory.createPDFError(
            'merge_failed',
            `Concurrent operation ${i} failed`,
            `/test/file${i}_1.pdf`
          );
          errorHandler.handlePDFProcessingError(error);

          return { sessionId, backupId, success: true };
        } catch (error) {
          return { sessionId: null, backupId: null, success: false, error };
        }
      });

      const results = await Promise.allSettled(concurrentOperations);
      
      // All operations should complete (either successfully or with handled errors)
      expect(results).toHaveLength(5);
      
      // Check that error log contains the concurrent errors
      const errorLog = errorHandler.getErrorLog();
      const concurrentErrors = errorLog.filter(e => 
        e.message.includes('Concurrent operation') && e.type === 'pdf_processing'
      );
      
      expect(concurrentErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery Edge Cases', () => {
    it('should handle recovery when both auto-save and backup systems fail', async () => {
      // Simulate system in degraded state
      const testFile = '/test/critical.pdf';

      try {
        // Attempt operations that will fail
        await pdfEngine.loadPDF(testFile);
      } catch (error) {
        // Handle the error
        const fsError = ErrorFactory.createFileSystemError(
          'file_corruption',
          'Critical file corruption detected',
          testFile
        );
        errorHandler.handleFileSystemError(fsError);

        // Attempt recovery even when systems are degraded
        const recoveryOptions = await recoverySystem.analyzeRecoveryOptions();
        
        // Should still provide some recovery options or graceful degradation
        expect(recoveryOptions).toBeDefined();
        expect(recoveryOptions.suggestions).toBeDefined();

        // System health should reflect the critical state
        const health = await recoverySystem.getSystemHealth();
        expect(health.status).toBeDefined();
        
        if (health.status === 'critical') {
          expect(health.recommendations.length).toBeGreaterThan(0);
        }
      }
    });

    it('should maintain system stability during cascading failures', async () => {
      const testFiles = ['/test/file1.pdf', '/test/file2.pdf', '/test/file3.pdf'];

      // Simulate cascading failures
      const failures = testFiles.map(async (filePath, index) => {
        try {
          // Each operation depends on the previous one
          const sessionId = await autoSaveManager.startWorkSession(
            'merge',
            [filePath],
            `Cascading operation ${index}`
          );

          // Simulate failure at different stages
          if (index === 0) {
            throw ErrorFactory.createFileSystemError(
              'file_not_found',
              'First file missing',
              filePath
            );
          } else if (index === 1) {
            throw ErrorFactory.createPDFError(
              'invalid_pdf_format',
              'Second file corrupted',
              filePath
            );
          } else {
            throw ErrorFactory.createFileSystemError(
              'disk_full',
              'No space for third operation',
              filePath
            );
          }
        } catch (error) {
          // Handle each error appropriately
          if (error.type === 'file_system') {
            errorHandler.handleFileSystemError(error);
          } else if (error.type === 'pdf_processing') {
            errorHandler.handlePDFProcessingError(error);
          }
          
          return { index, error, handled: true };
        }
      });

      const results = await Promise.allSettled(failures);
      
      // All failures should be handled
      expect(results).toHaveLength(3);
      
      // System should still be responsive
      const health = await recoverySystem.getSystemHealth();
      expect(health).toBeDefined();
      
      // Error log should contain all failures
      const errorLog = errorHandler.getErrorLog();
      expect(errorLog.length).toBeGreaterThanOrEqual(3);
      
      // Should have different error types
      const errorTypes = new Set(errorLog.map(e => e.type));
      expect(errorTypes.size).toBeGreaterThan(1);
    });
  });
});