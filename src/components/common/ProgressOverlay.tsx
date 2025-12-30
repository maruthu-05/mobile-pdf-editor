import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { ProgressConfig, ProgressStatus } from '../../modules/performance/ProgressManager';

interface ProgressOverlayProps {
  visible: boolean;
  config?: ProgressConfig & { status: ProgressStatus };
  onCancel?: () => void;
  onDismiss?: () => void;
}

export const ProgressOverlay: React.FC<ProgressOverlayProps> = ({
  visible,
  config,
  onCancel,
  onDismiss,
}) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  React.useEffect(() => {
    if (config?.progress !== undefined) {
      Animated.timing(progressAnim, {
        toValue: config.progress,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [config?.progress]);

  const getStatusColor = () => {
    if (!config) return '#2196F3';
    
    switch (config.status) {
      case 'success':
        return '#4CAF50';
      case 'error':
        return '#F44336';
      case 'cancelled':
        return '#9E9E9E';
      default:
        return '#2196F3';
    }
  };

  const getStatusIcon = () => {
    if (!config) return null;
    
    switch (config.status) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'cancelled':
        return '⊘';
      default:
        return null;
    }
  };

  const canDismiss = config?.status === 'success' || config?.status === 'error' || config?.status === 'cancelled';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={canDismiss ? onDismiss : undefined}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={canDismiss ? onDismiss : undefined}
        />
        
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {config && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>{config.title}</Text>
                {getStatusIcon() && (
                  <Text style={[styles.statusIcon, { color: getStatusColor() }]}>
                    {getStatusIcon()}
                  </Text>
                )}
              </View>

              {config.message && (
                <Text style={styles.message}>{config.message}</Text>
              )}

              {config.status === 'loading' && (
                <View style={styles.loadingContainer}>
                  {config.type === 'indeterminate' ? (
                    <ActivityIndicator size="large" color={getStatusColor()} />
                  ) : (
                    <View style={styles.progressContainer}>
                      <View style={styles.progressTrack}>
                        <Animated.View
                          style={[
                            styles.progressBar,
                            {
                              backgroundColor: getStatusColor(),
                              width: progressAnim.interpolate({
                                inputRange: [0, 100],
                                outputRange: ['0%', '100%'],
                                extrapolate: 'clamp',
                              }),
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressText}>
                        {Math.round(config.progress || 0)}%
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.actions}>
                {config.cancellable && config.status === 'loading' && onCancel && (
                  <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                )}
                
                {canDismiss && onDismiss && (
                  <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
                    <Text style={styles.dismissText}>
                      {config.status === 'success' ? 'Done' : 'Close'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export const LoadingOverlay: React.FC<{
  visible: boolean;
  message?: string;
  onCancel?: () => void;
}> = ({ visible, message, onCancel }) => {
  return (
    <ProgressOverlay
      visible={visible}
      config={
        visible
          ? {
              id: 'loading',
              type: 'indeterminate',
              title: 'Loading...',
              message,
              status: 'loading',
              cancellable: !!onCancel,
            }
          : undefined
      }
      onCancel={onCancel}
    />
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    marginHorizontal: 32,
    maxWidth: width - 64,
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    flex: 1,
  },
  statusIcon: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  message: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 20,
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  dismissButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#2196F3',
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});