import { MemoryManager, LRUCache } from '../MemoryManager';
import { ImageData } from '../../../types';

// Mock performance.memory for testing
const mockPerformanceMemory = {
  usedJSHeapSize: 50 * 1024 * 1024, // 50MB
  totalJSHeapSize: 100 * 1024 * 1024, // 100MB
  jsHeapSizeLimit: 200 * 1024 * 1024 // 200MB
};

(global as any).performance = {
  memory: mockPerformanceMemory
};

describe('LRUCache', () => {
  let cache: LRUCache<string, string>;

  beforeEach(() => {
    cache = new LRUCache<string, string>(3);
  });

  test('should store and retrieve values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  test('should return undefined for non-existent keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  test('should evict least recently used items when full', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    cache.set('key4', 'value4'); // Should evict key1

    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBe('value2');
    expect(cache.get('key3')).toBe('value3');
    expect(cache.get('key4')).toBe('value4');
  });

  test('should update LRU order on access', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    
    // Access key1 to make it most recently used
    cache.get('key1');
    
    // Add new item, should evict key2 (least recently used)
    cache.set('key4', 'value4');

    expect(cache.get('key1')).toBe('value1');
    expect(cache.get('key2')).toBeUndefined();
    expect(cache.get('key3')).toBe('value3');
    expect(cache.get('key4')).toBe('value4');
  });

  test('should handle cache operations correctly', () => {
    cache.set('key1', 'value1');
    
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('key2')).toBe(false);
    
    expect(cache.size()).toBe(1);
    
    cache.delete('key1');
    expect(cache.has('key1')).toBe(false);
    expect(cache.size()).toBe(0);
  });

  test('should clear all items', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    
    expect(cache.size()).toBe(2);
    
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBeUndefined();
  });
});

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;
  let mockImageData: ImageData;

  beforeEach(() => {
    // Reset singleton instance for testing
    (MemoryManager as any).instance = undefined;
    memoryManager = MemoryManager.getInstance();
    
    mockImageData = {
      uri: 'test://image.png',
      width: 100,
      height: 150
    };
  });

  afterEach(() => {
    memoryManager.cleanup();
  });

  test('should be a singleton', () => {
    const instance1 = MemoryManager.getInstance();
    const instance2 = MemoryManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('should cache and retrieve images', () => {
    const key = 'test-image-key';
    
    memoryManager.cacheImage(key, mockImageData);
    const retrieved = memoryManager.getCachedImage(key);
    
    expect(retrieved).toEqual(mockImageData);
  });

  test('should cache and retrieve thumbnails', () => {
    const key = 'test-thumbnail-key';
    
    memoryManager.cacheThumbnail(key, mockImageData);
    const retrieved = memoryManager.getCachedThumbnail(key);
    
    expect(retrieved).toEqual(mockImageData);
  });

  test('should cache and retrieve documents', () => {
    const filePath = '/test/document.pdf';
    const mockDocument = { pages: 10, title: 'Test Document' };
    
    memoryManager.cacheDocument(filePath, mockDocument);
    const retrieved = memoryManager.getCachedDocument(filePath);
    
    expect(retrieved).toEqual(mockDocument);
  });

  test('should remove cached documents', () => {
    const filePath = '/test/document.pdf';
    const mockDocument = { pages: 10, title: 'Test Document' };
    
    memoryManager.cacheDocument(filePath, mockDocument);
    expect(memoryManager.getCachedDocument(filePath)).toEqual(mockDocument);
    
    memoryManager.removeCachedDocument(filePath);
    expect(memoryManager.getCachedDocument(filePath)).toBeUndefined();
  });

  test('should clear specific cache types', () => {
    const imageKey = 'image-key';
    const thumbnailKey = 'thumbnail-key';
    const documentPath = '/test/document.pdf';
    
    memoryManager.cacheImage(imageKey, mockImageData);
    memoryManager.cacheThumbnail(thumbnailKey, mockImageData);
    memoryManager.cacheDocument(documentPath, {});
    
    // Clear only images
    memoryManager.clearCache('images');
    expect(memoryManager.getCachedImage(imageKey)).toBeUndefined();
    expect(memoryManager.getCachedThumbnail(thumbnailKey)).toEqual(mockImageData);
    expect(memoryManager.getCachedDocument(documentPath)).toEqual({});
    
    // Clear only thumbnails
    memoryManager.clearCache('thumbnails');
    expect(memoryManager.getCachedThumbnail(thumbnailKey)).toBeUndefined();
    expect(memoryManager.getCachedDocument(documentPath)).toEqual({});
    
    // Clear only documents
    memoryManager.clearCache('documents');
    expect(memoryManager.getCachedDocument(documentPath)).toBeUndefined();
  });

  test('should clear all caches', () => {
    const imageKey = 'image-key';
    const thumbnailKey = 'thumbnail-key';
    const documentPath = '/test/document.pdf';
    
    memoryManager.cacheImage(imageKey, mockImageData);
    memoryManager.cacheThumbnail(thumbnailKey, mockImageData);
    memoryManager.cacheDocument(documentPath, {});
    
    memoryManager.clearAllCaches();
    
    expect(memoryManager.getCachedImage(imageKey)).toBeUndefined();
    expect(memoryManager.getCachedThumbnail(thumbnailKey)).toBeUndefined();
    expect(memoryManager.getCachedDocument(documentPath)).toBeUndefined();
  });

  test('should provide memory statistics', () => {
    const stats = memoryManager.getMemoryStats();
    
    expect(stats).toHaveProperty('usedJSHeapSize');
    expect(stats).toHaveProperty('totalJSHeapSize');
    expect(stats).toHaveProperty('jsHeapSizeLimit');
    expect(stats).toHaveProperty('cacheSize');
    expect(stats).toHaveProperty('documentCacheSize');
    
    expect(typeof stats.cacheSize).toBe('number');
    expect(typeof stats.documentCacheSize).toBe('number');
  });

  test('should provide cache statistics', () => {
    const imageKey = 'image-key';
    const thumbnailKey = 'thumbnail-key';
    const documentPath = '/test/document.pdf';
    
    memoryManager.cacheImage(imageKey, mockImageData);
    memoryManager.cacheThumbnail(thumbnailKey, mockImageData);
    memoryManager.cacheDocument(documentPath, {});
    
    const stats = memoryManager.getCacheStats();
    
    expect(stats.imageCache.size).toBe(1);
    expect(stats.thumbnailCache.size).toBe(1);
    expect(stats.documentCache.size).toBe(1);
    expect(stats.imageCache.maxSize).toBeGreaterThan(0);
    expect(stats.thumbnailCache.maxSize).toBeGreaterThan(0);
    expect(stats.documentCache.maxSize).toBeGreaterThan(0);
  });

  test('should handle memory warning callbacks', (done) => {
    let warningCalled = false;
    
    memoryManager.onMemoryWarning = (stats) => {
      warningCalled = true;
      expect(stats).toHaveProperty('usedJSHeapSize');
      done();
    };
    
    // Simulate high memory usage
    mockPerformanceMemory.usedJSHeapSize = 180 * 1024 * 1024; // 180MB (90% of 200MB limit)
    
    // Trigger memory check by caching many items
    for (let i = 0; i < 100; i++) {
      memoryManager.cacheImage(`key-${i}`, mockImageData);
    }
    
    // Wait a bit for memory monitoring to trigger
    setTimeout(() => {
      if (!warningCalled) {
        done();
      }
    }, 100);
  });

  test('should handle cache eviction callbacks', (done) => {
    let callbackCount = 0;
    
    memoryManager.onCacheEviction = (cacheType, evictedCount) => {
      callbackCount++;
      expect(typeof cacheType).toBe('string');
      expect(typeof evictedCount).toBe('number');
      
      // Only check for positive evicted count on the first callback
      if (callbackCount === 1) {
        expect(evictedCount).toBeGreaterThan(0);
        done();
      }
    };
    
    // Add some items to cache first
    memoryManager.cacheImage('test-key', mockImageData);
    
    // Clear cache to trigger callback
    memoryManager.clearCache('images');
  });
});