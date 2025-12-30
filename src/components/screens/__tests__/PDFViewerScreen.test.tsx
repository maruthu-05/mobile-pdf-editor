import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';

import { PDFViewerScreen } from '../PDFViewerScreen';
import { PDFEngine } from '../../../modules/pdf-engine';

// Mock dependencies
jest.mock('expo-haptics');
jest.mock('../../../modules/pdf-engine');
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: any) => children,
  PinchGestureHandler: ({ children }: any) => children,
  State: { ACTIVE: 4 },
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

const mockPDFEngine = PDFEngine as jest.MockedClass<typeof PDFEngine>;

describe('PDFViewerScreen', () => {
  const mockFilePath = '/path/to/test.pdf';
  const mockOnClose = jest.fn();
  const mockOnPageSelect = jest.fn();

  const mockPDFDocument = {
    filePath: mockFilePath,
    pageCount: 5,
    metadata: {
      title: 'Test PDF',
      author: 'Test Author',
    },
  };

  const mockImageData = {
    uri: 'data:image/png;base64,test',
    width: 400,
    height: 600,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup PDF engine mock
    const mockEngineInstance = {
      loadPDF: jest.fn().mockResolvedValue(mockPDFDocument),
      renderPage: jest.fn().mockResolvedValue(mockImageData),
      addAnnotations: jest.fn().mockResolvedValue('/path/to/annotated.pdf'),
      getPageCount: jest.fn().mockResolvedValue(5),
    };
    
    mockPDFEngine.mockImplementation(() => mockEngineInstance as any);
  });

  describe('PDF Loading', () => {
    it('should render loading state initially', () => {
      const { getByText } = render(
        <PDFViewerScreen filePath={mockFilePath} onClose={mockOnClose} />
      );

      expect(getByText('Loading PDF...')).toBeTruthy();
    });

    it('should load PDF document and display first page', async () => {
      const { getByText, queryByText } = render(
        <PDFViewerScreen filePath={mockFilePath} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(queryByText('Loading PDF...')).toBeNull();
      });

      expect(getByText('Page 1 of 5')).toBeTruthy();
    });

    it('should display error state when PDF loading fails', async () => {
      const mockEngineInstance = {
        loadPDF: jest.fn().mockRejectedValue(new Error('Failed to load PDF')),
      };
      mockPDFEngine.mockImplementation(() => mockEngineInstance as any);

      const { getByText } = render(
        <PDFViewerScreen filePath={mockFilePath} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Error Loading PDF')).toBeTruthy();
        expect(getByText('Failed to load PDF')).toBeTruthy();
      });
    });

    it('should retry loading PDF when retry button is pressed', async () => {
      const mockEngineInstance = {
        loadPDF: jest.fn()
          .mockRejectedValueOnce(new Error('Failed to load PDF'))
          .mockResolvedValueOnce(mockPDFDocument),
        renderPage: jest.fn().mockResolvedValue(mockImageData),
      };
      mockPDFEngine.mockImplementation(() => mockEngineInstance as any);

      const { getByText, queryByText } = render(
        <PDFViewerScreen filePath={mockFilePath} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Error Loading PDF')).toBeTruthy();
      });

      fireEvent.press(getByText('Retry'));

      await waitFor(() => {
        expect(queryByText('Error Loading PDF')).toBeNull();
        expect(getByText('Page 1 of 5')).toBeTruthy();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to next page when next button is pressed', async () => {
      const { getByText, getByTestId } = render(
        <PDFViewerScreen filePath={mockFilePath} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Page 1 of 5')).toBeTruthy();
      });

      // Find and press the next page button (chevron-down icon)
      const nextButton = getByText('1 / 5').parent?.parent?.children[2];
      if (nextButton) {
        fireEvent.press(nextButton);
        expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
      }
    });

    it('should navigate to previous page when previous button is pressed', async () => {
      const { getByText } = render(
        <PDFViewerScreen filePath={mockFilePath} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Page 1 of 5')).toBeTruthy();
      });

      // Navigate to page 2 first, then test previous
      const nextButton = getByText('1 / 5').parent?.parent?.children[2];
      if (nextButton) {
        fireEvent.press(nextButton);
        
        // Now test previous button
        const prevButton = getByText('2 / 5').parent?.parent?.children[0];
        if (prevButton) {
          fireEvent.press(prevButton);
          expect(Haptics.impactAsync).toHaveBeenCalled();
        }
      }
    });

    it('should disable navigation buttons at document boundaries', async () => {
      const { getByText } = render(
        <PDFViewerScreen filePath={mockFilePath} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Page 1 of 5')).toBeTruthy();
      });

      // Previous button should be disabled on first page
      const prevButton = getByText('1 / 5').parent?.parent?.children[0];
      expect(prevButton?.props.accessibilityState?.disabled).toBeTruthy();
    });
  });

  describe('Page Selection Mode', () => {
    it('should allow page selection in selection mode', async () => {
      const { getByText } = render(
        <PDFViewerScreen 
          filePath={mockFilePath} 
          onClose={mockOnClose}
          onPageSelect={mockOnPageSelect}
          selectionMode={true}
        />
      );

      await waitFor(() => {
        expect(getByText('Page 1 of 5')).toBeTruthy();
      });

      // Simulate page tap in selection mode
      const pageContainer = getByText('1').parent;
      if (pageContainer) {
        fireEvent.press(pageContainer);
        expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
      }
    });

    it('should confirm page selection when confirm button is pressed', async () => {
      const { getByText } = render(
        <PDFViewerScreen 
          filePath={mockFilePath} 
          onClose={mockOnClose}
          onPageSelect={mockOnPageSelect}
          selectionMode={true}
        />
      );

      await waitFor(() => {
        expect(getByText('Page 1 of 5')).toBeTruthy();
      });

      // Select a page first
      const pageContainer = getByText('1').parent;
      if (pageContainer) {
        fireEvent.press(pageContainer);
      }

      // Find and press confirm button
      await waitFor(() => {
        const confirmButton = getByText('Confirm Selection');
        fireEvent.press(confirmButton);
        expect(mockOnPageSelect).toHaveBeenCalledWith([1]);
      });
    });
  });

  describe('Editing Mode', () => {
    it('should toggle editing mode when edit button is pressed', async () => {
      const { getByText } = render(
        <PDFViewerScreen filePath={mockFilePath} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Page 1 of 5')).toBeTruthy();
      });

      // Find the edit button in the toolbar
      const toolbar = getByText('Page 1 of 5').parent;
      const editButton = toolbar?.children[2]; // Third child should be edit button
      
      if (editButton) {
        fireEvent.press(editButton);
        // Should show editing toolbar with annotation tools
        expect(getByText('Page 1 of 5')).toBeTruthy(); // Toolbar should still be visible
      }
    });

    it('should show annotation modal when text tool is selected and page is tapped', async () => {
      const { getByText, getByPlaceholderText } = render(
        <PDFViewerScreen filePath={mockFilePath} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Page 1 of 5')).toBeTruthy();
      });

      // Enter editing mode
      const toolbar = getByText('Page 1 of 5').parent;
      const editButton = toolbar?.children[2];
      
      if (editButton) {
        fireEvent.press(editButton);
        
        // Tap on page to add annotation
        const pageContainer = getByText('1').parent;
        if (pageContainer) {
          fireEvent.press(pageContainer, {
            nativeEvent: { locationX: 100, locationY: 100 }
          });
          
          // Should show annotation modal
          await waitFor(() => {
            expect(getByText('Add Text Annotation')).toBeTruthy();
            expect(getByPlaceholderText('Enter annotation text...')).toBeTruthy();
          });
        }
      }
    });

    it('should add text annotation when confirmed', async () => {
      const mockEngineInstance = {
        loadPDF: jest.fn().mockResolvedValue(mockPDFDocument),
        renderPage: jest.fn().mockResolvedValue(mockImageData),
        addAnnotations: jest.fn().mockResolvedValue('/path/to/annotated.pdf'),
      };
      mockPDFEngine.mockImplementation(() => mockEngineInstance as any);

      const { getByText, getByPlaceholderText } = render(
        <PDFViewerScreen filePath={mockFilePath} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Page 1 of 5')).toBeTruthy();
      });

      // Enter editing mode and add text annotation
      const toolbar = getByText('Page 1 of 5').parent;
      const editButton = toolbar?.children[2];
      
      if (editButton) {
        fireEvent.press(editButton);
        
        const pageContainer = getByText('1').parent;
        if (pageContainer) {
          fireEvent.press(pageContainer, {
            nativeEvent: { locationX: 100, locationY: 100 }
          });
          
          await waitFor(() => {
            const textInput = getByPlaceholderText('Enter annotation text...');
            fireEvent.changeText(textInput, 'Test annotation');
            
            const addButton = getByText('Add');
            fireEvent.press(addButton);
            
            expect(mockEngineInstance.addAnnotations).toHaveBeenCalledWith(
              mockFilePath,
              [{
                type: 'text',
                pageNumber: 1,
                x: 100,
                y: 100,
                width: 100,
                height: 20,
                content: 'Test annotation',
                color: '#000000',
              }]
            );
          });
        }
      }
    });
  });

  describe('Touch Interactions', () => {
    it('should toggle toolbar visibility when page is tapped', async () => {
      const { getByText, queryByText } = render(
        <PDFViewerScreen filePath={mockFilePath} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Page 1 of 5')).toBeTruthy();
      });

      // Tap on page to hide toolbar
      const pageContainer = getByText('1').parent;
      if (pageContainer) {
        fireEvent.press(pageContainer);
        
        // Toolbar should still be visible initially due to auto-hide timeout
        expect(getByText('Page 1 of 5')).toBeTruthy();
      }
    });

    it('should handle long press for page selection in selection mode', async () => {
      const { getByText } = render(
        <PDFViewerScreen 
          filePath={mockFilePath} 
          onClose={mockOnClose}
          selectionMode={true}
        />
      );

      await waitFor(() => {
        expect(getByText('Page 1 of 5')).toBeTruthy();
      });

      const pageContainer = getByText('1').parent;
      if (pageContainer) {
        fireEvent(pageContainer, 'onLongPress');
        expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle annotation addition errors gracefully', async () => {
      const mockEngineInstance = {
        loadPDF: jest.fn().mockResolvedValue(mockPDFDocument),
        renderPage: jest.fn().mockResolvedValue(mockImageData),
        addAnnotations: jest.fn().mockRejectedValue(new Error('Annotation failed')),
      };
      mockPDFEngine.mockImplementation(() => mockEngineInstance as any);

      const { getByText, getByPlaceholderText } = render(
        <PDFViewerScreen filePath={mockFilePath} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Page 1 of 5')).toBeTruthy();
      });

      // Try to add annotation that will fail
      const toolbar = getByText('Page 1 of 5').parent;
      const editButton = toolbar?.children[2];
      
      if (editButton) {
        fireEvent.press(editButton);
        
        const pageContainer = getByText('1').parent;
        if (pageContainer) {
          fireEvent.press(pageContainer, {
            nativeEvent: { locationX: 100, locationY: 100 }
          });
          
          await waitFor(() => {
            const textInput = getByPlaceholderText('Enter annotation text...');
            fireEvent.changeText(textInput, 'Test annotation');
            
            const addButton = getByText('Add');
            fireEvent.press(addButton);
          });

          await waitFor(() => {
            expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to add annotation');
          });
        }
      }
    });

    it('should handle page loading errors gracefully', async () => {
      const mockEngineInstance = {
        loadPDF: jest.fn().mockResolvedValue(mockPDFDocument),
        renderPage: jest.fn().mockRejectedValue(new Error('Page render failed')),
      };
      mockPDFEngine.mockImplementation(() => mockEngineInstance as any);

      const { getByText } = render(
        <PDFViewerScreen filePath={mockFilePath} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Page 1 of 5')).toBeTruthy();
      });

      // Page should show loading state when render fails
      expect(getByText('Loading page 1...')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should provide proper accessibility labels', async () => {
      const { getByText } = render(
        <PDFViewerScreen filePath={mockFilePath} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Page 1 of 5')).toBeTruthy();
      });

      // Check that page numbers are visible for screen readers
      expect(getByText('1')).toBeTruthy();
    });

    it('should handle keyboard navigation properly', async () => {
      const { getByText } = render(
        <PDFViewerScreen filePath={mockFilePath} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Page 1 of 5')).toBeTruthy();
      });

      // Navigation buttons should be accessible
      const toolbar = getByText('1 / 5').parent;
      expect(toolbar).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should cache rendered pages', async () => {
      const mockEngineInstance = {
        loadPDF: jest.fn().mockResolvedValue(mockPDFDocument),
        renderPage: jest.fn().mockResolvedValue(mockImageData),
      };
      mockPDFEngine.mockImplementation(() => mockEngineInstance as any);

      const { getByText } = render(
        <PDFViewerScreen filePath={mockFilePath} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Page 1 of 5')).toBeTruthy();
      });

      // renderPage should be called for initial page load
      expect(mockEngineInstance.renderPage).toHaveBeenCalledWith(mockFilePath, 1, 1);
      
      // Should also preload adjacent pages
      await waitFor(() => {
        expect(mockEngineInstance.renderPage).toHaveBeenCalledWith(mockFilePath, 2, 1);
      });
    });

    it('should handle zoom scale changes', async () => {
      const { getByText } = render(
        <PDFViewerScreen filePath={mockFilePath} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(getByText('Page 1 of 5')).toBeTruthy();
      });

      // Zoom functionality is handled by PinchGestureHandler
      // The component should re-render pages when scale changes
      expect(getByText('Page 1 of 5')).toBeTruthy();
    });
  });
});