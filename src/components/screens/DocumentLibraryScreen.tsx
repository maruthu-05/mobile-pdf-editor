import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { DocumentPickerUtils } from '../../utils/DocumentPickerUtils';
import { DebugUtils } from '../../utils/DebugUtils';
import { DocumentLibrary } from '../../modules/document-library';
import { DocumentMetadata } from '../../types';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - 60) / 2; // 2 columns with padding

// Simple document metadata interface
interface SimpleDocumentMetadata {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  pageCount: number;
  createdAt: Date;
  modifiedAt: Date;
}

interface DocumentItemProps {
  document: SimpleDocumentMetadata;
  onPress: (document: SimpleDocumentMetadata) => void;
  onLongPress: (document: SimpleDocumentMetadata) => void;
}

const DocumentItem: React.FC<DocumentItemProps> = ({ document, onPress, onLongPress }) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString();
  };

  return (
    <TouchableOpacity
      style={styles.documentItem}
      onPress={() => onPress(document)}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onLongPress(document);
      }}
    >
      <View style={styles.documentThumbnail}>
        <Ionicons name="document-text" size={40} color="#007AFF" />
      </View>
      <Text style={styles.documentTitle} numberOfLines={2}>
        {document.fileName}
      </Text>
      <Text style={styles.documentInfo}>
        {document.pageCount} pages
      </Text>
      <Text style={styles.documentInfo}>
        {formatFileSize(document.fileSize)}
      </Text>
      <Text style={styles.documentDate}>
        {formatDate(document.modifiedAt)}
      </Text>
    </TouchableOpacity>
  );
};

