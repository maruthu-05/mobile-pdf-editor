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
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { DocumentMetadata } from '../../types';
import { DocumentLibrary } from '../../modules/document-library';
import { FileManager } from '../../modules/file-manager';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - 60) / 2; // 2 columns with padding

interface DocumentItemProps {
  document: DocumentMetadata;
  onPress: (document: DocumentMetadata) => void;
  onLongPress: (document: DocumentMetadata) => void;
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
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentMetadata[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentMetadata | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const documentLibrary = new DocumentLibrary();
  const fileManager = new FileManager();

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await documentLibrary.getDocuments('modifiedAt', 'desc');
      setDocuments(docs);
      setFilteredDocuments(docs);
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
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setLoading(true);

        // Copy file to app documents directory
        const documentsDir = await fileManager.getDocumentsDirectory();
        const fileName = asset.name || `document_${Date.now()}.pdf`;
        const filePath = `${documentsDir}/${fileName}`;

        // Read file and save to documents directory
        const fileData = await fileManager.readFileAsBuffer(asset.uri);
        const savedPath = await fileManager.saveFile(fileData, fileName);

        // Get file info
        const fileInfo = await fileManager.getFileInfo(savedPath);

        // Create document metadata
        const metadata: DocumentMetadata = {
          id: `doc_${Date.now()}`,
          fileName: fileName,
          filePath: savedPath,
          fileSize: fileInfo.fileSize,
          pageCount: 1, // TODO: Get actual page count from PDF
          createdAt: new Date(),
          modifiedAt: new Date(),
        };

        // Add to document library
        await documentLibrary.addDocument(savedPath, metadata);

        // Refresh documents list
        await loadDocuments();

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Document uploaded successfully');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      Alert.alert('Error', 'Failed to upload document');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentPress = (document: DocumentMetadata) => {
    // Navigate to PDF viewer with document ID
    router.push(`/pdf-viewer/${document.id}`);
  };

  const handleDocumentLongPress = (document: DocumentMetadata) => {
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
      const newPath = await fileManager.renameFile(selectedDocument.filePath, newFullName);

      await documentLibrary.updateDocument(selectedDocument.id, {
        fileName: newFullName,
        filePath: newPath,
        modifiedAt: new Date(),
      });

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
              await fileManager.deleteFile(selectedDocument.filePath);
              await documentLibrary.removeDocument(selectedDocument.id);
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

  const renderDocument = ({ item }: { item: DocumentMetadata }) => {
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
            style={styles.headerButton}
            testID="upload-button"
          >
            <Ionicons name="add" size={24} color="#007AFF" />
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
            {searchQuery ? 'No documents match your search' : 'Tap + to upload your first PDF'}
          </Text>
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