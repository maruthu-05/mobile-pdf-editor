import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

export interface SystemInfo {
  platform: string;
  platformVersion: string | number;
  expoVersion?: string;
  appVersion: string;
  deviceName?: string;
  isDevice: boolean;
  documentDirectory?: string;
  cacheDirectory?: string;
  documentPickerAvailable: boolean;
  fileSystemAvailable: boolean;
  permissions: {
    storage?: string;
    documents?: string;
  };
}

export class DebugUtils {
  /**
   * Collect comprehensive system information for debugging
   */
  static async getSystemInfo(): Promise<SystemInfo> {
    const info: SystemInfo = {
      platform: Platform.OS,
      platformVersion: Platform.Version,
      expoVersion: Constants.expoVersion,
      appVersion: Constants.manifest?.version || '1.0.0',
      deviceName: Constants.deviceName,
      isDevice: Constants.isDevice,
      documentDirectory: FileSystem.documentDirectory,
      cacheDirectory: FileSystem.cacheDirectory,
      documentPickerAvailable: false,
      fileSystemAvailable: false,
      permissions: {},
    };

    // Test DocumentPicker availability
    try {
      // Try to access DocumentPicker methods
      if (typeof DocumentPicker.getDocumentAsync === 'function') {
        info.documentPickerAvailable = true;
      }
    } catch (error) {
      console.warn('DocumentPicker not available:', error);
    }

    // Test FileSystem availability
    try {
      if (FileSystem.documentDirectory) {
        const testInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory);
        info.fileSystemAvailable = testInfo.exists;
      }
    } catch (error) {
      console.warn('FileSystem not available:', error);
    }

    return info;
  }

  /**
   * Test document picker functionality with detailed logging
   */
  static async testDocumentPicker(): Promise<{
    success: boolean;
    error?: string;
    details: string[];
  }> {
    const details: string[] = [];
    
    try {
      details.push(`Platform: ${Platform.OS} ${Platform.Version}`);
      details.push(`Device: ${Constants.isDevice ? 'Physical' : 'Simulator/Emulator'}`);
      
      // Check if DocumentPicker is available
      if (typeof DocumentPicker.getDocumentAsync !== 'function') {
        return {
          success: false,
          error: 'DocumentPicker.getDocumentAsync is not available',
          details
        };
      }
      
      details.push('DocumentPicker.getDocumentAsync is available');

      // Test with minimal configuration
      details.push('Testing document picker with minimal config...');
      
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: false,
        multiple: false,
      });

      details.push(`Result type: ${typeof result}`);
      details.push(`Result: ${JSON.stringify(result, null, 2)}`);

      if (result.canceled) {
        return {
          success: true,
          error: 'User canceled (this is normal)',
          details
        };
      }

      return {
        success: true,
        details
      };

    } catch (error) {
      details.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      details.push(`Error stack: ${error instanceof Error ? error.stack : 'No stack'}`);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details
      };
    }
  }

  /**
   * Test file system functionality
   */
  static async testFileSystem(): Promise<{
    success: boolean;
    error?: string;
    details: string[];
  }> {
    const details: string[] = [];
    
    try {
      details.push(`Document directory: ${FileSystem.documentDirectory}`);
      details.push(`Cache directory: ${FileSystem.cacheDirectory}`);

      if (!FileSystem.documentDirectory) {
        return {
          success: false,
          error: 'Document directory not available',
          details
        };
      }

      // Test directory access
      const dirInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory);
      details.push(`Directory exists: ${dirInfo.exists}`);
      details.push(`Is directory: ${dirInfo.isDirectory}`);

      // Test file creation
      const testFile = `${FileSystem.documentDirectory}debug_test.txt`;
      await FileSystem.writeAsStringAsync(testFile, 'Debug test file');
      details.push('Test file created successfully');

      // Test file reading
      const content = await FileSystem.readAsStringAsync(testFile);
      details.push(`Test file content: ${content}`);

      // Clean up
      await FileSystem.deleteAsync(testFile);
      details.push('Test file deleted successfully');

      return {
        success: true,
        details
      };

    } catch (error) {
      details.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details
      };
    }
  }

  /**
   * Run comprehensive diagnostics and show results
   */
  static async runDiagnostics(): Promise<void> {
    try {
      console.log('🔍 Running File Picker Diagnostics...');

      // Get system info
      const systemInfo = await this.getSystemInfo();
      console.log('📱 System Info:', systemInfo);

      // Test file system
      console.log('📁 Testing File System...');
      const fsTest = await this.testFileSystem();
      console.log('File System Test:', fsTest);

      // Test document picker
      console.log('📄 Testing Document Picker...');
      const dpTest = await this.testDocumentPicker();
      console.log('Document Picker Test:', dpTest);

      // Prepare diagnostic report
      const report = {
        systemInfo,
        fileSystemTest: fsTest,
        documentPickerTest: dpTest,
        timestamp: new Date().toISOString(),
      };

      // Show summary alert
      const issues: string[] = [];
      
      if (!systemInfo.isDevice) {
        issues.push('Running on simulator/emulator (limited functionality)');
      }
      
      if (!systemInfo.documentPickerAvailable) {
        issues.push('Document picker not available');
      }
      
      if (!systemInfo.fileSystemAvailable) {
        issues.push('File system not accessible');
      }
      
      if (!fsTest.success) {
        issues.push(`File system error: ${fsTest.error}`);
      }
      
      if (!dpTest.success && !dpTest.error?.includes('canceled')) {
        issues.push(`Document picker error: ${dpTest.error}`);
      }

      let message = 'Diagnostics completed.\n\n';
      
      if (issues.length === 0) {
        message += '✅ All systems appear to be working correctly.\n\n';
        message += 'If you\'re still experiencing issues, try:\n';
        message += '• Restarting the app\n';
        message += '• Testing on a physical device\n';
        message += '• Checking app permissions in device settings';
      } else {
        message += '⚠️ Issues found:\n\n';
        message += issues.map(issue => `• ${issue}`).join('\n');
        message += '\n\nCheck console logs for detailed information.';
      }

      Alert.alert('File Picker Diagnostics', message, [
        {
          text: 'Copy Report',
          onPress: () => {
            console.log('📋 Full Diagnostic Report:', JSON.stringify(report, null, 2));
            Alert.alert('Report Copied', 'Full diagnostic report has been logged to console.');
          }
        },
        { text: 'OK' }
      ]);

    } catch (error) {
      console.error('❌ Diagnostics failed:', error);
      Alert.alert(
        'Diagnostics Error',
        `Failed to run diagnostics: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Show quick debug info alert
   */
  static showQuickDebugInfo(): void {
    const info = {
      platform: Platform.OS,
      version: Platform.Version,
      isDevice: Constants.isDevice,
      expoVersion: Constants.expoVersion,
      documentDir: !!FileSystem.documentDirectory,
      cacheDir: !!FileSystem.cacheDirectory,
    };

    Alert.alert(
      'Debug Info',
      Object.entries(info)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n'),
      [
        {
          text: 'Run Full Diagnostics',
          onPress: () => this.runDiagnostics()
        },
        { text: 'OK' }
      ]
    );
  }
}