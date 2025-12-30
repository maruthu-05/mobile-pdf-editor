import AsyncStorage from '@react-native-async-storage/async-storage';
import { DocumentLibrary } from '../DocumentLibrary';
import { FileManager } from '../../file-manager/FileManager';
import { DocumentMetadata } from '../../../types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock FileManager
jest.mock('../../file-manager/FileManager');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const MockFileManager = FileManager as jest.MockedClass<typeof FileManager>;

describe('DocumentLibrary', () => {
  let documentLibrary: DocumentLibrary;
  let mockFileManager: jest.Mocked<FileManager>;

  const sampleDocument: DocumentMetadata = {
    id: 'doc_123',
    fileName: 'test.pdf',
    filePath: '/mock/documents/test.pdf',
    fileSize: 1024,
    pageCount: 5,
    createdAt: new Date('2023-01-01T00:00:00Z'),
    modifiedAt: new Date('2023-01-02T00:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock FileManager instance
    mockFileManager = new MockFileManager() as jest.Mocked<FileManager>;
    mockFileManager.fileExists.mockResolvedValue(true);
    mockFileManager.listFiles.mockResolvedValue([]);
    mockFileManager.saveFile.mockResolvedValue('/mock/path');
    mockFileManager.readFileAsText.mockResolvedValue('{}');
    mockFileManager.deleteFile.mockResolvedValue();

    // Create DocumentLibrary instance with mock FileManager
    documentLibrary = new DocumentLibrary(mockFileManager);

    // Mock AsyncStorage to return empty initially
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.removeItem.mockResolvedValue();
  });

  describe('addDocument', () => {
    it('should add a new document successfully', async () => {
      await documentLibrary.addDocument(sampleDocument.filePath, sampleDocument);

      expect(mockFileManager.fileExists).toHaveBeenCalledWith(sampleDocument.filePath);
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should throw error for empty file path', async () => {
      await expect(
        documentLibrary.addDocument('', sampleDocument)
      ).rejects.toThrow('File path cannot be empty');
    });

    it('should throw error when file does not exist', async () => {
      mockFileManager.fileExists.mockResolvedValue(false);

      await expect(
        documentLibrary.addDocument(sampleDocument.filePath, sampleDocument)
      ).rejects.toThrow('File not found');
    });

    it('should throw error for duplicate document ID', async () => {
      // Add document first time
      await documentLibrary.addDocument(sampleDocument.filePath, sampleDocument);

      // Try to add same document again
      await expect(
        documentLibrary.addDocument(sampleDocument.filePath, sampleDocument)
      ).rejects.toThrow('already exists');
    });

    it('should validate document metadata', async () => {
      const invalidDocument = {
        ...sampleDocument,
        id: '', // Invalid empty ID
      };

      await expect(
        documentLibrary.addDocument(sampleDocument.filePath, invalidDocument)
      ).rejects.toThrow('Invalid document metadata');
    });
  });

  describe('removeDocument', () => {
    beforeEach(async () => {
      // Add a document first
      await documentLibrary.addDocument(sampleDocument.filePath, sampleDocument);
    });

    it('should remove an existing document', async () => {
      await documentLibrary.removeDocument(sampleDocument.id);

      const documents = await documentLibrary.getDocuments();
      expect(documents).toHaveLength(0);
    });

    it('should throw error for empty document ID', async () => {
      await expect(
        documentLibrary.removeDocument('')
      ).rejects.toThrow('Document ID cannot be empty');
    });

    it('should throw error for non-existent document', async () => {
      await expect(
        documentLibrary.removeDocument('non-existent-id')
      ).rejects.toThrow('not found');
    });
  });

  describe('updateDocument', () => {
    beforeEach(async () => {
      // Add a document first
      await documentLibrary.addDocument(sampleDocument.filePath, sampleDocument);
    });

    it('should update document metadata', async () => {
      const updates = {
        fileName: 'updated-test.pdf',
        modifiedAt: new Date('2023-01-03T00:00:00Z'),
      };

      await documentLibrary.updateDocument(sampleDocument.id, updates);

      const updatedDocument = await documentLibrary.getDocument(sampleDocument.id);
      expect(updatedDocument?.fileName).toBe(updates.fileName);
      expect(updatedDocument?.modifiedAt).toEqual(updates.modifiedAt);
    });

    it('should throw error for empty document ID', async () => {
      await expect(
        documentLibrary.updateDocument('', { fileName: 'new-name.pdf' })
      ).rejects.toThrow('Document ID cannot be empty');
    });

    it('should throw error for non-existent document', async () => {
      await expect(
        documentLibrary.updateDocument('non-existent-id', { fileName: 'new-name.pdf' })
      ).rejects.toThrow('not found');
    });

    it('should validate updated metadata', async () => {
      const invalidUpdates = {
        pageCount: -1, // Invalid negative page count
      };

      await expect(
        documentLibrary.updateDocument(sampleDocument.id, invalidUpdates)
      ).rejects.toThrow('Invalid document metadata');
    });
  });

  describe('getDocuments', () => {
    const document1: DocumentMetadata = {
      ...sampleDocument,
      id: 'doc_1',
      fileName: 'first.pdf',
      modifiedAt: new Date('2023-01-01T00:00:00Z'),
    };

    const document2: DocumentMetadata = {
      ...sampleDocument,
      id: 'doc_2',
      fileName: 'second.pdf',
      modifiedAt: new Date('2023-01-02T00:00:00Z'),
    };

    beforeEach(async () => {
      await documentLibrary.addDocument(document1.filePath, document1);
      await documentLibrary.addDocument(document2.filePath, document2);
    });

    it('should return all documents sorted by modified date (desc) by default', async () => {
      const documents = await documentLibrary.getDocuments();

      expect(documents).toHaveLength(2);
      expect(documents[0].id).toBe('doc_2'); // More recent first
      expect(documents[1].id).toBe('doc_1');
    });

    it('should sort documents by specified field and order', async () => {
      const documents = await documentLibrary.getDocuments('fileName', 'asc');

      expect(documents).toHaveLength(2);
      expect(documents[0].fileName).toBe('first.pdf');
      expect(documents[1].fileName).toBe('second.pdf');
    });

    it('should return empty array when no documents exist', async () => {
      const emptyLibrary = new DocumentLibrary(mockFileManager);
      const documents = await emptyLibrary.getDocuments();

      expect(documents).toHaveLength(0);
    });
  });

  describe('getDocument', () => {
    beforeEach(async () => {
      await documentLibrary.addDocument(sampleDocument.filePath, sampleDocument);
    });

    it('should return document by ID', async () => {
      const document = await documentLibrary.getDocument(sampleDocument.id);

      expect(document).not.toBeNull();
      expect(document?.id).toBe(sampleDocument.id);
      expect(document?.fileName).toBe(sampleDocument.fileName);
    });

    it('should return null for non-existent document', async () => {
      const document = await documentLibrary.getDocument('non-existent-id');

      expect(document).toBeNull();
    });

    it('should return null for empty document ID', async () => {
      const document = await documentLibrary.getDocument('');

      expect(document).toBeNull();
    });
  });

  describe('searchDocuments', () => {
    const documents: DocumentMetadata[] = [
      {
        ...sampleDocument,
        id: 'doc_1',
        fileName: 'important-report.pdf',
      },
      {
        ...sampleDocument,
        id: 'doc_2',
        fileName: 'meeting-notes.pdf',
      },
      {
        ...sampleDocument,
        id: 'doc_3',
        fileName: 'project-report.pdf',
      },
    ];

    beforeEach(async () => {
      for (const doc of documents) {
        await documentLibrary.addDocument(doc.filePath, doc);
      }
    });

    it('should find documents by filename', async () => {
      const results = await documentLibrary.searchDocuments('report');

      expect(results).toHaveLength(2);
      expect(results.map(d => d.fileName)).toContain('important-report.pdf');
      expect(results.map(d => d.fileName)).toContain('project-report.pdf');
    });

    it('should be case insensitive', async () => {
      const results = await documentLibrary.searchDocuments('REPORT');

      expect(results).toHaveLength(2);
    });

    it('should return empty array for no matches', async () => {
      const results = await documentLibrary.searchDocuments('nonexistent');

      expect(results).toHaveLength(0);
    });

    it('should return empty array for empty query', async () => {
      const results = await documentLibrary.searchDocuments('');

      expect(results).toHaveLength(0);
    });

    it('should prioritize exact matches', async () => {
      const exactMatch: DocumentMetadata = {
        ...sampleDocument,
        id: 'doc_exact',
        fileName: 'report.pdf',
        modifiedAt: new Date('2023-01-01T00:00:00Z'), // Older than others
      };
      await documentLibrary.addDocument(exactMatch.filePath, exactMatch);

      const results = await documentLibrary.searchDocuments('report');

      expect(results[0].fileName).toBe('report.pdf'); // Exact match first
    });
  });

  describe('filterDocuments', () => {
    const documents: DocumentMetadata[] = [
      {
        ...sampleDocument,
        id: 'doc_1',
        fileSize: 1000,
        pageCount: 5,
        createdAt: new Date('2023-01-01T00:00:00Z'),
      },
      {
        ...sampleDocument,
        id: 'doc_2',
        fileSize: 2000,
        pageCount: 10,
        createdAt: new Date('2023-01-02T00:00:00Z'),
      },
      {
        ...sampleDocument,
        id: 'doc_3',
        fileSize: 3000,
        pageCount: 15,
        createdAt: new Date('2023-01-03T00:00:00Z'),
      },
    ];

    beforeEach(async () => {
      for (const doc of documents) {
        await documentLibrary.addDocument(doc.filePath, doc);
      }
    });

    it('should filter by file size range', async () => {
      const results = await documentLibrary.filterDocuments({
        fileSize: { min: 1500, max: 2500 },
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('doc_2');
    });

    it('should filter by page count range', async () => {
      const results = await documentLibrary.filterDocuments({
        pageCount: { min: 8, max: 12 },
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('doc_2');
    });

    it('should filter by date range', async () => {
      const results = await documentLibrary.filterDocuments({
        createdAt: {
          from: new Date('2023-01-01T12:00:00Z'),
          to: new Date('2023-01-02T12:00:00Z'),
        },
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('doc_2');
    });

    it('should combine multiple filters', async () => {
      const results = await documentLibrary.filterDocuments({
        fileSize: { min: 1500 },
        pageCount: { max: 12 },
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('doc_2');
    });

    it('should return empty array when no documents match', async () => {
      const results = await documentLibrary.filterDocuments({
        fileSize: { min: 10000 },
      });

      expect(results).toHaveLength(0);
    });
  });

  describe('getLibraryStats', () => {
    const documents: DocumentMetadata[] = [
      {
        ...sampleDocument,
        id: 'doc_1',
        fileSize: 1000,
        pageCount: 5,
      },
      {
        ...sampleDocument,
        id: 'doc_2',
        fileSize: 2000,
        pageCount: 10,
      },
    ];

    beforeEach(async () => {
      for (const doc of documents) {
        await documentLibrary.addDocument(doc.filePath, doc);
      }
    });

    it('should return correct library statistics', async () => {
      const stats = await documentLibrary.getLibraryStats();

      expect(stats.totalDocuments).toBe(2);
      expect(stats.totalSize).toBe(3000);
      expect(stats.totalPages).toBe(15);
      expect(stats.averageFileSize).toBe(1500);
      expect(stats.averagePageCount).toBe(8); // Rounded from 7.5
    });

    it('should return zero stats for empty library', async () => {
      const emptyLibrary = new DocumentLibrary(mockFileManager);
      const stats = await emptyLibrary.getLibraryStats();

      expect(stats.totalDocuments).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.totalPages).toBe(0);
      expect(stats.averageFileSize).toBe(0);
      expect(stats.averagePageCount).toBe(0);
    });
  });

  describe('clearLibrary', () => {
    beforeEach(async () => {
      await documentLibrary.addDocument(sampleDocument.filePath, sampleDocument);
    });

    it('should clear all documents from library', async () => {
      await documentLibrary.clearLibrary(false);

      const documents = await documentLibrary.getDocuments();
      expect(documents).toHaveLength(0);
      expect(mockAsyncStorage.removeItem).toHaveBeenCalled();
    });

    it('should delete files when deleteFiles is true', async () => {
      await documentLibrary.clearLibrary(true);

      expect(mockFileManager.deleteFile).toHaveBeenCalledWith(sampleDocument.filePath);
    });

    it('should not delete files when deleteFiles is false', async () => {
      await documentLibrary.clearLibrary(false);

      expect(mockFileManager.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe('validateLibrary', () => {
    beforeEach(async () => {
      await documentLibrary.addDocument(sampleDocument.filePath, sampleDocument);
    });

    it('should validate library and return correct report', async () => {
      const report = await documentLibrary.validateLibrary();

      expect(report.totalDocuments).toBe(1);
      expect(report.validDocuments).toBe(1);
      expect(report.invalidDocuments).toBe(0);
      expect(report.missingFiles).toHaveLength(0);
      expect(report.fixedIssues).toBe(0);
    });

    it('should detect and fix missing files', async () => {
      // Mock file as missing
      mockFileManager.fileExists.mockResolvedValue(false);

      const report = await documentLibrary.validateLibrary();

      expect(report.missingFiles).toContain(sampleDocument.filePath);
      expect(report.fixedIssues).toBe(1);

      // Verify document was removed
      const documents = await documentLibrary.getDocuments();
      expect(documents).toHaveLength(0);
    });
  });

  describe('AsyncStorage integration', () => {
    it('should load documents from storage on first access', async () => {
      const storedDocuments = [sampleDocument];
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(storedDocuments));

      const newLibrary = new DocumentLibrary(mockFileManager);
      const documents = await newLibrary.getDocuments();

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('pdf_document_library');
      expect(documents).toHaveLength(1);
      expect(documents[0].id).toBe(sampleDocument.id);
    });

    it('should handle corrupted storage data gracefully', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('invalid-json');

      const newLibrary = new DocumentLibrary(mockFileManager);
      const documents = await newLibrary.getDocuments();

      expect(documents).toHaveLength(0);
    });

    it('should save documents to storage after modifications', async () => {
      await documentLibrary.addDocument(sampleDocument.filePath, sampleDocument);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'pdf_document_library',
        expect.stringContaining(sampleDocument.id)
      );
    });
  });
});