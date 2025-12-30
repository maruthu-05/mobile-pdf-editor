import { OfflineCapabilityChecker } from '../offline-capability-checker';
import { OfflineManager } from '../../modules/storage-manager/OfflineManager';
import { StorageManager } from '../../modules/storage-manager/StorageManager';
import { DocumentLibrary } from '../../modules/document-library/DocumentLibrary';
import { PDFEngine } from '../../modules/pdf-engine/PDFEngine';
import { FileManager } from '../../modules/file-manager/FileManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock all dependencies
jest.mock('../../modules/storage-manager/OfflineManager');
jest.mock('../../modules/storage-manager/StorageManager');
jest.mock('../../modules/document-library/DocumentLibrary');
jest.mock('../../modules/pdf-engine/PDFEngine');
jest.mock('../../modules/file-manager/FileManager');
jest.mock('@react-native-async-storage/async-storage');

const mockOfflineManager = {
  getOfflineState: jest.fn(),
  ensureOfflineCapability: jest.fn(),
};

const mockStorageManager = {
  getStorageInfo: jest.fn(),
  getStorageSettings: jest.fn(),
};

const mockDocumentLibrary = {
  getDocuments: jest.fn(),
  searchDocuments: jest.fn(),
};

const mockPdfEngine = {
  loadPDF: jest.fn(),
  renderPage: jest.fn(),
  editPDFText: jest.fn(),
  addAnnotations: jest.fn(),
};

