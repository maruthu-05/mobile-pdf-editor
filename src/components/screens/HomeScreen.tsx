import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export const HomeScreen: React.FC = () => {
  const router = useRouter();

  const handleEditPDF = () => {
    // Navigate to edit screen which will show file picker
    router.push('/edit-pdf' as any);
  };

  const handleMergePDFs = () => {
    // Navigate to merge screen
    router.push('/merge');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="document-text" size={60} color="#fff" />
        <Text style={styles.title}>PDF Editor</Text>
        <Text style={styles.subtitle}>What would you like to do?</Text>
      </View>

      {/* Main Options */}
      <View style={styles.optionsContainer}>
        {/* Edit PDF Option */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={handleEditPDF}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="create-outline" size={50} color="#007AFF" />
          </View>
          <Text style={styles.optionTitle}>Edit PDF</Text>
          <Text style={styles.optionDescription}>
            Select a PDF file to edit, annotate, or modify
          </Text>
        </TouchableOpacity>

        {/* Merge PDFs Option */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={handleMergePDFs}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="copy-outline" size={50} color="#34C759" />
          </View>
          <Text style={styles.optionTitle}>Merge PDFs</Text>
          <Text style={styles.optionDescription}>
            Combine multiple PDF files into one document
          </Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Simple, fast, and secure PDF editing
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#007AFF',
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#E5F0FF',
    marginTop: 8,
  },
  optionsContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  optionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  optionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
});
