import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StorageManager } from '../../modules/storage-manager/StorageManager';
import { OfflineManager } from '../../modules/storage-manager/OfflineManager';
import { offlineCapabilityChecker } from '../../utils/offline-capability-checker';
import type { StorageInfo, StorageSettings, StorageCleanupOptions } from '../../modules/storage-manager/interfaces';
import type { OfflineCapabilityResult } from '../../utils/offline-capability-checker';

export const SettingsScreen: React.FC = () => {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [storageSettings, setStorageSettings] = useState<StorageSettings | null>(null);
  const [offlineCapability, setOfflineCapability] = useState<OfflineCapabilityResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isCheckingOffline, setIsCheckingOffline] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const storageManager = StorageManager.getInstance();
  const offlineManager = OfflineManager.getInstance();

  useEffect(() => {
    loadData();
    
    // Listen for offline state changes
    const unsubscribe = offlineManager.addListener((state) => {
      setIsOffline(!state.isOnline);
    });

    return unsubscribe;
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [info, settings] = await Promise.all([
        storageManager.getStorageInfo(),
        storageManager.getStorageSettings(),
      ]);
      setStorageInfo(info);
      setStorageSettings(settings);
    } catch (error) {
      console.error('Failed to load settings data:', error);
      Alert.alert('Error', 'Failed to load storage information');
    } finally {
      setIsLoading(false);
    }
  };

  const checkOfflineCapability = async () => {
    try {
      setIsCheckingOffline(true);
      const result = await offlineCapabilityChecker.checkAllCapabilities();
      setOfflineCapability(result);
      
      if (result.isFullyOfflineCapable) {
        Alert.alert(
          'Offline Ready! ✅',
          'All core features are available offline. You can use the app without an internet connection.',
          [{ text: 'Great!', style: 'default' }]
        );
      } else {
        const issueCount = Object.values(result.capabilities).filter(cap => !cap.available).length;
        Alert.alert(
          'Offline Issues Found ⚠️',
          `${issueCount} feature(s) may not work properly offline. Check the detailed report for more information.`,
          [
            { text: 'View Details', onPress: showOfflineReport },
            { text: 'OK', style: 'cancel' }
          ]
        );
      }
    } catch (error) {
      console.error('Failed to check offline capability:', error);
      Alert.alert('Error', 'Failed to check offline capability');
    } finally {
      setIsCheckingOffline(false);
    }
  };

  const showOfflineReport = async () => {
    try {
      const report = await offlineCapabilityChecker.generateOfflineCapabilityReport();
      Alert.alert(
        'Offline Capability Report',
        report,
        [{ text: 'OK', style: 'default' }],
        { cancelable: true }
      );
    } catch (error) {
      console.error('Failed to generate offline report:', error);
      Alert.alert('Error', 'Failed to generate offline report');
    }
  };

  const updateSetting = async (key: keyof StorageSettings, value: any) => {
    if (!storageSettings) return;

    try {
      const updatedSettings = { ...storageSettings, [key]: value };
      await storageManager.updateStorageSettings({ [key]: value });
      setStorageSettings(updatedSettings);
    } catch (error) {
      console.error('Failed to update setting:', error);
      Alert.alert('Error', 'Failed to update setting');
    }
  };

  const handleCleanup = async () => {
    Alert.alert(
      'Storage Cleanup',
      'This will remove temporary files and optimize storage. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: performCleanup },
      ]
    );
  };

  const performCleanup = async () => {
    try {
      setIsCleaningUp(true);
      
      const cleanupOptions: StorageCleanupOptions = {
        removeTemporaryFiles: true,
        removeThumbnails: false,
        compressOldFiles: storageSettings?.compressionEnabled || false,
        removeBackups: false,
      };

      const bytesFreed = await storageManager.cleanupStorage(cleanupOptions);
      
      // Refresh storage info
      const updatedInfo = await storageManager.getStorageInfo();
      setStorageInfo(updatedInfo);

      Alert.alert(
        'Cleanup Complete',
        `Freed ${formatBytes(bytesFreed)} of storage space`
      );
    } catch (error) {
      console.error('Cleanup failed:', error);
      Alert.alert('Error', 'Storage cleanup failed');
    } finally {
      setIsCleaningUp(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStorageColor = (percentage: number): string => {
    if (percentage >= 90) return '#ff4444';
    if (percentage >= 70) return '#ffaa00';
    return '#44aa44';
  };

  const getOfflineCapabilityColor = (): string => {
    if (!offlineCapability) return '#666';
    return offlineCapability.isFullyOfflineCapable ? '#44aa44' : '#ff4444';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Storage & Settings</Text>

      {/* Offline Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection Status</Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusIndicator, { backgroundColor: isOffline ? '#ff4444' : '#44aa44' }]} />
          <Text style={styles.statusText}>
            {isOffline ? 'Offline Mode' : 'Online'}
          </Text>
        </View>
        <Text style={styles.statusDescription}>
          {isOffline 
            ? 'All features are available offline. Changes will sync when connection is restored.'
            : 'Connected to the internet. All features are available.'
          }
        </Text>
        
        <TouchableOpacity 
          style={[styles.checkButton, isCheckingOffline && styles.disabledButton]}
          onPress={checkOfflineCapability}
          disabled={isCheckingOffline}
        >
          {isCheckingOffline ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.checkButtonText}>Check Offline Capability</Text>
          )}
        </TouchableOpacity>

        {offlineCapability && (
          <View style={styles.capabilityStatus}>
            <View style={styles.statusContainer}>
              <View style={[styles.statusIndicator, { backgroundColor: getOfflineCapabilityColor() }]} />
              <Text style={styles.statusText}>
                {offlineCapability.isFullyOfflineCapable ? 'Fully Offline Ready' : 'Limited Offline Support'}
              </Text>
            </View>
            <Text style={styles.statusDescription}>
              {Object.values(offlineCapability.capabilities).filter(cap => cap.available).length}/
              {Object.keys(offlineCapability.capabilities).length} features available offline
            </Text>
            {offlineCapability.recommendations.length > 0 && (
              <TouchableOpacity onPress={showOfflineReport}>
                <Text style={styles.reportLink}>View detailed report →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Storage Information */}
      {storageInfo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Storage Usage</Text>
          
          <View style={styles.storageBar}>
            <View 
              style={[
                styles.storageUsed, 
                { 
                  width: `${storageInfo.usagePercentage}%`,
                  backgroundColor: getStorageColor(storageInfo.usagePercentage)
                }
              ]} 
            />
          </View>
          
          <Text style={styles.storageText}>
            {formatBytes(storageInfo.usedSpace)} of {formatBytes(storageInfo.totalSpace)} used
            ({storageInfo.usagePercentage.toFixed(1)}%)
          </Text>
          
          <Text style={styles.storageSubtext}>
            App usage: {formatBytes(storageInfo.appUsedSpace)}
          </Text>
          
          <TouchableOpacity 
            style={[styles.cleanupButton, isCleaningUp && styles.disabledButton]}
            onPress={handleCleanup}
            disabled={isCleaningUp}
          >
            {isCleaningUp ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.cleanupButtonText}>Clean Up Storage</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Storage Settings */}
      {storageSettings && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Storage Settings</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto Cleanup</Text>
              <Text style={styles.settingDescription}>
                Automatically clean up temporary files when storage is low
              </Text>
            </View>
            <Switch
              value={storageSettings.autoCleanup}
              onValueChange={(value) => updateSetting('autoCleanup', value)}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={storageSettings.autoCleanup ? '#007AFF' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>File Compression</Text>
              <Text style={styles.settingDescription}>
                Compress large PDF files to save storage space
              </Text>
            </View>
            <Switch
              value={storageSettings.compressionEnabled}
              onValueChange={(value) => updateSetting('compressionEnabled', value)}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={storageSettings.compressionEnabled ? '#007AFF' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Storage Warning</Text>
              <Text style={styles.settingDescription}>
                Warn when storage usage exceeds {storageSettings.warningThreshold}%
              </Text>
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Max Storage Usage</Text>
              <Text style={styles.settingDescription}>
                Maximum storage usage before automatic cleanup: {storageSettings.maxStorageUsage}%
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Compression Settings */}
      {storageSettings?.compressionEnabled && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compression Settings</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Compression Quality</Text>
              <Text style={styles.settingDescription}>
                Quality: {Math.round(storageSettings.compressionOptions.quality * 100)}%
              </Text>
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Preserve Originals</Text>
              <Text style={styles.settingDescription}>
                Keep original files after compression
              </Text>
            </View>
            <Switch
              value={storageSettings.compressionOptions.preserveOriginal}
              onValueChange={(value) => 
                updateSetting('compressionOptions', {
                  ...storageSettings.compressionOptions,
                  preserveOriginal: value
                })
              }
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={storageSettings.compressionOptions.preserveOriginal ? '#007AFF' : '#f4f3f4'}
            />
          </View>
        </View>
      )}

      {/* App Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Information</Text>
        <Text style={styles.infoText}>Version: 1.0.0</Text>
        <Text style={styles.infoText}>
          Offline Mode: {isOffline ? 'Active' : 'Inactive'}
        </Text>
        <Text style={styles.infoText}>
          All core features work without internet connection
        </Text>
        {offlineCapability && (
          <Text style={styles.infoText}>
            Offline Capability: {offlineCapability.isFullyOfflineCapable ? 'Full' : 'Limited'}
          </Text>
        )}
      </View>
    </ScrollView>
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    margin: 20,
    marginBottom: 10,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  statusDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 15,
  },
  checkButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  checkButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  capabilityStatus: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  reportLink: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  storageBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 10,
    overflow: 'hidden',
  },
  storageUsed: {
    height: '100%',
    borderRadius: 4,
  },
  storageText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  storageSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  cleanupButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cleanupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
});