import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Fallback file picker for Expo Go environment
 * This provides alternative ways to get files when document picker is not available
 */
export class ExpoGoFilePickerFallback {
  
  /**
   * Check if we're running in Expo Go
   */
  static isExpoGo(): boolean {
    // In Expo Go, Constants.appOwnership is 'expo'
    // In development builds, it's 'standalone'
    try {
      const Constants = require('expo-constants');
      return Constants.default?.appOwnership === 'expo' || Constants.appOwnership === 'expo';
    } catch (error) {
      console.warn('Failed to check Expo Go status:', error);
      return false;
    }
  }

  /**
   * Create a sample PDF file for testing in Expo Go
   */
  static async createSamplePDF(): Promise<{
    success: boolean;
    uri?: string;
    name?: string;
    size?: number;
    error?: string;
  }> {
    try {
      // Check if FileSystem is available
      if (!FileSystem.documentDirectory) {
        throw new Error('Document directory not available');
      }

      // Create a minimal PDF content (this is a very basic PDF structure)
      const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Sample PDF for Testing) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000369 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
466
%%EOF`;

      const fileName = `sample_${Date.now()}.pdf`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      // Write the PDF content to file
      // Use string literal instead of EncodingType enum for better Expo Go compatibility
      await FileSystem.writeAsStringAsync(filePath, pdfContent, {
        encoding: 'utf8' as any, // Fallback for Expo Go compatibility
      });

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      return {
        success: true,
        uri: filePath,
        name: fileName,
        size: fileInfo.size || pdfContent.length,
      };

    } catch (error) {
      console.error('Error creating sample PDF:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create sample PDF',
      };
    }
  }

  /**
   * Show options for getting files in Expo Go
   */
  static showExpoGoOptions(): Promise<{
    success: boolean;
    uri?: string;
    name?: string;
    size?: number;
    error?: string;
  }> {
    return new Promise((resolve) => {
      Alert.alert(
        'File Selection in Expo Go',
        'Document picker has limited functionality in Expo Go. Choose an option:',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve({
              success: false,
              error: 'User canceled',
            }),
          },
          {
            text: 'Create Sample PDF',
            onPress: async () => {
              const result = await this.createSamplePDF();
              resolve(result);
            },
          },
          {
            text: 'Try Document Picker',
            onPress: async () => {
              try {
                const DocumentPicker = require('expo-document-picker');
                
                // Check if DocumentPicker is properly available
                if (typeof DocumentPicker.getDocumentAsync !== 'function') {
                  resolve({
                    success: false,
                    error: 'Document picker is not available in this environment',
                  });
                  return;
                }

                const result = await DocumentPicker.getDocumentAsync({
                  type: '*/*',
                  copyToCacheDirectory: true,
                  multiple: false,
                });

                if (result.canceled) {
                  resolve({
                    success: false,
                    error: 'User canceled',
                  });
                } else if (result.assets && result.assets.length > 0) {
                  const asset = result.assets[0];
                  resolve({
                    success: true,
                    uri: asset.uri,
                    name: asset.name,
                    size: asset.size,
                  });
                } else if ('uri' in result && result.uri) {
                  // Handle legacy API structure
                  resolve({
                    success: true,
                    uri: result.uri,
                    name: result.name,
                    size: result.size,
                  });
                } else {
                  resolve({
                    success: false,
                    error: 'No file selected or unexpected result format',
                  });
                }
              } catch (error) {
                console.error('Document picker error in Expo Go:', error);
                resolve({
                  success: false,
                  error: error instanceof Error ? error.message : 'Document picker failed',
                });
              }
            },
          },
        ]
      );
    });
  }

  /**
   * Show instructions for using development build
   */
  static showDevelopmentBuildInstructions(): void {
    Alert.alert(
      'Limited Functionality in Expo Go',
      'For full file picker functionality, you need to create a development build.\n\n' +
      'Steps to create a development build:\n' +
      '1. Install Android Studio or Xcode\n' +
      '2. Run: npx expo run:android (or run:ios)\n' +
      '3. This creates a custom build with full functionality\n\n' +
      'For now, you can test with the sample PDF option.',
      [
        { text: 'OK' },
        {
          text: 'Learn More',
          onPress: () => {
            console.log('Development build info: https://docs.expo.dev/development/build/');
          },
        },
      ]
    );
  }

  /**
   * Get available storage info for Expo Go
   */
  static async getStorageInfo(): Promise<{
    documentDirectory: string;
    cacheDirectory: string;
    availableSpace?: number;
  }> {
    try {
      const availableSpace = await FileSystem.getFreeDiskStorageAsync();
      
      return {
        documentDirectory: FileSystem.documentDirectory || 'Not available',
        cacheDirectory: FileSystem.cacheDirectory || 'Not available',
        availableSpace,
      };
    } catch (error) {
      return {
        documentDirectory: FileSystem.documentDirectory || 'Not available',
        cacheDirectory: FileSystem.cacheDirectory || 'Not available',
      };
    }
  }
}