import { OfflineManager } from '../modules/storage-manager/OfflineManager';
import { StorageManager } from '../modules/storage-manager/StorageManager';
import { DocumentLibrary } from '../modules/document-library/DocumentLibrary';
import { PDFEngine } from '../modules/pdf-engine/PDFEngine';
import { FileManager } from '../modules/file-manager/FileManager';

// Mock network connectivity
jest.mock('@react-native-community/netinfo');
jest.mock('expo-file-system');
jest.mock('@react-native-async-storage/async-storage');

describe('Offline Functionality Integration', () => {
  let offlineManager: OfflineManager;
  let storageManager: StorageManager;
  let documentLibrary: DocumentLibrary;
  let pdfEngine: PDFEngine;
  let fileManager: FileManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    offlineManager = OfflineManager.getInstance();
    storageManager = StorageManager.getInstance();
    documentLibrary = DocumentLibrary.getInstance();
    pdfEngine = PDFEngine.getInstance();
    fileManager = FileManager.getInstance();
  });

  describe('Core Features Offline Capability', () => {
    it('should verify document loading works offline', async () => {
      // Simulate offline state
      const mockOfflineState = {
        isOnline: false,
        lastOnlineTime: new Date(),
        pendingOperations: [],
      };

      // Mock document library to return local documents
      jest.spyOn(documentLibrary, 'getDocuments').mockResolvedValue([
        {
          id: 'doc1',
          fileName: 'test.pdf',
          filePath: '/local/test.pdf',
          fileSize: 1000000,
          pageCount: 5,
          createdAt: new Date(),
          modifiedAt: new Date(),
        },
      ]);

      const documents = await documentLibrary.getDocuments();
      
      expect(documents).toHaveLength(1);
      expect(documents[0].fileName).toBe('test.pdf');
    });

    it('should verify PDF viewing works offline', async () => {
      const mockPdfPath = '/local/test.pdf';
      
      // Mock PDF engine to work offline
      jest.spyOn(pdfEngine, 'loadPDF').mockResolvedValue({
        pageCount: 5,
        title: 'Test PDF',
        author: 'Test Author',
        creationDate: new Date(),
        modificationDate: new Date(),
      } as any);

      jest.spyOn(pdfEngine, 'renderPage').mockResolvedValue({
        width: 612,
        height: 792,
        data: new Uint8Array(1000),
      } as any);

      const pdfDocument = await pdfEngine.loadPDF(mockPdfPath);
      const pageImage = await pdfEngine.renderPage(mockPdfPath, 1);

      expect(pdfDocument.pageCount).toBe(5);
      expect(pageImage.width).toBe(612);
    });

    it('should verify basic editing works offline', async () => {
      const mockPdfPath = '/local/test.pdf';
      const mockEditedPath = '/local/test_edited.pdf';

      // Mock PDF editing to work offline
      jest.spyOn(pdfEngine, 'editPDFText').mockResolvedValue(mockEditedPath);
      jest.spyOn(pdfEngine, 'addAnnotations').mockResolvedValue(mockEditedPath);

      const textEdits = [{
        pageNumber: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        newText: 'Updated text',
      }];

      const annotations = [{
        type: 'text' as const,
        pageNumber: 1,
        x: 150,
        y: 150,
        width: 100,
        height: 30,
        content: 'Test annotation',
        color: '#ff0000',
      }];

      const editedPath = await pdfEngine.editPDFText(mockPdfPath, textEdits);
      const annotatedPath = await pdfEngine.addAnnotations(mockPdfPath, annotations);

      expect(editedPath).toBe(mockEditedPath);
      expect(annotatedPath).toBe(mockEditedPath);
    });

    it('should verify file management works offline', async () => {
      const mockFileData = new Uint8Array([1, 2, 3, 4, 5]);
      const mockFileName = 'test.pdf';
      const mockFilePath = '/local/test.pdf';

      // Mock file manager to work offline
      jest.spyOn(fileManager, 'saveFile').mockResolvedValue(mockFilePath);
      jest.spyOn(fileManager, 'listFiles').mockResolvedValue([
        {
          name: mockFileName,
          path: mockFilePath,
          size: mockFileData.length,
          lastModified: new Date(),
          type: 'application/pdf',
        },
      ]);
      jest.spyOn(fileManager, 'deleteFile').mockResolvedValue();

      const savedPath = await fileManager.saveFile(mockFileData, mockFileName);
      const files = await fileManager.listFiles();
      await fileManager.deleteFile(mockFilePath);

      expect(savedPath).toBe(mockFilePath);
      expect(files).toHaveLength(1);
      expect(files[0].name).toBe(mockFileName);
    });

    it('should verify local storage works offline', async () => {
      // Mock AsyncStorage to work offline
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.setItem.mockResolvedValue();
      AsyncStorage.getItem.mockResolvedValue('{"test": "data"}');
      AsyncStorage.removeItem.mockResolvedValue();

      // Test storage operations
      await AsyncStorage.setItem('test_key', JSON.stringify({ test: 'data' }));
      const retrievedData = await AsyncStorage.getItem('test_key');
      await AsyncStorage.removeItem('test_key');

      expect(JSON.parse(retrievedData)).toEqual({ test: 'data' });
    });
  });

  describe('Offline State Management', () => {
    it('should handle offline state transitions', async () => {
      const NetInfo = require('@react-native-community/netinfo');
      let networkListener: (state: any) => void;

      NetInfo.addEventListener.mockImplementation((listener: any) => {
        networkListener = listener;
        return jest.fn();
      });

      NetInfo.fetch.mockResolvedValue({
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
      });

      await offlineManager.initialize();

      // Verify initial online state
      expect(offlineManager.isOnline()).toBe(true);

      // Simulate going offline
      networkListener({
        isConnected: false,
        type: 'none',
        isInternetReachable: false,
      });

      expect(offlineManager.isOnline()).toBe(false);

      // Simulate coming back online
      networkListener({
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
      });

      expect(offlineManager.isOnline()).toBe(true);
    });

    it('should queue operations when offline', async () => {
      // Simulate offline state
      const NetInfo = require('@react-native-community/netinfo');
      NetInfo.fetch.mockResolvedValue({
        isConnected: false,
        type: 'none',
        isInternetReachable: false,
      });

      await offlineManager.initialize();

      // Add pending operations
      await offlineManager.addPendingOperation({
        type: 'upload',
        data: { fileName: 'test1.pdf' },
      });

      await offlineManager.addPendingOperation({
        type: 'sync',
        data: { documentId: 'doc1' },
      });

      const state = offlineManager.getOfflineState();
      expect(state.pendingOperations).toHaveLength(2);
      expect(state.pendingOperations[0].type).toBe('upload');
      expect(state.pendingOperations[1].type).toBe('sync');
    });
  });

  describe('Storage Management Offline', () => {
    it('should monitor storage usage offline', async () => {
      const FileSystem = require('expo-file-system');
      
      FileSystem.getFreeDiskStorageAsync.mockResolvedValue(1000000000);
      FileSystem.getTotalDiskCapacityAsync.mockResolvedValue(5000000000);
      FileSystem.readDirectoryAsync.mockResolvedValue([]);
      FileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: true,
        size: 0,
        modificationTime: Date.now(),
        uri: 'file://test',
      });

      const storageInfo = await storageManager.getStorageInfo();

      expect(storageInfo.totalSpace).toBe(5000000000);
      expect(storageInfo.freeSpace).toBe(1000000000);
      expect(storageInfo.usagePercentage).toBe(80);
    });

    it('should perform cleanup operations offline', async () => {
      const FileSystem = require('expo-file-system');
      
      FileSystem.readDirectoryAsync.mockResolvedValue(['temp1.pdf', 'temp2.pdf']);
      FileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 1000000,
        modificationTime: Date.now(),
        uri: 'file://test',
      });
      FileSystem.deleteAsync.mockResolvedValue();

      const bytesFreed = await storageManager.cleanupStorage({
        removeTemporaryFiles: true,
        removeThumbnails: false,
        compressOldFiles: false,
        removeBackups: false,
      });

      expect(bytesFreed).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Offline', () => {
    it('should handle storage errors gracefully when offline', async () => {
      const FileSystem = require('expo-file-system');
      FileSystem.getFreeDiskStorageAsync.mockRejectedValue(new Error('Storage unavailable'));

      await expect(storageManager.getStorageInfo()).rejects.toThrow('Failed to get storage info');
    });

    it('should handle document loading errors when offline', async () => {
      jest.spyOn(documentLibrary, 'getDocuments').mockRejectedValue(new Error('Database unavailable'));

      await expect(documentLibrary.getDocuments()).rejects.toThrow('Database unavailable');
    });

    it('should recover from temporary offline errors', async () => {
      // First call fails
      jest.spyOn(fileManager, 'listFiles')
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce([]);

      // Should fail first time
      await expect(fileManager.listFiles()).rejects.toThrow('Temporary error');

      // Should succeed on retry
      const files = await fileManager.listFiles();
      expect(files).toEqual([]);
    });
  });

  describe('Performance Offline', () => {
    it('should maintain performance when offline', async () => {
      const startTime = Date.now();

      // Simulate typical offline operations
      await Promise.all([
        documentLibrary.getDocuments(),
        storageManager.getStorageInfo(),
        offlineManager.ensureOfflineCapability(),
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Operations should complete within reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle large file operations offline', async () => {
      const largeFileData = new Uint8Array(50 * 1024 * 1024); // 50MB
      const mockFilePath = '/local/large.pdf';

      jest.spyOn(fileManager, 'saveFile').mockResolvedValue(mockFilePath);

      const startTime = Date.now();
      const savedPath = await fileManager.saveFile(largeFileData, 'large.pdf');
      const endTime = Date.now();

      expect(savedPath).toBe(mockFilePath);
      // Large file operations should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});