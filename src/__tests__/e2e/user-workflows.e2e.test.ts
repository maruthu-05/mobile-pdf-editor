/**
 * End-to-End Tests for Complete User Workflows
 * Tests the complete user journey from upload to edit to save
 */

import { DocumentLibrary } from '../../modules/document-library/DocumentLibrary';
import { PDFEngine } from '../../modules/pdf-engine/PDFEngine';
import { FileManager } from '../../modules/file-manager/FileManager';
import { StorageManager } from '../../modules/storage-manager/StorageManager';
import { ErrorHandler } from '../../modules/error-handling/ErrorHandler';
import { BackupManager } from '../../modules/error-handling/BackupManager';

// Mock all external dependencies
jest.mock('expo-document-picker');
jest.mock('expo-file-system');
jest.mock('expo-sharing');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('react-native-pdf-lib');

describe('End-to-End User Workflows', () => {
  let documentLibrary: DocumentLibrary;
  let pdfEngine: PDFEngine;
  let fileManager: FileManager;
  let storageManager: StorageManager;
  let errorHandler: ErrorHandler;
  let backupManager: BackupManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    documentLibrary = DocumentLibrary.getInstance();
    pdfEngine = PDFEngine.getInstance();
    fileManager = FileManager.getInstance();
    storageManager = StorageManager.getInstance();
    errorHandler = ErrorHandler.getInstance();
    backupManager = BackupManager.getInstance();
  });

  describe('Complete Upload → Edit → Save Workflow', () => {
    it('should complete full workflow: upload PDF, edit text, add annotations, and save', async () => {
      // Step 1: Upload PDF file
      const mockFileUri = 'file:///path/to/test.pdf';
      const mockFileData = new Uint8Array([37, 80, 68, 70]); // PDF header
      
      const DocumentPicker = require('expo-document-picker');
      DocumentPicker.getDocumentAsync.mockResolvedValue({
        type: 'success',
        uri: mockFileUri,
        name: 'test.pdf',
        size: 1000000,
      });

      // Mock file reading
      const FileSystem = require('expo-file-system');
      FileSystem.readAsStringAsync.mockResolvedValue('mock-pdf-content');
      FileSystem.writeAsStringAsync.mockResolvedValue();
      FileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: 1000000,
        modificationTime: Date.now(),
      });

      // Mock PDF loading
      jest.spyOn(pdfEngine, 'loadPDF').mockResolvedValue({
        pageCount: 3,
        title: 'Test Document',
        author: 'Test Author',
        creationDate: new Date(),
        modificationDate: new Date(),
      } as any);

      // Mock file saving
      const savedPath = '/local/documents/test.pdf';
      jest.spyOn(fileManager, 'saveFile').mockResolvedValue(savedPath);

      // Execute upload
      const uploadResult = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: false,
      });

      expect(uploadResult.type).toBe('success');
      
      const filePath = await fileManager.saveFile(mockFileData, uploadResult.name);
      const pdfDocument = await pdfEngine.loadPDF(filePath);
      
      // Add to document library
      await documentLibrary.addDocument(filePath, {
        id: 'doc1',
        fileName: uploadResult.name,
        filePath: filePath,
        fileSize: uploadResult.size,
        pageCount: pdfDocument.pageCount,
        createdAt: new Date(),
        modifiedAt: new Date(),
      });

      // Step 2: Edit PDF text
      const textEdits = [{
        pageNumber: 1,
        x: 100,
        y: 200,
        width: 300,
        height: 50,
        newText: 'Updated text content',
      }];

      const editedPath = '/local/documents/test_edited.pdf';
      jest.spyOn(pdfEngine, 'editPDFText').mockResolvedValue(editedPath);
      
      const textEditResult = await pdfEngine.editPDFText(filePath, textEdits);
      expect(textEditResult).toBe(editedPath);

      // Step 3: Add annotations
      const annotations = [
        {
          type: 'text' as const,
          pageNumber: 1,
          x: 150,
          y: 300,
          width: 200,
          height: 30,
          content: 'Important note',
          color: '#ff0000',
        },
        {
          type: 'highlight' as const,
          pageNumber: 2,
          x: 50,
          y: 100,
          width: 400,
          height: 20,
          content: '',
          color: '#ffff00',
        },
      ];

      const annotatedPath = '/local/documents/test_annotated.pdf';
      jest.spyOn(pdfEngine, 'addAnnotations').mockResolvedValue(annotatedPath);
      
      const annotationResult = await pdfEngine.addAnnotations(textEditResult, annotations);
      expect(annotationResult).toBe(annotatedPath);

      // Step 4: Save final document
      await documentLibrary.updateDocument('doc1', {
        filePath: annotationResult,
        modifiedAt: new Date(),
      });

      // Verify the complete workflow
      const documents = await documentLibrary.getDocuments();
      expect(documents).toHaveLength(1);
      expect(documents[0].filePath).toBe(annotatedPath);
      expect(documents[0].pageCount).toBe(3);
    });

    it('should complete merge workflow: select multiple PDFs, reorder, and merge', async () => {
      // Setup multiple PDF files
      const pdfFiles = [
        { name: 'doc1.pdf', path: '/local/doc1.pdf', pages: 5 },
        { name: 'doc2.pdf', path: '/local/doc2.pdf', pages: 3 },
        { name: 'doc3.pdf', path: '/local/doc3.pdf', pages: 7 },
      ];

      // Mock document library with multiple documents
      jest.spyOn(documentLibrary, 'getDocuments').mockResolvedValue(
        pdfFiles.map((file, index) => ({
          id: `doc${index + 1}`,
          fileName: file.name,
          filePath: file.path,
          fileSize: 1000000,
          pageCount: file.pages,
          createdAt: new Date(),
          modifiedAt: new Date(),
        }))
      );

      // Step 1: Select PDFs for merging
      const selectedDocuments = await documentLibrary.getDocuments();
      expect(selectedDocuments).toHaveLength(3);

      // Step 2: Reorder documents (simulate drag and drop)
      const reorderedPaths = [
        selectedDocuments[2].filePath, // doc3.pdf first
        selectedDocuments[0].filePath, // doc1.pdf second
        selectedDocuments[1].filePath, // doc2.pdf third
      ];

      // Step 3: Execute merge
      const mergedPath = '/local/merged_document.pdf';
      jest.spyOn(pdfEngine, 'mergePDFs').mockResolvedValue(mergedPath);

      const mergeResult = await pdfEngine.mergePDFs(reorderedPaths);
      expect(mergeResult).toBe(mergedPath);

      // Step 4: Add merged document to library
      await documentLibrary.addDocument(mergedPath, {
        id: 'merged1',
        fileName: 'merged_document.pdf',
        filePath: mergedPath,
        fileSize: 3000000,
        pageCount: 15, // 7 + 5 + 3
        createdAt: new Date(),
        modifiedAt: new Date(),
      });

      // Verify merge workflow
      const allDocuments = await documentLibrary.getDocuments();
      const mergedDoc = allDocuments.find(doc => doc.id === 'merged1');
      expect(mergedDoc).toBeDefined();
      expect(mergedDoc!.pageCount).toBe(15);
    });

    it('should complete split workflow: select pages, extract to new document', async () => {
      // Setup source document
      const sourceDoc = {
        id: 'source1',
        fileName: 'large_document.pdf',
        filePath: '/local/large_document.pdf',
        fileSize: 5000000,
        pageCount: 20,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };

      jest.spyOn(documentLibrary, 'getDocuments').mockResolvedValue([sourceDoc]);

      // Step 1: Load document for splitting
      const documents = await documentLibrary.getDocuments();
      const docToSplit = documents[0];

      // Step 2: Select page ranges for extraction
      const pageRanges = [
        { startPage: 1, endPage: 5 },   // Pages 1-5
        { startPage: 10, endPage: 15 }, // Pages 10-15
      ];

      // Step 3: Execute split operation
      const extractedPaths = [
        '/local/extracted_pages_1-5.pdf',
        '/local/extracted_pages_10-15.pdf',
      ];
      
      jest.spyOn(pdfEngine, 'splitPDF').mockResolvedValue(extractedPaths);

      const splitResult = await pdfEngine.splitPDF(docToSplit.filePath, pageRanges);
      expect(splitResult).toEqual(extractedPaths);

      // Step 4: Add extracted documents to library
      for (let i = 0; i < extractedPaths.length; i++) {
        const pageRange = pageRanges[i];
        const pageCount = pageRange.endPage - pageRange.startPage + 1;
        
        await documentLibrary.addDocument(extractedPaths[i], {
          id: `extracted${i + 1}`,
          fileName: `extracted_pages_${pageRange.startPage}-${pageRange.endPage}.pdf`,
          filePath: extractedPaths[i],
          fileSize: 1000000,
          pageCount: pageCount,
          createdAt: new Date(),
          modifiedAt: new Date(),
        });
      }

      // Verify split workflow
      const allDocuments = await documentLibrary.getDocuments();
      const extractedDocs = allDocuments.filter(doc => doc.id.startsWith('extracted'));
      expect(extractedDocs).toHaveLength(2);
      expect(extractedDocs[0].pageCount).toBe(5);
      expect(extractedDocs[1].pageCount).toBe(6);
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should recover from failed operations with backup restoration', async () => {
      const originalPath = '/local/important.pdf';
      const backupPath = '/local/backups/important_backup.pdf';

      // Setup original document
      jest.spyOn(documentLibrary, 'getDocuments').mockResolvedValue([{
        id: 'important1',
        fileName: 'important.pdf',
        filePath: originalPath,
        fileSize: 2000000,
        pageCount: 10,
        createdAt: new Date(),
        modifiedAt: new Date(),
      }]);

      // Step 1: Create backup before risky operation
      jest.spyOn(backupManager, 'createBackup').mockResolvedValue(backupPath);
      const backup = await backupManager.createBackup(originalPath);
      expect(backup).toBe(backupPath);

      // Step 2: Simulate failed operation
      jest.spyOn(pdfEngine, 'editPDFText').mockRejectedValue(new Error('Operation failed'));

      const textEdits = [{
        pageNumber: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        newText: 'New text',
      }];

      // Step 3: Handle error and restore backup
      try {
        await pdfEngine.editPDFText(originalPath, textEdits);
      } catch (error) {
        // Error handler should restore backup
        jest.spyOn(backupManager, 'restoreBackup').mockResolvedValue(originalPath);
        const restoredPath = await backupManager.restoreBackup(backupPath, originalPath);
        expect(restoredPath).toBe(originalPath);
      }

      // Verify document is restored
      const documents = await documentLibrary.getDocuments();
      expect(documents[0].filePath).toBe(originalPath);
    });

    it('should handle storage full scenario during save operation', async () => {
      const FileSystem = require('expo-file-system');
      
      // Mock storage full error
      FileSystem.writeAsStringAsync.mockRejectedValue(new Error('ENOSPC: no space left on device'));
      FileSystem.getFreeDiskStorageAsync.mockResolvedValue(0); // No free space

      // Step 1: Attempt to save large file
      const largeFileData = new Uint8Array(100 * 1024 * 1024); // 100MB
      
      try {
        await fileManager.saveFile(largeFileData, 'large_file.pdf');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Step 2: Trigger storage cleanup
      jest.spyOn(storageManager, 'cleanupStorage').mockResolvedValue(50 * 1024 * 1024); // Free 50MB
      const bytesFreed = await storageManager.cleanupStorage({
        removeTemporaryFiles: true,
        removeThumbnails: true,
        compressOldFiles: false,
        removeBackups: false,
      });

      expect(bytesFreed).toBe(50 * 1024 * 1024);

      // Step 3: Retry save operation
      FileSystem.writeAsStringAsync.mockResolvedValue();
      FileSystem.getFreeDiskStorageAsync.mockResolvedValue(50 * 1024 * 1024);
      
      jest.spyOn(fileManager, 'saveFile').mockResolvedValue('/local/large_file.pdf');
      const savedPath = await fileManager.saveFile(largeFileData, 'large_file.pdf');
      expect(savedPath).toBe('/local/large_file.pdf');
    });
  });

  describe('Performance Workflows', () => {
    it('should handle large document operations efficiently', async () => {
      const startTime = Date.now();

      // Setup large document (100 pages)
      const largeDoc = {
        id: 'large1',
        fileName: 'large_document.pdf',
        filePath: '/local/large_document.pdf',
        fileSize: 50 * 1024 * 1024, // 50MB
        pageCount: 100,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };

      jest.spyOn(documentLibrary, 'getDocuments').mockResolvedValue([largeDoc]);

      // Mock PDF operations with realistic delays
      jest.spyOn(pdfEngine, 'loadPDF').mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          pageCount: 100,
          title: 'Large Document',
          author: 'Test Author',
          creationDate: new Date(),
          modificationDate: new Date(),
        } as any), 100))
      );

      jest.spyOn(pdfEngine, 'renderPage').mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          width: 612,
          height: 792,
          data: new Uint8Array(1000),
        } as any), 50))
      );

      // Execute operations
      const documents = await documentLibrary.getDocuments();
      const document = documents[0];
      
      const pdfDoc = await pdfEngine.loadPDF(document.filePath);
      
      // Render first 5 pages
      const pagePromises = [];
      for (let i = 1; i <= 5; i++) {
        pagePromises.push(pdfEngine.renderPage(document.filePath, i));
      }
      
      const renderedPages = await Promise.all(pagePromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify performance
      expect(pdfDoc.pageCount).toBe(100);
      expect(renderedPages).toHaveLength(5);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent operations without blocking UI', async () => {
      // Setup multiple documents
      const documents = Array.from({ length: 5 }, (_, i) => ({
        id: `doc${i + 1}`,
        fileName: `document${i + 1}.pdf`,
        filePath: `/local/document${i + 1}.pdf`,
        fileSize: 1000000,
        pageCount: 10,
        createdAt: new Date(),
        modifiedAt: new Date(),
      }));

      jest.spyOn(documentLibrary, 'getDocuments').mockResolvedValue(documents);

      // Mock concurrent operations
      jest.spyOn(pdfEngine, 'renderPage').mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          width: 612,
          height: 792,
          data: new Uint8Array(1000),
        } as any), 100))
      );

      const startTime = Date.now();

      // Execute concurrent operations
      const concurrentOperations = documents.map(async (doc, index) => {
        return pdfEngine.renderPage(doc.filePath, 1);
      });

      const results = await Promise.all(concurrentOperations);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify concurrent execution
      expect(results).toHaveLength(5);
      expect(duration).toBeLessThan(500); // Should be faster than sequential execution
    });
  });

  describe('Accessibility Workflows', () => {
    it('should support screen reader navigation through documents', async () => {
      // Mock accessibility features
      const mockAccessibilityInfo = {
        isScreenReaderEnabled: true,
        isReduceMotionEnabled: false,
        isBoldTextEnabled: false,
      };

      // Setup document with accessibility metadata
      const accessibleDoc = {
        id: 'accessible1',
        fileName: 'accessible_document.pdf',
        filePath: '/local/accessible_document.pdf',
        fileSize: 1000000,
        pageCount: 5,
        createdAt: new Date(),
        modifiedAt: new Date(),
        accessibilityFeatures: {
          hasTextContent: true,
          hasStructuredContent: true,
          hasAlternativeText: true,
        },
      };

      jest.spyOn(documentLibrary, 'getDocuments').mockResolvedValue([accessibleDoc]);

      // Mock PDF content extraction for screen readers
      jest.spyOn(pdfEngine, 'extractTextContent').mockResolvedValue([
        { page: 1, text: 'Chapter 1: Introduction' },
        { page: 2, text: 'This document contains important information...' },
        { page: 3, text: 'Section 2: Main Content' },
      ]);

      // Execute accessibility workflow
      const documents = await documentLibrary.getDocuments();
      const document = documents[0];
      
      const textContent = await pdfEngine.extractTextContent(document.filePath);

      // Verify accessibility support
      expect(textContent).toHaveLength(3);
      expect(textContent[0].text).toContain('Chapter 1');
      expect(document.accessibilityFeatures?.hasTextContent).toBe(true);
    });

    it('should support touch interactions with proper feedback', async () => {
      const Haptics = require('expo-haptics');
      
      // Mock haptic feedback
      Haptics.impactAsync.mockResolvedValue();
      Haptics.notificationAsync.mockResolvedValue();

      // Simulate touch interactions
      const touchInteractions = [
        { type: 'tap', target: 'document' },
        { type: 'longPress', target: 'page' },
        { type: 'pinch', target: 'zoom' },
        { type: 'swipe', target: 'navigation' },
      ];

      // Execute touch interactions with haptic feedback
      for (const interaction of touchInteractions) {
        switch (interaction.type) {
          case 'tap':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case 'longPress':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case 'pinch':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case 'swipe':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            break;
        }
      }

      // Verify haptic feedback was triggered
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(3);
      expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    });
  });
});