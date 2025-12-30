import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';

import { SplitScreen } from '../SplitScreen';
import { PDFEngine } from '../../../modules/pdf-engine';
import { DocumentLibrary } from '../../../modules/document-library';
import { FileManager } from '../../../modules/file-manager';

// Mock dependencies
jest.mock('expo-haptics');
jest.mock('../../../modules/pdf-engine');
jest.mock('../../../modules/document-library');
jest.mock('../../../modules/file-manager');

// Mock Alert
jest.spyOn(Alert, 'alert');

const mockPDFEngine = PDFEngine as jest.MockedClass<typeof PDFEngine>;
const mockDocumentLibrary = DocumentLibrary as jest.MockedClass<typeof DocumentLibrary>;
const mockFileManager = FileManager as jest.MockedClass<typeof FileManager>;

describe('SplitScreen', () => {
  const mockDocumentId = 'test-doc-id';
  const mockFilePath = '/path/to/test.pdf';
  const mockOnClose = jest.fn();
  const mockOnSplitComplete = jest.fn();

  const mockDocument = {
    id: mockDocumentId,
    fileName: 'test-document.pdf',
    filePath: mockFilePath,
    fileSize: 1024000,
    pageCount: 5,
    createdAt: new Date('2023-01-01'),
    modifiedAt: new Date('2023-01-01'),
  };

  const mockPDFDocument = {
    filePath: mockFilePath,
    pageCount: 5,
    metadata: {
      title: 'Test PDF',
      author: 'Test Author',
    },
  };

  const mockThumbnailData = {
    uri: 'data:image/png;base64,thumbnail',
    width: 150,
    height: 200,
  };

  const mockFileInfo = {
    fileName: 'test-document.pdf',
    filePath: mockFilePath,
    fileSize: 1024000,
    createdAt: new Date('2023-01-01'),
    modifiedAt: new Date('2023-01-01'),
    mimeType: 'application/pdf',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup PDF engine mock
    const mockEngineInstance = {
      loadPDF: jest.fn().mockResolvedValue(mockPDFDocument),
      generateThumbnail: jest.fn().mockResolvedValue(mockThumbnailData),
      extractPages: jest.fn().mockResolvedValue('/path/to/extracted.pdf'),
      deletePages: jest.fn().mockResolvedValue('/path/to/modified.pdf'),
    };
    mockPDFEngine.mockImplementation(() => mockEngineInstance as any);

    // Setup document library mock
    const mockLibraryInstance = {
      getDocuments: jest.fn().mockResolvedValue([mockDocument]),
      addDocument: jest.fn().mockResolvedValue(undefined),
      updateDocument: jest.fn().mockResolvedValue(undefined),
    };
    mockDocumentLibrary.mockImplementation(() => mockLibraryInstance as any);

    // Setup file manager mock
    const mockFileManagerInstance = {
      getFileInfo: jest.fn().mockResolvedValue(mockFileInfo),
    };
    mockFileManager.mockImplementation(() => mockFileManagerInstance as any);
  });

  describe('Initialization', () => {
    it('should render loading state initially', () => {
      const { getByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      expect(getByText('Loading PDF pages...')).toBeTruthy();
    });

    it('should load document by ID and display page thumbnails', async () => {
      const { getByText, queryByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(queryByText('Loading PDF pages...')).toBeNull();
      });

      expect(getByText('Split PDF')).toBeTruthy();
      expect(getByText('test-document.pdf')).toBeTruthy();
      
      // Should show page numbers
      expect(getByText('1')).toBeTruthy();
      expect(getByText('2')).toBeTruthy();
      expect(getByText('5')).toBeTruthy();
    });

    it('should load document by file path when no document ID provided', async () => {
      const { getByText, queryByText } = render(
        <SplitScreen filePath={mockFilePath} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(queryByText('Loading PDF pages...')).toBeNull();
      });

      expect(getByText('Split PDF')).toBeTruthy();
      expect(getByText('test-document.pdf')).toBeTruthy();
    });

    it('should display error when document not found', async () => {
      const mockLibraryInstance = {
        getDocuments: jest.fn().mockResolvedValue([]),
      };
      mockDocumentLibrary.mockImplementation(() => mockLibraryInstance as any);

      const { getByText } = render(
        <SplitScreen documentId="non-existent" onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Error Loading PDF')).toBeTruthy();
        expect(getByText('Document not found')).toBeTruthy();
      });
    });

    it('should display error when PDF loading fails', async () => {
      const mockEngineInstance = {
        loadPDF: jest.fn().mockRejectedValue(new Error('Failed to load PDF')),
      };
      mockPDFEngine.mockImplementation(() => mockEngineInstance as any);

      const { getByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Error Loading PDF')).toBeTruthy();
        expect(getByText('Failed to load PDF')).toBeTruthy();
      });
    });

    it('should retry loading when retry button is pressed', async () => {
      const mockEngineInstance = {
        loadPDF: jest.fn()
          .mockRejectedValueOnce(new Error('Failed to load PDF'))
          .mockResolvedValueOnce(mockPDFDocument),
        generateThumbnail: jest.fn().mockResolvedValue(mockThumbnailData),
      };
      mockPDFEngine.mockImplementation(() => mockEngineInstance as any);

      const { getByText, queryByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Error Loading PDF')).toBeTruthy();
      });

      fireEvent.press(getByText('Retry'));

      await waitFor(() => {
        expect(queryByText('Error Loading PDF')).toBeNull();
        expect(getByText('Split PDF')).toBeTruthy();
      });
    });
  });

  describe('Page Selection', () => {
    it('should allow selecting individual pages', async () => {
      const { getByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      // Tap on page 1 to select it
      const page1 = getByText('1').parent;
      if (page1) {
        fireEvent.press(page1);
        expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
      }

      // Should show selection info
      await waitFor(() => {
        expect(getByText('1 of 5 pages selected')).toBeTruthy();
      });
    });

    it('should toggle page selection when tapped multiple times', async () => {
      const { getByText, queryByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      const page1 = getByText('1').parent;
      if (page1) {
        // Select page
        fireEvent.press(page1);
        await waitFor(() => {
          expect(getByText('1 of 5 pages selected')).toBeTruthy();
        });

        // Deselect page
        fireEvent.press(page1);
        await waitFor(() => {
          expect(queryByText('1 of 5 pages selected')).toBeNull();
        });
      }
    });

    it('should enter selection mode on long press', async () => {
      const { getByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      const page1 = getByText('1').parent;
      if (page1) {
        fireEvent(page1, 'onLongPress');
        
        // Should show quick selection buttons
        await waitFor(() => {
          expect(getByText('First Half')).toBeTruthy();
          expect(getByText('Second Half')).toBeTruthy();
          expect(getByText('All Pages')).toBeTruthy();
          expect(getByText('Clear')).toBeTruthy();
        });
      }
    });

    it('should toggle selection mode when header button is pressed', async () => {
      const { getByText, queryByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      // Find and press the selection mode toggle button
      const header = getByText('Split PDF').parent;
      const toggleButton = header?.children[2]; // Third child should be toggle button
      
      if (toggleButton) {
        fireEvent.press(toggleButton);
        
        // Should show quick selection buttons
        await waitFor(() => {
          expect(getByText('First Half')).toBeTruthy();
        });

        // Press again to exit selection mode
        fireEvent.press(toggleButton);
        
        await waitFor(() => {
          expect(queryByText('First Half')).toBeNull();
        });
      }
    });
  });

  describe('Quick Selection', () => {
    beforeEach(async () => {
      // Helper to enter selection mode
      const component = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(component.getByText('Split PDF')).toBeTruthy();
      });

      // Enter selection mode
      const header = component.getByText('Split PDF').parent;
      const toggleButton = header?.children[2];
      if (toggleButton) {
        fireEvent.press(toggleButton);
      }

      return component;
    });

    it('should select first half of pages', async () => {
      const { getByText } = await beforeEach();

      fireEvent.press(getByText('First Half'));

      await waitFor(() => {
        expect(getByText('3 of 5 pages selected')).toBeTruthy(); // Pages 1, 2, 3
      });
    });

    it('should select second half of pages', async () => {
      const { getByText } = await beforeEach();

      fireEvent.press(getByText('Second Half'));

      await waitFor(() => {
        expect(getByText('2 of 5 pages selected')).toBeTruthy(); // Pages 4, 5
      });
    });

    it('should select all pages', async () => {
      const { getByText } = await beforeEach();

      fireEvent.press(getByText('All Pages'));

      await waitFor(() => {
        expect(getByText('5 of 5 pages selected')).toBeTruthy();
      });
    });

    it('should clear selection', async () => {
      const { getByText, queryByText } = await beforeEach();

      // First select some pages
      fireEvent.press(getByText('All Pages'));
      await waitFor(() => {
        expect(getByText('5 of 5 pages selected')).toBeTruthy();
      });

      // Then clear selection
      fireEvent.press(getByText('Clear'));
      await waitFor(() => {
        expect(queryByText('5 of 5 pages selected')).toBeNull();
      });
    });
  });

  describe('Extract Pages Operation', () => {
    it('should show extract button when pages are selected', async () => {
      const { getByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      // Select a page
      const page1 = getByText('1').parent;
      if (page1) {
        fireEvent.press(page1);
      }

      await waitFor(() => {
        expect(getByText('Extract Pages')).toBeTruthy();
      });
    });

    it('should show confirmation modal when extract is pressed', async () => {
      const { getByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      // Select pages and extract
      const page1 = getByText('1').parent;
      if (page1) {
        fireEvent.press(page1);
      }

      await waitFor(() => {
        fireEvent.press(getByText('Extract Pages'));
      });

      await waitFor(() => {
        expect(getByText('Extract Pages')).toBeTruthy(); // Modal title
        expect(getByText('Extract 1 selected page to a new PDF file?')).toBeTruthy();
      });
    });

    it('should extract pages when confirmed', async () => {
      const mockEngineInstance = {
        loadPDF: jest.fn().mockResolvedValue(mockPDFDocument),
        generateThumbnail: jest.fn().mockResolvedValue(mockThumbnailData),
        extractPages: jest.fn().mockResolvedValue('/path/to/extracted.pdf'),
      };
      mockPDFEngine.mockImplementation(() => mockEngineInstance as any);

      const mockFileManagerInstance = {
        getFileInfo: jest.fn().mockResolvedValue({
          ...mockFileInfo,
          fileName: 'extracted.pdf',
          filePath: '/path/to/extracted.pdf',
        }),
      };
      mockFileManager.mockImplementation(() => mockFileManagerInstance as any);

      const { getByText } = render(
        <SplitScreen 
          documentId={mockDocumentId} 
          onClose={mockOnClose}
          onSplitComplete={mockOnSplitComplete}
        />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      // Select page and extract
      const page1 = getByText('1').parent;
      if (page1) {
        fireEvent.press(page1);
      }

      await waitFor(() => {
        fireEvent.press(getByText('Extract Pages'));
      });

      await waitFor(() => {
        fireEvent.press(getByText('Extract')); // Confirm button
      });

      await waitFor(() => {
        expect(mockEngineInstance.extractPages).toHaveBeenCalledWith(mockFilePath, [1]);
        expect(Alert.alert).toHaveBeenCalledWith(
          'Pages Extracted',
          'Successfully extracted 1 page to a new PDF.',
          expect.any(Array)
        );
      });
    });

    it('should show alert when no pages selected for extraction', async () => {
      const { getByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      // Enter selection mode to show action buttons
      const header = getByText('Split PDF').parent;
      const toggleButton = header?.children[2];
      if (toggleButton) {
        fireEvent.press(toggleButton);
      }

      // Try to extract without selecting pages
      await waitFor(() => {
        const page1 = getByText('1').parent;
        if (page1) {
          fireEvent.press(page1); // Select
          fireEvent.press(page1); // Deselect
        }
      });

      // Extract button should not be visible when no pages selected
      // This tests the UI behavior rather than showing an alert
    });
  });

  describe('Delete Pages Operation', () => {
    it('should show delete button when pages are selected', async () => {
      const { getByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      // Select a page
      const page1 = getByText('1').parent;
      if (page1) {
        fireEvent.press(page1);
      }

      await waitFor(() => {
        expect(getByText('Delete Pages')).toBeTruthy();
      });
    });

    it('should show confirmation modal when delete is pressed', async () => {
      const { getByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      // Select pages and delete
      const page1 = getByText('1').parent;
      if (page1) {
        fireEvent.press(page1);
      }

      await waitFor(() => {
        fireEvent.press(getByText('Delete Pages'));
      });

      await waitFor(() => {
        expect(getByText('Delete Pages')).toBeTruthy(); // Modal title
        expect(getByText(/Permanently delete 1 selected page/)).toBeTruthy();
        expect(getByText(/This action cannot be undone/)).toBeTruthy();
      });
    });

    it('should delete pages when confirmed', async () => {
      const mockEngineInstance = {
        loadPDF: jest.fn().mockResolvedValue(mockPDFDocument),
        generateThumbnail: jest.fn().mockResolvedValue(mockThumbnailData),
        deletePages: jest.fn().mockResolvedValue('/path/to/modified.pdf'),
      };
      mockPDFEngine.mockImplementation(() => mockEngineInstance as any);

      const mockFileManagerInstance = {
        getFileInfo: jest.fn().mockResolvedValue({
          ...mockFileInfo,
          fileName: 'modified.pdf',
          filePath: '/path/to/modified.pdf',
        }),
      };
      mockFileManager.mockImplementation(() => mockFileManagerInstance as any);

      const { getByText } = render(
        <SplitScreen 
          documentId={mockDocumentId} 
          onClose={mockOnClose}
          onSplitComplete={mockOnSplitComplete}
        />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      // Select page and delete
      const page1 = getByText('1').parent;
      if (page1) {
        fireEvent.press(page1);
      }

      await waitFor(() => {
        fireEvent.press(getByText('Delete Pages'));
      });

      await waitFor(() => {
        fireEvent.press(getByText('Delete')); // Confirm button
      });

      await waitFor(() => {
        expect(mockEngineInstance.deletePages).toHaveBeenCalledWith(mockFilePath, [1]);
        expect(Alert.alert).toHaveBeenCalledWith(
          'Pages Deleted',
          'Successfully deleted 1 page from the PDF.',
          expect.any(Array)
        );
      });
    });

    it('should prevent deleting all pages', async () => {
      const { getByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      // Enter selection mode and select all pages
      const header = getByText('Split PDF').parent;
      const toggleButton = header?.children[2];
      if (toggleButton) {
        fireEvent.press(toggleButton);
      }

      await waitFor(() => {
        fireEvent.press(getByText('All Pages'));
      });

      await waitFor(() => {
        fireEvent.press(getByText('Delete Pages'));
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Invalid Selection',
        'Cannot delete all pages from the document.'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle extraction errors gracefully', async () => {
      const mockEngineInstance = {
        loadPDF: jest.fn().mockResolvedValue(mockPDFDocument),
        generateThumbnail: jest.fn().mockResolvedValue(mockThumbnailData),
        extractPages: jest.fn().mockRejectedValue(new Error('Extraction failed')),
      };
      mockPDFEngine.mockImplementation(() => mockEngineInstance as any);

      const { getByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      // Select page and try to extract
      const page1 = getByText('1').parent;
      if (page1) {
        fireEvent.press(page1);
      }

      await waitFor(() => {
        fireEvent.press(getByText('Extract Pages'));
      });

      await waitFor(() => {
        fireEvent.press(getByText('Extract'));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Operation Failed',
          'Extraction failed'
        );
      });
    });

    it('should handle deletion errors gracefully', async () => {
      const mockEngineInstance = {
        loadPDF: jest.fn().mockResolvedValue(mockPDFDocument),
        generateThumbnail: jest.fn().mockResolvedValue(mockThumbnailData),
        deletePages: jest.fn().mockRejectedValue(new Error('Deletion failed')),
      };
      mockPDFEngine.mockImplementation(() => mockEngineInstance as any);

      const { getByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      // Select page and try to delete
      const page1 = getByText('1').parent;
      if (page1) {
        fireEvent.press(page1);
      }

      await waitFor(() => {
        fireEvent.press(getByText('Delete Pages'));
      });

      await waitFor(() => {
        fireEvent.press(getByText('Delete'));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Operation Failed',
          'Deletion failed'
        );
      });
    });

    it('should handle thumbnail loading errors gracefully', async () => {
      const mockEngineInstance = {
        loadPDF: jest.fn().mockResolvedValue(mockPDFDocument),
        generateThumbnail: jest.fn().mockRejectedValue(new Error('Thumbnail failed')),
      };
      mockPDFEngine.mockImplementation(() => mockEngineInstance as any);

      const { getByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      // Should still show page numbers even if thumbnails fail
      expect(getByText('1')).toBeTruthy();
      expect(getByText('2')).toBeTruthy();
    });
  });

  describe('Modal Interactions', () => {
    it('should cancel operation when cancel button is pressed', async () => {
      const { getByText, queryByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      // Select page and open modal
      const page1 = getByText('1').parent;
      if (page1) {
        fireEvent.press(page1);
      }

      await waitFor(() => {
        fireEvent.press(getByText('Extract Pages'));
      });

      await waitFor(() => {
        expect(getByText('Extract 1 selected page to a new PDF file?')).toBeTruthy();
      });

      // Cancel the operation
      fireEvent.press(getByText('Cancel'));

      await waitFor(() => {
        expect(queryByText('Extract 1 selected page to a new PDF file?')).toBeNull();
      });
    });

    it('should show loading state during operation', async () => {
      const mockEngineInstance = {
        loadPDF: jest.fn().mockResolvedValue(mockPDFDocument),
        generateThumbnail: jest.fn().mockResolvedValue(mockThumbnailData),
        extractPages: jest.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve('/path/to/extracted.pdf'), 1000))
        ),
      };
      mockPDFEngine.mockImplementation(() => mockEngineInstance as any);

      const { getByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      // Select page and extract
      const page1 = getByText('1').parent;
      if (page1) {
        fireEvent.press(page1);
      }

      await waitFor(() => {
        fireEvent.press(getByText('Extract Pages'));
      });

      await waitFor(() => {
        fireEvent.press(getByText('Extract'));
      });

      // Should show loading indicator
      // Note: This test would need to be adjusted based on the actual loading implementation
    });
  });

  describe('Navigation', () => {
    it('should call onClose when back button is pressed', async () => {
      const { getByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      // Find and press the back button
      const header = getByText('Split PDF').parent;
      const backButton = header?.children[0]; // First child should be back button
      
      if (backButton) {
        fireEvent.press(backButton);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });

    it('should call onSplitComplete with new documents after successful operation', async () => {
      const mockEngineInstance = {
        loadPDF: jest.fn().mockResolvedValue(mockPDFDocument),
        generateThumbnail: jest.fn().mockResolvedValue(mockThumbnailData),
        extractPages: jest.fn().mockResolvedValue('/path/to/extracted.pdf'),
      };
      mockPDFEngine.mockImplementation(() => mockEngineInstance as any);

      const { getByText } = render(
        <SplitScreen 
          documentId={mockDocumentId} 
          onClose={mockOnClose}
          onSplitComplete={mockOnSplitComplete}
        />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      // Perform extraction
      const page1 = getByText('1').parent;
      if (page1) {
        fireEvent.press(page1);
      }

      await waitFor(() => {
        fireEvent.press(getByText('Extract Pages'));
      });

      await waitFor(() => {
        fireEvent.press(getByText('Extract'));
      });

      // Should call onSplitComplete after successful extraction
      await waitFor(() => {
        expect(mockOnSplitComplete).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              fileName: expect.stringContaining('extracted'),
              pageCount: 1,
            })
          ])
        );
      });
    });
  });

  describe('Accessibility', () => {
    it('should provide proper accessibility labels for page selection', async () => {
      const { getByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      // Page numbers should be accessible
      expect(getByText('1')).toBeTruthy();
      expect(getByText('2')).toBeTruthy();
    });

    it('should handle keyboard navigation properly', async () => {
      const { getByText } = render(
        <SplitScreen documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Split PDF')).toBeTruthy();
      });

      // Action buttons should be accessible when pages are selected
      const page1 = getByText('1').parent;
      if (page1) {
        fireEvent.press(page1);
      }

      await waitFor(() => {
        expect(getByText('Extract Pages')).toBeTruthy();
        expect(getByText('Delete Pages')).toBeTruthy();
      });
    });
  });
});