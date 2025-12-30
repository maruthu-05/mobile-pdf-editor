import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { PDFEngine } from '../../modules/pdf-engine';
import { DocumentLibrary } from '../../modules/document-library';
import { FileManager } from '../../modules/file-manager';
import { ImageData, DocumentMetadata, PageRange } from '../../types';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface SplitScreenProps {
  document: DocumentMetadata;
  onSplitComplete?: (newDocuments: DocumentMetadata[]) => void;
}

interface PageThumbnail {
  pageNumber: number;
  imageData: ImageData | null;
  loading: boolean;
}

type SplitOperation = 'extract' | 'delete';

export const SplitScreen: React.FC<SplitScreenProps> = ({
  document,
  onSplitComplete,
}) => {
  const router = useRouter();
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [pageThumbnails, setPageThumbnails] = useState<PageThumbnail[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<SplitOperation | null>(null);

  // Refs
  const pdfEngine = useRef(new PDFEngine());
  const documentLibrary = useRef(new DocumentLibrary());
  const fileManager = useRef(new FileManager());

  // Initialize component
  useEffect(() => {
    initializeDocument();
  }, [document.id]);

  const initializeDocument = async () => {
    try {
      setLoading(true);
      setError(null);

      const pdfFilePath = document.filePath;

      // Load PDF document
      const pdfDocument = await pdfEngine.current.loadPDF(pdfFilePath);
      setTotalPages(pdfDocument.pageCount);

      // Initialize page thumbnails
      const thumbnails: PageThumbnail[] = Array.from(
        { length: pdfDocument.pageCount },
        (_, index) => ({
          pageNumber: index + 1,
          imageData: null,
          loading: true,
        })
      );
      setPageThumbnails(thumbnails);

      // Load thumbnails
      await loadThumbnails(pdfFilePath, pdfDocument.pageCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const loadThumbnails = async (pdfFilePath: string, pageCount: number) => {
    const thumbnailSize = 150; // Max width/height for thumbnails
    
    // Load thumbnails in batches to avoid memory issues
    const batchSize = 5;
    for (let i = 0; i < pageCount; i += batchSize) {
      const batch = Array.from(
        { length: Math.min(batchSize, pageCount - i) },
        (_, index) => i + index + 1
      );

      await Promise.all(
        batch.map(async (pageNumber) => {
          try {
            const imageData = await pdfEngine.current.generateThumbnail(
              pdfFilePath,
              thumbnailSize,
              thumbnailSize
            );
            
            setPageThumbnails(prev => 
              prev.map(thumb => 
                thumb.pageNumber === pageNumber
                  ? { ...thumb, imageData, loading: false }
                  : thumb
              )
            );
          } catch (err) {
            console.error(`Failed to load thumbnail for page ${pageNumber}:`, err);
            setPageThumbnails(prev => 
              prev.map(thumb => 
                thumb.pageNumber === pageNumber
                  ? { ...thumb, loading: false }
                  : thumb
              )
            );
          }
        })
      );

      // Small delay between batches to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  // Page selection functions
  const togglePageSelection = useCallback((pageNumber: number) => {
    const newSelection = new Set(selectedPages);
    if (newSelection.has(pageNumber)) {
      newSelection.delete(pageNumber);
    } else {
      newSelection.add(pageNumber);
    }
    setSelectedPages(newSelection);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [selectedPages]);

  const selectAllPages = () => {
    const allPages = new Set(Array.from({ length: totalPages }, (_, i) => i + 1));
    setSelectedPages(allPages);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const clearSelection = () => {
    setSelectedPages(new Set());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const selectPageRange = (startPage: number, endPage: number) => {
    const rangePages = new Set<number>();
    for (let i = startPage; i <= endPage; i++) {
      rangePages.add(i);
    }
    setSelectedPages(rangePages);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // Split operations
  const handleExtractPages = () => {
    if (selectedPages.size === 0) {
      Alert.alert('No Pages Selected', 'Please select pages to extract.');
      return;
    }
    setPendingOperation('extract');
    setShowConfirmModal(true);
  };

  const handleDeletePages = () => {
    if (selectedPages.size === 0) {
      Alert.alert('No Pages Selected', 'Please select pages to delete.');
      return;
    }
    if (selectedPages.size >= totalPages) {
      Alert.alert('Invalid Selection', 'Cannot delete all pages from the document.');
      return;
    }
    setPendingOperation('delete');
    setShowConfirmModal(true);
  };

  const confirmOperation = async () => {
    if (!document || !pendingOperation) return;

    try {
      setProcessing(true);
      setShowConfirmModal(false);

      const selectedPageNumbers = Array.from(selectedPages).sort((a, b) => a - b);
      const newDocuments: DocumentMetadata[] = [];

      if (pendingOperation === 'extract') {
        // Extract selected pages to new PDF
        const extractedFilePath = await pdfEngine.current.extractPages(
          document.filePath,
          selectedPageNumbers
        );

        // Create new document metadata
        const extractedFileInfo = await fileManager.current.getFileInfo(extractedFilePath);
        const extractedDoc: DocumentMetadata = {
          id: `extracted_${Date.now()}`,
          fileName: `${document.fileName.replace('.pdf', '')}_extracted.pdf`,
          filePath: extractedFilePath,
          fileSize: extractedFileInfo.fileSize,
          pageCount: selectedPageNumbers.length,
          createdAt: new Date(),
          modifiedAt: new Date(),
        };

        // Add to document library if we have a document ID (not temporary)
        if (document.id && document.id !== 'temp') {
          await documentLibrary.current.addDocument(extractedFilePath, extractedDoc);
        }

        newDocuments.push(extractedDoc);

        Alert.alert(
          'Pages Extracted',
          `Successfully extracted ${selectedPageNumbers.length} page${selectedPageNumbers.length !== 1 ? 's' : ''} to a new PDF.`,
          [{ text: 'OK', onPress: () => onSplitComplete?.(newDocuments) }]
        );
      } else if (pendingOperation === 'delete') {
        // Delete selected pages from original PDF
        const modifiedFilePath = await pdfEngine.current.deletePages(
          document.filePath,
          selectedPageNumbers
        );

        // Update original document
        const modifiedFileInfo = await fileManager.current.getFileInfo(modifiedFilePath);
        const updatedDoc: DocumentMetadata = {
          ...document,
          filePath: modifiedFilePath,
          fileSize: modifiedFileInfo.fileSize,
          pageCount: totalPages - selectedPageNumbers.length,
          modifiedAt: new Date(),
        };

        // Update in document library if we have a document ID
        if (document.id && document.id !== 'temp') {
          await documentLibrary.current.updateDocument(document.id, {
            filePath: modifiedFilePath,
            fileSize: modifiedFileInfo.fileSize,
            pageCount: updatedDoc.pageCount,
            modifiedAt: updatedDoc.modifiedAt,
          });
        }

        newDocuments.push(updatedDoc);

        Alert.alert(
          'Pages Deleted',
          `Successfully deleted ${selectedPageNumbers.length} page${selectedPageNumbers.length !== 1 ? 's' : ''} from the PDF.`,
          [{ text: 'OK', onPress: () => onSplitComplete?.(newDocuments) }]
        );
      }

      // Clear selection and reset state
      setSelectedPages(new Set());
      setPendingOperation(null);
    } catch (err) {
      Alert.alert(
        'Operation Failed',
        err instanceof Error ? err.message : 'Failed to complete the operation'
      );
    } finally {
      setProcessing(false);
    }
  };

  const cancelOperation = () => {
    setShowConfirmModal(false);
    setPendingOperation(null);
  };

  // Render functions
  const renderPageThumbnail = ({ item }: { item: PageThumbnail }) => {
    const isSelected = selectedPages.has(item.pageNumber);

    return (
      <TouchableOpacity
        style={[styles.thumbnailContainer, isSelected && styles.selectedThumbnail]}
        onPress={() => togglePageSelection(item.pageNumber)}
        onLongPress={() => {
          if (!selectionMode) {
            setSelectionMode(true);
            togglePageSelection(item.pageNumber);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.thumbnailImageContainer}>
          {item.loading ? (
            <View style={styles.thumbnailLoading}>
              <ActivityIndicator size="small" color="#007AFF" />
            </View>
          ) : item.imageData ? (
            <Image
              source={{ uri: item.imageData.uri }}
              style={styles.thumbnailImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.thumbnailError}>
              <Ionicons name="document-outline" size={24} color="#999" />
            </View>
          )}
          
          {isSelected && (
            <View style={styles.selectionOverlay}>
              <View style={styles.selectionIndicator}>
                <Ionicons name="checkmark" size={16} color="white" />
              </View>
            </View>
          )}
        </View>
        
        <Text style={styles.pageNumber}>{item.pageNumber}</Text>
      </TouchableOpacity>
    );
  };

  const renderQuickSelectionButtons = () => (
    <View style={styles.quickSelectionContainer}>
      <TouchableOpacity
        style={styles.quickSelectionButton}
        onPress={() => selectPageRange(1, Math.ceil(totalPages / 2))}
      >
        <Text style={styles.quickSelectionText}>First Half</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.quickSelectionButton}
        onPress={() => selectPageRange(Math.ceil(totalPages / 2) + 1, totalPages)}
      >
        <Text style={styles.quickSelectionText}>Second Half</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.quickSelectionButton}
        onPress={selectAllPages}
      >
        <Text style={styles.quickSelectionText}>All Pages</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.quickSelectionButton, styles.clearButton]}
        onPress={clearSelection}
      >
        <Text style={[styles.quickSelectionText, styles.clearButtonText]}>Clear</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading PDF pages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF3B30" />
          <Text style={styles.errorTitle}>Error Loading PDF</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={initializeDocument}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Split PDF</Text>
          <Text style={styles.headerSubtitle}>
            {document?.fileName || 'Unknown Document'}
          </Text>
        </View>
        
        <TouchableOpacity
          onPress={() => setSelectionMode(!selectionMode)}
          style={styles.headerButton}
        >
          <Ionicons 
            name={selectionMode ? "close" : "checkmark-circle-outline"} 
            size={24} 
            color="#007AFF" 
          />
        </TouchableOpacity>
      </View>

      {/* Selection Info */}
      {selectedPages.size > 0 && (
        <View style={styles.selectionInfo}>
          <Text style={styles.selectionText}>
            {selectedPages.size} of {totalPages} page{selectedPages.size !== 1 ? 's' : ''} selected
          </Text>
        </View>
      )}

      {/* Quick Selection Buttons */}
      {selectionMode && renderQuickSelectionButtons()}

      {/* Page Grid */}
      <FlatList
        data={pageThumbnails}
        renderItem={renderPageThumbnail}
        keyExtractor={(item) => item.pageNumber.toString()}
        numColumns={3}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
        getItemLayout={(data, index) => ({
          length: 140,
          offset: 140 * Math.floor(index / 3),
          index,
        })}
      />

      {/* Action Buttons */}
      {selectedPages.size > 0 && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.extractButton]}
            onPress={handleExtractPages}
            disabled={processing}
          >
            <Ionicons name="copy-outline" size={20} color="white" />
            <Text style={styles.actionButtonText}>Extract Pages</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDeletePages}
            disabled={processing}
          >
            <Ionicons name="trash-outline" size={20} color="white" />
            <Text style={styles.actionButtonText}>Delete Pages</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={cancelOperation}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <Ionicons 
              name={pendingOperation === 'delete' ? "warning" : "information-circle"} 
              size={48} 
              color={pendingOperation === 'delete' ? "#FF3B30" : "#007AFF"} 
            />
            
            <Text style={styles.modalTitle}>
              {pendingOperation === 'extract' ? 'Extract Pages' : 'Delete Pages'}
            </Text>
            
            <Text style={styles.modalMessage}>
              {pendingOperation === 'extract'
                ? `Extract ${selectedPages.size} selected page${selectedPages.size !== 1 ? 's' : ''} to a new PDF file?`
                : `Permanently delete ${selectedPages.size} selected page${selectedPages.size !== 1 ? 's' : ''} from this PDF? This action cannot be undone.`
              }
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={cancelOperation}
                disabled={processing}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  pendingOperation === 'delete' && styles.dangerButton,
                ]}
                onPress={confirmOperation}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={[styles.modalButtonText, styles.confirmButtonText]}>
                    {pendingOperation === 'extract' ? 'Extract' : 'Delete'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  selectionInfo: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  selectionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  quickSelectionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  quickSelectionButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  clearButton: {
    backgroundColor: '#FF3B30',
  },
  quickSelectionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  clearButtonText: {
    color: 'white',
  },
  gridContainer: {
    padding: 16,
  },
  thumbnailContainer: {
    flex: 1,
    margin: 4,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  selectedThumbnail: {
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  thumbnailImageContainer: {
    position: 'relative',
    aspectRatio: 0.7,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailError: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  selectionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageNumber: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  extractButton: {
    backgroundColor: '#34C759',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: screenWidth - 40,
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  confirmButtonText: {
    color: 'white',
  },
});