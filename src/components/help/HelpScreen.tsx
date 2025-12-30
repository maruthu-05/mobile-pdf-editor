import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface FAQItem {
  id: number;
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    id: 1,
    question: 'How do I upload a PDF file?',
    answer: 'Tap the "+" button on the main screen and select "Upload PDF" to choose a file from your device.',
  },
  {
    id: 2,
    question: 'Can I merge multiple PDF files?',
    answer: 'Yes! Select multiple PDFs from your library, tap the merge button, and arrange them in your desired order.',
  },
  {
    id: 3,
    question: 'How do I split a PDF?',
    answer: 'Open a PDF, tap the split button, select the pages you want to extract, and create a new document.',
  },
  {
    id: 4,
    question: 'Does the app work offline?',
    answer: 'Yes! All features work without an internet connection. Your documents are stored locally on your device.',
  },
  {
    id: 5,
    question: 'How do I edit text in a PDF?',
    answer: 'Open a PDF, tap the edit button, then tap on the text you want to modify. Note: Only editable text can be changed.',
  },
  {
    id: 6,
    question: 'Can I add annotations?',
    answer: 'Yes! Use the annotation tools to add text notes, highlights, and drawings to your PDFs.',
  },
  {
    id: 7,
    question: 'How do I share a PDF?',
    answer: 'Long press on any PDF in your library and select "Share" to send it via email, messaging, or other apps.',
  },
  {
    id: 8,
    question: 'What if I run out of storage space?',
    answer: 'The app monitors storage and will warn you when space is low. Use the cleanup tools in Settings to free up space.',
  },
];

const FeatureGuide = () => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Key Features</Text>
    
    <View style={styles.featureItem}>
      <Ionicons name="document-text" size={24} color="#007AFF" />
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>PDF Management</Text>
        <Text style={styles.featureDescription}>Upload, organize, and manage your PDF documents</Text>
      </View>
    </View>

    <View style={styles.featureItem}>
      <Ionicons name="git-merge" size={24} color="#007AFF" />
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>Merge & Split</Text>
        <Text style={styles.featureDescription}>Combine multiple PDFs or extract specific pages</Text>
      </View>
    </View>

    <View style={styles.featureItem}>
      <Ionicons name="create" size={24} color="#007AFF" />
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>Edit & Annotate</Text>
        <Text style={styles.featureDescription}>Add text, highlights, and annotations to your documents</Text>
      </View>
    </View>

    <View style={styles.featureItem}>
      <Ionicons name="cloud-offline" size={24} color="#007AFF" />
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>Offline Support</Text>
        <Text style={styles.featureDescription}>All features work without internet connection</Text>
      </View>
    </View>
  </View>
);

export const HelpScreen: React.FC = () => {
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const toggleFAQ = (id: number) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const openSupport = () => {
    Linking.openURL('mailto:support@mobilepdfeditor.com?subject=PDF Editor Support');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Help & Support</Text>
          <Text style={styles.subtitle}>Get help with using PDF Editor</Text>
        </View>

        <FeatureGuide />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          
          {faqData.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.faqItem}
              onPress={() => toggleFAQ(item.id)}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQuestion}>{item.question}</Text>
                <Ionicons
                  name={expandedFAQ === item.id ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#666666"
                />
              </View>
              {expandedFAQ === item.id && (
                <Text style={styles.faqAnswer}>{item.answer}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Need More Help?</Text>
          
          <TouchableOpacity style={styles.supportButton} onPress={openSupport}>
            <Ionicons name="mail" size={24} color="#007AFF" />
            <View style={styles.supportText}>
              <Text style={styles.supportTitle}>Contact Support</Text>
              <Text style={styles.supportDescription}>Get help from our support team</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666666" />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>PDF Editor v1.0.0</Text>
          <Text style={styles.footerText}>© 2024 Mobile PDF Editor</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
  section: {
    backgroundColor: '#ffffff',
    marginTop: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  featureText: {
    flex: 1,
    marginLeft: 16,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666666',
  },
  faqItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    flex: 1,
    marginRight: 16,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666666',
    marginTop: 12,
    lineHeight: 20,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  supportText: {
    flex: 1,
    marginLeft: 16,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 4,
  },
  supportDescription: {
    fontSize: 14,
    color: '#666666',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 4,
  },
});