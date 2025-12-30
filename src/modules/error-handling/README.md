# Error Handling and Recovery System

This module provides a comprehensive error handling and recovery system for the mobile PDF editor application. It includes error categorization, auto-save functionality, backup management, and recovery mechanisms.

## Overview

The error handling system consists of four main components:

1. **ErrorHandler** - Central error handling and user notification system
2. **AutoSaveManager** - Automatic saving of work in progress
3. **BackupManager** - Backup creation and operation rollback capabilities
4. **RecoverySystem** - Comprehensive recovery coordination and system health monitoring

## Components

### ErrorHandler

The `ErrorHandler` is a singleton class that manages all application errors and provides appropriate user feedback.

**Features:**
- Categorized error handling for different error types
- User-friendly error messages with appropriate severity levels
- Error logging and analytics
- Automatic error recovery suggestions

**Usage:**
```typescript
import { ErrorHandler, ErrorFactory } from './modules/error-handling';

const errorHandler = ErrorHandler.getInstance();

// Handle a file system error
const error = ErrorFactory.createFileSystemError(
  'file_not_found',
  'PDF file not found',
  '/path/to/file.pdf'
);
errorHandler.handleFileSystemError(error);
```

**Error Categories:**
- **File System Errors**: Storage issues, file access problems, permissions
- **PDF Processing Errors**: Invalid PDFs, memory limitations, processing failures
- **Validation Errors**: Input validation, format errors, missing fields
- **Network Errors**: Connection issues, server errors (for future use)

### AutoSaveManager

The `AutoSaveManager` automatically saves work in progress to prevent data loss during operations.

**Features:**
- Automatic periodic saving (configurable interval)
- Session-based work tracking
- Recovery from interrupted operations
- Configurable auto-save settings

**Usage:**
```typescript
import { AutoSaveManager } from './modules/error-handling';

const autoSave = AutoSaveManager.getInstance();

// Start a work session
const sessionId = await autoSave.startWorkSession(
  'merge',
  ['/file1.pdf', '/file2.pdf'],
  'Merging PDFs'
);

// Update progress
await autoSave.updateWorkInProgress(
  sessionId,
  { currentStep: 'processing', progress: 50 },
  50
);

// Complete session
await autoSave.completeWorkSession(sessionId);
```

### BackupManager

The `BackupManager` creates backups before destructive operations and enables operation rollback.

**Features:**
- Automatic backup creation before destructive operations
- Operation history tracking
- Rollback capabilities with backup restoration
- Backup cleanup and management

**Usage:**
```typescript
import { BackupManager } from './modules/error-handling';

const backupManager = BackupManager.getInstance();

// Create backup before operation
const backupId = await backupManager.createBackup(
  '/path/to/file.pdf',
  'edit_operation'
);

// Record operation for potential rollback
const operationId = await backupManager.recordOperation(
  'edit',
  ['/original.pdf'],
  ['/edited.pdf'],
  [backupId]
);

// Later, rollback if needed
const success = await backupManager.rollbackOperation(operationId);
```

### RecoverySystem

The `RecoverySystem` coordinates all recovery mechanisms and provides system health monitoring.

**Features:**
- Comprehensive recovery analysis
- Automatic recovery execution
- System health monitoring
- Recovery suggestions based on system state

**Usage:**
```typescript
import { RecoverySystem } from './modules/error-handling';

const recovery = RecoverySystem.getInstance();

// Analyze recovery options
const options = await recovery.analyzeRecoveryOptions();

// Perform automatic recovery
const result = await recovery.performAutoRecovery();

// Check system health
const health = await recovery.getSystemHealth();
```

## Error Types

### FileSystemError
```typescript
interface FileSystemError {
  type: 'file_system';
  category: 'insufficient_storage' | 'file_not_found' | 'permission_denied' | 
           'file_corruption' | 'invalid_path' | 'disk_full' | 'read_only_filesystem';
  code: string;
  message: string;
  filePath?: string;
  timestamp: Date;
  details?: any;
}
```

### PDFError
```typescript
interface PDFError {
  type: 'pdf_processing';
  category: 'invalid_pdf_format' | 'unsupported_feature' | 'memory_limitation' |
           'corrupted_pdf' | 'password_protected' | 'page_not_found' |
           'merge_failed' | 'split_failed' | 'edit_failed' | 'annotation_failed';
  code: string;
  message: string;
  filePath?: string;
  pageNumber?: number;
  timestamp: Date;
  details?: any;
}
```

