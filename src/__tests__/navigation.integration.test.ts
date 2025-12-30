import { navigation, deepLinking, routeValidation } from '../utils/navigation';
import { DocumentLibrary } from '../modules/document-library';

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
}));

// Mock DocumentLibrary
const mockDocumentLibrary = {
  getDocuments: jest.fn().mockResolvedValue([
    {
      id: 'doc1',
      fileName: 'test1.pdf',
      filePath: '/path/to/test1.pdf',
      fileSize: 1024,
      pageCount: 5,
      createdAt: new Date(),
      modifiedAt: new Date(),
    },
    {
      id: 'doc2',
      fileName: 'test2.pdf',
      filePath: '/path/to/test2.pdf',
      fileSize: 2048,
      pageCount: 10,
      createdAt: new Date(),
      modifiedAt: new Date(),
    },
  ]),
};

jest.mock('../modules/document-library', () => ({
  DocumentLibrary: jest.fn().mockImplementation(() => mockDocumentLibrary),
}));

// Create navigation guards for testing
const navigationGuards = {
  requireDocument: async (documentId: string) => {
    try {
      if (!documentId || typeof documentId !== 'string' || documentId.trim() === '') {
        throw new Error('Document ID is required');
      }

      const documentLibrary = new DocumentLibrary();
      const documents = await documentLibrary.getDocuments();
      const document = documents.find(doc => doc.id === documentId);

      if (!document) {
        throw new Error('Document not found');
      }

      return document;
    } catch (error) {
      console.error('Navigation guard failed:', error);
      return null;
    }
  },

  requireMultipleDocuments: async () => {
    try {
      const documentLibrary = new DocumentLibrary();
      const documents = await documentLibrary.getDocuments();
      return documents.length >= 2;
    } catch (error) {
      console.error('Navigation guard failed:', error);
      return false;
    }
  },
};

