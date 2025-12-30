import { useState, useEffect, useCallback, useRef } from 'react';
import { ProgressManager, ProgressConfig, ToastConfig, LoadingState } from '../modules/performance/ProgressManager';

/**
 * Hook for managing progress indicators
 */
export const useProgress = () => {
  const [progressIndicators, setProgressIndicators] = useState<Array<ProgressConfig & { status: any }>>([]);
  const [toasts, setToasts] = useState<Array<ToastConfig & { timestamp: number }>>([]);
  const [loadingStates, setLoadingStates] = useState<LoadingState[]>([]);
  
  const progressManager = useRef(ProgressManager.getInstance()).current;

  useEffect(() => {
    // Set up event listeners
    progressManager.onProgressUpdate = (id, config) => {
      setProgressIndicators(prev => {
        const index = prev.findIndex(p => p.id === id);
        if (index >= 0) {
          const newProgress = [...prev];
          newProgress[index] = config;
          return newProgress;
        } else {
          return [...prev, config];
        }
      });
    };

    progressManager.onProgressComplete = (id) => {
      setProgressIndicators(prev => prev.filter(p => p.id !== id));
    };

    progressManager.onToastShow = (toast) => {
      setToasts(prev => [...prev, toast]);
    };

    progressManager.onToastHide = (id) => {
      setToasts(prev => prev.filter(t => t.id !== id));
    };

    progressManager.onLoadingStateChange = (id, state) => {
      setLoadingStates(prev => {
        const index = prev.findIndex(s => s.id === id);
        if (state.isLoading) {
          if (index >= 0) {
            const newStates = [...prev];
            newStates[index] = state;
            return newStates;
          } else {
            return [...prev, state];
          }
        } else {
          return prev.filter(s => s.id !== id);
        }
      });
    };

    // Initialize with current state
    setProgressIndicators(progressManager.getAllProgress());
    setToasts(progressManager.getAllToasts());
    setLoadingStates(progressManager.getAllLoadingStates());

    return () => {
      // Clean up listeners
      progressManager.onProgressUpdate = undefined;
      progressManager.onProgressComplete = undefined;
      progressManager.onToastShow = undefined;
      progressManager.onToastHide = undefined;
      progressManager.onLoadingStateChange = undefined;
    };
  }, [progressManager]);

  const startProgress = useCallback((config: ProgressConfig) => {
    return progressManager.startProgress(config);
  }, [progressManager]);

  const updateProgress = useCallback((id: string, update: any) => {
    progressManager.updateProgress(id, update);
  }, [progressManager]);

  const completeProgress = useCallback((id: string, success: boolean = true, message?: string) => {
    progressManager.completeProgress(id, success, message);
  }, [progressManager]);

  const cancelProgress = useCallback((id: string) => {
    progressManager.cancelProgress(id);
  }, [progressManager]);

  const showToast = useCallback((config: ToastConfig) => {
    return progressManager.showToast(config);
  }, [progressManager]);

  const hideToast = useCallback((id: string) => {
    progressManager.hideToast(id);
  }, [progressManager]);

  const showSuccess = useCallback((title: string, message?: string, duration?: number) => {
    return progressManager.showSuccess(title, message, duration);
  }, [progressManager]);

  const showError = useCallback((title: string, message?: string, duration?: number) => {
    return progressManager.showError(title, message, duration);
  }, [progressManager]);

  const showWarning = useCallback((title: string, message?: string, duration?: number) => {
    return progressManager.showWarning(title, message, duration);
  }, [progressManager]);

  const showInfo = useCallback((title: string, message?: string, duration?: number) => {
    return progressManager.showInfo(title, message, duration);
  }, [progressManager]);

  const setLoadingState = useCallback((id: string, isLoading: boolean, message?: string, progress?: number) => {
    progressManager.setLoadingState(id, isLoading, message, progress);
  }, [progressManager]);

  const clearLoadingState = useCallback((id: string) => {
    progressManager.clearLoadingState(id);
  }, [progressManager]);

  const createOperationProgress = useCallback((title: string, cancellable: boolean = false, onCancel?: () => void) => {
    return progressManager.createOperationProgress(title, cancellable, onCancel);
  }, [progressManager]);

  const createSkeletonLoader = useCallback((id: string, message?: string) => {
    return progressManager.createSkeletonLoader(id, message);
  }, [progressManager]);

  return {
    progressIndicators,
    toasts,
    loadingStates,
    startProgress,
    updateProgress,
    completeProgress,
    cancelProgress,
    showToast,
    hideToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    setLoadingState,
    clearLoadingState,
    createOperationProgress,
    createSkeletonLoader,
  };
};

