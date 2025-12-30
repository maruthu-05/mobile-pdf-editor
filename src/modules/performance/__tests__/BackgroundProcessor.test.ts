import { BackgroundProcessor } from '../BackgroundProcessor';

describe('BackgroundProcessor', () => {
  let processor: BackgroundProcessor;

  beforeEach(() => {
    // Reset singleton instance for testing
    (BackgroundProcessor as any).instance = undefined;
    processor = BackgroundProcessor.getInstance();
  });

  afterEach(() => {
    processor.stop();
  });

  test('should be a singleton', () => {
    const instance1 = BackgroundProcessor.getInstance();
    const instance2 = BackgroundProcessor.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('should register and execute task executors', async () => {
    const mockExecutor = jest.fn().mockResolvedValue('test result');
    processor.registerExecutor('merge', mockExecutor);

    const taskId = processor.addTask('merge', { test: 'data' }, 'high');
    
    // Wait for task to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const task = processor.getTask(taskId);
    expect(task).toBeDefined();
    expect(task!.status).toBe('completed');
    expect(task!.result).toBe('test result');
    expect(mockExecutor).toHaveBeenCalledWith(
      { test: 'data' },
      expect.any(Function),
      expect.any(AbortSignal)
    );
  });

  test('should handle task execution errors', async () => {
    const mockExecutor = jest.fn().mockRejectedValue(new Error('Test error'));
    processor.registerExecutor('merge', mockExecutor);

    const taskId = processor.addTask('merge', { test: 'data' });
    
    // Wait for task to fail
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const task = processor.getTask(taskId);
    expect(task).toBeDefined();
    expect(task!.status).toBe('failed');
    expect(task!.error).toBe('Test error');
  });

  test('should handle missing executor', async () => {
    const taskId = processor.addTask('nonexistent' as any, { test: 'data' });
    
    // Wait for task to fail
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const task = processor.getTask(taskId);
    expect(task).toBeDefined();
    expect(task!.status).toBe('failed');
    expect(task!.error).toContain('No executor registered');
  });

  test('should cancel pending tasks', () => {
    const taskId = processor.addTask('merge', { test: 'data' });
    
    const cancelled = processor.cancelTask(taskId);
    expect(cancelled).toBe(true);
    
    const task = processor.getTask(taskId);
    expect(task!.status).toBe('cancelled');
  });

  test('should cancel running tasks', async () => {
    let abortSignal: AbortSignal | undefined;
    const mockExecutor = jest.fn().mockImplementation((data, onProgress, signal) => {
      abortSignal = signal;
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (signal.aborted) {
            reject(new Error('Operation cancelled'));
          } else {
            resolve('completed');
          }
        }, 200);
      });
    });
    
    processor.registerExecutor('merge', mockExecutor);
    const taskId = processor.addTask('merge', { test: 'data' });
    
    // Wait for task to start
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const cancelled = processor.cancelTask(taskId);
    expect(cancelled).toBe(true);
    expect(abortSignal?.aborted).toBe(true);
    
    // Wait for cancellation to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const task = processor.getTask(taskId);
    expect(task!.status).toBe('cancelled');
  });

  test('should prioritize tasks correctly', async () => {
    const executionOrder: string[] = [];
    const mockExecutor = jest.fn().mockImplementation(async (data) => {
      executionOrder.push(data.id);
      return 'completed';
    });
    
    processor.registerExecutor('merge', mockExecutor);
    processor.setMaxConcurrentTasks(1); // Process one at a time to test ordering
    
    // Add tasks in different priority order
    processor.addTask('merge', { id: 'low1' }, 'low');
    processor.addTask('merge', { id: 'high1' }, 'high');
    processor.addTask('merge', { id: 'medium1' }, 'medium');
    processor.addTask('merge', { id: 'high2' }, 'high');
    
    // Wait for all tasks to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // High priority tasks should execute first
    expect(executionOrder[0]).toBe('high1');
    expect(executionOrder[1]).toBe('high2');
    expect(executionOrder[2]).toBe('medium1');
    expect(executionOrder[3]).toBe('low1');
  });

  test('should track task progress', async () => {
    const progressUpdates: number[] = [];
    
    const mockExecutor = jest.fn().mockImplementation(async (data, onProgress) => {
      onProgress(25, 'Step 1');
      await new Promise(resolve => setTimeout(resolve, 10));
      onProgress(50, 'Step 2');
      await new Promise(resolve => setTimeout(resolve, 10));
      onProgress(75, 'Step 3');
      await new Promise(resolve => setTimeout(resolve, 10));
      onProgress(100, 'Complete');
      return 'completed';
    });
    
    processor.registerExecutor('merge', mockExecutor);
    
    const taskId = processor.addTask('merge', { test: 'data' }, 'high', {
      onProgress: (progress) => {
        progressUpdates.push(progress);
      }
    });
    
    // Wait for task to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const task = processor.getTask(taskId);
    expect(task!.status).toBe('completed');
    expect(task!.progress).toBe(100);
    expect(progressUpdates).toContain(25);
    expect(progressUpdates).toContain(50);
    expect(progressUpdates).toContain(75);
    expect(progressUpdates).toContain(100);
  });

  test('should handle task callbacks', async () => {
    let onCompleteCalled = false;
    let onProgressCalled = false;
    
    const mockExecutor = jest.fn().mockImplementation(async (data, onProgress) => {
      onProgress(50);
      return 'test result';
    });
    
    processor.registerExecutor('merge', mockExecutor);
    
    const taskId = processor.addTask('merge', { test: 'data' }, 'high', {
      onProgress: (progress) => {
        onProgressCalled = true;
        expect(progress).toBe(50);
      },
      onComplete: (result) => {
        onCompleteCalled = true;
        expect(result).toBe('test result');
      }
    });
    
    // Wait for task to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(onProgressCalled).toBe(true);
    expect(onCompleteCalled).toBe(true);
  });

  test('should handle error callbacks', async () => {
    let onErrorCalled = false;
    
    const mockExecutor = jest.fn().mockRejectedValue(new Error('Test error'));
    processor.registerExecutor('merge', mockExecutor);
    
    const taskId = processor.addTask('merge', { test: 'data' }, 'high', {
      onError: (error) => {
        onErrorCalled = true;
        expect(error).toBe('Test error');
      }
    });
    
    // Wait for task to fail
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(onErrorCalled).toBe(true);
  });

  test('should get tasks by status', async () => {
    const mockExecutor = jest.fn().mockResolvedValue('completed');
    processor.registerExecutor('merge', mockExecutor);
    
    const taskId1 = processor.addTask('merge', { id: 1 });
    const taskId2 = processor.addTask('merge', { id: 2 });
    processor.cancelTask(taskId2);
    
    // Wait for first task to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const completedTasks = processor.getTasksByStatus('completed');
    const cancelledTasks = processor.getTasksByStatus('cancelled');
    
    expect(completedTasks).toHaveLength(1);
    expect(completedTasks[0].id).toBe(taskId1);
    expect(cancelledTasks).toHaveLength(1);
    expect(cancelledTasks[0].id).toBe(taskId2);
  });

  test('should get tasks by type', () => {
    processor.addTask('merge', { id: 1 });
    processor.addTask('split', { id: 2 });
    processor.addTask('merge', { id: 3 });
    
    const mergeTasks = processor.getTasksByType('merge');
    const splitTasks = processor.getTasksByType('split');
    
    expect(mergeTasks).toHaveLength(2);
    expect(splitTasks).toHaveLength(1);
  });

  test('should clear completed tasks', async () => {
    const mockExecutor = jest.fn().mockResolvedValue('completed');
    processor.registerExecutor('merge', mockExecutor);
    
    const taskId1 = processor.addTask('merge', { id: 1 });
    const taskId2 = processor.addTask('merge', { id: 2 });
    processor.cancelTask(taskId2);
    
    // Wait for first task to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(processor.getAllTasks()).toHaveLength(2);
    
    processor.clearCompletedTasks();
    
    expect(processor.getAllTasks()).toHaveLength(0);
  });

  test('should provide queue statistics', async () => {
    const mockExecutor = jest.fn().mockResolvedValue('completed');
    processor.registerExecutor('merge', mockExecutor);
    
    processor.addTask('merge', { id: 1 });
    processor.addTask('merge', { id: 2 });
    const taskId3 = processor.addTask('merge', { id: 3 });
    processor.cancelTask(taskId3);
    
    // Wait for tasks to process
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const stats = processor.getQueueStats();
    
    expect(stats.total).toBe(3);
    expect(stats.completed).toBe(2);
    expect(stats.cancelled).toBe(1);
    expect(stats.pending).toBe(0);
    expect(stats.running).toBe(0);
    expect(stats.failed).toBe(0);
  });

  test('should handle concurrent task limits', async () => {
    let runningCount = 0;
    let maxConcurrent = 0;
    
    const mockExecutor = jest.fn().mockImplementation(async () => {
      runningCount++;
      maxConcurrent = Math.max(maxConcurrent, runningCount);
      await new Promise(resolve => setTimeout(resolve, 50));
      runningCount--;
      return 'completed';
    });
    
    processor.registerExecutor('merge', mockExecutor);
    processor.setMaxConcurrentTasks(2);
    
    // Add multiple tasks
    for (let i = 0; i < 5; i++) {
      processor.addTask('merge', { id: i });
    }
    
    // Wait for all tasks to complete
    await new Promise(resolve => setTimeout(resolve, 300));
    
    expect(maxConcurrent).toBeLessThanOrEqual(2);
    expect(processor.getMaxConcurrentTasks()).toBe(2);
  });

  test('should handle processor events', async () => {
    const events: string[] = [];
    
    processor.onTaskAdded = () => events.push('added');
    processor.onTaskStarted = () => events.push('started');
    processor.onTaskCompleted = () => events.push('completed');
    processor.onTaskFailed = () => events.push('failed');
    processor.onTaskCancelled = () => events.push('cancelled');
    
    const mockExecutor = jest.fn().mockResolvedValue('completed');
    processor.registerExecutor('merge', mockExecutor);
    
    const taskId1 = processor.addTask('merge', { id: 1 });
    const taskId2 = processor.addTask('merge', { id: 2 });
    processor.cancelTask(taskId2);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(events).toContain('added');
    expect(events).toContain('started');
    expect(events).toContain('completed');
    expect(events).toContain('cancelled');
  });
});