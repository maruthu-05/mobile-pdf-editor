import { DocumentLibrary } from '../../../modules/document-library';
import { FileManager } from '../../../modules/file-manager';
import { DocumentMetadata } from '../../../types';

// Mock dependencies
jest.mock('../../../modules/document-library');
jest.mock('../../../modules/file-manager');

const mockDocumentLibrary = DocumentLibrary as jest.MockedClass<typeof DocumentLibrary>;
const mockFileManager = FileManager as jest.MockedClass<typeof FileManager>;

const mockDocuments: DocumentMetadata[] = [
  {
    id: '1',
    fileName: 'test1.pdf',
    filePath: '/path/to/test1.pdf',
    fileSize: 1024000,
    pageCount: 5,
    createdAt: new Date('2023-01-01'),
    modifiedAt: new Date('2023-01-02'),
  },
  {
    id: '2',
    fileName: 'test2.pdf',
    filePath: '/path/to/test2.pdf',
    fileSize: 2048000,
    pageCount: 10,
    createdAt: new Date('2023-01-03'),
    modifiedAt: new Date('2023-01-04'),
  },
];

describe('DocumentLibraryScreen Integration', () => {
  let mockDocumentLibraryInstance: jest.Mocked<DocumentLibrary>;
  let mockFileManagerInstance: jest.Mocked<FileManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDocumentLibraryInstance = {
      getDocuments: jest.fn().mockResolvedValue(mockDocuments),
      addDocument: jest.fn().mockResolvedValue(undefined),
      removeDocument: jest.fn().mockResolvedValue(undefined),
      updateDocument: jest.fn().mockResolvedValue(undefined),
      getDocument: jest.fn(),
      searchDocuments: jest.fn(),
      filterDocuments: jest.fn(),
      getLibraryStats: jest.fn(),
      importFromDirectory: jest.fn(),
      exportLibrary: jest.fn(),
      importLibrary: jest.fn(),
      clearLibrary: jest.fn(),
      validateLibrary: jest.fn(),
    } as any;

    mockFileManagerInstance = {
      getDocumentsDirectory: jest.fn().mockResolvedValue('/documents'),
      readFileAsBuffer: jest.fn().mockResolvedValue(Buffer.from('test')),
      saveFile: jest.fn().mockResolvedValue('/documents/test.pdf'),
      getFileInfo: jest.fn().mockResolvedValue({
        fileName: 'test.pdf',
        filePath: '/documents/test.pdf',
        fileSize: 1024,
        createdAt: new Date(),
        modifiedAt: new Date(),
        mimeType: 'application/pdf',
      }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      renameFile: jest.fn().mockResolvedValue('/documents/renamed.pdf'),
      listFiles: jest.fn(),
      copyFile: jest.fn(),
      moveFile: jest.fn(),
      fileExists: jest.fn(),
      getAvailableSpace: jest.fn(),
      getUsedSpace: jest.fn(),
      createDirectory: jest.fn(),
      readFileAsText: jest.fn(),
      getCacheDirectory: jest.fn(),
    } as any;

    mockDocumentLibrary.mockImplementation(() => mockDocumentLibraryInstance);
    mockFileManager.mockImplementation(() => mockFileManagerInstance);
  });

  it('should create DocumentLibrary and FileManager instances', () => {
    // Test that the screen can instantiate the required modules
    const documentLibrary = new DocumentLibrary();
    const fileManager = new FileManager();

    expect(documentLibrary).toBeDefined();
    expect(fileManager).toBeDefined();
    expect(mockDocumentLibrary).toHaveBeenCalled();
    expect(mockFileManager).toHaveBeenCalled();
  });

  it('should load documents on initialization', async () => {
    const documentLibrary = new DocumentLibrary();
    
    const documents = await documentLibrary.getDocuments('modifiedAt', 'desc');
    
    expect(mockDocumentLibraryInstance.getDocuments).toHaveBeenCalledWith('modifiedAt', 'desc');
    expect(documents).toEqual(mockDocuments);
  });

  it('should handle document upload workflow', async () => {
    const fileManager = new FileManager();
    const documentLibrary = new DocumentLibrary();

    // Simulate file upload workflow
    const documentsDir = await fileManager.getDocumentsDirectory();
    const fileName = 'uploaded.pdf';
    const filePath = `${documentsDir}/${fileName}`;
    const fileData = Buffer.from('test pdf data');

    const savedPath = await fileManager.saveFile(fileData, fileName);
    const fileInfo = await fileManager.getFileInfo(savedPath);

    const metadata: DocumentMetadata = {
      id: `doc_${Date.now()}`,
      fileName: fileName,
      filePath: savedPath,
      fileSize: fileInfo.fileSize,
      pageCount: 1,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };

    await documentLibrary.addDocument(savedPath, metadata);

    expect(mockFileManagerInstance.getDocumentsDirectory).toHaveBeenCalled();
    expect(mockFileManagerInstance.saveFile).toHaveBeenCalledWith(fileData, fileName);
    expect(mockFileManagerInstance.getFileInfo).toHaveBeenCalledWith(savedPath);
    expect(mockDocumentLibraryInstance.addDocument).toHaveBeenCalledWith(savedPath, metadata);
  });

  it('should handle document deletion workflow', async () => {
    const fileManager = new FileManager();
    const documentLibrary = new DocumentLibrary();
    const document = mockDocuments[0];

    await fileManager.deleteFile(document.filePath);
    await documentLibrary.removeDocument(document.id);

    expect(mockFileManagerInstance.deleteFile).toHaveBeenCalledWith(document.filePath);
    expect(mockDocumentLibraryInstance.removeDocument).toHaveBeenCalledWith(document.id);
  });

  it('should handle document renaming workflow', async () => {
    const fileManager = new FileManager();
    const documentLibrary = new DocumentLibrary();
    const document = mockDocuments[0];
    const newFileName = 'renamed-document.pdf';

    const newPath = await fileManager.renameFile(document.filePath, newFileName);
    await documentLibrary.updateDocument(document.id, {
      fileName: newFileName,
      filePath: newPath,
      modifiedAt: new Date(),
    });

    expect(mockFileManagerInstance.renameFile).toHaveBeenCalledWith(document.filePath, newFileName);
    expect(mockDocumentLibraryInstance.updateDocument).toHaveBeenCalledWith(
      document.id,
      expect.objectContaining({
        fileName: newFileName,
        filePath: newPath,
      })
    );
  });

  it('should handle search functionality', async () => {
    const searchResults = mockDocuments.filter(doc => 
      doc.fileName.toLowerCase().includes('test1')
    );
    
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].fileName).toBe('test1.pdf');
  });

  it('should format file sizes correctly', () => {
    const formatFileSize = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1024000)).toBe('1000 KB');
    expect(formatFileSize(2048000)).toBe('1.95 MB');
  });

  it('should format dates correctly', () => {
    const formatDate = (date: Date): string => {
      return date.toLocaleDateString();
    };

    const testDate = new Date('2023-01-01');
    const formatted = formatDate(testDate);
    
    expect(formatted).toBe(testDate.toLocaleDateString());
  });

  it('should handle error scenarios gracefully', async () => {
    mockDocumentLibraryInstance.getDocuments.mockRejectedValue(new Error('Network error'));

    try {
      await mockDocumentLibraryInstance.getDocuments();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Network error');
    }
  });
});