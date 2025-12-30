import { ProgressManager } from '../ProgressManager';

describe('ProgressManager', () => {
  let progressManager: ProgressManager;

  beforeEach(() => {
    // Reset singleton instance for testing
    (ProgressManager as any).instance = undefined;
    progressManager = ProgressManager.getInstance();
  });

  afterEach(() => {
    progressManager.clearAll();
  });

  test('should be a singleton', () => {
    const instance1 = ProgressManager.getInstance();
    const instance2 = ProgressManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  describe('Progress Indicators', () => {
    test('should start progress indicator', () => {
      const config = {
        id: 'test-progress',
        type: 'determinate' as const,
        title: 'Test Progress',
        progress: 0,
      };

      const id = progressManager.startProgress(config);
      expect(id).toBe('test-progress');

      const progress = progressManager.getProgress(id);
      expect(progress).toBeDefined();
      expect(progress!.title).toBe('Test Progress');
      expect(progress!.status).toBe('loading');
    });

    test('should update progress indicator', () => {
      const id = progressManager.startProgress({
        id: 'test-progress',
        type: 'determinate',
        title: 'Test Progress',
        progress: 0,
      });

      progressManager.updateProgress(id, {
        progress: 50,
        message: 'Half way there',
      });

      const progress = progressManager.getProgress(id);
      expect(progress!.progress).toBe(50);
      expect(progress!.message).toBe('Half way there');
    });

    test('should complete progress indicator', () => {
      const id = progressManager.startProgress({
        id: 'test-progress',
        type: 'determinate',
        title: 'Test Progress',
        progress: 0,
      });

      progressManager.completeProgress(id, true, 'Completed successfully');

      const progress = progressManager.getProgress(id);
      expect(progress!.progress).toBe(100);
      expect(progress!.status).toBe('success');
      expect(progress!.message).toBe('Completed successfully');
    });

    test('should cancel progress indicator', () => {
      const id = progressManager.startProgress({
        id: 'test-progress',
        type: 'determinate',
        title: 'Test Progress',
        progress: 0,
      });

      progressManager.cancelProgress(id);

      const progress = progressManager.getProgress(id);
      expect(progress!.status).toBe('cancelled');
    });

    test('should remove progress indicator', () => {
      const id = progressManager.startProgress({
        id: 'test-progress',
        type: 'determinate',
        title: 'Test Progress',
        progress: 0,
      });

      progressManager.removeProgress(id);

      const progress = progressManager.getProgress(id);
      expect(progress).toBeUndefined();
    });

    test('should get all progress indicators', () => {
      progressManager.startProgress({
        id: 'progress-1',
        type: 'determinate',
        title: 'Progress 1',
      });

      progressManager.startProgress({
        id: 'progress-2',
        type: 'indeterminate',
        title: 'Progress 2',
      });

      const allProgress = progressManager.getAllProgress();
      expect(allProgress).toHaveLength(2);
      expect(allProgress.find(p => p.id === 'progress-1')).toBeDefined();
      expect(allProgress.find(p => p.id === 'progress-2')).toBeDefined();
    });

    test('should handle progress callbacks', (done) => {
      let updateCallCount = 0;
      let completeCallCount = 0;

      progressManager.onProgressUpdate = (id, config) => {
        updateCallCount++;
        expect(id).toBe('test-progress');
        expect(config.title).toBe('Test Progress');
      };

      progressManager.onProgressComplete = (id) => {
        completeCallCount++;
        expect(id).toBe('test-progress');
        
        expect(updateCallCount).toBeGreaterThan(0);
        expect(completeCallCount).toBe(1);
        done();
      };

      const id = progressManager.startProgress({
        id: 'test-progress',
        type: 'determinate',
        title: 'Test Progress',
      });

      progressManager.updateProgress(id, { progress: 50 });
      progressManager.removeProgress(id);
    });
  });

  describe('Toast Notifications', () => {
    test('should show toast notification', () => {
      const config = {
        id: 'test-toast',
        type: 'success' as const,
        title: 'Success!',
        message: 'Operation completed',
      };

      const id = progressManager.showToast(config);
      expect(id).toBe('test-toast');

      const toast = progressManager.getToast(id);
      expect(toast).toBeDefined();
      expect(toast!.title).toBe('Success!');
      expect(toast!.type).toBe('success');
    });

    test('should hide toast notification', () => {
      const id = progressManager.showToast({
        id: 'test-toast',
        type: 'info',
        title: 'Info',
      });

      progressManager.hideToast(id);

      const toast = progressManager.getToast(id);
      expect(toast).toBeUndefined();
    });

    test('should show success toast', () => {
      const id = progressManager.showSuccess('Success!', 'It worked!');
      
      const toast = progressManager.getToast(id);
      expect(toast!.type).toBe('success');
      expect(toast!.title).toBe('Success!');
      expect(toast!.message).toBe('It worked!');
    });

    test('should show error toast', () => {
      const id = progressManager.showError('Error!', 'Something went wrong');
      
      const toast = progressManager.getToast(id);
      expect(toast!.type).toBe('error');
      expect(toast!.title).toBe('Error!');
      expect(toast!.message).toBe('Something went wrong');
    });

    test('should show warning toast', () => {
      const id = progressManager.showWarning('Warning!', 'Be careful');
      
      const toast = progressManager.getToast(id);
      expect(toast!.type).toBe('warning');
      expect(toast!.title).toBe('Warning!');
      expect(toast!.message).toBe('Be careful');
    });

    test('should show info toast', () => {
      const id = progressManager.showInfo('Info', 'Just so you know');
      
      const toast = progressManager.getToast(id);
      expect(toast!.type).toBe('info');
      expect(toast!.title).toBe('Info');
      expect(toast!.message).toBe('Just so you know');
    });

    test('should auto-hide toast after duration', (done) => {
      const id = progressManager.showToast({
        type: 'info',
        title: 'Auto-hide',
        duration: 100, // 100ms for quick test
      });

      expect(progressManager.getToast(id)).toBeDefined();

      setTimeout(() => {
        expect(progressManager.getToast(id)).toBeUndefined();
        done();
      }, 150);
    });

    test('should handle toast callbacks', (done) => {
      let showCallCount = 0;
      let hideCallCount = 0;

      progressManager.onToastShow = (toast) => {
        showCallCount++;
        expect(toast.title).toBe('Test Toast');
      };

      progressManager.onToastHide = (id) => {
        hideCallCount++;
        expect(typeof id).toBe('string');
        
        expect(showCallCount).toBe(1);
        expect(hideCallCount).toBe(1);
        done();
      };

      const id = progressManager.showToast({
        type: 'info',
        title: 'Test Toast',
      });

      progressManager.hideToast(id);
    });
  });

  describe('Loading States', () => {
    test('should set loading state', () => {
      progressManager.setLoadingState('test-loading', true, 'Loading...', 25);

      const state = progressManager.getLoadingState('test-loading');
      expect(state).toBeDefined();
      expect(state!.isLoading).toBe(true);
      expect(state!.message).toBe('Loading...');
      expect(state!.progress).toBe(25);
    });

    test('should clear loading state', () => {
      progressManager.setLoadingState('test-loading', true, 'Loading...');
      progressManager.clearLoadingState('test-loading');

      const state = progressManager.getLoadingState('test-loading');
      expect(state).toBeUndefined();
    });

    test('should get all loading states', () => {
      progressManager.setLoadingState('loading-1', true, 'Loading 1');
      progressManager.setLoadingState('loading-2', true, 'Loading 2');

      const states = progressManager.getAllLoadingStates();
      expect(states).toHaveLength(2);
      expect(states.find(s => s.id === 'loading-1')).toBeDefined();
      expect(states.find(s => s.id === 'loading-2')).toBeDefined();
    });

    test('should handle loading state callbacks', (done) => {
      progressManager.onLoadingStateChange = (id, state) => {
        expect(id).toBe('test-loading');
        expect(state.isLoading).toBe(true);
        expect(state.message).toBe('Loading...');
        done();
      };

      progressManager.setLoadingState('test-loading', true, 'Loading...');
    });
  });

  describe('Operation Progress', () => {
    test('should create operation progress', () => {
      const operation = progressManager.createOperationProgress('Test Operation', true);

      expect(operation.id).toBeDefined();
      expect(typeof operation.update).toBe('function');
      expect(typeof operation.complete).toBe('function');
      expect(typeof operation.cancel).toBe('function');

      const progress = progressManager.getProgress(operation.id);
      expect(progress).toBeDefined();
      expect(progress!.title).toBe('Test Operation');
      expect(progress!.cancellable).toBe(true);
    });

    test('should update operation progress', () => {
      const operation = progressManager.createOperationProgress('Test Operation');

      operation.update(50, 'Half done');

      const progress = progressManager.getProgress(operation.id);
      expect(progress!.progress).toBe(50);
      expect(progress!.message).toBe('Half done');
    });

    test('should complete operation progress', () => {
      const operation = progressManager.createOperationProgress('Test Operation');

      operation.complete(true, 'All done');

      const progress = progressManager.getProgress(operation.id);
      expect(progress!.status).toBe('success');
      expect(progress!.message).toBe('All done');
    });

    test('should cancel operation progress', () => {
      let cancelCalled = false;
      const onCancel = () => { cancelCalled = true; };
      
      const operation = progressManager.createOperationProgress('Test Operation', true, onCancel);

      operation.cancel();

      expect(cancelCalled).toBe(true);
      const progress = progressManager.getProgress(operation.id);
      expect(progress!.status).toBe('cancelled');
    });
  });

  describe('Skeleton Loader', () => {
    test('should create skeleton loader', () => {
      const skeleton = progressManager.createSkeletonLoader('test-skeleton', 'Loading content...');

      expect(typeof skeleton.show).toBe('function');
      expect(typeof skeleton.hide).toBe('function');
      expect(typeof skeleton.update).toBe('function');
    });

    test('should show and hide skeleton loader', () => {
      const skeleton = progressManager.createSkeletonLoader('test-skeleton');

      skeleton.show();
      let state = progressManager.getLoadingState('test-skeleton');
      expect(state).toBeDefined();
      expect(state!.isLoading).toBe(true);

      skeleton.hide();
      state = progressManager.getLoadingState('test-skeleton');
      expect(state).toBeUndefined();
    });

    test('should update skeleton loader', () => {
      const skeleton = progressManager.createSkeletonLoader('test-skeleton', 'Initial message');

      skeleton.show();
      skeleton.update('Updated message');

      const state = progressManager.getLoadingState('test-skeleton');
      expect(state!.message).toBe('Updated message');
    });
  });

  describe('Utility Methods', () => {
    test('should clear all progress and toasts', () => {
      progressManager.startProgress({
        id: 'progress-1',
        type: 'determinate',
        title: 'Progress 1',
      });

      progressManager.showToast({
        id: 'toast-1',
        type: 'info',
        title: 'Toast 1',
      });

      progressManager.setLoadingState('loading-1', true);

      progressManager.clearAll();

      expect(progressManager.getAllProgress()).toHaveLength(0);
      expect(progressManager.getAllToasts()).toHaveLength(0);
      expect(progressManager.getAllLoadingStates()).toHaveLength(0);
    });

    test('should provide statistics', () => {
      progressManager.startProgress({
        id: 'progress-1',
        type: 'determinate',
        title: 'Progress 1',
      });

      progressManager.showToast({
        id: 'toast-1',
        type: 'info',
        title: 'Toast 1',
      });

      progressManager.setLoadingState('loading-1', true);

      const stats = progressManager.getStats();
      expect(stats.activeProgress).toBe(1);
      expect(stats.activeToasts).toBe(1);
      expect(stats.activeLoadingStates).toBe(1);
    });
  });
});