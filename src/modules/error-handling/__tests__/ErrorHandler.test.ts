import { ErrorHandler } from '../ErrorHandler';
import { ErrorFactory, FileSystemError, PDFError, ValidationError, NetworkError } from '../../../types/errors';

// Mock the ToastNotification component
jest.mock('../../../components/common/ToastNotification', () => ({
  ToastNotification: jest.fn().mockImplementation(() => ({
    showInfo: jest.fn(),
    showWarning: jest.fn(),
    showError: jest.fn(),
  })),
}));

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = ErrorHandler.getInstance();
    errorHandler.clearErrorLog();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ErrorHandler.getInstance();
      const instance2 = ErrorHandler.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('File System Error Handling', () => {
    it('should handle insufficient storage error', () => {
      const error = ErrorFactory.createFileSystemError(
        'insufficient_storage',
        'Not enough space',
        '/test/file.pdf'
      );

      const showErrorSpy = jest.spyOn(errorHandler, 'showErrorMessage');
      errorHandler.handleFileSystemError(error);

      expect(showErrorSpy).toHaveBeenCalledWith(
        'Storage space is running low. Please free up some space and try again.',
        'warning'
      );
    });

    it('should handle file not found error', () => {
      const error = ErrorFactory.createFileSystemError(
        'file_not_found',
        'File does not exist',
        '/test/missing.pdf'
      );

      const showErrorSpy = jest.spyOn(errorHandler, 'showErrorMessage');
      errorHandler.handleFileSystemError(error);

      expect(showErrorSpy).toHaveBeenCalledWith(
        'The requested file could not be found. It may have been moved or deleted.',
        'error'
      );
    });

    it('should handle file corruption error', () => {
      const error = ErrorFactory.createFileSystemError(
        'file_corruption',
        'File is corrupted',
        '/test/corrupt.pdf'
      );

      const showErrorSpy = jest.spyOn(errorHandler, 'showErrorMessage');
      errorHandler.handleFileSystemError(error);

      expect(showErrorSpy).toHaveBeenCalledWith(
        'The file appears to be corrupted. Please try with a different file.',
        'error'
      );
    });

    it('should handle disk full error', () => {
      const error = ErrorFactory.createFileSystemError(
        'disk_full',
        'No space left on device',
        '/test/file.pdf'
      );

      const showErrorSpy = jest.spyOn(errorHandler, 'showErrorMessage');
      errorHandler.handleFileSystemError(error);

      expect(showErrorSpy).toHaveBeenCalledWith(
        'Storage is full. Please free up space before continuing.',
        'critical'
      );
    });
  });

  describe('PDF Processing Error Handling', () => {
    it('should handle invalid PDF format error', () => {
      const error = ErrorFactory.createPDFError(
        'invalid_pdf_format',
        'Not a valid PDF',
        '/test/invalid.pdf'
      );

      const showErrorSpy = jest.spyOn(errorHandler, 'showErrorMessage');
      errorHandler.handlePDFProcessingError(error);

      expect(showErrorSpy).toHaveBeenCalledWith(
        'This file is not a valid PDF or is corrupted. Please try with a different file.',
        'error'
      );
    });

    it('should handle memory limitation error', () => {
      const error = ErrorFactory.createPDFError(
        'memory_limitation',
        'PDF too large',
        '/test/large.pdf'
      );

      const showErrorSpy = jest.spyOn(errorHandler, 'showErrorMessage');
      errorHandler.handlePDFProcessingError(error);

      expect(showErrorSpy).toHaveBeenCalledWith(
        'This PDF is too large to process. Try splitting it into smaller files first.',
        'warning'
      );
    });

    it('should handle password protected error', () => {
      const error = ErrorFactory.createPDFError(
        'password_protected',
        'PDF is password protected',
        '/test/protected.pdf'
      );

      const showErrorSpy = jest.spyOn(errorHandler, 'showErrorMessage');
      errorHandler.handlePDFProcessingError(error);

      expect(showErrorSpy).toHaveBeenCalledWith(
        'This PDF is password protected. Password-protected PDFs are not currently supported.',
        'info'
      );
    });

    it('should handle page not found error with page number', () => {
      const error = ErrorFactory.createPDFError(
        'page_not_found',
        'Page does not exist',
        '/test/file.pdf',
        5
      );

      const showErrorSpy = jest.spyOn(errorHandler, 'showErrorMessage');
      errorHandler.handlePDFProcessingError(error);

      expect(showErrorSpy).toHaveBeenCalledWith(
        'Page 5 not found in the document.',
        'error'
      );
    });
  });

  describe('Validation Error Handling', () => {
    it('should handle invalid input error', () => {
      const error = ErrorFactory.createValidationError(
        'invalid_input',
        'Input is not valid',
        'testField',
        'invalidValue'
      );

      const showErrorSpy = jest.spyOn(errorHandler, 'showErrorMessage');
      errorHandler.handleValidationError(error);

      expect(showErrorSpy).toHaveBeenCalledWith(
        'Invalid input: Input is not valid',
        'warning'
      );
    });

    it('should handle missing required field error', () => {
      const error = ErrorFactory.createValidationError(
        'missing_required_field',
        'Field is required',
        'requiredField'
      );

      const showErrorSpy = jest.spyOn(errorHandler, 'showErrorMessage');
      errorHandler.handleValidationError(error);

      expect(showErrorSpy).toHaveBeenCalledWith(
        'Required field missing: requiredField',
        'warning'
      );
    });

    it('should handle invalid file type error', () => {
      const error = ErrorFactory.createValidationError(
        'invalid_file_type',
        'File type not supported',
        'fileName',
        'test.txt'
      );

      const showErrorSpy = jest.spyOn(errorHandler, 'showErrorMessage');
      errorHandler.handleValidationError(error);

      expect(showErrorSpy).toHaveBeenCalledWith(
        'Please select a valid PDF file.',
        'warning'
      );
    });
  });

  describe('Network Error Handling', () => {
    it('should handle connection failed error', () => {
      const error = ErrorFactory.createNetworkError(
        'connection_failed',
        'Cannot connect to server',
        undefined,
        'https://api.example.com'
      );

      const showErrorSpy = jest.spyOn(errorHandler, 'showErrorMessage');
      errorHandler.handleNetworkError(error);

      expect(showErrorSpy).toHaveBeenCalledWith(
        'Connection failed. Please check your internet connection.',
        'warning'
      );
    });

    it('should handle server error', () => {
      const error = ErrorFactory.createNetworkError(
        'server_error',
        'Internal server error',
        500,
        'https://api.example.com'
      );

      const showErrorSpy = jest.spyOn(errorHandler, 'showErrorMessage');
      errorHandler.handleNetworkError(error);

      expect(showErrorSpy).toHaveBeenCalledWith(
        'Server error occurred. Please try again later.',
        'error'
      );
    });
  });

  describe('Error Logging', () => {
    it('should log errors to memory', () => {
      const error = ErrorFactory.createFileSystemError(
        'file_not_found',
        'Test error',
        '/test/file.pdf'
      );

      errorHandler.logError(error);
      const errorLog = errorHandler.getErrorLog();

      expect(errorLog).toHaveLength(1);
      expect(errorLog[0]).toEqual(error);
    });

    it('should maintain log size limit', () => {
      // Create more errors than the limit (assuming limit is 1000)
      for (let i = 0; i < 1005; i++) {
        const error = ErrorFactory.createFileSystemError(
          'file_not_found',
          `Test error ${i}`,
          `/test/file${i}.pdf`
        );
        errorHandler.logError(error);
      }

      const errorLog = errorHandler.getErrorLog();
      expect(errorLog.length).toBeLessThanOrEqual(1000);
    });

    it('should filter errors by type', () => {
      const fsError = ErrorFactory.createFileSystemError(
        'file_not_found',
        'FS error',
        '/test/file.pdf'
      );
      const pdfError = ErrorFactory.createPDFError(
        'invalid_pdf_format',
        'PDF error',
        '/test/file.pdf'
      );

      errorHandler.logError(fsError);
      errorHandler.logError(pdfError);

      const fsErrors = errorHandler.getErrorsByType('file_system');
      const pdfErrors = errorHandler.getErrorsByType('pdf_processing');

      expect(fsErrors).toHaveLength(1);
      expect(pdfErrors).toHaveLength(1);
      expect(fsErrors[0].type).toBe('file_system');
      expect(pdfErrors[0].type).toBe('pdf_processing');
    });

    it('should get recent errors', () => {
      for (let i = 0; i < 15; i++) {
        const error = ErrorFactory.createFileSystemError(
          'file_not_found',
          `Error ${i}`,
          `/test/file${i}.pdf`
        );
        errorHandler.logError(error);
      }

      const recentErrors = errorHandler.getRecentErrors(5);
      expect(recentErrors).toHaveLength(5);
      
      // Should be the most recent errors (last 5)
      expect(recentErrors[0].message).toBe('Error 14');
      expect(recentErrors[4].message).toBe('Error 10');
    });
  });

  describe('Critical Error Detection', () => {
    it('should detect critical errors', () => {
      const criticalError = ErrorFactory.createFileSystemError(
        'disk_full',
        'Disk is full',
        '/test/file.pdf'
      );

      errorHandler.logError(criticalError);
      expect(errorHandler.hasCriticalErrors()).toBe(true);
    });

    it('should not detect non-critical errors as critical', () => {
      const normalError = ErrorFactory.createFileSystemError(
        'file_not_found',
        'File not found',
        '/test/file.pdf'
      );

      errorHandler.logError(normalError);
      expect(errorHandler.hasCriticalErrors()).toBe(false);
    });
  });

  describe('Error Message Display', () => {
    it('should show error messages with correct severity', () => {
      const showErrorSpy = jest.spyOn(errorHandler, 'showErrorMessage');
      
      errorHandler.showErrorMessage('Test info', 'info');
      errorHandler.showErrorMessage('Test warning', 'warning');
      errorHandler.showErrorMessage('Test error', 'error');
      errorHandler.showErrorMessage('Test critical', 'critical');

      expect(showErrorSpy).toHaveBeenCalledTimes(4);
    });
  });

  describe('Error Log Management', () => {
    it('should clear error log', () => {
      const error = ErrorFactory.createFileSystemError(
        'file_not_found',
        'Test error',
        '/test/file.pdf'
      );

      errorHandler.logError(error);
      expect(errorHandler.getErrorLog()).toHaveLength(1);

      errorHandler.clearErrorLog();
      expect(errorHandler.getErrorLog()).toHaveLength(0);
    });
  });
});