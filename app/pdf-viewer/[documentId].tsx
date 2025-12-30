import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PDFViewerScreen } from '@/src/components/screens';
import { DocumentLibrary } from '@/src/modules/document-library';
import { DocumentMetadata } from '@/src/types';

export default function PDFViewerRoute() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const router = useRouter();
  const [document, setDocument] = useState<DocumentMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const documentLibrary = new DocumentLibrary();

  useEffect(() => {
    const loadDocument = async () => {
      try {
        // Validate documentId parameter
        if (!documentId || typeof documentId !== 'string') {
          setError('Invalid document ID');
          return;
        }

        // Load document from library
        const documents = await documentLibrary.getDocuments();
        const foundDocument = documents.find(doc => doc.id === documentId);

        if (!foundDocument) {
          setError('Document not found');
          return;
        }

        setDocument(foundDocument);
      } catch (err) {
        console.error('Error loading document:', err);
        setError('Failed to load document');
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [documentId]);

  // Navigation guard - redirect if error
  useEffect(() => {
    if (error && !loading) {
      Alert.alert(
        'Error',
        error,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    }
  }, [error, loading, router]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading document...</Text>
      </View>
    );
  }

  if (error || !document) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Document not found'}</Text>
      </View>
    );
  }

  return <PDFViewerScreen document={document} />;
}

const styles = StyleSheet.create({
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
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    color: '#FF3B30',
    textAlign: 'center',
  },
});