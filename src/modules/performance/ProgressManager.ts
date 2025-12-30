/**
 * Progress indicator types
 */
export type ProgressType = 'determinate' | 'indeterminate';

/**
 * Progress status
 */
export type ProgressStatus = 'idle' | 'loading' | 'success' | 'error' | 'cancelled';

/**
 * Progress indicator configuration
 */
export interface ProgressConfig {
  id: string;
  type: ProgressType;
  title: string;
  message?: string;
  progress?: number; // 0-100 for determinate progress
  cancellable?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number; // milliseconds
}

/**
 * Progress update data
 */
export interface ProgressUpdate {
  progress?: number;
  message?: string;
  status?: ProgressStatus;
}

/**
 * Toast notification types
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast notification configuration
 */
export interface ToastConfig {
  id?: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // milliseconds, 0 for persistent
  action?: {
    label: string;
    onPress: () => void;
  };
}

/**
 * Loading state configuration
 */
export interface LoadingState {
  id: string;
  isLoading: boolean;
  message?: string;
  progress?: number;
}

/**
 * Progress Manager for handling progress indicators, loading states, and user feedback
 */
export class ProgressManager {
  private static instance: ProgressManager;
  
  // Active progress indicators
  private progressIndicators = new Map<string, ProgressConfig & { status: ProgressStatus }>();
  
  // Active toasts
  private toasts = new Map<string, ToastConfig & { timestamp: number }>();
  
  // Loading states
  private loadingStates = new Map<string, LoadingState>();
  
  // Auto-hide timers
  private autoHideTimers = new Map<string, NodeJS.Timeout>();
  
  // Event callbacks
  public onProgressUpdate?: (id: string, config: ProgressConfig & { status: ProgressStatus }) => void;
  public onProgressComplete?: (id: string) => void;
  public onProgressCancelled?: (id: string) => void;
  public onToastShow?: (toast: ToastConfig & { timestamp: number }) => void;
  public onToastHide?: (id: string) => void;
  public onLoadingStateChange?: (id: string, state: LoadingState) => void;

  private constructor() {}

  static getInstance(): ProgressManager {
    if (!ProgressManager.instance) {
      ProgressManager.instance = new ProgressManager();
    }
    return ProgressManager.instance;
  }

  /**
   * Start a progress indicator
   */
  startProgress(config: ProgressConfig): string {
    const progressId = config.id || this.generateId();
    
    const progressData = {
      ...config,
      id: progressId,
      status: 'loading' as ProgressStatus
    };
    
    this.progressIndicators.set(progressId, progressData);
    this.onProgressUpdate?.(progressId, progressData);
    
    // Set up auto-hide if configured
    if (config.autoHide && config.autoHideDelay) {
      this.setAutoHideTimer(progressId, config.autoHideDelay);
    }
    
    return progressId;
  }

  /**
   * Update progress indicator
   */
  updateProgress(id: string, update: ProgressUpdate): void {
    const progress = this.progressIndicators.get(id);
    if (!progress) {
      return;
    }

    // Update progress data
    if (update.progress !== undefined) {
      progress.progress = Math.max(0, Math.min(100, update.progress));
    }
    
    if (update.message !== undefined) {
      progress.message = update.message;
    }
    
    if (update.status !== undefined) {
      progress.status = update.status;
    }

    this.progressIndicators.set(id, progress);
    this.onProgressUpdate?.(id, progress);

    // Handle completion
    if (update.status === 'success' || update.status === 'error') {
      this.handleProgressCompletion(id, update.status);
    }
  }

  /**
   * Complete progress indicator
   */
  completeProgress(id: string, success: boolean = true, message?: string): void {
    this.updateProgress(id, {
      progress: 100,
      status: success ? 'success' : 'error',
      message: message
    });
  }

  /**
   * Cancel progress indicator
   */
  cancelProgress(id: string): void {
    const progress = this.progressIndicators.get(id);
    if (!progress) {
      return;
    }

    progress.status = 'cancelled';
    this.progressIndicators.set(id, progress);
    
    this.onProgressCancelled?.(id);
    this.clearAutoHideTimer(id);
    
    // Remove after a short delay
    setTimeout(() => {
      this.removeProgress(id);
    }, 1000);
  }

  /**
   * Remove progress indicator
   */
  removeProgress(id: string): void {
    this.progressIndicators.delete(id);
    this.clearAutoHideTimer(id);
    this.onProgressComplete?.(id);
  }

  /**
   * Get progress indicator
   */
  getProgress(id: string): (ProgressConfig & { status: ProgressStatus }) | undefined {
    return this.progressIndicators.get(id);
  }

  /**
   * Get all active progress indicators
   */
  getAllProgress(): Array<ProgressConfig & { status: ProgressStatus }> {
    return Array.from(this.progressIndicators.values());
  }

  /**
   * Show toast notification
   */
  showToast(config: ToastConfig): string {
    const toastId = config.id || this.generateId();
    const timestamp = Date.now();
    
    const toastData = {
      ...config,
      id: toastId,
      timestamp
    };
    
    this.toasts.set(toastId, toastData);
    this.onToastShow?.(toastData);
    
    // Auto-hide toast if duration is specified
    if (config.duration && config.duration > 0) {
      setTimeout(() => {
        this.hideToast(toastId);
      }, config.duration);
    }
    
    return toastId;
  }

