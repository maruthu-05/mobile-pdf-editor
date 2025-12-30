import { LazyLoader } from '../LazyLoader';
import { MemoryManager } from '../MemoryManager';
import { ImageData } from '../../../types';

// Mock MemoryManager to avoid shared state between tests
jest.mock('../MemoryManager');

describe('LazyLoader', () => {
  let lazyLoader: LazyLoader;
  let mockImageData: ImageData;
  let mockPageRender: jest.Mock;
  let mockThumbnailGenerate: jest.Mock;
  let mockMemoryManager: jest.Mocked<MemoryManager>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock memory manager
    mockMemoryManager = {
      getCachedImage: jest.fn().mockReturnValue(undefined),
      getCachedThumbnail: jest.fn().mockReturnValue(undefined),
      cacheImage: jest.fn(),
      cacheThumbnail: jest.fn(),
    } as any;
    
    (MemoryManager.getInstance as jest.Mock).mockReturnValue(mockMemoryManager);

    mockImageData = {
      uri: 'test://image.png',
      width: 100,
      height: 150
    };

    mockPageRender = jest.fn().mockResolvedValue(mockImageData);
    mockThumbnailGenerate = jest.fn().mockResolvedValue(mockImageData);

    lazyLoader = new LazyLoader({
      preloadDistance: 2,
      thumbnailSize: { width: 150, height: 200 },
      enableThumbnailPreload: true,
      enablePagePreload: true
    });

    lazyLoader.onPageRender = mockPageRender;
    lazyLoader.onThumbnailGenerate = mockThumbnailGenerate;
  });

  test('should load page successfully', async () => {
    const result = await lazyLoader.loadPage('/test/document.pdf', 1, 1.0);
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockImageData);
    expect(result.fromCache).toBe(false);
    expect(mockPageRender).toHaveBeenCalledWith('/test/document.pdf', 1, 1.0);
  });

  test('should return cached page on subsequent loads', async () => {
    // First load - should not be cached
    mockMemoryManager.getCachedImage.mockReturnValueOnce(undefined);
    const result1 = await lazyLoader.loadPage('/test/document.pdf', 1, 1.0);
    expect(result1.fromCache).toBe(false);
    
    // Second load - should be cached
    mockMemoryManager.getCachedImage.mockReturnValueOnce(mockImageData);
    const result2 = await lazyLoader.loadPage('/test/document.pdf', 1, 1.0);
    expect(result2.success).toBe(true);
    expect(result2.data).toEqual(mockImageData);
    expect(result2.fromCache).toBe(true);
    
    // Should only call render once
    expect(mockPageRender).toHaveBeenCalledTimes(1);
  });

  test('should load thumbnail successfully', async () => {
    const result = await lazyLoader.loadThumbnail('/test/document.pdf', 150, 200);
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockImageData);
    expect(result.fromCache).toBe(false);
    expect(mockThumbnailGenerate).toHaveBeenCalledWith('/test/document.pdf', 150, 200);
  });

  test('should return cached thumbnail on subsequent loads', async () => {
    // First load - should not be cached
    mockMemoryManager.getCachedThumbnail.mockReturnValueOnce(undefined);
    const result1 = await lazyLoader.loadThumbnail('/test/document.pdf');
    expect(result1.fromCache).toBe(false);
    
    // Second load - should be cached
    mockMemoryManager.getCachedThumbnail.mockReturnValueOnce(mockImageData);
    const result2 = await lazyLoader.loadThumbnail('/test/document.pdf');
    expect(result2.success).toBe(true);
    expect(result2.data).toEqual(mockImageData);
    expect(result2.fromCache).toBe(true);
    
    // Should only call generate once
    expect(mockThumbnailGenerate).toHaveBeenCalledTimes(1);
  });

  test('should use default thumbnail size when not specified', async () => {
    await lazyLoader.loadThumbnail('/test/document.pdf');
    
    expect(mockThumbnailGenerate).toHaveBeenCalledWith('/test/document.pdf', 150, 200);
  });

  test('should handle page render errors', async () => {
    const errorMessage = 'Failed to render page';
    mockPageRender.mockRejectedValue(new Error(errorMessage));
    mockMemoryManager.getCachedImage.mockReturnValue(undefined);
    
    const result = await lazyLoader.loadPage('/test/document.pdf', 1, 1.0);
    
    expect(result.success).toBe(false);
    expect(result.error).toBe(errorMessage);
    expect(result.data).toBeUndefined();
    expect(result.fromCache).toBe(false);
  });

  test('should handle thumbnail generation errors', async () => {
    const errorMessage = 'Failed to generate thumbnail';
    mockThumbnailGenerate.mockRejectedValue(new Error(errorMessage));
    mockMemoryManager.getCachedThumbnail.mockReturnValue(undefined);
    
    const result = await lazyLoader.loadThumbnail('/test/document.pdf');
    
    expect(result.success).toBe(false);
    expect(result.error).toBe(errorMessage);
    expect(result.data).toBeUndefined();
    expect(result.fromCache).toBe(false);
  });

  test('should preload pages around current page', async () => {
    const filePath = '/test/document.pdf';
    const currentPage = 5;
    const totalPages = 10;
    const scale = 1.0;
    
    await lazyLoader.preloadPages(filePath, currentPage, totalPages, scale);
    
    // Wait for background processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Should preload pages 3, 4, 6, 7 (current page 5 is skipped)
    expect(mockPageRender).toHaveBeenCalledWith(filePath, 3, scale);
    expect(mockPageRender).toHaveBeenCalledWith(filePath, 4, scale);
    expect(mockPageRender).toHaveBeenCalledWith(filePath, 6, scale);
    expect(mockPageRender).toHaveBeenCalledWith(filePath, 7, scale);
    expect(mockPageRender).not.toHaveBeenCalledWith(filePath, 5, scale);
  });

  test('should respect page boundaries when preloading', async () => {
    const filePath = '/test/document.pdf';
    const currentPage = 2;
    const totalPages = 3;
    const scale = 1.0;
    
    await lazyLoader.preloadPages(filePath, currentPage, totalPages, scale);
    
    // Wait for background processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Should only preload pages 1 and 3 (within bounds)
    expect(mockPageRender).toHaveBeenCalledWith(filePath, 1, scale);
    expect(mockPageRender).toHaveBeenCalledWith(filePath, 3, scale);
    expect(mockPageRender).not.toHaveBeenCalledWith(filePath, 0, scale);
    expect(mockPageRender).not.toHaveBeenCalledWith(filePath, 4, scale);
  });

  test('should preload thumbnails for multiple documents', async () => {
    const filePaths = ['/test/doc1.pdf', '/test/doc2.pdf', '/test/doc3.pdf'];
    
    await lazyLoader.preloadThumbnails(filePaths);
    
    // Wait for background processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Should preload thumbnails for all documents
    filePaths.forEach(filePath => {
      expect(mockThumbnailGenerate).toHaveBeenCalledWith(filePath, 150, 200);
    });
  });

  test('should not preload if preloading is disabled', async () => {
    const disabledLoader = new LazyLoader({
      enablePagePreload: false,
      enableThumbnailPreload: false
    });
    
    disabledLoader.onPageRender = mockPageRender;
    disabledLoader.onThumbnailGenerate = mockThumbnailGenerate;
    
    await disabledLoader.preloadPages('/test/document.pdf', 5, 10, 1.0);
    await disabledLoader.preloadThumbnails(['/test/doc1.pdf']);
    
    // Wait for any potential background processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Should not have called render functions
    expect(mockPageRender).not.toHaveBeenCalled();
    expect(mockThumbnailGenerate).not.toHaveBeenCalled();
  });

  test('should provide queue status', () => {
    const status = lazyLoader.getQueueStatus();
    
    expect(status).toHaveProperty('queueLength');
    expect(status).toHaveProperty('isProcessing');
    expect(status).toHaveProperty('highPriorityCount');
    expect(status).toHaveProperty('mediumPriorityCount');
    expect(status).toHaveProperty('lowPriorityCount');
    
    expect(typeof status.queueLength).toBe('number');
    expect(typeof status.isProcessing).toBe('boolean');
  });

  test('should clear queue', () => {
    // Add some items to queue
    lazyLoader.preloadPages('/test/document.pdf', 5, 10, 1.0);
    
    let status = lazyLoader.getQueueStatus();
    expect(status.queueLength).toBeGreaterThan(0);
    
    lazyLoader.clearQueue();
    
    status = lazyLoader.getQueueStatus();
    expect(status.queueLength).toBe(0);
  });

  test('should update and get configuration', () => {
    const newConfig = {
      preloadDistance: 3,
      enablePagePreload: false
    };
    
    lazyLoader.updateConfig(newConfig);
    
    const config = lazyLoader.getConfig();
    expect(config.preloadDistance).toBe(3);
    expect(config.enablePagePreload).toBe(false);
    expect(config.enableThumbnailPreload).toBe(true); // Should keep existing value
  });

  test('should handle load progress callbacks', (done) => {
    let progressCalled = false;
    
    lazyLoader.onLoadProgress = (completed, total) => {
      progressCalled = true;
      expect(typeof completed).toBe('number');
      expect(typeof total).toBe('number');
      expect(completed).toBeLessThanOrEqual(total);
    };
    
    lazyLoader.onLoadComplete = (request, result) => {
      expect(request).toHaveProperty('filePath');
      expect(result).toHaveProperty('success');
      if (progressCalled) {
        done();
      }
    };
    
    // Trigger preload to generate progress events
    lazyLoader.preloadPages('/test/document.pdf', 5, 10, 1.0);
    
    setTimeout(() => {
      if (!progressCalled) {
        done();
      }
    }, 100);
  });

  test('should handle load complete callbacks', (done) => {
    lazyLoader.onLoadComplete = (request, result) => {
      expect(request).toHaveProperty('filePath');
      expect(request.filePath).toBe('/test/document.pdf');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockImageData);
      done();
    };
    
    lazyLoader.loadPage('/test/document.pdf', 1, 1.0);
  });
});