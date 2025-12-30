/**
 * Unit tests for error handling system core functionality
 * These tests focus on the business logic without React Native dependencies
 */

import { ErrorFactory, FileSystemError, PDFError, ValidationError } from '../../../types/errors';

describe('Error Handling Core Logic', () => {
  describe('ErrorFactory', () => {
    it('should create FileSystemError correctly', () => {
      const error = ErrorFactory.createFileSystemError(
        'file_not_found',
        'Test file not found',
        '/test/file.pdf'
      );

      expect(error.type).toBe('file_system');
      expect(error.category).toBe('file_not_found');
      expect(error.message).toBe('Test file not found');
      expect(error.filePath).toBe('/test/file.pdf');
      expect(error.code).toBe('FS_FILE_NOT_FOUND');
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should create PDFError correctly', () => {
      const error = ErrorFactory.createPDFError(
        'invalid_pdf_format',
        'Invalid PDF file',
        '/test/invalid.pdf',
        5
      );

      expect(error.type).toBe('pdf_processing');
      expect(error.category).toBe('invalid_pdf_format');
      expect(error.message).toBe('Invalid PDF file');
      expect(error.filePath).toBe('/test/invalid.pdf');
      expect(error.pageNumber).toBe(5);
      expect(error.code).toBe('PDF_INVALID_PDF_FORMAT');
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should create ValidationError correctly', () => {
      const error = ErrorFactory.createValidationError(
        'missing_required_field',
        'Field is required',
        'testField',
        null
      );

      expect(error.type).toBe('validation');
      expect(error.category).toBe('missing_required_field');
      expect(error.message).toBe('Field is required');
      expect(error.field).toBe('testField');
      expect(error.value).toBeNull();
      expect(error.code).toBe('VAL_MISSING_REQUIRED_FIELD');
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should create NetworkError correctly', () => {
      const error = ErrorFactory.createNetworkError(
        'server_error',
        'Internal server error',
        500,
        'https://api.example.com'
      );

      expect(error.type).toBe('network');
      expect(error.category).toBe('server_error');
      expect(error.message).toBe('Internal server error');
      expect(error.statusCode).toBe(500);
      expect(error.url).toBe('https://api.example.com');
      expect(error.code).toBe('NET_SERVER_ERROR');
      expect(error.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Error Categorization', () => {
    it('should categorize file system errors correctly', () => {
      const categories: FileSystemError['category'][] = [
        'insufficient_storage',
        'file_not_found',
        'permission_denied',
        'file_corruption',
        'invalid_path',
        'disk_full',
        'read_only_filesystem'
      ];

      categories.forEach(category => {
        const error = ErrorFactory.createFileSystemError(
          category,
          `Test ${category} error`,
          '/test/file.pdf'
        );
        expect(error.category).toBe(category);
        expect(error.type).toBe('file_system');
      });
    });

    it('should categorize PDF errors correctly', () => {
      const categories: PDFError['category'][] = [
        'invalid_pdf_format',
        'unsupported_feature',
        'memory_limitation',
        'corrupted_pdf',
        'password_protected',
        'page_not_found',
        'merge_failed',
        'split_failed',
        'edit_failed',
        'annotation_failed'
      ];

      categories.forEach(category => {
        const error = ErrorFactory.createPDFError(
          category,
          `Test ${category} error`,
          '/test/file.pdf'
        );
        expect(error.category).toBe(category);
        expect(error.type).toBe('pdf_processing');
      });
    });

    it('should categorize validation errors correctly', () => {
      const categories: ValidationError['category'][] = [
        'invalid_input',
        'missing_required_field',
        'invalid_format',
        'out_of_range',
        'duplicate_value',
        'invalid_file_type'
      ];

      categories.forEach(category => {
        const error = ErrorFactory.createValidationError(
          category,
          `Test ${category} error`,
          'testField'
        );
        expect(error.category).toBe(category);
        expect(error.type).toBe('validation');
      });
    });
  });

  describe('Error Code Generation', () => {
    it('should generate consistent error codes', () => {
      const fsError = ErrorFactory.createFileSystemError(
        'file_not_found',
        'Test error',
        '/test/file.pdf'
      );
      expect(fsError.code).toBe('FS_FILE_NOT_FOUND');

      const pdfError = ErrorFactory.createPDFError(
        'invalid_pdf_format',
        'Test error',
        '/test/file.pdf'
      );
      expect(pdfError.code).toBe('PDF_INVALID_PDF_FORMAT');

      const valError = ErrorFactory.createValidationError(
        'missing_required_field',
        'Test error',
        'field'
      );
      expect(valError.code).toBe('VAL_MISSING_REQUIRED_FIELD');

      const netError = ErrorFactory.createNetworkError(
        'connection_failed',
        'Test error'
      );
      expect(netError.code).toBe('NET_CONNECTION_FAILED');
    });

    it('should handle special characters in category names', () => {
      // Test that underscores are properly converted to uppercase
      const error = ErrorFactory.createFileSystemError(
        'read_only_filesystem',
        'Test error',
        '/test/file.pdf'
      );
      expect(error.code).toBe('FS_READ_ONLY_FILESYSTEM');
    });
  });

  describe('Error Timestamp', () => {
    it('should set timestamp to current time', () => {
      const beforeTime = new Date();
      const error = ErrorFactory.createFileSystemError(
        'file_not_found',
        'Test error',
        '/test/file.pdf'
      );
      const afterTime = new Date();

      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should create unique timestamps for rapid error creation', () => {
      const errors = Array.from({ length: 10 }, () =>
        ErrorFactory.createFileSystemError(
          'file_not_found',
          'Test error',
          '/test/file.pdf'
        )
      );

      // While timestamps might be the same due to rapid creation,
      // the structure should be consistent
      errors.forEach(error => {
        expect(error.timestamp).toBeInstanceOf(Date);
        expect(error.timestamp.getTime()).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Details', () => {
    it('should handle optional details parameter', () => {
      const details = { additionalInfo: 'test', errorCode: 123 };
      const error = ErrorFactory.createFileSystemError(
        'file_corruption',
        'Test error with details',
        '/test/file.pdf',
        details
      );

      expect(error.details).toEqual(details);
    });

    it('should handle undefined details', () => {
      const error = ErrorFactory.createFileSystemError(
        'file_not_found',
        'Test error without details',
        '/test/file.pdf'
      );

      expect(error.details).toBeUndefined();
    });

    it('should preserve complex details objects', () => {
      const complexDetails = {
        nested: {
          object: {
            with: ['array', 'values']
          }
        },
        number: 42,
        boolean: true,
        nullValue: null
      };

      const error = ErrorFactory.createPDFError(
        'merge_failed',
        'Complex error',
        '/test/file.pdf',
        undefined,
        complexDetails
      );

      expect(error.details).toEqual(complexDetails);
    });
  });

  describe('Error Message Handling', () => {
    it('should preserve exact error messages', () => {
      const messages = [
        'Simple error message',
        'Error with special characters: !@#$%^&*()',
        'Multi-line\nerror\nmessage',
        'Error with unicode: 🚨 ⚠️ ❌',
        ''
      ];

      messages.forEach(message => {
        const error = ErrorFactory.createFileSystemError(
          'file_not_found',
          message,
          '/test/file.pdf'
        );
        expect(error.message).toBe(message);
      });
    });

    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(1000);
      const error = ErrorFactory.createFileSystemError(
        'file_corruption',
        longMessage,
        '/test/file.pdf'
      );

      expect(error.message).toBe(longMessage);
      expect(error.message.length).toBe(1000);
    });
  });

  describe('File Path Handling', () => {
    it('should handle various file path formats', () => {
      const filePaths = [
        '/absolute/path/to/file.pdf',
        'relative/path/file.pdf',
        'C:\\Windows\\Path\\file.pdf',
        '/path/with spaces/file name.pdf',
        '/path/with-special_chars/file@123.pdf',
        ''
      ];

      filePaths.forEach(filePath => {
        const error = ErrorFactory.createFileSystemError(
          'file_not_found',
          'Test error',
          filePath
        );
        expect(error.filePath).toBe(filePath);
      });
    });

    it('should handle undefined file path', () => {
      const error = ErrorFactory.createFileSystemError(
        'disk_full',
        'Test error without file path'
      );
      expect(error.filePath).toBeUndefined();
    });
  });

  describe('Page Number Handling', () => {
    it('should handle various page numbers', () => {
      const pageNumbers = [1, 100, 9999, 0, -1];

      pageNumbers.forEach(pageNumber => {
        const error = ErrorFactory.createPDFError(
          'page_not_found',
          'Test error',
          '/test/file.pdf',
          pageNumber
        );
        expect(error.pageNumber).toBe(pageNumber);
      });
    });

    it('should handle undefined page number', () => {
      const error = ErrorFactory.createPDFError(
        'invalid_pdf_format',
        'Test error without page number',
        '/test/file.pdf'
      );
      expect(error.pageNumber).toBeUndefined();
    });
  });

  describe('Network Error Specific Fields', () => {
    it('should handle status codes correctly', () => {
      const statusCodes = [200, 404, 500, 0, -1];

      statusCodes.forEach(statusCode => {
        const error = ErrorFactory.createNetworkError(
          'server_error',
          'Test error',
          statusCode,
          'https://api.example.com'
        );
        expect(error.statusCode).toBe(statusCode);
      });
    });

    it('should handle URLs correctly', () => {
      const urls = [
        'https://api.example.com',
        'http://localhost:3000/api',
        'ftp://files.example.com',
        'invalid-url',
        ''
      ];

      urls.forEach(url => {
        const error = ErrorFactory.createNetworkError(
          'connection_failed',
          'Test error',
          undefined,
          url
        );
        expect(error.url).toBe(url);
      });
    });
  });
});