### ValidationError
```typescript
interface ValidationError {
  type: 'validation';
  category: 'invalid_input' | 'missing_required_field' | 'invalid_format' |
           'out_of_range' | 'duplicate_value' | 'invalid_file_type';
  code: string;
  message: string;
  field?: string;
  value?: any;
  timestamp: Date;
  details?: any;
}
```

## Integration with PDF Operations

The error handling system is designed to integrate seamlessly with PDF operations:

### Example: PDF Merge with Error Handling
```typescript
import { ErrorHandler, AutoSaveManager, BackupManager, RecoverySystem } from './modules/error-handling';
import { PDFEngine } from './modules/pdf-engine';

async function safePDFMerge(filePaths: string[]): Promise<string> {
  const errorHandler = ErrorHandler.getInstance();
  const autoSave = AutoSaveManager.getInstance();
  const backupManager = BackupManager.getInstance();
  const pdfEngine = new PDFEngine();

  try {
    // 1. Start auto-save session
    const sessionId = await autoSave.startWorkSession(
      'merge',
      filePaths,
      'Merging PDF files'
    );

    // 2. Create backups
    const backupIds = await backupManager.createMultipleBackups(
      filePaths,
      'merge_operation'
    );

    // 3. Update progress
    await autoSave.updateWorkInProgress(
      sessionId,
      { selectedFiles: filePaths },
      25
    );

    // 4. Perform merge
    const result = await pdfEngine.mergePDFs(filePaths);

    // 5. Record successful operation
    await backupManager.recordOperation(
      'merge',
      filePaths,
      [result],
      backupIds
    );

    // 6. Complete auto-save session
    await autoSave.completeWorkSession(sessionId);

    return result;

  } catch (error) {
    // Handle errors appropriately
    if (error.type === 'pdf_processing') {
      errorHandler.handlePDFProcessingError(error);
    } else if (error.type === 'file_system') {
      errorHandler.handleFileSystemError(error);
    }

    // Attempt recovery
    const recovery = RecoverySystem.getInstance();
    await recovery.performAutoRecovery();

    throw error;
  }
}
```

## Configuration

### Auto-Save Settings
```typescript
const autoSave = AutoSaveManager.getInstance();

// Configure auto-save interval (default: 30 seconds)
autoSave.setAutoSaveInterval(60000); // 1 minute

// Enable/disable auto-save
autoSave.setAutoSaveEnabled(true);
```

### Error Handler Settings
```typescript
const errorHandler = ErrorHandler.getInstance();

// Get error statistics
const stats = {
  totalErrors: errorHandler.getErrorLog().length,
  recentErrors: errorHandler.getRecentErrors(10),
  criticalErrors: errorHandler.hasCriticalErrors()
};
```

## Recovery Scenarios

### 1. Application Crash Recovery
When the application restarts after a crash:
```typescript
const recovery = RecoverySystem.getInstance();
const options = await recovery.analyzeRecoveryOptions();

if (options.autoSaveSessions.length > 0) {
  // Show recovery dialog to user
  // Allow user to recover unsaved work
}
```

### 2. Storage Full Recovery
When storage is full:
```typescript
const recovery = RecoverySystem.getInstance();
const health = await recovery.getSystemHealth();

if (health.status === 'critical') {
  // Perform storage cleanup
  await recovery.performStorageCleanup();
  
  // Show storage management options to user
}
```

### 3. Operation Failure Recovery
When a PDF operation fails:
```typescript
const backupManager = BackupManager.getInstance();
const undoableOps = backupManager.getUndoableOperations();

if (undoableOps.length > 0) {
  // Offer undo option to user
  const success = await backupManager.rollbackOperation(undoableOps[0].id);
}
```

## Testing

The error handling system includes comprehensive tests:

- **Unit Tests**: Core error handling logic and error factory functions
- **Integration Tests**: Complete error handling workflows with PDF operations
- **Recovery Tests**: Auto-save, backup, and recovery mechanism validation

Run tests:
```bash
npm test -- --testPathPattern="error-handling"
```

## Best Practices

1. **Always use ErrorFactory** to create standardized errors
2. **Start auto-save sessions** for long-running operations
3. **Create backups** before destructive operations
4. **Handle errors at appropriate levels** - don't let errors bubble up unhandled
5. **Provide user feedback** for all error conditions
6. **Monitor system health** regularly
7. **Test error scenarios** thoroughly

## Performance Considerations

- Error logging is limited to prevent memory leaks
- Auto-save operations are throttled to avoid performance impact
- Backup cleanup runs automatically to manage storage
- Recovery analysis is cached to improve performance

## Future Enhancements

- Cloud backup integration
- Advanced error analytics and reporting
- Machine learning-based error prediction
- Cross-device recovery synchronization
- Enhanced user recovery workflows