  /**
   * Hide toast notification
   */
  hideToast(id: string): void {
    if (this.toasts.has(id)) {
      this.toasts.delete(id);
      this.onToastHide?.(id);
    }
  }

  /**
   * Get toast notification
   */
  getToast(id: string): (ToastConfig & { timestamp: number }) | undefined {
    return this.toasts.get(id);
  }

  /**
   * Get all active toasts
   */
  getAllToasts(): Array<ToastConfig & { timestamp: number }> {
    return Array.from(this.toasts.values());
  }

  /**
   * Set loading state
   */
  setLoadingState(id: string, isLoading: boolean, message?: string, progress?: number): void {
    const state: LoadingState = {
      id,
      isLoading,
      message,
      progress
    };
    
    this.loadingStates.set(id, state);
    this.onLoadingStateChange?.(id, state);
  }

  /**
   * Get loading state
   */
  getLoadingState(id: string): LoadingState | undefined {
    return this.loadingStates.get(id);
  }

  /**
   * Get all loading states
   */
  getAllLoadingStates(): LoadingState[] {
    return Array.from(this.loadingStates.values());
  }

  /**
   * Clear loading state
   */
  clearLoadingState(id: string): void {
    this.loadingStates.delete(id);
    this.onLoadingStateChange?.(id, { id, isLoading: false });
  }

  /**
   * Show success toast
   */
  showSuccess(title: string, message?: string, duration: number = 3000): string {
    return this.showToast({
      type: 'success',
      title,
      message,
      duration
    });
  }

  /**
   * Show error toast
   */
  showError(title: string, message?: string, duration: number = 5000): string {
    return this.showToast({
      type: 'error',
      title,
      message,
      duration
    });
  }

  /**
   * Show warning toast
   */
  showWarning(title: string, message?: string, duration: number = 4000): string {
    return this.showToast({
      type: 'warning',
      title,
      message,
      duration
    });
  }

  /**
   * Show info toast
   */
  showInfo(title: string, message?: string, duration: number = 3000): string {
    return this.showToast({
      type: 'info',
      title,
      message,
      duration
    });
  }

  /**
   * Create a progress indicator for long-running operations
   */
  createOperationProgress(
    title: string,
    cancellable: boolean = false,
    onCancel?: () => void
  ): {
    id: string;
    update: (progress: number, message?: string) => void;
    complete: (success?: boolean, message?: string) => void;
    cancel: () => void;
  } {
    const id = this.startProgress({
      id: this.generateId(),
      type: 'determinate',
      title,
      progress: 0,
      cancellable,
      autoHide: true,
      autoHideDelay: 2000
    });

    return {
      id,
      update: (progress: number, message?: string) => {
        this.updateProgress(id, { progress, message });
      },
      complete: (success: boolean = true, message?: string) => {
        this.completeProgress(id, success, message);
      },
      cancel: () => {
        this.cancelProgress(id);
        onCancel?.();
      }
    };
  }

  /**
   * Create skeleton loading state
   */
  createSkeletonLoader(id: string, message?: string): {
    show: () => void;
    hide: () => void;
    update: (message?: string) => void;
  } {
    return {
      show: () => {
        this.setLoadingState(id, true, message);
      },
      hide: () => {
        this.clearLoadingState(id);
      },
      update: (newMessage?: string) => {
        const state = this.getLoadingState(id);
        if (state) {
          this.setLoadingState(id, true, newMessage || state.message);
        }
      }
    };
  }

  /**
   * Handle progress completion
   */
  private handleProgressCompletion(id: string, status: ProgressStatus): void {
    const progress = this.progressIndicators.get(id);
    if (!progress) {
      return;
    }

    // Show completion toast
    if (status === 'success') {
      this.showSuccess(
        'Operation Complete',
        `${progress.title} completed successfully`
      );
    } else if (status === 'error') {
      this.showError(
        'Operation Failed',
        `${progress.title} failed: ${progress.message || 'Unknown error'}`
      );
    }

    // Auto-remove after delay
    setTimeout(() => {
      this.removeProgress(id);
    }, progress.autoHideDelay || 2000);
  }

  /**
   * Set auto-hide timer
   */
  private setAutoHideTimer(id: string, delay: number): void {
    this.clearAutoHideTimer(id);
    
    const timer = setTimeout(() => {
      this.removeProgress(id);
    }, delay);
    
    this.autoHideTimers.set(id, timer);
  }

  /**
   * Clear auto-hide timer
   */
  private clearAutoHideTimer(id: string): void {
    const timer = this.autoHideTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.autoHideTimers.delete(id);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `progress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all progress indicators and toasts
   */
  clearAll(): void {
    // Clear all timers
    for (const timer of this.autoHideTimers.values()) {
      clearTimeout(timer);
    }
    
    this.progressIndicators.clear();
    this.toasts.clear();
    this.loadingStates.clear();
    this.autoHideTimers.clear();
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      activeProgress: this.progressIndicators.size,
      activeToasts: this.toasts.size,
      activeLoadingStates: this.loadingStates.size,
      activeTimers: this.autoHideTimers.size
    };
  }
}