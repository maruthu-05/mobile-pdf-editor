import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { DocumentPickerUtils } from '../../utils/DocumentPickerUtils';
import { DebugUtils } from '../../utils/DebugUtils';

export const DocumentPickerTest: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const testBasicDocumentPicker = async () => {
    setLoading(true);
    try {
      console.log('Testing basic document picker...');
      
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: false,
        multiple: false,
      });

      console.log('Basic picker result:', result);
      setLastResult(result);

      if (result.canceled) {
        Alert.alert('Result', 'User canceled selection');
      } else {
        Alert.alert('Success', `Selected: ${JSON.stringify(result, null, 2)}`);
      }
    } catch (error) {
      console.error('Basic picker error:', error);
      Alert.alert('Error', `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testPDFOnlyPicker = async () => {
    setLoading(true);
    try {
      console.log('Testing PDF-only document picker...');
      
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: false,
        multiple: false,
      });

      console.log('PDF picker result:', result);
      setLastResult(result);

      if (result.canceled) {
        Alert.alert('Result', 'User canceled selection');
      } else {
        Alert.alert('Success', `Selected PDF: ${JSON.stringify(result, null, 2)}`);
      }
    } catch (error) {
      console.error('PDF picker error:', error);
      Alert.alert('Error', `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testEnhancedPicker = async () => {
    setLoading(true);
    try {
      console.log('Testing enhanced document picker...');
      
      const result = await DocumentPickerUtils.pickPDFDocument();
      
      console.log('Enhanced picker result:', result);
      setLastResult(result);

      if (result.success) {
        Alert.alert('Success', `Selected: ${result.name}\nURI: ${result.uri}`);
      } else {
        Alert.alert('Error', result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Enhanced picker error:', error);
      Alert.alert('Error', `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      await DebugUtils.runDiagnostics();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Document Picker Test</Text>
        <Text style={styles.subtitle}>
          Use these buttons to test different document picker configurations
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={testBasicDocumentPicker}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Test Basic Picker (All Files)</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={testPDFOnlyPicker}
            disabled={loading}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              Test PDF Only Picker
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.accentButton]}
            onPress={testEnhancedPicker}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Test Enhanced Picker</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.debugButton]}
            onPress={runDiagnostics}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Run Diagnostics</Text>
          </TouchableOpacity>
        </View>

        {lastResult && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>Last Result:</Text>
            <ScrollView style={styles.resultScroll}>
              <Text style={styles.resultText}>
                {JSON.stringify(lastResult, null, 2)}
              </Text>
            </ScrollView>
          </View>
        )}

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>Instructions:</Text>
          <Text style={styles.instructionsText}>
            1. Try "Test Basic Picker" first - this should work on all platforms{'\n'}
            2. If basic picker fails, the issue is with document picker setup{'\n'}
            3. Try "Test PDF Only Picker" to test PDF-specific functionality{'\n'}
            4. Use "Test Enhanced Picker" to test our custom implementation{'\n'}
            5. Run "Diagnostics" to get detailed system information{'\n'}
            {'\n'}
            Check the console logs for detailed error information.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  buttonContainer: {
    marginBottom: 32,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  accentButton: {
    backgroundColor: '#34C759',
  },
  debugButton: {
    backgroundColor: '#FF9500',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButtonText: {
    color: '#007AFF',
  },
  resultContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  resultScroll: {
    maxHeight: 200,
  },
  resultText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
    lineHeight: 16,
  },
  instructionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});