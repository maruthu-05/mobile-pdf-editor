import { 
  ErrorHandler as IErrorHandler, 
  AppError, 
  FileSystemError, 
  PDFError, 
  ValidationError, 
  NetworkError, 
  ErrorSeverity 
} from '../../types/errors';
// Import will be resolved at runtime
// import { ToastNotification } from '../../components/common/ToastNotification';

/**
 * Comprehensive error handling system for all operation types
 */
export class ErrorHandler implements IErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: AppError[] = [];
  private maxLogSize = 1000;
  // ToastNotification will be injected at runtime
  private toastNotification: any;

  private constructor() {
    // ToastNotification will be injected when available
    this.toastNotification = {
      showInfo: (message: string, duration?: number) => console.log(`INFO: ${message}`),
      showWarning: (message: string, duration?: number) => console.warn(`WARNING: ${message}`),
      showError: (message: string, duration?: number) => console.error(`ERROR: ${message}`),
    };
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle file system errors with appropriate recovery strategies
   */
  handleFileSystemError(error: FileSystemError): void {
    this.logError(error);

    switch (error.category) {
      case 'insufficient_storage':
        this.showErrorMessage(
          'Storage space is running low. Please free up some space and try again.',
          'warning'
        );
        this.suggestStorageCleanup();
        break;

      case 'file_not_found':
        this.showErrorMessage(
          'The requested file could not be found. It may have been moved or deleted.',
          'error'
        );
        this.suggestFileRecovery(error.filePath);
        break;

      case 'permission_denied':
        this.showErrorMessage(
          'Permission denied. Please check file permissions and try again.',
          'error'
        );
        break;

      case 'file_corruption':
        this.showErrorMessage(
          'The file appears to be corrupted. Please try with a different file.',
          'error'
        );
        this.suggestFileRecovery(error.filePath);
        break;

      case 'disk_full':
        this.showErrorMessage(
          'Storage is full. Please free up space before continuing.',
          'critical'
        );
        this.suggestStorageCleanup();
        break;

      case 'read_only_filesystem':
        this.showErrorMessage(
          'Cannot write to this location. The file system is read-only.',
          'error'
        );
        break;

      default:
        this.showErrorMessage(
          `File system error: ${error.message}`,
          'error'
        );
    }
  }

  /**
   * Handle PDF processing errors with fallback options
   */
  handlePDFProcessingError(error: PDFError): void {
    this.logError(error);

    switch (error.category) {
      case 'invalid_pdf_format':
        this.showErrorMessage(
          'This file is not a valid PDF or is corrupted. Please try with a different file.',
          'error'
        );
        break;

      case 'unsupported_feature':
        this.showErrorMessage(
          'This PDF contains features that are not currently supported. Some operations may not work as expected.',
          'warning'
        );
        break;

      case 'memory_limitation':
        this.showErrorMessage(
          'This PDF is too large to process. Try splitting it into smaller files first.',
          'warning'
        );
        this.suggestMemoryOptimization();
        break;

      case 'password_protected':
        this.showErrorMessage(
          'This PDF is password protected. Password-protected PDFs are not currently supported.',
          'info'
        );
        break;

      case 'page_not_found':
        this.showErrorMessage(
          `Page ${error.pageNumber} not found in the document.`,
          'error'
        );
        break;

      case 'merge_failed':
        this.showErrorMessage(
          'Failed to merge PDFs. Please check that all files are valid and try again.',
          'error'
        );
        break;

      case 'split_failed':
        this.showErrorMessage(
          'Failed to split PDF. Please check the page ranges and try again.',
          'error'
        );
        break;

      case 'edit_failed':
        this.showErrorMessage(
          'Failed to edit PDF. This document may not support text editing.',
          'warning'
        );
        break;

      case 'annotation_failed':
        this.showErrorMessage(
          'Failed to add annotations. Please try again.',
          'error'
        );
        break;

      default:
        this.showErrorMessage(
          `PDF processing error: ${error.message}`,
          'error'
        );
    }
  }

  /**
   * Handle validation errors with user guidance
   */
  handleValidationError(error: ValidationError): void {
    this.logError(error);

    switch (error.category) {
      case 'invalid_input':
        this.showErrorMessage(
          `Invalid input: ${error.message}`,
          'warning'
        );
        break;

      case 'missing_required_field':
        this.showErrorMessage(
          `Required field missing: ${error.field}`,
          'warning'
        );
        break;

      case 'invalid_format':
        this.showErrorMessage(
          `Invalid format for ${error.field}: ${error.message}`,
          'warning'
        );
        break;

      case 'out_of_range':
        this.showErrorMessage(
          `Value out of range: ${error.message}`,
          'warning'
        );
        break;

      case 'duplicate_value':
        this.showErrorMessage(
          `Duplicate value detected: ${error.message}`,
          'warning'
        );
        break;

      case 'invalid_file_type':
        this.showErrorMessage(
          'Please select a valid PDF file.',
          'warning'
        );
        break;

      default:
        this.showErrorMessage(
          `Validation error: ${error.message}`,
          'warning'
        );
    }
  }

  /**
   * Handle network errors (for future use)
   */
  handleNetworkError(error: NetworkError): void {
    this.logError(error);

    switch (error.category) {
      case 'connection_failed':
        this.showErrorMessage(
          'Connection failed. Please check your internet connection.',
          'warning'
        );
        break;

      case 'timeout':
        this.showErrorMessage(
          'Request timed out. Please try again.',
          'warning'
        );
        break;

      case 'server_error':
        this.showErrorMessage(
          'Server error occurred. Please try again later.',
          'error'
        );
        break;

      case 'unauthorized':
        this.showErrorMessage(
          'Unauthorized access. Please check your credentials.',
          'error'
        );
        break;

      case 'not_found':
        this.showErrorMessage(
          'Resource not found.',
          'error'
        );
        break;

      case 'rate_limited':
        this.showErrorMessage(
          'Too many requests. Please wait a moment and try again.',
          'warning'
        );
        break;

      default:
        this.showErrorMessage(
          `Network error: ${error.message}`,
          'error'
        );
    }
  }

  /**
   * Show error message to user with appropriate severity
   */
  showErrorMessage(message: string, severity: ErrorSeverity): void {
    const duration = this.getDurationBySeverity(severity);
    
    switch (severity) {
      case 'info':
        this.toastNotification.showInfo(message, duration);
        break;
      case 'warning':
        this.toastNotification.showWarning(message, duration);
        break;
      case 'error':
        this.toastNotification.showError(message, duration);
        break;
      case 'critical':
        this.toastNotification.showError(message, 0); // Don't auto-dismiss critical errors
        break;
    }
  }

  /**
   * Log error for debugging and analytics
   */
  logError(error: AppError): void {
    // Add to in-memory log
    this.errorLog.push(error);

    // Maintain log size limit
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Log to console for development
    console.error(`[${error.type}] ${error.code}: ${error.message}`, error);

    // In production, you might want to send to analytics service
    // this.sendToAnalytics(error);
  }

  /**
   * Get error log for debugging
   */
  getErrorLog(): AppError[] {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Get errors by type
   */
  getErrorsByType(type: AppError['type']): AppError[] {
    return this.errorLog.filter(error => error.type === type);
  }

  /**
   * Get recent errors (last N errors)
   */
  getRecentErrors(count: number = 10): AppError[] {
    return this.errorLog.slice(-count);
  }

  /**
   * Check if there are any critical errors
   */
  hasCriticalErrors(): boolean {
    return this.errorLog.some(error => 
      error.type === 'file_system' && 
      ['disk_full', 'file_corruption'].includes((error as FileSystemError).category)
    );
  }

  /**
   * Private helper methods
   */

  private getDurationBySeverity(severity: ErrorSeverity): number {
    switch (severity) {
      case 'info': return 3000;
      case 'warning': return 5000;
      case 'error': return 7000;
      case 'critical': return 0; // Don't auto-dismiss
      default: return 5000;
    }
  }

  private suggestStorageCleanup(): void {
    // This could trigger a storage cleanup dialog or navigation
    console.log('Suggesting storage cleanup to user');
  }

  private suggestFileRecovery(filePath?: string): void {
    // This could trigger a file recovery dialog
    console.log('Suggesting file recovery options', filePath);
  }

  private suggestMemoryOptimization(): void {
    // This could trigger memory optimization suggestions
    console.log('Suggesting memory optimization strategies');
  }
}