describe('Navigation Integration Tests', () => {
  const { router } = require('expo-router');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Navigation Functions', () => {
    test('should navigate to document library', () => {
      navigation.toDocumentLibrary();
      expect(router.push).toHaveBeenCalledWith('/');
    });

    test('should navigate to PDF viewer with valid document ID', () => {
      const documentId = 'doc123';
      navigation.toPDFViewer(documentId);
      expect(router.push).toHaveBeenCalledWith('/pdf-viewer/doc123');
    });

    test('should throw error for invalid document ID in PDF viewer navigation', () => {
      expect(() => navigation.toPDFViewer('')).toThrow('Invalid document ID provided');
      expect(() => navigation.toPDFViewer(null as any)).toThrow('Invalid document ID provided');
    });

    test('should navigate to merge screen', () => {
      navigation.toMerge();
      expect(router.push).toHaveBeenCalledWith('/merge');
    });

    test('should navigate to split screen with valid document ID', () => {
      const documentId = 'doc123';
      navigation.toSplit(documentId);
      expect(router.push).toHaveBeenCalledWith('/split/doc123');
    });

    test('should throw error for invalid document ID in split navigation', () => {
      expect(() => navigation.toSplit('')).toThrow('Invalid document ID provided');
      expect(() => navigation.toSplit(undefined as any)).toThrow('Invalid document ID provided');
    });

    test('should handle special characters in document ID', () => {
      const documentId = 'doc with spaces & symbols!';
      navigation.toPDFViewer(documentId);
      expect(router.push).toHaveBeenCalledWith('/pdf-viewer/doc%20with%20spaces%20%26%20symbols!');
    });

    test('should navigate back', () => {
      navigation.back();
      expect(router.back).toHaveBeenCalled();
    });

    test('should replace current route', () => {
      const href = '/new-route';
      navigation.replace(href);
      expect(router.replace).toHaveBeenCalledWith(href);
    });

    test('should check if can go back', () => {
      const result = navigation.canGoBack();
      expect(router.canGoBack).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('Deep Linking', () => {
    test('should generate document viewer deep link', () => {
      const documentId = 'doc123';
      const link = deepLinking.generateDocumentViewerLink(documentId);
      expect(link).toBe('mobilepdfeditor://pdf-viewer/doc123');
    });

    test('should generate split screen deep link', () => {
      const documentId = 'doc123';
      const link = deepLinking.generateSplitLink(documentId);
      expect(link).toBe('mobilepdfeditor://split/doc123');
    });

    test('should generate merge screen deep link', () => {
      const link = deepLinking.generateMergeLink();
      expect(link).toBe('mobilepdfeditor://merge');
    });

    test('should handle special characters in deep link generation', () => {
      const documentId = 'doc with spaces & symbols!';
      const link = deepLinking.generateDocumentViewerLink(documentId);
      expect(link).toBe('mobilepdfeditor://pdf-viewer/doc%20with%20spaces%20%26%20symbols!');
    });

    test('should throw error for invalid document ID in deep link generation', () => {
      expect(() => deepLinking.generateDocumentViewerLink('')).toThrow('Invalid document ID provided');
      expect(() => deepLinking.generateSplitLink(null as any)).toThrow('Invalid document ID provided');
    });

    test('should parse valid deep links', () => {
      const testCases = [
        {
          url: 'mobilepdfeditor://pdf-viewer/doc123',
          expected: { route: '/pdf-viewer/doc123', params: {} },
        },
        {
          url: 'mobilepdfeditor://split/doc456',
          expected: { route: '/split/doc456', params: {} },
        },
        {
          url: 'mobilepdfeditor://merge',
          expected: { route: '/merge', params: {} },
        },
        {
          url: 'mobilepdfeditor://',
          expected: { route: '/', params: {} },
        },
        {
          url: 'mobilepdfeditor://pdf-viewer/doc123?param1=value1&param2=value2',
          expected: { route: '/pdf-viewer/doc123', params: { param1: 'value1', param2: 'value2' } },
        },
        {
          url: 'mobilepdfeditor://invalid/path/with/too/many/segments',
          expected: { route: '/invalid/path/with/too/many/segments', params: {} },
        },
      ];

      testCases.forEach(({ url, expected }) => {
        const result = deepLinking.parseDeepLink(url);
        expect(result).toEqual(expected);
      });
    });

    test('should return null for invalid deep links', () => {
      const invalidUrls = [
        'http://example.com',
        'invalid-scheme://test',
        'not-a-url',
        '',
      ];

      invalidUrls.forEach(url => {
        const result = deepLinking.parseDeepLink(url);
        expect(result).toBeNull();
      });
    });
  });

  describe('Navigation Guards', () => {
    test('should validate existing document', async () => {
      const document = await navigationGuards.requireDocument('doc1');
      expect(document).toBeTruthy();
      expect(document?.id).toBe('doc1');
      expect(document?.fileName).toBe('test1.pdf');
    });

    test('should return null for non-existing document', async () => {
      const document = await navigationGuards.requireDocument('nonexistent');
      expect(document).toBeNull();
    });

    test('should return null for invalid document ID', async () => {
      const document = await navigationGuards.requireDocument('');
      expect(document).toBeNull();
    });

    test('should validate multiple documents exist for merge', async () => {
      const result = await navigationGuards.requireMultipleDocuments();
      expect(result).toBe(true);
    });

    test('should handle error when checking multiple documents', async () => {
      // Mock DocumentLibrary to throw error
      const originalGetDocuments = mockDocumentLibrary.getDocuments;
      mockDocumentLibrary.getDocuments = jest.fn().mockRejectedValue(new Error('Database error'));

      const result = await navigationGuards.requireMultipleDocuments();
      expect(result).toBe(false);

      // Restore original mock
      mockDocumentLibrary.getDocuments = originalGetDocuments;
    });
  });

  describe('Route Validation', () => {
    test('should validate PDF viewer route parameters', () => {
      expect(routeValidation.pdfViewer.validate({ documentId: 'doc123' })).toBe(true);
      expect(routeValidation.pdfViewer.validate({ documentId: '' })).toBe(false);
      expect(routeValidation.pdfViewer.validate({})).toBe(false);
    });

    test('should validate split route parameters', () => {
      expect(routeValidation.split.validate({ documentId: 'doc123' })).toBe(true);
      expect(routeValidation.split.validate({ documentId: '' })).toBe(false);
      expect(routeValidation.split.validate({})).toBe(false);
    });

    test('should validate merge route parameters', () => {
      expect(routeValidation.merge.validate()).toBe(true);
    });

    test('should have correct required parameters', () => {
      expect(routeValidation.pdfViewer.requiredParams).toEqual(['documentId']);
      expect(routeValidation.split.requiredParams).toEqual(['documentId']);
      expect(routeValidation.merge.requiredParams).toEqual([]);
    });
  });

  describe('End-to-End Navigation Flows', () => {
    test('should complete document library to PDF viewer flow', () => {
      // Start at document library
      navigation.toDocumentLibrary();
      expect(router.push).toHaveBeenCalledWith('/');

      // Navigate to PDF viewer
      navigation.toPDFViewer('doc123');
      expect(router.push).toHaveBeenCalledWith('/pdf-viewer/doc123');

      // Navigate back
      navigation.back();
      expect(router.back).toHaveBeenCalled();
    });

    test('should complete PDF viewer to split flow', () => {
      // Navigate to PDF viewer
      navigation.toPDFViewer('doc123');
      expect(router.push).toHaveBeenCalledWith('/pdf-viewer/doc123');

      // Navigate to split screen
      navigation.toSplit('doc123');
      expect(router.push).toHaveBeenCalledWith('/split/doc123');

      // Navigate back twice to return to library
      navigation.back();
      navigation.back();
      expect(router.back).toHaveBeenCalledTimes(2);
    });

    test('should complete merge flow', () => {
      // Start at document library
      navigation.toDocumentLibrary();
      expect(router.push).toHaveBeenCalledWith('/');

      // Navigate to merge screen
      navigation.toMerge();
      expect(router.push).toHaveBeenCalledWith('/merge');

      // Navigate back
      navigation.back();
      expect(router.back).toHaveBeenCalled();
    });

    test('should handle deep link navigation flow', () => {
      // Generate deep link
      const deepLink = deepLinking.generateDocumentViewerLink('doc123');
      expect(deepLink).toBe('mobilepdfeditor://pdf-viewer/doc123');

      // Parse deep link
      const parsed = deepLinking.parseDeepLink(deepLink);
      expect(parsed).toEqual({
        route: '/pdf-viewer/doc123',
        params: {},
      });

      // Validate route parameters
      const isValid = routeValidation.pdfViewer.validate({ documentId: 'doc123' });
      expect(isValid).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle navigation errors gracefully', () => {
      // Test invalid parameters
      expect(() => navigation.toPDFViewer('')).toThrow();
      expect(() => navigation.toSplit(null as any)).toThrow();
      expect(() => deepLinking.generateDocumentViewerLink('')).toThrow();
    });

    test('should handle deep link parsing errors', () => {
      const invalidLinks = [
        'invalid-url',
        'http://example.com',
      ];

      invalidLinks.forEach(link => {
        const result = deepLinking.parseDeepLink(link);
        expect(result).toBeNull();
      });
    });

    test('should handle navigation guard failures', async () => {
      // Test with invalid document ID
      const result = await navigationGuards.requireDocument('');
      expect(result).toBeNull();

      // Test with non-existent document
      const result2 = await navigationGuards.requireDocument('nonexistent');
      expect(result2).toBeNull();
    });
  });
});