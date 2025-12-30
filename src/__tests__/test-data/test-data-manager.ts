/**
 * Test Data Manager
 * Manages test data, mock files, and test fixtures for comprehensive testing
 */

import { DocumentMetadata, PageRange, TextEdit, Annotation } from '../../types';

export class TestDataManager {
  private static instance: TestDataManager;

  private constructor() {}

  public static getInstance(): TestDataManager {
    if (!TestDataManager.instance) {
      TestDataManager.instance = new TestDataManager();
    }
    return TestDataManager.instance;
  }

  /**
   * Generate mock PDF file data
   */
  public generateMockPDFData(sizeInMB: number = 1): Uint8Array {
    const sizeInBytes = sizeInMB * 1024 * 1024;
    const data = new Uint8Array(sizeInBytes);
    
    // Add PDF header
    const pdfHeader = new TextEncoder().encode('%PDF-1.4\n');
    data.set(pdfHeader, 0);
    
    // Fill with random data to simulate PDF content
    for (let i = pdfHeader.length; i < sizeInBytes; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }
    
    return data;
  }

  /**
   * Generate mock document metadata
   */
  public generateMockDocuments(count: number = 5): DocumentMetadata[] {
    const documents: DocumentMetadata[] = [];
    const baseDate = new Date('2024-01-01');
    
    for (let i = 0; i < count; i++) {
      const createdDate = new Date(baseDate.getTime() + (i * 24 * 60 * 60 * 1000));
      const modifiedDate = new Date(createdDate.getTime() + (Math.random() * 7 * 24 * 60 * 60 * 1000));
      
      documents.push({
        id: `doc-${i + 1}`,
        fileName: `document-${i + 1}.pdf`,
        filePath: `/test/documents/document-${i + 1}.pdf`,
        fileSize: Math.floor(Math.random() * 10000000) + 500000, // 0.5MB to 10MB
        pageCount: Math.floor(Math.random() * 50) + 1, // 1 to 50 pages
        createdAt: createdDate,
        modifiedAt: modifiedDate,
      });
    }
    
    return documents;
  }

  /**
   * Generate mock page ranges for split operations
   */
  public generateMockPageRanges(totalPages: number): PageRange[] {
    const ranges: PageRange[] = [];
    let currentPage = 1;
    
    while (currentPage <= totalPages) {
      const rangeSize = Math.min(Math.floor(Math.random() * 10) + 1, totalPages - currentPage + 1);
      ranges.push({
        startPage: currentPage,
        endPage: currentPage + rangeSize - 1,
      });
      currentPage += rangeSize;
    }
    
    return ranges;
  }

  /**
   * Generate mock text edits
   */
  public generateMockTextEdits(pageCount: number): TextEdit[] {
    const edits: TextEdit[] = [];
    const editCount = Math.floor(Math.random() * 10) + 1;
    
    for (let i = 0; i < editCount; i++) {
      edits.push({
        pageNumber: Math.floor(Math.random() * pageCount) + 1,
        x: Math.floor(Math.random() * 500) + 50,
        y: Math.floor(Math.random() * 700) + 50,
        width: Math.floor(Math.random() * 200) + 100,
        height: Math.floor(Math.random() * 50) + 20,
        newText: `Edited text ${i + 1}`,
      });
    }
    
    return edits;
  }