/**
 * Hook for managing a single operation progress
 */
export const useOperationProgress = (title: string, cancellable: boolean = false) => {
  const [progressId, setProgressId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const progressManager = useRef(ProgressManager.getInstance()).current;
  const onCancelRef = useRef<(() => void) | undefined>();

  const start = useCallback((onCancel?: () => void) => {
    onCancelRef.current = onCancel;
    const operation = progressManager.createOperationProgress(title, cancellable, onCancel);
    setProgressId(operation.id);
    setIsActive(true);
    return operation;
  }, [progressManager, title, cancellable]);

  const update = useCallback((progress: number, message?: string) => {
    if (progressId) {
      progressManager.updateProgress(progressId, { progress, message });
    }
  }, [progressManager, progressId]);

  const complete = useCallback((success: boolean = true, message?: string) => {
    if (progressId) {
      progressManager.completeProgress(progressId, success, message);
      setIsActive(false);
    }
  }, [progressManager, progressId]);

  const cancel = useCallback(() => {
    if (progressId) {
      progressManager.cancelProgress(progressId);
      setIsActive(false);
      onCancelRef.current?.();
    }
  }, [progressManager, progressId]);

  useEffect(() => {
    return () => {
      if (progressId && isActive) {
        progressManager.removeProgress(progressId);
      }
    };
  }, [progressManager, progressId, isActive]);

  return {
    start,
    update,
    complete,
    cancel,
    isActive,
    progressId,
  };
};

/**
 * Hook for managing loading states
 */
export const useLoadingState = (id: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [progress, setProgress] = useState<number | undefined>();
  const progressManager = useRef(ProgressManager.getInstance()).current;

  const startLoading = useCallback((loadingMessage?: string, loadingProgress?: number) => {
    setIsLoading(true);
    setMessage(loadingMessage);
    setProgress(loadingProgress);
    progressManager.setLoadingState(id, true, loadingMessage, loadingProgress);
  }, [progressManager, id]);

  const updateLoading = useCallback((loadingMessage?: string, loadingProgress?: number) => {
    if (isLoading) {
      setMessage(loadingMessage);
      setProgress(loadingProgress);
      progressManager.setLoadingState(id, true, loadingMessage, loadingProgress);
    }
  }, [progressManager, id, isLoading]);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
    setMessage(undefined);
    setProgress(undefined);
    progressManager.clearLoadingState(id);
  }, [progressManager, id]);

  useEffect(() => {
    return () => {
      if (isLoading) {
        progressManager.clearLoadingState(id);
      }
    };
  }, [progressManager, id, isLoading]);

  return {
    isLoading,
    message,
    progress,
    startLoading,
    updateLoading,
    stopLoading,
  };
};

/**
 * Hook for managing toast notifications
 */
export const useToast = () => {
  const progressManager = useRef(ProgressManager.getInstance()).current;

  const showSuccess = useCallback((title: string, message?: string, duration?: number) => {
    return progressManager.showSuccess(title, message, duration);
  }, [progressManager]);

  const showError = useCallback((title: string, message?: string, duration?: number) => {
    return progressManager.showError(title, message, duration);
  }, [progressManager]);

  const showWarning = useCallback((title: string, message?: string, duration?: number) => {
    return progressManager.showWarning(title, message, duration);
  }, [progressManager]);

  const showInfo = useCallback((title: string, message?: string, duration?: number) => {
    return progressManager.showInfo(title, message, duration);
  }, [progressManager]);

  const showToast = useCallback((config: ToastConfig) => {
    return progressManager.showToast(config);
  }, [progressManager]);

  const hideToast = useCallback((id: string) => {
    progressManager.hideToast(id);
  }, [progressManager]);

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showToast,
    hideToast,
  };
};