export const DocumentLibraryScreen: React.FC = () => {
  const router = useRouter();
  const [documents, setDocuments] = useState<SimpleDocumentMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredDocuments, setFilteredDocuments] = useState<SimpleDocumentMetadata[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<SimpleDocumentMetadata | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Create DocumentLibrary instance
  const documentLibrary = new DocumentLibrary();

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      // Load documents from DocumentLibrary
      const loadedDocs = await documentLibrary.getDocuments();
      
      // Convert DocumentMetadata to SimpleDocumentMetadata format
      const simpleDocs: SimpleDocumentMetadata[] = loadedDocs.map(doc => ({
        id: doc.id,
        fileName: doc.fileName,
        filePath: doc.filePath,
        fileSize: doc.fileSize,
        pageCount: doc.pageCount,
        createdAt: doc.createdAt,
        modifiedAt: doc.modifiedAt,
      }));
      
      setDocuments(simpleDocs);
      setFilteredDocuments(simpleDocs);
    } catch (error) {
      console.error('Error loading documents:', error);
      Alert.alert('Error', 'Failed to load documents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredDocuments(documents);
    } else {
      const filtered = documents.filter(doc =>
        doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredDocuments(filtered);
    }
  }, [searchQuery, documents]);

  const handleUpload = async () => {
    try {
      // Show loading state immediately
      setLoading(true);
      
      console.log('Starting document picker...');

      // Check if document picker is available
      if (!DocumentPickerUtils.isAvailable()) {
        DocumentPickerUtils.showErrorAlert('File picker is not available on this platform.');
        return;
      }

      // Use the enhanced document picker utility
      const result = await DocumentPickerUtils.pickPDFDocument();
      
      console.log('Document picker result:', result);

      if (!result.success) {
        if (result.error && !result.error.includes('canceled')) {
          DocumentPickerUtils.showErrorAlert(result.error);
        }
        return;
      }

      // Validate that we have a valid result
      if (!result.uri) {
        Alert.alert('Error', 'Invalid file selected. Please try again.');
        return;
      }

      console.log('Selected file:', {
        name: result.name,
        uri: result.uri,
        size: result.size,
        mimeType: result.mimeType
      });

      // Get documents directory - use cacheDirectory as fallback
      let documentsDir = FileSystem.documentDirectory;
      if (!documentsDir) {
        console.warn('documentDirectory not available, using cacheDirectory');
        documentsDir = FileSystem.cacheDirectory;
      }
      
      if (!documentsDir) {
        throw new Error('No writable directory available');
      }

      // Create a unique filename to avoid conflicts
      const timestamp = Date.now();
      const fileName = result.name || `document_${timestamp}.pdf`;
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueFileName = `${timestamp}_${sanitizedFileName}`;
      const filePath = `${documentsDir}${uniqueFileName}`;
      
      console.log('Target file path:', filePath);

      try {
        // First, check if the source file exists and is readable
        const sourceInfo = await FileSystem.getInfoAsync(result.uri);
        console.log('Source file info:', sourceInfo);
        
        if (!sourceInfo.exists) {
          throw new Error('Selected file is not accessible');
        }

        // Copy file to documents directory
        console.log('Copying file from', result.uri, 'to', filePath);
        await FileSystem.copyAsync({
          from: result.uri,
          to: filePath
        });

        // Verify the copy was successful
        const copiedFileInfo = await FileSystem.getInfoAsync(filePath);
        console.log('Copied file info:', copiedFileInfo);
        
        if (!copiedFileInfo.exists) {
          throw new Error('Failed to copy file to app storage');
        }

        // Get file size (try multiple approaches for compatibility)
        let fileSize = 0;
        if (result.size) {
          fileSize = result.size;
        } else if (copiedFileInfo.size) {
          fileSize = copiedFileInfo.size;
        } else {
          // Fallback: read file to get size
          try {
            const fileContent = await FileSystem.readAsStringAsync(filePath, {
              encoding: 'base64' as any, // Use string literal for Expo Go compatibility
            });
            fileSize = Math.round((fileContent.length * 3) / 4); // Approximate size from base64
          } catch {
            fileSize = 0; // Default if we can't determine size
          }
        }
        
        console.log('Final file size:', fileSize);
        
        // Create document metadata with all required fields
        const metadata: DocumentMetadata = {
          id: `doc_${timestamp}`,
          fileName: uniqueFileName,
          filePath: filePath,
          fileSize: fileSize,
          pageCount: 1, // Default to 1 page for now - this could be enhanced with PDF parsing
          createdAt: new Date(),
          modifiedAt: new Date(),
          tags: [],
          category: 'uncategorized',
        };

        console.log('Created metadata:', metadata);

        // Save to DocumentLibrary (persistent storage)
        await documentLibrary.addDocument(filePath, metadata);
        
        // Reload documents from storage
        await loadDocuments();

        // Provide haptic feedback and success message
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', `Document "${fileName}" has been imported successfully!`);
        
      } catch (copyError) {
        console.error('Error copying file:', copyError);
        
        // Clean up any partial file
        try {
          await FileSystem.deleteAsync(filePath, { idempotent: true });
        } catch {
          // Ignore cleanup errors
        }
        
        Alert.alert(
          'Import Error', 
          'Failed to import the document. Please ensure the file is not corrupted and try again.'
        );
      }
    } catch (error) {
      console.error('Error in document upload:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentPress = (document: SimpleDocumentMetadata) => {
    // Navigate to PDF viewer with document ID
    router.push(`/pdf-viewer/${document.id}`);
  };

  const handleDocumentLongPress = (document: SimpleDocumentMetadata) => {
    setSelectedDocument(document);
    setShowContextMenu(true);
  };

  const handleRename = () => {
    if (selectedDocument) {
      setNewFileName(selectedDocument.fileName.replace('.pdf', ''));
      setShowRenameModal(true);
      setShowContextMenu(false);
    }
  };

  const confirmRename = async () => {
    if (!selectedDocument || !newFileName.trim()) return;

    try {
      const newFullName = `${newFileName.trim()}.pdf`;
      const directory = selectedDocument.filePath.substring(0, selectedDocument.filePath.lastIndexOf('/') + 1);
      const newPath = `${directory}${newFullName}`;

      // Rename file
      await FileSystem.moveAsync({
        from: selectedDocument.filePath,
        to: newPath
      });

      // Update DocumentLibrary with new file path and name
      await documentLibrary.updateDocument(selectedDocument.id, {
        fileName: newFullName,
        filePath: newPath,
        modifiedAt: new Date()
      });
      
      // Reload documents from storage
      await loadDocuments();

      setShowRenameModal(false);
      setNewFileName('');
      setSelectedDocument(null);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error renaming document:', error);
      Alert.alert('Error', 'Failed to rename document');
    }
  };

  const handleDelete = () => {
    if (!selectedDocument) return;

    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete "${selectedDocument.fileName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete file from filesystem
              await FileSystem.deleteAsync(selectedDocument.filePath);
              
              // Remove from DocumentLibrary
              await documentLibrary.removeDocument(selectedDocument.id);
              
              // Reload documents from storage
              await loadDocuments();
              
              setShowContextMenu(false);
              setSelectedDocument(null);

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error('Error deleting document:', error);
              Alert.alert('Error', 'Failed to delete document');
            }
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    if (!selectedDocument) return;

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(selectedDocument.filePath);
        setShowContextMenu(false);
        setSelectedDocument(null);
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error sharing document:', error);
      Alert.alert('Error', 'Failed to share document');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDocuments();
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'grid' ? 'list' : 'grid');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderDocument = ({ item }: { item: SimpleDocumentMetadata }) => {
    if (viewMode === 'list') {
      return (
        <TouchableOpacity
          style={styles.listItem}
          onPress={() => handleDocumentPress(item)}
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            handleDocumentLongPress(item);
          }}
        >
          <Ionicons name="document-text" size={24} color="#007AFF" />
          <View style={styles.listItemContent}>
            <Text style={styles.listItemTitle} numberOfLines={1}>
              {item.fileName}
            </Text>
            <Text style={styles.listItemSubtitle}>
              {item.pageCount} pages • {(item.fileSize / 1024).toFixed(1)} KB
            </Text>
          </View>
          <Text style={styles.listItemDate}>
            {item.modifiedAt.toLocaleDateString()}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <DocumentItem
        document={item}
        onPress={handleDocumentPress}
        onLongPress={handleDocumentLongPress}
      />
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading documents...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Document Library</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            onPress={() => DebugUtils.showQuickDebugInfo()} 
            onLongPress={() => router.push('/debug/document-picker')}
            style={styles.headerButton}
            testID="debug-button"
          >
            <Ionicons name="bug" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => router.push('/merge')} 
            style={styles.headerButton}
            testID="merge-button"
          >
            <Ionicons name="copy" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={toggleViewMode} 
            style={styles.headerButton}
            testID="view-toggle-button"
          >
            <Ionicons
              name={viewMode === 'grid' ? 'list' : 'grid'}
              size={24}
              color="#007AFF"
            />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleUpload} 
            style={[styles.headerButton, loading && styles.headerButtonDisabled]}
            testID="upload-button"
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Ionicons name="add" size={24} color="#007AFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search documents..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Documents</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery ? 'No documents match your search' : 'Import PDF files from your device storage'}
          </Text>
          {!searchQuery && (
            <TouchableOpacity 
              style={styles.primaryUploadButton} 
              onPress={handleUpload}
              testID="primary-upload-button"
            >
              <Ionicons name="cloud-upload-outline" size={24} color="#fff" />
              <Text style={styles.primaryUploadButtonText}>Select PDF Files</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredDocuments}
          renderItem={renderDocument}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={viewMode} // Force re-render when view mode changes
          contentContainerStyle={styles.listContainer}
          testID="documents-list"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      {/* Context Menu Modal */}
      <Modal
        visible={showContextMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContextMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowContextMenu(false)}
        >
          <View style={styles.contextMenu}>
            <TouchableOpacity style={styles.contextMenuItem} onPress={handleRename}>
              <Ionicons name="pencil" size={20} color="#007AFF" />
              <Text style={styles.contextMenuText}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextMenuItem} onPress={handleShare}>
              <Ionicons name="share" size={20} color="#007AFF" />
              <Text style={styles.contextMenuText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextMenuItem} onPress={handleDelete}>
              <Ionicons name="trash" size={20} color="#FF3B30" />
              <Text style={[styles.contextMenuText, { color: '#FF3B30' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Rename Modal */}
      <Modal
        visible={showRenameModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRenameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.renameModal}>
            <Text style={styles.renameTitle}>Rename Document</Text>
            <TextInput
              style={styles.renameInput}
              value={newFileName}
              onChangeText={setNewFileName}
              placeholder="Enter new name"
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.renameActions}>
              <TouchableOpacity
                style={[styles.renameButton, styles.cancelButton]}
                onPress={() => {
                  setShowRenameModal(false);
                  setNewFileName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.renameButton, styles.confirmButton]}
                onPress={confirmRename}
              >
                <Text style={styles.confirmButtonText}>Rename</Text>
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 16,
    padding: 8,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  documentItem: {
    width: ITEM_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginRight: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  documentThumbnail: {
    alignItems: 'center',
    marginBottom: 12,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  documentInfo: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  documentDate: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  listItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  listItemSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  listItemDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  primaryUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryUploadButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  contextMenuText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 12,
  },
  renameModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: width - 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  renameTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
    textAlign: 'center',
  },
  renameInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 24,
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  renameButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    marginLeft: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});