import { MemoryManager, LRUCache } from '../MemoryManager';
import { LazyLoader } from '../LazyLoader';
import { BackgroundProcessor } from '../BackgroundProcessor';
import { ImageData } from '../../../types';

/**
 * Performance benchmark tests for memory management and caching systems
 */
describe('Performance Benchmarks', () => {
  let memoryManager: MemoryManager;
  let lazyLoader: LazyLoader;
  let backgroundProcessor: BackgroundProcessor;

  beforeEach(() => {
    // Reset singletons
    (MemoryManager as any).instance = undefined;
    (BackgroundProcessor as any).instance = undefined;
    
    memoryManager = MemoryManager.getInstance();
    lazyLoader = new LazyLoader();
    backgroundProcessor = BackgroundProcessor.getInstance();
  });

  afterEach(() => {
    memoryManager.cleanup();
    backgroundProcessor.stop();
  });

  describe('LRU Cache Performance', () => {
    test('should handle large number of cache operations efficiently', () => {
      const cache = new LRUCache<string, string>(1000);
      const iterations = 10000;
      
      const startTime = performance.now();
      
      // Perform cache operations
      for (let i = 0; i < iterations; i++) {
        cache.set(`key-${i}`, `value-${i}`);
        if (i % 2 === 0) {
          cache.get(`key-${i / 2}`);
        }
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`LRU Cache: ${iterations} operations completed in ${duration.toFixed(2)}ms`);
      console.log(`Average: ${(duration / iterations).toFixed(4)}ms per operation`);
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000); // 1 second for 10k operations
      expect(cache.size()).toBeLessThanOrEqual(1000);
    });

    test('should maintain performance with frequent evictions', () => {
      const cache = new LRUCache<string, string>(100); // Small cache for frequent evictions
      const iterations = 5000;
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        cache.set(`key-${i}`, `value-${i}`);
        // Access some older items to test LRU behavior
        if (i > 50) {
          cache.get(`key-${i - 50}`);
        }
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`LRU Cache with evictions: ${iterations} operations in ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(500);
      expect(cache.size()).toBe(100);
    });
  });

  describe('Memory Manager Performance', () => {
    test('should handle concurrent cache operations efficiently', async () => {
      const mockImageData: ImageData = {
        uri: 'test://image.png',
        width: 100,
        height: 150
      };
      
      const iterations = 1000;
      const startTime = performance.now();
      
      // Simulate concurrent caching operations
      const promises = [];
      for (let i = 0; i < iterations; i++) {
        promises.push(Promise.resolve().then(() => {
          memoryManager.cacheImage(`image-${i}`, mockImageData);
          memoryManager.cacheThumbnail(`thumb-${i}`, mockImageData);
          memoryManager.cacheDocument(`doc-${i}`, { pages: i });
          
          // Retrieve some cached items
          if (i % 10 === 0) {
            memoryManager.getCachedImage(`image-${i / 2}`);
            memoryManager.getCachedThumbnail(`thumb-${i / 2}`);
          }
        }));
      }
      
      await Promise.all(promises);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`Memory Manager: ${iterations} concurrent operations in ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(1000);
      
      const stats = memoryManager.getCacheStats();
      expect(stats.imageCache.size).toBeGreaterThan(0);
      expect(stats.thumbnailCache.size).toBeGreaterThan(0);
      expect(stats.documentCache.size).toBeGreaterThan(0);
    });

    test('should perform memory cleanup efficiently', () => {
      const mockImageData: ImageData = {
        uri: 'test://image.png',
        width: 100,
        height: 150
      };
      
      // Fill caches
      for (let i = 0; i < 1000; i++) {
        memoryManager.cacheImage(`image-${i}`, mockImageData);
        memoryManager.cacheThumbnail(`thumb-${i}`, mockImageData);
        memoryManager.cacheDocument(`doc-${i}`, { pages: i });
      }
      
      const startTime = performance.now();
      memoryManager.clearAllCaches();
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      console.log(`Memory cleanup completed in ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(100); // Should be very fast
      
      const stats = memoryManager.getCacheStats();
      expect(stats.imageCache.size).toBe(0);
      expect(stats.thumbnailCache.size).toBe(0);
      expect(stats.documentCache.size).toBe(0);
    });
  });

  describe('Lazy Loader Performance', () => {
    test('should handle multiple concurrent load requests efficiently', async () => {
      const mockImageData: ImageData = {
        uri: 'test://image.png',
        width: 100,
        height: 150
      };
      
      let renderCallCount = 0;
      lazyLoader.onPageRender = jest.fn().mockImplementation(async () => {
        renderCallCount++;
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 1));
        return mockImageData;
      });
      
      const concurrentRequests = 100;
      const startTime = performance.now();
      
      // Make concurrent load requests
      const promises = [];
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(lazyLoader.loadPage(`/test/doc-${i % 10}.pdf`, i % 5 + 1, 1.0));
      }
      
      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`Lazy Loader: ${concurrentRequests} concurrent requests in ${duration.toFixed(2)}ms`);
      console.log(`Render calls: ${renderCallCount} (cache hits: ${concurrentRequests - renderCallCount})`);
      
      // All requests should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // Should benefit from caching (fewer render calls than requests)
      expect(renderCallCount).toBeLessThan(concurrentRequests);
      expect(duration).toBeLessThan(2000);
    });

    test('should efficiently manage preload queue', async () => {
      const mockImageData: ImageData = {
        uri: 'test://image.png',
        width: 100,
        height: 150
      };
      
      lazyLoader.onPageRender = jest.fn().mockResolvedValue(mockImageData);
      lazyLoader.onThumbnailGenerate = jest.fn().mockResolvedValue(mockImageData);
      
      const startTime = performance.now();
      
      // Trigger multiple preload operations
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(lazyLoader.preloadPages(`/test/doc-${i}.pdf`, 5, 20, 1.0));
        promises.push(lazyLoader.preloadThumbnails([`/test/doc-${i}.pdf`]));
      }
      
      await Promise.all(promises);
      
      // Wait for background processing to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`Preload operations completed in ${duration.toFixed(2)}ms`);
      
      const queueStatus = lazyLoader.getQueueStatus();
      expect(queueStatus.queueLength).toBe(0); // All processed
      expect(duration).toBeLessThan(3000);
    });
  });

  describe('Background Processor Performance', () => {
    test('should handle high task throughput efficiently', async () => {
      const taskCount = 100;
      let processedCount = 0;
      
      // Register a fast executor
      backgroundProcessor.registerExecutor('test', async (data, onProgress) => {
        processedCount++;
        onProgress(100);
        return `result-${data.id}`;
      });
      
      backgroundProcessor.setMaxConcurrentTasks(5);
      
      const startTime = performance.now();
      
      // Add many tasks
      const taskIds = [];
      for (let i = 0; i < taskCount; i++) {
        const taskId = backgroundProcessor.addTask('test', { id: i }, 'medium');
        taskIds.push(taskId);
      }
      
      // Wait for all tasks to complete
      while (processedCount < taskCount) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`Background Processor: ${taskCount} tasks completed in ${duration.toFixed(2)}ms`);
      console.log(`Throughput: ${(taskCount / (duration / 1000)).toFixed(2)} tasks/second`);
      
      const stats = backgroundProcessor.getQueueStats();
      expect(stats.completed).toBe(taskCount);
      expect(stats.failed).toBe(0);
      expect(duration).toBeLessThan(5000);
    });

    test('should efficiently manage task priorities', async () => {
      const executionOrder: number[] = [];
      
      backgroundProcessor.registerExecutor('priority-test', async (data) => {
        executionOrder.push(data.priority);
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'completed';
      });
      
      backgroundProcessor.setMaxConcurrentTasks(1); // Sequential execution
      
      const startTime = performance.now();
      
      // Add tasks with different priorities
      for (let i = 0; i < 30; i++) {
        const priority = i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low';
        backgroundProcessor.addTask('priority-test', { priority: i }, priority as any);
      }
      
      // Wait for all tasks to complete
      while (backgroundProcessor.getQueueStats().completed < 30) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`Priority management test completed in ${duration.toFixed(2)}ms`);
      
      // Verify high priority tasks were executed first
      const highPriorityTasks = executionOrder.filter((_, i) => i % 3 === 0);
      const firstFewTasks = executionOrder.slice(0, 10);
      const highPriorityInFirst = firstFewTasks.filter(p => p % 3 === 0).length;
      
      expect(highPriorityInFirst).toBeGreaterThan(2); // Most high priority tasks should be early
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Memory Usage Benchmarks', () => {
    test('should maintain reasonable memory usage under load', async () => {
      const mockImageData: ImageData = {
        uri: 'test://large-image.png',
        width: 1000,
        height: 1500
      };
      
      const initialStats = memoryManager.getMemoryStats();
      
      // Simulate heavy usage
      for (let i = 0; i < 500; i++) {
        memoryManager.cacheImage(`large-image-${i}`, mockImageData);
        
        // Periodically check memory and trigger cleanup if needed
        if (i % 50 === 0) {
          const stats = memoryManager.getMemoryStats();
          console.log(`Iteration ${i}: Cache size ${stats.cacheSize}, Memory usage: ${stats.usedJSHeapSize}`);
        }
      }
      
      const finalStats = memoryManager.getMemoryStats();
      const cacheStats = memoryManager.getCacheStats();
      
      console.log('Final cache stats:', cacheStats);
      console.log('Memory stats:', finalStats);
      
      // Cache should have reasonable limits due to LRU eviction
      expect(cacheStats.imageCache.size).toBeLessThanOrEqual(cacheStats.imageCache.maxSize);
      
      // Memory usage should be controlled
      if (finalStats.jsHeapSizeLimit > 0) {
        const memoryUsageRatio = finalStats.usedJSHeapSize / finalStats.jsHeapSizeLimit;
        expect(memoryUsageRatio).toBeLessThan(0.9); // Should not exceed 90% of limit
      }
    });
  });

  describe('Integration Performance', () => {
    test('should handle realistic PDF viewer scenario efficiently', async () => {
      const mockImageData: ImageData = {
        uri: 'test://page.png',
        width: 800,
        height: 1200
      };
      
      // Set up realistic callbacks
      lazyLoader.onPageRender = jest.fn().mockImplementation(async (filePath, pageNumber, scale) => {
        // Simulate rendering time based on scale
        const renderTime = Math.max(10, scale * 50);
        await new Promise(resolve => setTimeout(resolve, renderTime));
        return {
          ...mockImageData,
          width: Math.round(mockImageData.width * scale),
          height: Math.round(mockImageData.height * scale)
        };
      });
      
      lazyLoader.onThumbnailGenerate = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return { ...mockImageData, width: 150, height: 200 };
      });
      
      const startTime = performance.now();
      
      // Simulate user scrolling through a document
      const filePath = '/test/large-document.pdf';
      const totalPages = 50;
      
      // Load current page and preload surrounding pages
      for (let currentPage = 1; currentPage <= 10; currentPage++) {
        // Load current page at full scale
        const pageResult = await lazyLoader.loadPage(filePath, currentPage, 1.0);
        expect(pageResult.success).toBe(true);
        
        // Preload surrounding pages
        await lazyLoader.preloadPages(filePath, currentPage, totalPages, 1.0);
        
        // Load thumbnail
        const thumbResult = await lazyLoader.loadThumbnail(filePath);
        expect(thumbResult.success).toBe(true);
      }
      
      // Wait for background preloading to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`PDF viewer simulation completed in ${duration.toFixed(2)}ms`);
      
      const cacheStats = memoryManager.getCacheStats();
      console.log('Final cache utilization:', cacheStats);
      
      // Should complete in reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds
      
      // Should have cached content
      expect(cacheStats.imageCache.size).toBeGreaterThan(0);
      expect(cacheStats.thumbnailCache.size).toBeGreaterThan(0);
    });
  });
});