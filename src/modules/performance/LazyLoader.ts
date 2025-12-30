import { ImageData } from '../../types';
import { MemoryManager } from './MemoryManager';

/**
 * Lazy loading configuration
 */
export interface LazyLoadConfig {
  preloadDistance: number; // Number of pages to preload ahead/behind
  thumbnailSize: { width: number; height: number };
  enableThumbnailPreload: boolean;
  enablePagePreload: boolean;
}

/**
 * Page load request
 */
export interface PageLoadRequest {
  filePath: string;
  pageNumber: number;
  scale: number;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Thumbnail load request
 */
export interface ThumbnailLoadRequest {
  filePath: string;
  maxWidth: number;
  maxHeight: number;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Load result
 */
export interface LoadResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  fromCache: boolean;
}

/**
 * Lazy loader for PDF pages and thumbnails with intelligent preloading
 */
export class LazyLoader {
  private memoryManager: MemoryManager;
  private loadQueue: Array<PageLoadRequest | ThumbnailLoadRequest> = [];
  private isProcessing = false;
  private config: LazyLoadConfig;
  
  // Callbacks for loading operations
  public onPageRender?: (filePath: string, pageNumber: number, scale: number) => Promise<ImageData>;
  public onThumbnailGenerate?: (filePath: string, maxWidth: number, maxHeight: number) => Promise<ImageData>;
  
  // Progress tracking
  public onLoadProgress?: (completed: number, total: number) => void;
  public onLoadComplete?: (request: PageLoadRequest | ThumbnailLoadRequest, result: LoadResult<ImageData>) => void;

  constructor(config: Partial<LazyLoadConfig> = {}) {
    this.memoryManager = MemoryManager.getInstance();
    this.config = {
      preloadDistance: 2,
      thumbnailSize: { width: 150, height: 200 },
      enableThumbnailPreload: true,
      enablePagePreload: true,
      ...config
    };
  }

  /**
   * Load a page with lazy loading and caching
   */
  async loadPage(filePath: string, pageNumber: number, scale: number = 1.0): Promise<LoadResult<ImageData>> {
    const cacheKey = `${filePath}:${pageNumber}:${scale}`;
    
    // Check cache first
    const cachedImage = this.memoryManager.getCachedImage(cacheKey);
    if (cachedImage) {
      return {
        success: true,
        data: cachedImage,
        fromCache: true
      };
    }

    // Add to load queue with high priority
    const request: PageLoadRequest = {
      filePath,
      pageNumber,
      scale,
      priority: 'high'
    };

    return this.processPageRequest(request);
  }

  /**
   * Load thumbnail with lazy loading and caching
   */
  async loadThumbnail(filePath: string, maxWidth?: number, maxHeight?: number): Promise<LoadResult<ImageData>> {
    const width = maxWidth || this.config.thumbnailSize.width;
    const height = maxHeight || this.config.thumbnailSize.height;
    const cacheKey = `thumb:${filePath}:${width}:${height}`;
    
    // Check cache first
    const cachedThumbnail = this.memoryManager.getCachedThumbnail(cacheKey);
    if (cachedThumbnail) {
      return {
        success: true,
        data: cachedThumbnail,
        fromCache: true
      };
    }

    // Add to load queue with high priority
    const request: ThumbnailLoadRequest = {
      filePath,
      maxWidth: width,
      maxHeight: height,
      priority: 'high'
    };

    return this.processThumbnailRequest(request);
  }

  /**
   * Preload pages around the current page for smooth scrolling
   */
  async preloadPages(filePath: string, currentPage: number, totalPages: number, scale: number = 1.0): Promise<void> {
    if (!this.config.enablePagePreload) {
      return;
    }

    const preloadRequests: PageLoadRequest[] = [];
    
    // Calculate preload range
    const startPage = Math.max(1, currentPage - this.config.preloadDistance);
    const endPage = Math.min(totalPages, currentPage + this.config.preloadDistance);
    
    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      if (pageNum === currentPage) {
        continue; // Skip current page as it should already be loaded
      }
      
      const cacheKey = `${filePath}:${pageNum}:${scale}`;
      
      // Only preload if not already cached
      if (!this.memoryManager.getCachedImage(cacheKey)) {
        preloadRequests.push({
          filePath,
          pageNumber: pageNum,
          scale,
          priority: Math.abs(pageNum - currentPage) === 1 ? 'medium' : 'low'
        });
      }
    }
    
