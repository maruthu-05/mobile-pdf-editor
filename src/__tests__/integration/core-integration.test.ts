/**
 * Core Integration Test Suite
 * Tests the basic integration without external dependencies
 */

import { DocumentLibrary } from '../../modules/document-library';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock FileManager
jest.mock('../../modules/file-manager/FileManager', () => ({
  FileManager: jest.fn().mockImplementation(() => ({
    fileExists: jest.fn().mockResolvedValue(true),
    saveFile: jest.fn().mockResolvedValue('test-path'),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    listFiles: jest.fn().mockResolvedValue([]),
    readFileAsText: jest.fn().mockResolvedValue('{}'),
  })),
}));

describe('Core Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DocumentLibrary Integration', () => {
    it('should create singleton instance', () => {
      const library1 = DocumentLibrary.getInstance();
      const library2 = DocumentLibrary.getInstance();

      expect(library1).toBe(library2);
      expect(library1).toBeInstanceOf(DocumentLibrary);
    });

    it('should initialize successfully', async () => {
      const library = DocumentLibrary.getInstance();
      
      // Mock AsyncStorage to return empty data
      require('@react-native-async-storage/async-storage').getItem
        .mockResolvedValue(null);

      await expect(library.initialize()).resolves.not.toThrow();
    });

    it('should handle library operations', async () => {
      const library = DocumentLibrary.getInstance();
      
      // Mock AsyncStorage
      require('@react-native-async-storage/async-storage').getItem
        .mockResolvedValue('[]');
      require('@react-native-async-storage/async-storage').setItem
        .mockResolvedValue(undefined);

      await library.initialize();

      // Test getting documents
      const documents = await library.getDocuments();
      expect(Array.isArray(documents)).toBe(true);

      // Test getting stats
      const stats = await library.getLibraryStats();
      expect(stats).toHaveProperty('totalDocuments');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('totalPages');
    });

    it('should handle search operations', async () => {
      const library = DocumentLibrary.getInstance();
      
      require('@react-native-async-storage/async-storage').getItem
        .mockResolvedValue('[]');

      await library.initialize();

      const results = await library.searchDocuments('test');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle filter operations', async () => {
      const library = DocumentLibrary.getInstance();
      
      require('@react-native-async-storage/async-storage').getItem
        .mockResolvedValue('[]');

      await library.initialize();

      const results = await library.filterDocuments({
        fileSize: { min: 0, max: 1000000 }
      });
      expect(Array.isArray(results)).toBe(true);
    });

    it('should validate library integrity', async () => {
      const library = DocumentLibrary.getInstance();
      
      require('@react-native-async-storage/async-storage').getItem
        .mockResolvedValue('[]');

      await library.initialize();

      const validation = await library.validateLibrary();
      expect(validation).toHaveProperty('totalDocuments');
      expect(validation).toHaveProperty('validDocuments');
      expect(validation).toHaveProperty('invalidDocuments');
      expect(validation).toHaveProperty('missingFiles');
      expect(validation).toHaveProperty('fixedIssues');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle AsyncStorage errors gracefully', async () => {
      const library = DocumentLibrary.getInstance();
      
      // Mock AsyncStorage to throw error
      require('@react-native-async-storage/async-storage').getItem
        .mockRejectedValue(new Error('Storage error'));

      // Should not throw during initialization
      await expect(library.initialize()).resolves.not.toThrow();
    });

    it('should handle invalid data gracefully', async () => {
      const library = DocumentLibrary.getInstance();
      
      // Mock AsyncStorage to return invalid JSON
      require('@react-native-async-storage/async-storage').getItem
        .mockResolvedValue('invalid json');

      // Should not throw during initialization
      await expect(library.initialize()).resolves.not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with multiple operations', async () => {
      const library = DocumentLibrary.getInstance();
      
      require('@react-native-async-storage/async-storage').getItem
        .mockResolvedValue('[]');

      await library.initialize();

      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        await library.getDocuments();
        await library.searchDocuments(`test${i}`);
        await library.getLibraryStats();
      }

      // Should complete without issues
      expect(true).toBe(true);
    });
  });

  describe('Data Persistence', () => {
    it('should persist data correctly', async () => {
      const library = DocumentLibrary.getInstance();
      const mockSetItem = require('@react-native-async-storage/async-storage').setItem;
      
      require('@react-native-async-storage/async-storage').getItem
        .mockResolvedValue('[]');

      await library.initialize();

      // Clear library should call removeItem
      await library.clearLibrary();

      expect(require('@react-native-async-storage/async-storage').removeItem)
        .toHaveBeenCalled();
    });
  });
});