  /**
   * Generate mock annotations
   */
  public generateMockAnnotations(pageCount: number): Annotation[] {
    const annotations: Annotation[] = [];
    const annotationCount = Math.floor(Math.random() * 15) + 1;
    const types: Array<'text' | 'highlight' | 'drawing'> = ['text', 'highlight', 'drawing'];
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    
    for (let i = 0; i < annotationCount; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      
      annotations.push({
        type,
        pageNumber: Math.floor(Math.random() * pageCount) + 1,
        x: Math.floor(Math.random() * 500) + 50,
        y: Math.floor(Math.random() * 700) + 50,
        width: Math.floor(Math.random() * 200) + 100,
        height: Math.floor(Math.random() * 100) + 30,
        content: type === 'text' ? `Annotation ${i + 1}` : '',
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    
    return annotations;
  }

  /**
   * Generate performance test scenarios
   */
  public generatePerformanceTestScenarios() {
    return {
      smallFile: {
        name: 'small-document.pdf',
        size: 1, // 1MB
        pages: 5,
        expectedLoadTime: 2000, // 2 seconds
      },
      mediumFile: {
        name: 'medium-document.pdf',
        size: 10, // 10MB
        pages: 25,
        expectedLoadTime: 3000, // 3 seconds
      },
      largeFile: {
        name: 'large-document.pdf',
        size: 50, // 50MB
        pages: 100,
        expectedLoadTime: 5000, // 5 seconds
      },
      multipleSmallFiles: Array.from({ length: 10 }, (_, i) => ({
        name: `batch-file-${i + 1}.pdf`,
        size: 2, // 2MB each
        pages: 8,
      })),
    };
  }

  /**
   * Generate error test scenarios
   */
  public generateErrorTestScenarios() {
    return {
      corruptedFile: {
        name: 'corrupted.pdf',
        data: new Uint8Array([1, 2, 3, 4, 5]), // Invalid PDF data
        expectedError: 'Invalid PDF format',
      },
      emptyFile: {
        name: 'empty.pdf',
        data: new Uint8Array(0),
        expectedError: 'File is empty',
      },
      oversizedFile: {
        name: 'oversized.pdf',
        size: 500, // 500MB - exceeds typical limits
        expectedError: 'File too large',
      },
      nonExistentFile: {
        path: '/non/existent/file.pdf',
        expectedError: 'File not found',
      },
      insufficientStorage: {
        name: 'storage-test.pdf',
        size: 100, // 100MB
        availableSpace: 50, // Only 50MB available
        expectedError: 'Insufficient storage space',
      },
    };
  }

  /**
   * Generate accessibility test scenarios
   */
  public generateAccessibilityTestScenarios() {
    return {
      screenReaderEnabled: {
        isScreenReaderEnabled: true,
        expectedBehavior: 'All elements should have accessibility labels',
      },
      reduceMotionEnabled: {
        isReduceMotionEnabled: true,
        expectedBehavior: 'Animations should be disabled or reduced',
      },
      boldTextEnabled: {
        isBoldTextEnabled: true,
        expectedBehavior: 'Text should be rendered in bold',
      },
      highContrastEnabled: {
        isHighContrastEnabled: true,
        expectedBehavior: 'High contrast colors should be used',
      },
      largeTextEnabled: {
        isLargeTextEnabled: true,
        expectedBehavior: 'Text size should be increased',
      },
    };
  }

  /**
   * Generate cross-platform test scenarios
   */
  public generateCrossPlatformTestScenarios() {
    return {
      ios: {
        platform: 'ios',
        version: '14.0',
        deviceType: 'iPhone',
        screenSize: { width: 375, height: 812 },
        fileSystemRoot: '/var/mobile/Containers/Data/Application/',
        expectedBehaviors: {
          hapticFeedback: true,
          fileSharing: true,
          documentPicker: true,
        },
      },
      android: {
        platform: 'android',
        version: '10',
        deviceType: 'Android',
        screenSize: { width: 360, height: 640 },
        fileSystemRoot: '/data/data/com.app/',
        expectedBehaviors: {
          hapticFeedback: true,
          fileSharing: true,
          documentPicker: true,
        },
      },
    };
  }

  /**
   * Generate offline functionality test scenarios
   */
  public generateOfflineTestScenarios() {
    return {
      completeOffline: {
        networkState: { isConnected: false, type: 'none' },
        expectedCapabilities: [
          'view_documents',
          'edit_documents',
          'merge_documents',
          'split_documents',
          'save_documents',
        ],
      },
      intermittentConnection: {
        networkState: { isConnected: true, type: 'cellular', isInternetReachable: false },
        expectedBehavior: 'Should queue operations for later sync',
      },
      lowBandwidth: {
        networkState: { isConnected: true, type: 'cellular', effectiveType: '2g' },
        expectedBehavior: 'Should prioritize offline operations',
      },
    };
  }

  /**
   * Generate stress test scenarios
   */
  public generateStressTestScenarios() {
    return {
      manyDocuments: {
        documentCount: 1000,
        expectedBehavior: 'Should handle large document libraries efficiently',
      },
      largeDocument: {
        pageCount: 1000,
        fileSize: 200, // 200MB
        expectedBehavior: 'Should handle very large documents without crashing',
      },
      concurrentOperations: {
        operationCount: 10,
        operationType: 'merge',
        expectedBehavior: 'Should handle multiple concurrent operations',
      },
      rapidInteractions: {
        interactionCount: 100,
        interactionType: 'page_navigation',
        expectedBehavior: 'Should remain responsive during rapid interactions',
      },
      memoryPressure: {
        memoryUsage: 0.95, // 95% of available memory
        expectedBehavior: 'Should gracefully handle memory pressure',
      },
    };
  }

  /**
   * Create mock file system structure
   */
  public createMockFileSystem() {
    return {
      documents: {
        'document1.pdf': this.generateMockPDFData(2),
        'document2.pdf': this.generateMockPDFData(5),
        'document3.pdf': this.generateMockPDFData(1),
      },
      cache: {
        thumbnails: {
          'doc1_thumb.jpg': new Uint8Array(1024),
          'doc2_thumb.jpg': new Uint8Array(1024),
        },
        temp: {
          'temp_merge.pdf': this.generateMockPDFData(3),
        },
      },
      backups: {
        'document1_backup.pdf': this.generateMockPDFData(2),
      },
    };
  }

  /**
   * Generate test configuration for different test types
   */
  public getTestConfiguration(testType: string) {
    const configurations = {
      unit: {
        timeout: 5000,
        retries: 0,
        parallel: true,
      },
      integration: {
        timeout: 15000,
        retries: 1,
        parallel: false,
      },
      e2e: {
        timeout: 30000,
        retries: 2,
        parallel: false,
      },
      performance: {
        timeout: 60000,
        retries: 0,
        parallel: false,
        warmupRuns: 3,
        measurementRuns: 10,
      },
      accessibility: {
        timeout: 10000,
        retries: 1,
        parallel: true,
      },
      crossPlatform: {
        timeout: 20000,
        retries: 2,
        parallel: false,
      },
    };

    return configurations[testType as keyof typeof configurations] || configurations.unit;
  }

  /**
   * Clean up test data and temporary files
   */
  public async cleanupTestData(): Promise<void> {
    // In a real implementation, this would clean up temporary files,
    // reset database state, clear caches, etc.
    console.log('Cleaning up test data...');
  }

  /**
   * Validate test environment setup
   */
  public validateTestEnvironment(): boolean {
    const requiredMocks = [
      'expo-file-system',
      'expo-document-picker',
      'expo-sharing',
      '@react-native-async-storage/async-storage',
      'react-native-pdf-lib',
    ];

    for (const mockName of requiredMocks) {
      try {
        const mock = jest.requireMock(mockName);
        if (!mock) {
          console.error(`Required mock not found: ${mockName}`);
          return false;
        }
      } catch (error) {
        console.error(`Error loading mock ${mockName}:`, error);
        return false;
      }
    }

    return true;
  }

  /**
   * Generate test report data
   */
  public generateTestReport(testResults: any[]) {
    const summary = {
      total: testResults.length,
      passed: testResults.filter(r => r.status === 'passed').length,
      failed: testResults.filter(r => r.status === 'failed').length,
      skipped: testResults.filter(r => r.status === 'skipped').length,
      duration: testResults.reduce((sum, r) => sum + (r.duration || 0), 0),
    };

    const coverage = {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
    };

    const performanceMetrics = testResults
      .filter(r => r.type === 'performance')
      .map(r => ({
        testName: r.name,
        duration: r.duration,
        memoryUsage: r.memoryUsage,
        threshold: r.threshold,
        passed: r.duration < r.threshold,
      }));

    return {
      summary,
      coverage,
      performanceMetrics,
      timestamp: new Date().toISOString(),
    };
  }
}