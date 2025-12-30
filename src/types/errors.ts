// Error handling types and interfaces

/**
 * Base error interface for all application errors
 */
export interface BaseError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

/**
 * File system error categories
 */
export interface FileSystemError extends BaseError {
  type: 'file_system';
  category: 
    | 'insufficient_storage'
    | 'file_not_found'
    | 'permission_denied'
    | 'file_corruption'
    | 'invalid_path'
    | 'disk_full'
    | 'read_only_filesystem';
  filePath?: string;
}

/**
 * PDF processing error categories
 */
export interface PDFError extends BaseError {
  type: 'pdf_processing';
  category:
    | 'invalid_pdf_format'
    | 'unsupported_feature'
    | 'memory_limitation'
    | 'corrupted_pdf'
    | 'password_protected'
    | 'page_not_found'
    | 'merge_failed'
    | 'split_failed'
    | 'edit_failed'
    | 'annotation_failed';
  filePath?: string;
  pageNumber?: number;
}

/**
 * Validation error categories
 */
export interface ValidationError extends BaseError {
  type: 'validation';
  category:
    | 'invalid_input'
    | 'missing_required_field'
    | 'invalid_format'
    | 'out_of_range'
    | 'duplicate_value'
    | 'invalid_file_type';
  field?: string;
  value?: any;
}

/**
 * Network error categories (for future use)
 */
export interface NetworkError extends BaseError {
  type: 'network';
  category:
    | 'connection_failed'
    | 'timeout'
    | 'server_error'
    | 'unauthorized'
    | 'not_found'
    | 'rate_limited';
  statusCode?: number;
  url?: string;
}

/**
 * Union type for all application errors
 */
export type AppError = FileSystemError | PDFError | ValidationError | NetworkError;

/**
 * Error severity levels
 */
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Error handler interface
 */
export interface ErrorHandler {
  handleFileSystemError(error: FileSystemError): void;
  handlePDFProcessingError(error: PDFError): void;
  handleValidationError(error: ValidationError): void;
  handleNetworkError(error: NetworkError): void;
  showErrorMessage(message: string, severity: ErrorSeverity): void;
  logError(error: AppError): void;
}

/**
 * Error factory functions
 */
export class ErrorFactory {
  static createFileSystemError(
    category: FileSystemError['category'],
    message: string,
    filePath?: string,
    details?: any
  ): FileSystemError {
    return {
      type: 'file_system',
      code: `FS_${category.toUpperCase()}`,
      category,
      message,
      filePath,
      details,
      timestamp: new Date(),
    };
  }

  static createPDFError(
    category: PDFError['category'],
    message: string,
    filePath?: string,
    pageNumber?: number,
    details?: any
  ): PDFError {
    return {
      type: 'pdf_processing',
      code: `PDF_${category.toUpperCase()}`,
      category,
      message,
      filePath,
      pageNumber,
      details,
      timestamp: new Date(),
    };
  }

  static createValidationError(
    category: ValidationError['category'],
    message: string,
    field?: string,
    value?: any,
    details?: any
  ): ValidationError {
    return {
      type: 'validation',
      code: `VAL_${category.toUpperCase()}`,
      category,
      message,
      field,
      value,
      details,
      timestamp: new Date(),
    };
  }

  static createNetworkError(
    category: NetworkError['category'],
    message: string,
    statusCode?: number,
    url?: string,
    details?: any
  ): NetworkError {
    return {
      type: 'network',
      code: `NET_${category.toUpperCase()}`,
      category,
      message,
      statusCode,
      url,
      details,
      timestamp: new Date(),
    };
  }
}