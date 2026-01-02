import * as DocumentPicker from 'expo-document-picker';
import { Platform, Alert } from 'react-native';

export interface DocumentPickerResult {
  success: boolean;
  uri?: string;
  name?: string;
  size?: number;
  mimeType?: string;
  error?: string;
}

/**
 * Enhanced document picker utility with better error handling and fallbacks
 */
export class DocumentPickerUtils {
  /**
   * Check if document picker is available on the current platform
   */
  static isAvailable(): boolean {
    // Document picker should be available on iOS and Android
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }

  /**
   * Pick a PDF document with multiple fallback strategies
   */
  static async pickPDFDocument(): Promise<DocumentPickerResult> {
    try {
      // Check if document picker is available
      if (!this.isAvailable()) {
        return {
          success: false,
          error: 'Document picker is not available on this platform'
        };
      }

      console.log('Starting document picker...');

      // Try different configurations in order of preference
      const configurations = [
        // Configuration 1: Most specific - PDF only
        {
          type: 'application/pdf',
          copyToCacheDirectory: false,
          multiple: false,
        },
        // Configuration 2: Multiple PDF MIME types
        {
          type: ['application/pdf', 'application/x-pdf'],
          copyToCacheDirectory: false,
          multiple: false,
        },
        // Configuration 3: All document types (let user filter)
        {
          type: '*/*',
          copyToCacheDirectory: false,
          multiple: false,
        },
        // Configuration 4: Use cache directory as fallback
        {
          type: 'application/pdf',
          copyToCacheDirectory: true,
          multiple: false,
        }
      ];

      let lastError: Error | null = null;

      for (let i = 0; i < configurations.length; i++) {
        try {
          console.log(`Trying document picker configuration ${i + 1}:`, configurations[i]);
          
          const result = await DocumentPicker.getDocumentAsync(configurations[i]);
          
          console.log(`Configuration ${i + 1} result:`, result);

          // Handle the result based on the new API structure
          if (result.canceled) {
            console.log('User canceled document selection');
            return {
              success: false,
              error: 'User canceled selection'
            };
          }

          // Check if we have assets (new API structure)
          if (result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            
            // Validate the selected file
            const validation = this.validatePDFFile(asset.name || '', asset.mimeType);
            if (!validation.isValid) {
              return {
                success: false,
                error: validation.error
              };
            }

            return {
              success: true,
              uri: asset.uri,
              name: asset.name,
              size: asset.size,
              mimeType: asset.mimeType
            };
          }

          // Handle legacy API structure (fallback)
          if ('uri' in result && result.uri) {
            const validation = this.validatePDFFile(result.name || '', result.mimeType);
            if (!validation.isValid) {
              return {
                success: false,
                error: validation.error
              };
            }

            return {
              success: true,
              uri: result.uri,
              name: result.name,
              size: result.size,
              mimeType: result.mimeType
            };
          }

          // If we get here, the result structure is unexpected
          console.warn('Unexpected document picker result structure:', result);
          
        } catch (error) {
          console.log(`Configuration ${i + 1} failed:`, error);
          lastError = error as Error;
          
          // If this is not the last configuration, continue to the next one
          if (i < configurations.length - 1) {
            continue;
          }
        }
      }

      // If we get here, all configurations failed
      const errorMessage = this.getErrorMessage(lastError);
      return {
        success: false,
        error: errorMessage
      };

    } catch (error) {
      console.error('Unexpected error in document picker:', error);
      return {
        success: false,
        error: this.getErrorMessage(error as Error)
      };
    }
  }

  /**
   * Validate if the selected file is a PDF
   */
  private static validatePDFFile(fileName: string, mimeType?: string): { isValid: boolean; error?: string } {
    // Check file extension
    const hasValidExtension = fileName.toLowerCase().endsWith('.pdf');
    
    // Check MIME type
    const validMimeTypes = [
      'application/pdf',
      'application/x-pdf',
      'application/acrobat',
      'applications/vnd.pdf',
      'text/pdf',
      'text/x-pdf'
    ];
    
    const hasValidMimeType = mimeType ? 
      validMimeTypes.some(type => mimeType.toLowerCase().includes(type.toLowerCase())) : 
      false;

    if (!hasValidExtension && !hasValidMimeType) {
      return {
        isValid: false,
        error: 'Please select a PDF file. Only PDF documents are supported.'
      };
    }

    return { isValid: true };
  }

  /**
   * Get user-friendly error message from error object
   */
  private static getErrorMessage(error: Error | null): string {
    if (!error) {
      return 'Unknown error occurred while selecting document';
    }

    const message = error.message.toLowerCase();

    if (message.includes('permission')) {
      return 'Permission denied. Please check app permissions in device Settings.';
    }
    
    if (message.includes('not available') || message.includes('unavailable')) {
      return 'File picker is not available on this device.';
    }
    
    if (message.includes('network') || message.includes('connection')) {
      return 'Network error. Please check your connection and try again.';
    }
    
    if (message.includes('storage') || message.includes('space')) {
      return 'Insufficient storage space. Please free up some space and try again.';
    }
    
    if (message.includes('cancelled') || message.includes('canceled')) {
      return 'File selection was canceled.';
    }

    // Default error message
    return 'Failed to open file picker. Please try again or restart the app.';
  }

  /**
   * Show appropriate error alert to user
   */
  static showErrorAlert(error: string): void {
    let title = 'File Selection Error';
    let message = error;
    let buttons: any[] = [{ text: 'OK' }];

    if (error.includes('permission')) {
      title = 'Permission Required';
      buttons = [
        { text: 'Cancel' },
        { 
          text: 'Settings', 
          onPress: () => {
            // On iOS, we can't directly open settings, but we can suggest it
            if (Platform.OS === 'ios') {
              Alert.alert(
                'Open Settings',
                'Please go to Settings > Privacy & Security > Files and Folders, then enable access for this app.',
                [{ text: 'OK' }]
              );
            }
          }
        }
      ];
    } else if (error.includes('not available')) {
      title = 'Feature Not Available';
      message = 'File picker is not available on this device. This feature requires iOS 11+ or Android 6+.';
    }

    Alert.alert(title, message, buttons);
  }
}