import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { DocumentPickerUtils } from '../DocumentPickerUtils';

// Mock expo-document-picker
jest.mock('expo-document-picker');
const mockDocumentPicker = DocumentPicker as jest.Mocked<typeof DocumentPicker>;

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  Alert: {
    alert: jest.fn(),
  },
}));

describe('DocumentPickerUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Platform.OS to iOS for most tests
    (Platform as any).OS = 'ios';
  });

  describe('isAvailable', () => {
    it('should return true for iOS', () => {
      (Platform as any).OS = 'ios';
      expect(DocumentPickerUtils.isAvailable()).toBe(true);
    });

    it('should return true for Android', () => {
      (Platform as any).OS = 'android';
      expect(DocumentPickerUtils.isAvailable()).toBe(true);
    });

    it('should return false for web', () => {
      (Platform as any).OS = 'web';
      expect(DocumentPickerUtils.isAvailable()).toBe(false);
    });
  });

  describe('pickPDFDocument', () => {
    it('should return success result when PDF is selected', async () => {
      const mockResult = {
        canceled: false,
        assets: [
          {
            uri: 'file://test.pdf',
            name: 'test.pdf',
            size: 1024,
            mimeType: 'application/pdf',
          },
        ],
      };

      mockDocumentPicker.getDocumentAsync.mockResolvedValue(mockResult as any);

      const result = await DocumentPickerUtils.pickPDFDocument();

      expect(result.success).toBe(true);
      expect(result.uri).toBe('file://test.pdf');
      expect(result.name).toBe('test.pdf');
      expect(result.size).toBe(1024);
      expect(result.mimeType).toBe('application/pdf');
    });

    it('should return error when user cancels', async () => {
      const mockResult = {
        canceled: true,
      };

      mockDocumentPicker.getDocumentAsync.mockResolvedValue(mockResult as any);

      const result = await DocumentPickerUtils.pickPDFDocument();

      expect(result.success).toBe(false);
      expect(result.error).toBe('User canceled selection');
    });

    it('should return error when non-PDF file is selected', async () => {
      const mockResult = {
        canceled: false,
        assets: [
          {
            uri: 'file://test.txt',
            name: 'test.txt',
            size: 1024,
            mimeType: 'text/plain',
          },
        ],
      };

      mockDocumentPicker.getDocumentAsync.mockResolvedValue(mockResult as any);

      const result = await DocumentPickerUtils.pickPDFDocument();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Please select a PDF file');
    });

    it('should try multiple configurations on failure', async () => {
      // First call fails, second succeeds
      mockDocumentPicker.getDocumentAsync
        .mockRejectedValueOnce(new Error('Configuration 1 failed'))
        .mockResolvedValueOnce({
          canceled: false,
          assets: [
            {
              uri: 'file://test.pdf',
              name: 'test.pdf',
              size: 1024,
              mimeType: 'application/pdf',
            },
          ],
        } as any);

      const result = await DocumentPickerUtils.pickPDFDocument();

      expect(result.success).toBe(true);
      expect(mockDocumentPicker.getDocumentAsync).toHaveBeenCalledTimes(2);
    });

    it('should return error when platform is not supported', async () => {
      (Platform as any).OS = 'web';

      const result = await DocumentPickerUtils.pickPDFDocument();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not available on this platform');
    });

    it('should handle permission errors appropriately', async () => {
      mockDocumentPicker.getDocumentAsync.mockRejectedValue(
        new Error('Permission denied')
      );

      const result = await DocumentPickerUtils.pickPDFDocument();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    it('should validate PDF files by extension', async () => {
      const mockResult = {
        canceled: false,
        assets: [
          {
            uri: 'file://document.pdf',
            name: 'document.pdf',
            size: 1024,
            mimeType: undefined, // No MIME type
          },
        ],
      };

      mockDocumentPicker.getDocumentAsync.mockResolvedValue(mockResult as any);

      const result = await DocumentPickerUtils.pickPDFDocument();

      expect(result.success).toBe(true);
    });

    it('should validate PDF files by MIME type', async () => {
      const mockResult = {
        canceled: false,
        assets: [
          {
            uri: 'file://document',
            name: 'document', // No extension
            size: 1024,
            mimeType: 'application/pdf',
          },
        ],
      };

      mockDocumentPicker.getDocumentAsync.mockResolvedValue(mockResult as any);

      const result = await DocumentPickerUtils.pickPDFDocument();

      expect(result.success).toBe(true);
    });

    it('should handle legacy API structure', async () => {
      const mockResult = {
        type: 'success',
        uri: 'file://test.pdf',
        name: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
      };

      mockDocumentPicker.getDocumentAsync.mockResolvedValue(mockResult as any);

      const result = await DocumentPickerUtils.pickPDFDocument();

      expect(result.success).toBe(true);
      expect(result.uri).toBe('file://test.pdf');
    });
  });

  describe('showErrorAlert', () => {
    it('should show permission error with settings option', () => {
      const mockAlert = require('react-native').Alert.alert;
      
      DocumentPickerUtils.showErrorAlert('Permission denied. Please check app permissions.');

      expect(mockAlert).toHaveBeenCalledWith(
        'Permission Required',
        'Permission denied. Please check app permissions.',
        expect.arrayContaining([
          { text: 'Cancel' },
          expect.objectContaining({ text: 'Settings' })
        ])
      );
    });

    it('should show feature not available error', () => {
      const mockAlert = require('react-native').Alert.alert;
      
      DocumentPickerUtils.showErrorAlert('File picker is not available on this device.');

      expect(mockAlert).toHaveBeenCalledWith(
        'Feature Not Available',
        expect.stringContaining('File picker is not available'),
        [{ text: 'OK' }]
      );
    });

    it('should show generic error for other cases', () => {
      const mockAlert = require('react-native').Alert.alert;
      
      DocumentPickerUtils.showErrorAlert('Some other error occurred.');

      expect(mockAlert).toHaveBeenCalledWith(
        'File Selection Error',
        'Some other error occurred.',
        [{ text: 'OK' }]
      );
    });
  });
});