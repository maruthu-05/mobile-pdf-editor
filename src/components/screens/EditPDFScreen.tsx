import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { DocumentPickerUtils } from '../../utils/DocumentPickerUtils';
import { DocumentLibrary } from '../../modules/document-library';
import { DocumentMetadata } from '../../types';

export const EditPDFScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const documentLibrary = DocumentLibrary.getInstance();

  useEffect(() => {
    pickAndOpenPDF();
  }, []);

  const pickAndOpenPDF = async () => {
    try {
      console.log('Starting document picker for edit...');

      // Check if document picker is available
      if (!DocumentPickerUtils.isAvailable()) {
        DocumentPickerUtils.showErrorAlert('File picker is not available on this platform.');
        router.back();
        return;
      }

      // Use the enhanced document picker utility
      const result = await DocumentPickerUtils.pickPDFDocument();
      
      console.log('Document picker result:', result);

      if (!result.success) {
        if (result.error && !result.error.includes('canceled')) {
          DocumentPickerUtils.showErrorAlert(result.error);
        }
        router.back();
        return;
      }

      // Validate that we have a valid result
      if (!result.uri) {
        Alert.alert('Error', 'Invalid file selected. Please try again.');
        router.back();
        return;
      }

      console.log('Selected file:', {
        name: result.name,
        uri: result.uri,
        size: result.size,
        mimeType: result.mimeType
      });

      // Get documents directory
      let documentsDir = FileSystem.documentDirectory;
      if (!documentsDir) {
        console.warn('documentDirectory not available, using cacheDirectory');
        documentsDir = FileSystem.cacheDirectory;
      }
      
      if (!documentsDir) {
        throw new Error('No writable directory available');
      }

      // Create a unique filename
      const timestamp = Date.now();
      const fileName = result.name || `document_${timestamp}.pdf`;
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueFileName = `${timestamp}_${sanitizedFileName}`;
      const filePath = `${documentsDir}${uniqueFileName}`;
      
      console.log('Target file path:', filePath);

      // Check if source file exists
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

      // Get file size
      let fileSize = 0;
      if (result.size) {
        fileSize = result.size;
      } else if (copiedFileInfo.size) {
        fileSize = copiedFileInfo.size;
      }
      
      console.log('Final file size:', fileSize);
      
      // Create document metadata
      const documentId = `doc_${timestamp}`;
      const metadata: DocumentMetadata = {
        id: documentId,
        fileName: uniqueFileName,
        filePath: filePath,
        fileSize: fileSize,
        pageCount: 1,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };

      console.log('Created metadata:', metadata);

      // Save to DocumentLibrary
      await documentLibrary.addDocument(filePath, metadata);
      
      // Provide haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to PDF viewer with the document ID
      router.replace(`/pdf-viewer/${documentId}`);
      
    } catch (error) {
      console.error('Error in document selection:', error);
      Alert.alert('Error', 'Failed to open the document. Please try again.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.loadingText}>Opening file picker...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
});
