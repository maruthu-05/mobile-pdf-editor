import React from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { ProgressConfig, ProgressStatus } from '../../modules/performance/ProgressManager';

interface ProgressIndicatorProps {
  config: ProgressConfig & { status: ProgressStatus };
  onCancel?: () => void;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ config, onCancel }) => {
  const progressAnim = React.useRef(new Animated.Value(config.progress || 0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  React.useEffect(() => {
    // Update progress animation
    if (config.type === 'determinate' && config.progress !== undefined) {
      Animated.timing(progressAnim, {
        toValue: config.progress,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [config.progress]);

  const getStatusColor = () => {
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
    switch (config.status) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'cancelled':
        return '⊘';
      default:
        return '';
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{config.title}</Text>
          {config.status !== 'loading' && (
            <Text style={[styles.statusIcon, { color: getStatusColor() }]}>
              {getStatusIcon()}
            </Text>
          )}
        </View>
        {config.cancellable && config.status === 'loading' && onCancel && (
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {config.message && (
        <Text style={styles.message}>{config.message}</Text>
      )}

      {config.type === 'determinate' && (
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

      {config.type === 'indeterminate' && config.status === 'loading' && (
        <View style={styles.indeterminateContainer}>
          <IndeterminateProgress color={getStatusColor()} />
        </View>
      )}
    </Animated.View>
  );
};

const IndeterminateProgress: React.FC<{ color: string }> = ({ color }) => {
  const animValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, []);

  return (
    <View style={styles.indeterminateTrack}>
      <Animated.View
        style={[
          styles.indeterminateBar,
          {
            backgroundColor: color,
            transform: [
              {
                translateX: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-100, 200],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginVertical: 4,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    flex: 1,
  },
  statusIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#F5F5F5',
  },
  cancelText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  message: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 8,
    minWidth: 35,
    textAlign: 'right',
  },
  indeterminateContainer: {
    marginTop: 8,
  },
  indeterminateTrack: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  indeterminateBar: {
    height: '100%',
    width: 100,
    borderRadius: 2,
  },
});