    // Add to queue
    this.addToQueue(preloadRequests);
  }

  /**
   * Preload thumbnails for a list of documents
   */
  async preloadThumbnails(filePaths: string[]): Promise<void> {
    if (!this.config.enableThumbnailPreload) {
      return;
    }

    const preloadRequests: ThumbnailLoadRequest[] = [];
    
    for (const filePath of filePaths) {
      const cacheKey = `thumb:${filePath}:${this.config.thumbnailSize.width}:${this.config.thumbnailSize.height}`;
      
      // Only preload if not already cached
      if (!this.memoryManager.getCachedThumbnail(cacheKey)) {
        preloadRequests.push({
          filePath,
          maxWidth: this.config.thumbnailSize.width,
          maxHeight: this.config.thumbnailSize.height,
          priority: 'low'
        });
      }
    }
    
    // Add to queue
    this.addToQueue(preloadRequests);
  }

  /**
   * Process a page load request
   */
  private async processPageRequest(request: PageLoadRequest): Promise<LoadResult<ImageData>> {
    try {
      if (!this.onPageRender) {
        throw new Error('Page render callback not set');
      }

      const imageData = await this.onPageRender(request.filePath, request.pageNumber, request.scale);
      
      // Cache the result
      const cacheKey = `${request.filePath}:${request.pageNumber}:${request.scale}`;
      this.memoryManager.cacheImage(cacheKey, imageData);
      
      const result: LoadResult<ImageData> = {
        success: true,
        data: imageData,
        fromCache: false
      };
      
      this.onLoadComplete?.(request, result);
      return result;
      
    } catch (error) {
      const result: LoadResult<ImageData> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fromCache: false
      };
      
      this.onLoadComplete?.(request, result);
      return result;
    }
  }

  /**
   * Process a thumbnail load request
   */
  private async processThumbnailRequest(request: ThumbnailLoadRequest): Promise<LoadResult<ImageData>> {
    try {
      if (!this.onThumbnailGenerate) {
        throw new Error('Thumbnail generate callback not set');
      }

      const imageData = await this.onThumbnailGenerate(request.filePath, request.maxWidth, request.maxHeight);
      
      // Cache the result
      const cacheKey = `thumb:${request.filePath}:${request.maxWidth}:${request.maxHeight}`;
      this.memoryManager.cacheThumbnail(cacheKey, imageData);
      
      const result: LoadResult<ImageData> = {
        success: true,
        data: imageData,
        fromCache: false
      };
      
      this.onLoadComplete?.(request, result);
      return result;
      
    } catch (error) {
      const result: LoadResult<ImageData> = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fromCache: false
      };
      
      this.onLoadComplete?.(request, result);
      return result;
    }
  }

  /**
   * Add requests to the load queue
   */
  private addToQueue(requests: Array<PageLoadRequest | ThumbnailLoadRequest>): void {
    // Sort by priority (high -> medium -> low)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    requests.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    this.loadQueue.push(...requests);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process the load queue in background
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.loadQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const totalRequests = this.loadQueue.length;
    let completedRequests = 0;

    while (this.loadQueue.length > 0) {
      const request = this.loadQueue.shift()!;
      
      try {
        if ('pageNumber' in request) {
          // Page request
          await this.processPageRequest(request);
        } else {
          // Thumbnail request
          await this.processThumbnailRequest(request);
        }
      } catch (error) {
        console.warn('Failed to process lazy load request:', error);
      }
      
      completedRequests++;
      this.onLoadProgress?.(completedRequests, totalRequests);
      
      // Add small delay to prevent blocking the main thread
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.isProcessing = false;
  }

  /**
   * Clear the load queue
   */
  clearQueue(): void {
    this.loadQueue = [];
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      queueLength: this.loadQueue.length,
      isProcessing: this.isProcessing,
      highPriorityCount: this.loadQueue.filter(r => r.priority === 'high').length,
      mediumPriorityCount: this.loadQueue.filter(r => r.priority === 'medium').length,
      lowPriorityCount: this.loadQueue.filter(r => r.priority === 'low').length
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LazyLoadConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): LazyLoadConfig {
    return { ...this.config };
  }
}