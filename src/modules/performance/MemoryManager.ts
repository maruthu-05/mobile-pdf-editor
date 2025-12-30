import { ImageData } from '../../types';

/**
 * LRU Cache implementation for managing memory-intensive resources
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing key
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used item
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): IterableIterator<K> {
    return this.cache.keys();
  }
}

/**
 * Memory usage tracking and monitoring
 */
export interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  cacheSize: number;
  documentCacheSize: number;
}

/**
 * Memory Manager for PDF operations and caching
 */
export class MemoryManager {
  private static instance: MemoryManager;
  
  // Image cache with LRU eviction
  private imageCache: LRUCache<string, ImageData>;
  private thumbnailCache: LRUCache<string, ImageData>;
  
  // Document cache for loaded PDFs
  private documentCache: LRUCache<string, any>;
  
  // Memory monitoring
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private readonly memoryThreshold = 0.8; // 80% memory usage threshold
  private readonly maxImageCacheSize = 50;
  private readonly maxThumbnailCacheSize = 100;
  private readonly maxDocumentCacheSize = 10;
  
  // Callbacks for memory events
  public onMemoryWarning?: (stats: MemoryStats) => void;
  public onCacheEviction?: (cacheType: string, evictedCount: number) => void;

  private constructor() {
    this.imageCache = new LRUCache(this.maxImageCacheSize);
    this.thumbnailCache = new LRUCache(this.maxThumbnailCacheSize);
    this.documentCache = new LRUCache(this.maxDocumentCacheSize);
    
    this.startMemoryMonitoring();
  }

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * Get cached page image
   */
  getCachedImage(key: string): ImageData | undefined {
    return this.imageCache.get(key);
  }

  /**
   * Cache page image with automatic memory management
   */
  cacheImage(key: string, imageData: ImageData): void {
    // Check memory before caching
    if (this.isMemoryPressureHigh()) {
      this.performEmergencyCleanup();
    }
    
    this.imageCache.set(key, imageData);
  }

  /**
   * Get cached thumbnail
   */
  getCachedThumbnail(key: string): ImageData | undefined {
    return this.thumbnailCache.get(key);
  }

  /**
   * Cache thumbnail
   */
  cacheThumbnail(key: string, imageData: ImageData): void {
    this.thumbnailCache.set(key, imageData);
  }

  /**
   * Get cached document
   */
  getCachedDocument(filePath: string): any | undefined {
    return this.documentCache.get(filePath);
  }

  /**
   * Cache document
   */
  cacheDocument(filePath: string, document: any): void {
    this.documentCache.set(filePath, document);
  }

  /**
   * Remove document from cache
   */
  removeCachedDocument(filePath: string): void {
    this.documentCache.delete(filePath);
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    const imageCacheSize = this.imageCache.size();
    const thumbnailCacheSize = this.thumbnailCache.size();
    const documentCacheSize = this.documentCache.size();
    
    this.imageCache.clear();
    this.thumbnailCache.clear();
    this.documentCache.clear();
    
    this.onCacheEviction?.('all', imageCacheSize + thumbnailCacheSize + documentCacheSize);
  }

  /**
   * Clear specific cache type
   */
  clearCache(cacheType: 'images' | 'thumbnails' | 'documents'): void {
    let evictedCount = 0;
    
    switch (cacheType) {
      case 'images':
        evictedCount = this.imageCache.size();
        this.imageCache.clear();
        break;
      case 'thumbnails':
        evictedCount = this.thumbnailCache.size();
        this.thumbnailCache.clear();
        break;
      case 'documents':
        evictedCount = this.documentCache.size();
        this.documentCache.clear();
        break;
    }
    
    this.onCacheEviction?.(cacheType, evictedCount);
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): MemoryStats {
    // Note: In React Native, performance.memory might not be available
    // This is a fallback implementation
    const memoryInfo = (global as any).performance?.memory || {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0
    };

    return {
      usedJSHeapSize: memoryInfo.usedJSHeapSize,
      totalJSHeapSize: memoryInfo.totalJSHeapSize,
      jsHeapSizeLimit: memoryInfo.jsHeapSizeLimit,
      cacheSize: this.imageCache.size() + this.thumbnailCache.size(),
      documentCacheSize: this.documentCache.size()
    };
  }

  /**
   * Check if memory pressure is high
   */
  private isMemoryPressureHigh(): boolean {
    const stats = this.getMemoryStats();
    
    if (stats.jsHeapSizeLimit > 0) {
      const memoryUsageRatio = stats.usedJSHeapSize / stats.jsHeapSizeLimit;
      return memoryUsageRatio > this.memoryThreshold;
    }
    
    // Fallback: check cache sizes
    return this.imageCache.size() >= this.maxImageCacheSize * 0.9;
  }

  /**
   * Perform emergency cleanup when memory is low
   */
  private performEmergencyCleanup(): void {
    const initialCacheSize = this.imageCache.size() + this.thumbnailCache.size();
    
    // Clear half of the image cache (oldest items)
    const imagesToEvict = Math.floor(this.imageCache.size() / 2);
    const imageKeys = Array.from(this.imageCache.keys());
    for (let i = 0; i < imagesToEvict; i++) {
      this.imageCache.delete(imageKeys[i]);
    }
    
    // Clear quarter of thumbnail cache
    const thumbnailsToEvict = Math.floor(this.thumbnailCache.size() / 4);
    const thumbnailKeys = Array.from(this.thumbnailCache.keys());
    for (let i = 0; i < thumbnailsToEvict; i++) {
      this.thumbnailCache.delete(thumbnailKeys[i]);
    }
    
    const finalCacheSize = this.imageCache.size() + this.thumbnailCache.size();
    const evictedCount = initialCacheSize - finalCacheSize;
    
    this.onCacheEviction?.('emergency', evictedCount);
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    if (this.memoryCheckInterval) {
      return;
    }
    
    this.memoryCheckInterval = setInterval(() => {
      const stats = this.getMemoryStats();
      
      if (this.isMemoryPressureHigh()) {
        this.onMemoryWarning?.(stats);
        this.performEmergencyCleanup();
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop memory monitoring
   */
  stopMemoryMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }

  /**
   * Cleanup resources when shutting down
   */
  cleanup(): void {
    this.stopMemoryMonitoring();
    this.clearAllCaches();
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats() {
    return {
      imageCache: {
        size: this.imageCache.size(),
        maxSize: this.maxImageCacheSize
      },
      thumbnailCache: {
        size: this.thumbnailCache.size(),
        maxSize: this.maxThumbnailCacheSize
      },
      documentCache: {
        size: this.documentCache.size(),
        maxSize: this.maxDocumentCacheSize
      }
    };
  }
}