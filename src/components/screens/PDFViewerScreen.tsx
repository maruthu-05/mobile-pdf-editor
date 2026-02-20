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
  TextInput,
  PanResponder,
  Animated,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { GestureHandlerRootView, PinchGestureHandler, State } from 'react-native-gesture-handler';

import { PDFEngine } from '../../modules/pdf-engine';
import { ImageData, Annotation, TextEdit, DocumentMetadata } from '../../types';
import { DocumentLibrary } from '../../modules/document-library';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PDFViewerScreenProps {
  document: DocumentMetadata;
  onPageSelect?: (pageNumbers: number[]) => void;
  selectionMode?: boolean;
}

interface AnnotationTool {
  type: 'text' | 'highlight' | 'drawing';
  color: string;
}

export const PDFViewerScreen: React.FC<PDFViewerScreenProps> = ({
  document,
  onPageSelect,
  selectionMode = false,
}) => {
  const router = useRouter();
  const filePath = document.filePath;
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageImages, setPageImages] = useState<Map<number, ImageData>>(new Map());
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [showToolbar, setShowToolbar] = useState(true);
  const [editingMode, setEditingMode] = useState(false);
  const [selectedTool, setSelectedTool] = useState<AnnotationTool>({ type: 'text', color: '#FF0000' });
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [annotationText, setAnnotationText] = useState('');
  const [pendingAnnotation, setPendingAnnotation] = useState<Partial<Annotation> | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newFileName, setNewFileName] = useState(document.fileName.replace('.pdf', ''));

  // Zoom and pan state
  const [scale, setScale] = useState(1);
  const [lastScale, setLastScale] = useState(1);
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Refs
  const pdfEngine = useRef(new PDFEngine());
  const scrollViewRef = useRef<ScrollView>(null);
  const toolbarTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize PDF document
  useEffect(() => {
    loadPDF();
  }, [document.filePath]);

  // Auto-hide toolbar
  useEffect(() => {
    if (showToolbar && !editingMode) {
      if (toolbarTimeoutRef.current) {
        clearTimeout(toolbarTimeoutRef.current);
      }
      toolbarTimeoutRef.current = setTimeout(() => {
        setShowToolbar(false);
      }, 3000);
    }
    return () => {
      if (toolbarTimeoutRef.current) {
        clearTimeout(toolbarTimeoutRef.current);
      }
    };
  }, [showToolbar, editingMode]);

  const loadPDF = async () => {
    try {
      setLoading(true);
      setError(null);

      const document = await pdfEngine.current.loadPDF(filePath);
      setTotalPages(document.pageCount);

      // Load first page
      await loadPage(1);
      setCurrentPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PDF');
    } finally {
      setLoading(false);
    }
  };

  const loadPage = async (pageNumber: number) => {
    try {
      if (pageImages.has(pageNumber)) {
        return; // Page already loaded
      }

      const imageData = await pdfEngine.current.renderPage(filePath, pageNumber, scale);
      setPageImages(prev => new Map(prev).set(pageNumber, imageData));
    } catch (err) {
      console.error(`Failed to load page ${pageNumber}:`, err);
    }
  };

  // Preload adjacent pages
  useEffect(() => {
    const preloadPages = async () => {
      const pagesToLoad = [];
      
      // Load current page and adjacent pages
      for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages, currentPage + 1); i++) {
        if (!pageImages.has(i)) {
          pagesToLoad.push(i);
        }
      }

      for (const pageNum of pagesToLoad) {
        await loadPage(pageNum);
      }
    };

    if (totalPages > 0) {
      preloadPages();
    }
  }, [currentPage, totalPages, scale]);

  // Navigation functions
  const goToPage = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  const previousPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  // Page selection for split operations
  const togglePageSelection = (pageNumber: number) => {
    if (!selectionMode) return;

    const newSelection = new Set(selectedPages);
    if (newSelection.has(pageNumber)) {
      newSelection.delete(pageNumber);
    } else {
      newSelection.add(pageNumber);
    }
    setSelectedPages(newSelection);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const confirmPageSelection = () => {
    if (selectedPages.size > 0 && onPageSelect) {
      onPageSelect(Array.from(selectedPages).sort((a, b) => a - b));
    }
  };

  // Zoom and pan handlers
  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: new Animated.Value(1) } }],
    { useNativeDriver: false }
  );

  const onPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const newScale = Math.max(0.5, Math.min(3, lastScale * event.nativeEvent.scale));
      setScale(newScale);
      setLastScale(newScale);
    }
  };

  // Touch interactions
  const handlePageTap = (pageNumber: number, event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    
    if (selectionMode) {
      togglePageSelection(pageNumber);
      return;
    }

    if (editingMode) {
      handleAnnotationTap(pageNumber, locationX, locationY);
      return;
    }

    // Toggle toolbar visibility
    setShowToolbar(!showToolbar);
  };

  const handleAnnotationTap = (pageNumber: number, x: number, y: number) => {
    if (selectedTool.type === 'text') {
      setPendingAnnotation({
        type: 'text',
        pageNumber,
        x,
        y,
        width: 100,
        height: 20,
        color: selectedTool.color,
      });
      setShowAnnotationModal(true);
    } else if (selectedTool.type === 'highlight') {
      // For highlight, we'll create a default size highlight
      const annotation: Annotation = {
        type: 'highlight',
        pageNumber,
        x,
        y,
        width: 100,
        height: 20,
        content: '',
        color: selectedTool.color,
      };
      addAnnotation(annotation);
    }
  };

  const addAnnotation = async (annotation: Annotation) => {
    try {
      await pdfEngine.current.addAnnotations(filePath, [annotation]);
      // Reload the page to show the annotation
      setPageImages(prev => {
        const newMap = new Map(prev);
        newMap.delete(annotation.pageNumber);
        return newMap;
      });
      await loadPage(annotation.pageNumber);
    } catch (err) {
      Alert.alert('Error', 'Failed to add annotation');
    }
  };

  const confirmTextAnnotation = () => {
    if (pendingAnnotation && annotationText.trim()) {
      const annotation: Annotation = {
        ...pendingAnnotation,
        content: annotationText.trim(),
      } as Annotation;
      
      addAnnotation(annotation);
      setAnnotationText('');
      setPendingAnnotation(null);
      setShowAnnotationModal(false);
    }
  };

  // Toolbar actions
  const toggleEditingMode = () => {
    setEditingMode(!editingMode);
    setShowToolbar(true);
  };

  const selectAnnotationTool = (tool: AnnotationTool) => {
    setSelectedTool(tool);
  };

  // Action menu handlers
  const handleActionMenuOpen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowActionMenu(true);
  };

  const handleDownload = async () => {
    try {
      setShowActionMenu(false);
      
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to save files to your device.');
        return;
      }

      // Show loading
      Alert.alert('Downloading', 'Saving PDF to your device...');
      
      // Save to media library
      const asset = await MediaLibrary.createAssetAsync(document.filePath);
      await MediaLibrary.createAlbumAsync('PDFs', asset, false);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'PDF has been downloaded to your device!');
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download the PDF. Please try again.');
    }
  };

  const handleShare = async () => {
    try {
      setShowActionMenu(false);
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device.');
        return;
      }

      await Sharing.shareAsync(document.filePath, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share PDF',
        UTI: 'com.adobe.pdf',
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share the PDF. Please try again.');
    }
  };

  const handleRename = () => {
    setShowActionMenu(false);
    setShowRenameModal(true);
  };

  const confirmRename = async () => {
    if (!newFileName.trim()) {
      Alert.alert('Error', 'Please enter a valid file name.');
      return;
    }

    try {
      const documentLibrary = new DocumentLibrary();
      const newFullName = `${newFileName.trim()}.pdf`;
      const directory = document.filePath.substring(0, document.filePath.lastIndexOf('/') + 1);
      const newPath = `${directory}${newFullName}`;

      // Rename file
      await FileSystem.moveAsync({
        from: document.filePath,
        to: newPath
      });

      // Update DocumentLibrary
      await documentLibrary.updateDocument(document.id, {
        fileName: newFullName,
        filePath: newPath,
        modifiedAt: new Date()
      });

      setShowRenameModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'File renamed successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Rename error:', error);
      Alert.alert('Error', 'Failed to rename the file. Please try again.');
    }
  };

  const handleDelete = () => {
    setShowActionMenu(false);
    
    Alert.alert(
      'Delete PDF',
      `Are you sure you want to delete "${document.fileName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const documentLibrary = new DocumentLibrary();
              
              // Delete file from filesystem
              await FileSystem.deleteAsync(document.filePath);
              
              // Remove from DocumentLibrary
              await documentLibrary.removeDocument(document.id);
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'PDF deleted successfully.', [
                { text: 'OK', onPress: () => router.push('/') }
              ]);
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete the PDF. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Render page component
  const renderPage = (pageNumber: number) => {
    const imageData = pageImages.get(pageNumber);
    const isSelected = selectedPages.has(pageNumber);
    const isCurrent = pageNumber === currentPage;

    return (
      <TouchableOpacity
        key={pageNumber}
        style={[
          styles.pageContainer,
          isSelected && styles.selectedPage,
          isCurrent && styles.currentPage,
        ]}
        onPress={(event) => handlePageTap(pageNumber, event)}
        onLongPress={() => selectionMode && togglePageSelection(pageNumber)}
        activeOpacity={0.8}
      >
        {imageData ? (
          <Animated.Image
            source={{ uri: imageData.uri }}
            style={[
              styles.pageImage,
              {
                width: imageData.width * scale,
                height: imageData.height * scale,
                transform: [
                  { translateX },
                  { translateY },
                ],
              },
            ]}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.loadingPage}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading page {pageNumber}...</Text>
          </View>
        )}
        
        {selectionMode && (
          <View style={styles.pageOverlay}>
            <View style={[styles.selectionIndicator, isSelected && styles.selectedIndicator]}>
              {isSelected && <Ionicons name="checkmark" size={20} color="white" />}
            </View>
          </View>
        )}
        
        <Text style={styles.pageNumber}>{pageNumber}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading PDF...</Text>
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
          <TouchableOpacity style={styles.retryButton} onPress={loadPDF}>
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
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        
        {/* Top Toolbar */}
        {showToolbar && (
          <Animated.View style={styles.topToolbar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.toolbarButton}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            
            <Text style={styles.toolbarTitle}>
              {document.fileName}
            </Text>
            
            <View style={styles.toolbarActions}>
              <TouchableOpacity 
                onPress={() => router.push(`/split/${document.id}`)} 
                style={styles.toolbarButton}
              >
                <Ionicons name="cut" size={24} color="white" />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={toggleEditingMode} style={styles.toolbarButton}>
                <Ionicons 
                  name={editingMode ? "close" : "create"} 
                  size={24} 
                  color={editingMode ? "#FF3B30" : "white"} 
                />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={handleActionMenuOpen} style={styles.toolbarButton}>
                <Ionicons name="checkmark-circle" size={28} color="#4CD964" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Editing Toolbar */}
        {editingMode && (
          <View style={styles.editingToolbar}>
            <TouchableOpacity
              style={[
                styles.toolButton,
                selectedTool.type === 'text' && styles.selectedToolButton,
              ]}
              onPress={() => selectAnnotationTool({ type: 'text', color: '#000000' })}
            >
              <Ionicons name="text" size={20} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.toolButton,
                selectedTool.type === 'highlight' && styles.selectedToolButton,
              ]}
              onPress={() => selectAnnotationTool({ type: 'highlight', color: '#FFFF00' })}
            >
              <Ionicons name="color-fill" size={20} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.toolButton,
                selectedTool.type === 'drawing' && styles.selectedToolButton,
              ]}
              onPress={() => selectAnnotationTool({ type: 'drawing', color: '#FF0000' })}
            >
              <Ionicons name="brush" size={20} color="white" />
            </TouchableOpacity>
          </View>
        )}

        {/* PDF Content */}
        <PinchGestureHandler
          onGestureEvent={onPinchGestureEvent}
          onHandlerStateChange={onPinchHandlerStateChange}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            maximumZoomScale={3}
            minimumZoomScale={0.5}
            onScroll={() => setShowToolbar(true)}
            scrollEventThrottle={16}
          >
            {Array.from({ length: totalPages }, (_, index) => renderPage(index + 1))}
          </ScrollView>
        </PinchGestureHandler>

        {/* Bottom Navigation */}
        {showToolbar && (
          <Animated.View style={styles.bottomToolbar}>
            <TouchableOpacity
              onPress={previousPage}
              disabled={currentPage <= 1}
              style={[styles.navButton, currentPage <= 1 && styles.disabledButton]}
            >
              <Ionicons name="chevron-up" size={24} color={currentPage <= 1 ? "#999" : "white"} />
            </TouchableOpacity>
            
            <Text style={styles.pageIndicator}>
              Page {currentPage} of {totalPages}
            </Text>
            
            <TouchableOpacity
              onPress={nextPage}
              disabled={currentPage >= totalPages}
              style={[styles.navButton, currentPage >= totalPages && styles.disabledButton]}
            >
              <Ionicons name="chevron-down" size={24} color={currentPage >= totalPages ? "#999" : "white"} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Selection Mode Actions */}
        {selectionMode && selectedPages.size > 0 && (
          <View style={styles.selectionActions}>
            <Text style={styles.selectionCount}>
              {selectedPages.size} page{selectedPages.size !== 1 ? 's' : ''} selected
            </Text>
            <TouchableOpacity style={styles.confirmButton} onPress={confirmPageSelection}>
              <Text style={styles.confirmButtonText}>Confirm Selection</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Text Annotation Modal */}
        <Modal
          visible={showAnnotationModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAnnotationModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.annotationModal}>
              <Text style={styles.modalTitle}>Add Text Annotation</Text>
              <TextInput
                style={styles.textInput}
                value={annotationText}
                onChangeText={setAnnotationText}
                placeholder="Enter annotation text..."
                multiline
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setShowAnnotationModal(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.primaryButton]}
                  onPress={confirmTextAnnotation}
                >
                  <Text style={[styles.modalButtonText, styles.primaryButtonText]}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Action Menu Modal */}
        <Modal
          visible={showActionMenu}
          transparent
          animationType="slide"
          onRequestClose={() => setShowActionMenu(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1}
            onPress={() => setShowActionMenu(false)}
          >
            <View style={styles.actionMenu}>
              <Text style={styles.actionMenuTitle}>What would you like to do?</Text>
              
              <TouchableOpacity style={styles.actionMenuItem} onPress={handleDownload}>
                <Ionicons name="download-outline" size={24} color="#007AFF" />
                <Text style={styles.actionMenuText}>Download to Device</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionMenuItem} onPress={handleShare}>
                <Ionicons name="share-outline" size={24} color="#007AFF" />
                <Text style={styles.actionMenuText}>Share PDF</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionMenuItem} onPress={handleRename}>
                <Ionicons name="create-outline" size={24} color="#007AFF" />
                <Text style={styles.actionMenuText}>Rename File</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionMenuItem} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                <Text style={[styles.actionMenuText, { color: '#FF3B30' }]}>Delete PDF</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionMenuItem, styles.cancelMenuItem]} 
                onPress={() => setShowActionMenu(false)}
              >
                <Text style={styles.cancelMenuText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Rename Modal */}
        <Modal
          visible={showRenameModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRenameModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.annotationModal}>
              <Text style={styles.modalTitle}>Rename File</Text>
              <TextInput
                style={styles.textInput}
                value={newFileName}
                onChangeText={setNewFileName}
                placeholder="Enter new file name..."
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setShowRenameModal(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.primaryButton]}
                  onPress={confirmRename}
                >
                  <Text style={[styles.modalButtonText, styles.primaryButtonText]}>Rename</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
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
    backgroundColor: '#f5f5f5',
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
  topToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  toolbarButton: {
    padding: 8,
  },
  toolbarTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editingToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  toolButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  selectedToolButton: {
    backgroundColor: '#007AFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  pageContainer: {
    marginVertical: 10,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    backgroundColor: 'white',
    position: 'relative',
  },
  selectedPage: {
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  currentPage: {
    borderWidth: 2,
    borderColor: '#34C759',
  },
  pageImage: {
    maxWidth: screenWidth - 40,
  },
  loadingPage: {
    width: screenWidth - 40,
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  pageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  selectionIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  selectedIndicator: {
    backgroundColor: '#007AFF',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  bottomToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  navButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  pageIndicator: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  selectionActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1001,
  },
  selectionCount: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  annotationModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: screenWidth - 40,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 8,
    backgroundColor: '#f0f0f0',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  modalButtonText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  primaryButtonText: {
    color: 'white',
  },
  actionMenu: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  actionMenuTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 12,
  },
  actionMenuText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 16,
    color: '#007AFF',
  },
  cancelMenuItem: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    marginTop: 8,
  },
  cancelMenuText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    flex: 1,
  },
});