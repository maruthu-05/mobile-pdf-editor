// Error handling module exports
export { ErrorHandler } from './ErrorHandler';
export { AutoSaveManager, type AutoSaveData } from './AutoSaveManager';
export { BackupManager, type BackupMetadata, type OperationHistory } from './BackupManager';
export { RecoverySystem, type RecoveryOptions, type RecoverySuggestion } from './RecoverySystem';

// Re-export error types for convenience
export {
  type AppError,
  type FileSystemError,
  type PDFError,
  type ValidationError,
  type NetworkError,
  type ErrorSeverity,
  ErrorFactory,
} from '../../types/errors';