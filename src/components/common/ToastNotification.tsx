import React from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { ToastConfig, ToastType } from '../../modules/performance/ProgressManager';

interface ToastNotificationProps {
  config: ToastConfig & { timestamp: number };
  onHide?: () => void;
  onActionPress?: () => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  config,
  onHide,
  onActionPress,
}) => {
  const slideAnim = React.useRef(new Animated.Value(-100)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Slide in and fade in animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide?.();
    });
  };

  const getToastStyle = () => {
    const baseStyle = styles.container;
    
    switch (config.type) {
      case 'success':
        return [baseStyle, styles.successToast];
      case 'error':
        return [baseStyle, styles.errorToast];
      case 'warning':
        return [baseStyle, styles.warningToast];
      case 'info':
      default:
        return [baseStyle, styles.infoToast];
    }
  };

  const getIconForType = () => {
    switch (config.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  const getIconColor = () => {
    switch (config.type) {
      case 'success':
        return '#FFFFFF';
      case 'error':
        return '#FFFFFF';
      case 'warning':
        return '#FFFFFF';
      case 'info':
      default:
        return '#FFFFFF';
    }
  };

  return (
    <Animated.View
      style={[
        getToastStyle(),
        {
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={[styles.icon, { color: getIconColor() }]}>
            {getIconForType()}
          </Text>
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>{config.title}</Text>
          {config.message && (
            <Text style={styles.message}>{config.message}</Text>
          )}
        </View>

        <View style={styles.actionsContainer}>
          {config.action && (
            <TouchableOpacity
              onPress={() => {
                onActionPress?.();
                config.action?.onPress();
              }}
              style={styles.actionButton}
            >
              <Text style={styles.actionText}>{config.action.label}</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

export const ToastContainer: React.FC<{
  toasts: Array<ToastConfig & { timestamp: number }>;
  onHideToast: (id: string) => void;
}> = ({ toasts, onHideToast }) => {
  return (
    <View style={styles.toastContainer}>
      {toasts.map((toast) => (
        <ToastNotification
          key={toast.id}
          config={toast}
          onHide={() => onHideToast(toast.id!)}
        />
      ))}
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 1000,
    pointerEvents: 'box-none',
  },
  container: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    maxWidth: width - 32,
  },
  successToast: {
    backgroundColor: '#4CAF50',
  },
  errorToast: {
    backgroundColor: '#F44336',
  },
  warningToast: {
    backgroundColor: '#FF9800',
  },
  infoToast: {
    backgroundColor: '#2196F3',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  icon: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginLeft: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    lineHeight: 16,
  },
});