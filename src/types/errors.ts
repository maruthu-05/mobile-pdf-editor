// Error types and factory for the PDF editor app

export interface FileSystemError {
  type: 'file_system_error';
  code: 'file_not_found' | 'permission_denied' | 'disk_full' | 'invalid_path' | 'file_corruption';
  message: string;
  filePath?: string;
  details?: any;
}

export interface ValidationError {
  type: 'validation_error';
  code: 'invalid_input' | 'invalid_format' | 'duplicate_value';
  message: string;
  field?: string;
  value?: any;
}

export class ErrorFactory {
  static createFileSystemError(
    code: FileSystemError['code'],
    message: string,
    filePath?: string,
    details?: any
  ): FileSystemError {
    return {
      type: 'file_system_error',
      code,
      message,
      filePath,
      details,
    };
  }

  static createValidationError(
    code: ValidationError['code'],
    message: string,
    field?: string,
    value?: any
  ): ValidationError {
    return {
      type: 'validation_error',
      code,
      message,
      field,
      value,
    };
  }
}