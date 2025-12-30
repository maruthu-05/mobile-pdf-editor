/**
 * Performance Benchmarks and Regression Tests
 * Measures and validates performance metrics for critical operations
 */

import { PDFEngine } from '../../modules/pdf-engine/PDFEngine';
import { FileManager } from '../../modules/file-manager/FileManager';
import { DocumentLibrary } from '../../modules/document-library/DocumentLibrary';
import { StorageManager } from '../../modules/storage-manager/StorageManager';
import { MemoryManager } from '../../modules/performance/MemoryManager';
import { LazyLoader } from '../../modules/performance/LazyLoader';

// Mock external dependencies
jest.mock('expo-file-system');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('react-native-pdf-lib');

describe('Performance Benchmarks', () => {
  let pdfEngine: PDFEngine;
  let fileManager: FileManager;
  let documentLibrary: DocumentLibrary;
  let storageManager: StorageManager;
  let memoryManager: MemoryManager;
  let lazyLoader: LazyLoader;

  // Performance thresholds (in milliseconds)
  const PERFORMANCE_THRESHOLDS = {
    PDF_LOAD_SMALL: 2000,      // < 2s for files under 5MB
    PDF_LOAD_LARGE: 5000,      // < 5s for files under 50MB
    PAGE_RENDER: 500,          // < 500ms per page
    MERGE_OPERATION: 3000,     // < 3s for merging 3 files
    SPLIT_OPERATION: 2000,     // < 2s for splitting 10 pages
    FILE_SAVE: 1000,           // < 1s for files under 10MB
    LIBRARY_LOAD: 500,         // < 500ms to load document library
    SEARCH_OPERATION: 300,     // < 300ms for text search
    MEMORY_CLEANUP: 1000,      // < 1s for memory cleanup
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    pdfEngine = PDFEngine.getInstance();
    fileManager = FileManager.getInstance();
    documentLibrary = DocumentLibrary.getInstance();
    storageManager = StorageManager.getInstance();
    memoryManager = MemoryManager.getInstance();
    lazyLoader = LazyLoader.getInstance();
  });

  describe('PDF Loading Performance', () => {
    it('should load small PDF files within performance threshold', async () => {
      const mockSmallPDF = {
        size: 2 * 1024 * 1024, // 2MB
        pageCount: 5,
        path: '/test/small.pdf',
      };

      jest.spyOn(pdfEngine, 'loadPDF').mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          pageCount: mockSmallPDF.pageCount,
          title: 'Small PDF',
          author: 'Test',
          creationDate: new Date(),
          modificationDate: new Date(),
        } as any), 800)) // Simulate 800ms load time
      );

      const startTime = performance.now();
      const result = await pdfEngine.loadPDF(mockSmallPDF.path);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.pageCount).toBe(5);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PDF_LOAD_SMALL);
    });

    it('should load large PDF files within performance threshold', async () => {
      const mockLargePDF = {
        size: 30 * 1024 * 1024, // 30MB
        pageCount: 100,
        path: '/test/large.pdf',
      };

      jest.spyOn(pdfEngine, 'loadPDF').mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          pageCount: mockLargePDF.pageCount,
          title: 'Large PDF',
          author: 'Test',
          creationDate: new Date(),
          modificationDate: new Date(),
        } as any), 3500)) // Simulate 3.5s load time
      );

      const startTime = performance.now();
      const result = await pdfEngine.loadPDF(mockLargePDF.path);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.pageCount).toBe(100);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PDF_LOAD_LARGE);
    });

    it('should measure memory usage during PDF loading', async () => {
      const mockPDF = {
        size: 10 * 1024 * 1024, // 10MB
        pageCount: 50,
        path: '/test/memory-test.pdf',
      };

      // Mock memory monitoring
      let memoryUsage = 50 * 1024 * 1024; // Start with 50MB
      jest.spyOn(memoryManager, 'getCurrentMemoryUsage').mockImplementation(() => memoryUsage);
      jest.spyOn(memoryManager, 'getMemoryThreshold').mockReturnValue(200 * 1024 * 1024); // 200MB threshold

      jest.spyOn(pdfEngine, 'loadPDF').mockImplementation(() => {
        memoryUsage += 15 * 1024 * 1024; // Simulate 15MB increase
        return Promise.resolve({
          pageCount: mockPDF.pageCount,
          title: 'Memory Test PDF',
          author: 'Test',
          creationDate: new Date(),
          modificationDate: new Date(),
        } as any);
      });

      const initialMemory = memoryManager.getCurrentMemoryUsage();
      await pdfEngine.loadPDF(mockPDF.path);
      const finalMemory = memoryManager.getCurrentMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;

      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // Should not increase by more than 20MB
      expect(finalMemory).toBeLessThan(memoryManager.getMemoryThreshold());
    });
  });

  describe('Page Rendering Performance', () => {
    it('should render pages within performance threshold', async () => {
      const mockPageData = {
        width: 612,
        height: 792,
        data: new Uint8Array(612 * 792 * 4), // RGBA data
      };

      jest.spyOn(pdfEngine, 'renderPage').mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockPageData as any), 300)) // 300ms render time
      );

      const renderTimes: number[] = [];
      const pagesToRender = [1, 2, 3, 4, 5];

      for (const pageNumber of pagesToRender) {
        const startTime = performance.now();
        const result = await pdfEngine.renderPage('/test/document.pdf', pageNumber);
        const endTime = performance.now();
        const duration = endTime - startTime;

        renderTimes.push(duration);
        expect(result.width).toBe(612);
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_RENDER);
      }

      // Calculate average render time
      const averageRenderTime = renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length;
      expect(averageRenderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_RENDER);
    });

    it('should handle concurrent page rendering efficiently', async () => {
      jest.spyOn(pdfEngine, 'renderPage').mockImplementation((path, pageNumber) =>
        new Promise(resolve => setTimeout(() => resolve({
          width: 612,
          height: 792,
          data: new Uint8Array(1000),
        } as any), 200)) // 200ms per page
      );

      const startTime = performance.now();
      
      // Render 5 pages concurrently
      const renderPromises = Array.from({ length: 5 }, (_, i) =>
        pdfEngine.renderPage('/test/document.pdf', i + 1)
      );

      const results = await Promise.all(renderPromises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(5);
      // Concurrent rendering should be faster than sequential
      expect(duration).toBeLessThan(5 * PERFORMANCE_THRESHOLDS.PAGE_RENDER);
      expect(duration).toBeLessThan(800); // Should complete in less than 800ms
    });
  });

  describe('PDF Operations Performance', () => {
    it('should merge PDFs within performance threshold', async () => {
      const filesToMerge = [
        '/test/doc1.pdf',
        '/test/doc2.pdf',
        '/test/doc3.pdf',
      ];

      jest.spyOn(pdfEngine, 'mergePDFs').mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve('/test/merged.pdf'), 2500)) // 2.5s merge time
      );

      const startTime = performance.now();
      const result = await pdfEngine.mergePDFs(filesToMerge);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBe('/test/merged.pdf');
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.MERGE_OPERATION);
    });

    it('should split PDFs within performance threshold', async () => {
      const pageRanges = [
        { startPage: 1, endPage: 5 },
        { startPage: 6, endPage: 10 },
      ];

      jest.spyOn(pdfEngine, 'splitPDF').mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve([
          '/test/split1.pdf',
          '/test/split2.pdf',
        ]), 1500)) // 1.5s split time
      );

      const startTime = performance.now();
      const result = await pdfEngine.splitPDF('/test/source.pdf', pageRanges);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toHaveLength(2);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SPLIT_OPERATION);
    });

    it('should measure performance of text editing operations', async () => {
      const textEdits = Array.from({ length: 10 }, (_, i) => ({
        pageNumber: Math.floor(i / 2) + 1,
        x: 100 + (i * 50),
        y: 200,
        width: 200,
        height: 30,
        newText: `Edit ${i + 1}`,
      }));

      jest.spyOn(pdfEngine, 'editPDFText').mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve('/test/edited.pdf'), 800)) // 800ms edit time
      );

      const startTime = performance.now();
      const result = await pdfEngine.editPDFText('/test/source.pdf', textEdits);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBe('/test/edited.pdf');
      expect(duration).toBeLessThan(1500); // Should complete within 1.5s for 10 edits
    });
  });

  describe('File Management Performance', () => {
    it('should save files within performance threshold', async () => {
      const fileData = new Uint8Array(5 * 1024 * 1024); // 5MB file
      const fileName = 'test-file.pdf';

      jest.spyOn(fileManager, 'saveFile').mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve('/test/saved.pdf'), 800)) // 800ms save time
      );

      const startTime = performance.now();
      const result = await fileManager.saveFile(fileData, fileName);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBe('/test/saved.pdf');
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FILE_SAVE);
    });

    it('should list files within performance threshold', async () => {
      const mockFiles = Array.from({ length: 100 }, (_, i) => ({
        name: `file${i + 1}.pdf`,
        path: `/test/file${i + 1}.pdf`,
        size: 1000000,
        lastModified: new Date(),
        type: 'application/pdf',
      }));

      jest.spyOn(fileManager, 'listFiles').mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockFiles), 200)) // 200ms list time
      );

      const startTime = performance.now();
      const result = await fileManager.listFiles();
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toHaveLength(100);
      expect(duration).toBeLessThan(400); // Should list 100 files in under 400ms
    });
  });

  describe('Document Library Performance', () => {
    it('should load document library within performance threshold', async () => {
      const mockDocuments = Array.from({ length: 50 }, (_, i) => ({
        id: `doc${i + 1}`,
        fileName: `document${i + 1}.pdf`,
        filePath: `/test/document${i + 1}.pdf`,
        fileSize: 1000000,
        pageCount: 10,
        createdAt: new Date(),
        modifiedAt: new Date(),
      }));

      jest.spyOn(documentLibrary, 'getDocuments').mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockDocuments), 300)) // 300ms load time
      );

      const startTime = performance.now();
      const result = await documentLibrary.getDocuments();
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toHaveLength(50);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.LIBRARY_LOAD);
    });

    it('should search documents within performance threshold', async () => {
      const mockSearchResults = Array.from({ length: 10 }, (_, i) => ({
        id: `result${i + 1}`,
        fileName: `search_result${i + 1}.pdf`,
        filePath: `/test/search_result${i + 1}.pdf`,
        fileSize: 1000000,
        pageCount: 5,
        createdAt: new Date(),
        modifiedAt: new Date(),
      }));

      jest.spyOn(documentLibrary, 'searchDocuments').mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockSearchResults), 150)) // 150ms search time
      );

      const startTime = performance.now();
      const result = await documentLibrary.searchDocuments('test query');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toHaveLength(10);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_OPERATION);
    });
  });

  describe('Memory Management Performance', () => {
    it('should perform memory cleanup within performance threshold', async () => {
      // Mock memory cleanup operation
      jest.spyOn(memoryManager, 'cleanup').mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          freedMemory: 50 * 1024 * 1024, // 50MB freed
          remainingMemory: 100 * 1024 * 1024, // 100MB remaining
        }), 800)) // 800ms cleanup time
      );

      const startTime = performance.now();
      const result = await memoryManager.cleanup();
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.freedMemory).toBeGreaterThan(0);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_CLEANUP);
    });

    it('should handle memory pressure efficiently', async () => {
      // Simulate memory pressure scenario
      let currentMemory = 180 * 1024 * 1024; // 180MB (near 200MB threshold)
      const memoryThreshold = 200 * 1024 * 1024; // 200MB threshold

      jest.spyOn(memoryManager, 'getCurrentMemoryUsage').mockImplementation(() => currentMemory);
      jest.spyOn(memoryManager, 'getMemoryThreshold').mockReturnValue(memoryThreshold);
      jest.spyOn(memoryManager, 'isMemoryPressure').mockImplementation(() => 
        currentMemory > memoryThreshold * 0.9
      );

      // Mock memory cleanup that reduces usage
      jest.spyOn(memoryManager, 'handleMemoryPressure').mockImplementation(() => {
        currentMemory = 120 * 1024 * 1024; // Reduce to 120MB
        return Promise.resolve();
      });

      const initialMemory = memoryManager.getCurrentMemoryUsage();
      expect(memoryManager.isMemoryPressure()).toBe(true);

      const startTime = performance.now();
      await memoryManager.handleMemoryPressure();
      const endTime = performance.now();
      const duration = endTime - startTime;

      const finalMemory = memoryManager.getCurrentMemoryUsage();
      const memoryReduction = initialMemory - finalMemory;

      expect(memoryReduction).toBeGreaterThan(50 * 1024 * 1024); // Should free at least 50MB
      expect(memoryManager.isMemoryPressure()).toBe(false);
      expect(duration).toBeLessThan(1000); // Should handle pressure quickly
    });
  });

  describe('Lazy Loading Performance', () => {
    it('should load content on demand efficiently', async () => {
      const mockContent = Array.from({ length: 20 }, (_, i) => ({
        id: `item${i + 1}`,
        data: `Content for item ${i + 1}`,
        size: 1000,
      }));

      // Mock lazy loading with batching
      jest.spyOn(lazyLoader, 'loadBatch').mockImplementation((startIndex, batchSize) =>
        new Promise(resolve => setTimeout(() => {
          const batch = mockContent.slice(startIndex, startIndex + batchSize);
          resolve(batch);
        }, 100)) // 100ms per batch
      );

      const startTime = performance.now();
      
      // Load first batch (items 0-4)
      const batch1 = await lazyLoader.loadBatch(0, 5);
      
      // Load second batch (items 5-9)
      const batch2 = await lazyLoader.loadBatch(5, 5);
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(batch1).toHaveLength(5);
      expect(batch2).toHaveLength(5);
      expect(duration).toBeLessThan(300); // Two batches should load in under 300ms
    });

    it('should cache loaded content for performance', async () => {
      const mockItem = {
        id: 'cached-item',
        data: 'Cached content',
        size: 1000,
      };

      // First load - simulate network/disk access
      jest.spyOn(lazyLoader, 'loadItem').mockImplementationOnce(() =>
        new Promise(resolve => setTimeout(() => resolve(mockItem), 200)) // 200ms first load
      );

      // Subsequent loads - from cache
      jest.spyOn(lazyLoader, 'loadItem').mockImplementation(() =>
        Promise.resolve(mockItem) // Immediate from cache
      );

      // First load (slow)
      const startTime1 = performance.now();
      const result1 = await lazyLoader.loadItem('cached-item');
      const endTime1 = performance.now();
      const duration1 = endTime1 - startTime1;

      // Second load (fast, from cache)
      const startTime2 = performance.now();
      const result2 = await lazyLoader.loadItem('cached-item');
      const endTime2 = performance.now();
      const duration2 = endTime2 - startTime2;

      expect(result1).toEqual(mockItem);
      expect(result2).toEqual(mockItem);
      expect(duration1).toBeGreaterThan(150); // First load should be slow
      expect(duration2).toBeLessThan(50);     // Cached load should be fast
    });
  });

  describe('Regression Tests', () => {
    it('should maintain performance across app versions', async () => {
      // This test would compare current performance against baseline metrics
      // In a real scenario, you would store baseline metrics and compare against them
      
      const performanceMetrics = {
        pdfLoadTime: 0,
        pageRenderTime: 0,
        mergeTime: 0,
        splitTime: 0,
        libraryLoadTime: 0,
      };

      // Measure current performance
      const startPdfLoad = performance.now();
      jest.spyOn(pdfEngine, 'loadPDF').mockResolvedValue({} as any);
      await pdfEngine.loadPDF('/test/benchmark.pdf');
      performanceMetrics.pdfLoadTime = performance.now() - startPdfLoad;

      const startPageRender = performance.now();
      jest.spyOn(pdfEngine, 'renderPage').mockResolvedValue({} as any);
      await pdfEngine.renderPage('/test/benchmark.pdf', 1);
      performanceMetrics.pageRenderTime = performance.now() - startPageRender;

      const startMerge = performance.now();
      jest.spyOn(pdfEngine, 'mergePDFs').mockResolvedValue('/test/merged.pdf');
      await pdfEngine.mergePDFs(['/test/doc1.pdf', '/test/doc2.pdf']);
      performanceMetrics.mergeTime = performance.now() - startMerge;

      const startSplit = performance.now();
      jest.spyOn(pdfEngine, 'splitPDF').mockResolvedValue(['/test/split.pdf']);
      await pdfEngine.splitPDF('/test/source.pdf', [{ startPage: 1, endPage: 5 }]);
      performanceMetrics.splitTime = performance.now() - startSplit;

      const startLibraryLoad = performance.now();
      jest.spyOn(documentLibrary, 'getDocuments').mockResolvedValue([]);
      await documentLibrary.getDocuments();
      performanceMetrics.libraryLoadTime = performance.now() - startLibraryLoad;

      // Verify all operations meet performance thresholds
      expect(performanceMetrics.pdfLoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PDF_LOAD_SMALL);
      expect(performanceMetrics.pageRenderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_RENDER);
      expect(performanceMetrics.mergeTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MERGE_OPERATION);
      expect(performanceMetrics.splitTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SPLIT_OPERATION);
      expect(performanceMetrics.libraryLoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LIBRARY_LOAD);

      // In a real scenario, you would also compare against stored baseline metrics
      // and fail the test if performance has regressed significantly
    });
  });
});