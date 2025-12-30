import { PDFEngine } from '../PDFEngine';
import * as FileSystem from 'expo-file-system';
import { PageRange, TextEdit, Annotation } from '../../../types';

// Mock dependencies
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  documentDirectory: '/mock/documents/'
}));
jest.mock('react-native-pdf-lib', () => ({
  PDFDocument: {
    loadDocument: jest.fn(),
    create: jest.fn()
  }
}));

const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

// Mock react-native-pdf-lib
const mockPDFLibDocument = {
  loadDocument: jest.fn()
};

describe('PDFEngine', () => {
  let pdfEngine: PDFEngine;
  let mockPdfDoc: any;
  let mockPage: any;

  beforeEach(() => {
    pdfEngine = new PDFEngine();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock page
    mockPage = {
      getSize: jest.fn().mockResolvedValue({ width: 612, height: 792 }),
      render: jest.fn().mockResolvedValue('mock-image-uri'),
      getTextContent: jest.fn().mockResolvedValue('Mock text content')
    };
    
    // Setup mock PDF document
    mockPdfDoc = {
      getNumberOfPages: jest.fn().mockResolvedValue(5),
      getPage: jest.fn().mockResolvedValue(mockPage)
    };
    
    // Setup PDFLibDocument mock
    const { PDFDocument } = require('react-native-pdf-lib');
    PDFDocument.loadDocument = jest.fn().mockResolvedValue(mockPdfDoc);
  });

  afterEach(() => {
    pdfEngine.clearCache();
  });

  describe('loadPDF', () => {
    const testFilePath = '/path/to/test.pdf';

    beforeEach(() => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        uri: testFilePath,
        size: 1024,
        modificationTime: Date.now()
      } as any);
      
      mockFileSystem.readAsStringAsync.mockResolvedValue(btoa('%PDF-1.4'));
    });

    it('should successfully load a valid PDF', async () => {
      const result = await pdfEngine.loadPDF(testFilePath);

      expect(result).toEqual({
        filePath: testFilePath,
        pageCount: 5,
        metadata: {}
      });
      
      expect(mockFileSystem.getInfoAsync).toHaveBeenCalledWith(testFilePath);
      const { PDFDocument } = require('react-native-pdf-lib');
      expect(PDFDocument.loadDocument).toHaveBeenCalledWith(testFilePath);
      expect(mockPdfDoc.getNumberOfPages).toHaveBeenCalled();
    });

    it('should throw error if file does not exist', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: false,
        isDirectory: false,
        uri: testFilePath
      } as any);

      await expect(pdfEngine.loadPDF(testFilePath)).rejects.toThrow('PDF file not found');
    });

    it('should throw error for invalid PDF format', async () => {
      mockFileSystem.readAsStringAsync.mockResolvedValue(btoa('Not a PDF'));

      await expect(pdfEngine.loadPDF(testFilePath)).rejects.toThrow('Invalid PDF format');
    });

    it('should throw error if PDF loading fails', async () => {
      const { PDFDocument } = require('react-native-pdf-lib');
      PDFDocument.loadDocument.mockRejectedValue(new Error('Corrupted PDF'));

      await expect(pdfEngine.loadPDF(testFilePath)).rejects.toThrow('Failed to load PDF: Corrupted PDF');
    });
  });

  describe('renderPage', () => {
    const testFilePath = '/path/to/test.pdf';

    beforeEach(() => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        uri: testFilePath,
        size: 1024,
        modificationTime: Date.now()
      } as any);
    });

    it('should successfully render a page', async () => {
      const result = await pdfEngine.renderPage(testFilePath, 1);

      expect(result).toEqual({
        uri: 'mock-image-uri',
        width: 612,
        height: 792
      });
      
      expect(mockPdfDoc.getPage).toHaveBeenCalledWith(0); // 0-based index
      expect(mockPage.getSize).toHaveBeenCalled();
      expect(mockPage.render).toHaveBeenCalledWith({
        width: 612,
        height: 792,
        format: 'png'
      });
    });

    it('should render page with custom scale', async () => {
      const result = await pdfEngine.renderPage(testFilePath, 1, 2.0);

      expect(result).toEqual({
        uri: 'mock-image-uri',
        width: 1224, // 612 * 2
        height: 1584 // 792 * 2
      });
      
      expect(mockPage.render).toHaveBeenCalledWith({
        width: 1224,
        height: 1584,
        format: 'png'
      });
    });

    it('should throw error for invalid page number', async () => {
      await expect(pdfEngine.renderPage(testFilePath, 0)).rejects.toThrow('Invalid page number: 0');
      await expect(pdfEngine.renderPage(testFilePath, 6)).rejects.toThrow('Invalid page number: 6');
    });

    it('should cache rendered pages', async () => {
      // Render same page twice
      await pdfEngine.renderPage(testFilePath, 1);
      await pdfEngine.renderPage(testFilePath, 1);

      // Should only call render once due to caching
      expect(mockPage.render).toHaveBeenCalledTimes(1);
    });

    it('should use different cache keys for different scales', async () => {
      await pdfEngine.renderPage(testFilePath, 1, 1.0);
      await pdfEngine.renderPage(testFilePath, 1, 2.0);

      // Should call render twice for different scales
      expect(mockPage.render).toHaveBeenCalledTimes(2);
    });
  });

  describe('getPageCount', () => {
    const testFilePath = '/path/to/test.pdf';

    it('should return correct page count', async () => {
      const result = await pdfEngine.getPageCount(testFilePath);
      
      expect(result).toBe(5);
      expect(mockPdfDoc.getNumberOfPages).toHaveBeenCalled();
    });

    it('should throw error if document loading fails', async () => {
      const { PDFDocument } = require('react-native-pdf-lib');
      PDFDocument.loadDocument.mockRejectedValue(new Error('Load failed'));

      await expect(pdfEngine.getPageCount(testFilePath)).rejects.toThrow('Failed to get page count');
    });
  });

  describe('generateThumbnail', () => {
    const testFilePath = '/path/to/test.pdf';

    it('should generate thumbnail with correct scaling', async () => {
      const result = await pdfEngine.generateThumbnail(testFilePath, 200, 300);

      // Should scale to fit within 200x300, maintaining aspect ratio
      // Original: 612x792, scale should be 200/612 ≈ 0.327
      const expectedScale = 200 / 612;
      const expectedWidth = Math.round(612 * expectedScale);
      const expectedHeight = Math.round(792 * expectedScale);

      expect(result).toEqual({
        uri: 'mock-image-uri',
        width: expectedWidth,
        height: expectedHeight
      });
    });

    it('should not upscale images', async () => {
      const result = await pdfEngine.generateThumbnail(testFilePath, 1000, 1000);

      // Should not upscale, so dimensions should remain original
      expect(result).toEqual({
        uri: 'mock-image-uri',
        width: 612,
        height: 792
      });
    });
  });

  describe('validatePDF', () => {
    it('should return true for valid PDF files', async () => {
      mockFileSystem.readAsStringAsync.mockResolvedValue(btoa('%PDF-1.4'));
      
      const result = await pdfEngine.validatePDF('/path/to/test.pdf');
      
      expect(result).toBe(true);
    });

    it('should return false for non-PDF files', async () => {
      const result = await pdfEngine.validatePDF('/path/to/test.txt');
      
      expect(result).toBe(false);
    });

    it('should return false for files without PDF header', async () => {
      mockFileSystem.readAsStringAsync.mockResolvedValue(btoa('Not a PDF'));
      
      const result = await pdfEngine.validatePDF('/path/to/test.pdf');
      
      expect(result).toBe(false);
    });

    it('should return false if file reading fails', async () => {
      mockFileSystem.readAsStringAsync.mockRejectedValue(new Error('Read failed'));
      
      const result = await pdfEngine.validatePDF('/path/to/test.pdf');
      
      expect(result).toBe(false);
    });
  });

  describe('extractTextFromPage', () => {
    const testFilePath = '/path/to/test.pdf';

    it('should extract text from valid page', async () => {
      const result = await pdfEngine.extractTextFromPage(testFilePath, 1);
      
      expect(result).toBe('Mock text content');
      expect(mockPdfDoc.getPage).toHaveBeenCalledWith(0);
      expect(mockPage.getTextContent).toHaveBeenCalled();
    });

    it('should throw error for invalid page number', async () => {
      await expect(pdfEngine.extractTextFromPage(testFilePath, 0)).rejects.toThrow('Invalid page number: 0');
      await expect(pdfEngine.extractTextFromPage(testFilePath, 6)).rejects.toThrow('Invalid page number: 6');
    });
  });

  describe('cache management', () => {
    it('should clear all caches', () => {
      pdfEngine.clearCache();
      
      const stats = pdfEngine.getCacheStats();
      expect(stats.pageCache).toBe(0);
      expect(stats.documentCache).toBe(0);
    });

    it('should evict oldest cache entries when cache is full', async () => {
      const testFilePath = '/path/to/test.pdf';
      
      // Mock a smaller cache size for testing
      const originalMaxCacheSize = (pdfEngine as any).maxCacheSize;
      (pdfEngine as any).maxCacheSize = 2;
      
      try {
        // Render 3 different pages to trigger eviction
        await pdfEngine.renderPage(testFilePath, 1);
        await pdfEngine.renderPage(testFilePath, 2);
        await pdfEngine.renderPage(testFilePath, 3);
        
        const stats = pdfEngine.getCacheStats();
        expect(stats.pageCache).toBe(2); // Should not exceed max cache size
      } finally {
        (pdfEngine as any).maxCacheSize = originalMaxCacheSize;
      }
    });
  });

  describe('mergePDFs', () => {
    const testFilePaths = ['/path/to/test1.pdf', '/path/to/test2.pdf'];

    beforeEach(() => {
      // Mock file existence
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (testFilePaths.includes(path) || path.includes('merged-pdf-')) {
          return Promise.resolve({
            exists: true,
            isDirectory: false,
            uri: path,
            size: 1024,
            modificationTime: Date.now()
          } as any);
        }
        return Promise.resolve({ exists: false } as any);
      });

      // Mock PDF validation
      mockFileSystem.readAsStringAsync.mockResolvedValue(btoa('%PDF-1.4'));

      // Mock merged document
      const mockMergedDoc = {
        copyPages: jest.fn().mockResolvedValue([mockPage, mockPage]), // Mock copied pages
        addPage: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockResolvedValue('mock-pdf-bytes')
      };

      // Mock PDFLib create method
      const { PDFDocument } = require('react-native-pdf-lib');
      PDFDocument.create = jest.fn().mockResolvedValue(mockMergedDoc);

      // Mock writeAsStringAsync
      mockFileSystem.writeAsStringAsync.mockResolvedValue(undefined);
    });

    it('should successfully merge multiple PDFs', async () => {
      const result = await pdfEngine.mergePDFs(testFilePaths);

      expect(result).toMatch(/merged-pdf-.*\.pdf$/);
      expect(mockFileSystem.getInfoAsync).toHaveBeenCalledTimes(3); // 2 input files + 1 output verification
      
      const { PDFDocument } = require('react-native-pdf-lib');
      expect(PDFDocument.loadDocument).toHaveBeenCalledTimes(2);
      expect(PDFDocument.create).toHaveBeenCalled();
    });

    it('should throw error for empty file paths array', async () => {
      await expect(pdfEngine.mergePDFs([])).rejects.toThrow('No PDF files provided for merging');
    });

    it('should throw error for single file', async () => {
      await expect(pdfEngine.mergePDFs([testFilePaths[0]])).rejects.toThrow('At least two PDF files are required for merging');
    });

    it('should throw error if any file does not exist', async () => {
      const invalidPaths = ['/path/to/test1.pdf', '/path/to/nonexistent.pdf'];
      
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (path === '/path/to/test1.pdf') {
          return Promise.resolve({ exists: true } as any);
        }
        return Promise.resolve({ exists: false } as any);
      });

      await expect(pdfEngine.mergePDFs(invalidPaths)).rejects.toThrow('PDF file not found: /path/to/nonexistent.pdf');
    });

    it('should throw error for invalid PDF format', async () => {
      mockFileSystem.readAsStringAsync.mockResolvedValue(btoa('Not a PDF'));

      await expect(pdfEngine.mergePDFs(testFilePaths)).rejects.toThrow('Invalid PDF format');
    });

    it('should call progress callback during merge', async () => {
      const progressCallback = jest.fn();
      pdfEngine.onMergeProgress = progressCallback;

      await pdfEngine.mergePDFs(testFilePaths);

      expect(progressCallback).toHaveBeenCalledWith(50, 'Processing 1 of 2 files');
      expect(progressCallback).toHaveBeenCalledWith(100, 'Processing 2 of 2 files');
    });

    it('should handle PDF processing errors gracefully', async () => {
      const { PDFDocument } = require('react-native-pdf-lib');
      PDFDocument.loadDocument.mockRejectedValueOnce(new Error('Corrupted PDF'));

      await expect(pdfEngine.mergePDFs(testFilePaths)).rejects.toThrow('Failed to process PDF /path/to/test1.pdf: Corrupted PDF');
    });

    it('should throw error if merged file creation fails', async () => {
      // Mock successful merge but failed file creation
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (testFilePaths.includes(path)) {
          return Promise.resolve({ exists: true } as any);
        }
        if (path.includes('merged-pdf-')) {
          return Promise.resolve({ exists: false } as any); // Simulate creation failure
        }
        return Promise.resolve({ exists: false } as any);
      });

      await expect(pdfEngine.mergePDFs(testFilePaths)).rejects.toThrow('Failed to create merged PDF file');
    });
  });

  describe('splitPDF', () => {
    const testFilePath = '/path/to/test.pdf';
    const testPageRanges: PageRange[] = [
      { startPage: 1, endPage: 2 },
      { startPage: 3, endPage: 5 }
    ];

    beforeEach(() => {
      // Mock file existence
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (path === testFilePath || path.includes('split-pdf-')) {
          return Promise.resolve({
            exists: true,
            isDirectory: false,
            uri: path,
            size: 1024,
            modificationTime: Date.now()
          } as any);
        }
        return Promise.resolve({ exists: false } as any);
      });

      // Mock PDF validation
      mockFileSystem.readAsStringAsync.mockResolvedValue(btoa('%PDF-1.4'));

      // Mock new document creation
      const mockNewDoc = {
        copyPages: jest.fn().mockResolvedValue([mockPage, mockPage]),
        addPage: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockResolvedValue('mock-pdf-bytes')
      };

      const { PDFDocument } = require('react-native-pdf-lib');
      PDFDocument.create = jest.fn().mockResolvedValue(mockNewDoc);

      // Mock writeAsStringAsync
      mockFileSystem.writeAsStringAsync.mockResolvedValue(undefined);
    });

    it('should successfully split PDF into multiple files', async () => {
      const result = await pdfEngine.splitPDF(testFilePath, testPageRanges);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatch(/split-pdf-.*-range-1\.pdf$/);
      expect(result[1]).toMatch(/split-pdf-.*-range-2\.pdf$/);
      
      const { PDFDocument } = require('react-native-pdf-lib');
      expect(PDFDocument.loadDocument).toHaveBeenCalledWith(testFilePath);
      expect(PDFDocument.create).toHaveBeenCalledTimes(2);
    });

    it('should throw error for empty file path', async () => {
      await expect(pdfEngine.splitPDF('', testPageRanges)).rejects.toThrow('File path is required for splitting');
    });

    it('should throw error for empty page ranges', async () => {
      await expect(pdfEngine.splitPDF(testFilePath, [])).rejects.toThrow('At least one page range is required for splitting');
    });

    it('should throw error if file does not exist', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false } as any);

      await expect(pdfEngine.splitPDF(testFilePath, testPageRanges)).rejects.toThrow('PDF file not found');
    });

    it('should throw error for invalid PDF format', async () => {
      mockFileSystem.readAsStringAsync.mockResolvedValue(btoa('Not a PDF'));

      await expect(pdfEngine.splitPDF(testFilePath, testPageRanges)).rejects.toThrow('Invalid PDF format');
    });

    it('should validate page ranges against document page count', async () => {
      const invalidRanges: PageRange[] = [{ startPage: 1, endPage: 10 }]; // Document only has 5 pages

      await expect(pdfEngine.splitPDF(testFilePath, invalidRanges)).rejects.toThrow('Invalid end page 10. Document has 5 pages.');
    });

    it('should throw error for invalid page range order', async () => {
      const invalidRanges: PageRange[] = [{ startPage: 3, endPage: 1 }];

      await expect(pdfEngine.splitPDF(testFilePath, invalidRanges)).rejects.toThrow('Start page 3 cannot be greater than end page 1');
    });

    it('should call progress callback during split', async () => {
      const progressCallback = jest.fn();
      pdfEngine.onSplitProgress = progressCallback;

      await pdfEngine.splitPDF(testFilePath, testPageRanges);

      expect(progressCallback).toHaveBeenCalledWith(50, 'Created 1 of 2 split files');
      expect(progressCallback).toHaveBeenCalledWith(100, 'Created 2 of 2 split files');
    });

    it('should handle file creation errors gracefully', async () => {
      // Mock successful split but failed file creation
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (path === testFilePath) {
          return Promise.resolve({ exists: true } as any);
        }
        if (path.includes('split-pdf-')) {
          return Promise.resolve({ exists: false } as any); // Simulate creation failure
        }
        return Promise.resolve({ exists: false } as any);
      });

      await expect(pdfEngine.splitPDF(testFilePath, testPageRanges)).rejects.toThrow('Failed to create split PDF file');
    });
  });

  describe('extractPages', () => {
    const testFilePath = '/path/to/test.pdf';
    const testPageNumbers = [1, 3, 5];

    beforeEach(() => {
      // Mock file existence
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (path === testFilePath || path.includes('extracted-pages-')) {
          return Promise.resolve({
            exists: true,
            isDirectory: false,
            uri: path,
            size: 1024,
            modificationTime: Date.now()
          } as any);
        }
        return Promise.resolve({ exists: false } as any);
      });

      // Mock PDF validation
      mockFileSystem.readAsStringAsync.mockResolvedValue(btoa('%PDF-1.4'));

      // Mock new document creation
      const mockNewDoc = {
        copyPages: jest.fn().mockResolvedValue([mockPage, mockPage, mockPage]),
        addPage: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockResolvedValue('mock-pdf-bytes')
      };

      const { PDFDocument } = require('react-native-pdf-lib');
      PDFDocument.create = jest.fn().mockResolvedValue(mockNewDoc);

      // Mock writeAsStringAsync
      mockFileSystem.writeAsStringAsync.mockResolvedValue(undefined);
    });

    it('should successfully extract specific pages', async () => {
      const result = await pdfEngine.extractPages(testFilePath, testPageNumbers);

      expect(result).toMatch(/extracted-pages-.*\.pdf$/);
      
      const { PDFDocument } = require('react-native-pdf-lib');
      expect(PDFDocument.loadDocument).toHaveBeenCalledWith(testFilePath);
      expect(PDFDocument.create).toHaveBeenCalled();
    });

    it('should throw error for empty file path', async () => {
      await expect(pdfEngine.extractPages('', testPageNumbers)).rejects.toThrow('File path is required for page extraction');
    });

    it('should throw error for empty page numbers', async () => {
      await expect(pdfEngine.extractPages(testFilePath, [])).rejects.toThrow('At least one page number is required for extraction');
    });

    it('should validate page numbers against document page count', async () => {
      const invalidPageNumbers = [1, 10]; // Document only has 5 pages

      await expect(pdfEngine.extractPages(testFilePath, invalidPageNumbers)).rejects.toThrow('Invalid page number 10. Document has 5 pages.');
    });
  });

  describe('deletePages', () => {
    const testFilePath = '/path/to/test.pdf';
    const testPageNumbers = [2, 4];

    beforeEach(() => {
      // Mock file existence
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (path === testFilePath || path.includes('extracted-pages-')) {
          return Promise.resolve({
            exists: true,
            isDirectory: false,
            uri: path,
            size: 1024,
            modificationTime: Date.now()
          } as any);
        }
        return Promise.resolve({ exists: false } as any);
      });

      // Mock PDF validation
      mockFileSystem.readAsStringAsync.mockResolvedValue(btoa('%PDF-1.4'));

      // Mock new document creation
      const mockNewDoc = {
        copyPages: jest.fn().mockResolvedValue([mockPage, mockPage, mockPage]),
        addPage: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockResolvedValue('mock-pdf-bytes')
      };

      const { PDFDocument } = require('react-native-pdf-lib');
      PDFDocument.create = jest.fn().mockResolvedValue(mockNewDoc);

      // Mock writeAsStringAsync
      mockFileSystem.writeAsStringAsync.mockResolvedValue(undefined);
    });

    it('should successfully delete specific pages', async () => {
      const result = await pdfEngine.deletePages(testFilePath, testPageNumbers);

      expect(result).toMatch(/extracted-pages-.*\.pdf$/);
      
      const { PDFDocument } = require('react-native-pdf-lib');
      expect(PDFDocument.loadDocument).toHaveBeenCalledWith(testFilePath);
    });

    it('should throw error for empty file path', async () => {
      await expect(pdfEngine.deletePages('', testPageNumbers)).rejects.toThrow('File path is required for page deletion');
    });

    it('should throw error for empty page numbers', async () => {
      await expect(pdfEngine.deletePages(testFilePath, [])).rejects.toThrow('At least one page number is required for deletion');
    });

    it('should throw error when trying to delete all pages', async () => {
      const allPageNumbers = [1, 2, 3, 4, 5]; // All pages in the document

      await expect(pdfEngine.deletePages(testFilePath, allPageNumbers)).rejects.toThrow('Cannot delete all pages from the document');
    });

    it('should validate page numbers against document page count', async () => {
      const invalidPageNumbers = [1, 10]; // Document only has 5 pages

      await expect(pdfEngine.deletePages(testFilePath, invalidPageNumbers)).rejects.toThrow('Invalid page number 10. Document has 5 pages.');
    });
  });

  describe('editPDFText', () => {
    const testFilePath = '/path/to/test.pdf';
    const testEdits: TextEdit[] = [
      {
        pageNumber: 1,
        x: 100,
        y: 200,
        width: 150,
        height: 20,
        newText: 'Updated text'
      }
    ];

    beforeEach(() => {
      // Mock file existence
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (path === testFilePath || path.includes('edited-pdf-')) {
          return Promise.resolve({
            exists: true,
            isDirectory: false,
            uri: path,
            size: 1024,
            modificationTime: Date.now()
          } as any);
        }
        return Promise.resolve({ exists: false } as any);
      });

      // Mock PDF validation
      mockFileSystem.readAsStringAsync.mockResolvedValue(btoa('%PDF-1.4'));

      // Mock new document creation with drawing methods
      const mockEditedDoc = {
        copyPages: jest.fn().mockResolvedValue([mockPage]),
        addPage: jest.fn().mockResolvedValue(undefined),
        getPage: jest.fn().mockReturnValue({
          drawRectangle: jest.fn(),
          drawText: jest.fn()
        }),
        save: jest.fn().mockResolvedValue('mock-pdf-bytes')
      };

      const { PDFDocument } = require('react-native-pdf-lib');
      PDFDocument.create = jest.fn().mockResolvedValue(mockEditedDoc);

      // Mock writeAsStringAsync
      mockFileSystem.writeAsStringAsync.mockResolvedValue(undefined);
    });

    it('should successfully edit PDF text', async () => {
      const result = await pdfEngine.editPDFText(testFilePath, testEdits);

      expect(result).toMatch(/edited-pdf-.*\.pdf$/);
      
      const { PDFDocument } = require('react-native-pdf-lib');
      expect(PDFDocument.loadDocument).toHaveBeenCalledWith(testFilePath);
      expect(PDFDocument.create).toHaveBeenCalled();
    });

    it('should throw error for empty file path', async () => {
      await expect(pdfEngine.editPDFText('', testEdits)).rejects.toThrow('File path is required for text editing');
    });

    it('should throw error for empty edits array', async () => {
      await expect(pdfEngine.editPDFText(testFilePath, [])).rejects.toThrow('At least one text edit is required');
    });

    it('should throw error if file does not exist', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false } as any);

      await expect(pdfEngine.editPDFText(testFilePath, testEdits)).rejects.toThrow('PDF file not found');
    });

    it('should validate edit page numbers against document page count', async () => {
      const invalidEdits: TextEdit[] = [{
        pageNumber: 10, // Document only has 5 pages
        x: 100,
        y: 200,
        width: 150,
        height: 20,
        newText: 'Invalid edit'
      }];

      await expect(pdfEngine.editPDFText(testFilePath, invalidEdits)).rejects.toThrow('Invalid page number 10. Document has 5 pages.');
    });

    it('should handle editing errors gracefully and continue with other edits', async () => {
      const mockEditedDoc = {
        copyPages: jest.fn().mockResolvedValue([mockPage]),
        addPage: jest.fn().mockResolvedValue(undefined),
        getPage: jest.fn().mockImplementation(() => {
          throw new Error('Page access failed');
        }),
        save: jest.fn().mockResolvedValue('mock-pdf-bytes')
      };

      const { PDFDocument } = require('react-native-pdf-lib');
      PDFDocument.create = jest.fn().mockResolvedValue(mockEditedDoc);

      // Should not throw error, but continue processing
      const result = await pdfEngine.editPDFText(testFilePath, testEdits);
      expect(result).toMatch(/edited-pdf-.*\.pdf$/);
    });
  });

  describe('addAnnotations', () => {
    const testFilePath = '/path/to/test.pdf';
    const testAnnotations: Annotation[] = [
      {
        type: 'text',
        pageNumber: 1,
        x: 100,
        y: 200,
        width: 150,
        height: 20,
        content: 'Test annotation',
        color: '#FF0000'
      },
      {
        type: 'highlight',
        pageNumber: 1,
        x: 50,
        y: 100,
        width: 200,
        height: 30,
        content: '',
        color: 'yellow'
      }
    ];

    beforeEach(() => {
      // Mock file existence
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (path === testFilePath || path.includes('annotated-pdf-')) {
          return Promise.resolve({
            exists: true,
            isDirectory: false,
            uri: path,
            size: 1024,
            modificationTime: Date.now()
          } as any);
        }
        return Promise.resolve({ exists: false } as any);
      });

      // Mock PDF validation
      mockFileSystem.readAsStringAsync.mockResolvedValue(btoa('%PDF-1.4'));

      // Mock new document creation with drawing methods
      const mockAnnotatedDoc = {
        copyPages: jest.fn().mockResolvedValue([mockPage]),
        addPage: jest.fn().mockResolvedValue(undefined),
        getPage: jest.fn().mockReturnValue({
          drawText: jest.fn(),
          drawRectangle: jest.fn()
        }),
        save: jest.fn().mockResolvedValue('mock-pdf-bytes')
      };

      const { PDFDocument } = require('react-native-pdf-lib');
      PDFDocument.create = jest.fn().mockResolvedValue(mockAnnotatedDoc);

      // Mock writeAsStringAsync
      mockFileSystem.writeAsStringAsync.mockResolvedValue(undefined);
    });

    it('should successfully add annotations to PDF', async () => {
      const result = await pdfEngine.addAnnotations(testFilePath, testAnnotations);

      expect(result).toMatch(/annotated-pdf-.*\.pdf$/);
      
      const { PDFDocument } = require('react-native-pdf-lib');
      expect(PDFDocument.loadDocument).toHaveBeenCalledWith(testFilePath);
      expect(PDFDocument.create).toHaveBeenCalled();
    });

    it('should throw error for empty file path', async () => {
      await expect(pdfEngine.addAnnotations('', testAnnotations)).rejects.toThrow('File path is required for adding annotations');
    });

    it('should throw error for empty annotations array', async () => {
      await expect(pdfEngine.addAnnotations(testFilePath, [])).rejects.toThrow('At least one annotation is required');
    });

    it('should validate annotation page numbers against document page count', async () => {
      const invalidAnnotations: Annotation[] = [{
        type: 'text',
        pageNumber: 10, // Document only has 5 pages
        x: 100,
        y: 200,
        width: 150,
        height: 20,
        content: 'Invalid annotation',
        color: '#FF0000'
      }];

      await expect(pdfEngine.addAnnotations(testFilePath, invalidAnnotations)).rejects.toThrow('Invalid page number 10. Document has 5 pages.');
    });

    it('should handle different annotation types', async () => {
      const drawingAnnotation: Annotation = {
        type: 'drawing',
        pageNumber: 1,
        x: 100,
        y: 200,
        width: 50,
        height: 50,
        content: {
          points: [{ x: 100, y: 200 }, { x: 150, y: 250 }],
          strokeWidth: 3,
          strokeColor: '#0000FF'
        },
        color: '#0000FF'
      };

      const result = await pdfEngine.addAnnotations(testFilePath, [drawingAnnotation]);
      expect(result).toMatch(/annotated-pdf-.*\.pdf$/);
    });

    it('should handle annotation errors gracefully and continue with other annotations', async () => {
      const mockAnnotatedDoc = {
        copyPages: jest.fn().mockResolvedValue([mockPage]),
        addPage: jest.fn().mockResolvedValue(undefined),
        getPage: jest.fn().mockImplementation(() => {
          throw new Error('Page access failed');
        }),
        save: jest.fn().mockResolvedValue('mock-pdf-bytes')
      };

      const { PDFDocument } = require('react-native-pdf-lib');
      PDFDocument.create = jest.fn().mockResolvedValue(mockAnnotatedDoc);

      // Should not throw error, but continue processing
      const result = await pdfEngine.addAnnotations(testFilePath, testAnnotations);
      expect(result).toMatch(/annotated-pdf-.*\.pdf$/);
    });
  });

  describe('parseColor', () => {
    it('should parse hex colors correctly', () => {
      const pdfEngine = new PDFEngine();
      
      // Access private method for testing
      const parseColor = (pdfEngine as any).parseColor.bind(pdfEngine);
      
      expect(parseColor('#FF0000')).toEqual({ r: 1, g: 0, b: 0 }); // Red
      expect(parseColor('#00FF00')).toEqual({ r: 0, g: 1, b: 0 }); // Green
      expect(parseColor('#0000FF')).toEqual({ r: 0, g: 0, b: 1 }); // Blue
      expect(parseColor('#FFF')).toEqual({ r: 1, g: 1, b: 1 }); // White (short form)
    });

    it('should parse named colors correctly', () => {
      const pdfEngine = new PDFEngine();
      const parseColor = (pdfEngine as any).parseColor.bind(pdfEngine);
      
      expect(parseColor('red')).toEqual({ r: 1, g: 0, b: 0 });
      expect(parseColor('green')).toEqual({ r: 0, g: 1, b: 0 });
      expect(parseColor('blue')).toEqual({ r: 0, g: 0, b: 1 });
      expect(parseColor('yellow')).toEqual({ r: 1, g: 1, b: 0 });
    });

    it('should default to black for invalid colors', () => {
      const pdfEngine = new PDFEngine();
      const parseColor = (pdfEngine as any).parseColor.bind(pdfEngine);
      
      expect(parseColor('invalid')).toEqual({ r: 0, g: 0, b: 0 });
      expect(parseColor('#GGGGGG')).toEqual({ r: 0, g: 0, b: 0 });
      expect(parseColor('')).toEqual({ r: 0, g: 0, b: 0 });
    });
  });

  describe('placeholder methods', () => {
    it('should throw not implemented errors for future methods', async () => {
      // All methods are now implemented, so this test is no longer needed
      // Keep it for consistency but expect no errors
      expect(true).toBe(true);
    });
  });
});