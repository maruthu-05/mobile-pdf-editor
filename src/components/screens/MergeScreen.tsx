import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { Button, CheckBox } from 'react-native-elements';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { DocumentLibrary } from '../../modules/document-library';
import { PDFEngine } from '../../modules/pdf-engine';
import { DocumentMetadata } from '../../types';

interface MergeScreenProps {
  onMergeComplete?: (mergedFilePath: string) => void;
}

interface SelectableDocument extends DocumentMetadata {
  selected: boolean;
  thumbnailUri?: string;
  position: number;
}

export const MergeScreen: React.FC<MergeScreenProps> = ({
  onMergeComplete,
}) => {
  const router = useRouter();
  const [documents, setDocuments] = useState<SelectableDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(0);
  const [mergeMessage, setMergeMessage] = useState('');
  const [selectedCount, setSelectedCount] = useState(0);

  const documentLibrary = new DocumentLibrary();
  const pdfEngine = new PDFEngine();

  // Set up progress callback for merge operations
  useEffect(() => {
    pdfEngine.onMergeProgress = (progress: number, message: string) => {
      setMergeProgress(progress);
      setMergeMessage(message);
    };
  }, []);

  // Load documents on component mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await documentLibrary.getDocuments('modifiedAt', 'desc');
      
      // Convert to selectable documents with thumbnails
      const selectableDocs: SelectableDocument[] = await Promise.all(
        docs.map(async (doc, index) => {
          let thumbnailUri: string | undefined;
          
          try {
            // Generate thumbnail for preview
            const thumbnail = await pdfEngine.generateThumbnail(doc.filePath, 120, 160);
            thumbnailUri = thumbnail.uri;
          } catch (error) {
            console.warn(`Failed to generate thumbnail for ${doc.fileName}:`, error);
          }

          return {
            ...doc,
            selected: false,
            thumbnailUri,
            position: index,
          };
        })
      );

      setDocuments(selectableDocs);
    } catch (error) {
      console.error('Failed to load documents:', error);
      Alert.alert('Error', 'Failed to load PDF documents');
    } finally {
      setLoading(false);
    }
  };

  const toggleDocumentSelection = useCallback((documentId: string) => {
    setDocuments(prevDocs => {
      const updatedDocs = prevDocs.map(doc => {
        if (doc.id === documentId) {
          const newSelected = !doc.selected;
          return { ...doc, selected: newSelected };
        }
        return doc;
      });

      // Update selected count
      const newSelectedCount = updatedDocs.filter(doc => doc.selected).length;
      setSelectedCount(newSelectedCount);

      // Provide haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      return updatedDocs;
    });
  }, []);

  const moveDocument = useCallback((fromIndex: number, toIndex: number) => {
    setDocuments(prevDocs => {
      const selectedDocs = prevDocs.filter(doc => doc.selected);
      if (selectedDocs.length === 0) return prevDocs;

      const newDocs = [...prevDocs];
      const [movedDoc] = newDocs.splice(fromIndex, 1);
      newDocs.splice(toIndex, 0, movedDoc);

      // Update positions
      return newDocs.map((doc, index) => ({ ...doc, position: index }));
    });

    // Provide haptic feedback for drag operation
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const moveSelectedUp = useCallback((documentId: string) => {
    setDocuments(prevDocs => {
      const currentIndex = prevDocs.findIndex(doc => doc.id === documentId);
      if (currentIndex <= 0) return prevDocs;

      const newDocs = [...prevDocs];
      const [movedDoc] = newDocs.splice(currentIndex, 1);
      newDocs.splice(currentIndex - 1, 0, movedDoc);

      return newDocs.map((doc, index) => ({ ...doc, position: index }));
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const moveSelectedDown = useCallback((documentId: string) => {
    setDocuments(prevDocs => {
      const currentIndex = prevDocs.findIndex(doc => doc.id === documentId);
      if (currentIndex >= prevDocs.length - 1) return prevDocs;

      const newDocs = [...prevDocs];
      const [movedDoc] = newDocs.splice(currentIndex, 1);
      newDocs.splice(currentIndex + 1, 0, movedDoc);

      return newDocs.map((doc, index) => ({ ...doc, position: index }));
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const clearSelection = useCallback(() => {
    setDocuments(prevDocs =>
      prevDocs.map(doc => ({ ...doc, selected: false }))
    );
    setSelectedCount(0);
  }, []);

  const selectAll = useCallback(() => {
    setDocuments(prevDocs =>
      prevDocs.map(doc => ({ ...doc, selected: true }))
    );
    setSelectedCount(documents.length);
  }, [documents.length]);

  const handleMerge = async () => {
    const selectedDocs = documents.filter(doc => doc.selected);
    
    if (selectedDocs.length < 2) {
      Alert.alert('Selection Required', 'Please select at least 2 PDF files to merge.');
      return;
    }

    // Show confirmation dialog
    Alert.alert(
      'Confirm Merge',
      `Merge ${selectedDocs.length} PDF files into a single document?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Merge', onPress: performMerge },
      ]
    );
  };

  const performMerge = async () => {
    try {
      setMerging(true);
      setMergeProgress(0);
      setMergeMessage('Preparing merge...');

      const selectedDocs = documents.filter(doc => doc.selected);
      const filePaths = selectedDocs.map(doc => doc.filePath);

      // Perform the merge operation
      const mergedFilePath = await pdfEngine.mergePDFs(filePaths);

      // Add merged document to library
      const mergedFileName = `Merged_${new Date().toISOString().slice(0, 10)}.pdf`;
      const mergedMetadata: DocumentMetadata = {
        id: `merged_${Date.now()}`,
        fileName: mergedFileName,
        filePath: mergedFilePath,
        fileSize: 0, // Will be updated by file system
        pageCount: selectedDocs.reduce((sum, doc) => sum + doc.pageCount, 0),
        createdAt: new Date(),
        modifiedAt: new Date(),
      };

      await documentLibrary.addDocument(mergedFilePath, mergedMetadata);

      // Show success message
      Alert.alert(
        'Merge Complete',
        `Successfully merged ${selectedDocs.length} PDF files into "${mergedFileName}".`,
        [
          {
            text: 'OK',
            onPress: () => {
              onMergeComplete?.(mergedFilePath);
              router.back();
            },
          },
        ]
      );

      // Provide success haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (error) {
      console.error('Merge failed:', error);
      Alert.alert(
        'Merge Failed',
        error instanceof Error ? error.message : 'An unknown error occurred during merge.'
      );

      // Provide error haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setMerging(false);
      setMergeProgress(0);
      setMergeMessage('');
    }
  };

  const renderDocumentItem = ({ item, index }: { item: SelectableDocument; index: number }) => {
    const isSelected = item.selected;
    
    return (
      <TouchableOpacity
        style={[styles.documentItem, isSelected && styles.selectedItem]}
        onPress={() => toggleDocumentSelection(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.documentContent}>
          {/* Thumbnail */}
          <View style={styles.thumbnailContainer}>
            {item.thumbnailUri ? (
              <Image source={{ uri: item.thumbnailUri }} style={styles.thumbnail} />
            ) : (
              <View style={[styles.thumbnail, styles.placeholderThumbnail]}>
                <Ionicons name="document-text" size={32} color="#666" />
              </View>
            )}
          </View>

          {/* Document Info */}
          <View style={styles.documentInfo}>
            <Text style={styles.fileName} numberOfLines={2}>
              {item.fileName}
            </Text>
            <Text style={styles.fileDetails}>
              {item.pageCount} pages • {(item.fileSize / 1024 / 1024).toFixed(1)} MB
            </Text>
            <Text style={styles.fileDate}>
              Modified: {item.modifiedAt.toLocaleDateString()}
            </Text>
          </View>

          {/* Selection Checkbox */}
          <View style={styles.selectionContainer}>
            <CheckBox
              checked={isSelected}
              onPress={() => toggleDocumentSelection(item.id)}
              containerStyle={styles.checkbox}
            />
          </View>

          {/* Reorder Controls (only show for selected items) */}
          {isSelected && (
            <View style={styles.reorderControls}>
              <TouchableOpacity
                style={styles.reorderButton}
                onPress={() => moveSelectedUp(item.id)}
                disabled={index === 0}
              >
                <Ionicons
                  name="chevron-up"
                  size={20}
                  color={index === 0 ? '#ccc' : '#007AFF'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reorderButton}
                onPress={() => moveSelectedDown(item.id)}
                disabled={index === documents.length - 1}
              >
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={index === documents.length - 1 ? '#ccc' : '#007AFF'}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Selection Order Badge */}
        {isSelected && (
          <View style={styles.orderBadge}>
            <Text style={styles.orderText}>
              {documents.filter((doc, i) => doc.selected && i <= index).length}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading PDF documents...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Merge PDFs</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Selection Controls */}
      <View style={styles.selectionControls}>
        <Text style={styles.selectionText}>
          {selectedCount} of {documents.length} selected
        </Text>
        <View style={styles.selectionButtons}>
          <Button
            title="Select All"
            type="clear"
            titleStyle={styles.controlButtonText}
            onPress={selectAll}
            disabled={selectedCount === documents.length}
          />
          <Button
            title="Clear"
            type="clear"
            titleStyle={styles.controlButtonText}
            onPress={clearSelection}
            disabled={selectedCount === 0}
          />
        </View>
      </View>

      {/* Document List */}
      {documents.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No PDF documents found</Text>
          <Text style={styles.emptySubtext}>
            Upload some PDF files to start merging
          </Text>
        </View>
      ) : (
        <FlatList
          data={documents}
          renderItem={renderDocumentItem}
          keyExtractor={item => item.id}
          style={styles.documentList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Merge Progress */}
      {merging && (
        <View style={styles.progressContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.progressText}>{mergeMessage}</Text>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${mergeProgress}%` }]}
            />
          </View>
        </View>
      )}

      {/* Merge Button */}
      <View style={styles.mergeButtonContainer}>
        <Button
          title={`Merge ${selectedCount} PDFs`}
          buttonStyle={[
            styles.mergeButton,
            selectedCount < 2 && styles.disabledButton,
          ]}
          titleStyle={styles.mergeButtonText}
          onPress={handleMerge}
          disabled={selectedCount < 2 || merging}
          loading={merging}
        />
      </View>
    </View>
  );
};

const { width: screenWidth } = Dimensions.get('window');

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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    color: '#333',
  },
  headerSpacer: {
    width: 40, // Same width as back button for centering
  },
  selectionControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  selectionButtons: {
    flexDirection: 'row',
  },
  controlButtonText: {
    fontSize: 14,
    color: '#007AFF',
  },
  documentList: {
    flex: 1,
  },
  documentItem: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedItem: {
    borderColor: '#007AFF',
    borderWidth: 2,
    backgroundColor: '#f0f8ff',
  },
  documentContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailContainer: {
    marginRight: 12,
  },
  thumbnail: {
    width: 60,
    height: 80,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  placeholderThumbnail: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  documentInfo: {
    flex: 1,
    marginRight: 8,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  fileDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  fileDate: {
    fontSize: 12,
    color: '#999',
  },
  selectionContainer: {
    marginRight: 8,
  },
  checkbox: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    margin: 0,
  },
  reorderControls: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  reorderButton: {
    padding: 4,
    marginVertical: 2,
  },
  orderBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  progressContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#333',
  },
  progressBar: {
    width: 100,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginLeft: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  mergeButtonContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  mergeButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 16,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  mergeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});