const mockFileManager = {
  saveFile: jest.fn(),
  listFiles: jest.fn(),
  deleteFile: jest.fn(),
};

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('OfflineCapabilityChecker', () => {
  let checker: OfflineCapabilityChecker;

  beforeEach(() => {
    jest.clearAllMocks();
    
    (OfflineManager.getInstance as jest.Mock).mockReturnValue(mockOfflineManager);
    (StorageManager.getInstance as jest.Mock).mockReturnValue(mockStorageManager);
    (DocumentLibrary.getInstance as jest.Mock).mockReturnValue(mockDocumentLibrary);
    (PDFEngine.getInstance as jest.Mock).mockReturnValue(mockPdfEngine);
    (FileManager.getInstance as jest.Mock).mockReturnValue(mockFileManager);

    checker = OfflineCapabilityChecker.getInstance();

    // Setup default successful mocks
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.getItem.mockResolvedValue('{"test":true,"timestamp":123456789}');
    mockAsyncStorage.removeItem.mockResolvedValue();
    
    mockOfflineManager.getOfflineState.mockReturnValue({
      isOnline: false,
      lastOnlineTime: new Date(),
      pendingOperations: [],
    });
    mockOfflineManager.ensureOfflineCapability.mockResolvedValue(true);
    
    mockStorageManager.getStorageInfo.mockResolvedValue({
      totalSpace: 5000000000,
      freeSpace: 1000000000,
      usedSpace: 4000000000,
      appUsedSpace: 500000000,
      usagePercentage: 80,
    });
    mockStorageManager.getStorageSettings.mockResolvedValue({});
    
    mockDocumentLibrary.getDocuments.mockResolvedValue([]);
    mockDocumentLibrary.searchDocuments.mockResolvedValue([]);
    
    mockFileManager.listFiles.mockResolvedValue([]);
  });

  describe('checkAllCapabilities', () => {
    it('should return fully offline capable when all features work', async () => {
      const result = await checker.checkAllCapabilities();

      expect(result.isFullyOfflineCapable).toBe(true);
      expect(Object.keys(result.capabilities)).toHaveLength(7);
      expect(result.recommendations).toHaveLength(0);

      // Check that all capabilities are available
      for (const capability of Object.values(result.capabilities)) {
        expect(capability.available).toBe(true);
        expect(capability.performance).toBeGreaterThan(0);
      }
    });

    it('should detect localStorage failures', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage unavailable'));

      const result = await checker.checkAllCapabilities();

      expect(result.isFullyOfflineCapable).toBe(false);
      expect(result.capabilities.localStorage.available).toBe(false);
      expect(result.capabilities.localStorage.error).toContain('Local storage error');
      expect(result.recommendations).toContain(
        'Ensure AsyncStorage is properly configured and accessible'
      );
    });

    it('should detect document loading failures', async () => {
      mockDocumentLibrary.getDocuments.mockRejectedValue(new Error('Database error'));

      const result = await checker.checkAllCapabilities();

      expect(result.isFullyOfflineCapable).toBe(false);
      expect(result.capabilities.documentLoading.available).toBe(false);
      expect(result.capabilities.documentLoading.error).toContain('Document loading error');
    });

    it('should detect PDF viewing capability issues', async () => {
      // Mock missing PDF engine methods
      const incompletePdfEngine = {
        loadPDF: jest.fn(),
        // Missing renderPage method
      };
      (PDFEngine.getInstance as jest.Mock).mockReturnValue(incompletePdfEngine);

      const result = await checker.checkAllCapabilities();

      expect(result.isFullyOfflineCapable).toBe(false);
      expect(result.capabilities.pdfViewing.available).toBe(false);
      expect(result.capabilities.pdfViewing.error).toContain('PDF engine methods not available');
    });

    it('should detect file management issues', async () => {
      mockFileManager.listFiles.mockRejectedValue(new Error('File system error'));

      const result = await checker.checkAllCapabilities();

      expect(result.isFullyOfflineCapable).toBe(false);
      expect(result.capabilities.fileManagement.available).toBe(false);
      expect(result.capabilities.fileManagement.error).toContain('File management error');
    });

    it('should detect storage management issues', async () => {
      mockStorageManager.getStorageInfo.mockRejectedValue(new Error('Storage info error'));

      const result = await checker.checkAllCapabilities();

      expect(result.isFullyOfflineCapable).toBe(false);
      expect(result.capabilities.storageManagement.available).toBe(false);
      expect(result.capabilities.storageManagement.error).toContain('Storage management error');
    });

    it('should detect offline state management issues', async () => {
      mockOfflineManager.getOfflineState.mockReturnValue(null);

      const result = await checker.checkAllCapabilities();

      expect(result.isFullyOfflineCapable).toBe(false);
      expect(result.capabilities.offlineStateManagement.available).toBe(false);
      expect(result.capabilities.offlineStateManagement.error).toContain('Invalid offline state structure');
    });
  });

  describe('performance checking', () => {
    it('should detect slow performance and add recommendations', async () => {
      // Mock slow localStorage operations
      mockAsyncStorage.setItem.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      const result = await checker.checkAllCapabilities();

      expect(result.recommendations.some(rec => 
        rec.includes('localStorage performance is slow')
      )).toBe(true);
    });
  });

  describe('storage requirements checking', () => {
    it('should detect low storage space', async () => {
      mockStorageManager.getStorageInfo.mockResolvedValue({
        totalSpace: 1000000000,
        freeSpace: 50000000, // 50MB - below 100MB threshold
        usedSpace: 950000000,
        appUsedSpace: 100000000,
        usagePercentage: 95,
      });

      const result = await checker.checkAllCapabilities();

      expect(result.recommendations.some(rec => 
        rec.includes('Low storage space')
      )).toBe(true);
    });

    it('should detect critically high storage usage', async () => {
      mockStorageManager.getStorageInfo.mockResolvedValue({
        totalSpace: 1000000000,
        freeSpace: 50000000,
        usedSpace: 950000000,
        appUsedSpace: 100000000,
        usagePercentage: 95, // Above 90% threshold
      });

      const result = await checker.checkAllCapabilities();

      expect(result.recommendations.some(rec => 
        rec.includes('Storage usage is critically high')
      )).toBe(true);
    });
  });

  describe('generateOfflineCapabilityReport', () => {
    it('should generate a comprehensive report for fully capable app', async () => {
      const report = await checker.generateOfflineCapabilityReport();

      expect(report).toContain('# Offline Capability Report');
      expect(report).toContain('✅ **All core features are fully offline capable**');
      expect(report).toContain('## Feature Capabilities');
      expect(report).toContain('7/7 features are offline capable');
      expect(report).toContain('The app is ready for offline use! 🎉');
    });

    it('should generate a report with issues when capabilities are missing', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

      const report = await checker.generateOfflineCapabilityReport();

      expect(report).toContain('❌ **Some features may not work properly offline**');
      expect(report).toContain('❌ **localStorage**');
      expect(report).toContain('## Recommendations');
      expect(report).toContain('6/7 features are offline capable');
      expect(report).toContain('Please address the issues above before using the app offline');
    });

    it('should include performance information in the report', async () => {
      const report = await checker.generateOfflineCapabilityReport();

      // Should include performance timing for each feature
      expect(report).toMatch(/✅ \*\*localStorage\*\* \(\d+ms\)/);
      expect(report).toMatch(/✅ \*\*documentLoading\*\* \(\d+ms\)/);
    });
  });

  describe('data integrity checks', () => {
    it('should verify localStorage data integrity', async () => {
      // Mock data corruption
      mockAsyncStorage.getItem.mockResolvedValue('corrupted_data');

      const result = await checker.checkAllCapabilities();

      expect(result.capabilities.localStorage.available).toBe(false);
      expect(result.capabilities.localStorage.error).toContain('Data integrity check failed');
    });

    it('should verify localStorage deletion works', async () => {
      // Mock deletion failure
      mockAsyncStorage.getItem.mockResolvedValueOnce('test_data')
        .mockResolvedValueOnce('test_data'); // Should return null after deletion

      const result = await checker.checkAllCapabilities();

      expect(result.capabilities.localStorage.available).toBe(false);
      expect(result.capabilities.localStorage.error).toContain('Deletion verification failed');
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = OfflineCapabilityChecker.getInstance();
      const instance2 = OfflineCapabilityChecker.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});